import type { ElementType, Move } from "../shared/game";
import { getTypeMultiplier, type BattleMonster } from "./battleUtils";
import { statusDetail, STATUS_META } from "./statusInfo";
import { PixelIcon } from "../shared/ui/PixelIcon";
import { ELEMENT_CHIP_CLASS, ELEMENT_KO, HP_DANGER_PCT } from "../shared/palette";

/**
 * 상대 정보 카드.
 *
 * 상성을 알려면 T 를 눌러 7×7 표를 열어야 했다. 표는 규칙을 보여주지 지금 이 싸움의
 * 답은 안 보여준다. 필요한 건 "이 상대를 어떻게 다루나" 두 줄이다.
 *
 * 양쪽을 다 적는다. 한쪽만 적었을 때 이런 화면이 나왔다. 불꽃으로 물을 만나면 내
 * 최고 배율이 1 이라 "상성 이득 없음"이라고만 떴는데, 정작 상대는 나를 2배로
 * 때리고 있었다. 상성은 때릴 때랑 맞을 때가 따로 굴러가니까, 바꿀지 말지는 받는
 * 쪽을 봐야 정해진다.
 *
 * HP 는 숫자를 안 적는다. 정확한 수치는 캔버스 패널이 크게 보여주고 있어서, 여기까지
 * 숫자를 적으면 같은 정보가 화면에 세 번 나온다.
 */

export interface EnemyCardProps {
  enemy: BattleMonster;
  /** 지금 나와 있는 몬스터의 기술. 때릴 때 배율을 여기서 고른다 */
  moves: Move[];
  /** 지금 나와 있는 몬스터의 속성. 맞을 때 배율을 여기서 고른다 */
  playerType: ElementType | null;
}

/** 배율 표기. ×1.0 이나 ×0.50 처럼 늘어지면 12px 한 줄에서 숫자가 안 읽힌다 */
const fmt = (n: number) => String(Number(n.toFixed(2)));

/** 위력이 있는 기술 중 가장 큰 상성 배율. 상태기(위력 0)는 상성이 의미 없다 */
function bestMultiplier(moves: readonly Move[], target: ElementType | null): number {
  return moves
    .filter((m) => m.power > 0)
    .reduce((acc, m) => Math.max(acc, getTypeMultiplier(m.type, target)), 0);
}

export function EnemyCard({ enemy, moves, playerType }: EnemyCardProps) {
  const hpPct = enemy.maxHp > 0 ? Math.round((enemy.currentHp / enemy.maxHp) * 100) : 0;
  const element = enemy.type ? ELEMENT_KO[enemy.type] : "무속성";
  const chip = enemy.type
    ? ELEMENT_CHIP_CLASS[enemy.type]
    : "bg-shadow-700/80 text-sand-300 border-stone-600";

  const outgoing = bestMultiplier(moves, enemy.type);
  const incoming = bestMultiplier(enemy.moves, playerType);

  // 때릴 때는 큰 게 좋고 맞을 때는 작은 게 좋다. 그래서 색이 반대로 간다
  const attack = outgoing === 0
    ? { text: "공격 기술이 없다", tone: "text-earth-400" }
    : { text: `내 공격 ×${fmt(outgoing)}`,
        tone: outgoing >= 2 ? "text-moss-500" : outgoing < 1 ? "text-ember-500" : "text-earth-400" };

  const defense = incoming === 0
    ? { text: "상대는 못 때린다", tone: "text-moss-500" }
    : { text: `받는 피해 ×${fmt(incoming)}`,
        tone: incoming >= 2 ? "text-ember-500" : incoming < 1 ? "text-moss-500" : "text-earth-400" };

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

      <p data-testid="enemy-advice" className={`text-pixel-sm ${attack.tone}`}>{attack.text}</p>
      <p data-testid="enemy-threat" className={`text-pixel-sm ${defense.tone}`}>{defense.text}</p>

      {enemy.status && (
        <p className="flex items-center gap-1 text-pixel-sm text-ember-500">
          <PixelIcon name={STATUS_META[enemy.status].icon} size={16} />
          {statusDetail(enemy.status, enemy.statusTurns)}
        </p>
      )}
    </div>
  );
}
