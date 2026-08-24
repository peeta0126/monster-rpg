import { useState } from "react";
import { PALETTE, rgba } from "../shared/palette";
import { usePlayerStore, type ImprintFeedResult, type OwnedMonster } from "../shared/playerStore";
import { MONSTER_IMAGE_MAP } from "./monsterImages";
import { withJosa } from "../shared/josa";
import {
  chainKeyOf, imprintStatus, imprintStars, imprintMultiplier, IMPRINT_TIERS,
  IMPRINT_ESSENCE_ID, MAX_IMPRINT_TIER,
} from "./imprint";

/**
 * 각인 창.
 *
 * 계열 단위 화면이라 카드 안에 못 들어간다. 등급·다음 비용·먹일 후보를 한자리에서
 * 봐야 "이 중복을 먹일까 남길까"가 결정된다. 장비 관리 모달과 같은 층위에 둔다.
 */

const FEED_MESSAGE: Record<Exclude<ImprintFeedResult, "ok">, string> = {
  "not-found":  "보관함에서 찾을 수 없다.",
  "in-party":   "파티 멤버는 먼저 보관함으로 내려야 한다.",
  "last-one":   "이 계열의 마지막 한 마리는 먹일 수 없다.",
  "maxed":      "이 계열의 각인은 이미 끝났다.",
  "no-essence": "몬스터 정수가 모자란다.",
};

