import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { monsters } from "../data/monsters";
import type { Move, BattlePhase } from "../types/game";

import flamelingImg from "../assets/monsters/flameling.png";
import aquabeImg from "../assets/monsters/aquabe.png";
import leafyImg from "../assets/monsters/leafy.png";
import burnoImg from "../assets/monsters/burno.png";
import bubbletImg from "../assets/monsters/bubblet.png";
import mossyImg from "../assets/monsters/mossy.png";

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

const MONSTER_IMAGE_MAP: Record<string, string> = {
  flameling: flamelingImg,
  aquabe: aquabeImg,
  leafy: leafyImg,
  burno: burnoImg,
  bubblet: bubbletImg,
  mossy: mossyImg,
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
  const getRandomEnemy = () => {
    const pool = monsters.filter((m) => m.id !== initialPlayer.id);
    return pool[Math.floor(Math.random() * pool.length)];
  };
  const initialEnemy = getRandomEnemy();

  // ─── 전투 상태 ──────────────────────────────────────────────────────────────────

  const [player, setPlayer] = useState<BattleMonster>(() => createBattleMonster(initialPlayer));
  const [enemyState, setEnemyState] = useState<BattleMonster>(() => createBattleMonster(initialEnemy));
  const [phase, setPhase] = useState<BattlePhase>("IDLE");
  const [isResultSent, setIsResultSent] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // ─── Phaser 마운트 ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!gameRef.current) return;

    setBattleInitData({
      playerImageUrl: MONSTER_IMAGE_MAP[initialPlayer.id] ?? "",
      playerName: initialPlayer.name,
      playerLevel: createBattleMonster(initialPlayer).level,
      enemyImageUrl: MONSTER_IMAGE_MAP[initialEnemy.id] ?? "",
      enemyName: initialEnemy.name,
      enemyLevel: createBattleMonster(initialEnemy).level,
      floor,
    });

    const game = createBattleGame(gameRef.current);

    // Phaser → React 이동 이벤트
    const onNextFloor = () => navigate("/battle", { state: { floor: floor + 1, isCatchZone } });
    const onRetry = () => navigate("/battle", { state: { floor, isCatchZone } });
    gameEvents.on(GAME_EVENT.BATTLE_NEXT_FLOOR, onNextFloor);
    gameEvents.on(GAME_EVENT.BATTLE_RETRY, onRetry);

    return () => {
      gameEvents.emit(GAME_EVENT.BATTLE_END);
      gameEvents.off(GAME_EVENT.BATTLE_NEXT_FLOOR, onNextFloor);
      gameEvents.off(GAME_EVENT.BATTLE_RETRY, onRetry);
      game.destroy(true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── HP 동기화 ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    gameEvents.emit(GAME_EVENT.BATTLE_STATE_UPDATE, {
      playerHp: player.currentHp,
      playerMaxHp: player.maxHp,
      playerStatus: player.status,
      enemyHp: enemyState.currentHp,
      enemyMaxHp: enemyState.maxHp,
      enemyStatus: enemyState.status,
    });
  }, [player, enemyState]);

  // ─── 로그 헬퍼 ──────────────────────────────────────────────────────────────────

  const sendLog = (text: string) => gameEvents.emit(GAME_EVENT.BATTLE_LOG, text);

  // ─── 결과 전송 ──────────────────────────────────────────────────────────────────

  const sendResult = (outcome: "win" | "lose") => {
    if (isResultSent) return;
    setIsResultSent(true);
    gameEvents.emit(GAME_EVENT.BATTLE_RESULT, { outcome, floor });
  };

  // ─── 공격 처리 ──────────────────────────────────────────────────────────────────

  const runAttack = (
    attacker: BattleMonster,
    defender: BattleMonster,
    move: Move,
    label: string
  ): { updatedDefender: BattleMonster; fainted: boolean } => {
    const res = calculateDamage(attacker, defender, move);
    sendLog(`${label}의 ${move.name}!`);

    if (!res.isHit) {
      sendLog("공격이 빗나갔다!");
      return { updatedDefender: defender, fainted: false };
    }

    let next = defender;
    if (res.damage > 0) {
      next = applyDamage(defender, res.damage);
      sendLog(`${res.damage}의 피해를 입혔다.`);
    }

    if (res.multiplier >= 2) sendLog("효과가 굉장했다!");
    else if (res.multiplier < 1) sendLog("효과가 별로인 듯하다...");

    if (move.statusEffect && (move.statusChance ?? 0) > 0) {
      if (Math.random() * 100 <= (move.statusChance ?? 0)) {
        const before = next.status;
        next = applyStatusEffect(next, move.statusEffect);
        if (before === null && next.status !== null) {
          sendLog(`${next.name}에게 ${STATUS_LABELS[next.status] ?? next.status} 상태이상이 걸렸다!`);
        }
      }
    }

    const fainted = isFainted(next);
    if (fainted) sendLog(`${defender.name}이(가) 쓰러졌다!`);
    return { updatedDefender: next, fainted };
  };

  const handlePlayerWin = (p: BattleMonster, e: BattleMonster) => {
    const exp = gainExp(p, e.rewardExp);
    setPlayer(exp.updatedMonster);
    sendLog(`${exp.updatedMonster.name}이(가) 경험치 ${e.rewardExp}를 획득했다!`);
    if (exp.leveledUp) sendLog(`레벨이 ${exp.updatedMonster.level}(으)로 올랐다!`);
    setPhase("RESULT");
    setIsProcessing(false);
    sendResult("win");
  };

  // ─── 스킬 선택 ──────────────────────────────────────────────────────────────────

  const handleMoveClick = async (move: Move) => {
    if (isProcessing || isResultSent) return;
    setIsProcessing(true);
    setPhase("PLAYER_TURN");

    let np = player;
    let ne = enemyState;
    const eMove = getAIAction(ne, np);
    const playerFirst = np.speed >= ne.speed;

    if (playerFirst) {
      const ps = checkStatusEffects(np);
      np = ps.monster; setPlayer(np);
      ps.logs.forEach(sendLog);

      if (!ps.skipTurn) {
        const a = runAttack(np, ne, move, np.name);
        ne = a.updatedDefender; setEnemyState(ne);
        if (a.fainted) { handlePlayerWin(np, ne); return; }
      }

      await new Promise((r) => setTimeout(r, 500));
      setPhase("ENEMY_TURN");

      const es = checkStatusEffects(ne);
      ne = es.monster; setEnemyState(ne);
      es.logs.forEach(sendLog);

      if (!es.skipTurn) {
        const a = runAttack(ne, np, eMove, ne.name);
        np = a.updatedDefender; setPlayer(np);
        if (a.fainted) { setPhase("RESULT"); setIsProcessing(false); sendResult("lose"); return; }
      }
    } else {
      const es = checkStatusEffects(ne);
      ne = es.monster; setEnemyState(ne);
      es.logs.forEach(sendLog);
      setPhase("ENEMY_TURN");

      if (!es.skipTurn) {
        const a = runAttack(ne, np, eMove, ne.name);
        np = a.updatedDefender; setPlayer(np);
        if (a.fainted) { setPhase("RESULT"); setIsProcessing(false); sendResult("lose"); return; }
      }

      await new Promise((r) => setTimeout(r, 500));
      setPhase("PLAYER_TURN");

      const ps = checkStatusEffects(np);
      np = ps.monster; setPlayer(np);
      ps.logs.forEach(sendLog);

      if (!ps.skipTurn) {
        const a = runAttack(np, ne, move, np.name);
        ne = a.updatedDefender; setEnemyState(ne);
        if (a.fainted) { handlePlayerWin(np, ne); return; }
      }
    }

    setPhase("IDLE");
    setIsProcessing(false);
  };

  // ─── 포획 ────────────────────────────────────────────────────────────────────────

  const handleCatch = () => {
    if (isProcessing || isResultSent) return;
    setIsProcessing(true);
    setPhase("CATCH_PHASE");

    const res = checkCatchCondition(enemyState, isCatchZone);
    sendLog(res.message);

    if (!res.canAttempt) { setPhase("IDLE"); setIsProcessing(false); return; }

    if (res.success) {
      setPhase("RESULT");
      sendResult("win");
    } else {
      setPhase("ENEMY_TURN");
      const em = getAIAction(enemyState, player);
      const atk = runAttack(enemyState, player, em, enemyState.name);
      setPlayer(atk.updatedDefender);
      if (atk.fainted) { setPhase("RESULT"); sendResult("lose"); }
      else setPhase("IDLE");
    }
    setIsProcessing(false);
  };

  // ─── 렌더 ────────────────────────────────────────────────────────────────────────

  const isIdle = phase === "IDLE" && !isResultSent;
  const canShowCatch = isCatchZone && enemyState.currentHp / enemyState.maxHp <= 0.3 && isIdle;
  const playerHpPct = (player.currentHp / player.maxHp) * 100;

  return (
    <div className="flex h-screen flex-col bg-zinc-950 text-white overflow-hidden">
      {/* ── Phaser 캔버스 ── */}
      <div ref={gameRef} className="relative flex-1 min-h-0" />

      {/* ── 하단 기술 패널 ── */}
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
                    backgroundColor: playerHpPct > 50 ? "#44ee66" : playerHpPct > 20 ? "#eecc22" : "#ff4444",
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

        {/* 기술 버튼 (결과 없을 때만) */}
        {!isResultSent && (
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
        )}

        {/* 포획 버튼 */}
        {canShowCatch && (
          <button
            onClick={handleCatch}
            disabled={isProcessing}
            className="mt-2 w-full rounded-lg border border-sky-700 bg-sky-950/50 py-2 text-sm font-semibold text-sky-300 hover:bg-sky-900/50 disabled:opacity-35"
          >
            포획 시도 {enemyState.status ? "(상태이상 보너스)" : ""}
          </button>
        )}

        {/* 결과 대기 안내 */}
        {isResultSent && (
          <p className="text-center text-sm text-zinc-600 py-2">
            Q 또는 화면을 클릭해 계속하세요
          </p>
        )}
      </div>
    </div>
  );
}
