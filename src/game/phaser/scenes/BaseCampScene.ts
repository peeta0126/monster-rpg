import Phaser from "phaser";
import { gameEvents, GAME_EVENT } from "../events";
import { getCampPosition, setCampPosition } from "../campPositionStore";

// ─── 맵 좌표 (basecamp-bg.png 1536×2730 기준) ─────────────────────────────────
const FOREST_X = 1500, FOREST_Y = 1900;
const HOUSE_X  = 794,  HOUSE_Y  = 1080;
const HOUSE_DOOR_Y = HOUSE_Y + 135;   // 집 문 앞 y
const TOWER_X  = 278,  TOWER_Y  = 1010;

// 카메라 줌 (0.5 = 전체 너비가 화면에 들어오는 수준)
const CAM_ZOOM = 0.5;
// 플레이어 스케일 (줌 보정)
const PLAYER_SCALE = 2.5;

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

    // ── 배경 이미지 (depth 0) ────────────────────────────────────────────────────
    this.add.image(mapW / 2, mapH / 2, "basecamp-bg")
      .setDepth(0);

    // ── 드래곤 배너 (집 전면 사자 배너 위치, depth=집 상단) ──────────────────────
    this.add.image(HOUSE_X - 55, HOUSE_Y - 80, "dragon")
      .setScale(0.088)
      .setDepth(HOUSE_Y - 80);

    // ────────────────────────────────────────────────────────────────────────────
    // ── 충돌 박스 (길 제외 모든 구역 막힘) ──────────────────────────────────────
    // ────────────────────────────────────────────────────────────────────────────
    const g = this.add.graphics().setDepth(0); // 디버그용 (배포 시 제거 가능)

    const addWall = (x: number, y: number, w: number, h: number) => {
      const wall = this.add.rectangle(x, y, w, h, 0x000000, 0);
      this.physics.add.existing(wall, true);
      return wall;
    };

    // ─ 상단 경계 (하늘 / 산 / 지평선 위) ─
    const topBound   = addWall(mapW / 2, 270, mapW, 540);

    // ─ 좌우 경계 ─
    const leftBound  = addWall(0,        mapH / 2, 40,   mapH);
    const rightBound = addWall(mapW,     mapH / 2, 40,   mapH);

    // ─ 하단 경계 ─
    const botBound   = addWall(mapW / 2, mapH - 20, mapW, 40);

    // ─ 탑/석조 게이트 ─
    // 탑 상단 몸통
    const towerTop   = addWall(TOWER_X,       TOWER_Y - 140, 200, 180);
    // 탑 좌측 기둥 (아치 통로 왼쪽)
    const towerLeft  = addWall(TOWER_X - 100, TOWER_Y + 50,  60,  160);
    // 탑 우측 기둥 (아치 통로 오른쪽)
    const towerRight = addWall(TOWER_X + 100, TOWER_Y + 50,  60,  160);
    // 탑 아치 통로 위 가로 블록
    const towerArch  = addWall(TOWER_X,       TOWER_Y - 20,  140, 60);

    // ─ 집 외벽 (문 제외) ─
    // 집 지붕+상단
    const houseTop   = addWall(HOUSE_X,       HOUSE_Y - 80,  240, 200);
    // 집 왼쪽 벽 (문 옆)
    const houseLeft  = addWall(HOUSE_X - 100, HOUSE_Y + 60,  60,  150);
    // 집 오른쪽 벽 (문 옆)
    const houseRight = addWall(HOUSE_X + 100, HOUSE_Y + 60,  60,  150);

    // ─ 숲 상단 캐노피 (경로 위만 막음) ─
    const forestTop  = addWall(FOREST_X - 30, FOREST_Y - 160, 300, 180);
    // 숲 좌측 나무군
    const forestLeft = addWall(FOREST_X - 180, FOREST_Y - 40, 100, 250);
    // 숲 우측 나무군
    const forestRight= addWall(FOREST_X + 180, FOREST_Y - 40, 100, 250);

    // ─ 길 주변 풀밭/담장 (추정 위치, 조정 필요) ─
    // 집 북쪽 정원 / 울타리
    const fenceNorth = addWall(HOUSE_X,       HOUSE_Y - 340, 400, 100);
    // 탑과 집 사이 석벽 북쪽
    const midWallN   = addWall(540,           HOUSE_Y - 200, 200, 80);
    // 길 북쪽 경계 (탑~집 구간)
    const roadNorth  = addWall(530,           900,           800, 160);
    // 길 북쪽 (집~숲 구간)
    const roadNE     = addWall(1180,          850,           500, 300);
    // 길 남쪽 여백 (맵 하단 미사용 구역)
    const southWaste = addWall(mapW / 2,      2400,          mapW, 600);

    // ────────────────────────────────────────────────────────────────────────────
    // ── Depth 오버레이: 건물 전면 (플레이어가 건물 뒤를 걸을 때 가림) ──────────
    // ── 배경 이미지의 건물 하단부를 동일 색으로 덮어 depth 일루전 구현 ──────────
    // ────────────────────────────────────────────────────────────────────────────

    // 집 전면 하단 (문 양옆 + 기단 부분)
    // 픽셀아트 집 하단 벽 색: 베이지 계열
    const houseFrontDepth = HOUSE_Y + 130;
    const houseFront = this.add.graphics().setDepth(houseFrontDepth);
    houseFront.fillStyle(0xd4b070, 1.0);
    houseFront.fillRect(HOUSE_X - 110, HOUSE_Y + 30, 80, 120);   // 집 왼쪽 하단
    houseFront.fillRect(HOUSE_X + 30,  HOUSE_Y + 30, 80, 120);   // 집 오른쪽 하단
    houseFront.fillStyle(0xc8a85a, 1.0);
    houseFront.fillRect(HOUSE_X - 110, HOUSE_Y + 130, 240, 30);  // 집 기단 선

    // 탑/게이트 전면 기둥 하단 (아치 통로 주변)
    const towerFrontDepth = TOWER_Y + 100;
    const towerFront = this.add.graphics().setDepth(towerFrontDepth);
    towerFront.fillStyle(0x888070, 1.0);
    towerFront.fillRect(TOWER_X - 120, TOWER_Y + 20, 60, 160);   // 왼 기둥 하단
    towerFront.fillRect(TOWER_X + 60,  TOWER_Y + 20, 60, 160);   // 오른 기둥 하단
    towerFront.fillStyle(0x707060, 1.0);
    towerFront.fillRect(TOWER_X - 120, TOWER_Y + 160, 240, 20);  // 기단

    // ────────────────────────────────────────────────────────────────────────────
    // ── 플레이어 ────────────────────────────────────────────────────────────────
    // ────────────────────────────────────────────────────────────────────────────
    const initPos = getCampPosition();
    this.player = this.physics.add.sprite(initPos.x, initPos.y, "player-down");
    this.player.setCollideWorldBounds(true);
    this.player.setScale(PLAYER_SCALE);
    this.player.setDepth(initPos.y);

    // 충돌 등록
    const walls = [
      topBound, leftBound, rightBound, botBound,
      towerTop, towerLeft, towerRight, towerArch,
      houseTop, houseLeft, houseRight,
      forestTop, forestLeft, forestRight,
      fenceNorth, midWallN, roadNorth, roadNE, southWaste,
    ];
    walls.forEach(w => this.physics.add.collider(this.player, w));

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
        setCampPosition(TOWER_X, TOWER_Y + 120);
        gameEvents.emit(GAME_EVENT.ENTER_BATTLE, {
          from: "basecamp", portalId: "dungeon-entrance-1",
          isCatchZone: false, floor: 1,
        });
      } else if (distForest < 130) {
        setCampPosition(FOREST_X, FOREST_Y + 80);
        gameEvents.emit(GAME_EVENT.ENTER_FOREST);
      } else if (distHouse < 90) {
        setCampPosition(HOUSE_X, HOUSE_DOOR_Y + 60);
        gameEvents.emit(GAME_EVENT.ENTER_HOUSING);
      }
    });

    keyboard.on("keydown-P", () => {
      gameEvents.emit("open-dex");
    });
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

    // ── 스프라이트 애니메이션 ────────────────────────────────────────────────────
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

    // ── depth 동적 업데이트 (y좌표 = depth → 건물 뒤/앞 자동 처리) ─────────────
    this.player.setDepth(this.player.y);

    // ── 근접 힌트 텍스트 ────────────────────────────────────────────────────────
    const px = this.player.x, py = this.player.y;
    const distTower  = Phaser.Math.Distance.Between(px, py, TOWER_X, TOWER_Y + 100);
    const distForest = Phaser.Math.Distance.Between(px, py, FOREST_X, FOREST_Y);
    const distHouse  = Phaser.Math.Distance.Between(px, py, HOUSE_X, HOUSE_DOOR_Y);

    const ph = this.children.getByName("portalHint");
    const fh = this.children.getByName("forestHint");
    const hh = this.children.getByName("houseHint");

    if (distTower < 90 && !ph) {
      this.add.text(px - 46, py - 80, "E: 탑 입장", {
        fontSize: "26px", color: "#aad4f5",
        backgroundColor: "#000000aa", padding: { x: 6, y: 3 },
      }).setName("portalHint").setDepth(9999);
    } else if (distTower >= 120 && ph) ph.destroy();

    if (distForest < 130 && !fh) {
      this.add.text(px - 46, py - 80, "E: 숲 입장", {
        fontSize: "26px", color: "#88ee44",
        backgroundColor: "#000000aa", padding: { x: 6, y: 3 },
      }).setName("forestHint").setDepth(9999);
    } else if (distForest >= 160 && fh) fh.destroy();

    if (distHouse < 90 && !hh) {
      this.add.text(px - 46, py - 80, "E: 집 입장", {
        fontSize: "26px", color: "#ffe4b5",
        backgroundColor: "#000000aa", padding: { x: 6, y: 3 },
      }).setName("houseHint").setDepth(9999);
    } else if (distHouse >= 120 && hh) hh.destroy();
  }
}
