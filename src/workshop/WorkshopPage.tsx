import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CraftingModal } from "./CraftingModal";
import { AnvilModal } from "./AnvilModal";
import { usePlayerStore } from "../shared/playerStore";
import type { CraftingStationType } from "../shared/crafting";
import { QUALITY_COLOR, QUALITY_LABEL } from "../shared/craftingUtils";

const BG_URL = "/assets/housing/housing_bg.png";

// 이미지 원본 크기 (835 × 714) — 비율 고정용
const BG_W = 835;
const BG_H = 714;
const BG_RATIO = BG_W / BG_H; // ≈ 1.169

// ─── 워크샵 스테이션 타입 (CraftingStationType + "anvil") ──────────────────────
type WorkshopStationType = CraftingStationType | "anvil";

// ─── 타입 ─────────────────────────────────────────────────────────────────────

type Direction = "up" | "down" | "left" | "right";

interface PlayerPos {
  x: number; // stage 기준 % (0~100)
  y: number;
}

// ─── 제작대 위치 상수 ─────────────────────────────────────────────────────────
// x, y : stage 이미지 기준 % 좌표
// radius : 근접 판정 반경 (% 단위)
// SHOW_INTERACTION_DEBUG = true 로 바꾸면 판정 원이 보임
const SHOW_INTERACTION_DEBUG = false;

const CRAFTING_STATIONS: Array<{
  id: string;
  label: string;
  type: WorkshopStationType;
  x: number;
  y: number;
  radius: number;
}> = [
  {
    id: "artifact-workbench",
    label: "아티팩트 제작대",
    type: "artifact",
    x: 22,   // 좌측 제작대 — 필요시 조정
    y: 85,
    radius: 10,
  },
  {
    id: "anvil",
    label: "장비 모루",
    type: "anvil",
    x: 34,   // 아티팩트 제작대 우측 — 필요시 x/y 조정
    y: 80,
    radius: 8,
  },
  {
    id: "alchemy-workbench",
    label: "연금술 제작대",
    type: "potion",
    x: 80,   // 우측 제작대 — 필요시 조정
    y: 35,
    radius: 10,
  },
];

// ─── 플레이어 설정 ────────────────────────────────────────────────────────────

const INITIAL_POS: PlayerPos = { x: 65, y: 97 };
const SPEED = 0.4;          // %/frame (16ms 기준) — deltaTime 보정됨
const PLAYER_DISPLAY = 110; // px — 기존 72px에서 확대

// stage 기준 외곽 이동 제한 (벽 밖 이탈 방지)
const PLAYER_BOUNDS = { minX: 5, maxX: 95, minY: 28, maxY: 97 };


// ─── 충돌 박스 ────────────────────────────────────────────────────────────────
// 모두 stage 기준 퍼센트 좌표 (0~100)
// x, y : 박스 좌상단 / width, height : 크기
// SHOW_COLLISION_DEBUG = true 로 바꾸면 빨간 박스가 보임
const SHOW_COLLISION_DEBUG = false;

interface CollisionBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

const COLLISION_BOXES: CollisionBox[] = [
  // ── 상단 벽 ───────────────────────────────────────────────────────────────
  { id: "top-wall",    x: 0, y: 0,  width: 100, height: 32 },

  // ── 좌측 벽 ───────────────────────────────────────────────────────────────
  { id: "left-wall",   x: 0, y: 0,  width: 15,   height: 100 },

  // ── 우측 벽 ───────────────────────────────────────────────────────────────
  { id: "right-wall",  x: 90, y: 0, width: 5,   height: 100 },
  //--책상
  { id: "desk",  x: 37, y: 37, width: 15,   height: 15 },
  //--작업대
  { id: "작업대",  x: 63, y: 24, width: 35,   height: 15 },
  
  //--책장
  { id: "책장",  x: 61, y: 45, width: 17,   height: 22 },

  
  //--침대
  { id: "침대",  x: 77.8, y: 60, width: 15,   height: 15 },
  
  //--작업대
  { id: "작업대",  x: 80, y: 50, width: 15,   height: 15 },

  //--아티-작업대
  { id: "아티-작업대",  x: 17, y: 86, width: 44,   height: 15 },

  //--작업대
  { id: "작업대",  x: 37, y: 70, width: 30,   height: 16 },
  
  //--문 옆 보물상자
  { id: "보물상자",  x: 73, y: 88, width: 20,   height: 10 },
  
  //--아티작업대
  { id: "아티작업대",  x: 8, y: 60, width: 20,   height: 23 },
  
  //--작업대
  { id: "작업대",  x: 10, y: 40, width: 12,   height: 25 },

  
  //--장식품
  { id: "장식품",  x: 10, y: 23, width: 24,   height: 15 },
];


