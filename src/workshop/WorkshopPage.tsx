import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CraftingModal } from "./CraftingModal";
import { AnvilModal } from "./AnvilModal";
import { usePlayerStore } from "../shared/playerStore";
import { QUALITY_COLOR, QUALITY_LABEL } from "../shared/craftingUtils";
import { PALETTE, withAlpha } from "../shared/palette";
import { InteractionPrompt } from "../shared/ui/InteractionPrompt";
import { GameMenu, type GameMenuItem } from "../shared/ui/GameMenu";
import { StageHud, StageRail } from "../shared/ui/StageHud";
import { ControlHint } from "../shared/ui/ControlHint";
import { containRect } from "../shared/ui/stageRect";
import { useBgm, BGM } from "../shared/audio";
import {
  getPlayerFrame, atlasFrameCell, PLAYER_ATLAS_PNG,
  PLAYER_ATLAS_COLS, PLAYER_ATLAS_ROWS, PLAYER_WALK_FRAMES, PLAYER_FOOT_ANCHOR,
  type Dir8,
} from "../shared/playerSprite";
import {
  WORKSHOP_BACKGROUND_IMAGE,
} from "../shared/assetPaths";
import {
  BG_RATIO, INITIAL_POS, PLAYER_BOUNDS, PLAYER_DISPLAY_RATIO, PLAYER_FOOT,
  COLLISION_BOXES, CRAFTING_STATIONS, EXIT_ZONE,
  SHOW_COLLISION_DEBUG, SHOW_INTERACTION_DEBUG,
  clamp, isPlayerBlocked, findInteractable,
  type Point, type StationDef, type WorkshopStationType,
} from "./workshopLayout";
import {
  isCollisionDebugOn, onCollisionDebugChange, bindCollisionDebugKey, DEBUG_LINE_CSS,
} from "../shared/collisionDebug";
import { PixelIcon } from "../shared/ui/PixelIcon";

// --- 타입 -------------------------------------------------------------

type Direction = "up" | "down" | "left" | "right";

/** stage 기준 % 좌표 (0~100). workshopLayout 의 Point 와 같다. */
type PlayerPos = Point;

// --- 이동 -------------------------------------------------------------

/** %/frame (16ms 기준). deltaTime 으로 보정한다 */
const SPEED = 0.4;

// --- 무대 -------------------------------------------------------------
// 공방은 화면 고정이다. 방 하나가 통째로 들어오고 화면은 안 움직인다.
// 걸어 다녀도 배경은 제자리다. 확대해서 따라다니던 때는 어느 방향으로 가든
// 벽이 눈앞에 있어서, 방이 몇 칸짜리인지 알 수 없었다.
//
// ⚠ 스테이지 내부 좌표계는 % 다. 스테이지는 화면에 맞춘 크기로 가운데 놓인다.

/**
 * 방향키 입력 → 8방향.
 *
 * 방향키는 네 방향뿐이라 대각은 여기서 안 나온다. 에셋은 8방향을 다 갖고 있으므로
 * (`playerSprite.ts`), 대각을 쓰려면 두 키 동시 입력을 읽는 쪽을 고치면 된다.
 */
function directionToDir8(dir: Direction): Dir8 {
  return dir === "up" ? "N" : dir === "down" ? "S" : dir === "left" ? "W" : "E";
}

// ─── WorkshopPage ─────────────────────────────────────────────────────────────

