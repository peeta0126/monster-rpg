import { StatBar } from "../shared/ui";

/**
 * 하단 상태 줄의 경험치 칸.
 *
 * 자기 줄을 쓴다. 위의 순서 줄은 상태이상 칩·공격버프 칩이 뜨는 대로 늘어나는 줄이라,
 * 여기 끼워 넣으면 칩이 둘 뜨는 순간 경험치부터 눌린다. 자리 다툼을 시키지 않는다.
 *
 * 바 폭은 160px 고정이다. 남는 폭을 다 먹으면 캔버스 HP 바(220px 패널)보다 커져서
 * 성장이 생존보다 커 보인다. HP 가 화면에서 제일 큰 게이지여야 한다.
 */
export function ExpStatusRow({
  name, level, exp, expToNext, fillMs, levelUp,
}: {
  name: string;
  level: number;
  exp: number;
  expToNext: number;
  /** 바가 차오르는 시간(ms). 평소에는 0 이라 값이 그냥 얹힌다 */
  fillMs: number;
  /** 방금 레벨이 올랐다 */
  levelUp: boolean;
}) {
  return (
    <div
      data-testid="exp-row"
      className="flex items-center gap-2 border-b border-earth-500/40 px-3 py-1 text-pixel-sm"
    >
      <span className="max-w-28 shrink-0 truncate font-semibold text-sand-200">{name}</span>
      <span data-testid="exp-level" className="shrink-0 font-bold text-sand-300">Lv.{level}</span>
      {/* 라벨이 없으면 색만으로 HP 바와 구분해야 한다. 색을 못 보는 사람에게도 남게 적는다 */}
      <span className="shrink-0 font-bold uppercase tracking-wider text-earth-400">EXP</span>
      <div className="w-40 shrink-0">
        <StatBar value={exp} max={expToNext} variant="exp" fillMs={fillMs} />
      </div>
      <span className="shrink-0 font-mono text-earth-400">
        {exp} / {expToNext}
      </span>
      {levelUp && (
        <span data-testid="exp-levelup-flash" className="shrink-0 font-bold text-moss-500">
          ▲ 레벨 업!
        </span>
      )}
    </div>
  );
}
