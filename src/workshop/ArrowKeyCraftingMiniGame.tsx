import { useCallback, useEffect, useRef, useState } from "react";

// ─── 타입 ─────────────────────────────────────────────────────────────────────

export type DirectionInput = "up" | "down" | "left" | "right";

export interface ArrowMiniGameResult {
  totalStages: number;
  successCount: number;
  failCount: number;
  timeoutCount: number;
  wrongInputCount: number;
  accuracy: number;
  rating: "perfect" | "great" | "good" | "bad";
}

interface Props {
  recipeName: string;
  onComplete: (result: ArrowMiniGameResult) => void;
}

// ─── 상수 ─────────────────────────────────────────────────────────────────────

const TOTAL_STAGES = 5;

// 각 스테이지에서 입력해야 하는 방향키 수 (난이도 상승)
const STAGE_KEY_COUNTS = [5, 7, 9, 11, 13] as const;

// 스테이지별 총 제한 시간 (ms) — 키당 약 1100ms 기준
const STAGE_TIME_LIMITS = [6_000, 8_000, 10_500, 13_000, 15_500] as const;

// 전체 스테이지의 총 키 입력 수 — 등급은 스테이지 클리어 여부가 아니라
// 이 값을 기준으로 한 "틀린 키 개수"로 결정된다
export const TOTAL_KEYS = STAGE_KEY_COUNTS.reduce((a, b) => a + b, 0);

// 틀린 키 개수에 따른 등급 경계값 (전체 키 수의 비율 기반이라 STAGE_KEY_COUNTS가
// 바뀌어도 자동으로 맞춰짐)
export const GREAT_MAX_WRONG = Math.ceil(TOTAL_KEYS * 0.1);
export const GOOD_MAX_WRONG  = Math.ceil(TOTAL_KEYS * 0.25);

const FEEDBACK_MS = 520;

const DIRECTIONS: DirectionInput[] = ["up", "down", "left", "right"];

const DIRECTION_LABELS: Record<DirectionInput, string> = {
  up: "↑",
  down: "↓",
  left: "←",
  right: "→",
};

const KEY_TO_DIRECTION: Record<string, DirectionInput> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
};

// ─── 헬퍼 ─────────────────────────────────────────────────────────────────────

function makeAllStages(): DirectionInput[][] {
  return STAGE_KEY_COUNTS.map((count) =>
    Array.from({ length: count }, () => DIRECTIONS[Math.floor(Math.random() * 4)]),
  );
}

function calcRating(wrongCount: number): ArrowMiniGameResult["rating"] {
  if (wrongCount === 0) return "perfect";
  if (wrongCount <= GREAT_MAX_WRONG) return "great";
  if (wrongCount <= GOOD_MAX_WRONG) return "good";
  return "bad";
}

// ─── 팔레트 ───────────────────────────────────────────────────────────────────

const C = {
  bg:          "#160c04",
  card:        "#2a1508",
  border:      "rgba(180,120,30,0.45)",
  borderGold:  "rgba(212,160,23,0.8)",
  textPrimary: "#f5e6c8",
  textMuted:   "#c4a46b",
  textFaint:   "#8b6014",
  gold:        "#d4a017",
  goldDim:     "#b47828",
  green:       "#4ade80",
  red:         "#f87171",
  yellow:      "#facc15",
};

const RATING_LABEL: Record<ArrowMiniGameResult["rating"], string> = {
  perfect: "완벽한 솜씨!",
  great:   "훌륭한 솜씨!",
  good:    "무난한 솜씨",
  bad:     "아쉬운 솜씨",
};

const RATING_COLOR: Record<ArrowMiniGameResult["rating"], string> = {
  perfect: C.gold,
  great:   C.green,
  good:    C.yellow,
  bad:     C.red,
};

// ─── 페이즈 타입 ──────────────────────────────────────────────────────────────

type Phase = "playing" | "stage-success" | "stage-fail" | "done";

// ─── 컴포넌트 ─────────────────────────────────────────────────────────────────

