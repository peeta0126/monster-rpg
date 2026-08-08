import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CraftingModal } from "./CraftingModal";
import { AnvilModal } from "./AnvilModal";
import { usePlayerStore } from "../shared/playerStore";
import { QUALITY_COLOR, QUALITY_LABEL } from "../shared/craftingUtils";
import { PALETTE, withAlpha } from "../shared/palette";
import { InteractionPrompt } from "../shared/ui/InteractionPrompt";
import { getPlayerFrame, type Dir8 } from "../shared/playerSprite";
import {
  WORKSHOP_BACKGROUND_IMAGE, WORKSHOP_BACKGROUND_IMAGE_WEBP,
} from "../shared/assetPaths";
import {
  BG_RATIO, INITIAL_POS, PLAYER_BOUNDS, PLAYER_DISPLAY,
  COLLISION_BOXES, CRAFTING_STATIONS, EXIT_ZONE,
  SHOW_COLLISION_DEBUG, SHOW_INTERACTION_DEBUG,
  clamp, isBlocked, findInteractable,
  type Point, type StationDef, type WorkshopStationType,
} from "./workshopLayout";

// --- 타입 -------------------------------------------------------------

type Direction = "up" | "down" | "left" | "right";

/** stage 기준 % 좌표 (0~100). workshopLayout 의 Point 와 같다. */
type PlayerPos = Point;

// --- 이동 -------------------------------------------------------------

/** %/frame (16ms 기준) — deltaTime 으로 보정한다 */
const SPEED = 0.4;

// --- 카메라 -----------------------------------------------------------
// 배경을 "화면에 맞춘 크기 × CAMERA_ZOOM" 으로 키우고 카메라가 플레이어를 따라간다.
// 예전에는 방 전체가 늘 보여서, 카메라가 따라다니는 베이스캠프와 체감이 달랐다.
//
// ⚠ 스테이지 내부 좌표계는 그대로 % 다. 확대·이동은 스테이지 컨테이너에서만 일어난다.
const CAMERA_ZOOM = 1.5;

/** 방향키 입력 → 8방향. 지금은 4방향 에셋으로 폴백되지만 호출부는 이미 8방향 기준이다. */
function directionToDir8(dir: Direction): Dir8 {
  return dir === "up" ? "N" : dir === "down" ? "S" : dir === "left" ? "W" : "E";
}

// ─── WorkshopPage ─────────────────────────────────────────────────────────────

