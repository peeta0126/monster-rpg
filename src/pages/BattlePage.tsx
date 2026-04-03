import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { monsters } from "../data/monsters";
import { getFloorEnemy, getFloorEnemySkill, isBossFloor } from "../data/floorTable";
import { MONSTER_IMAGE_MAP } from "../data/monsterImages";
import type { Move } from "../types/game";

import {
  applyDamage,
  applyStatusEffect,
  calculateDamage,
  checkCatchCondition,
  checkStatusEffects,
  createBattleMonster,
  gainExp,
  getAIAction,
  getTypeMultiplier,
  isFainted,
  type BattleMonster,
} from "../utils/battle";

import { gameEvents, GAME_EVENT } from "../game/phaser/events";
import { createBattleGame } from "../game/phaser/phaserConfig";
import { setBattleInitData } from "../game/phaser/battleInitStore";

// ─── 타입 ────────────────────────────────────────────────────────────────────────

type BattleRouteState = {
  from?: string;
  portalId?: string;
  isCatchZone?: boolean;
  floor?: number;
};

const STATUS_LABELS: Record<string, string> = {
  paralysis: "⚡ 마비",
  poison: "☠ 독",
  freeze: "❄ 빙결",
  burn: "🔥 화상",
};

const TYPE_COLORS: Record<string, string> = {
  fire:     "border-red-800    bg-red-950/60    hover:bg-red-900/60    text-red-200",
  water:    "border-blue-800   bg-blue-950/60   hover:bg-blue-900/60   text-blue-200",
  grass:    "border-green-800  bg-green-950/60  hover:bg-green-900/60  text-green-200",
  electric: "border-yellow-700 bg-yellow-950/60 hover:bg-yellow-900/60 text-yellow-200",
  ice:      "border-cyan-700   bg-cyan-950/60   hover:bg-cyan-900/60   text-cyan-200",
  normal:   "border-zinc-700   bg-zinc-900/60   hover:bg-zinc-800/60   text-zinc-200",
};

function typeClass(type: string) {
  return TYPE_COLORS[type] ?? TYPE_COLORS.normal;
}

// ─── 컴포넌트 ────────────────────────────────────────────────────────────────────

