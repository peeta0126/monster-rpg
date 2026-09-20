import Phaser from "phaser";
import { gameEvents, GAME_EVENT } from "../shared/phaser/events";
import { reportSceneError, safeHandler } from "../shared/phaser/sceneErrorHandler";
import { markSceneReady } from "../shared/phaser/sceneReady";
import { redrawTextOnFontLoad } from "../shared/phaser/text";
import { getCampPosition, setCampPosition } from "./campPositionStore";
import { isCampInputLocked } from "./campInputLock";
import { BASECAMP_BACKGROUND_IMAGE } from "../shared/assetPaths";
import {
  dirFromVector, monsterDirection, PLAYER_MONSTER_WALK_FRAMES,
  PLAYER_SHEET_KEYS, PLAYER_SHEET_PATHS, PLAYER_SHEET_METRICS, spriteOriginY,
  type Dir8, type MonsterSheetDir,
} from "../shared/playerSprite";
import { usePlayerStore } from "../shared/playerStore";
import { ORION_DIALOGUES, BAROS_DIALOGUES, resolveNpcInteraction } from "./campDialogues";
import { LOADED_MATERIAL_COUNT } from "./campSmallTalk";
import type { SmallTalkNpcId } from "./campSmallTalk";
import type { DialogueEntry } from "./campDialogues";
import {
  CAMP_COLLISION_BOXES, CAMP_WALL_SEGMENTS, CAMP_MAP_W, CAMP_MAP_H,
  CAMP_INTERACTIONS, PLAYER_BODY, PLAYER_SCALE, NPC_BODY,
  playerBodyOffset, bodyYFromSpriteY, safeSpawn,
  type CampInteraction,
} from "./campCollision";
import {
  isCollisionDebugOn, onCollisionDebugChange, bindCollisionDebugKey, DEBUG_LINE_HEX,
} from "../shared/collisionDebug";

// ─── 맵 좌표 ──────────────────────────────────────────────────────────────────
// 탑·숲·집의 판정 좌표와 복귀 좌표는 campCollision.ts 의 CAMP_INTERACTIONS 한 벌뿐이다.
// 여기 숫자를 다시 적지 마라. 충돌 형상이랑 같이 움직여야 하는 값이라 거기 있다.

export const CAM_ZOOM = 0.5;
/** 촌장·바로스 표시 높이. 플레이어(약 174px)보다 조금 크게 잡는다. */
const NPC_DISPLAY_HEIGHT = 192;
const NPC_INTERACT_DISTANCE = 160; // 디스플레이 절반(160)에 맞춰 조정

type BaseCampNpc = {
  id: SmallTalkNpcId;
  name: string;
  spriteTexture: string;  // 월드에 표시되는 픽셀아트 스프라이트 텍스처 키
  portraitPath: string;   // 대화창에 표시되는 초상화 이미지 경로
  x: number;
  y: number;
  dialogues: DialogueEntry[];
  tint?: number;
  flipX?: boolean;
};
type BaseCampNpcInstance = BaseCampNpc & { sprite: Phaser.GameObjects.Image };

const BASECAMP_NPCS: BaseCampNpc[] = [
  {
    id: "baros",
    name: "Baros",
    spriteTexture: "Baros",
    portraitPath: "/assets/player/Baros_portrait.webp",
    x: 430,
    y: 1200,
    dialogues: BAROS_DIALOGUES,
  },
  {
    id: "orion",
    name: "Orion",
    spriteTexture: "Orion",
    portraitPath: "/assets/player/Orion_portrait.webp",
    x: 1090,
    y: 1950,
    dialogues: ORION_DIALOGUES,
  },
];