export default function WorkshopPage() {
  const navigate = useNavigate();
  const craftedItems = usePlayerStore((s) => s.craftedItems);

  // ── 메뉴(Tab) 상태 ─────────────────────────────────────────────────────────
  const [menuOpen, setMenuOpen] = useState(false);
  const menuOpenRef = useRef(false);
  useEffect(() => { menuOpenRef.current = menuOpen; }, [menuOpen]);

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

  // ── 공방 밖으로 ──────────────────────────────────────────────────────────────
  // 좌상단 버튼과 출입구가 같은 함수를 쓴다. 나가는 길이 두 벌이면 한쪽만 고쳐서 어긋난다.
  const goToBaseCamp = useCallback(() => navigate("/"), [navigate]);
  const goToBaseCampRef = useRef(goToBaseCamp);
  useEffect(() => { goToBaseCampRef.current = goToBaseCamp; }, [goToBaseCamp]);

  // ── 근접 판정 (렌더용) ────────────────────────────────────────────────────────
  // 제작대 우선, 없으면 출입구. 우선순위는 findInteractable 한 곳에만 있다.
  const near = findInteractable(pos);

  // ── 패널 토글 ────────────────────────────────────────────────────────────────
  const [showCraftedPanel, setShowCraftedPanel] = useState(false);

  const playerFrame = getPlayerFrame(directionToDir8(direction), walkFrame);

  // ── 뷰포트 크기 (카메라 계산용) ──────────────────────────────────────────────
  const [viewport, setViewport] = useState(() => ({
    w: typeof window === "undefined" ? 1440 : window.innerWidth,
    h: typeof window === "undefined" ? 900  : window.innerHeight,
  }));
  useEffect(() => {
    const onResize = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // 화면에 꽉 채웠을 때의 크기(= 예전 동작)에 배율을 곱한 것이 실제 스테이지 크기다
  const fitW   = Math.min(viewport.w, viewport.h * BG_RATIO);
  const fitH   = Math.min(viewport.h, viewport.w / BG_RATIO);
  const stageW = fitW * CAMERA_ZOOM;
  const stageH = fitH * CAMERA_ZOOM;

  // 플레이어를 화면 중앙에 두되, 스테이지 가장자리를 넘어가지 않게 클램프
  const camX = clamp((pos.x / 100) * stageW - viewport.w / 2, 0, Math.max(0, stageW - viewport.w));
  const camY = clamp((pos.y / 100) * stageH - viewport.h / 2, 0, Math.max(0, stageH - viewport.h));
  // 스테이지가 화면보다 작으면(배율 1 등) 가운데 정렬
  const offsetX = stageW < viewport.w ? (viewport.w - stageW) / 2 : -camX;
  const offsetY = stageH < viewport.h ? (viewport.h - stageH) / 2 : -camY;

  // ── 마우스 좌표 (디버그용, stage 기준 %) ─────────────────────────────────────
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);

  const handleStageMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!SHOW_INTERACTION_DEBUG) return;
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
      if (e.key === "Tab") {
        if (activeStationRef.current) return;
        e.preventDefault();
        setMenuOpen((v) => !v);
        return;
      }
      if (e.key === "Escape") {
        if (menuOpenRef.current) { setMenuOpen(false); return; }
        setActiveStation(null);
        return;
      }
      if (menuOpenRef.current) return;
      if (e.code === "Space") {
        e.preventDefault();
        if (activeStationRef.current) return;   // 모달이 열려 있으면 상호작용 차단
        const hit = findInteractable(posRef.current);
        if (!hit) return;
        if (hit.kind === "exit") goToBaseCampRef.current();
        else setActiveStation((hit.def as StationDef).type);
      }
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

      if (menuOpenRef.current) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

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

          // X축 단독 검사 / Y축 단독 검사 — 항상 원래 prev 기준으로 검사해야
          // 대각선 이동 시 박스 모서리를 파고들어 갇히는 현상을 막을 수 있음
          const collideX = isBlocked({ x: nx, y: prev.y });
          const collideY = isBlocked({ x: prev.x, y: ny });
          if (!collideX) rx = nx;
          if (!collideY) ry = ny;

          // 대각선 이동: 각 축은 개별적으로 안전해 보여도 합쳐진 목적지가
          // 박스 내부라면(모서리 통과) 이동 자체를 취소 — 박스 안에 끼는 버그 방지
          if (!collideX && !collideY && isBlocked({ x: nx, y: ny })) {
            rx = prev.x;
            ry = prev.y;
          }

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
    <div className="relative h-screen w-screen overflow-hidden bg-shadow-900">

      {/* ══════════════════════════════════════════════════════════════════════
          레이어 1 — 흐림 배경 (여백을 자연스럽게 채움, 이미지 깨짐 방지)
          ══════════════════════════════════════════════════════════════════════ */}
      <img
        src={WORKSHOP_BACKGROUND_IMAGE_WEBP}
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
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-shadow-900/35 via-transparent to-shadow-900/45" />

      {/* ══════════════════════════════════════════════════════════════════════
          레이어 3 — 게임 스테이지 (원본 이미지 비율 2400:1792 고정)
          ══════════════════════════════════════════════════════════════════════ */}
      <div className="absolute inset-0 overflow-hidden">
        <div
          className="absolute left-0 top-0 overflow-hidden will-change-transform"
          onMouseMove={handleStageMouseMove}
          onMouseLeave={handleStageMouseLeave}
          style={{
            width:  stageW,
            height: stageH,
            // translate3d로 GPU 합성에 태운다 (left/top 애니메이션은 매 프레임 레이아웃을 다시 계산한다)
            transform: `translate3d(${offsetX}px, ${offsetY}px, 0)`,
            cursor: SHOW_INTERACTION_DEBUG ? "crosshair" : "default",
          }}
        >
          {/* 배경 이미지 — 스테이지가 이미 BG_RATIO와 같은 비율이라 contain으로도 꽉 찬다.
              contain 이어야 한다. fill 은 비율을 무시해 늘리므로 좌표계가 어긋난다. */}
          <picture>
            <source srcSet={WORKSHOP_BACKGROUND_IMAGE_WEBP} type="image/webp" />
            <img
              src={WORKSHOP_BACKGROUND_IMAGE}
              alt="제작 공방"
              draggable={false}
              className="pointer-events-none absolute inset-0 h-full w-full"
              style={{ objectFit: "contain" }}
            />
          </picture>

          {/* 스테이지 내부 테두리 그라디언트 (깊이감) */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{ boxShadow: "inset 0 0 70px rgba(13, 18, 35, .3)" }}
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
                background: "rgba(13, 18, 35, .45)",
                filter: "blur(5px)",
              }}
            />
            <img
              src={playerFrame.source}
              alt="player"
              draggable={false}
              className="pixel-img"
              style={{
                transform: playerFrame.flipX ? "scaleX(-1)" : undefined,
                width:  PLAYER_DISPLAY,
                height: PLAYER_DISPLAY,
                filter: "drop-shadow(0 5px 10px rgba(13, 18, 35, .9))",
                display: "block",
              }}
            />
          </div>

          {/* ── 디버그: 마우스 커서 십자선 + 좌표 말풍선 ────────────────────── */}
          {SHOW_INTERACTION_DEBUG && mousePos && (
            <>
              {/* 가로선 */}
              <div
                className="pointer-events-none absolute z-50 w-full"
                style={{ top: `${mousePos.y}%`, height: 1, background: "rgba(174, 226, 213, .604)" }}
              />
              {/* 세로선 */}
              <div
                className="pointer-events-none absolute z-50 h-full"
                style={{ left: `${mousePos.x}%`, width: 1, background: "rgba(174, 226, 213, .604)" }}
              />
              {/* 중심 점 */}
              <div
                className="pointer-events-none absolute z-50 -translate-x-1/2 -translate-y-1/2 rounded-full"
                style={{
                  left: `${mousePos.x}%`,
                  top:  `${mousePos.y}%`,
                  width: 8, height: 8,
                  background: PALETTE.mist300,
                  boxShadow: `0 0 6px ${PALETTE.mist300}`,
                }}
              />
              {/* 좌표 말풍선 — 커서 우하단에 표시 */}
              <div
                className="pointer-events-none absolute z-50 rounded-lg px-2.5 py-1.5 font-mono text-pixel-sm font-bold"
                style={{
                  left: `${Math.min(mousePos.x + 2, 72)}%`,
                  top:  `${Math.min(mousePos.y + 2, 88)}%`,
                  background: "rgba(13, 18, 35, .92)",
                  border: "1px solid rgba(174, 226, 213, .549)",
                  color: PALETTE.mist300,
                  whiteSpace: "nowrap",
                  boxShadow: "0 0 12px rgba(174, 226, 213, .22)",
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
              className="pointer-events-none absolute z-40 border border-ember-600 bg-ember-600/20 text-pixel-sm font-bold text-ember-500"
              style={{
                left:   `${box.x}%`,
                top:    `${box.y}%`,
                width:  `${box.width}%`,
                height: `${box.height}%`,
              }}
            >
              <span className="px-0.5" style={{ textShadow: `0 1px 2px ${PALETTE.shadow900}` }}>{box.id}</span>
            </div>
          ))}

          {/* ── 제작대 위치 표식 ────────────────────────────────────────────
              상호작용 안내가 "가까이 가야" 뜨는 탓에, 넓은 방에 처음 들어오면
              모루·연금술대·아티팩트 제작대가 어디인지 몰라 한 바퀴 돌아야 했다.
              멀리서도 보이는 표식을 두되, 가까이 가면(nearStation) 하단 안내에
              자리를 넘기고 흐려진다. */}
          {!activeStation && CRAFTING_STATIONS.map((s) => {
            const isNear = near?.def.id === s.id;
            return (
              <div
                key={`marker-${s.id}`}
                className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center transition-opacity duration-200"
                style={{ left: `${s.x}%`, top: `${s.y}%`, opacity: isNear ? 0.35 : 1 }}
              >
                <div
                  className="flex h-7 w-7 items-center justify-center rounded-full text-pixel-sm"
                  style={{
                    background: "rgba(13, 18, 35, .85)",
                    border: `2px solid ${isNear ? PALETTE.cream100 : "rgba(233, 148, 65, .907)"}`,
                    boxShadow: "0 0 12px rgba(132, 75, 63, 1)",
                    animation: isNear ? undefined : "workshopMarkerBob 1.8s ease-in-out infinite",
                  }}
                >
                  {s.type === "anvil" ? "🔨" : s.type === "potion" ? "⚗️" : "✦"}
                </div>
                <span
                  className="mt-1 whitespace-nowrap rounded px-1.5 py-0.5 text-pixel-sm font-bold"
                  style={{
                    background: "rgba(13, 18, 35, .85)",
                    color: PALETTE.cream100,
                    border: "1px solid rgba(132, 75, 63, 1)",
                  }}
                >
                  {s.label}
                </span>
              </div>
            );
          })}

          {/* ── 디버그: 판정 원 ──────────────────────────────────────────────
              제작대는 초록, 출입구는 모래색. 충돌 박스와 같은 플래그로 켜야
              박스와 원의 어긋남을 한 장에서 볼 수 있다. */}
          {SHOW_COLLISION_DEBUG && [
            ...CRAFTING_STATIONS.map((s) => ({ ...s, tint: "moss500" as const })),
            { ...EXIT_ZONE, tint: "sand300" as const },
          ].map((z) => (
            <div
              key={`zone-${z.id}`}
              className="pointer-events-none absolute z-40 -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{
                left: `${z.x}%`,
                top:  `${z.y}%`,
                width:  `${z.radius * 2}%`,
                height: `${z.radius * 2}%`,
                background: withAlpha(z.tint, 0.28),
                border: `2px solid ${PALETTE[z.tint]}`,
              }}
            >
              <span
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-pixel-sm font-black"
                style={{ color: PALETTE[z.tint], textShadow: `0 1px 4px ${PALETTE.shadow900}` }}
              >
                {z.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 상호작용 안내 — 카메라가 움직여도 화면 하단에 고정돼야 하므로 스테이지 밖에 둔다.
          제작대든 출입구든 같은 컴포넌트를 쓴다. 문구만 다르다. */}
      {near && !activeStation && (
        <div className="pointer-events-none absolute bottom-14 left-1/2 z-30 -translate-x-1/2">
          <InteractionPrompt>
            {near.kind === "exit" ? near.def.label : `${near.def.label} 사용하기`}
          </InteractionPrompt>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          HUD — 화면 전체 기준 overlay (z-40)
          모든 버튼 / 타이틀 / 조작 안내는 여기에
          ══════════════════════════════════════════════════════════════════════ */}

      {/* 뒤로가기 */}
      <div className="absolute left-4 top-4 z-40">
        <button
          type="button"
          onClick={goToBaseCamp}
          style={{
            background: "rgba(13, 18, 35, .88)",
            border: "1px solid rgba(132, 75, 63, 1)",
            color: PALETTE.cream100,
          }}
          className="rounded-lg px-3 py-2 text-pixel-sm font-bold backdrop-blur transition hover:brightness-125"
        >
          ← 바깥으로
        </button>
      </div>

      {/* 타이틀 */}
      <div className="pointer-events-none absolute left-1/2 top-4 z-40 -translate-x-1/2 text-center">
        <p className="text-pixel-sm font-bold uppercase tracking-widest" style={{ color: PALETTE.earth500 }}>
          Workshop
        </p>
        <h1
          className="text-pixel-md font-black drop-shadow-lg"
          style={{ color: PALETTE.cream100, textShadow: "0 2px 8px rgba(13, 18, 35, .9)" }}
        >
          제작 공방
        </h1>
      </div>

      {/* 우상단 메뉴 버튼 */}
      <div className="absolute right-4 top-4 z-40">
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          style={{
            background: "rgba(13, 18, 35, .88)",
            border: "1px solid rgba(132, 75, 63, 1)",
            color: PALETTE.cream100,
          }}
          className="rounded-lg px-3 py-2 text-pixel-sm font-bold backdrop-blur transition hover:brightness-125"
        >
          ☰ 메뉴 (Tab)
        </button>
      </div>

      {menuOpen && (
        <WorkshopMenuModal
          onClose={() => setMenuOpen(false)}
          onGoToMonsters={() => navigate("/monsters")}
          onGoToFarm={() => navigate("/farm", { state: { from: "workshop" } })}
          onToggleCraftedPanel={() => {
            setShowCraftedPanel((v) => !v);
            setMenuOpen(false);
          }}
        />
      )}

      {/* 최근 제작 아이템 패널 */}
      {showCraftedPanel && (
        <div
          className="absolute right-4 top-16 z-40 w-56 rounded-xl p-4 backdrop-blur shadow-2xl"
          style={{
            background: "rgba(13, 18, 35, .95)",
            border: "1px solid rgba(132, 75, 63, 1)",
          }}
        >
          <p className="mb-3 text-pixel-sm font-bold uppercase tracking-widest" style={{ color: PALETTE.earth500 }}>
            최근 제작 아이템
          </p>
          {craftedItems.length === 0 ? (
            <p className="py-3 text-center text-pixel-sm" style={{ color: PALETTE.earth500 }}>
              아직 제작한 아이템이 없습니다.
            </p>
          ) : (
            <div className="grid max-h-80 gap-2 overflow-y-auto">
              {craftedItems.slice(0, 15).map((item) => (
                <div
                  key={item.id}
                  className="rounded-lg px-3 py-2"
                  style={{
                    background: "rgba(66, 61, 70, .088)",
                    border: `1px solid ${QUALITY_COLOR[item.quality]}44`,
                  }}
                >
                  <p className="text-pixel-sm font-black" style={{ color: PALETTE.cream100 }}>{item.name}</p>
                  <p className="mt-0.5 text-pixel-sm font-bold" style={{ color: QUALITY_COLOR[item.quality] }}>
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
        className="pointer-events-none absolute bottom-4 left-4 z-40 rounded-lg px-3 py-2 text-pixel-sm backdrop-blur"
        style={{
          background: "rgba(13, 18, 35, .75)",
          border: "1px solid rgba(205, 178, 126, .08)",
          color: PALETTE.earth500,
        }}
      >
        WASD / 방향키 이동 &nbsp;·&nbsp; SPACE 상호작용 &nbsp;·&nbsp; TAB 메뉴
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

// ─── 워크샵 메뉴(Tab) 모달 ───────────────────────────────────────────────────

function WorkshopMenuModal({
  onClose,
  onGoToMonsters,
  onGoToFarm,
  onToggleCraftedPanel,
}: {
  onClose: () => void;
  onGoToMonsters: () => void;
  onGoToFarm: () => void;
  onToggleCraftedPanel: () => void;
}) {
  const items = [
    { label: "내 몬스터", emoji: "👾", onClick: onGoToMonsters },
    { label: "가방",      emoji: "🎒", onClick: onGoToFarm },
    { label: "제작 목록", emoji: "📜", onClick: onToggleCraftedPanel },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-shadow-900/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm rounded-2xl p-6 shadow-2xl"
        style={{ background: "rgba(13, 18, 35, .97)", border: "1px solid rgba(132, 75, 63, 1)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-title-sm font-black" style={{ color: PALETTE.cream100 }}>메뉴</h2>
          <span className="text-pixel-sm" style={{ color: PALETTE.earth500 }}>ESC: 닫기</span>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          {items.map((it) => (
            <button
              key={it.label}
              type="button"
              onClick={it.onClick}
              className="flex flex-col items-center gap-1.5 rounded-xl py-4 text-pixel-sm font-semibold transition active:scale-95 hover:brightness-125"
              style={{
                background: "rgba(66, 61, 70, .088)",
                border: "1px solid rgba(132, 75, 63, .936)",
                color: PALETTE.cream100,
              }}
            >
              <span className="text-pixel-md">{it.emoji}</span>
              {it.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
