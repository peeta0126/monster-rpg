import Phaser from "phaser";
import { gameEvents, GAME_EVENT } from "../shared/phaser/events";
import { reportSceneError, safeHandler } from "../shared/phaser/sceneErrorHandler";
import { markSceneReady } from "../shared/phaser/sceneReady";
import { PIXEL_FONT, textResolution, redrawTextOnFontLoad } from "../shared/phaser/text";
import { getCampPosition, setCampPosition } from "./campPositionStore";
import { PALETTE, withAlpha } from "../shared/palette";
import {
  dirFromVector, getPlayerTextureKey, DIRS_8, PLAYER_ATLAS_KEY, type Dir8,
} from "../shared/playerSprite";
import { usePlayerStore } from "../shared/playerStore";
import { ORION_DIALOGUES, BAROS_DIALOGUES, resolveNpcInteraction } from "./campDialogues";
import type { DialogueEntry } from "./campDialogues";

// ─── 맵 좌표 (basecamp-bg.png 1536×2730 기준) ─────────────────────────────────
const FOREST_X = 1500,
  FOREST_Y = 1900;
const HOUSE_X = 794,
  HOUSE_Y = 1080;
const HOUSE_DOOR_Y = HOUSE_Y + 135;
const TOWER_X = 278,
  TOWER_Y = 1010;

const CAM_ZOOM = 0.5;
const PLAYER_SCALE = 2.5;
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
    portraitPath: "/assets/player/Baros_portrait.png",
    x: 430,
    y: 1200,
    dialogues: BAROS_DIALOGUES,
  },
  {
    id: "orion",
    name: "Orion",
    spriteTexture: "Orion",
    portraitPath: "/assets/player/Orion_portrait.png",
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

  constructor() {
    super("BaseCampScene");
  }

  preload() {
    // 8방향 아틀라스가 들어오면 아래 player-* 개별 PNG 목록을 지우고 이 줄을 켠다.
    // playerSprite.ts 의 ASSET_MODE 를 "atlas" 로 바꾸는 것과 한 세트다.
    // this.load.aseprite(PLAYER_ATLAS_KEY, PLAYER_ATLAS_PNG, PLAYER_ATLAS_JSON);
    this.load.image("basecamp-bg", "/assets/basecamp/basecamp-bg.png");
    this.load.image("basecamp-bg-1", "/assets/basecamp/basecamp-bg-1.png");
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
    const mapW = 1536,
      mapH = 2730;
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

    // 플레이어 바디를 10×10 (texture 좌표) 으로 고정 → game 좌표 25×25
    // 64×64 스프라이트 중앙에 위치: offset = (64-10)/2 = 27
    (this.player.body as Phaser.Physics.Arcade.Body).setSize(10, 10);
    (this.player.body as Phaser.Physics.Arcade.Body).setOffset(27, 27);

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
    //-------충돌 관리 선------------
    const wallBodies: Phaser.GameObjects.Rectangle[] = [];

    const addStaticRect = (x: number, y: number, w: number, h: number) => {
      // alpha 0 — 화면에 그려지지 않는 충돌 판정용 사각형이라 색은 의미가 없다(팔레트 대상 아님)
      const r = this.add.rectangle(x, y, w, h, 0x000000, 0);
      this.physics.add.existing(r, true);
      wallBodies.push(r);

      const debug = false;
      if (debug) {
        const g = this.add.graphics().setDepth(9999);
        // 개발용 판정 박스. 일부러 팔레트에 없는 형광색을 써서 실수로 켠 채 두면 바로 보이게 한다
        g.lineStyle(2, 0x00ff88, 1);
        g.strokeRect(x - w / 2, y - h / 2, w, h);
      }

      this.physics.add.collider(this.player, r);
      return r;
    };

    const seg = (x1: number, y1: number, x2: number, y2: number, t = 16) => {
      const dx = x2 - x1;
      const dy = y2 - y1;

      const isH = Math.abs(dy) <= 2;
      const isV = Math.abs(dx) <= 2;

      if (isH) {
        addStaticRect((x1 + x2) / 2, (y1 + y2) / 2, Math.abs(dx), t);
      } else if (isV) {
        addStaticRect((x1 + x2) / 2, (y1 + y2) / 2, t, Math.abs(dy));
      } else {
        const len = Math.sqrt(dx * dx + dy * dy);
        const steps = Math.ceil(len / t);

        for (let i = 0; i <= steps; i++) {
          const f = i / steps;
          addStaticRect(x1 + dx * f, y1 + dy * f, t, t);
        }
      }
    };

    seg(380, 900, 170, 900);
    seg(380, 900, 380, 1200);
    seg(380, 1200, 690, 1200);
    seg(900, 1200, 1000, 1200);
    seg(1000, 1200, 1000, 1480);
    seg(830, 1480, 1000, 1480);
    seg(1030, 1800, 830, 1480, 5);
    seg(1530, 1800, 1030, 1800);
    seg(890, 2430, 1530, 2430);
    seg(890, 2430, 890, 2900);
    seg(100, 1850, 580, 1850);
    seg(100, 1850, 100, 1960);
    seg(540, 1960, 100, 1960);
    seg(540, 2290, 540, 1960);
    seg(660, 2290, 540, 2290);
    seg(580, 1400, 580, 1850);
    seg(170, 1400, 580, 1400);
    seg(170, 920, 170, 1400);
    seg(170, 1400, 580, 1400);
    seg(700, 1100, 700, 1200);
    seg(880, 1100, 880, 1200);
    seg(700, 1100, 880, 1100);
    seg(660, 2300, 660, 2900);

    //좌표 확인용

    this.registerPlayerAnimations();
    redrawTextOnFontLoad(this);
    markSceneReady(this);
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

    // ── depth: 플레이어 y = depth → 건물 뒤/앞 자동 처리 ──────────────────────
    this.player.setDepth(this.player.y);

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
