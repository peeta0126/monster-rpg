import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { getFloorEnemy, getFloorEnemySkill, isBossFloor } from "../data/floorTable";
import { MONSTER_IMAGE_MAP } from "../data/monsterImages";
import type { Move } from "../types/game";
import { usePlayerStore } from "../store/playerStore";

import {
  applyDamage,
  applyStatusEffect,
  calculateDamage,
  checkCatchCondition,
  checkStatusEffects,
  createBattleMonster,
  createBattleMonsterFromOwned,
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

  // ─── playerStore 연동 ───────────────────────────────────────────────────────────
  const { updateBestFloor, updatePartyMember, addCapturedMonster, addToDexSeen, addToDexCaught } =
    usePlayerStore();

  // 마운트 시 파티 스냅샷 (전투 도중 store 변경 무시)
  const [initialParty] = useState(() => usePlayerStore.getState().party);
  const [activePartyIndex, setActivePartyIndex] = useState(0);
  const [showPartySwap, setShowPartySwap] = useState(false);

  // ─── 초기 몬스터 ────────────────────────────────────────────────────────────────

  const initialPlayer = initialParty[0] ?? usePlayerStore.getState().party[0];
  const initialEnemy  = getFloorEnemy(floor, initialPlayer.id);

  // ─── 전투 상태 ──────────────────────────────────────────────────────────────────

  const [player, setPlayer] = useState<BattleMonster>(() => createBattleMonsterFromOwned(initialPlayer));
  const [enemyState, setEnemyState] = useState<BattleMonster>(() => createBattleMonster(initialEnemy));
  const [isProcessing, setIsProcessing] = useState(false);
  const [battleOutcome, setBattleOutcome] = useState<"win" | "lose" | null>(null);
  // 결과 오버레이는 Phaser 승리/패배 애니메이션(400ms) 후 표시
  const [showResultUI, setShowResultUI] = useState(false);

  // 적 행동 턴 카운터 (고정 스킬 순서용)
  const enemyTurnRef = useRef(0);
  // 컴포넌트 언마운트 시 비동기 로직 취소 플래그
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    return () => { cancelledRef.current = true; };
  }, []);

  // battleOutcome 설정 후 500ms 뒤에 결과 UI 표시
  useEffect(() => {
    if (!battleOutcome) return;
    const t = setTimeout(() => setShowResultUI(true), 500);
    return () => clearTimeout(t);
  }, [battleOutcome]);

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
   * 컴포넌트 언마운트(cancelledRef) 시엔 즉시 resolve하여 async 체인 빠르게 종료.
   */
  const sendLogAndWait = useCallback((text: string): Promise<void> => {
    if (cancelledRef.current) return Promise.resolve();
    return new Promise((resolve) => {
      const handler = () => resolve();
      gameEvents.once(GAME_EVENT.BATTLE_LOG_ACK, handler);
      gameEvents.emit(GAME_EVENT.BATTLE_LOG, text);
    });
  }, []);

  // ─── Phaser 마운트 ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!gameRef.current) return;

    setBattleInitData({
      playerImageUrl: MONSTER_IMAGE_MAP[initialPlayer.id] ?? "",
      playerName:     initialPlayer.name,
      playerLevel:    initialPlayer.level,
      enemyImageUrl:  MONSTER_IMAGE_MAP[initialEnemy.id]  ?? "",
      enemyName:      initialEnemy.name,
      enemyLevel:     initialEnemy.level,
      floor,
      isBoss: isBossFloor(floor),
    });

    const game = createBattleGame(gameRef.current);

    return () => {
      cancelledRef.current = true;
      gameEvents.emit(GAME_EVENT.BATTLE_END);
      // 대기 중인 sendLogAndWait promise가 있으면 즉시 해제
      gameEvents.emit(GAME_EVENT.BATTLE_LOG_ACK);
      gameEvents.removeAllListeners(GAME_EVENT.BATTLE_LOG_ACK);
      game.destroy(true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── 결과 전송 ──────────────────────────────────────────────────────────────────

  const finishBattle = useCallback((outcome: "win" | "lose") => {
    if (cancelledRef.current) return;
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
      // playerStore 업데이트: 경험치/레벨 반영 + 최고층 기록
      const ownedOriginal = initialParty[activePartyIndex];
      if (ownedOriginal) {
        updatePartyMember({ ...ownedOriginal, ...np, uid: ownedOriginal.uid });
      }
      updateBestFloor(floor);
      addToDexSeen(ne.id);
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

  // ─── 파티 교체 ──────────────────────────────────────────────────────────────────

  const handlePartySwap = useCallback(async (partyIdx: number) => {
    if (isProcessing || battleOutcome !== null || partyIdx === activePartyIndex) return;
    const nextOwned = initialParty[partyIdx];
    if (!nextOwned) return;

    setIsProcessing(true);
    setShowPartySwap(false);

    await sendLogAndWait(`${player.name}을(를) 교체한다!`);

    // 교체된 몬스터로 상태 전환
    const nextPlayer: BattleMonster = createBattleMonsterFromOwned(nextOwned);
    setActivePartyIndex(partyIdx);
    setPlayer(nextPlayer);
    syncHpToPhaser(nextPlayer, enemyState);

    // 교체는 적이 1회 반격
    let ne = enemyState;
    const eMove = getFloorEnemySkill(floor, enemyTurnRef.current, ne.moves) ?? getAIAction(ne, nextPlayer);
    const attackRes = await resolveAttack(ne, nextPlayer, eMove, nextPlayer, ne, false);
    const np2 = attackRes.updated;
    ne = attackRes.fainted ? ne : ne;
    enemyTurnRef.current += 1;

    setPlayer(np2);
    setEnemyState(ne);

    if (attackRes.fainted) {
      finishBattle("lose");
    }
    setIsProcessing(false);
  }, [
    isProcessing, battleOutcome, activePartyIndex, initialParty, player,
    enemyState, floor, resolveAttack, syncHpToPhaser, sendLogAndWait, finishBattle,
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
      // 포획 성공: playerStore에 추가 + 도감 등록
      const captureResult = addCapturedMonster(enemyState);
      addToDexCaught(enemyState.id);
      const captureMsg = captureResult === "storage"
        ? "보관함에 저장되었다!"
        : "보관함이 가득 차서 놓아줬다...";
      await sendLogAndWait(captureMsg);
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
    <div className="relative flex h-screen flex-col bg-zinc-950 text-white overflow-hidden">
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

        {/* ── 기술 버튼 (전투 중일 때) ── */}
        {battleOutcome === null && (
          <>
            {/* ── 파티 교체 패널 ── */}
            {showPartySwap ? (
              <div className="mb-2 flex gap-2 items-center">
                <span className="text-xs text-zinc-500 shrink-0">교체:</span>
                {initialParty.map((m, idx) => {
                  const isActive = idx === activePartyIndex;
                  const hpPct = Math.round((m.currentHp / m.maxHp) * 100);
                  return (
                    <button
                      key={m.uid}
                      disabled={isActive || isProcessing}
                      onClick={() => handlePartySwap(idx)}
                      className={`flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs transition
                        ${isActive
                          ? "border-zinc-700 bg-zinc-900/40 text-zinc-600 cursor-default opacity-50"
                          : "border-blue-700 bg-blue-950/50 text-blue-300 hover:bg-blue-900/50"
                        }`}
                    >
                      <img src={MONSTER_IMAGE_MAP[m.id]} alt={m.name} className="h-6 w-6 object-contain" />
                      <span>{m.nickname ?? m.name}</span>
                      <span className="text-zinc-500">{hpPct}%</span>
                    </button>
                  );
                })}
                <button
                  onClick={() => setShowPartySwap(false)}
                  className="ml-auto text-xs text-zinc-600 hover:text-zinc-400"
                >
                  닫기
                </button>
              </div>
            ) : (
              initialParty.length > 1 && !isProcessing && (
                <div className="mb-2 flex justify-end">
                  <button
                    onClick={() => setShowPartySwap(true)}
                    className="text-xs text-blue-500 hover:text-blue-300 border border-blue-800/50 rounded px-2 py-0.5"
                  >
                    파티 교체
                  </button>
                </div>
              )
            )}

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

        {/* 결과 후 하단은 비워둠 (오버레이로 처리) */}
        {battleOutcome !== null && (
          <p className="py-1 text-center text-xs text-zinc-700">잠시 후 선택 화면이 표시됩니다...</p>
        )}
      </div>

      {/* ── 결과 오버레이 (화면 중앙, Phaser 승리/패배 애니 후 500ms 뒤 표시) ── */}
      {showResultUI && battleOutcome === "win" && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm transition-opacity">
          <div className="text-center px-8 py-10 rounded-2xl border border-green-800/60 bg-zinc-950/90 shadow-2xl max-w-sm w-full mx-4">
            <p className="text-5xl font-bold text-green-400 mb-2 drop-shadow-[0_0_24px_rgba(74,222,128,0.6)]">
              승리!
            </p>
            <p className="text-base text-zinc-400 mb-6">
              다음 스테이지로 넘어가시겠습니까?
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => navigate("/battle", { state: { floor: floor + 1, isCatchZone: false } })}
                className="w-full rounded-xl bg-green-800/70 border border-green-600 py-3 text-base font-bold text-green-200 hover:bg-green-700/70 transition active:scale-95"
              >
                다음 스테이지 진입 &nbsp;({floor + 1}층)
              </button>
              <button
                onClick={() => navigate("/")}
                className="w-full rounded-xl bg-zinc-800/80 border border-zinc-600 py-3 text-base font-semibold text-zinc-300 hover:bg-zinc-700/80 transition active:scale-95"
              >
                나가기
              </button>
            </div>
          </div>
        </div>
      )}

      {showResultUI && battleOutcome === "lose" && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm transition-opacity">
          <div className="text-center px-8 py-10 rounded-2xl border border-red-800/60 bg-zinc-950/90 shadow-2xl max-w-sm w-full mx-4">
            <p className="text-5xl font-bold text-red-400 mb-2 drop-shadow-[0_0_24px_rgba(248,113,113,0.5)]">
              패배...
            </p>
            <p className="text-base text-zinc-400 mb-6">
              {floor}층을 재도전하시겠습니까?
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => navigate("/battle", { state: { floor, isCatchZone } })}
                className="w-full rounded-xl bg-red-900/70 border border-red-700 py-3 text-base font-bold text-red-200 hover:bg-red-800/70 transition active:scale-95"
              >
                재도전 &nbsp;({floor}층)
              </button>
              <button
                onClick={() => navigate("/")}
                className="w-full rounded-xl bg-zinc-800/80 border border-zinc-600 py-3 text-base font-semibold text-zinc-300 hover:bg-zinc-700/80 transition active:scale-95"
              >
                나가기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