export function ArrowKeyCraftingMiniGame({ recipeName, onComplete }: Props) {
  // stages[i] = i번 스테이지의 방향키 배열
  const [stages] = useState<DirectionInput[][]>(makeAllStages);

  const [stage, setStage]           = useState(0);
  const [keyIndex, setKeyIndex]     = useState(0); // 현재 스테이지 내 입력 위치
  const [phase, setPhase]           = useState<Phase>("playing");
  const [timeProgress, setTimeProgress] = useState(1.0);

  // 스테이지 결과 이력 ("s"=성공, "f"=실패)
  const [history, setHistory] = useState<Array<"s" | "f">>([]);

  // 현재 스테이지의 키별 결과 — 틀려도 끝까지 진행하므로 각 키의 정오답을 개별 표시
  const [keyResults, setKeyResults] = useState<Array<"pending" | "ok" | "miss">>(
    () => Array(stages[0].length).fill("pending"),
  );

  // 클로저에서 최신값 읽기 위한 refs
  const stageRef      = useRef(0);
  const keyIndexRef   = useRef(0);
  const phaseRef      = useRef<Phase>("playing");
  const stageStartRef = useRef(Date.now());
  const successRef    = useRef(0);
  const failRef       = useRef(0);
  const timeoutRef    = useRef(0);
  const wrongRef      = useRef(0);
  const stageMissRef  = useRef(0); // 현재 스테이지에서 틀린 횟수 (0이어야 스테이지 "성공")
  const stagesRef     = useRef(stages);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // 언마운트 시 대기 중인 피드백 타이머 정리 (모달을 닫아도 콜백이 뒤늦게 실행되는 것 방지)
  useEffect(() => () => clearTimeout(feedbackTimerRef.current), []);

  // ─── 스테이지 완료 처리 ────────────────────────────────────────────────────
  const advanceStage = useCallback((ok: boolean) => {
    setPhase(ok ? "stage-success" : "stage-fail");
    phaseRef.current = ok ? "stage-success" : "stage-fail";
    setHistory((prev) => [...prev, ok ? "s" : "f"]);

    feedbackTimerRef.current = setTimeout(() => {
      const next = stageRef.current + 1;
      if (next >= TOTAL_STAGES) {
        setPhase("done");
        phaseRef.current = "done";
        const rating = calcRating(wrongRef.current);
        onCompleteRef.current({
          totalStages:     TOTAL_STAGES,
          successCount:    successRef.current,
          failCount:       failRef.current,
          timeoutCount:    timeoutRef.current,
          wrongInputCount: wrongRef.current,
          accuracy:        Math.max(0, 1 - wrongRef.current / TOTAL_KEYS),
          rating,
        });
      } else {
        stageRef.current    = next;
        keyIndexRef.current = 0;
        stageMissRef.current = 0;
        setStage(next);
        setKeyIndex(0);
        setKeyResults(Array(stagesRef.current[next].length).fill("pending"));
        stageStartRef.current = Date.now();
        setTimeProgress(1.0);
        setPhase("playing");
        phaseRef.current = "playing";
      }
    }, FEEDBACK_MS);
  }, []);

  // ─── 타이머 ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => {
      if (phaseRef.current !== "playing") return;
      const elapsed  = Date.now() - stageStartRef.current;
      const limit    = STAGE_TIME_LIMITS[stageRef.current];
      const progress = Math.max(0, 1 - elapsed / limit);
      setTimeProgress(progress);
      if (progress <= 0) {
        // 시간 초과 → 남은 입력은 전부 틀린 것으로 처리하고 스테이지 종료
        // (틀려도 끝까지 진행하는 원칙과 동일하게, 시간이 다한 스테이지도 건너뛰지 않고
        //  남은 키를 모두 실패로 집계한 뒤 다음 스테이지로 넘어간다)
        const stageKeys = stagesRef.current[stageRef.current];
        const remaining = stageKeys.length - keyIndexRef.current;
        wrongRef.current += remaining;
        stageMissRef.current += remaining;
        timeoutRef.current++;
        failRef.current++;
        setKeyResults((prev) => {
          const nextResults = [...prev];
          for (let i = keyIndexRef.current; i < stageKeys.length; i++) nextResults[i] = "miss";
          return nextResults;
        });
        advanceStage(false);
      }
    }, 40);
    return () => clearInterval(id);
  }, [advanceStage]);

  // ─── 키 입력 ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (phaseRef.current !== "playing") return;
      const dir = KEY_TO_DIRECTION[e.key];
      if (!dir) return;

      e.preventDefault();
      e.stopImmediatePropagation();

      const stageKeys = stagesRef.current[stageRef.current];
      const target    = stageKeys[keyIndexRef.current];
      const correct   = dir === target;
      const idx        = keyIndexRef.current;

      if (!correct) {
        wrongRef.current++;
        stageMissRef.current++;
      }
      setKeyResults((prev) => {
        const nextResults = [...prev];
        nextResults[idx] = correct ? "ok" : "miss";
        return nextResults;
      });

      // 틀려도 스테이지를 끝내지 않고 남은 키를 계속 입력받는다
      const nextIdx = idx + 1;
      if (nextIdx >= stageKeys.length) {
        // 이 스테이지의 모든 키 입력 완료 — 틀린 키가 하나도 없어야 "성공"
        const stageOk = stageMissRef.current === 0;
        if (stageOk) successRef.current++; else failRef.current++;
        advanceStage(stageOk);
      } else {
        keyIndexRef.current = nextIdx;
        setKeyIndex(nextIdx);
      }
    };

    window.addEventListener("keydown", handleKey, { capture: true });
    return () => window.removeEventListener("keydown", handleKey, { capture: true });
  }, [advanceStage]);

  // ─── 완료 화면 ─────────────────────────────────────────────────────────────
  if (phase === "done") {
    const rating      = calcRating(wrongRef.current);
    const ratingColor = RATING_COLOR[rating];
    return (
      <div
        className="rounded-xl p-5"
        style={{ background: C.bg, border: `1px solid ${C.border}` }}
      >
        <p
          className="text-[10px] font-bold uppercase tracking-widest text-center"
          style={{ color: C.goldDim }}
        >
          ✦ 제작 완료 ✦
        </p>
        <p className="mt-2 text-center text-lg font-black" style={{ color: ratingColor }}>
          {RATING_LABEL[rating]}
        </p>
        <p className="mt-1 text-center text-xs" style={{ color: C.textFaint }}>
          전체 {TOTAL_KEYS}키 중 틀린 키 {wrongRef.current}개 &nbsp;·&nbsp; 스테이지 완전성공 {successRef.current}/{TOTAL_STAGES}
        </p>
        <p className="mt-3 text-center text-xs animate-pulse" style={{ color: C.textFaint }}>
          품질을 결정하는 중...
        </p>
      </div>
    );
  }

  // ─── 게임 화면 변수 ────────────────────────────────────────────────────────
  const isSuccess   = phase === "stage-success";
  const isFail      = phase === "stage-fail";
  const isFeedback  = isSuccess || isFail;

  const stageKeys   = stages[stage];
  const totalKeys   = stageKeys.length;
  const currentKey  = stageKeys[Math.min(keyIndex, totalKeys - 1)];

  // 큰 화살표 색상
  const arrowBg = isFeedback
    ? isSuccess ? "rgba(74,222,128,0.18)" : "rgba(248,113,113,0.18)"
    : "rgba(180,120,30,0.12)";
  const arrowBorder = isFeedback
    ? isSuccess ? C.green : C.red
    : C.borderGold;
  const arrowColor = isFeedback
    ? isSuccess ? C.green : C.red
    : C.textPrimary;
  const arrowShadow = isFeedback
    ? isSuccess
      ? "0 0 36px rgba(74,222,128,0.4)"
      : "0 0 36px rgba(248,113,113,0.4)"
    : "0 0 24px rgba(212,160,23,0.18)";

  // 피드백 중 큰 심볼
  const bigSymbol = isFeedback
    ? isSuccess ? "✓" : "✗"
    : DIRECTION_LABELS[currentKey];

  return (
    <div
      className="rounded-xl p-4"
      style={{ background: C.bg, border: `1px solid ${C.border}` }}
    >
      {/* 헤더 */}
      <div className="mb-3">
        <p
          className="text-[10px] font-bold uppercase tracking-widest"
          style={{ color: C.goldDim }}
        >
          ✦ 제작 시험 ✦
        </p>
        <p className="mt-0.5 text-sm font-bold" style={{ color: C.textPrimary }}>
          <span style={{ color: C.gold }}>{recipeName}</span> 품질 결정
        </p>
      </div>

      {/* 스테이지 진행 점 */}
      <div className="mb-3 flex justify-center gap-2">
        {Array.from({ length: TOTAL_STAGES }, (_, i) => {
          const done   = i < history.length;
          const active = i === stage;
          const res    = history[i];
          return (
            <div
              key={i}
              className="flex h-7 w-7 flex-col items-center justify-center rounded-full text-xs font-black"
              style={{
                background: done
                  ? res === "s" ? "rgba(74,222,128,0.2)" : "rgba(248,113,113,0.2)"
                  : active
                    ? "rgba(212,160,23,0.25)"
                    : "rgba(255,255,255,0.05)",
                border: `1px solid ${
                  done
                    ? res === "s" ? "rgba(74,222,128,0.55)" : "rgba(248,113,113,0.55)"
                    : active
                      ? C.borderGold
                      : "rgba(255,255,255,0.1)"
                }`,
                color: done
                  ? res === "s" ? C.green : C.red
                  : active ? C.gold : C.textFaint,
              }}
            >
              {done ? (res === "s" ? "✓" : "✗") : i + 1}
            </div>
          );
        })}
      </div>

      {/* 스테이지 정보 */}
      <p className="mb-2 text-center text-[11px]" style={{ color: C.textFaint }}>
        스테이지 {stage + 1} &nbsp;·&nbsp;
        <span style={{ color: C.textMuted }}>방향키 {totalKeys}개</span>
      </p>

      {/* 타이머 바 */}
      <div
        className="mb-3 h-2 overflow-hidden rounded-full"
        style={{ background: "rgba(255,255,255,0.07)" }}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${timeProgress * 100}%`,
            background:
              timeProgress > 0.5 ? C.gold : timeProgress > 0.25 ? "#f59e0b" : "#ef4444",
            transition: "background 0.3s",
          }}
        />
      </div>

      {/* 키 시퀀스 스트립 — 틀린 키도 건너뛰지 않고 ✗로 표시하며 계속 진행 */}
      <div className="mb-3 flex flex-wrap justify-center gap-1">
        {stageKeys.map((key, idx) => {
          const result  = keyResults[idx] ?? "pending";
          const done    = result !== "pending";
          const isMiss  = result === "miss";
          const active  = idx === keyIndex && !isFeedback && !done;
          const pending = !done && !active;

          return (
            <div
              key={idx}
              className="flex items-center justify-center rounded font-black select-none"
              style={{
                width:      active ? 30 : 24,
                height:     active ? 30 : 24,
                fontSize:   active ? 17 : 13,
                flexShrink: 0,
                background: done
                  ? isMiss ? "rgba(248,113,113,0.15)" : "rgba(74,222,128,0.15)"
                  : active
                    ? "rgba(212,160,23,0.25)"
                    : "rgba(255,255,255,0.04)",
                border: `1px solid ${
                  done
                    ? isMiss ? "rgba(248,113,113,0.5)" : "rgba(74,222,128,0.5)"
                    : active
                      ? C.borderGold
                      : "rgba(255,255,255,0.08)"
                }`,
                color: done
                  ? isMiss ? C.red : C.green
                  : active
                    ? C.gold
                    : pending
                      ? C.textFaint
                      : C.textMuted,
                opacity: isFeedback ? (isSuccess ? 0.6 : 0.4) : 1,
                boxShadow: active ? `0 0 10px rgba(212,160,23,0.3)` : "none",
                transition: "all 0.12s",
              }}
            >
              {done ? (isMiss ? "✗" : "✓") : DIRECTION_LABELS[key]}
            </div>
          );
        })}
      </div>

      {/* 큰 화살표 / 피드백 심볼 */}
      <div className="flex items-center justify-center" style={{ height: 96 }}>
        <div
          className="flex items-center justify-center rounded-2xl select-none"
          style={{
            width:      88,
            height:     88,
            fontSize:   isFeedback ? 44 : 52,
            fontWeight: 900,
            background: arrowBg,
            border:     `2px solid ${arrowBorder}`,
            color:      arrowColor,
            boxShadow:  arrowShadow,
            transition: "border-color 0.15s, color 0.15s, background 0.15s, box-shadow 0.15s",
          }}
        >
          {bigSymbol}
        </div>
      </div>

      {/* 입력 진행 / 피드백 텍스트 */}
      <div className="mt-2 h-5 text-center">
        {isFeedback ? (
          <p
            className="text-sm font-black"
            style={{ color: isSuccess ? C.green : C.red }}
          >
            {isSuccess ? "✦ 스테이지 성공!" : "✗ 스테이지 실패"}
          </p>
        ) : (
          <p className="text-xs" style={{ color: C.textFaint }}>
            {keyIndex} / {totalKeys} 입력 완료
          </p>
        )}
      </div>

      {/* 하단 안내 */}
      <p className="mt-2 text-center text-[10px]" style={{ color: C.textFaint }}>
        틀려도 끝까지 진행되며, 틀린 키 개수로 품질이 결정됩니다
      </p>
    </div>
  );
}
