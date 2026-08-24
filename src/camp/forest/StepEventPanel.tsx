import { rgba } from "../../shared/palette";
import { getMaterial } from "../../shared/items";
import { MONSTER_IMAGE_MAP } from "../../monster/monsterImages";
import type { Monster } from "../../shared/game";
import { STEP_DEFS, TIER_COLOR, type ForestStepKind } from "./steps";
import type { RunBagEntry } from "./runStore";
import { BADGE_TONE, type NestBadge } from "./nest";

/**
 * 이번 걸음의 사건 패널. 배경(원화) 위에 놓이는 반투명 판 하나다.
 *
 * 배경이 무대고 이 판은 자막이다. 화면을 다 덮지 않는다. 그래서 폭을 제한하고
 * 위아래로 여백을 남긴다. 판이 커지면 숲이 안 보이고, 그러면 노드 맵과 다를 게 없다.
 */

function PanelShell({ tint, children }: { tint: string; children: React.ReactNode }) {
  return (
    <div
      className="w-full max-w-stage rounded-2xl px-6 py-5 backdrop-blur"
      style={{
        background: rgba("shadow900", 0.82),
        border: `1px solid ${tint}55`,
        boxShadow: `0 8px 32px ${rgba("shadow900", 0.6)}`,
        animation: "fadeInScale .35s ease both",
      }}
      data-testid="forest-step-panel"
    >
      {children}
    </div>
  );
}

/** 사건 제목 + 부제. 모든 사건이 같은 자리에서 시작한다 */
function PanelHead({ kind, subtitle }: { kind: ForestStepKind; subtitle?: string }) {
  const def = STEP_DEFS[kind];
  const tint = TIER_COLOR[def.tier];
  return (
    <>
      <h2 className="text-title-sm font-black text-cream-100">{def.title}</h2>
      {subtitle && <p className="mt-1 text-pixel-sm" style={{ color: tint }}>{subtitle}</p>}
    </>
  );
}

export function StepEventPanel({
  kind, monster, catchRate, catchPenalty, gained, alertAfter, actionLabel, onAction,
}: {
  kind: ForestStepKind;
  /** 조우·둥지·강적·주인이 내놓는 상대 */
  monster?: Monster | null;
  /** 실제로 굴릴 포획 확률(0~1). 화면에 적히는 값이 곧 굴리는 값이다 */
  catchRate?: number;
  /** 소란 때문에 깎인 몫(0~1). 0 이면 안 적는다 */
  catchPenalty?: number;
  /** 이미 정해진 수확 (흔적·이변처럼 굴림이 먼저 끝난 사건) */
  gained?: RunBagEntry[];
  /** 은신처가 되돌려 준 뒤의 소란 */
  alertAfter?: number;
  actionLabel: string;
  onAction: () => void;
}) {
  const def = STEP_DEFS[kind];
  const tint = TIER_COLOR[def.tier];

  return (
    <PanelShell tint={tint}>
      <div className="flex items-start gap-5">
        {monster && (
          <img
            src={MONSTER_IMAGE_MAP[monster.id]}
            alt={monster.name}
            className="h-20 w-20 shrink-0 object-contain"
            style={{ filter: `drop-shadow(0 0 12px ${tint}66)`, animation: "monsterFloat 2.6s ease-in-out infinite" }}
          />
        )}

        <div className="min-w-0 flex-1">
          <PanelHead
            kind={kind}
            subtitle={monster
              ? `${monster.name} (Lv.${monster.level})`
              : STEP_DEFS[kind].hint}
          />

          {catchRate !== undefined && (
            <p className="mt-2 text-pixel-sm text-sand-200">
              포획 성공률 <span className="font-black text-cream-100">{Math.round(catchRate * 100)}%</span>
            </p>
          )}
          {!!catchPenalty && (
            <p className="text-pixel-sm text-ember-500">소란 때문에 -{Math.round(catchPenalty * 100)}%p 깎였다</p>
          )}

          {alertAfter !== undefined && (
            <p className="mt-2 text-pixel-sm text-mist-300">
              숨을 고르자 숲이 잠잠해진다 — 소란 <span className="font-mono font-black">{alertAfter}</span>
            </p>
          )}

          {gained && gained.length > 0 && (
            <ul className="mt-3 flex flex-col gap-1">
              {gained.map((g, i) => (
                <li key={g.id} className="flex items-center justify-between text-pixel-sm"
                  style={{ animation: `itemDrop .35s ease ${i * 0.08}s both` }}>
                  <span className="text-sand-200">{getMaterial(g.id)?.name ?? g.id}</span>
                  <span className="font-mono font-black" style={{ color: tint }}>×{g.count}</span>
                </li>
              ))}
            </ul>
          )}

          {gained && gained.length === 0 && (
            <p className="mt-2 text-pixel-sm text-earth-400">쓸 만한 건 남아 있지 않다.</p>
          )}
        </div>

        <button
          type="button"
          onClick={onAction}
          data-testid="forest-step-action"
          className="shrink-0 self-center rounded-xl px-5 py-3 text-pixel-sm font-black transition active:scale-95"
          style={{ background: tint, color: rgba("shadow900", 1) }}
        >
          {actionLabel}
        </button>
      </div>
    </PanelShell>
  );
}

