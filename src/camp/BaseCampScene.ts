import Phaser from "phaser";
import { gameEvents, GAME_EVENT } from "../shared/phaser/events";
import { reportSceneError, safeHandler } from "../shared/phaser/sceneErrorHandler";
import { markSceneReady } from "../shared/phaser/sceneReady";
import { PIXEL_FONT, textResolution, redrawTextOnFontLoad } from "../shared/phaser/text";
import { getCampPosition, setCampPosition } from "./campPositionStore";
import { PALETTE, withAlpha } from "../shared/palette";
import { BASECAMP_BACKGROUND_IMAGE } from "../shared/assetPaths";
import {
  dirFromVector, resolveDir, atlasFrameName, PLAYER_WALK_FRAMES,
  PLAYER_ATLAS_ROW_DIRS, PLAYER_ATLAS_KEY, PLAYER_ATLAS_PNG, PLAYER_ATLAS_JSON,
  type Dir8,
} from "../shared/playerSprite";
import { usePlayerStore } from "../shared/playerStore";
import { ORION_DIALOGUES, BAROS_DIALOGUES, resolveNpcInteraction } from "./campDialogues";
import { LOADED_MATERIAL_COUNT } from "./campSmallTalk";
import type { SmallTalkNpcId } from "./campSmallTalk";
import type { DialogueEntry } from "./campDialogues";
import {
  CAMP_COLLISION_BOXES, CAMP_PROP_BOXES, CAMP_MAP_W, CAMP_MAP_H,
  CAMP_INTERACTIONS, PLAYER_BODY, PLAYER_BODY_OFFSET, PLAYER_SCALE, NPC_BODY,
  footYFromSpriteY, safeSpawn,
  type CampInteraction,
} from "./campCollision";
import {
  isCollisionDebugOn, onCollisionDebugChange, bindCollisionDebugKey, DEBUG_LINE_HEX,
} from "../shared/collisionDebug";

// ─── 맵 좌표 ──────────────────────────────────────────────────────────────────
// 탑·숲·집의 판정 좌표와 복귀 좌표는 campCollision.ts 의 CAMP_INTERACTIONS 한 벌뿐이다.
// 여기 숫자를 다시 적지 말 것 — 충돌 형상과 같이 움직여야 하는 값이라 거기 있다.

