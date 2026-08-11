import { useState } from "react";
import { PALETTE, rgba } from "../../shared/palette";
import { getMaterial } from "../../shared/items";
import type { ForestArea } from "./areas";
import { recoveryRate, settleBag, type RunBagEntry, type SettleReason } from "./runStore";

/**
 * 원정 정산. 끝나는 길은 셋이고 셈은 둘이다.
 *
 *   자진 귀환 · 주인 처치 · 옛 세이브 복구  → 100% 회수
 *   소란 100 강제 퇴각                      →  50% 회수 + 지킬 것 1개 지정
 *
 * 포획한 몬스터는 여기 없다 — 잡는 즉시 확정이라 정산 대상이 아니다. 겨우 잡은
 * 희귀종이 퇴각으로 날아가면 그 게임은 다시 안 켜진다. 그래서 숲은 목적에 따라
 * 위험이 달라진다: 몬스터를 노리고 깊이 들어가는 건 안전하고, 재료를 노리는 건 위험하다.
 */

const HEADLINE: Record<SettleReason, { eyebrow: string; title: string; color: string }> = {
  voluntary: { eyebrow: "EXPEDITION COMPLETE", title: "무사히 돌아왔다",       color: PALETTE.moss500 },
  warden:    { eyebrow: "WARDEN FELLED",        title: "숲의 주인을 넘어섰다", color: PALETTE.ember500 },
  forced:    { eyebrow: "FORCED RETREAT",       title: "숲이 등을 떠밀었다",   color: PALETTE.ember700 },
  stale:     { eyebrow: "EXPEDITION COMPLETE",  title: "원정을 마치고 돌아왔습니다", color: PALETTE.moss500 },
};

export function SettleScreen({ area, reason, bag, caught, alertPeak, onConfirm }: {
  area: ForestArea;
  reason: SettleReason;
  bag: RunBagEntry[];
  caught: number;
  alertPeak: number;
  onConfirm: (kept: RunBagEntry[]) => void;
}) {
  const head = HEADLINE[reason];
  const rate = recoveryRate(reason);
  const mustChoose = rate < 1 && bag.length > 0;
  const [keepId, setKeepId] = useState<string | null>(null);

  const kept = settleBag(bag, reason, keepId ?? undefined);
  const keptCount = (id: string) => kept.find((k) => k.id === id)?.count ?? 0;

  return (
    <div className="w-full max-w-lg" style={{ animation: "fadeInScale .4s ease both" }}>
      <div className="overflow-hidden rounded-2xl backdrop-blur"
        style={{
          background: rgba("shadow900", 0.9),
          border: `2px solid ${head.color}66`,
          boxShadow: `0 12px 48px ${rgba("shadow900", 0.7)}`,
        }}
        data-testid="forest-settle"
        data-reason={reason}
      >
        <div className="px-6 pt-7 pb-5 text-center"
          style={{ background: `linear-gradient(to bottom, ${head.color}1f, transparent)` }}>
          <p className="text-pixel-sm uppercase tracking-widest" style={{ color: head.color }}>{head.eyebrow}</p>
          <h2 className="mt-1 text-title-md font-black text-cream-100">{head.title}</h2>
          <p className="mt-2 text-pixel-sm text-sand-300">
            {area.name} · 이번 원정 최고 소란 <span className="font-mono font-bold">{alertPeak}</span>
          </p>
          {rate < 1 && (
            <p className="mt-2 text-pixel-sm font-bold text-ember-500">
              쫓기며 짐을 흘렸다 — 재료 {Math.round(rate * 100)}%만 남는다
            </p>
          )}
        </div>

        <div className="px-6 pb-6">
          {mustChoose && (
            <p className="mb-3 text-pixel-sm text-sand-200">
              하나만은 온전히 지킬 수 있다. 무엇을 품고 뛰겠나?
            </p>
          )}

          {bag.length === 0 ? (
            <p className="py-4 text-center text-pixel-sm text-earth-400">가져온 재료가 없다.</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {bag.map((b) => {
                const chosen = keepId === b.id;
                const after = keptCount(b.id);
                const lost = b.count - after;
                return (
                  <li key={b.id}>
                    <button
                      type="button"
                      disabled={!mustChoose}
                      onClick={() => setKeepId(chosen ? null : b.id)}
                      data-testid={`forest-settle-item-${b.id}`}
                      className="flex w-full items-center justify-between rounded-xl px-4 py-2.5 text-left transition disabled:cursor-default"
                      style={{
                        background: chosen ? rgba("ember500", 0.14) : rgba("cream100", 0.04),
                        border: `1px solid ${chosen ? rgba("ember500", 0.6) : rgba("cream100", 0.07)}`,
                      }}>
                      <span className="text-pixel-sm text-sand-200">
                        {getMaterial(b.id)?.name ?? b.id}
                        {chosen && <span className="ml-2 text-pixel-sm font-bold text-ember-500">지킨다</span>}
                      </span>
                      <span className="font-mono text-pixel-sm font-black text-cream-100">
                        ×{after}
                        {lost > 0 && <span className="ml-2 font-normal text-earth-400">(-{lost})</span>}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {caught > 0 && (
            <p className="mt-4 rounded-xl px-4 py-2.5 text-pixel-sm font-bold text-moss-500"
              style={{ background: rgba("moss500", 0.1), border: `1px solid ${rgba("moss500", 0.3)}` }}>
              포획한 몬스터 {caught}마리는 이미 보관함에 있다
            </p>
          )}

          <button
            type="button"
            onClick={() => onConfirm(kept)}
            data-testid="forest-settle-confirm"
            className="mt-5 w-full rounded-xl py-3 text-pixel-sm font-black transition active:scale-95"
            style={{ background: head.color, color: rgba("shadow900", 1) }}>
            베이스캠프로
          </button>
        </div>
      </div>
    </div>
  );
}
