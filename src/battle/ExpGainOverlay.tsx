import { useEffect, useRef, useState } from "react";
import type { ExpSegment, StatGains } from "./expTimeline";
import { useBattleSettings, logSpeedMs } from "../shared/battleSettings";
import { StatBar } from "../shared/ui";

/**
 * 승리 직후의 경험치 연출.
 *
 * 예전엔 "경험치 42를 획득했다!" 로그 한 줄이 전부였다. 성장은 이 게임의 축인데
 * 플레이어가 그걸 **본 적이 없으면** 다음 전투를 할 이유가 생기지 않는다.
 *
 * 반복 플레이를 막지 않는 게 조건이라 셋을 지킨다.
 *  - 자동 진행이 켜져 있으면 레벨업 카드도 알아서 넘어간다(로그와 같은 속도 설정을 본다)
 *  - 수동이면 Q·Enter·클릭으로 한 장씩
 *  - Space 는 통째로 건너뛴다 (씬의 연출 스킵과 같은 키)
 */

const ADVANCE_CODES = ["KeyQ", "Enter", "NumpadEnter"];
const SKIP_CODES = ["Space", "Escape"];

const GAIN_ROWS: [keyof StatGains, string][] = [
  ["maxHp", "HP"], ["attack", "공격"], ["defense", "방어"], ["speed", "속도"],
];

export function ExpGainOverlay({
  name, gained, segments, onDone,
}: {
  name: string;
  gained: number;
  segments: ExpSegment[];
  onDone: () => void;
}) {
  const { autoAdvance } = useBattleSettings();
  const [level, setLevel] = useState(segments[0]?.level ?? 1);
  const [ratio, setRatio] = useState(segments[0]?.from ?? 0);
  const [card, setCard] = useState<ExpSegment["levelUp"]>(null);

  // 진행을 깨우는 손잡이들. 렌더와 무관하게 프로미스만 건드린다.
  const advanceRef = useRef<(() => void) | null>(null);
  const skipRef = useRef(false);
  const doneRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const finish = () => {
      if (doneRef.current) return;
      doneRef.current = true;
      onDone();
    };
    const skipAll = () => { skipRef.current = true; advanceRef.current?.(); };

    const onKey = (e: KeyboardEvent) => {
      if (SKIP_CODES.includes(e.code)) { e.preventDefault(); skipAll(); return; }
      if (ADVANCE_CODES.includes(e.code)) { e.preventDefault(); advanceRef.current?.(); }
    };
    window.addEventListener("keydown", onKey);

    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        if (skipRef.current) return resolve();
        const timer = setTimeout(() => { advanceRef.current = null; resolve(); }, ms);
        advanceRef.current = () => { clearTimeout(timer); advanceRef.current = null; resolve(); };
      });

    /** 레벨업 카드 앞에서 멈추는 자리. 자동이면 로그 속도만큼, 수동이면 입력까지. */
    const hold = () =>
      new Promise<void>((resolve) => {
        if (skipRef.current) return resolve();
        const { autoAdvance: auto, logSpeed: speed } = useBattleSettings.getState();
        let timer: ReturnType<typeof setTimeout> | undefined;
        advanceRef.current = () => { clearTimeout(timer); advanceRef.current = null; resolve(); };
        if (auto) timer = setTimeout(() => advanceRef.current?.(), logSpeedMs(speed));
      });

    (async () => {
      const fillMs = Math.round(logSpeedMs(useBattleSettings.getState().logSpeed) * 0.5);
      for (const seg of segments) {
        if (cancelled) return;
        setLevel(seg.level);
        setRatio(seg.from);
        // 트랜지션이 걸리려면 시작값이 한 번 그려져야 한다
        await wait(30);
        if (cancelled) return;
        setRatio(seg.to);
        await wait(skipRef.current ? 0 : fillMs);
        if (cancelled) return;

        if (seg.levelUp) {
          setCard(seg.levelUp);
          setLevel(seg.levelUp.level);
          await hold();
          if (cancelled) return;
          setCard(null);
          setRatio(0);
        }
      }
      finish();
    })();

    return () => {
      cancelled = true;
      window.removeEventListener("keydown", onKey);
      advanceRef.current = null;
    };
    // 세그먼트는 마운트 시점에 고정된다 — 전투당 한 번 만들어져 그대로 소비된다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      data-testid="exp-gain"
      className="absolute inset-0 z-[55] flex items-center justify-center bg-shadow-900/75 px-4"
      onClick={() => advanceRef.current?.()}
    >
      <div className="w-full max-w-sm border-2 border-moss-500 bg-shadow-900/95 p-4">
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-pixel-sm font-bold text-cream-100">{name}</span>
          <span className="text-pixel-sm text-sand-300">Lv.{level}</span>
        </div>

        {/* 경험치 바. width 트랜지션은 StatBar 가 이미 들고 있다 */}
        <StatBar value={Math.round(ratio * 1000)} max={1000} variant="exp" height={12} />

        <p className="mt-2 text-center text-pixel-sm text-moss-500">
          경험치 +{gained}
        </p>

        {card && (
          <div data-testid="exp-levelup" className="mt-3 border border-moss-500 bg-moss-500/12 p-3">
            <p className="mb-2 text-center text-pixel-sm font-bold text-moss-500">
              레벨 {card.level} 달성!
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              {GAIN_ROWS.map(([key, label]) => (
                <div key={key} className="flex items-baseline justify-between">
                  <span className="text-pixel-sm text-sand-300">{label}</span>
                  <span className="text-pixel-sm font-bold text-cream-100">+{card.gains[key]}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="mt-3 text-center text-pixel-sm text-earth-400">
          {autoAdvance ? "자동 진행 중 · Space 건너뛰기" : "Q / 클릭 진행 · Space 건너뛰기"}
        </p>
      </div>
    </div>
  );
}
