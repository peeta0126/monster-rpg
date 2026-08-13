import { turnsToExtraAction } from "./battleUtils";
import type { BattleMonster } from "./battleUtils";
import { buildTurnOrder } from "./turnOrder";

/**
 * 이번 라운드의 행동 순서.
 *
 * 이 게임의 속도는 굴림이 아니라 **누적**이다(battleUtils.tickSpeedGauge) — 그래서
 * "누가 먼저 움직이는지"도 "누가 한 번 더 움직이는지"도 턴이 시작되기 전에 이미 정해져
 * 있다. 정해져 있는데 화면이 안 알려 주면 그건 숨긴 것이지 긴장이 아니다.
 *
 * 예전엔 `▲ 선공 · 연속 3턴` 이라는 글자 한 줄이 전부였다. 옥토패스·브레이블리 계열이
 * 쓰는 순서 띠를 그대로 가져왔다 — 칩 세 개면 "내가 먼저, 적, 그리고 내가 또" 가 한눈에 읽힌다.
 */

export interface TurnOrderBarProps {
  player: BattleMonster;
  enemy: BattleMonster;
  /** 장비까지 더한 실제 속도 */
  playerSpeed: number;
  /** 지금까지 쌓인 게이지 */
  playerCharge: number;
  enemyCharge: number;
}

export function TurnOrderBar({
  player, enemy, playerSpeed, playerCharge, enemyCharge,
}: TurnOrderBarProps) {
  const slots = buildTurnOrder(player, enemy, playerSpeed, playerCharge, enemyCharge);
  const pNext = turnsToExtraAction(playerCharge, playerSpeed, enemy.speed);
  const eNext = turnsToExtraAction(enemyCharge, enemy.speed, playerSpeed);
  // 아직 멀었으면 예고만 한다. 열 턴 넘게 남은 건 전투보다 길어서 잡음이다
  const upcoming = pNext !== null && pNext > 1 && pNext <= 9 ? { side: "player" as const, turns: pNext }
    : eNext !== null && eNext > 1 && eNext <= 9 ? { side: "enemy" as const, turns: eNext }
    : null;

  return (
    <div data-testid="turn-order" className="flex items-center gap-1.5 text-pixel-sm">
      <span className="text-earth-400">순서</span>
      {slots.map((s, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <span className="text-earth-400">▸</span>}
          <span
            data-turn-slot={s.side}
            data-turn-extra={s.extra ? "1" : undefined}
            className={`rounded px-1.5 py-0.5 ${
              s.side === "player"
                ? "bg-mist-500/25 text-mist-300"
                : "bg-ember-700/25 text-ember-500"
            } ${s.extra ? "font-bold" : ""}`}
          >
            {s.name}{s.extra ? " 연속" : ""}
          </span>
        </span>
      ))}
      {upcoming && (
        <span className="text-earth-400">
          · {upcoming.side === "player" ? "내" : "적"} 연속 {upcoming.turns}턴 뒤
        </span>
      )}
    </div>
  );
}
