import Phaser from "phaser";
import { gameEvents, GAME_EVENT } from "../events";
import { getCampPosition, setCampPosition } from "../campPositionStore";

// ─── 맵 좌표 (basecamp-bg.png 1536×2730 기준) ─────────────────────────────────
const FOREST_X = 1500, FOREST_Y = 1900;
const HOUSE_X  = 794,  HOUSE_Y  = 1080;
const HOUSE_DOOR_Y = HOUSE_Y + 135;
const TOWER_X  = 278,  TOWER_Y  = 1010;

const CAM_ZOOM     = 0.5;
const PLAYER_SCALE = 2.5;
const WALL_THICK   = 16; // 충돌 벽 두께 (px)

export default class BaseCampScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
  };
  private wallBodies: Phaser.GameObjects.Rectangle[] = [];
  private facing: "up" | "down" | "left" | "right" = "down";
  private walkFrame: 1 | 2 = 1;
  private walkTimer = 0;

  constructor() { super("BaseCampScene"); }

  preload() {
    this.load.image("basecamp-bg", "/assets/basecamp/basecamp-bg.png");
    this.load.image("dragon",      "/assets/basecamp/dragon.png");
    this.load.image("player-up",      "/assets/basecamp/player-up.png");
    this.load.image("player-up-1",    "/assets/basecamp/player-up-1.png");
    this.load.image("player-up-2",    "/assets/basecamp/player-up-2.png");
    this.load.image("player-down",    "/assets/basecamp/player-down.png");
    this.load.image("player-down-1",  "/assets/basecamp/player-down-1.png");
    this.load.image("player-down-2",  "/assets/basecamp/player-down-2.png");
    this.load.image("player-left",    "/assets/basecamp/player-left.png");
    this.load.image("player-left-1",  "/assets/basecamp/player-left-1.png");
    this.load.image("player-left-2",  "/assets/basecamp/player-left-2.png");
    this.load.image("player-right",   "/assets/basecamp/player-right.png");
    this.load.image("player-right-1", "/assets/basecamp/player-right-1.png");
    this.load.image("player-right-2", "/assets/basecamp/player-right-2.png");
  }

  create() {
    const mapW = 1536, mapH = 2730;
    this.cameras.main.setBounds(0, 0, mapW, mapH);
    this.cameras.main.setZoom(CAM_ZOOM);
    this.physics.world.setBounds(0, 0, mapW, mapH);

    // ── 배경 / 드래곤 배너 ────────────────────────────────────────────────────────
    this.add.image(mapW / 2, mapH / 2, "basecamp-bg").setDepth(0);
    this.add.image(HOUSE_X - 55, HOUSE_Y - 80, "dragon")
      .setScale(0.088).setDepth(HOUSE_Y - 80);

    // ─────────────────────────────────────────────────────────────────────────────
    // 충돌 벽 생성 헬퍼
    // ─────────────────────────────────────────────────────────────────────────────
    const seg = (x1: number, y1: number, x2: number, y2: number, t = WALL_THICK) => {
      const dx = x2 - x1, dy = y2 - y1;
      const isH = Math.abs(dy) <= 2;
      const isV = Math.abs(dx) <= 2;
      const add = (x: number, y: number, w: number, h: number) => {
        const r = this.add.rectangle(x, y, w, h, 0x000000, 0);
        this.physics.add.existing(r, true);
        this.wallBodies.push(r);
      };
      if (isH) {
        add((x1 + x2) / 2, (y1 + y2) / 2, Math.abs(dx), t);
      } else if (isV) {
        add((x1 + x2) / 2, (y1 + y2) / 2, t, Math.abs(dy));
      } else {
        // 대각선: 일정 간격 소형 박스로 근사
        const len = Math.sqrt(dx * dx + dy * dy);
        const steps = Math.ceil(len / t);
        for (let i = 0; i <= steps; i++) {
          const f = i / steps;
          add(x1 + dx * f, y1 + dy * f, t, t);
        }
      }
    };

    // ─────────────────────────────────────────────────────────────────────────────
    // ① 유저 지정 좌표 세그먼트 (내벽/길 경계)
    // ─────────────────────────────────────────────────────────────────────────────
    seg(204,992,  397,992);
    seg(397,992,  347,1170);
    seg(347,1170, 488,1170);
    seg(488,1170, 488,1205);
    seg(488,1205, 684,1205);
    seg(684,1205, 684,1245);
    seg(684,1245, 733,1245);
    seg(733,1245, 733,1117);
    seg(733,1117, 843,1117);
    seg(843,1117, 843,1242);
    seg(843,1242, 875,1242);
    seg(875,1242, 940,1267);
    seg(940,1267,  1020,1321);
    seg(1020,1321, 1009,1355);
    seg(1009,1355,  894,1397);
    // 894→984 간격: 통로(막지 않음)
    seg(984,1397,  984,1472);
    seg(984,1472,  820,1472);
    seg(820,1472,  820,1644);
    seg(820,1644,  1050,1580);
    seg(1050,1580,  878,1715);
    seg(878,1718,   946,1718);
    seg(946,1718,   946,1756);
    seg(946,1718,  1017,1758);

    // ─────────────────────────────────────────────────────────────────────────────
    // ② 이미지 분석 기반 추가 경계 (건물 외벽 / 나무 구역)
    // ─────────────────────────────────────────────────────────────────────────────

    // ── 상단 통로 왼쪽 벽 (빨간지붕 건물 오른쪽 면 → 유저 시작점 연결) ──────────
    seg(204,992,  204,820);
    seg(204,820,  340,680);
    seg(340,680,  480,520);
    seg(480,520,  580,320);
    seg(580,320,  630,120);
    seg(630,120,  630,0);

    // ── 상단 통로 오른쪽 벽 (시계탑 건물 왼쪽 면) ────────────────────────────────
    seg(940,992,  940,820);
    seg(940,820,  990,600);
    seg(990,600,  970,340);
    seg(970,340,  920,120);
    seg(920,120,  920,0);

    // ── 상단 통로에서 유저 우측 시작점까지 연결 ─────────────────────────────────
    // (397,992) 기준 오른편은 집 구역 → 집 위쪽도 막힘
    seg(397,992,  940,992);  // 집 윗쪽 수평 경계

    // ── 맵 왼쪽 경계 (빨간지붕 건물 외벽 + 왼쪽 나무) ────────────────────────────
    seg(0,0,   0,2730);   // 맵 왼쪽 엣지
    seg(0,0,   630,0);    // 맵 상단 왼쪽 (통로 왼쪽까지)
    seg(920,0, 1536,0);   // 맵 상단 오른쪽
    seg(1536,0, 1536,2730); // 맵 오른쪽 엣지

    // ── 시계탑 건물 오른쪽/아래 구역 ────────────────────────────────────────────
    seg(940,992, 1020,1100);
    seg(1020,1100, 1100,1200);
    seg(1100,1200, 1150,1350);
    seg(1150,1350, 1100,1500);
    seg(1100,1500, 1050,1580);  // 유저 세그먼트에 연결

    // ── 원형 광장 아래 → 숲 방향 통로 경계 ──────────────────────────────────────
    // 유저 세그먼트 끝점 (1017,1758) 이후 → 숲 입구(1500,1900) 방향
    seg(1017,1758, 1080,1800);
    seg(1080,1800, 1200,1840);
    seg(1200,1840, 1380,1870);
    seg(1380,1870, 1450,1910);  // 숲 왼쪽 경계

    // 숲 오른쪽 경계 (오른쪽 벚꽃나무 외곽)
    seg(1536,1700, 1536,2200);
    seg(1380,1870, 1400,2050);
    seg(1400,2050, 1450,2200);

    // ── 하단 통로 아래 / 맵 하단 구역 막힘 ──────────────────────────────────────
    seg(820,1644, 700,1720);
    seg(700,1720, 620,1800);
    seg(620,1800, 580,1950);
    seg(580,1950, 560,2100);

    // 맵 하단 경계
    seg(0,2730, 1536,2730);

    // ─────────────────────────────────────────────────────────────────────────────
    // 플레이어
    // ─────────────────────────────────────────────────────────────────────────────
    const initPos = getCampPosition();
    this.player = this.physics.add.sprite(initPos.x, initPos.y, "player-down");
    this.player.setCollideWorldBounds(true);
    this.player.setScale(PLAYER_SCALE);
    this.player.setDepth(initPos.y);

    this.wallBodies.forEach(w => this.physics.add.collider(this.player, w));

    // ── 카메라 ──────────────────────────────────────────────────────────────────
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);

    // ── 키보드 ──────────────────────────────────────────────────────────────────
    const keyboard = this.input.keyboard!;
    this.cursors = keyboard.createCursorKeys();
    this.wasd = keyboard.addKeys("W,A,S,D") as {
      W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key;
      S: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key;
    };

    // ── E 키 ────────────────────────────────────────────────────────────────────
    keyboard.on("keydown-E", () => {
      const px = this.player.x, py = this.player.y;
      const dTower  = Phaser.Math.Distance.Between(px, py, TOWER_X, TOWER_Y + 100);
      const dForest = Phaser.Math.Distance.Between(px, py, FOREST_X, FOREST_Y);
      const dHouse  = Phaser.Math.Distance.Between(px, py, HOUSE_X, HOUSE_DOOR_Y);

      if (dTower < 90) {
        setCampPosition(TOWER_X, TOWER_Y + 120);
        gameEvents.emit(GAME_EVENT.ENTER_BATTLE, {
          from: "basecamp", portalId: "dungeon-entrance-1",
          isCatchZone: false, floor: 1,
        });
      } else if (dForest < 130) {
        setCampPosition(FOREST_X, FOREST_Y + 80);
        gameEvents.emit(GAME_EVENT.ENTER_FOREST);
      } else if (dHouse < 90) {
        setCampPosition(HOUSE_X, HOUSE_DOOR_Y + 60);
        gameEvents.emit(GAME_EVENT.ENTER_HOUSING);
      }
    });

    keyboard.on("keydown-P", () => gameEvents.emit("open-dex"));
  }

  update(_time: number, delta: number) {
    if (!this.player || !this.cursors || !this.wasd) return;

    const speed = 220;
    const body  = this.player.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0);

    const left  = this.cursors.left.isDown  || this.wasd.A.isDown;
    const right = this.cursors.right.isDown || this.wasd.D.isDown;
    const up    = this.cursors.up.isDown    || this.wasd.W.isDown;
    const down  = this.cursors.down.isDown  || this.wasd.S.isDown;
    const isMoving = left || right || up || down;

    if (left)       { body.setVelocityX(-speed); this.facing = "left"; }
    else if (right) { body.setVelocityX(speed);  this.facing = "right"; }
    if (up)         { body.setVelocityY(-speed); this.facing = "up"; }
    else if (down)  { body.setVelocityY(speed);  this.facing = "down"; }
    body.velocity.normalize().scale(speed);

    if (isMoving) {
      this.walkTimer += delta;
      if (this.walkTimer >= 160) {
        this.walkTimer = 0;
        this.walkFrame = this.walkFrame === 1 ? 2 : 1;
      }
      this.player.setTexture(`player-${this.facing}-${this.walkFrame}`);
    } else {
      this.walkTimer = 0;
      this.walkFrame = 1;
      this.player.setTexture(`player-${this.facing}`);
    }

    // ── depth: 플레이어 y = depth → 건물 뒤/앞 자동 처리 ──────────────────────
    this.player.setDepth(this.player.y);

    // ── 근접 힌트 ────────────────────────────────────────────────────────────────
    const px = this.player.x, py = this.player.y;
    const dTower  = Phaser.Math.Distance.Between(px, py, TOWER_X, TOWER_Y + 100);
    const dForest = Phaser.Math.Distance.Between(px, py, FOREST_X, FOREST_Y);
    const dHouse  = Phaser.Math.Distance.Between(px, py, HOUSE_X, HOUSE_DOOR_Y);

    const ph = this.children.getByName("portalHint");
    const fh = this.children.getByName("forestHint");
    const hh = this.children.getByName("houseHint");

    if (dTower < 90 && !ph) {
      this.add.text(px - 46, py - 80, "E: 탑 입장", {
        fontSize: "26px", color: "#aad4f5",
        backgroundColor: "#000000aa", padding: { x: 6, y: 3 },
      }).setName("portalHint").setDepth(9999);
    } else if (dTower >= 120 && ph) ph.destroy();

    if (dForest < 130 && !fh) {
      this.add.text(px - 46, py - 80, "E: 숲 입장", {
        fontSize: "26px", color: "#88ee44",
        backgroundColor: "#000000aa", padding: { x: 6, y: 3 },
      }).setName("forestHint").setDepth(9999);
    } else if (dForest >= 160 && fh) fh.destroy();

    if (dHouse < 90 && !hh) {
      this.add.text(px - 46, py - 80, "E: 집 입장", {
        fontSize: "26px", color: "#ffe4b5",
        backgroundColor: "#000000aa", padding: { x: 6, y: 3 },
      }).setName("houseHint").setDepth(9999);
    } else if (dHouse >= 120 && hh) hh.destroy();
  }
}
