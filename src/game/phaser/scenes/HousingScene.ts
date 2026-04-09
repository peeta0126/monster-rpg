import Phaser from "phaser";
import { gameEvents, GAME_EVENT } from "../events";
import { usePlayerStore } from "../../../store/playerStore";
import { getFurniture } from "../../../data/furniture";

// ─── 가구 슬롯 위치 (6칸, 2행 × 3열) ─────────────────────────────────────────────
const FURNITURE_SLOTS = [
  { x: 185, y: 185 }, // 0
  { x: 480, y: 185 }, // 1
  { x: 775, y: 185 }, // 2
  { x: 185, y: 340 }, // 3
  { x: 480, y: 340 }, // 4
  { x: 775, y: 340 }, // 5
];

const SLOT_W = 120;
const SLOT_H = 90;

// ─── 문 위치 ──────────────────────────────────────────────────────────────────────
const FARM_DOOR  = { x: 56,  y: 460, w: 60, h: 80, label: "🌾 농장" };
const EXIT_DOOR  = { x: 904, y: 460, w: 60, h: 80, label: "🌲 바깥" };

export default class HousingScene extends Phaser.Scene {
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

  private furnitureObjects: Phaser.GameObjects.Container[] = [];

  constructor() {
    super("HousingScene");
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
    const W = 960, H = 540;
    this.cameras.main.setBounds(0, 0, W, H);
    this.physics.world.setBounds(0, 0, W, H);

    // ── 방 배경 ─────────────────────────────────────────────────────────────────
    const g = this.add.graphics();

    // 바닥 (나무 바닥 느낌)
    g.fillStyle(0xc8a87a);
    g.fillRect(0, 0, W, H);

    // 바닥 패턴 (수평 줄)
    g.lineStyle(1, 0xb0925c, 0.35);
    for (let y = 60; y < H; y += 40) g.lineBetween(0, y, W, y);
    for (let x = 0; x < W; x += 60) g.lineBetween(x, 0, x, H);

    // 상단 벽
    g.fillStyle(0x7b5c3a);
    g.fillRect(0, 0, W, 110);

    // 하단 벽 (좁게)
    g.fillStyle(0x7b5c3a);
    g.fillRect(0, H - 48, W, 48);

    // 왼쪽 벽
    g.fillStyle(0x8b6844);
    g.fillRect(0, 110, 80, H - 110 - 48);

    // 오른쪽 벽
    g.fillStyle(0x8b6844);
    g.fillRect(W - 80, 110, 80, H - 110 - 48);

    // 벽 테두리 라인
    g.lineStyle(3, 0x5a3e1e, 1);
    g.strokeRect(80, 110, W - 160, H - 110 - 48);

    // ── 창문 (상단 벽) ──────────────────────────────────────────────────────────
    const drawWindow = (cx: number) => {
      g.fillStyle(0x87ceeb, 0.7);
      g.fillRect(cx - 40, 12, 80, 60);
      g.lineStyle(3, 0xd4a060, 1);
      g.strokeRect(cx - 40, 12, 80, 60);
      g.lineStyle(1, 0xd4a060, 0.8);
      g.lineBetween(cx, 12, cx, 72);
      g.lineBetween(cx - 40, 42, cx + 40, 42);
    };
    drawWindow(280);
    drawWindow(680);
    this.add.text(280, 42, "🌤️", { fontSize: "18px" }).setOrigin(0.5, 0.5).setDepth(2);
    this.add.text(680, 42, "🌤️", { fontSize: "18px" }).setOrigin(0.5, 0.5).setDepth(2);

    // ── 문 (왼쪽: 농장, 오른쪽: 바깥) ─────────────────────────────────────────
    const drawDoor = (door: typeof FARM_DOOR, color: number) => {
      g.fillStyle(color);
      g.fillRect(door.x - door.w / 2, door.y - door.h / 2, door.w, door.h);
      g.lineStyle(3, 0x3e2000, 1);
      g.strokeRect(door.x - door.w / 2, door.y - door.h / 2, door.w, door.h);
      // 손잡이
      g.fillStyle(0xf0c040);
      g.fillCircle(door.x + door.w / 2 - 10, door.y, 5);
    };
    drawDoor(FARM_DOOR,  0x4a7c59); // 녹색 (농장 문)
    drawDoor(EXIT_DOOR,  0x4a5c7c); // 청색 (바깥 문)

    this.add.text(FARM_DOOR.x, FARM_DOOR.y - 55, FARM_DOOR.label, {
      fontSize: "11px", color: "#a0d8a0",
      backgroundColor: "#05150555", padding: { x: 5, y: 2 },
    }).setOrigin(0.5).setDepth(3);

    this.add.text(EXIT_DOOR.x, EXIT_DOOR.y - 55, EXIT_DOOR.label, {
      fontSize: "11px", color: "#a0b8d8",
      backgroundColor: "#05050555", padding: { x: 5, y: 2 },
    }).setOrigin(0.5).setDepth(3);

    // ── 가구 슬롯 렌더링 ─────────────────────────────────────────────────────────
    this.drawFurnitureSlots();

    // ── 플레이어 ─────────────────────────────────────────────────────────────────
    this.player = this.physics.add.sprite(480, 470, "player-down");
    this.player.setCollideWorldBounds(true);
    this.player.setScale(2);

    // 물리 경계 (벽)
    const wallTop    = this.add.rectangle(W / 2, 55, W, 110, 0x000000, 0).setDepth(0);
    const wallBottom = this.add.rectangle(W / 2, H - 24, W, 48, 0x000000, 0).setDepth(0);
    const wallLeft   = this.add.rectangle(40, H / 2, 80, H, 0x000000, 0).setDepth(0);
    const wallRight  = this.add.rectangle(W - 40, H / 2, 80, H, 0x000000, 0).setDepth(0);
    for (const w of [wallTop, wallBottom, wallLeft, wallRight]) {
      this.physics.add.existing(w, true);
      this.physics.add.collider(this.player, w);
    }

    // ── 키보드 ───────────────────────────────────────────────────────────────────
    const keyboard = this.input.keyboard!;
    this.cursors = keyboard.createCursorKeys();
    this.wasd = keyboard.addKeys("W,A,S,D") as {
      W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key;
      S: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key;
    };

    keyboard.on("keydown-E", () => {
      const distFarm = Phaser.Math.Distance.Between(this.player.x, this.player.y, FARM_DOOR.x, FARM_DOOR.y);
      const distExit = Phaser.Math.Distance.Between(this.player.x, this.player.y, EXIT_DOOR.x, EXIT_DOOR.y);
      if (distFarm < 90) {
        gameEvents.emit(GAME_EVENT.ENTER_FARM);
      } else if (distExit < 90) {
        gameEvents.emit(GAME_EVENT.EXIT_HOUSING);
      }
    });

    // ── 가구 업데이트 이벤트 리스닝 ───────────────────────────────────────────────
    gameEvents.on(GAME_EVENT.HOUSING_FURNITURE_UPDATE, this.drawFurnitureSlots, this);
  }

