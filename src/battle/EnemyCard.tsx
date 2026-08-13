import type { Move } from "../shared/game";
import { getTypeMultiplier, type BattleMonster } from "./battleUtils";
import { statusDetail } from "./statusInfo";
import { ELEMENT_CHIP_CLASS, ELEMENT_KO, HP_DANGER_PCT } from "../shared/palette";

/**
 * 상대 정보 카드.
 *
 * 상성을 알려면 T 를 눌러 7×7 표를 열어야 했다. 표는 규칙을 보여주지만 지금 이 싸움의
 * 답은 안 보여준다 — 필요한 건 "내가 가진 기술 중 뭐가 제일 잘 먹히나" 한 줄이다.
 * 표는 그대로 T 에 남기고, 여기서는 **지금 파티의 기술로 계산한 최고 배율**만 말한다.
 *
 * HP 는 숫자를 안 적는다. 정확한 수치는 캔버스 패널이 크게 보여주고 있어서, 여기까지
 * 숫자를 적으면 같은 정보가 화면에 세 번 나온다.
 */

export interface EnemyCardProps {
  enemy: BattleMonster;
  /** 지금 나와 있는 몬스터의 기술 — 최고 상성을 여기서 고른다 */
  moves: Move[];
  floorLabel: string;
}

export function EnemyCard({ enemy, moves, floorLabel }: EnemyCardProps) {
  const hpPct = enemy.maxHp > 0 ? Math.round((enemy.currentHp / enemy.maxHp) * 100) : 0;
  const element = enemy.type ? ELEMENT_KO[enemy.type] : "무속성";
  const chip = enemy.type
    ? ELEMENT_CHIP_CLASS[enemy.type]
    : "bg-shadow-700/80 text-sand-300 border-stone-600";

  // 내 기술 중 가장 잘 먹히는 배율. 상태기(위력 0)는 상성이 의미 없으니 뺀다
  const best = moves
    .filter((m) => m.power > 0)
    .reduce((acc, m) => Math.max(acc, getTypeMultiplier(m.type, enemy.type)), 0);

  const advice =
    best >= 2 ? { text: `내 기술 중 ×${best} 가 있다`, tone: "text-moss-500" }
    : best > 0 && best < 1 ? { text: "잘 먹히는 기술이 없다", tone: "text-ember-500" }
    : { text: "상성 이득 없음", tone: "text-earth-400" };

  return (
    <div data-testid="enemy-card" className="flex min-w-0 flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-pixel-sm font-bold text-cream-100">{enemy.name}</span>
        <span className="shrink-0 text-pixel-sm text-earth-400">Lv.{enemy.level}</span>
      </div>

      <div className="flex items-center gap-1.5">
        <span className={`border px-1.5 text-pixel-sm ${chip}`}>{element}</span>
        <span className={`text-pixel-sm ${hpPct <= HP_DANGER_PCT ? "text-ember-500" : "text-sand-300"}`}>
          HP {hpPct}%
        </span>
      </div>

      <p data-testid="enemy-advice" className={`text-pixel-sm ${advice.tone}`}>{advice.text}</p>

      {enemy.status && (
        <p className="text-pixel-sm text-ember-500">{statusDetail(enemy.status, enemy.statusTurns)}</p>
      )}

      <p className="mt-auto text-pixel-sm text-earth-400">{floorLabel}</p>
    </div>
  );
}