export default function WorkshopPage() {
  useBgm(BGM.workshop);

  const navigate = useNavigate();
  const craftedItems = usePlayerStore((s) => s.craftedItems);

  // ── 메뉴(Tab) 상태 ─────────────────────────────────────────────────────────
  const [menuOpen, setMenuOpen] = useState(false);
  const menuOpenRef = useRef(false);
  useEffect(() => { menuOpenRef.current = menuOpen; }, [menuOpen]);

  // ── 플레이어 상태 ─────────────────────────────────────────────────────────────
  const [pos, setPos]           = useState<PlayerPos>(INITIAL_POS);
  const [direction, setDirection] = useState<Direction>("down");
  const [walkFrame, setWalkFrame] = useState(0);

  const keysRef      = useRef(new Set<string>());
  const rafRef       = useRef<number | null>(null);
  const walkTimerRef = useRef(0);
  const lastTimeRef  = useRef<number | null>(null);
  const posRef       = useRef<PlayerPos>(INITIAL_POS);

  // ── 모달 상태 ────────────────────────────────────────────────────────────────
  const [activeStation, setActiveStation] = useState<WorkshopStationType | null>(null);
  const activeStationRef = useRef<WorkshopStationType | null>(null);
  useEffect(() => { activeStationRef.current = activeStation; }, [activeStation]);

  // ── 입력 잠금 ────────────────────────────────────────────────────────────────
  // Tab 메뉴든 제작 모달이든, 무언가 위에 떠 있으면 플레이어는 멈춘다.
  // 원래 RAF 루프가 menuOpenRef 만 봐서 제작 모달 뒤에서는 계속 걸어다녔다.
  // 두 경로를 하나로 합쳐 뒀다. 나중에 뜨는 창이 또 생겨도 여기만 보면 된다.
  const inputLocked = menuOpen || activeStation !== null;
  const inputLockedRef = useRef(inputLocked);
  useEffect(() => { inputLockedRef.current = inputLocked; }, [inputLocked]);

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

  // ── 충돌 박스 표시 (개발자 모드 전용, F9 토글) ────────────────────────────────
  // SHOW_COLLISION_DEBUG 는 개발자 모드 없이 강제로 켜는 스위치다.
  const [debugOn, setDebugOn] = useState(isCollisionDebugOn);
  useEffect(() => {
    const unbind = bindCollisionDebugKey();
    const unsubscribe = onCollisionDebugChange(() => setDebugOn(isCollisionDebugOn()));
    return () => { unbind(); unsubscribe(); };
  }, []);
  const showCollision = SHOW_COLLISION_DEBUG || debugOn;

  // 잠긴 동안에는 서 있는 자세로 그린다. walkFrame 상태를 effect 로 되돌리지 않고
  // 그릴 때 정하는 이유는, 모달을 닫는 순간 한 프레임 걷는 자세가 스치는 걸 막기 위해서다.
  const playerFrame = getPlayerFrame(directionToDir8(direction), inputLocked ? 0 : walkFrame);
  const playerCell = atlasFrameCell(playerFrame.source);

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

  // 비율을 지킨 채 화면에 꽉 채우고, 남는 쪽 여백만큼 가운데로 민다.
  // HUD 도 같은 칸을 봐야 해서 계산은 stageRect 한 곳에 있다.
  const stage = containRect(viewport.w, viewport.h, BG_RATIO);
  const { width: stageW, height: stageH, left: offsetX, top: offsetY } = stage;

  // 플레이어도 무대에 맞춰 커지고 작아진다. 고정 px 이면 창을 줄였을 때
  // 방만 작아지고 사람은 그대로라 통·침대와 견준 키가 어긋난다.
  const playerDisplay = stageH * PLAYER_DISPLAY_RATIO;

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
  }, []); // deps 없음. ref 로 최신값 접근

  // ── RAF 이동 루프 ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const tick = (now: number) => {
      const dt = lastTimeRef.current !== null
        ? Math.min(now - lastTimeRef.current, 50)
        : 16;
      lastTimeRef.current = now;

      if (inputLockedRef.current) {
        // 눌려 있던 키를 비운다. 방향키를 누른 채 모달을 열면 그 사이의 keyup 을
        // 놓칠 수 있고, 그러면 닫는 순간 유령 입력으로 플레이어가 미끄러진다.
        keysRef.current.clear();
        walkTimerRef.current = 0;
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

          // X축 단독 검사 / Y축 단독 검사. 항상 원래 prev 기준으로 봐야
          // 대각선으로 갈 때 박스 모서리를 파고들어 갇히는 걸 막는다
          const collideX = isPlayerBlocked({ x: nx, y: prev.y });
          const collideY = isPlayerBlocked({ x: prev.x, y: ny });
          if (!collideX) rx = nx;
          if (!collideY) ry = ny;

          // 대각선 이동: 각 축은 개별적으로 안전해 보여도 합쳐진 목적지가
          // 박스 내부라면(모서리 통과) 이동 자체를 취소한다. 박스 안에 끼는 걸 막는다
          if (!collideX && !collideY && isPlayerBlocked({ x: nx, y: ny })) {
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
        if (walkTimerRef.current >= 130) {
          setWalkFrame((f) => (f % PLAYER_WALK_FRAMES) + 1);
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

  const menuItems: GameMenuItem[] = [
    { label: "내 몬스터", icon: "monsters", tone: "info",   onClick: () => navigate("/monsters") },
    { label: "가방",      icon: "bag", tone: "accent", onClick: () => navigate("/farm", { state: { from: "workshop" } }) },
    {
      label: "제작 목록",
      icon: "quest",
      onClick: () => { setShowCraftedPanel((v) => !v); setMenuOpen(false); },
    },
  ];

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-shadow-900">

      {/* ══════════════════════════════════════════════════════════════════════
          레이어 1. 흐림 배경 (여백을 자연스럽게 채우고 이미지가 안 깨지게)
          ══════════════════════════════════════════════════════════════════════ */}
      <img
        src={WORKSHOP_BACKGROUND_IMAGE}
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
          레이어 2. 비네팅 오버레이
          ══════════════════════════════════════════════════════════════════════ */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-shadow-900/35 via-transparent to-shadow-900/45" />

      {/* ══════════════════════════════════════════════════════════════════════
          레이어 3. 게임 스테이지 (원본 비율 2400:1792 고정, 화면 가운데 붙박이)
          ══════════════════════════════════════════════════════════════════════ */}
      <div className="absolute inset-0 overflow-hidden">
        <div
          className="absolute left-0 top-0 overflow-hidden"
          onMouseMove={handleStageMouseMove}
          onMouseLeave={handleStageMouseLeave}
          style={{
            width:  stageW,
            height: stageH,
            // 창 크기가 바뀔 때만 움직인다. 걸어 다니는 동안은 제자리다.
            transform: `translate(${offsetX}px, ${offsetY}px)`,
            cursor: SHOW_INTERACTION_DEBUG ? "crosshair" : "default",
          }}
        >
          {/* 배경 이미지. 스테이지가 이미 BG_RATIO 와 같은 비율이라 contain으로도 꽉 찬다.
              contain 이어야 한다. fill 은 비율을 무시해 늘리므로 좌표계가 어긋난다. */}
          <img
            src={WORKSHOP_BACKGROUND_IMAGE}
            alt="제작 공방"
            draggable={false}
            className="pointer-events-none absolute inset-0 h-full w-full"
            style={{ objectFit: "contain" }}
          />

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
              // 발밑이 좌표 기준점이 되게 위로 올린다. 프레임 안에서 발끝이 어디인지는
              // 시트가 정하니까 여기 백분율을 손으로 적지 마라. 64px 시절 90% 를
              // 그대로 뒀더니 발이 판정보다 17px 아래에 붙어 있었다.
              transform: `translate(-50%, ${-PLAYER_FOOT_ANCHOR * 100}%)`,
            }}
          >
            {/* 발밑 그림자 */}
            <div
              className="absolute rounded-full"
              style={{
                bottom: 2,
                left: "50%",
                transform: "translateX(-50%)",
                width: playerDisplay * 0.55,
                height: 7,
                background: "rgba(13, 18, 35, .45)",
                filter: "blur(5px)",
              }}
            />
            {/* 아틀라스 한 칸을 배경으로 잘라 쓴다. <img src> 로는 시트에서 한 칸만
                떼어낼 수 없다. 프레임마다 파일을 나누면 아틀라스를 쓰는 뜻이 없다. */}
            <div
              role="img"
              aria-label="player"
              data-frame={playerFrame.source}
              className="pixel-img"
              style={{
                transform: playerFrame.flipX ? "scaleX(-1)" : undefined,
                width:  playerDisplay,
                height: playerDisplay,
                backgroundImage: `url(${PLAYER_ATLAS_PNG})`,
                backgroundSize: `${playerDisplay * PLAYER_ATLAS_COLS}px ${playerDisplay * PLAYER_ATLAS_ROWS}px`,
                backgroundPosition: `${-playerCell.col * playerDisplay}px ${-playerCell.row * playerDisplay}px`,
                backgroundRepeat: "no-repeat",
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
              {/* 좌표 말풍선. 커서 우하단에 표시 */}
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

          {/* ── 디버그: 충돌 박스 (개발자 모드 · F9 로 토글) ───────────────── */}
          {showCollision && COLLISION_BOXES.map((box) => (
            <div
              key={box.id}
              className="pointer-events-none absolute z-40 text-pixel-sm font-bold"
              style={{
                left:   `${box.x}%`,
                top:    `${box.y}%`,
                width:  `${box.width}%`,
                height: `${box.height}%`,
                border: `2px solid ${DEBUG_LINE_CSS}`,
                background: "rgba(255, 0, 0, .12)", // palette-ok: 개발용 판정 박스
                color: DEBUG_LINE_CSS,
              }}
            >
              {/* 세로 줄은 폭이 1% 라 이름이 글자마다 줄바꿈된다. 줄 밖으로 흘려 쓴다 */}
              <span
                className="whitespace-nowrap px-0.5"
                style={{ textShadow: `0 1px 2px ${PALETTE.shadow900}` }}
              >
                {box.id}
              </span>
            </div>
          ))}

          {/* 플레이어 발밑 판정 상자 — 박스와 같은 색이어야 어디서 걸리는지 보인다 */}
          {showCollision && (
            <div
              className="pointer-events-none absolute z-40"
              style={{
                left:   `${pos.x - PLAYER_FOOT.halfW}%`,
                top:    `${pos.y - PLAYER_FOOT.halfH}%`,
                width:  `${PLAYER_FOOT.halfW * 2}%`,
                height: `${PLAYER_FOOT.halfH * 2}%`,
                border: `2px solid ${DEBUG_LINE_CSS}`,
              }}
            />
          )}

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
                  <PixelIcon name={s.type === "anvil" ? "anvil" : s.type === "potion" ? "alchemy" : "artifact"} size={32} />
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
          {showCollision && [
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

      {/* ══════════════════════════════════════════════════════════════════════
          HUD (z-40)
          배경 비율(2400:1792)이 창 비율과 달라 둘레에 어두운 띠가 남는다. 늘 떠 있는
          것(뒤로가기·메뉴·최근 제작·조작 안내)은 그 띠로 내보내고(StageRail),
          장면에 붙어 읽혀야 하는 것(타이틀·상호작용 안내)만 그림 위에 남긴다.
          ══════════════════════════════════════════════════════════════════════ */}
      <StageHud rect={stage}>
        {/* 상호작용 안내 — 걸어 다니는 동안 자리가 흔들리면 안 되니 스테이지 좌표가 아니라
            그림 하단에 붙인다. 제작대든 출입구든 같은 컴포넌트를 쓴다. 문구만 다르다. */}
        {near && !activeStation && (
          <div className="pointer-events-none absolute bottom-14 left-1/2 z-30 -translate-x-1/2">
            <InteractionPrompt>
              {near.kind === "exit" ? near.def.label : `${near.def.label} 사용하기`}
            </InteractionPrompt>
          </div>
        )}

        {/* 타이틀 */}
        <div className="pointer-events-none absolute left-1/2 top-gutter z-40 -translate-x-1/2 text-center">
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
      </StageHud>

      {/* 늘 떠 있는 것들은 그림 옆 어두운 띠로 내보낸다. 띠 폭은 창 비율이 정하므로
          패널 폭도 거기 맞춘다 — 폭을 박으면 좁은 화면에서 그림을 파고든다. */}
      <StageRail stage={stage} viewportW={viewport.w} side="left">
        {/* 뒤로가기 */}
        <button
          type="button"
          onClick={goToBaseCamp}
          className="pointer-events-auto shrink-0 rounded-lg border border-earth-500 bg-shadow-900/88
            px-3 py-2 text-pixel-sm font-bold text-cream-100 backdrop-blur transition
            hover:brightness-125"
        >
          ← 바깥으로
        </button>

        <div className="pointer-events-none mt-auto">
          <ControlHint
            items={[
              { keys: "WASD / 방향키", action: "이동" },
              { keys: "SPACE", action: "상호작용" },
              { keys: "TAB", action: "메뉴" },
            ]}
          />
        </div>
      </StageRail>

      <StageRail stage={stage} viewportW={viewport.w} side="right">
        {/* 메뉴 — 버튼 아래로 펼쳐진다 */}
        <GameMenu
          open={menuOpen}
          onOpen={() => setMenuOpen(true)}
          onClose={() => setMenuOpen(false)}
          items={menuItems}
        />

        {/* 최근 제작 아이템. 메뉴 아래로 이어 붙는다 — 폭은 띠가 정한다 */}
        {showCraftedPanel && (
          <div
            className="pointer-events-auto min-h-0 overflow-hidden rounded-xl border border-earth-500
              bg-shadow-900/95 p-panel shadow-2xl backdrop-blur"
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
      </StageRail>

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