export default function BattlePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const routeState = location.state as BattleRouteState | undefined;

  const isCatchZone = routeState?.isCatchZone ?? false;
  const floor = routeState?.floor ?? 1;

  const gameRef = useRef<HTMLDivElement | null>(null);

  // ─── 초기 몬스터 ────────────────────────────────────────────────────────────────

  const initialPlayer = monsters[0];
  const initialEnemy  = getFloorEnemy(floor, initialPlayer.id);

  // ─── 전투 상태 ──────────────────────────────────────────────────────────────────

  const [player,     setPlayer]     = useState<BattleMonster>(() => createBattleMonster(initialPlayer));
  const [enemyState, setEnemyState] = useState<BattleMonster>(() => createBattleMonster(initialEnemy));
  const [isProcessing, setIsProcessing] = useState(false);
  const [battleOutcome, setBattleOutcome] = useState<"win" | "lose" | null>(null);

  // 적 행동 턴 카운터 (고정 스킬 순서용)
  const enemyTurnRef = useRef(0);

  // ─── Phaser HP 즉시 동기화 ─────────────────────────────────────────────────────

  const syncHpToPhaser = useCallback((p: BattleMonster, e: BattleMonster) => {
    gameEvents.emit(GAME_EVENT.BATTLE_STATE_UPDATE, {
      playerHp: p.currentHp, playerMaxHp: p.maxHp, playerStatus: p.status,
      enemyHp:  e.currentHp, enemyMaxHp:  e.maxHp, enemyStatus:  e.status,
    });
  }, []);

  // React 상태 변화 → Phaser HP 동기화 (백업)
  useEffect(() => {
    syncHpToPhaser(player, enemyState);
  }, [player, enemyState, syncHpToPhaser]);

  // ─── 로그 + Q 대기 ─────────────────────────────────────────────────────────────

  /**
   * Phaser에 로그를 보내고, 플레이어가 Q/클릭으로 확인할 때까지 await한다.
   * 이 방식으로 React 로직이 Q 입력과 완전히 동기화된다.
   */
  const sendLogAndWait = useCallback((text: string): Promise<void> => {
    return new Promise((resolve) => {
      gameEvents.once(GAME_EVENT.BATTLE_LOG_ACK, resolve);
      gameEvents.emit(GAME_EVENT.BATTLE_LOG, text);
    });
  }, []);

  // ─── Phaser 마운트 ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!gameRef.current) return;

    setBattleInitData({
      playerImageUrl: MONSTER_IMAGE_MAP[initialPlayer.id] ?? "",
      playerName:     initialPlayer.name,
      playerLevel:    createBattleMonster(initialPlayer).level,
      enemyImageUrl:  MONSTER_IMAGE_MAP[initialEnemy.id]  ?? "",
      enemyName:      initialEnemy.name,
      enemyLevel:     initialEnemy.level,
      floor,
      isBoss: isBossFloor(floor),
    });

    const game = createBattleGame(gameRef.current);

    return () => {
      gameEvents.emit(GAME_EVENT.BATTLE_END);
      // BATTLE_LOG_ACK 리스너가 남아 있으면 정리 (비정상 종료 시)
      gameEvents.removeAllListeners(GAME_EVENT.BATTLE_LOG_ACK);
      game.destroy(true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── 결과 전송 ──────────────────────────────────────────────────────────────────

  const finishBattle = useCallback((outcome: "win" | "lose") => {
    gameEvents.emit(GAME_EVENT.BATTLE_RESULT, { outcome, floor });
    setBattleOutcome(outcome);
  }, [floor]);

  // ─── 공격 내부 처리 (async) ─────────────────────────────────────────────────────

  /**
   * attacker가 defender에게 공격하는 1회 처리.
   * HP 변화는 syncHpToPhaser로 즉시 반영 후 로그를 표시.
   * Returns { updated: defender 최신 상태, fainted }
   */
  const resolveAttack = useCallback(async (
    attacker: BattleMonster,
    defender: BattleMonster,
    move: Move,
    currentPlayer: BattleMonster,
    currentEnemy: BattleMonster,
    isPlayerAttacking: boolean,
  ): Promise<{ updated: BattleMonster; fainted: boolean }> => {

    await sendLogAndWait(`${attacker.name}의 ${move.name}!`);

    const res = calculateDamage(attacker, defender, move);

    if (!res.isHit) {
      await sendLogAndWait("공격이 빗나갔다!");
      return { updated: defender, fainted: false };
    }

    let next = defender;

    if (res.damage > 0) {
      next = applyDamage(defender, res.damage);
      // HP 바를 로그 표시 직전에 갱신
      if (isPlayerAttacking) syncHpToPhaser(currentPlayer, next);
      else                    syncHpToPhaser(next, currentEnemy);
      await sendLogAndWait(`${res.damage}의 피해를 입혔다.`);
    }

    if (res.multiplier >= 2)  await sendLogAndWait("효과가 굉장했다!");
    else if (res.multiplier < 1) await sendLogAndWait("효과가 별로인 듯하다...");

    if (move.statusEffect && (move.statusChance ?? 0) > 0) {
      if (Math.random() * 100 <= (move.statusChance ?? 0)) {
        const before = next.status;
        next = applyStatusEffect(next, move.statusEffect);
        if (before === null && next.status !== null) {
          await sendLogAndWait(
            `${next.name}에게 ${STATUS_LABELS[next.status] ?? next.status} 상태이상이 걸렸다!`
          );
        }
      }
    }

    const fainted = isFainted(next);
    if (fainted) await sendLogAndWait(`${defender.name}이(가) 쓰러졌다!`);

    return { updated: next, fainted };
  }, [sendLogAndWait, syncHpToPhaser]);

  // ─── 스킬 선택 ──────────────────────────────────────────────────────────────────

  const handleMoveClick = useCallback(async (move: Move) => {
    if (isProcessing || battleOutcome !== null) return;
    setIsProcessing(true);

    let np = player;
    let ne = enemyState;

    // 적 이번 턴 스킬 결정 (고정 순서 우선, 없으면 AI)
    const eTurnIdx = enemyTurnRef.current;
    const eMove = getFloorEnemySkill(floor, eTurnIdx, ne.moves) ?? getAIAction(ne, np);

    const playerFirst = np.speed >= ne.speed;

    // ── 플레이어 공격 ──
    const doPlayerTurn = async (): Promise<boolean> => {
      const ps = checkStatusEffects(np);
      np = ps.monster;
      for (const log of ps.logs) {
        syncHpToPhaser(np, ne);
        await sendLogAndWait(log);
      }
      if (ps.skipTurn) return false;

      const res = await resolveAttack(np, ne, move, np, ne, true);
      ne = res.updated;
      return res.fainted;
    };

    // ── 적 공격 ──
    const doEnemyTurn = async (): Promise<boolean> => {
      const es = checkStatusEffects(ne);
      ne = es.monster;
      for (const log of es.logs) {
        syncHpToPhaser(np, ne);
        await sendLogAndWait(log);
      }
      if (es.skipTurn) return false;

      const res = await resolveAttack(ne, np, eMove, np, ne, false);
      np = res.updated;
      return res.fainted;
    };

    let playerWon = false;
    let enemyWon  = false;

    if (playerFirst) {
      playerWon = await doPlayerTurn();
      if (!playerWon) enemyWon = await doEnemyTurn();
    } else {
      enemyWon = await doEnemyTurn();
      if (!enemyWon) playerWon = await doPlayerTurn();
    }

    enemyTurnRef.current += 1;

    if (playerWon) {
      const expResult = gainExp(np, ne.rewardExp);
      np = expResult.updatedMonster;
      await sendLogAndWait(`경험치 ${ne.rewardExp}를 획득했다!`);
      if (expResult.leveledUp) await sendLogAndWait(`레벨이 ${np.level}(으)로 올랐다!`);
      setPlayer(np);
      setEnemyState(ne);
      finishBattle("win");
      setIsProcessing(false);
      return;
    }

    if (enemyWon) {
      setPlayer(np);
      setEnemyState(ne);
      finishBattle("lose");
      setIsProcessing(false);
      return;
    }

    setPlayer(np);
    setEnemyState(ne);
    setIsProcessing(false);
  }, [
    isProcessing, battleOutcome, player, enemyState,
    floor, resolveAttack, syncHpToPhaser, sendLogAndWait, finishBattle,
  ]);

  // ─── 포획 ────────────────────────────────────────────────────────────────────────

  const handleCatch = useCallback(async () => {
    if (isProcessing || battleOutcome !== null) return;
    setIsProcessing(true);

    const res = checkCatchCondition(enemyState, isCatchZone);
    await sendLogAndWait(res.message);

    if (!res.canAttempt) {
      setIsProcessing(false);
      return;
    }

    if (res.success) {
      finishBattle("win");
      setIsProcessing(false);
      return;
    }

    // 포획 실패: 적 반격
    let np = player;
    let ne = enemyState;
    const eMove = getFloorEnemySkill(floor, enemyTurnRef.current, ne.moves) ?? getAIAction(ne, np);
    const attackRes = await resolveAttack(ne, np, eMove, np, ne, false);
    np = attackRes.updated;
    enemyTurnRef.current += 1;

    if (attackRes.fainted) {
      setPlayer(np);
      setEnemyState(ne);
      finishBattle("lose");
    } else {
      setPlayer(np);
      setEnemyState(ne);
    }
    setIsProcessing(false);
  }, [
    isProcessing, battleOutcome, player, enemyState,
    isCatchZone, floor, resolveAttack, sendLogAndWait, finishBattle,
  ]);

  // ─── 렌더 ────────────────────────────────────────────────────────────────────────

  const playerHpPct = (player.currentHp / player.maxHp) * 100;
  const canShowCatch = isCatchZone && enemyState.currentHp / enemyState.maxHp <= 0.3
    && !isProcessing && battleOutcome === null;

  return (
    <div className="flex h-screen flex-col bg-zinc-950 text-white overflow-hidden">
      {/* ── Phaser 캔버스 ── */}
      <div ref={gameRef} className="relative flex-1 min-h-0" />

      {/* ── 하단 패널 ── */}
      <div className="shrink-0 border-t border-zinc-800 bg-[#0e0b06] px-4 py-3">

        {/* 상태 표시줄 */}
        <div className="mb-2 flex items-center justify-between text-xs text-zinc-500">
          <div className="flex items-center gap-3">
            <span className="text-zinc-300 font-semibold">{player.name}</span>
            <div className="flex items-center gap-1">
              <span>HP</span>
              <div className="h-2 w-24 rounded-full bg-zinc-800 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${playerHpPct}%`,
                    backgroundColor:
                      playerHpPct > 50 ? "#44ee66" : playerHpPct > 20 ? "#eecc22" : "#ff4444",
                  }}
                />
              </div>
              <span>{player.currentHp}/{player.maxHp}</span>
            </div>
            {player.status && (
              <span className="rounded bg-yellow-900/50 px-1.5 py-0.5 text-yellow-300">
                {STATUS_LABELS[player.status]}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isProcessing && <span className="text-amber-600 animate-pulse">전투 중...</span>}
            <span className="rounded bg-amber-950/60 px-2 py-0.5 text-amber-500 font-mono font-bold">
              {floor}F
            </span>
            <button
              onClick={() => navigate("/")}
              className="rounded bg-zinc-800 px-2 py-0.5 text-zinc-500 hover:text-zinc-300"
            >
              나가기
            </button>
          </div>
        </div>

        {/* ── 전투 중: 기술 버튼 ── */}
        {battleOutcome === null && (
          <>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {player.moves.map((move) => {
                const mult = getTypeMultiplier(move.type, enemyState.type);
                return (
                  <button
                    key={move.id}
                    onClick={() => handleMoveClick(move)}
                    disabled={isProcessing}
                    className={`rounded-lg border px-3 py-2.5 text-left transition disabled:opacity-35 ${typeClass(move.type)}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm">{move.name}</span>
                      <span className="text-xs opacity-60 uppercase">{move.type}</span>
                    </div>
                    <div className="text-xs opacity-50 mt-0.5">위력 {move.power} · 명중 {move.accuracy}</div>
                    {mult > 1 && <div className="text-xs text-emerald-400 mt-0.5">▲ 상성 우위</div>}
                    {mult < 1 && <div className="text-xs text-yellow-600 mt-0.5">▼ 상성 불리</div>}
                  </button>
                );
              })}
            </div>

            {canShowCatch && (
              <button
                onClick={handleCatch}
                disabled={isProcessing}
                className="mt-2 w-full rounded-lg border border-sky-700 bg-sky-950/50 py-2 text-sm font-semibold text-sky-300 hover:bg-sky-900/50 disabled:opacity-35"
              >
                포획 시도 {enemyState.status ? "(상태이상 보너스)" : ""}
              </button>
            )}

            {isProcessing && (
              <p className="mt-1 text-center text-xs text-zinc-600">
                Q 또는 캔버스 클릭으로 다음 진행
              </p>
            )}
          </>
        )}

        {/* ── 전투 종료: 결과 버튼 ── */}
        {battleOutcome === "win" && (
          <div className="flex flex-col gap-2">
            <p className="text-center font-bold text-green-400">⭐ 승리!</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => navigate("/battle", { state: { floor: floor + 1, isCatchZone: false } })}
                className="rounded-lg bg-green-900/60 border border-green-700 py-2.5 text-sm font-semibold text-green-200 hover:bg-green-800/60 transition"
              >
                다음 층으로 ({floor + 1}층)
              </button>
              <button
                onClick={() => navigate("/")}
                className="rounded-lg bg-zinc-800 border border-zinc-600 py-2.5 text-sm font-semibold text-zinc-300 hover:bg-zinc-700 transition"
              >
                베이스캠프로
              </button>
            </div>
          </div>
        )}

        {battleOutcome === "lose" && (
          <div className="flex flex-col gap-2">
            <p className="text-center font-bold text-red-400">💀 패배...</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => navigate("/battle", { state: { floor, isCatchZone } })}
                className="rounded-lg bg-red-900/60 border border-red-700 py-2.5 text-sm font-semibold text-red-200 hover:bg-red-800/60 transition"
              >
                다시 도전 ({floor}층)
              </button>
              <button
                onClick={() => navigate("/")}
                className="rounded-lg bg-zinc-800 border border-zinc-600 py-2.5 text-sm font-semibold text-zinc-300 hover:bg-zinc-700 transition"
              >
                나가기
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