export default class BaseCampScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private npcSprites: BaseCampNpcInstance[] = [];
  /** NPC 별로 바로 앞에 한 잡담. 화면 상태라 저장하지 않는다 */
  private lastSmallTalk: Record<string, string> = {};
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
  };
  private facing: Dir8 = "S";
  private debugGfx?: Phaser.GameObjects.Graphics;
  private playerBodyGfx?: Phaser.GameObjects.Graphics;
  private cleanupDebug?: () => void;
  /** 근접 안내. 하나만 두고 매 프레임 플레이어를 따라 옮긴다. */
  /** 지금 화면에 떠 있는 안내. 같은 값을 두 번 보내지 않으려고 들고 있다 */
  private hintLabel: string | null = null;

  /** 지금 걸려 있는 시트. 텍스처 키로 보면 애니메이션이 바꿔 둔 것과 구분이 안 된다. */
  private sheet: MonsterSheetDir | null = null;

  constructor() {
    super("BaseCampScene");
  }

  preload() {
    // 방향마다 가로로 여섯 칸짜리 시트 한 장이다. 태그가 없어 load.aseprite 는 못 쓰고,
    // 애니메이션은 registerPlayerAnimations 가 칸 번호로 직접 만든다.
    //
    // 칸 크기는 시트마다 다르다(북동만 2048×682). 표 하나에서 꺼내 쓴다 — 여기에
    // 숫자를 다시 적으면 2170px 짜리 정면 시트를 362 로 잘라 다섯 칸만 만들고,
    // 마지막 걷기 프레임이 통째로 사라진다.
    (Object.keys(PLAYER_SHEET_KEYS) as MonsterSheetDir[]).forEach((direction) => {
      const { frameWidth, frameHeight } = PLAYER_SHEET_METRICS[direction];
      this.load.spritesheet(PLAYER_SHEET_KEYS[direction], PLAYER_SHEET_PATHS[direction], {
        frameWidth, frameHeight,
      });
    });
    this.load.image("basecamp-bg", BASECAMP_BACKGROUND_IMAGE);
    this.load.image("basecamp-bg-1", "/assets/basecamp/basecamp-bg-1.webp");
    BASECAMP_NPCS.forEach((npc) => {
      this.load.image(npc.spriteTexture, `/assets/player/${npc.spriteTexture}.png`);
    });
  }

  create() {
    try {
      this.createImpl();
    } catch (error) {
      reportSceneError(this, error);
    }
  }

  private createImpl() {
    const mapW = CAMP_MAP_W,
      mapH = CAMP_MAP_H;
    this.cameras.main.setZoom(CAM_ZOOM);
    this.physics.world.setBounds(0, 0, mapW, mapH);

    // 맵 가로(1536)가 뷰포트 가로(960/0.5=1920)보다 좁으므로 좌우 패딩을 추가해 중앙 정렬
    const viewportW = this.scale.width / CAM_ZOOM;
    const padX = Math.max(0, Math.floor((viewportW - mapW) / 2));
    this.cameras.main.setBounds(-padX, 0, mapW + padX * 2, mapH);

    // ── 배경 / 드래곤 배너 ────────────────────────────────────────────────────────
    this.add.image(mapW / 2, mapH / 2, "basecamp-bg").setDepth(0);
    this.add.image(mapW / 2, mapH / 2, "basecamp-bg-1").setDepth(3000);
    this.createNpcs();

    // ─────────────────────────────────────────────────────────────────────────────
    // 플레이어
    // ─────────────────────────────────────────────────────────────────────────────
    // 벽 안에서 시작하면 그대로 갇힌다. 정적 바디는 이미 겹쳐 있는 걸 안 밀어낸다.
    // 형상 고치는 중에 실제로 걸렸다. 들어올 자리는 테스트가 지키지만 여기서도 한 번 본다.
    const initPos = safeSpawn(getCampPosition());
    this.player = this.physics.add.sprite(initPos.x, initPos.y, PLAYER_SHEET_KEYS.south, 0);
    this.player.setCollideWorldBounds(true);
    this.player.setScale(PLAYER_SCALE);
    this.player.setDepth(bodyYFromSpriteY(initPos.y));

    // 바디는 발밑에 둔다. 원래 스프라이트 한가운데(offset 27,27)에 있어서,
    // 벽 앞에 서면 발이 화단·좌판 안으로 80px 씩 파고들어 있었다.
    // texture 좌표 → 월드 = ×PLAYER_SCALE. 자리는 applySheet 이 시트마다 다시 잡는다.
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.setSize(PLAYER_BODY.w / PLAYER_SCALE, PLAYER_BODY.h / PLAYER_SCALE);
    // 씬 인스턴스는 재시작해도 그대로 재사용된다. 새 스프라이트에 다시 먹이려면 비워야 한다.
    this.sheet = null;
    this.applySheet("south");

    // ── 카메라 ──────────────────────────────────────────────────────────────────
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);

    // ── 키보드 ──────────────────────────────────────────────────────────────────
    const keyboard = this.input.keyboard!;
    this.cursors = keyboard.createCursorKeys();
    this.wasd = keyboard.addKeys("W,A,S,D") as {
      W: Phaser.Input.Keyboard.Key;
      A: Phaser.Input.Keyboard.Key;
      S: Phaser.Input.Keyboard.Key;
      D: Phaser.Input.Keyboard.Key;
    };

    // ── Space 키 ───────────────────────────────────────────────────────────────
    // 상호작용 키는 게임 전체가 Space 하나다(공방도 같다). 브라우저가 이 키로 페이지를
    // 굴리므로 기본 동작을 캡처로 막는다 — 안 막으면 캔버스 아래로 화면이 한 번씩 뛴다.
    //
    // 판정은 findTarget 하나로만 한다. 원래는 여기랑 근접 안내가 각자 조건을 갖고
    // 있어서, "숲 입장"이 떠 있는데 키가 안 먹는 구간이 30px 씩 있었다.
    keyboard.addCapture("SPACE");
    keyboard.on("keydown-SPACE", safeHandler(this, () => {
      // 대사창·메뉴·모달이 떠 있으면 이 키는 그쪽 것이다. 안 막으면 대사를 넘기려고
      // 누른 Space 가 같은 프레임에 그 대사를 처음부터 다시 연다.
      if (isCampInputLocked()) return;
      const target = this.findTarget();
      if (!target) return;
      if (target.kind === "npc") { this.showNpcDialogue(target.npc); return; }

      const { spot } = target;
      setCampPosition(spot.returnAt.x, spot.returnAt.y);
      if (spot.id === "tower") {
        gameEvents.emit(GAME_EVENT.ENTER_BATTLE, {
          from: "basecamp",
          portalId: "dungeon-entrance-1",
          floor: 1,
        });
      } else if (spot.id === "forest") {
        gameEvents.emit(GAME_EVENT.ENTER_FOREST);
      } else {
        gameEvents.emit(GAME_EVENT.ENTER_HOUSING);
      }
    }));
    // ── 충돌 ────────────────────────────────────────────────────────────────────
    // 형상은 campCollision.ts 한 곳에만 있다. 좌표를 고칠 일이 있으면 여기가 아니라 거기다.
    this.buildCollision();

    this.registerPlayerAnimations();
    redrawTextOnFontLoad(this);
    markSceneReady(this);
  }

  /**
   * 정적 충돌 바디 + 개발자 모드 표시선.
   *
   * NPC 도 막는다. 원래는 통과할 수 있어서 오리온과 바로스 몸을 뚫고 지나갔다.
   */
  private buildCollision() {
    const statics = this.physics.add.staticGroup();

    for (const b of CAMP_COLLISION_BOXES) {
      // alpha 0. 화면에 안 그려지는 판정용이라 색은 의미가 없다
      const r = this.add.rectangle(b.x + b.w / 2, b.y + b.h / 2, b.w, b.h, 0x000000, 0); // palette-ok: alpha 0, 판정 전용
      statics.add(r);
    }
    for (const npc of this.npcSprites) {
      const r = this.add.rectangle(npc.x, npc.y - NPC_BODY.h / 2, NPC_BODY.w, NPC_BODY.h, 0x000000, 0); // palette-ok: alpha 0, 판정 전용
      statics.add(r);
    }
    this.physics.add.collider(this.player, statics);

    // ── 개발자 모드 표시선 ─────────────────────────────────────────────────────
    this.debugGfx = this.add.graphics().setDepth(9998);
    this.playerBodyGfx = this.add.graphics().setDepth(9999);
    this.cleanupDebug = bindCollisionDebugKey();
    const unsubscribe = onCollisionDebugChange(() => this.redrawCollisionDebug());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      unsubscribe();
      this.cleanupDebug?.();
      // 떠날 때 안내를 내린다. 씬 인스턴스는 재사용되므로 들고 있던 값도 같이 비워야
      // 다음에 같은 자리에서 다시 들어왔을 때 emit 이 한 번 걸러진다.
      this.hintLabel = null;
      gameEvents.emit(GAME_EVENT.CAMP_INTERACT_HINT, null);
    });
    this.redrawCollisionDebug();
  }

  private redrawCollisionDebug() {
    const g = this.debugGfx;
    if (!g) return;
    g.clear();
    if (!isCollisionDebugOn()) return;

    // 실제로 막는 것은 사각형이라 그걸 칠하고, 그 위에 테두리 줄을 긋는다.
    // 줄만 그리면 비스듬한 벽(좌판 앞)의 두께가 안 보이고, 사각형만 칠하면
    // 어느 줄에서 나온 것인지 알 수 없다.
    g.fillStyle(DEBUG_LINE_HEX, 0.18);
    for (const b of CAMP_COLLISION_BOXES) g.fillRect(b.x, b.y, b.w, b.h);

    g.lineStyle(3, DEBUG_LINE_HEX, 1);
    for (const s of CAMP_WALL_SEGMENTS) {
      g.strokeLineShape(new Phaser.Geom.Line(s.x1, s.y1, s.x2, s.y2));
    }
    for (const npc of this.npcSprites) {
      g.strokeRect(npc.x - NPC_BODY.w / 2, npc.y - NPC_BODY.h, NPC_BODY.w, NPC_BODY.h);
    }
  }

  /**
   * 시트를 갈아끼운다. **텍스처만 바꾸면 안 된다.**
   *
   * 칸 크기가 시트마다 달라서(북동만 341×682) 텍스처를 바꾸면 `displayOrigin` 이
   * 같이 바뀌고, 물리 바디가 그 차이만큼 순간이동한다. 집 문 위 벽 안으로 7px 밀려
   * 들어갔다가 Arcade 가 밖으로 밀어내면서 벽 너머로 튕겨 나갔다 — 한 번 넘어가면
   * 같은 벽이 반대편에서 막아 다시 내려오지 못했다.
   *
   * origin 과 바디 오프셋을 텍스처와 **같이** 옮기면 바디는 월드에서 제자리고,
   * 발이 닿는 줄도 방향과 무관하게 한 자리다.
   */
  private applySheet(direction: MonsterSheetDir) {
    if (this.sheet === direction) return;
    this.sheet = direction;
    this.player.setTexture(PLAYER_SHEET_KEYS[direction], 0);
    this.player.setOrigin(0.5, spriteOriginY(direction));
    const offset = playerBodyOffset(direction);
    (this.player.body as Phaser.Physics.Arcade.Body).setOffset(offset.x, offset.y);
  }

  /**
   * 걷기 애니메이션 등록.
   *
   * 아틀라스에 든 방향은 다섯이다(S·SE·E·NE·N). 나머지 셋은 좌우 반전이라
   * 애니메이션을 따로 안 만든다. monsterDirection 이 어느 쪽을 뒤집을지 정한다.
   */
  private registerPlayerAnimations() {
    for (const direction of Object.keys(PLAYER_SHEET_KEYS) as Array<keyof typeof PLAYER_SHEET_KEYS>) {
      const key = `player-walk-${direction}`;
      if (this.anims.exists(key)) continue;
      this.anims.create({
        key,
        frames: this.anims.generateFrameNumbers(PLAYER_SHEET_KEYS[direction], { start: 1, end: PLAYER_MONSTER_WALK_FRAMES }),
        frameRate: 8,
        repeat: -1,
      });
    }
  }

  private createNpcs() {
    this.npcSprites = BASECAMP_NPCS.map((npc) => {
      const src = this.textures.get(npc.spriteTexture).getSourceImage();
      const displayW = Math.round(NPC_DISPLAY_HEIGHT * (src.width / src.height));
      const sprite = this.add
        .image(npc.x, npc.y, npc.spriteTexture)
        .setName(npc.id)
        .setOrigin(0.5, 1)
        .setDisplaySize(displayW, NPC_DISPLAY_HEIGHT)
        .setDepth(npc.y);

      if (npc.tint !== undefined) sprite.setTint(npc.tint);
      if (npc.flipX) sprite.setFlipX(true);
      return { ...npc, sprite };
    });
  }

  /**
   * 지금 E 로 할 수 있는 것. 범위 안에서 제일 가까운 하나를 고른다.
   *
   * 우선순위 규칙이 한 군데에만 있어야 근접 안내랑 E 가 안 어긋난다. 거리 비교가 곧
   * 규칙이라 판정 원이 겹쳐도 예측이 된다. 오리온 옆에 서면 오리온, 숲 쪽으로 두
   * 걸음 가면 숲이다.
   */
  private findTarget():
    | { kind: "npc"; npc: BaseCampNpcInstance; dist: number }
    | { kind: "spot"; spot: CampInteraction; dist: number }
    | null {
    const px = this.player.x, py = this.player.y;
    let best:
      | { kind: "npc"; npc: BaseCampNpcInstance; dist: number }
      | { kind: "spot"; spot: CampInteraction; dist: number }
      | null = null;

    const npc = this.getNearestNpc(px, py);
    if (npc) {
      best = { kind: "npc", npc, dist: Phaser.Math.Distance.Between(px, py, npc.x, npc.y) };
    }
    for (const spot of CAMP_INTERACTIONS) {
      const dist = Phaser.Math.Distance.Between(px, py, spot.x, spot.y);
      if (dist <= spot.radius && (!best || dist < best.dist)) best = { kind: "spot", spot, dist };
    }
    return best;
  }

  private getNearestNpc(x: number, y: number): BaseCampNpcInstance | null {
    let nearest: BaseCampNpcInstance | null = null;
    let nearestDistance = NPC_INTERACT_DISTANCE;

    for (const npc of this.npcSprites) {
      const distance = Phaser.Math.Distance.Between(x, y, npc.x, npc.y);
      if (distance < nearestDistance) {
        nearest = npc;
        nearestDistance = distance;
      }
    }

    return nearest;
  }

  private showNpcDialogue(npc: BaseCampNpc) {
    const {
      storyFlags, bestFloor, materials, questStatus, seenDialogues, party, potions,
      dexCaught, equippedArtifacts, craftedArtifacts, storage,
    } = usePlayerStore.getState();
    const result = resolveNpcInteraction(npc.dialogues, {
      npcId: npc.id,
      storyFlags, bestFloor, questStatus, seenDialogues,
      snapshot: {
        materials, potions, bestFloor, dexCaught, equippedArtifacts, craftedArtifacts,
        partyCount: party.length, storageCount: storage.length,
      },
      talkState: {
        hurt:     party.some((m) => m.currentHp < m.maxHp * 0.5),
        noPotion: Object.values(potions).every((n) => n <= 0),
        loaded:   Object.values(materials).reduce((a, n) => a + n, 0) >= LOADED_MATERIAL_COUNT,
      },
      // 바로 앞에 한 잡담만 기억한다. 세이브엔 안 넣는다. 새로고침하면 같은 말이 한 번
      // 더 나올 수 있지만, 그 정도를 저장 구조에 얹을 값어치는 없다.
      lastSmallTalk: this.lastSmallTalk[npc.id],
    });
    if (!result) return;
    if (result.smallTalkLine) this.lastSmallTalk[npc.id] = result.smallTalkLine;
    gameEvents.emit(GAME_EVENT.SHOW_NPC_DIALOGUE, {
      name: npc.name,
      lines: result.lines,
      portraitPath: npc.portraitPath,
      dialogueId: result.dialogueId,
      setsFlag: result.setsFlag,
      grantsMonsterId: result.grantsMonsterId,
      acceptQuestId: result.acceptQuestId,
      completeQuest: result.completeQuest,
    });
  }

  update(time: number, delta: number) {
    try {
      this.updateImpl(time, delta);
    } catch (error) {
      reportSceneError(this, error);
    }
  }

  private updateImpl(_time: number, _delta: number) {
    //좌표 확인용
    const pointer = this.input.activePointer;
    const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);

    const pointerText = this.children.getByName(
      "pointerText",
    ) as Phaser.GameObjects.Text;
    if (pointerText) {
      pointerText.setText(
        `x: ${Math.round(worldPoint.x)}, y: ${Math.round(worldPoint.y)}`,
      );
    }
    //-----

    if (!this.player || !this.cursors || !this.wasd) return;

    const speed = 220;
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0);

    const left = this.cursors.left.isDown || this.wasd.A.isDown;
    const right = this.cursors.right.isDown || this.wasd.D.isDown;
    const up = this.cursors.up.isDown || this.wasd.W.isDown;
    const down = this.cursors.down.isDown || this.wasd.S.isDown;
    const isMoving = left || right || up || down;

    if (left)       body.setVelocityX(-speed);
    else if (right) body.setVelocityX(speed);
    if (up)         body.setVelocityY(-speed);
    else if (down)  body.setVelocityY(speed);
    body.velocity.normalize().scale(speed);

    // 방향은 실제 이동 벡터에서 뽑는다. 대각선 입력도 8방향 중 하나로 떨어지고,
    // 서쪽 셋은 monsterDirection 이 동쪽 프레임을 뒤집어 쓰라고 알려 준다.
    if (isMoving) this.facing = dirFromVector(body.velocity.x, body.velocity.y);
    const { direction, flipX } = monsterDirection(this.facing);
    this.player.setFlipX(flipX);
    this.applySheet(direction);
    if (isMoving) {
      // play 의 두 번째 인자(ignoreIfPlaying)로 같은 애니메이션 재시작을 막는다.
      // 매 프레임 처음부터 다시 틀면 첫 장에서 멈춘 것처럼 보인다.
      this.player.anims.play(`player-walk-${direction}`, true);
    } else {
      this.player.anims.stop();
      this.player.setFrame(0);
    }

    // ── depth: 발이 닿는 줄 = depth → 건물·NPC 뒤/앞 자동 처리 ────────────────
    this.player.setDepth(bodyYFromSpriteY(this.player.y));

    // ── 개발자 모드: 플레이어 발밑 바디 ──────────────────────────────────────
    if (this.playerBodyGfx) {
      this.playerBodyGfx.clear();
      if (isCollisionDebugOn()) {
        const b = this.player.body as Phaser.Physics.Arcade.Body;
        this.playerBodyGfx.lineStyle(3, DEBUG_LINE_HEX, 1);
        this.playerBodyGfx.strokeRect(b.x, b.y, b.width, b.height);
      }
    }

    // ── 근접 힌트 ────────────────────────────────────────────────────────────────
    // 안내는 하나뿐이고 판정은 상호작용 키와 같은 findTarget 을 쓴다. 그리는 건 React 다
    // (StageHud). 캔버스에 글자로 얹으면 카메라 배율(0.5)과 캔버스 확대를 연달아 타서
    // 같은 12px 인데도 화면에서는 옆 띠의 안내보다 커 보인다.
    this.updateHint(this.findTarget());
  }

  private updateHint(target: ReturnType<BaseCampScene["findTarget"]>) {
    const label = target
      ? target.kind === "npc" ? target.npc.name : target.spot.label
      : null;

    // 바뀔 때만 보낸다. 매 프레임 emit 하면 React 가 같은 값으로 계속 다시 그린다.
    if (label === this.hintLabel) return;
    this.hintLabel = label;
    gameEvents.emit(GAME_EVENT.CAMP_INTERACT_HINT, label);
  }
}
