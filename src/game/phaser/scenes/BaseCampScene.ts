import Phaser from "phaser";
import { gameEvents, GAME_EVENT } from "../events";
import { getCampPosition, setCampPosition } from "../campPositionStore";

// ─── 맵 구성 위치 (basecamp-bg.png 1536×2730 기준) ────────────────────────────
// 레이아웃: 탑(왼쪽) ── 집(중앙) ── 숲(오른쪽 아래)
const FOREST_X = 1500, FOREST_Y = 1900;
const HOUSE_X  = 794,  HOUSE_Y  = 1080;
const HOUSE_DOOR_Y = HOUSE_Y + 130;   // 집 문 Y 위치 (집 하단)
const TOWER_X  = 278,  TOWER_Y  = 1010;

// 드래곤 배너 위치 (집 전면 사자 배너 자리)
const DRAGON_X = HOUSE_X - 55;
const DRAGON_Y = HOUSE_Y - 80;

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
    // 배경
    this.load.image("basecamp-bg", "/assets/basecamp/basecamp-bg.png");
    // 드래곤 배너
    this.load.image("dragon", "/assets/basecamp/dragon.png");
    // 플레이어 스프라이트
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
    this.physics.world.setBounds(0, 0, mapW, mapH);

    // ── 배경 이미지 ──────────────────────────────────────────────────────────────
    this.add.image(mapW / 2, mapH / 2, "basecamp-bg").setDepth(0);

    // ── 드래곤 배너 (집 전면 사자 배너 대체) ────────────────────────────────────
    // dragon.png (1024×637) → 집 벽 크기에 맞게 축소 (약 90px 너비)
    this.add.image(DRAGON_X, DRAGON_Y, "dragon")
      .setScale(0.088)
      .setDepth(2);

    // ── 충돌 박스 (투명, 건물 진입 불가 영역) ───────────────────────────────────
    // 집 외벽 (문 제외 상단/좌우)
    const houseWall = this.add.rectangle(HOUSE_X, HOUSE_Y - 40, 200, 200, 0x000000, 0);
    this.physics.add.existing(houseWall, true);

    // 탑 몸통
    const towerBlock = this.add.rectangle(TOWER_X, TOWER_Y - 80, 120, 280, 0x000000, 0);
    this.physics.add.existing(towerBlock, true);

    // 숲 입구 상단 (경로 위만 막음)
    const forestBlock = this.add.rectangle(FOREST_X - 50, FOREST_Y - 120, 260, 100, 0x000000, 0);
    this.physics.add.existing(forestBlock, true);

    // ── 플레이어 (마지막 위치 또는 집 앞 기본) ──────────────────────────────────
    const initPos = getCampPosition();
    this.player = this.physics.add.sprite(initPos.x, initPos.y, "player-down");
    this.player.setCollideWorldBounds(true);
    this.player.setScale(1.0);   // 기존 scale(2)에서 축소
    this.player.setDepth(5);

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
        setCampPosition(TOWER_X, TOWER_Y + 120);  // 탑 앞 저장
        gameEvents.emit(GAME_EVENT.ENTER_BATTLE, {
          from: "basecamp", portalId: "dungeon-entrance-1",
          isCatchZone: false, floor: 1,
        });
      } else if (distForest < 130) {
        setCampPosition(FOREST_X, FOREST_Y + 80);  // 숲 앞 저장
        gameEvents.emit(GAME_EVENT.ENTER_FOREST);
      } else if (distHouse < 90) {
        setCampPosition(HOUSE_X, HOUSE_DOOR_Y + 50);  // 집 앞 저장
        gameEvents.emit(GAME_EVENT.ENTER_HOUSING);
      }
    });

    keyboard.on("keydown-P", () => {
      gameEvents.emit("open-dex");
    });

    // ── 근접 힌트 텍스트 ─────────────────────────────────────────────────────
    // (update에서 거리 기반으로 생성/제거)
  }

  update(_time: number, delta: number) {
    if (!this.player || !this.cursors || !this.wasd) return;

    const speed = 200;
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

    // 힌트 표시 / 제거
    const ph = this.children.getByName("portalHint");
    const fh = this.children.getByName("forestHint");
    const hh = this.children.getByName("houseHint");

    if (distTower < 90 && !ph) {
      this.add.text(px - 46, py - 56, "E: 탑 입장", {
        fontSize: "13px", color: "#aad4f5",
        backgroundColor: "#000000aa", padding: { x: 6, y: 3 },
      }).setName("portalHint").setDepth(10);
    } else if (distTower >= 120 && ph) ph.destroy();

    if (distForest < 130 && !fh) {
      this.add.text(px - 46, py - 56, "E: 숲 입장", {
        fontSize: "13px", color: "#88ee44",
        backgroundColor: "#000000aa", padding: { x: 6, y: 3 },
      }).setName("forestHint").setDepth(10);
    } else if (distForest >= 160 && fh) fh.destroy();

    if (distHouse < 90 && !hh) {
      this.add.text(px - 46, py - 56, "E: 집 입장", {
        fontSize: "13px", color: "#ffe4b5",
        backgroundColor: "#000000aa", padding: { x: 6, y: 3 },
      }).setName("houseHint").setDepth(10);
    } else if (distHouse >= 120 && hh) hh.destroy();
  }
}
