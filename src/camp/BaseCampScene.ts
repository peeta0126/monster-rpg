import Phaser from "phaser";
import { gameEvents, GAME_EVENT } from "../shared/phaser/events";
import { reportSceneError, safeHandler } from "../shared/phaser/sceneErrorHandler";
import { markSceneReady } from "../shared/phaser/sceneReady";
import { PIXEL_FONT, textResolution, redrawTextOnFontLoad } from "../shared/phaser/text";
import { getCampPosition, setCampPosition } from "./campPositionStore";
import { PALETTE, withAlpha } from "../shared/palette";
import { BASECAMP_BACKGROUND_IMAGE } from "../shared/assetPaths";
import {
  dirFromVector, getPlayerTextureKey, DIRS_8, PLAYER_ATLAS_KEY, type Dir8,
} from "../shared/playerSprite";
import { usePlayerStore } from "../shared/playerStore";
import { ORION_DIALOGUES, BAROS_DIALOGUES, resolveNpcInteraction } from "./campDialogues";
import type { DialogueEntry } from "./campDialogues";
import {
  CAMP_COLLISION_BOXES, CAMP_MAP_W, CAMP_MAP_H,
  PLAYER_BODY, PLAYER_BODY_OFFSET, PLAYER_SCALE, NPC_BODY,
} from "./campCollision";
import {
  isCollisionDebugOn, onCollisionDebugChange, bindCollisionDebugKey, DEBUG_LINE_HEX,
} from "../shared/collisionDebug";

// ─── 맵 좌표 (basecamp-bg.png 1536×2730 기준) ─────────────────────────────────
const FOREST_X = 1500,
  FOREST_Y = 1900;
const HOUSE_X = 794,
  HOUSE_Y = 1080;
const HOUSE_DOOR_Y = HOUSE_Y + 135;
const TOWER_X = 278,
  TOWER_Y = 1010;

const CAM_ZOOM = 0.5;
const NPC_DISPLAY_HEIGHT = 192;   // 플레이어(160) × 1.2배
const NPC_INTERACT_DISTANCE = 160; // 디스플레이 절반(160)에 맞춰 조정