  /** 가구 슬롯 렌더링 (이벤트 받을 때마다 재호출) */
  private drawFurnitureSlots() {
    // 기존 오브젝트 제거
    for (const obj of this.furnitureObjects) obj.destroy();
    this.furnitureObjects = [];

    const placed = usePlayerStore.getState().placedFurniture;

    FURNITURE_SLOTS.forEach((slot, i) => {
      const furnitureId = placed[i];
      const furniture   = furnitureId ? getFurniture(furnitureId) : null;

      const g = this.add.graphics().setDepth(4);
      if (furniture) {
        // 가구 배경
        g.fillStyle(furniture.color, 0.85);
        g.fillRoundedRect(slot.x - SLOT_W / 2, slot.y - SLOT_H / 2, SLOT_W, SLOT_H, 8);
        g.lineStyle(2, 0xffffff, 0.3);
        g.strokeRoundedRect(slot.x - SLOT_W / 2, slot.y - SLOT_H / 2, SLOT_W, SLOT_H, 8);
      } else {
        // 빈 슬롯
        g.lineStyle(1, 0xaaaaaa, 0.25);
        g.strokeRoundedRect(slot.x - SLOT_W / 2, slot.y - SLOT_H / 2, SLOT_W, SLOT_H, 8);
        g.fillStyle(0x000000, 0.08);
        g.fillRoundedRect(slot.x - SLOT_W / 2, slot.y - SLOT_H / 2, SLOT_W, SLOT_H, 8);
      }

      const emojiText = this.add.text(slot.x, slot.y - 14, furniture ? furniture.emoji : "·", {
        fontSize: furniture ? "24px" : "18px",
        color: furniture ? "#ffffff" : "#666666",
      }).setOrigin(0.5).setDepth(5);

      const nameText = this.add.text(slot.x, slot.y + 20, furniture ? furniture.name : `슬롯 ${i + 1}`, {
        fontSize: "9px",
        color: furniture ? "#ffffffcc" : "#555555",
      }).setOrigin(0.5).setDepth(5);

      const container = this.add.container(0, 0, [g, emojiText, nameText]).setDepth(4);
      this.furnitureObjects.push(container);
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

    if (left)  { body.setVelocityX(-speed); this.facing = "left"; }
    else if (right) { body.setVelocityX(speed); this.facing = "right"; }
    if (up)    { body.setVelocityY(-speed); this.facing = "up"; }
    else if (down) { body.setVelocityY(speed); this.facing = "down"; }

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

    // 문 근처 힌트
    const distFarm = Phaser.Math.Distance.Between(this.player.x, this.player.y, FARM_DOOR.x, FARM_DOOR.y);
    const distExit = Phaser.Math.Distance.Between(this.player.x, this.player.y, EXIT_DOOR.x, EXIT_DOOR.y);

    const existingHint = this.children.getByName("doorHint");
    if (distFarm < 90 || distExit < 90) {
      if (!existingHint) {
        const label = distFarm < 90 ? "E: 농장으로" : "E: 바깥으로";
        this.add.text(this.player.x - 40, this.player.y - 56, label, {
          fontSize: "13px", color: "#ffffff",
          backgroundColor: "#000000aa", padding: { x: 6, y: 3 },
        }).setName("doorHint").setDepth(20);
      }
    } else if (existingHint) {
      existingHint.destroy();
    }
  }

  shutdown() {
    gameEvents.off(GAME_EVENT.HOUSING_FURNITURE_UPDATE, this.drawFurnitureSlots, this);
  }
}
