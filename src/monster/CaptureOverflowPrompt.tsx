import { rgba, PALETTE } from "../shared/palette";
import { MONSTER_IMAGE_MAP } from "./monsterImages";
import type { Monster } from "../shared/game";
import { usePlayerStore } from "../shared/playerStore";
import { withJosa } from "../shared/josa";
import {
  chainKeyOf, imprintStatus, imprintStars, IMPRINT_ESSENCE_ID, MAX_IMPRINT_TIER,
} from "./imprint";

/**
 * 보관함이 가득 찬 채로 포획에 성공했을 때.
 *
 * 원래는 그냥 사라졌다(숲은 안내조차 없었다). 각인이 생긴 뒤로는 잃는 것 말고
 * 남는 길이 하나 생겼으므로, 사라지기 전에 한 번 묻는다.
 */
export function CaptureOverflowPrompt({ monster, onAbsorb, onRelease }: {
  monster: Monster;
  onAbsorb: () => void;
  onRelease: () => void;
}) {
  const imprint   = usePlayerStore((s) => s.imprint);
  const materials = usePlayerStore((s) => s.materials);

  const status  = imprintStatus(chainKeyOf(monster), imprint);
  const essence = materials[IMPRINT_ESSENCE_ID] ?? 0;
  const lacksEssence = !status.maxed && status.needFed === 1 && essence < status.needEssence;
  const canAbsorb = !status.maxed && !lacksEssence;

  return (
    <div
      className="w-full max-w-md rounded-2xl px-6 py-5"
      data-testid="capture-overflow"
      style={{
        background: rgba("shadow900", 0.92),
        border: `1px solid ${rgba("ember500", 0.45)}`,
        boxShadow: `0 8px 32px ${rgba("shadow900", 0.6)}`,
      }}
    >
      <div className="flex items-start gap-4">
        <img
          src={MONSTER_IMAGE_MAP[monster.id]}
          alt={monster.name}
          className="h-16 w-16 shrink-0 object-contain"
        />
        <div className="min-w-0 flex-1">
          <h2 className="text-title-sm font-black text-cream-100">보관함이 가득 찼다</h2>
          <p className="mt-1 text-pixel-sm text-sand-300">
            {withJosa(monster.name, "을를")} 데려갈 자리가 없다.
          </p>
          <p className="mt-2 text-pixel-sm" style={{ color: PALETTE.earth400 }}>
            {status.label} {imprintStars(status.tier)} {status.tier}/{MAX_IMPRINT_TIER}
            {!status.maxed && (
              <>
                {" · "}흡수하면 {status.fed + 1}마리째
                {status.needFed === 1 && ` (등급 ${status.tier + 1} 달성)`}
              </>
            )}
          </p>
          {lacksEssence && (
            <p className="mt-1 text-pixel-sm text-ember-500">
              몬스터 정수 {status.needEssence}개가 필요하다 (보유 {essence})
            </p>
          )}
          {status.maxed && (
            <p className="mt-1 text-pixel-sm text-ember-500">이 계열의 각인은 이미 끝났다</p>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onAbsorb}
          disabled={!canAbsorb}
          data-testid="capture-overflow-absorb"
          className="rounded-xl px-4 py-2 text-pixel-sm font-black transition active:scale-95"
          style={canAbsorb
            ? { background: PALETTE.moss500, color: rgba("shadow900", 1) }
            : { background: rgba("shadow900", 0.6), border: `1px solid ${rgba("stone600", 0.6)}`, color: PALETTE.stone600 }}
        >
          각인으로 흡수한다
        </button>
        <button
          type="button"
          onClick={onRelease}
          data-testid="capture-overflow-release"
          className="rounded-xl px-4 py-2 text-pixel-sm font-bold transition active:scale-95"
          style={{
            background: rgba("shadow900", 0.85),
            border: `1px solid ${rgba("stone600", 0.9)}`,
            color: PALETTE.sand200,
          }}
        >
          놓아준다
        </button>
      </div>
    </div>
  );
}