type BaseCampNpc = {
  id: string;
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
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
  };
  private facing: Dir8 = "S";
  private walkFrame: 1 | 2 = 1;
  private walkTimer = 0;
  private debugGfx?: Phaser.GameObjects.Graphics;
  private playerBodyGfx?: Phaser.GameObjects.Graphics;
  private cleanupDebug?: () => void;

  constructor() {
    super("BaseCampScene");
  }

  preload() {
    // 8방향 아틀라스가 들어오면 아래 player-* 개별 PNG 목록을 지우고 이 줄을 켠다.
    // playerSprite.ts 의 ASSET_MODE 를 "atlas" 로 바꾸는 것과 한 세트다.
    // this.load.aseprite(PLAYER_ATLAS_KEY, PLAYER_ATLAS_PNG, PLAYER_ATLAS_JSON);
    this.load.image("basecamp-bg", BASECAMP_BACKGROUND_IMAGE);
    this.load.image("basecamp-bg-1", "/assets/basecamp/basecamp-bg-1.webp");
    this.load.image("player-up", "/assets/player/player-up.png");
    this.load.image("player-up-1", "/assets/player/player-up-1.png");
    this.load.image("player-up-2", "/assets/player/player-up-2.png");
    this.load.image("player-down", "/assets/player/player-down.png");
    this.load.image("player-down-1", "/assets/player/player-down-1.png");
    this.load.image("player-down-2", "/assets/player/player-down-2.png");
    this.load.image("player-left", "/assets/player/player-left.png");
    this.load.image("player-left-1", "/assets/player/player-left-1.png");
    this.load.image("player-left-2", "/assets/player/player-left-2.png");
    this.load.image("player-right", "/assets/player/player-right.png");
    this.load.image("player-right-1", "/assets/player/player-right-1.png");
    this.load.image("player-right-2", "/assets/player/player-right-2.png");
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
    const initPos = getCampPosition();
    this.player = this.physics.add.sprite(initPos.x, initPos.y, "player-down");
    this.player.setCollideWorldBounds(true);
    this.player.setScale(PLAYER_SCALE);
    this.player.setDepth(initPos.y);

    // 바디는 발밑에 둔다. 예전에는 스프라이트 한가운데(offset 27,27)에 있어서,
    // 벽 앞에 서면 발이 화단·좌판 안으로 80px 씩 파고들어 있었다.
    // texture 좌표 → 월드 = ×PLAYER_SCALE. 64×64 스프라이트의 아래쪽에 맞춘다.
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
    keyboard.on("keydown-E", safeHandler(this, () => {
      const px = this.player.x,
        py = this.player.y;
      const nearestNpc = this.getNearestNpc(px, py);
      const dNearestNpc = nearestNpc
        ? Phaser.Math.Distance.Between(px, py, nearestNpc.x, nearestNpc.y)
        : Infinity;
      const dTower = Phaser.Math.Distance.Between(
        px,
        py,
        TOWER_X,
        TOWER_Y + 100,
      );
      const dForest = Phaser.Math.Distance.Between(px, py, FOREST_X, FOREST_Y);
      const dHouse = Phaser.Math.Distance.Between(
        px,
        py,
        HOUSE_X,
        HOUSE_DOOR_Y,
      );

      // 탑 판정과 NPC 상호작용 범위가 겹치는 구역에서는 더 가까운 쪽을 우선한다
      if (dTower < 90 && dTower <= dNearestNpc) {
        setCampPosition(TOWER_X, TOWER_Y + 120);
        gameEvents.emit(GAME_EVENT.ENTER_BATTLE, {
          from: "basecamp",
          portalId: "dungeon-entrance-1",
          isCatchZone: false,
          floor: 1,
        });
      } else if (nearestNpc) {
        this.showNpcDialogue(nearestNpc);
      } else if (dForest < 130) {
        setCampPosition(FOREST_X, FOREST_Y + 80);
        gameEvents.emit(GAME_EVENT.ENTER_FOREST);
      } else if (dHouse < 90) {
        setCampPosition(HOUSE_X, HOUSE_DOOR_Y + 60);
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

    g.lineStyle(3, DEBUG_LINE_HEX, 1);
    g.fillStyle(DEBUG_LINE_HEX, 0.12);
    for (const b of CAMP_COLLISION_BOXES) {
      g.fillRect(b.x, b.y, b.w, b.h);
      g.strokeRect(b.x, b.y, b.w, b.h);
    }
    for (const npc of this.npcSprites) {
      g.strokeRect(npc.x - NPC_BODY.w / 2, npc.y - NPC_BODY.h, NPC_BODY.w, NPC_BODY.h);
    }
  }

  /**
   * 8방향 걷기 애니메이션 등록.
   *
   * 아틀라스가 아직 없어서 지금은 아무 것도 하지 않는다. 에셋이 들어오면 preload 의
   * load.aseprite 주석을 풀고, update() 에서 setTexture 대신 play(`walk_${dir}`) 를
   * 쓰도록 한 줄만 바꾸면 된다. 절차는 docs/ASSET_HANDOFF.md 참고.
   */
  private registerPlayerAnimations() {
    if (!this.textures.exists(PLAYER_ATLAS_KEY)) return;

    this.anims.createFromAseprite(PLAYER_ATLAS_KEY);
    for (const dir of DIRS_8) {
      const key = `walk_${dir}`;
      if (this.anims.exists(key)) continue;
      this.anims.create({
        key,
        frames: this.anims.generateFrameNames(PLAYER_ATLAS_KEY, {
          prefix: `walk_${dir}_`, start: 0, end: 3, zeroPad: 2,
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
    const { storyFlags, bestFloor, materials, questStatus } = usePlayerStore.getState();
    const result = resolveNpcInteraction(npc.dialogues, storyFlags, bestFloor, materials, questStatus);
    if (!result) return;
    gameEvents.emit(GAME_EVENT.SHOW_NPC_DIALOGUE, {
      name: npc.name,
      lines: result.lines,
      portraitPath: npc.portraitPath,
      setsFlag: result.setsFlag,
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

  private updateImpl(_time: number, delta: number) {
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
    // 에셋이 4방향뿐인 지금은 getPlayerTextureKey가 가장 가까운 4방향으로 접어준다.
    if (isMoving) {
      this.facing = dirFromVector(body.velocity.x, body.velocity.y);
      this.walkTimer += delta;
      if (this.walkTimer >= 160) {
        this.walkTimer = 0;
        this.walkFrame = this.walkFrame === 1 ? 2 : 1;
      }
      this.player.setTexture(getPlayerTextureKey(this.facing, this.walkFrame));
    } else {
      this.walkTimer = 0;
      this.walkFrame = 1;
      this.player.setTexture(getPlayerTextureKey(this.facing, 0));
    }

    // ── depth: 발끝 y = depth → 건물·NPC 뒤/앞 자동 처리 ──────────────────────
    // NPC 는 원점이 (0.5, 1) 이라 발끝이 곧 depth 다. 플레이어만 스프라이트 중심을
    // 쓰면 기준이 어긋나 발이 NPC 앞에 있는데도 뒤로 그려진다.
    this.player.setDepth(this.player.y + (64 / 2) * PLAYER_SCALE);

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
    const px = this.player.x,
      py = this.player.y;
    const dTower = Phaser.Math.Distance.Between(px, py, TOWER_X, TOWER_Y + 100);
    const dForest = Phaser.Math.Distance.Between(px, py, FOREST_X, FOREST_Y);
    const dHouse = Phaser.Math.Distance.Between(px, py, HOUSE_X, HOUSE_DOOR_Y);
    const nearestNpc = this.getNearestNpc(px, py);
    const dNearestNpc = nearestNpc
      ? Phaser.Math.Distance.Between(px, py, nearestNpc.x, nearestNpc.y)
      : Infinity;
    // keydown-E 핸들러와 동일한 우선순위: 탑이 더 가깝거나 같은 거리일 때만 탑 우선
    const towerWins = dTower < 90 && dTower <= dNearestNpc;

    const ph = this.children.getByName("portalHint");
    const fh = this.children.getByName("forestHint");
    const hh = this.children.getByName("houseHint");
    const nh = this.children.getByName("npcHint");

    if (nearestNpc && !towerWins && !nh) {
      this.add
        .text(px - 46, py - 80, `E: ${nearestNpc.name}`, {
          fontSize: "24px",
          fontFamily: PIXEL_FONT,
          resolution: textResolution(),
          color: PALETTE.sand200,
          backgroundColor: withAlpha("shadow900", 0.93),
          padding: { x: 6, y: 3 },
        })
        .setName("npcHint")
        .setDepth(9999);
    } else if ((!nearestNpc || towerWins) && nh) nh.destroy();

    if (towerWins && !ph) {
      this.add
        .text(px - 46, py - 80, "E: 탑 입장", {
          fontSize: "24px",
          fontFamily: PIXEL_FONT,
          resolution: textResolution(),
          color: PALETTE.sand200,
          backgroundColor: withAlpha("shadow900", 0.93),
          padding: { x: 6, y: 3 },
        })
        .setName("portalHint")
        .setDepth(9999);
    } else if (!towerWins && ph) ph.destroy();

    if (dForest < 130 && !fh) {
      this.add
        .text(px - 46, py - 80, "E: 숲 입장", {
          fontSize: "24px",
          fontFamily: PIXEL_FONT,
          resolution: textResolution(),
          color: PALETTE.sand200,
          backgroundColor: withAlpha("shadow900", 0.93),
          padding: { x: 6, y: 3 },
        })
        .setName("forestHint")
        .setDepth(9999);
    } else if (dForest >= 160 && fh) fh.destroy();

    if (dHouse < 90 && !hh) {
      this.add
        .text(px - 46, py - 80, "E: 집 입장", {
          fontSize: "24px",
          fontFamily: PIXEL_FONT,
          resolution: textResolution(),
          color: PALETTE.sand200,
          backgroundColor: withAlpha("shadow900", 0.93),
          padding: { x: 6, y: 3 },
        })
        .setName("houseHint")
        .setDepth(9999);
    } else if (dHouse >= 120 && hh) hh.destroy();
  }
}