const CAM_ZOOM = 0.5;
const NPC_DISPLAY_HEIGHT = 192;   // 플레이어(160) × 1.2배
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
  private hint?: Phaser.GameObjects.Text;

  constructor() {
    super("BaseCampScene");
  }

  preload() {
    // JSON Array 형식(Aseprite 내보내기)이라 load.atlas 로 읽는다. load.aseprite 는
    // meta.frameTags 를 요구하는데 이 파일에는 태그가 없다 — 애니메이션은 아래
    // registerPlayerAnimations 가 프레임 이름 규칙에서 직접 만든다.
    this.load.atlas(PLAYER_ATLAS_KEY, PLAYER_ATLAS_PNG, PLAYER_ATLAS_JSON);
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
    // 벽 안에서 시작하면 그대로 갇힌다 — 정적 바디는 이미 겹쳐 있는 것을 밀어내지 않는다.
    // 형상을 고치는 중에 실제로 걸렸다. 들어올 자리는 테스트가 지키지만, 여기서도 한 번 본다.
    const initPos = safeSpawn(getCampPosition());
    this.player = this.physics.add.sprite(initPos.x, initPos.y, PLAYER_ATLAS_KEY, atlasFrameName("S", 0));
    this.player.setCollideWorldBounds(true);
    this.player.setScale(PLAYER_SCALE);
    this.player.setDepth(footYFromSpriteY(initPos.y));

    // 바디는 발밑에 둔다. 예전에는 스프라이트 한가운데(offset 27,27)에 있어서,
    // 벽 앞에 서면 발이 화단·좌판 안으로 80px 씩 파고들어 있었다.
    // texture 좌표 → 월드 = ×PLAYER_SCALE. 아틀라스 한 칸의 아래쪽에 맞춘다.
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.setSize(PLAYER_BODY.w / PLAYER_SCALE, PLAYER_BODY.h / PLAYER_SCALE);
    body.setOffset(PLAYER_BODY_OFFSET.x, PLAYER_BODY_OFFSET.y);

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

    // ── E 키 ────────────────────────────────────────────────────────────────────
    // 판정은 findTarget 하나로만 한다. 예전에는 여기와 근접 안내가 각자 조건을 갖고
    // 있어서 "E: 숲 입장" 이 떠 있는데 E 가 안 먹는 구간이 30px 씩 있었다.
    keyboard.on("keydown-E", safeHandler(this, () => {
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
   * NPC 도 막는다 — 예전에는 통과할 수 있어서 오리온과 바로스 몸을 뚫고 지나갔다.
   */
  private buildCollision() {
    const statics = this.physics.add.staticGroup();

    for (const b of CAMP_COLLISION_BOXES) {
      // alpha 0 — 화면에 안 그려지는 판정용이라 색은 의미가 없다
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
    });
    this.redrawCollisionDebug();
  }

  private redrawCollisionDebug() {
    const g = this.debugGfx;
    if (!g) return;
    g.clear();
    if (!isCollisionDebugOn()) return;

    // 지형은 자동 생성이라 사각형이 60개 가까이 되고 내부 경계가 많다. 얇고 흐리게
    // 그려야 손으로 잡은 소품 박스가 묻히지 않는다.
    const props = new Set<string>(CAMP_PROP_BOXES.map((b) => b.id));
    g.lineStyle(2, DEBUG_LINE_HEX, 0.45);
    for (const b of CAMP_COLLISION_BOXES) {
      if (!props.has(b.id)) g.strokeRect(b.x, b.y, b.w, b.h);
    }
    g.lineStyle(3, DEBUG_LINE_HEX, 1);
    g.fillStyle(DEBUG_LINE_HEX, 0.14);
    for (const b of CAMP_PROP_BOXES) {
      g.fillRect(b.x, b.y, b.w, b.h);
      g.strokeRect(b.x, b.y, b.w, b.h);
    }
    for (const npc of this.npcSprites) {
      g.strokeRect(npc.x - NPC_BODY.w / 2, npc.y - NPC_BODY.h, NPC_BODY.w, NPC_BODY.h);
    }
  }

  /**
   * 걷기 애니메이션 등록.
   *
   * 아틀라스에 든 방향은 다섯이다(S·SE·E·NE·N). 나머지 셋은 좌우 반전이라
   * 애니메이션을 따로 만들지 않는다 — resolveDir 이 어느 쪽을 뒤집을지 정한다.
   */
  private registerPlayerAnimations() {
    if (!this.textures.exists(PLAYER_ATLAS_KEY)) return;

    for (const dir of PLAYER_ATLAS_ROW_DIRS) {
      const key = `walk_${dir}`;
      if (this.anims.exists(key)) continue;
      this.anims.create({
        key,
        frames: this.anims.generateFrameNames(PLAYER_ATLAS_KEY, {
          prefix: `walk_${dir}_`, start: 0, end: PLAYER_WALK_FRAMES - 1, zeroPad: 2,
        }),
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
   * 지금 E 로 할 수 있는 것. 범위 안에서 **가장 가까운** 하나를 고른다.
   *
   * 우선순위 규칙이 한 군데에만 있어야 근접 안내와 E 가 어긋나지 않는다. 거리 비교가
   * 곧 규칙이라 판정 원이 겹쳐도 예측이 된다 — 오리온 옆에 서면 오리온, 숲 쪽으로
   * 두 걸음 가면 숲이다.
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
      // 바로 앞에 한 잡담만 기억한다. 세이브에 넣지 않는다 — 새로고침하면 같은 말이 한 번
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
    // 서쪽 셋은 resolveDir 이 동쪽 프레임을 뒤집어 쓰라고 알려 준다.
    if (isMoving) this.facing = dirFromVector(body.velocity.x, body.velocity.y);
    const { dir, flipX } = resolveDir(this.facing);
    this.player.setFlipX(flipX);
    if (isMoving) {
      // play 의 두 번째 인자(ignoreIfPlaying)로 같은 애니메이션 재시작을 막는다.
      // 매 프레임 처음부터 다시 틀면 첫 장에서 멈춘 것처럼 보인다.
      this.player.anims.play(`walk_${dir}`, true);
    } else {
      this.player.anims.stop();
      this.player.setFrame(atlasFrameName(dir, 0));
    }

    // ── depth: 발끝 y = depth → 건물·NPC 뒤/앞 자동 처리 ──────────────────────
    this.player.setDepth(footYFromSpriteY(this.player.y));

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
    // 안내는 하나뿐이고, 판정은 E 키와 같은 findTarget 을 쓴다. 예전에는 대상마다
    // 텍스트를 따로 만들고 지웠는데, 만든 자리에 그대로 못박혀 있어서 걸어가면
    // 안내만 월드에 남아 떠다녔다. 매 프레임 플레이어 위로 옮긴다.
    this.updateHint(this.findTarget());
  }

  private updateHint(target: ReturnType<BaseCampScene["findTarget"]>) {
    const label = target
      ? target.kind === "npc" ? target.npc.name : target.spot.label
      : null;

    if (!label) {
      this.hint?.destroy();
      this.hint = undefined;
      return;
    }
    if (!this.hint) {
      this.hint = this.add
        .text(0, 0, "", {
          fontSize: "24px",
          fontFamily: PIXEL_FONT,
          resolution: textResolution(),
          color: PALETTE.sand200,
          backgroundColor: withAlpha("shadow900", 0.93),
          padding: { x: 6, y: 3 },
        })
        .setOrigin(0.5, 1)
        .setName("interactHint")
        .setDepth(9999);
    }
    const text = `E: ${label}`;
    if (this.hint.text !== text) this.hint.setText(text);
    this.hint.setPosition(this.player.x, this.player.y - 60);
  }
}