export function ImprintModal({ chainKey, onClose }: { chainKey: string; onClose: () => void }) {
  const party     = usePlayerStore((s) => s.party);
  const storage   = usePlayerStore((s) => s.storage);
  const imprint   = usePlayerStore((s) => s.imprint);
  const materials = usePlayerStore((s) => s.materials);
  const feedImprint = usePlayerStore((s) => s.feedImprint);

  /** 확인 대기 중인 후보. 되돌리기가 없으므로 한 번 묻는다 */
  const [pending, setPending] = useState<OwnedMonster | null>(null);
  const [error, setError] = useState<string | null>(null);

  const status  = imprintStatus(chainKey, imprint);
  const essence = materials[IMPRINT_ESSENCE_ID] ?? 0;

  const inChain    = (m: OwnedMonster) => chainKeyOf(m) === chainKey;
  const ownedCount = [...party, ...storage].filter(inChain).length;
  const inParty    = party.filter(inChain);
  const candidates = storage.filter(inChain);
  /** 마지막 한 마리는 못 먹인다. 각인이 붙을 몸이 하나는 남아야 한다 */
  const canFeedAny = ownedCount > 1 && !status.maxed;
  const essenceShort = !status.maxed && status.needFed === 1 && essence < status.needEssence;

  const confirm = (m: OwnedMonster) => {
    const result = feedImprint(m.uid);
    setPending(null);
    setError(result === "ok" ? null : FEED_MESSAGE[result]);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: rgba("shadow900", 0.78) }}
      onClick={onClose}
      data-testid="imprint-modal"
    >
      <div
        className="relative max-h-[90vh] w-full max-w-stage overflow-y-auto rounded-2xl"
        style={{
          background: rgba("shadow900", 0.98),
          border: `1px solid ${rgba("earth500", 0.94)}`,
          boxShadow: `0 0 48px ${rgba("shadow900", 0.8)}`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── 헤더 ── */}
        <div className="sticky top-0 flex items-center justify-between px-5 py-4"
          style={{ background: rgba("shadow900", 0.98), borderBottom: `1px solid ${rgba("earth500", 0.26)}` }}>
          <div>
            <p className="text-pixel-sm font-bold uppercase tracking-widest" style={{ color: PALETTE.sand300 }}>각인</p>
            <p className="text-title-sm font-black text-cream-100">{status.label}</p>
          </div>
          <button onClick={onClose}
            className="rounded-lg px-2 py-1 text-title-sm font-black transition hover:brightness-125"
            style={{ color: PALETTE.sand300, background: rgba("shadow900", 0.8) }}>
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-5 px-5 py-4">
          {/* ── 지금 등급 ── */}
          <div className="rounded-xl px-4 py-3"
            style={{ background: rgba("shadow900", 0.35), border: `1px solid ${rgba("earth500", 0.11)}` }}>
            <div className="flex items-baseline justify-between">
              <span className="text-title-sm font-black" style={{ color: PALETTE.ember500 }}
                data-testid="imprint-stars">
                {imprintStars(status.tier)}
              </span>
              <span className="text-pixel-sm font-black text-sand-200">
                {status.tier} / {MAX_IMPRINT_TIER}
              </span>
            </div>
            <p className="mt-2 text-pixel-sm text-sand-300">
              계열 전원 HP·공격·방어·속도{" "}
              <span className="font-black text-cream-100">
                +{Math.round((imprintMultiplier(status.tier) - 1) * 100)}%
              </span>
              {" · "}지금까지 먹인 중복 {status.fed}마리
            </p>

            {status.maxed ? (
              <p className="mt-2 text-pixel-sm" style={{ color: PALETTE.earth400 }}>더 올릴 등급이 없다.</p>
            ) : (
              <p className="mt-2 text-pixel-sm text-sand-300" data-testid="imprint-next">
                다음 등급까지 중복 <span className="font-black text-cream-100">{status.needFed}마리</span>
                {status.needEssence > 0 && (
                  <>
                    {" · 몬스터 정수 "}
                    <span className="font-black" style={{ color: essence >= status.needEssence ? PALETTE.cream100 : PALETTE.ember500 }}>
                      {status.needEssence}개
                    </span>
                    <span style={{ color: PALETTE.earth400 }}> (보유 {essence})</span>
                  </>
                )}
              </p>
            )}
          </div>

          {/* ── 비용표 ── */}
          <div>
            <p className="mb-2 text-pixel-sm font-bold uppercase tracking-widest" style={{ color: PALETTE.earth500 }}>
              등급표
            </p>
            <div className="flex flex-col gap-1">
              {IMPRINT_TIERS.map((def) => {
                const reached = status.tier >= def.tier;
                return (
                  <div key={def.tier}
                    className="flex items-center justify-between rounded-lg px-3 py-1.5"
                    style={{
                      background: reached ? rgba("moss500", 0.14) : rgba("shadow900", 0.35),
                      border: `1px solid ${reached ? rgba("moss500", 0.5) : rgba("earth500", 0.11)}`,
                    }}>
                    <span className="text-pixel-sm font-bold" style={{ color: reached ? PALETTE.sand200 : PALETTE.earth400 }}>
                      등급 {def.tier} · +{def.tier * 5}%
                    </span>
                    <span className="text-pixel-sm font-mono" style={{ color: reached ? PALETTE.sand300 : PALETTE.earth400 }}>
                      누적 {def.fed}마리{def.essence > 0 && ` · 정수 ${def.essence}`}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── 먹일 후보 ── */}
          <div>
            <p className="mb-2 text-pixel-sm font-bold uppercase tracking-widest" style={{ color: PALETTE.earth500 }}>
              보관함의 후보 ({candidates.length})
            </p>

            {error && <p className="mb-2 text-pixel-sm text-ember-500">{error}</p>}

            {candidates.length === 0 ? (
              <p className="text-pixel-sm" style={{ color: PALETTE.earth400 }}>
                보관함에 이 계열이 없다. 숲에서 같은 계열을 더 데려오면 여기에 선다.
              </p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {candidates.map((m) => {
                  const asking = pending?.uid === m.uid;
                  return (
                    <div key={m.uid} className="flex items-center gap-3 rounded-xl px-3 py-2"
                      style={{
                        background: asking ? rgba("ember700", 0.28) : rgba("shadow900", 0.35),
                        border: `1px solid ${asking ? rgba("ember700", 0.9) : rgba("earth500", 0.11)}`,
                      }}>
                      <img src={MONSTER_IMAGE_MAP[m.id]} alt={m.name} className="h-9 w-9 shrink-0 object-contain" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-pixel-sm font-black text-cream-100">{m.nickname ?? m.name}</p>
                        <p className="text-pixel-sm" style={{ color: PALETTE.earth400 }}>Lv.{m.level}</p>
                      </div>

                      {asking ? (
                        <div className="flex shrink-0 items-center gap-1.5">
                          <span className="text-pixel-sm" style={{ color: PALETTE.sand300 }}>되돌릴 수 없다</span>
                          <button type="button" onClick={() => confirm(m)}
                            data-testid="imprint-confirm"
                            className="rounded-lg px-2 py-1 text-pixel-sm font-black transition"
                            style={{ background: PALETTE.ember700, color: PALETTE.cream100 }}>
                            먹인다
                          </button>
                          <button type="button" onClick={() => setPending(null)}
                            className="rounded-lg px-2 py-1 text-pixel-sm font-bold transition"
                            style={{ background: rgba("shadow900", 0.8), border: `1px solid ${rgba("stone600", 0.9)}`, color: PALETTE.sand300 }}>
                            취소
                          </button>
                        </div>
                      ) : (
                        <button type="button"
                          onClick={() => { setError(null); setPending(m); }}
                          disabled={!canFeedAny || essenceShort}
                          data-testid={`imprint-feed-${m.uid}`}
                          className="shrink-0 rounded-lg px-2.5 py-1 text-pixel-sm font-black transition"
                          style={canFeedAny && !essenceShort
                            ? { background: rgba("moss500", 0.3), border: `1px solid ${rgba("moss500", 0.9)}`, color: PALETTE.sand200 }
                            : { background: rgba("shadow900", 0.6), border: `1px solid ${rgba("stone600", 0.6)}`, color: PALETTE.stone600 }}>
                          먹인다
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {ownedCount === 1 && (
              <p className="mt-2 text-pixel-sm" style={{ color: PALETTE.earth400 }}>
                지금 이 계열은 한 마리뿐이다. 마지막 한 마리는 먹일 수 없다.
              </p>
            )}
            {inParty.length > 0 && (
              <p className="mt-2 text-pixel-sm" style={{ color: PALETTE.earth400 }}>
                파티의 {withJosa(inParty.map((m) => m.nickname ?? m.name).join(" · "), "은는")} 보관함으로 내려야 먹일 수 있다.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
