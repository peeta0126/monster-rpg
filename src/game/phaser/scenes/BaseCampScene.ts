import Phaser from "phaser";
import { gameEvents, GAME_EVENT } from "../events";

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
    this.load.image("player-up", "/assets/basecamp/player-up.png");
    this.load.image("player-up-1", "/assets/basecamp/player-up-1.png");
    this.load.image("player-up-2", "/assets/basecamp/player-up-2.png");

    this.load.image("player-down", "/assets/basecamp/player-down.png");
    this.load.image("player-down-1", "/assets/basecamp/player-down-1.png");
    this.load.image("player-down-2", "/assets/basecamp/player-down-2.png");

    this.load.image("player-left", "/assets/basecamp/player-left.png");
    this.load.image("player-left-1", "/assets/basecamp/player-left-1.png");
    this.load.image("player-left-2", "/assets/basecamp/player-left-2.png");

    this.load.image("player-right", "/assets/basecamp/player-right.png");
    this.load.image("player-right-1", "/assets/basecamp/player-right-1.png");
    this.load.image("player-right-2", "/assets/basecamp/player-right-2.png");

    // 나중에 실제 이미지 넣으면 주석 해제
    // this.load.image("house", "/assets/basecamp/house.png");
    // this.load.image("tree", "/assets/basecamp/tree.png");
    // this.load.image("portal", "/assets/basecamp/portal.png");
    // this.load.image("ground", "/assets/basecamp/ground.png");
  }

  create() {
    const mapWidth = 1600;
    const mapHeight = 1200;

    this.cameras.main.setBounds(0, 0, mapWidth, mapHeight);
    this.physics.world.setBounds(0, 0, mapWidth, mapHeight);
    this.cameras.main.setBackgroundColor("#87b567");

    // 배경
    this.add.rectangle(
      mapWidth / 2,
      mapHeight / 2,
      mapWidth,
      mapHeight,
      0x87b567,
    );

    // 임시 장애물
    const house = this.add.rectangle(500, 300, 180, 140, 0x8b5a2b);
    const tree = this.add.rectangle(800, 500, 80, 80, 0x2e7d32);
    const pond = this.add.rectangle(1000, 650, 140, 100, 0x4aa3d8);

    // 임시 포탈 표시
    this.add.rectangle(1100, 250, 90, 90, 0x5dade2);

    // 플레이어
    this.player = this.physics.add.sprite(200, 200, "player-down");
    this.player.setCollideWorldBounds(true);
    this.player.setScale(2);

    // 물리 충돌
    this.physics.add.existing(house, true);
    this.physics.add.existing(tree, true);
    this.physics.add.existing(pond, true);

    this.physics.add.collider(this.player, house);
    this.physics.add.collider(this.player, tree);
    this.physics.add.collider(this.player, pond);

    // 카메라
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);

    // 키보드
    const keyboard = this.input.keyboard;
    if (!keyboard) return;

    this.cursors = keyboard.createCursorKeys();
    this.wasd = keyboard.addKeys("W,A,S,D") as {
      W: Phaser.Input.Keyboard.Key;
      A: Phaser.Input.Keyboard.Key;
      S: Phaser.Input.Keyboard.Key;
      D: Phaser.Input.Keyboard.Key;
    };

    // ── 탑 포탈 ──
    const PORTAL_X = 1100, PORTAL_Y = 250;
    this.add.rectangle(PORTAL_X, PORTAL_Y, 90, 90, 0x5dade2).setDepth(1);
    this.add.text(PORTAL_X, PORTAL_Y - 56, "무한의 탑", {
      fontSize: "13px", color: "#aad4f5", backgroundColor: "#05101a",
      padding: { x: 6, y: 3 },
    }).setOrigin(0.5, 0.5).setDepth(2);

    const portalZone = this.add.zone(PORTAL_X, PORTAL_Y, 100, 100);
    this.physics.add.existing(portalZone, true);

    this.physics.add.overlap(this.player, portalZone, () => {
      if (!this.children.getByName("portalHint")) {
        this.add.text(this.player.x - 40, this.player.y - 52, "E: 탑 입장", {
          fontSize: "14px", color: "#ffffff",
          backgroundColor: "#000000aa", padding: { x: 6, y: 3 },
        }).setName("portalHint").setDepth(10);
      }
    });

    // ── 포획 가능 구역 (풀숲) ──
    const CZ_X = 350, CZ_Y = 850;
    this.add.rectangle(CZ_X, CZ_Y, 240, 160, 0x2e7d32, 0.55).setDepth(1);
    // 테두리
    const catchBorder = this.add.graphics().setDepth(2);
    catchBorder.lineStyle(2, 0x55cc55, 0.8);
    catchBorder.strokeRect(CZ_X - 120, CZ_Y - 80, 240, 160);
    this.add.text(CZ_X, CZ_Y - 70, "🌿 풀숲 포획 구역", {
      fontSize: "13px", color: "#aaffaa", backgroundColor: "#0a1a0a",
      padding: { x: 6, y: 3 },
    }).setOrigin(0.5, 0.5).setDepth(3);
    this.add.text(CZ_X, CZ_Y - 50, "출현: 플레미  아쿠비  리피", {
      fontSize: "11px", color: "#88ee88",
    }).setOrigin(0.5, 0.5).setDepth(3);

    // 풀숲 장식 (작은 풀 삼각형들)
    for (let i = 0; i < 12; i++) {
      const gx = CZ_X - 100 + Math.random() * 200;
      const gy = CZ_Y - 60 + Math.random() * 120;
      const g = this.add.graphics().setDepth(2);
      g.fillStyle(0x4caf50, 0.6);
      g.fillTriangle(gx, gy + 10, gx - 5, gy + 10, gx, gy);
      g.fillTriangle(gx + 4, gy + 10, gx + 9, gy + 10, gx + 4, gy);
    }

    const catchZone = this.add.zone(CZ_X, CZ_Y, 240, 160);
    this.physics.add.existing(catchZone, true);

    this.physics.add.overlap(this.player, catchZone, () => {
      if (!this.children.getByName("catchHint")) {
        this.add.text(this.player.x - 55, this.player.y - 52, "E: 포획 전투 시작", {
          fontSize: "13px", color: "#aaffaa",
          backgroundColor: "#000000aa", padding: { x: 6, y: 3 },
        }).setName("catchHint").setDepth(10);
      }
    });

    // ── 숲 입구 ──
    const FOREST_X = 300, FOREST_Y = 200;
    // 나무 그룹으로 표현
    this.add.rectangle(FOREST_X, FOREST_Y, 160, 130, 0x1a4a0a, 0.75).setDepth(1);
    const forestBorder = this.add.graphics().setDepth(2);
    forestBorder.lineStyle(2, 0x44aa22, 0.8);
    forestBorder.strokeRect(FOREST_X - 80, FOREST_Y - 65, 160, 130);
    this.add.text(FOREST_X, FOREST_Y - 55, "🌲 숲", {
      fontSize: "14px", color: "#88ee44", backgroundColor: "#051005",
      padding: { x: 7, y: 3 },
    }).setOrigin(0.5, 0.5).setDepth(3);
    this.add.text(FOREST_X, FOREST_Y - 33, "탐험 · 포획", {
      fontSize: "11px", color: "#66cc33",
    }).setOrigin(0.5, 0.5).setDepth(3);

    // 나무 장식
    for (let i = 0; i < 6; i++) {
      const tx = FOREST_X - 55 + i * 22;
      const ty = FOREST_Y + 10 + Math.sin(i) * 12;
      const g = this.add.graphics().setDepth(2);
      g.fillStyle(0x2e7d32, 0.7);
      g.fillTriangle(tx, ty - 18, tx - 9, ty + 4, tx + 9, ty + 4);
    }

    const forestZone = this.add.zone(FOREST_X, FOREST_Y, 160, 130);
    this.physics.add.existing(forestZone, true);

    this.physics.add.overlap(this.player, forestZone, () => {
      if (!this.children.getByName("forestHint")) {
        this.add.text(this.player.x - 45, this.player.y - 52, "E: 숲 입장", {
          fontSize: "13px", color: "#88ee44",
          backgroundColor: "#000000aa", padding: { x: 6, y: 3 },
        }).setName("forestHint").setDepth(10);
      }
    });

    // ── 농장/파티 관리 구역 ──
    const FARM_X = 700, FARM_Y = 900;
    this.add.rectangle(FARM_X, FARM_Y, 180, 130, 0x6d4c41, 0.7).setDepth(1);
    const farmBorder = this.add.graphics().setDepth(2);
    farmBorder.lineStyle(2, 0xd7a86e, 0.8);
    farmBorder.strokeRect(FARM_X - 90, FARM_Y - 65, 180, 130);
    this.add.text(FARM_X, FARM_Y - 55, "🏠 농장", {
      fontSize: "13px", color: "#e8c99a", backgroundColor: "#1a0a00",
      padding: { x: 6, y: 3 },
    }).setOrigin(0.5, 0.5).setDepth(3);
    this.add.text(FARM_X, FARM_Y - 35, "파티 · 보관함 관리", {
      fontSize: "11px", color: "#c8a870",
    }).setOrigin(0.5, 0.5).setDepth(3);

    const farmZone = this.add.zone(FARM_X, FARM_Y, 180, 130);
    this.physics.add.existing(farmZone, true);

    this.physics.add.overlap(this.player, farmZone, () => {
      if (!this.children.getByName("farmHint")) {
        this.add.text(this.player.x - 50, this.player.y - 52, "F: 내 몬스터", {
          fontSize: "13px", color: "#e8c99a",
          backgroundColor: "#000000aa", padding: { x: 6, y: 3 },
        }).setName("farmHint").setDepth(10);
      }
    });

    // E 키: 포탈 / 포획 구역 / 숲
    keyboard.on("keydown-E", () => {
      const distPortal = Phaser.Math.Distance.Between(this.player.x, this.player.y, PORTAL_X, PORTAL_Y);
      const distCatch  = Phaser.Math.Distance.Between(this.player.x, this.player.y, CZ_X, CZ_Y);
      const distForest = Phaser.Math.Distance.Between(this.player.x, this.player.y, FOREST_X, FOREST_Y);

      if (distPortal < 80) {
        gameEvents.emit(GAME_EVENT.ENTER_BATTLE, {
          from: "basecamp",
          portalId: "dungeon-entrance-1",
          isCatchZone: false,
          floor: 1,
        });
      } else if (distCatch < 120) {
        gameEvents.emit(GAME_EVENT.ENTER_BATTLE, {
          from: "basecamp",
          portalId: "catch-zone",
          isCatchZone: true,
          floor: 1,
        });
      } else if (distForest < 100) {
        gameEvents.emit(GAME_EVENT.ENTER_FOREST);
      }
    });

    // F 키: 농장 페이지
    keyboard.on("keydown-F", () => {
      const distFarm = Phaser.Math.Distance.Between(this.player.x, this.player.y, FARM_X, FARM_Y);
      if (distFarm < 120) {
        gameEvents.emit(GAME_EVENT.ENTER_FARM);
      }
    });

    // Phaser가 포커스를 가져가므로 P 키는 gameEvents로 전달
    keyboard.on("keydown-P", () => {
      gameEvents.emit("open-dex");
    });

    // 힌트 텍스트 정리 (겹침 방지)
    this.physics.world.on("overlap", () => {
      const ph  = this.children.getByName("portalHint");
      const ch  = this.children.getByName("catchHint");
      const fh  = this.children.getByName("farmHint");
      const frh = this.children.getByName("forestHint");
      const distPortal = Phaser.Math.Distance.Between(this.player.x, this.player.y, PORTAL_X, PORTAL_Y);
      const distCatch  = Phaser.Math.Distance.Between(this.player.x, this.player.y, CZ_X, CZ_Y);
      const distFarm   = Phaser.Math.Distance.Between(this.player.x, this.player.y, FARM_X, FARM_Y);
      const distForest = Phaser.Math.Distance.Between(this.player.x, this.player.y, FOREST_X, FOREST_Y);
      if (ph  && distPortal >= 120) { ph.destroy(); }
      if (ch  && distCatch  >= 160) { ch.destroy(); }
      if (fh  && distFarm   >= 140) { fh.destroy(); }
      if (frh && distForest >= 130) { frh.destroy(); }
    });
  }

  update(_time: number, delta: number) {
    if (!this.player || !this.cursors || !this.wasd) return;

    const speed = 180;
    const body = this.player.body as Phaser.Physics.Arcade.Body;

    body.setVelocity(0);

    const left = this.cursors.left.isDown || this.wasd.A.isDown;
    const right = this.cursors.right.isDown || this.wasd.D.isDown;
    const up = this.cursors.up.isDown || this.wasd.W.isDown;
    const down = this.cursors.down.isDown || this.wasd.S.isDown;

    const isMoving = left || right || up || down;

    if (left) {
      body.setVelocityX(-speed);
      this.facing = "left";
    } else if (right) {
      body.setVelocityX(speed);
      this.facing = "right";
    }

    if (up) {
      body.setVelocityY(-speed);
      this.facing = "up";
    } else if (down) {
      body.setVelocityY(speed);
      this.facing = "down";
    }

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

    const oldHint = this.children.getByName("portalHint");
    if (oldHint) {
      const distance = Phaser.Math.Distance.Between(
        this.player.x,
        this.player.y,
        1100,
        250,
      );

      if (distance > 80) {
        oldHint.destroy();
      }
    }
  }
}