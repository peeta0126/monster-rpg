import Phaser from "phaser";
import { gameEvents, GAME_EVENT } from "../events";
import { getCampPosition, setCampPosition } from "../campPositionStore";

// ─── 맵 구성 위치 ──────────────────────────────────────────────────────────────
// 레이아웃: 숲(왼쪽) ── 집(중앙) ── 무한의 탑(오른쪽)
const FOREST_X = 230,  FOREST_Y = 600;
const HOUSE_X  = 780,  HOUSE_Y  = 540;
const HOUSE_DOOR_Y = HOUSE_Y + 120;   // 집 문 Y 위치
const TOWER_X  = 1340, TOWER_Y  = 440;

export default class BaseCampScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
  };

  private facing: "up" | "down" | "left" | "right" = "down";
  private walkFrame: 1 | 2 = 1;
  private walkTimer = 0;

  constructor() {
    super("BaseCampScene");
  }

  preload() {
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
    const mapW = 1600, mapH = 1200;
    this.cameras.main.setBounds(0, 0, mapW, mapH);
    this.physics.world.setBounds(0, 0, mapW, mapH);

    const g = this.add.graphics();

    // ── 기본 잔디 배경 ──────────────────────────────────────────────────────────
    g.fillStyle(0x78a84a);
    g.fillRect(0, 0, mapW, mapH);

    // 잔디 질감 (랜덤 짧은 선)
    g.lineStyle(1, 0x5a8a35, 0.25);
    for (let i = 0; i < 400; i++) {
      const rx = Math.random() * mapW;
      const ry = Math.random() * mapH;
      g.lineBetween(rx, ry, rx + 4, ry - 5);
    }

    // ── 흙길 (숲 → 집 → 탑 연결) ──────────────────────────────────────────────
    // 메인 수평 경로
    g.fillStyle(0xc4a265, 0.8);
    g.fillRect(80, HOUSE_DOOR_Y - 60, 1500, 120); // 넓은 흙길

    // 경로 테두리
    g.lineStyle(2, 0xa0824a, 0.4);
    g.lineBetween(80, HOUSE_DOOR_Y - 60, 1520, HOUSE_DOOR_Y - 60);
    g.lineBetween(80, HOUSE_DOOR_Y + 60, 1520, HOUSE_DOOR_Y + 60);

    // 집 진입로 (문 앞 수직 경로)
    g.fillStyle(0xc4a265, 0.7);
    g.fillRect(HOUSE_X - 50, HOUSE_DOOR_Y - 200, 100, 200);

    // 탑 진입로
    g.fillStyle(0xb8956e, 0.6);
    g.fillRect(TOWER_X - 45, TOWER_Y + 80, 90, 180);

    // ── 장식 돌 & 꽃 ──────────────────────────────────────────────────────────
    // 경로 양옆 돌
    const stonePos = [
      [150, HOUSE_DOOR_Y - 80], [350, HOUSE_DOOR_Y + 80],
      [550, HOUSE_DOOR_Y - 70], [900, HOUSE_DOOR_Y + 85],
      [1050, HOUSE_DOOR_Y - 75], [1200, HOUSE_DOOR_Y + 80],
    ];
    g.fillStyle(0x9e9e9e, 0.7);
    for (const [sx, sy] of stonePos) {
      g.fillEllipse(sx, sy, 18, 12);
    }

    // ── 숲 입구 (왼쪽) ──────────────────────────────────────────────────────────
    // 숲 바닥
    g.fillStyle(0x1b4d0a, 0.55);
    g.fillEllipse(FOREST_X, FOREST_Y, 320, 260);

    // 나무들
    const trees = [
      [FOREST_X - 80, FOREST_Y - 70], [FOREST_X + 70, FOREST_Y - 80],
      [FOREST_X - 100, FOREST_Y + 40], [FOREST_X + 90, FOREST_Y + 50],
      [FOREST_X - 20, FOREST_Y - 100], [FOREST_X + 10, FOREST_Y + 80],
      [FOREST_X - 130, FOREST_Y - 20], [FOREST_X + 130, FOREST_Y - 10],
    ];
    for (const [tx, ty] of trees) {
      // 나무 기둥
      g.fillStyle(0x6d4c1f);
      g.fillRect(tx - 6, ty + 10, 12, 28);
      // 나무 잎
      g.fillStyle(0x2e7d32, 0.85);
      g.fillTriangle(tx, ty - 28, tx - 22, ty + 14, tx + 22, ty + 14);
      g.fillStyle(0x388e3c, 0.7);
      g.fillTriangle(tx, ty - 14, tx - 18, ty + 20, tx + 18, ty + 20);
    }

    // 숲 입구 표시판
    g.fillStyle(0x6d4c1f, 0.9);
    g.fillRect(FOREST_X - 55, FOREST_Y - 130, 110, 40);
    g.lineStyle(2, 0x44aa22, 0.8);
    g.strokeRect(FOREST_X - 55, FOREST_Y - 130, 110, 40);

    this.add.text(FOREST_X, FOREST_Y - 110, "🌲 숲 탐험", {
      fontSize: "14px", color: "#88ee44",
      padding: { x: 4, y: 2 },
    }).setOrigin(0.5).setDepth(3);
    this.add.text(FOREST_X, FOREST_Y - 90, "포획 & 재료", {
      fontSize: "10px", color: "#66cc33",
    }).setOrigin(0.5).setDepth(3);

    // 숲 충돌 오브젝트 (진입 불가 나무들)
    const forestBlock = this.add.rectangle(FOREST_X - 10, FOREST_Y - 40, 260, 200, 0x000000, 0);
    this.physics.add.existing(forestBlock, true);

    // ── 집 (중앙) ────────────────────────────────────────────────────────────────
    // 집 외벽
    g.fillStyle(0xd4a96a);
    g.fillRect(HOUSE_X - 110, HOUSE_Y - 110, 220, 220);

    // 지붕
    g.fillStyle(0x8b2500);
    g.fillTriangle(
      HOUSE_X, HOUSE_Y - 170,
      HOUSE_X - 140, HOUSE_Y - 90,
      HOUSE_X + 140, HOUSE_Y - 90,
    );
    // 지붕 그림자
    g.fillStyle(0x6a1b00, 0.4);
    g.fillTriangle(
      HOUSE_X + 20, HOUSE_Y - 150,
      HOUSE_X + 140, HOUSE_Y - 90,
      HOUSE_X + 80, HOUSE_Y - 90,
    );

    // 굴뚝
    g.fillStyle(0x8b5e3c);
    g.fillRect(HOUSE_X + 55, HOUSE_Y - 180, 28, 60);
    g.fillStyle(0x555555, 0.6);
    g.fillRect(HOUSE_X + 50, HOUSE_Y - 188, 38, 14);

    // 집 창문 (두 개)
    g.fillStyle(0x87ceeb, 0.75);
    g.fillRect(HOUSE_X - 90, HOUSE_Y - 70, 50, 50);
    g.fillRect(HOUSE_X + 40, HOUSE_Y - 70, 50, 50);
    g.lineStyle(2, 0xd4a060, 0.9);
    g.strokeRect(HOUSE_X - 90, HOUSE_Y - 70, 50, 50);
    g.strokeRect(HOUSE_X + 40, HOUSE_Y - 70, 50, 50);
    // 창문 십자
    g.lineStyle(1, 0xd4a060, 0.6);
    g.lineBetween(HOUSE_X - 65, HOUSE_Y - 70, HOUSE_X - 65, HOUSE_Y - 20);
    g.lineBetween(HOUSE_X - 90, HOUSE_Y - 45, HOUSE_X - 40, HOUSE_Y - 45);
    g.lineBetween(HOUSE_X + 65, HOUSE_Y - 70, HOUSE_X + 65, HOUSE_Y - 20);
    g.lineBetween(HOUSE_X + 40, HOUSE_Y - 45, HOUSE_X + 90, HOUSE_Y - 45);

    // 집 문
    g.fillStyle(0x5a3010);
    g.fillRect(HOUSE_X - 25, HOUSE_Y + 30, 50, 80);
    g.fillStyle(0xf0c040);
    g.fillCircle(HOUSE_X + 18, HOUSE_Y + 70, 5);
    g.lineStyle(2, 0x3a1f00);
    g.strokeRect(HOUSE_X - 25, HOUSE_Y + 30, 50, 80);

    // 집 이름표
    this.add.text(HOUSE_X, HOUSE_Y - 195, "🏠 나의 집", {
      fontSize: "14px", color: "#ffe4b5",
      backgroundColor: "#2a1000cc", padding: { x: 8, y: 4 },
    }).setOrigin(0.5).setDepth(4);

    // 집 충돌 (외벽, 문 빼고)
    const houseWall = this.add.rectangle(HOUSE_X, HOUSE_Y - 30, 220, 140, 0x000000, 0);
    this.physics.add.existing(houseWall, true);

    // ── 무한의 탑 (오른쪽) ─────────────────────────────────────────────────────
    // 탑 바닥 플랫폼
    g.fillStyle(0x616161, 0.6);
    g.fillEllipse(TOWER_X, TOWER_Y + 120, 180, 60);

    // 탑 메인 몸통
    g.fillStyle(0x37474f);
    g.fillRect(TOWER_X - 50, TOWER_Y - 180, 100, 300);

    // 탑 상단 (뾰족)
    g.fillStyle(0x263238);
    g.fillTriangle(
      TOWER_X, TOWER_Y - 260,
      TOWER_X - 65, TOWER_Y - 180,
      TOWER_X + 65, TOWER_Y - 180,
    );

    // 탑 창문들 (여러 층)
    g.fillStyle(0x5dade2, 0.7);
    for (let row = 0; row < 4; row++) {
      const wy = TOWER_Y - 130 + row * 60;
      g.fillRect(TOWER_X - 14, wy, 28, 30);
      g.lineStyle(1, 0x4aa3d8, 0.5);
      g.strokeRect(TOWER_X - 14, wy, 28, 30);
    }

    // 탑 빛 이펙트
    g.fillStyle(0x5dade2, 0.08);
    g.fillEllipse(TOWER_X, TOWER_Y - 200, 100, 80);

    // 탑 이름표
    this.add.text(TOWER_X, TOWER_Y - 285, "⚔️ 무한의 탑", {
      fontSize: "13px", color: "#aad4f5",
      backgroundColor: "#05101a", padding: { x: 6, y: 3 },
    }).setOrigin(0.5).setDepth(4);

    // 탑 충돌
    const towerBlock = this.add.rectangle(TOWER_X, TOWER_Y - 60, 100, 280, 0x000000, 0);
    this.physics.add.existing(towerBlock, true);

    // ── 물리 충돌 ─────────────────────────────────────────────────────────────
    // 플레이어 (마지막 위치에서 재시작)
    const initPos = getCampPosition();
    this.player = this.physics.add.sprite(initPos.x, initPos.y, "player-down");
    this.player.setCollideWorldBounds(true);
    this.player.setScale(2);

    this.physics.add.collider(this.player, forestBlock);
    this.physics.add.collider(this.player, houseWall);
    this.physics.add.collider(this.player, towerBlock);

    // ── 카메라 ──────────────────────────────────────────────────────────────────
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);

    // ── 키보드 ──────────────────────────────────────────────────────────────────
    const keyboard = this.input.keyboard!;
    this.cursors = keyboard.createCursorKeys();
    this.wasd = keyboard.addKeys("W,A,S,D") as {
      W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key;
      S: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key;
    };

    // ── E 키: 탑 / 숲 / 집 ───────────────────────────────────────────────────
    keyboard.on("keydown-E", () => {
      const px = this.player.x, py = this.player.y;
      const distTower  = Phaser.Math.Distance.Between(px, py, TOWER_X, TOWER_Y + 100);
      const distForest = Phaser.Math.Distance.Between(px, py, FOREST_X, FOREST_Y);
      const distHouse  = Phaser.Math.Distance.Between(px, py, HOUSE_X, HOUSE_DOOR_Y);

      if (distTower < 90) {
        setCampPosition(px, py);
        gameEvents.emit(GAME_EVENT.ENTER_BATTLE, {
          from: "basecamp", portalId: "dungeon-entrance-1",
          isCatchZone: false, floor: 1,
        });
      } else if (distForest < 110) {
        setCampPosition(px, py);
        gameEvents.emit(GAME_EVENT.ENTER_FOREST);
      } else if (distHouse < 90) {
        setCampPosition(px, py);
        gameEvents.emit(GAME_EVENT.ENTER_HOUSING);
      }
    });

    keyboard.on("keydown-P", () => {
      gameEvents.emit("open-dex");
    });

    // ── 근접 힌트 텍스트 관리 ──────────────────────────────────────────────────
    this.physics.world.on("overlap", () => {
      const ph  = this.children.getByName("portalHint");
      const fh  = this.children.getByName("forestHint");
      const hh  = this.children.getByName("houseHint");
      if (!ph && !fh && !hh) return;
      const distTower  = Phaser.Math.Distance.Between(this.player.x, this.player.y, TOWER_X, TOWER_Y + 100);
      const distForest = Phaser.Math.Distance.Between(this.player.x, this.player.y, FOREST_X, FOREST_Y);
      const distHouse  = Phaser.Math.Distance.Between(this.player.x, this.player.y, HOUSE_X, HOUSE_DOOR_Y);
      if (ph && distTower  >= 120) ph.destroy();
      if (fh && distForest >= 140) fh.destroy();
      if (hh && distHouse  >= 120) hh.destroy();
    });
  }

  update(_time: number, delta: number) {
    if (!this.player || !this.cursors || !this.wasd) return;

    const speed = 180;
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

    const px = this.player.x, py = this.player.y;
    const distTower  = Phaser.Math.Distance.Between(px, py, TOWER_X, TOWER_Y + 100);
    const distForest = Phaser.Math.Distance.Between(px, py, FOREST_X, FOREST_Y);
    const distHouse  = Phaser.Math.Distance.Between(px, py, HOUSE_X, HOUSE_DOOR_Y);

    // 힌트 표시
    const ph  = this.children.getByName("portalHint");
    const fh  = this.children.getByName("forestHint");
    const hh  = this.children.getByName("houseHint");

    if (distTower < 90 && !ph) {
      this.add.text(px - 46, py - 56, "E: 탑 입장", {
        fontSize: "13px", color: "#aad4f5",
        backgroundColor: "#000000aa", padding: { x: 6, y: 3 },
      }).setName("portalHint").setDepth(10);
    } else if (distTower >= 120 && ph) ph.destroy();

    if (distForest < 110 && !fh) {
      this.add.text(px - 46, py - 56, "E: 숲 입장", {
        fontSize: "13px", color: "#88ee44",
        backgroundColor: "#000000aa", padding: { x: 6, y: 3 },
      }).setName("forestHint").setDepth(10);
    } else if (distForest >= 140 && fh) fh.destroy();

    if (distHouse < 90 && !hh) {
      this.add.text(px - 46, py - 56, "E: 집 입장", {
        fontSize: "13px", color: "#ffe4b5",
        backgroundColor: "#000000aa", padding: { x: 6, y: 3 },
      }).setName("houseHint").setDepth(10);
    } else if (distHouse >= 120 && hh) hh.destroy();
  }
}
