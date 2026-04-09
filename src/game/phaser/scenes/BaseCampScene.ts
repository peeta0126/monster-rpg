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
    // 충돌 벽 생성 헬퍼 + 검정 디버그 선 동시 그리기
    // ─────────────────────────────────────────────────────────────────────────────
    const debugG = this.add.graphics().setDepth(9998);
    debugG.lineStyle(3, 0x000000, 1.0);

    const seg = (x1: number, y1: number, x2: number, y2: number, t = WALL_THICK) => {
      const dx = x2 - x1, dy = y2 - y1;
      const isH = Math.abs(dy) <= 2;
      const isV = Math.abs(dx) <= 2;

      // 디버그 선 그리기
      debugG.beginPath();
      debugG.moveTo(x1, y1);
      debugG.lineTo(x2, y2);
      debugG.strokePath();

      const addRect = (x: number, y: number, w: number, h: number) => {
        const r = this.add.rectangle(x, y, w, h, 0x000000, 0);
        this.physics.add.existing(r, true);
        this.wallBodies.push(r);
      };
      if (isH) {
        addRect((x1 + x2) / 2, (y1 + y2) / 2, Math.abs(dx), t);
      } else if (isV) {
        addRect((x1 + x2) / 2, (y1 + y2) / 2, t, Math.abs(dy));
      } else {
        const len = Math.sqrt(dx * dx + dy * dy);
        const steps = Math.ceil(len / t);
        for (let i = 0; i <= steps; i++) {
          const f = i / steps;
          addRect(x1 + dx * f, y1 + dy * f, t, t);
        }
      }
    };

    // ─────────────────────────────────────────────────────────────────────────────
    // 유저 지정 좌표 세그먼트 (이것만 적용 / 추정 벽 없음)
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
    // 894→984 통로 (벽 없음)
    seg(984,1397,  984,1472);
    seg(984,1472,  820,1472);
    seg(820,1472,  820,1644);
    seg(820,1644,  1050,1580);
    seg(1050,1580,  878,1715);
    seg(878,1718,   946,1718);
    seg(946,1718,   946,1756);
    seg(946,1718,  1017,1758);

    // ─────────────────────────────────────────────────────────────────────────────
    // ② 이미지 분석 기반 나머지 벽
    // ─────────────────────────────────────────────────────────────────────────────

    // ── 상단 통로 왼쪽 (빨간 지붕 건물 우측면) ───────────────────────────────────
    seg(204,992,  230,870);
    seg(230,870,  310,730);
    seg(310,730,  450,600);
    seg(450,600,  530,420);
    seg(530,420,  570,220);
    seg(570,220,  600,0);

    // ── 상단 통로 오른쪽 (시계탑 건물 좌측면) ────────────────────────────────────
    seg(940,992,  960,820);
    seg(960,820,  975,620);
    seg(975,620,  960,400);
    seg(960,400,  930,200);
    seg(930,200,  910,0);

    // ── 상단 통로 상단 연결 (아치 게이트 위 맵 경계) ─────────────────────────────
    seg(0,0,   600,0);
    seg(910,0, 1536,0);

    // ── 맵 좌측 경계 ─────────────────────────────────────────────────────────────
    seg(0,0, 0,2730);

    // ── 맵 우측 경계 ─────────────────────────────────────────────────────────────
    seg(1536,0, 1536,2730);

    // ── 시계탑/마켓 구역 우측 외벽 ───────────────────────────────────────────────
    seg(940,992,  1020,1080);
    seg(1020,1080, 1080,1180);
    seg(1080,1180, 1110,1320);
    seg(1110,1320, 1080,1480);
    seg(1080,1480, 1050,1580);   // 유저 세그먼트와 연결

    // ── 유저 마지막점 이후 → 숲 방향 통로 ───────────────────────────────────────
    seg(1017,1758, 1060,1790);
    seg(1060,1790, 1180,1830);
    seg(1180,1830, 1350,1870);
    seg(1350,1870, 1460,1910);   // 숲 좌측 경계 끝

    // ── 숲 우측 경계 (벚꽃나무 외곽) ─────────────────────────────────────────────
    seg(1480,1880, 1510,2100);
    seg(1510,2100, 1480,2280);

    // ── 하단 아치 게이트 아래 (미구현 구역 차단) ─────────────────────────────────
    seg(820,1644,  700,1720);
    seg(700,1720,  630,1810);
    seg(630,1810,  600,1960);
    seg(600,1960,  620,2100);
    seg(620,2100,  700,2200);
    seg(700,2200,  850,2250);
    seg(850,2250, 1000,2220);
    seg(1000,2220, 1100,2150);
    seg(1100,2150, 1200,2100);
    seg(1200,2100, 1300,2050);
    seg(1300,2050, 1350,1970);
    seg(1350,1970, 1460,1910);   // 숲 경계와 연결

    // ── 맵 하단 ──────────────────────────────────────────────────────────────────
    seg(0,2730, 1536,2730);

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