/**
 * 둥지. 여러 마리 중 하나를 고른다.
 *
 * 더 뒤질수록 좋은 개체가 나오지만 습격 위험이 오른다는 규칙은 STEP 3 이후에 붙는다.
 * 지금은 고르는 것까지가 이 화면의 일이다.
 */
export function NestPanel({ monsters, badges, onPick }: {
  monsters: Monster[];
  /** 카드마다의 판단 근거. 없으면 안 그린다 */
  badges?: NestBadge[];
  /** 고른 몬스터가 아니라 몇 번째인지를 넘긴다. 후보는 시드에서 다시 나오니까
   *  저장해 둘 건 번호 하나면 된다 */
  onPick: (index: number) => void;
}) {
  const tint = TIER_COLOR.rare;
  return (
    <PanelShell tint={tint}>
      <PanelHead kind="nest" subtitle="어느 쪽을 노릴까"/>
      <div className="mt-4 grid gap-3" style={{ gridTemplateColumns: `repeat(${monsters.length}, minmax(0, 1fr))` }}>
        {monsters.map((m, i) => (
          <button
            key={`${m.id}-${i}`}
            type="button"
            onClick={() => onPick(i)}
            data-testid={`forest-nest-pick-${i}`}
            className="flex flex-col items-center gap-2 rounded-xl px-3 py-3 transition active:scale-95"
            style={{ background: rgba("shadow900", 0.6), border: `1px solid ${tint}55` }}
          >
            <img src={MONSTER_IMAGE_MAP[m.id]} alt={m.name} className="h-16 w-16 object-contain"/>
            <span className="text-pixel-sm font-bold text-cream-100">{m.name}</span>
            <span className="text-pixel-sm text-sand-300">Lv.{m.level}</span>
            {/* 레벨만 적혀 있으면 높은 쪽이 무조건 정답이라 고를 게 없다.
                각인 진행도가 그 옆에 서야 저울이 성립한다 */}
            {badges?.[i] && (
              <span
                className="rounded-full px-2 py-0.5 text-pixel-sm font-bold"
                data-testid={`forest-nest-badge-${i}`}
                style={{
                  background: rgba(BADGE_TONE[badges[i].tone].border, 0.22),
                  border: `1px solid ${rgba(BADGE_TONE[badges[i].tone].border, 0.9)}`,
                  color: BADGE_TONE[badges[i].tone].text,
                }}
              >
                {badges[i].text}
              </span>
            )}
          </button>
        ))}
      </div>
    </PanelShell>
  );
}
