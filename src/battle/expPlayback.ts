import { useCallback, useEffect, useRef, useState } from "react";
import { buildExpTimeline, type StatGains } from "./expTimeline";
import type { BattleMonster } from "./battleUtils";
import { useBattleSettings, logSpeedMs } from "../shared/battleSettings";

/**
 * 경험치가 들어오는 순간을 화면에서 돌리는 쪽.
 *
 * 순서표는 expTimeline 이 만들고 여기서는 그걸 시간에 얹기만 한다. 재생 상태를 훅이
 * 들고 있는 건 보는 곳이 둘이라서다. 하단 상태 줄의 경험치 바(항상 보임)랑 레벨업
 * 카드(레벨이 올랐을 때만). 둘이 각자 타이머를 돌리면 같은 순간에 다른 값을 보여준다.
 *
 *
 * 반복 플레이를 막지 않는 게 조건이라 셋을 지킨다.
 *  - 자동 진행이 켜져 있으면 레벨업 카드도 알아서 넘어간다(로그와 같은 속도 설정을 본다)
 *  - 수동이면 Q·Enter·클릭으로 한 장씩
 *  - Space 는 통째로 건너뛴다 (씬의 연출 스킵과 같은 키)
 */

const ADVANCE_CODES = ["KeyQ", "Enter", "NumpadEnter"];
const SKIP_CODES = ["Space", "Escape"];

/**
 * 바 한 칸이 차는 데 걸리는 시간. 즉시 점프하면 "얼마나 들어왔는지"가 안 읽히고,
 * 로그 속도(느림 1.4초)에 묶어 두면 잡몹 한 마리에 그만큼을 기다리게 된다.
 */
export const EXP_FILL_MS = 500;

export interface ExpPlaybackView {
  /** 경험치를 받는 몬스터 */
  name: string;
  gained: number;
  /** 지금 바가 그리고 있는 레벨 */
  level: number;
  /** 바의 채움 비율 (0~1) */
  ratio: number;
  /** 지금 레벨의 요구 경험치. 바 옆의 분모다 */
  expToNext: number;
  /** 레벨업 카드. 이게 떠 있는 동안은 사람을 기다린다 */
  card: { level: number; gains: StatGains } | null;
  /** 바가 이 시간에 걸쳐 차야 한다(ms). 움직임 줄이기가 켜져 있으면 0 */
  fillMs: number;
}

export interface ExpPlayback {
  /** 재생 중이거나, 재생이 끝나고 마지막 값을 들고 있는 상태 */
  view: ExpPlaybackView | null;
  /** 경험치를 먹이고 연출이 끝날 때까지 기다린다 */
  play: (before: BattleMonster, gained: number) => Promise<void>;
  /** 한 칸 넘기기 (클릭용) */
  advance: () => void;
}

export function useExpPlayback(onLevelUp?: (level: number) => void): ExpPlayback {
  const [view, setView] = useState<ExpPlaybackView | null>(null);

  // 진행을 깨우는 손잡이들. 렌더와 무관하게 프로미스만 건드린다.
  const advanceRef = useRef<(() => void) | null>(null);
  const skipRef = useRef(false);
  const cancelledRef = useRef(false);
  const levelUpRef = useRef(onLevelUp);
  useEffect(() => { levelUpRef.current = onLevelUp; }, [onLevelUp]);

  // 마운트 때 되돌려 놓는다. StrictMode 가 붙였다 떼고 다시 붙이니까, 정리만 해 두면
  // 첫 렌더 직후 영영 "취소됨"으로 굳어 연출이 통째로 안 돈다.
  useEffect(() => {
    cancelledRef.current = false;
    return () => { cancelledRef.current = true; advanceRef.current?.(); };
  }, []);

  const advance = useCallback(() => advanceRef.current?.(), []);
  const skip = useCallback(() => { skipRef.current = true; advanceRef.current?.(); }, []);

  // 키는 재생 중에만 듣는다. 전투 내내 걸어 두면 Q 가 로그 넘기기와 겹친다.
  const running = view !== null;
  useEffect(() => {
    if (!running) return;
    const onKey = (e: KeyboardEvent) => {
      if (SKIP_CODES.includes(e.code)) { e.preventDefault(); skip(); return; }
      if (ADVANCE_CODES.includes(e.code)) { e.preventDefault(); advance(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [running, advance, skip]);

  const play = useCallback((before: BattleMonster, gained: number): Promise<void> => {
    const { segments } = buildExpTimeline(before, gained);
    if (cancelledRef.current || segments.length === 0) return Promise.resolve();

    // 움직임을 줄여 달라고 한 사람에게는 차오름 없이 최종값만 준다. 레벨업 카드는
    // 움직임이 아니라 읽을 거리라 그대로 남긴다.
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const fillMs = reduceMotion ? 0 : EXP_FILL_MS;
    skipRef.current = false;

    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        if (ms <= 0 || skipRef.current) return resolve();
        const timer = setTimeout(() => { advanceRef.current = null; resolve(); }, ms);
        advanceRef.current = () => { clearTimeout(timer); advanceRef.current = null; resolve(); };
      });

    /** 레벨업 카드 앞에서 멈추는 자리. 자동이면 로그 속도만큼, 수동이면 입력까지. */
    const hold = () =>
      new Promise<void>((resolve) => {
        if (skipRef.current) return resolve();
        const { autoAdvance, logSpeed } = useBattleSettings.getState();
        let timer: ReturnType<typeof setTimeout> | undefined;
        advanceRef.current = () => { clearTimeout(timer); advanceRef.current = null; resolve(); };
        if (autoAdvance) timer = setTimeout(() => advanceRef.current?.(), logSpeedMs(logSpeed));
      });

    return (async () => {
      for (const seg of segments) {
        if (cancelledRef.current) return;
        setView({
          name: before.name, gained, level: seg.level,
          ratio: seg.from, expToNext: seg.expToNext, card: null, fillMs,
        });
        // 트랜지션이 걸리려면 시작값이 한 번 그려져야 한다
        if (fillMs > 0) await wait(30);
        if (cancelledRef.current) return;

        setView((v) => (v ? { ...v, ratio: seg.to } : v));
        await wait(fillMs);
        if (cancelledRef.current) return;

        const up = seg.levelUp;
        if (up) {
          levelUpRef.current?.(up.level);
          // 레벨 숫자는 바가 0 으로 돌아갈 때 같이 오른다. 카드가 떠 있는 동안은
          // 아직 이전 레벨의 바가 가득 찬 그림이라, 여기서 올리면 "Lv.6 인데 116/116" 이 된다.
          setView((v) => (v ? { ...v, card: up } : v));
          await hold();
          if (cancelledRef.current) return;
          // 다음 칸은 0 에서 다시 시작한다. 되돌아가는 게 보이면 안 되므로 애니메이션 없이.
          setView((v) => (v ? { ...v, level: up.level, card: null, ratio: 0, fillMs: 0 } : v));
          await wait(30);
          setView((v) => (v ? { ...v, fillMs } : v));
        }
      }
      advanceRef.current = null;
      // 마지막 값을 그대로 들고 있는다. 여기서 비우면 아직 갱신 안 된 전투 상태로
      // 바가 되돌아갔다가 다시 차는 게 보인다.
    })();
  }, []);

  return { view, play, advance };
}