// ─── 충돌 헬퍼 ───────────────────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function isInsideBox(pt: PlayerPos, box: CollisionBox): boolean {
  return (
    pt.x >= box.x &&
    pt.x <= box.x + box.width &&
    pt.y >= box.y &&
    pt.y <= box.y + box.height
  );
}

function isColliding(pt: PlayerPos): boolean {
  return COLLISION_BOXES.some((box) => isInsideBox(pt, box));
}

function getPlayerImage(dir: Direction, frame: 0 | 1 | 2): string {
  if (frame === 0) return `/assets/player/player-${dir}.png`;
  return `/assets/player/player-${dir}-${frame}.png`;
}

function getDistance(a: PlayerPos, b: { x: number; y: number }): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

// ─── WorkshopPage ─────────────────────────────────────────────────────────────

export default function WorkshopPage() {
  const navigate = useNavigate();
  const craftedItems = usePlayerStore((s) => s.craftedItems);

  // ── 플레이어 상태 ─────────────────────────────────────────────────────────────
  const [pos, setPos]           = useState<PlayerPos>(INITIAL_POS);
  const [direction, setDirection] = useState<Direction>("down");
  const [walkFrame, setWalkFrame] = useState<0 | 1 | 2>(0);

  const keysRef      = useRef(new Set<string>());
  const rafRef       = useRef<number | null>(null);
  const walkTimerRef = useRef(0);
  const lastTimeRef  = useRef<number | null>(null);
  const posRef       = useRef<PlayerPos>(INITIAL_POS);

  // ── 모달 상태 ────────────────────────────────────────────────────────────────
  const [activeStation, setActiveStation] = useState<WorkshopStationType | null>(null);
  const activeStationRef = useRef<WorkshopStationType | null>(null);
  useEffect(() => { activeStationRef.current = activeStation; }, [activeStation]);

  // ── 근접 판정 (렌더용) ────────────────────────────────────────────────────────
  const nearStation = CRAFTING_STATIONS.find(
    (s) => getDistance(pos, s) <= s.radius
  ) ?? null;

  // ── 패널 토글 ────────────────────────────────────────────────────────────────
  const [showCraftedPanel, setShowCraftedPanel] = useState(false);

  // ── 마우스 좌표 (디버그용, stage 기준 %) ─────────────────────────────────────
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);

  const handleStageMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!SHOW_COLLISION_DEBUG) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setMousePos({
      x: Math.round(((e.clientX - rect.left) / rect.width) * 1000) / 10,
      y: Math.round(((e.clientY - rect.top) / rect.height) * 1000) / 10,
    });
  };

  const handleStageMouseLeave = () => setMousePos(null);

  // ── 키보드 핸들러 ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      keysRef.current.add(e.key);
      if (e.code === "Space") {
        e.preventDefault();
        const ns = CRAFTING_STATIONS.find(
          (s) => getDistance(posRef.current, s) <= s.radius
        );
        if (ns && !activeStationRef.current) setActiveStation(ns.type);
      }
      if (e.key === "Escape") setActiveStation(null);
    };
    const onUp = (e: KeyboardEvent) => keysRef.current.delete(e.key);

    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, []); // deps 없음 — ref로 최신값 접근

  // ── RAF 이동 루프 ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const tick = (now: number) => {
      const dt = lastTimeRef.current !== null
        ? Math.min(now - lastTimeRef.current, 50)
        : 16;
      lastTimeRef.current = now;

      const keys = keysRef.current;
      let dx = 0; let dy = 0;

      if (keys.has("ArrowLeft")  || keys.has("a") || keys.has("A")) dx -= 1;
      if (keys.has("ArrowRight") || keys.has("d") || keys.has("D")) dx += 1;
      if (keys.has("ArrowUp")    || keys.has("w") || keys.has("W")) dy -= 1;
      if (keys.has("ArrowDown")  || keys.has("s") || keys.has("S")) dy += 1;

      if (dx !== 0 || dy !== 0) {
        const step = (SPEED / 16) * dt;
        setPos((prev) => {
          // 외곽 경계 클램프 후 X / Y 충돌을 따로 검사
          // → 벽면을 따라 미끄러지듯 이동 가능
          const nx = clamp(prev.x + dx * step, PLAYER_BOUNDS.minX, PLAYER_BOUNDS.maxX);
          const ny = clamp(prev.y + dy * step, PLAYER_BOUNDS.minY, PLAYER_BOUNDS.maxY);

          let rx = prev.x;
          let ry = prev.y;

          // X축 단독 검사
          if (!isColliding({ x: nx, y: prev.y })) rx = nx;
          // Y축 단독 검사 (해결된 X 기준)
          if (!isColliding({ x: rx, y: ny })) ry = ny;

          posRef.current = { x: rx, y: ry };
          return { x: rx, y: ry };
        });
        if      (dx < 0) setDirection("left");
        else if (dx > 0) setDirection("right");
        else if (dy < 0) setDirection("up");
        else             setDirection("down");

        walkTimerRef.current += dt;
        if (walkTimerRef.current >= 180) {
          setWalkFrame((f) => (f === 1 ? 2 : 1));
          walkTimerRef.current = 0;
        }
      } else {
        setWalkFrame(0);
        walkTimerRef.current = 0;
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); };
  }, []);

  // ─── 렌더 ──────────────────────────────────────────────────────────────────

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black">

      {/* ══════════════════════════════════════════════════════════════════════
          레이어 1 — 흐림 배경 (여백을 자연스럽게 채움, 이미지 깨짐 방지)
          ══════════════════════════════════════════════════════════════════════ */}
      <img
        src={BG_URL}
        aria-hidden="true"
        draggable={false}
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        style={{
          filter: "blur(20px) brightness(0.4) saturate(0.8)",
          transform: "scale(1.15)",
          transformOrigin: "center",
        }}
      />

      {/* ══════════════════════════════════════════════════════════════════════
          레이어 2 — 비네팅 오버레이
          ══════════════════════════════════════════════════════════════════════ */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/35 via-transparent to-black/45" />

      {/* ══════════════════════════════════════════════════════════════════════
          레이어 3 — 게임 스테이지 (원본 이미지 비율 835:714 고정)
          ══════════════════════════════════════════════════════════════════════ */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className="relative overflow-hidden"
          onMouseMove={handleStageMouseMove}
          onMouseLeave={handleStageMouseLeave}
          style={{
            // 화면에서 최대한 크게, 단 이미지 비율은 절대 유지
            width:  `min(100vw, calc(100vh * ${BG_RATIO}))`,
            height: `min(100vh, calc(100vw / ${BG_RATIO}))`,
            borderRadius: "12px",
            boxShadow: "0 24px 80px rgba(0,0,0,0.75), 0 0 0 1px rgba(140,90,20,0.25)",
            cursor: SHOW_COLLISION_DEBUG ? "crosshair" : "default",
          }}
        >
          {/* 배경 이미지 — 스테이지가 이미 정확한 비율이므로 fill로 꽉 채움 */}
          <img
            src={BG_URL}
            alt="제작 공방"
            draggable={false}
            className="pointer-events-none absolute inset-0 h-full w-full"
            style={{ objectFit: "fill" }}
          />

          {/* 스테이지 내부 테두리 그라디언트 (깊이감) */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{ boxShadow: "inset 0 0 70px rgba(0,0,0,0.3)" }}
          />

          {/* ── 플레이어 스프라이트 ──────────────────────────────────────────── */}
          <div
            className="absolute z-20"
            style={{
              left: `${pos.x}%`,
              top:  `${pos.y}%`,
              // 발밑이 좌표 기준점이 되도록 위로 올림
              transform: "translate(-50%, -90%)",
            }}
          >
            {/* 발밑 그림자 */}
            <div
              className="absolute rounded-full"
              style={{
                bottom: 2,
                left: "50%",
                transform: "translateX(-50%)",
                width: PLAYER_DISPLAY * 0.55,
                height: 7,
                background: "rgba(0,0,0,0.45)",
                filter: "blur(5px)",
              }}
            />
            <img
              src={getPlayerImage(direction, walkFrame)}
              alt="player"
              draggable={false}
              style={{
                width:  PLAYER_DISPLAY,
                height: PLAYER_DISPLAY,
                imageRendering: "pixelated",
                filter: "drop-shadow(0 5px 10px rgba(0,0,0,0.9))",
                display: "block",
              }}
            />
          </div>

          {/* ── 근처 제작대 상호작용 안내 (스테이지 하단 중앙) ─────────────── */}
          {nearStation && !activeStation && (
            <div className="absolute bottom-14 left-1/2 z-30 -translate-x-1/2">
              <div
                className="flex items-center gap-2.5 rounded-xl px-5 py-2.5 text-sm font-bold"
                style={{
                  background: "rgba(18,9,2,0.94)",
                  border: "1px solid rgba(180,120,30,0.75)",
                  color: "#f5e6c8",
                  boxShadow: "0 0 28px rgba(180,120,30,0.35)",
                }}
              >
                <span
                  className="rounded px-2 py-0.5 text-xs font-black"
                  style={{ background: "#b47828", color: "#160c04", letterSpacing: "0.05em" }}
                >
                  SPACE
                </span>
                <span>{nearStation.label} 사용하기</span>
              </div>
            </div>
          )}

          {/* ── 디버그: 마우스 커서 십자선 + 좌표 말풍선 ────────────────────── */}
          {SHOW_COLLISION_DEBUG && mousePos && (
            <>
              {/* 가로선 */}
              <div
                className="pointer-events-none absolute z-50 w-full"
                style={{ top: `${mousePos.y}%`, height: 1, background: "rgba(0,255,180,0.55)" }}
              />
              {/* 세로선 */}
              <div
                className="pointer-events-none absolute z-50 h-full"
                style={{ left: `${mousePos.x}%`, width: 1, background: "rgba(0,255,180,0.55)" }}
              />
              {/* 중심 점 */}
              <div
                className="pointer-events-none absolute z-50 -translate-x-1/2 -translate-y-1/2 rounded-full"
                style={{
                  left: `${mousePos.x}%`,
                  top:  `${mousePos.y}%`,
                  width: 8, height: 8,
                  background: "#00ffb4",
                  boxShadow: "0 0 6px #00ffb4",
                }}
              />
              {/* 좌표 말풍선 — 커서 우하단에 표시 */}
              <div
                className="pointer-events-none absolute z-50 rounded-lg px-2.5 py-1.5 font-mono text-xs font-bold"
                style={{
                  left: `${Math.min(mousePos.x + 2, 72)}%`,
                  top:  `${Math.min(mousePos.y + 2, 88)}%`,
                  background: "rgba(0,20,12,0.92)",
                  border: "1px solid rgba(0,255,180,0.5)",
                  color: "#00ffb4",
                  whiteSpace: "nowrap",
                  boxShadow: "0 0 12px rgba(0,255,180,0.2)",
                }}
              >
                x: {mousePos.x.toFixed(1)} &nbsp;y: {mousePos.y.toFixed(1)}
              </div>
            </>
          )}

          {/* ── 디버그: 충돌 박스 표시 (SHOW_COLLISION_DEBUG = true 시) ────── */}
          {SHOW_COLLISION_DEBUG && COLLISION_BOXES.map((box) => (
            <div
              key={box.id}
              className="pointer-events-none absolute z-40 border border-red-500 bg-red-500/20 text-[9px] font-bold text-red-200"
              style={{
                left:   `${box.x}%`,
                top:    `${box.y}%`,
                width:  `${box.width}%`,
                height: `${box.height}%`,
              }}
            >
              <span className="px-0.5" style={{ textShadow: "0 1px 2px #000" }}>{box.id}</span>
            </div>
          ))}

          {/* ── 디버그: 제작대 판정 원 표시 ─────────────────────────────────── */}
          {SHOW_INTERACTION_DEBUG && CRAFTING_STATIONS.map((s) => (
            <div
              key={s.id}
              className="pointer-events-none absolute z-40 -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{
                left: `${s.x}%`,
                top:  `${s.y}%`,
                width:  `${s.radius * 2}%`,
                height: `${s.radius * 2}%`,
                background: "rgba(255,220,0,0.15)",
                border: "2px solid rgba(255,220,0,0.7)",
              }}
            >
              <span
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[10px] font-black"
                style={{ color: "#ffe04b", textShadow: "0 1px 4px #000" }}
              >
                {s.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          HUD — 화면 전체 기준 overlay (z-40)
          모든 버튼 / 타이틀 / 조작 안내는 여기에
          ══════════════════════════════════════════════════════════════════════ */}

      {/* 뒤로가기 */}
      <div className="absolute left-4 top-4 z-40">
        <button
          type="button"
          onClick={() => navigate("/")}
          style={{
            background: "rgba(22,12,4,0.88)",
            border: "1px solid rgba(180,120,30,0.6)",
            color: "#f5e6c8",
          }}
          className="rounded-lg px-3 py-2 text-sm font-bold backdrop-blur transition hover:brightness-125"
        >
          ← 바깥으로
        </button>
      </div>

      {/* 타이틀 */}
      <div className="pointer-events-none absolute left-1/2 top-4 z-40 -translate-x-1/2 text-center">
        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "#b47828" }}>
          Workshop
        </p>
        <h1
          className="text-xl font-black drop-shadow-lg"
          style={{ color: "#f5e6c8", textShadow: "0 2px 8px rgba(0,0,0,0.9)" }}
        >
          제작 공방
        </h1>
      </div>

      {/* 우상단 버튼 그룹 */}
      <div className="absolute right-4 top-4 z-40 flex gap-2">
        <button
          type="button"
          onClick={() => navigate("/monsters")}
          style={{
            background: "rgba(22,12,4,0.88)",
            border: "1px solid rgba(130,100,220,0.6)",
            color: "#c4b5fd",
          }}
          className="rounded-lg px-3 py-2 text-sm font-bold backdrop-blur transition hover:brightness-125"
        >
          👾 내 몬스터
        </button>
        <button
          type="button"
          onClick={() => navigate("/farm", { state: { from: "housing" } })}
          style={{
            background: "rgba(22,12,4,0.88)",
            border: "1px solid rgba(180,120,30,0.6)",
            color: "#f5e6c8",
          }}
          className="rounded-lg px-3 py-2 text-sm font-bold backdrop-blur transition hover:brightness-125"
        >
          🎒 가방
        </button>
        <button
          type="button"
          onClick={() => setShowCraftedPanel((v) => !v)}
          style={{
            background: showCraftedPanel ? "rgba(40,22,6,0.95)" : "rgba(22,12,4,0.88)",
            border: "1px solid rgba(180,120,30,0.6)",
            color: "#f5e6c8",
          }}
          className="rounded-lg px-3 py-2 text-sm font-bold backdrop-blur transition hover:brightness-125"
        >
          📜 제작 목록
        </button>
      </div>

      {/* 최근 제작 아이템 패널 */}
      {showCraftedPanel && (
        <div
          className="absolute right-4 top-16 z-40 w-56 rounded-xl p-4 backdrop-blur shadow-2xl"
          style={{
            background: "rgba(20,10,3,0.95)",
            border: "1px solid rgba(180,120,30,0.5)",
          }}
        >
          <p className="mb-3 text-xs font-bold uppercase tracking-widest" style={{ color: "#8b6014" }}>
            최근 제작 아이템
          </p>
          {craftedItems.length === 0 ? (
            <p className="py-3 text-center text-xs" style={{ color: "#6b4c18" }}>
              아직 제작한 아이템이 없습니다.
            </p>
          ) : (
            <div className="grid max-h-80 gap-2 overflow-y-auto">
              {craftedItems.slice(0, 15).map((item) => (
                <div
                  key={item.id}
                  className="rounded-lg px-3 py-2"
                  style={{
                    background: "rgba(42,22,8,0.85)",
                    border: `1px solid ${QUALITY_COLOR[item.quality]}44`,
                  }}
                >
                  <p className="text-xs font-black" style={{ color: "#f5e6c8" }}>{item.name}</p>
                  <p className="mt-0.5 text-[10px] font-bold" style={{ color: QUALITY_COLOR[item.quality] }}>
                    {QUALITY_LABEL[item.quality]}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 조작 안내 (좌하단, 작게) */}
      <div
        className="pointer-events-none absolute bottom-4 left-4 z-40 rounded-lg px-3 py-2 text-xs backdrop-blur"
        style={{
          background: "rgba(22,12,4,0.75)",
          border: "1px solid rgba(120,80,20,0.4)",
          color: "#8b6014",
        }}
      >
        WASD / 방향키 이동 &nbsp;·&nbsp; SPACE 상호작용
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          제작 모달 (z-50)
          ══════════════════════════════════════════════════════════════════════ */}
      {/* 아티팩트 / 물약 제작 모달 */}
      {(activeStation === "artifact" || activeStation === "potion") && (
        <CraftingModal
          open
          stationType={activeStation}
          onClose={() => setActiveStation(null)}
        />
      )}

      {/* 장비 모루 모달 */}
      {activeStation === "anvil" && (
        <AnvilModal
          open
          onClose={() => setActiveStation(null)}
        />
      )}
    </div>
  );
}
