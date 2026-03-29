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

    // 포탈 범위
    const portalZone = this.add.zone(1100, 250, 100, 100);
    this.physics.add.existing(portalZone, true);

    this.physics.add.overlap(this.player, portalZone, () => {
      if (!this.children.getByName("portalHint")) {
        this.add
          .text(this.player.x - 35, this.player.y - 50, "E: Enter", {
            fontSize: "16px",
            color: "#ffffff",
            backgroundColor: "#000000",
            padding: { x: 6, y: 4 },
          })
          .setName("portalHint")
          .setDepth(10);
      }
    });

    keyboard.on("keydown-E", () => {
      const distance = Phaser.Math.Distance.Between(
        this.player.x,
        this.player.y,
        1100,
        250,
      );

      if (distance < 80) {
        gameEvents.emit(GAME_EVENT.ENTER_BATTLE, {
          from: "basecamp",
          portalId: "dungeon-entrance-1",
        });
      }
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