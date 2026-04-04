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
  paralysis: "⚡마비",
  poison:    "☠독",
  freeze:    "❄빙결",
  burn:      "🔥화상",
};

const TYPE_COLORS: Record<string, string> = {
  fire:     "border-red-800    bg-red-950/60    hover:bg-red-900/60    text-red-200",
  water:    "border-blue-800   bg-blue-950/60   hover:bg-blue-900/60   text-blue-200",
  grass:    "border-green-800  bg-green-950/60  hover:bg-green-900/60  text-green-200",
  electric: "border-yellow-700 bg-yellow-950/60 hover:bg-yellow-900/60 text-yellow-200",
  ice:      "border-cyan-700   bg-cyan-950/60   hover:bg-cyan-900/60   text-cyan-200",
  normal:   "border-zinc-700   bg-zinc-900/60   hover:bg-zinc-800/60   text-zinc-200",
};
function typeClass(t: string) { return TYPE_COLORS[t] ?? TYPE_COLORS.normal; }

// ─── 컴포넌트 ────────────────────────────────────────────────────────────────────

export default function BattlePage() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const routeState = location.state as BattleRouteState | undefined;

  const isCatchZone = routeState?.isCatchZone ?? false;
  const floor       = routeState?.floor ?? 1;

  const gameRef = useRef<HTMLDivElement | null>(null);

  // ─── playerStore 연동 ──────────────────────────────────────────────────────────
  const { updateBestFloor, updatePartyMember, addCapturedMonster, addToDexSeen, addToDexCaught } =
    usePlayerStore();

  // 마운트 시 파티 스냅샷 (전투 도중 store 변경 무시)
  const [initialParty] = useState(() => usePlayerStore.getState().party);

  // 현재 출전 중인 파티 슬롯 인덱스
  const [activePartyIndex, setActivePartyIndex] = useState(0);

  // 파티 전체 HP 추적 (uid → currentHp) — 교체/기절 시 갱신
  const [partyHp, setPartyHp] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    for (const m of usePlayerStore.getState().party) {
      map[m.uid] = m.currentHp;
    }
    return map;
  });

  // 교체 강제 상태 (현재 몬스터 기절 후 아직 다른 몬스터 남음)
  const [mustSwitch, setMustSwitch] = useState(false);

  // ─── 초기 몬스터 ────────────────────────────────────────────────────────────────
  const initialPlayer = initialParty[0] ?? usePlayerStore.getState().party[0];
  const initialEnemy  = getFloorEnemy(floor, initialPlayer.id);

  // ─── 전투 상태 ──────────────────────────────────────────────────────────────────
  const [player,      setPlayer]      = useState<BattleMonster>(() => createBattleMonsterFromOwned(initialPlayer));
  const [enemyState,  setEnemyState]  = useState<BattleMonster>(() => createBattleMonster(initialEnemy));
  const [isProcessing, setIsProcessing] = useState(false);
  const [battleOutcome, setBattleOutcome] = useState<"win" | "lose" | null>(null);
  const [showResultUI,  setShowResultUI]  = useState(false);

  const enemyTurnRef  = useRef(0);
  const cancelledRef  = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    return () => { cancelledRef.current = true; };
  }, []);

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

  useEffect(() => { syncHpToPhaser(player, enemyState); }, [player, enemyState, syncHpToPhaser]);

  // ─── 로그 + Q 대기 ─────────────────────────────────────────────────────────────
  const sendLogAndWait = useCallback((text: string): Promise<void> => {
    if (cancelledRef.current) return Promise.resolve();
    return new Promise((resolve) => {
      gameEvents.once(GAME_EVENT.BATTLE_LOG_ACK, () => resolve());
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
      partyImageUrls: initialParty.map(m => MONSTER_IMAGE_MAP[m.id] ?? ""),
      partyNames:     initialParty.map(m => m.name),
      partyLevels:    initialParty.map(m => m.level),
    });

    const game = createBattleGame(gameRef.current);

    return () => {
      cancelledRef.current = true;
      gameEvents.emit(GAME_EVENT.BATTLE_END);
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

  // ─── 파티 전체 기절 체크 ────────────────────────────────────────────────────────
  /**
   * currentHp 맵을 기준으로 지정 인덱스 외 살아있는 파티원이 있는지 확인.
   * hp 인자가 없으면 partyHp 스냅샷 사용, 있으면 해당 uid 오버라이드.
   */
  const hasAlivePartyMember = useCallback(
    (excludeIdx: number, overrideUid?: string, overrideHp?: number): boolean => {
      const snap = usePlayerStore.getState(); void snap; // 타입 확인용
      return initialParty.some((m, i) => {
        if (i === excludeIdx) return false;
        const hp = (overrideUid === m.uid ? overrideHp : undefined)
          ?? partyHp[m.uid]
          ?? m.currentHp;
        return hp > 0;
      });
    },
    [initialParty, partyHp],
  );

  // ─── 공격 내부 처리 (async) ─────────────────────────────────────────────────────
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
      if (isPlayerAttacking) syncHpToPhaser(currentPlayer, next);
      else                    syncHpToPhaser(next, currentEnemy);
      await sendLogAndWait(`${res.damage}의 피해를 입혔다.`);
    }

    if (res.multiplier >= 2)   await sendLogAndWait("효과가 굉장했다!");
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
    if (isProcessing || battleOutcome !== null || mustSwitch) return;
    setIsProcessing(true);

    let np = player;
    let ne = enemyState;

    const eTurnIdx = enemyTurnRef.current;
    const eMove    = getFloorEnemySkill(floor, eTurnIdx, ne.moves) ?? getAIAction(ne, np);
    const playerFirst = np.speed >= ne.speed;

    const doPlayerTurn = async (): Promise<boolean> => {
      const ps = checkStatusEffects(np);
      np = ps.monster;
      for (const log of ps.logs) { syncHpToPhaser(np, ne); await sendLogAndWait(log); }
      if (ps.skipTurn) return false;
      const res = await resolveAttack(np, ne, move, np, ne, true);
      ne = res.updated;
      return res.fainted;
    };

    const doEnemyTurn = async (): Promise<boolean> => {
      const es = checkStatusEffects(ne);
      ne = es.monster;
      for (const log of es.logs) { syncHpToPhaser(np, ne); await sendLogAndWait(log); }
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
      const ownedOriginal = initialParty[activePartyIndex];
      if (ownedOriginal) updatePartyMember({ ...ownedOriginal, ...np, uid: ownedOriginal.uid });
      updateBestFloor(floor);
      addToDexSeen(ne.id);
      setPlayer(np);
      setEnemyState(ne);
      finishBattle("win");
      setIsProcessing(false);
      return;
    }

    if (enemyWon) {
      // 현재 몬스터 HP = 0 으로 partyHp 기록
      const activeUid = initialParty[activePartyIndex]?.uid;
      if (activeUid) setPartyHp(prev => ({ ...prev, [activeUid]: 0 }));

      setPlayer({ ...np, currentHp: 0 });
      setEnemyState(ne);

      // 아직 싸울 수 있는 파티원이 있는지 확인
      if (hasAlivePartyMember(activePartyIndex, activeUid, 0)) {
        setMustSwitch(true);
        setIsProcessing(false);
        return;
      }

      // 전원 기절 → 패배
      finishBattle("lose");
      setIsProcessing(false);
      return;
    }

    // 계속 전투 — 현재 HP partyHp에도 반영
    const activeUid = initialParty[activePartyIndex]?.uid;
    if (activeUid) setPartyHp(prev => ({ ...prev, [activeUid]: np.currentHp }));
    setPlayer(np);
    setEnemyState(ne);
    setIsProcessing(false);
  }, [
    isProcessing, battleOutcome, mustSwitch, player, enemyState,
    floor, activePartyIndex, initialParty,
    resolveAttack, syncHpToPhaser, sendLogAndWait, finishBattle,
    hasAlivePartyMember,
    updatePartyMember, updateBestFloor, addToDexSeen,
  ]);

  // ─── 파티 교체 ──────────────────────────────────────────────────────────────────
  const handlePartySwap = useCallback(async (partyIdx: number) => {
    if (isProcessing || battleOutcome !== null) return;
    if (partyIdx === activePartyIndex) return;

    const nextOwned = initialParty[partyIdx];
    if (!nextOwned) return;

    // 기절한 몬스터는 선택 불가
    const nextHp = partyHp[nextOwned.uid] ?? nextOwned.currentHp;
    if (nextHp <= 0) return;

    setIsProcessing(true);

    // ── 교체 전 현재 몬스터 HP를 partyHp에 저장 ──
    const outUid = initialParty[activePartyIndex]?.uid;
    if (outUid) {
      setPartyHp(prev => ({ ...prev, [outUid]: player.currentHp }));
    }

    if (!mustSwitch) {
      await sendLogAndWait(`${player.name}을(를) 교체한다!`);
    }

    // ── 새 몬스터로 전환 ──
    const nextPlayer: BattleMonster = {
      ...createBattleMonsterFromOwned(nextOwned),
      currentHp: nextHp,
    };
    setActivePartyIndex(partyIdx);
    setPlayer(nextPlayer);
    setMustSwitch(false);
    syncHpToPhaser(nextPlayer, enemyState);

    // Phaser 스프라이트 교체 이벤트
    gameEvents.emit(GAME_EVENT.BATTLE_PLAYER_SWITCH, {
      partyIndex: partyIdx,
      name:  nextOwned.name,
      level: nextOwned.level,
    });

    // ── 강제 교체(기절 후)는 적 반격 없음 ──
    if (mustSwitch) {
      setIsProcessing(false);
      return;
    }

    // ── 일반 교체: 적 1회 반격 ──
    let ne = enemyState;
    const eMove = getFloorEnemySkill(floor, enemyTurnRef.current, ne.moves) ?? getAIAction(ne, nextPlayer);
    const attackRes = await resolveAttack(ne, nextPlayer, eMove, nextPlayer, ne, false);
    const np2 = attackRes.updated;
    enemyTurnRef.current += 1;

    // 반격으로 새 몬스터도 기절 가능
    if (attackRes.fainted) {
      setPartyHp(prev => ({ ...prev, [nextOwned.uid]: 0 }));
      setPlayer({ ...np2, currentHp: 0 });
      setEnemyState(ne);

      if (hasAlivePartyMember(partyIdx, nextOwned.uid, 0)) {
        setMustSwitch(true);
      } else {
        finishBattle("lose");
      }
    } else {
      setPartyHp(prev => ({ ...prev, [nextOwned.uid]: np2.currentHp }));
      setPlayer(np2);
      setEnemyState(ne);
    }

    setIsProcessing(false);
  }, [
    isProcessing, battleOutcome, activePartyIndex, initialParty, player,
    enemyState, floor, partyHp, mustSwitch,
    resolveAttack, syncHpToPhaser, sendLogAndWait, finishBattle,
    hasAlivePartyMember,
  ]);

  // ─── 포획 ────────────────────────────────────────────────────────────────────────
  const handleCatch = useCallback(async () => {
    if (isProcessing || battleOutcome !== null) return;
    setIsProcessing(true);

    const res = checkCatchCondition(enemyState, isCatchZone);
    await sendLogAndWait(res.message);

    if (!res.canAttempt) { setIsProcessing(false); return; }

    if (res.success) {
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
      const activeUid = initialParty[activePartyIndex]?.uid;
      if (activeUid) setPartyHp(prev => ({ ...prev, [activeUid]: 0 }));
      setPlayer({ ...np, currentHp: 0 });
      setEnemyState(ne);

      if (hasAlivePartyMember(activePartyIndex, activeUid, 0)) {
        setMustSwitch(true);
      } else {
        finishBattle("lose");
      }
    } else {
      const activeUid = initialParty[activePartyIndex]?.uid;
      if (activeUid) setPartyHp(prev => ({ ...prev, [activeUid]: np.currentHp }));
      setPlayer(np);
      setEnemyState(ne);
    }
    setIsProcessing(false);
  }, [
    isProcessing, battleOutcome, player, enemyState,
    isCatchZone, floor, activePartyIndex, initialParty, partyHp,
    resolveAttack, sendLogAndWait, finishBattle,
    addCapturedMonster, addToDexCaught, hasAlivePartyMember,
  ]);

  // ─── 렌더 헬퍼 ──────────────────────────────────────────────────────────────────
  const canShowCatch = isCatchZone
    && enemyState.currentHp / enemyState.maxHp <= 0.3
    && !isProcessing && battleOutcome === null && !mustSwitch;

  const speedFirst = player.speed >= enemyState.speed;

  // ─── 렌더 ────────────────────────────────────────────────────────────────────────
  return (
    <div className="relative flex h-screen flex-col bg-zinc-950 text-white overflow-hidden">

      {/* ── Phaser 캔버스 ── */}
      <div ref={gameRef} className="relative flex-1 min-h-0" />

      {/* ═══════════════════════════════════════════════════════════════════════
          하단 배틀 패널
      ════════════════════════════════════════════════════════════════════════ */}
      <div className="shrink-0 border-t border-zinc-800 bg-[#0e0b06]">

        {/* ── 상태 바 (최상단 한 줄) ── */}
        <div className="flex items-center justify-between border-b border-zinc-800/60 px-3 py-1.5 text-xs">
          {/* 왼쪽: 현재 출전 몬스터 정보 */}
          <div className="flex items-center gap-2">
            <span className="font-bold text-zinc-200">{player.name}</span>
            <span className="text-zinc-600">Lv.{player.level}</span>
            {/* HP 미니 바 */}
            {(() => {
              const pct = (player.currentHp / player.maxHp) * 100;
              return (
                <div className="flex items-center gap-1">
                  <div className="h-1.5 w-20 rounded-full bg-zinc-800 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: pct > 50 ? "#44ee66" : pct > 20 ? "#eecc22" : "#ff4444",
                      }}
                    />
                  </div>
                  <span className="text-zinc-500 font-mono text-[10px]">{player.currentHp}/{player.maxHp}</span>
                </div>
              );
            })()}
            {player.status && (
              <span className="rounded bg-yellow-900/40 px-1 py-0.5 text-yellow-300 text-[10px]">
                {STATUS_LABELS[player.status]}
              </span>
            )}
          </div>

          {/* 오른쪽: 속도 선공 표시 + 층 + 나가기 */}
          <div className="flex items-center gap-2">
            {!mustSwitch && battleOutcome === null && (
              <span className={`text-[10px] ${speedFirst ? "text-emerald-600" : "text-red-700"}`}>
                {speedFirst ? "▲ 선공" : "▼ 후공"}
              </span>
            )}
            {isProcessing && !mustSwitch && (
              <span className="text-amber-600 animate-pulse text-[10px]">▶ Q / 클릭</span>
            )}
            <span className="rounded bg-amber-950/60 px-1.5 py-0.5 text-amber-500 font-mono text-[10px] font-bold">
              {floor}F
            </span>
            <button
              onClick={() => navigate("/")}
              className="text-[10px] text-zinc-600 hover:text-zinc-400 border border-zinc-800 rounded px-1.5 py-0.5"
            >
              나가기
            </button>
          </div>
        </div>

        {/* ── 전투 중 메인 패널 ── */}
        {battleOutcome === null && (
          <div className="flex" style={{ minHeight: "140px" }}>

            {/* ─── 파티 벤치 (왼쪽) ─────────────────────────────── */}
            <div className="w-44 shrink-0 border-r border-zinc-800 p-2 flex flex-col gap-1.5">
              <p className="text-[9px] text-zinc-600 font-semibold uppercase tracking-wider">
                파티 ({initialParty.length}/3)
              </p>
              {initialParty.map((m, idx) => {
                const isActive  = idx === activePartyIndex;
                const hp        = isActive ? player.currentHp : (partyHp[m.uid] ?? m.currentHp);
                const hpPct     = Math.max(0, (hp / m.maxHp) * 100);
                const fainted   = hp <= 0;
                const canSwap   = !fainted && !isActive && !isProcessing && !mustSwitch;
                const mustPick  = mustSwitch && !fainted && !isActive;

                return (
                  <button
                    key={m.uid}
                    onClick={() => (canSwap || mustPick) && handlePartySwap(idx)}
                    disabled={fainted || (isActive && !mustSwitch) || (isProcessing && !mustSwitch)}
                    title={
                      fainted      ? "기절" :
                      isActive     ? "출전 중" :
                      mustPick     ? "클릭해서 교체" :
                      isProcessing ? "전투 중" : "클릭해서 교체"
                    }
                    className={[
                      "relative flex items-center gap-1.5 rounded-lg border px-1.5 py-1 text-left transition-all",
                      isActive  && "border-yellow-500/70 bg-yellow-950/25",
                      fainted   && "border-zinc-800 bg-zinc-900/10 opacity-40 cursor-not-allowed",
                      mustPick  && "border-blue-500 bg-blue-950/30 hover:bg-blue-900/30 shadow-[0_0_8px_rgba(59,130,246,0.3)] cursor-pointer",
                      canSwap   && "border-zinc-700 bg-zinc-900/40 hover:border-zinc-500 hover:bg-zinc-800/40 cursor-pointer",
                      !isActive && !fainted && !mustPick && !canSwap && "border-zinc-800 bg-zinc-900/20 cursor-not-allowed",
                    ].filter(Boolean).join(" ")}
                  >
                    {/* 몬스터 이미지 */}
                    <div className="relative shrink-0">
                      <img
                        src={MONSTER_IMAGE_MAP[m.id]}
                        alt={m.nickname ?? m.name}
                        className="h-9 w-9 object-contain"
                        style={fainted ? { filter: "grayscale(100%) brightness(0.4)" } : undefined}
                      />
                      {isActive && (
                        <div className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-yellow-400 shadow-[0_0_4px_rgba(250,204,21,0.8)]" />
                      )}
                    </div>

                    {/* 이름 + HP */}
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-semibold text-zinc-300 truncate leading-tight">
                        {m.nickname ?? m.name}
                      </p>
                      <p className="text-[9px] text-zinc-600 leading-tight">Lv.{m.level}</p>
                      <div className="mt-0.5 h-1 w-full rounded-full bg-zinc-800 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${hpPct}%`,
                            backgroundColor: hpPct > 50 ? "#44ee66" : hpPct > 20 ? "#eecc22" : "#ff4444",
                          }}
                        />
                      </div>
                      <p className="text-[9px] text-zinc-700 font-mono">{hp}/{m.maxHp}</p>
                    </div>

                    {/* 상태 배지 */}
                    {isActive  && <span className="text-[8px] text-yellow-400 font-bold shrink-0">출전</span>}
                    {fainted   && <span className="text-[8px] text-zinc-600 shrink-0">기절</span>}
                    {mustPick  && <span className="text-[8px] text-blue-400 shrink-0 animate-pulse">선택</span>}
                  </button>
                );
              })}
            </div>

            {/* ─── 기술/교체 영역 (오른쪽) ────────────────────────── */}
            <div className="flex-1 p-2 flex flex-col gap-1.5">

              {/* 강제 교체 메시지 */}
              {mustSwitch ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center">
                  <p className="text-red-400 font-bold text-sm">
                    {player.name}이(가) 기절했다!
                  </p>
                  <p className="text-zinc-500 text-xs">
                    ← 왼쪽에서 다음 몬스터를 선택하세요
                  </p>
                </div>
              ) : (
                <>
                  {/* 기술 버튼 2×2 */}
                  <div className="grid grid-cols-2 gap-1.5 flex-1">
                    {player.moves.map((move) => {
                      const mult = getTypeMultiplier(move.type, enemyState.type);
                      return (
                        <button
                          key={move.id}
                          onClick={() => handleMoveClick(move)}
                          disabled={isProcessing}
                          className={`rounded-lg border px-2.5 py-2 text-left transition disabled:opacity-30 ${typeClass(move.type)}`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-semibold text-xs leading-tight">{move.name}</span>
                            <span className="text-[9px] opacity-50 uppercase shrink-0">{move.type}</span>
                          </div>
                          <div className="text-[9px] opacity-45 mt-0.5">
                            위력 {move.power} · 명중 {move.accuracy}
                          </div>
                          {mult >= 2  && <div className="text-[9px] text-emerald-400 font-semibold mt-0.5">▲ 효과 굉장!</div>}
                          {mult === 0 && <div className="text-[9px] text-zinc-600 mt-0.5">✕ 효과 없음</div>}
                          {mult > 0 && mult < 1 && <div className="text-[9px] text-yellow-600 mt-0.5">▼ 효과 미미</div>}
                        </button>
                      );
                    })}
                  </div>

                  {/* 포획 버튼 */}
                  {canShowCatch && (
                    <button
                      onClick={handleCatch}
                      disabled={isProcessing}
                      className="w-full rounded-lg border border-sky-700 bg-sky-950/50 py-1.5 text-xs font-semibold text-sky-300 hover:bg-sky-900/50 disabled:opacity-30 transition"
                    >
                      포획 시도 {enemyState.status ? "(상태이상 보너스)" : ""}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* 결과 대기 메시지 */}
        {battleOutcome !== null && (
          <p className="py-2 text-center text-xs text-zinc-700">잠시 후 선택 화면이 표시됩니다...</p>
        )}
      </div>

      {/* ── 승리 결과 오버레이 ── */}
      {showResultUI && battleOutcome === "win" && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm">
          <div className="text-center px-8 py-10 rounded-2xl border border-green-800/60 bg-zinc-950/90 shadow-2xl max-w-sm w-full mx-4">
            <p className="text-5xl font-bold text-green-400 mb-2 drop-shadow-[0_0_24px_rgba(74,222,128,0.6)]">
              승리!
            </p>
            <p className="text-base text-zinc-400 mb-6">다음 스테이지로 넘어가시겠습니까?</p>
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
                베이스캠프로
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 패배 결과 오버레이 ── */}
      {showResultUI && battleOutcome === "lose" && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm">
          <div className="text-center px-8 py-10 rounded-2xl border border-red-800/60 bg-zinc-950/90 shadow-2xl max-w-sm w-full mx-4">
            <p className="text-5xl font-bold text-red-400 mb-2 drop-shadow-[0_0_24px_rgba(248,113,113,0.5)]">
              패배...
            </p>
            <p className="text-base text-zinc-400 mb-6">{floor}층을 재도전하시겠습니까?</p>
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
                베이스캠프로
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
