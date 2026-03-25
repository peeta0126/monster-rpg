import Phaser from "phaser";
import { gameEvents, GAME_EVENT } from "../events";

export default class BaseCampScene extends Phaser.Scene {
  preload() {
  this.load.image("player", "/assets/basecamp/player.png");
  //이런식으로 이미지 파일 추가해야함
  // this.load.image("house", "/assets/basecamp/house.png"); //집
  // this.load.image("tree", "/assets/basecamp/tree.png"); //나무
  // this.load.image("portal", "/assets/basecamp/portal.png");// 포탈
  // this.load.image("ground", "/assets/basecamp/ground.png");//땅?
  }

  //여기 있는 player타입도 바꾸면 좋다고 하던데 
  //private player!: Phaser.Physics.Arcade.Sprite; 이렇게
  
  private player!: Phaser.GameObjects.Rectangle;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
  };

  constructor() {
    super("BaseCampScene");
  }

  create() {
    const mapWidth = 1600;
    const mapHeight = 1200;

    this.cameras.main.setBounds(0, 0, mapWidth, mapHeight);
    this.physics.world.setBounds(0, 0, mapWidth, mapHeight);
    this.cameras.main.setBackgroundColor("#87b567");

    // 길/배경 느낌
    this.add.rectangle(mapWidth / 2, mapHeight / 2, mapWidth, mapHeight, 0x87b567);

    // 장애물
    const house = this.add.rectangle(500, 300, 180, 140, 0x8b5a2b);
    const tree = this.add.rectangle(800, 500, 80, 80, 0x2e7d32);
    const pond = this.add.rectangle(1000, 650, 140, 100, 0x4aa3d8);

    // 포탈
    this.add.rectangle(1100, 250, 90, 90, 0x5dade2);

    // 플레이어
    const player = this.physics.add.sprite(200, 200, "player");
    player.setCollideWorldBounds(true);
    player.setScale(2);

    this.player = player as unknown as Phaser.GameObjects.Rectangle;

    const playerBody = this.player.body as Phaser.Physics.Arcade.Body;
    playerBody.setCollideWorldBounds(true);

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

  update() {
    if (!this.player || !this.cursors || !this.wasd) return;

    const speed = 180;
    const body = this.player.body as Phaser.Physics.Arcade.Body;

    body.setVelocity(0);

    const left = this.cursors.left.isDown || this.wasd.A.isDown;
    const right = this.cursors.right.isDown || this.wasd.D.isDown;
    const up = this.cursors.up.isDown || this.wasd.W.isDown;
    const down = this.cursors.down.isDown || this.wasd.S.isDown;

    if (left) body.setVelocityX(-speed);
    if (right) body.setVelocityX(speed);
    if (up) body.setVelocityY(-speed);
    if (down) body.setVelocityY(speed);

    body.velocity.normalize().scale(speed);

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