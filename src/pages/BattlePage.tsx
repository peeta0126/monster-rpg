import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { monsters } from "../data/monsters";
import type { Move, BattlePhase, BattleOutcome } from "../types/game";

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
  /** 무한의 탑 현재 층 */
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

// ─── 기술 타입 색상 ──────────────────────────────────────────────────────────────

const TYPE_COLORS: Record<string, string> = {
  fire:     "border-red-700    bg-red-900/30    hover:bg-red-900/50",
  water:    "border-blue-700   bg-blue-900/30   hover:bg-blue-900/50",
  grass:    "border-green-700  bg-green-900/30  hover:bg-green-900/50",
  electric: "border-yellow-600 bg-yellow-900/30 hover:bg-yellow-900/50",
  ice:      "border-cyan-600   bg-cyan-900/30   hover:bg-cyan-900/50",
  normal:   "border-zinc-600   bg-zinc-800/60   hover:bg-zinc-700/60",
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

  const initialPlayerMonster = monsters[0];
  const getRandomEnemy = () => {
    const pool = monsters.filter((m) => m.id !== initialPlayerMonster.id);
    return pool[Math.floor(Math.random() * pool.length)];
  };
  const initialEnemyMonster = getRandomEnemy();

  // ─── 전투 상태 ──────────────────────────────────────────────────────────────────

  const [player, setPlayer] = useState<BattleMonster>(() => createBattleMonster(initialPlayerMonster));
  const [enemy, setEnemy] = useState<BattleMonster>(() => createBattleMonster(initialEnemyMonster));
  const [_phase, setPhase] = useState<BattlePhase>("IDLE");
  const [result, setResult] = useState<BattleOutcome>("idle");
  const [isProcessing, setIsProcessing] = useState(false);

  // ─── Phaser 마운트 ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!gameRef.current) return;
    setBattleInitData({
      playerImageUrl: MONSTER_IMAGE_MAP[initialPlayerMonster.id] ?? "",
      enemyImageUrl: MONSTER_IMAGE_MAP[initialEnemyMonster.id] ?? "",
      floor,
    });
    const game = createBattleGame(gameRef.current);
    return () => {
      gameEvents.emit(GAME_EVENT.BATTLE_END);
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
      enemyHp: enemy.currentHp,
      enemyMaxHp: enemy.maxHp,
      enemyStatus: enemy.status,
    });
  }, [player, enemy]);

  // ─── 로그 → Phaser 전송 ─────────────────────────────────────────────────────────

  const sendLog = (text: string) => gameEvents.emit(GAME_EVENT.BATTLE_LOG, text);

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

  const handlePlayerWin = (currentPlayer: BattleMonster, defeatedEnemy: BattleMonster) => {
    const expResult = gainExp(currentPlayer, defeatedEnemy.rewardExp);
    setPlayer(expResult.updatedMonster);
    sendLog(`${expResult.updatedMonster.name}이(가) 경험치 ${defeatedEnemy.rewardExp}를 획득했다!`);
    if (expResult.leveledUp) sendLog(`레벨이 ${expResult.updatedMonster.level}(으)로 올랐다!`);
    setResult("player-win");
    setPhase("RESULT");
    setIsProcessing(false);
  };

  // ─── 스킬 선택 ──────────────────────────────────────────────────────────────────

  const handleMoveClick = async (move: Move) => {
    if (isProcessing || result !== "idle") return;
    setIsProcessing(true);
    setPhase("PLAYER_TURN");

    let nextPlayer = player;
    let nextEnemy = enemy;
    const enemyMove = getAIAction(nextEnemy, nextPlayer);
    const playerFirst = nextPlayer.speed >= nextEnemy.speed;

    if (playerFirst) {
      const ps = checkStatusEffects(nextPlayer);
      nextPlayer = ps.monster;
      setPlayer(nextPlayer);
      ps.logs.forEach(sendLog);

      if (!ps.skipTurn) {
        const atk = runAttack(nextPlayer, nextEnemy, move, nextPlayer.name);
        nextEnemy = atk.updatedDefender;
        setEnemy(nextEnemy);
        if (atk.fainted) { handlePlayerWin(nextPlayer, nextEnemy); return; }
      }

      await new Promise((r) => setTimeout(r, 500));
      setPhase("ENEMY_TURN");

      const es = checkStatusEffects(nextEnemy);
      nextEnemy = es.monster;
      setEnemy(nextEnemy);
      es.logs.forEach(sendLog);

      if (!es.skipTurn) {
        const atk = runAttack(nextEnemy, nextPlayer, enemyMove, nextEnemy.name);
        nextPlayer = atk.updatedDefender;
        setPlayer(nextPlayer);
        if (atk.fainted) { setResult("enemy-win"); setPhase("RESULT"); setIsProcessing(false); return; }
      }
    } else {
      const es = checkStatusEffects(nextEnemy);
      nextEnemy = es.monster;
      setEnemy(nextEnemy);
      es.logs.forEach(sendLog);

      setPhase("ENEMY_TURN");

      if (!es.skipTurn) {
        const atk = runAttack(nextEnemy, nextPlayer, enemyMove, nextEnemy.name);
        nextPlayer = atk.updatedDefender;
        setPlayer(nextPlayer);
        if (atk.fainted) { setResult("enemy-win"); setPhase("RESULT"); setIsProcessing(false); return; }
      }

      await new Promise((r) => setTimeout(r, 500));
      setPhase("PLAYER_TURN");

      const ps = checkStatusEffects(nextPlayer);
      nextPlayer = ps.monster;
      setPlayer(nextPlayer);
      ps.logs.forEach(sendLog);

      if (!ps.skipTurn) {
        const atk = runAttack(nextPlayer, nextEnemy, move, nextPlayer.name);
        nextEnemy = atk.updatedDefender;
        setEnemy(nextEnemy);
        if (atk.fainted) { handlePlayerWin(nextPlayer, nextEnemy); return; }
      }
    }

    setPhase("IDLE");
    setIsProcessing(false);
  };

  // ─── 포획 ────────────────────────────────────────────────────────────────────────

  const handleCatch = () => {
    if (isProcessing || result !== "idle") return;
    setIsProcessing(true);
    setPhase("CATCH_PHASE");

    const catchResult = checkCatchCondition(enemy, isCatchZone);
    sendLog(catchResult.message);

    if (!catchResult.canAttempt) { setPhase("IDLE"); setIsProcessing(false); return; }

    if (catchResult.success) {
      setResult("caught");
      setPhase("RESULT");
    } else {
      setPhase("ENEMY_TURN");
      const enemyMove = getAIAction(enemy, player);
      const atk = runAttack(enemy, player, enemyMove, enemy.name);
      setPlayer(atk.updatedDefender);
      if (atk.fainted) { setResult("enemy-win"); setPhase("RESULT"); }
      else setPhase("IDLE");
    }
    setIsProcessing(false);
  };

  // ─── 다음 층 / 재시작 ────────────────────────────────────────────────────────────

  const handleNextFloor = () => {
    navigate("/battle", { state: { floor: floor + 1, isCatchZone } });
  };

  const resetBattle = () => {
    const newEnemy = getRandomEnemy();
    setPlayer((prev) => ({ ...prev, currentHp: prev.maxHp, status: null, skipNextTurn: false }));
    setEnemy(createBattleMonster(newEnemy));
    sendLog(`야생의 ${newEnemy.name}이(가) 나타났다!`);
    setResult("idle");
    setPhase("IDLE");
    setIsProcessing(false);
  };

  // ─── 파생값 ──────────────────────────────────────────────────────────────────────

  const canShowCatch = isCatchZone && enemy.currentHp / enemy.maxHp <= 0.3 && result === "idle";
  const isResultPhase = result !== "idle";

  // ─── 렌더 ────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-screen flex-col bg-zinc-950 text-white overflow-hidden">
      {/* ── Phaser 캔버스 (상단, 최대한 크게) ── */}
      <div className="relative flex-1 min-h-0">
        <div ref={gameRef} className="w-full h-full" />

        {/* 복귀 버튼 */}
        <button
          onClick={() => navigate("/")}
          className="absolute left-4 bottom-4 z-50 rounded bg-black/60 px-3 py-1.5 text-xs text-zinc-400 backdrop-blur hover:text-white hover:bg-black/80"
        >
          ← 나가기
        </button>
      </div>

      {/* ── 기술 선택 패널 (하단 고정) ── */}
      <div className="shrink-0 border-t border-zinc-800 bg-zinc-900/95 px-4 py-3">
        {/* 헤더: 몬스터 이름 + HP + 층 정보 */}
        <div className="mb-3 flex items-center justify-between text-sm">
          <div className="flex items-center gap-4">
            <span className="font-bold text-white">{player.name}</span>
            <span className="text-zinc-400">
              HP {player.currentHp}/{player.maxHp}
            </span>
            {player.status && (
              <span className="rounded bg-yellow-900/60 px-1.5 py-0.5 text-xs text-yellow-300">
                {STATUS_LABELS[player.status]}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-zinc-500 text-xs">
            <span>vs {enemy.name} Lv.{enemy.level}</span>
            <span className="rounded bg-orange-900/40 px-2 py-0.5 text-orange-400 font-mono">
              {floor}F
            </span>
          </div>
        </div>

        {/* 결과 상태 */}
        {isResultPhase && (
          <div className="mb-3 flex items-center gap-3">
            {result === "player-win" && (
              <>
                <span className="rounded bg-emerald-900/60 px-3 py-1 text-emerald-300 font-semibold">승리!</span>
                <button onClick={handleNextFloor} className="rounded bg-emerald-700 px-3 py-1 text-sm font-semibold hover:bg-emerald-600">
                  {floor + 1}층으로 →
                </button>
                <button onClick={resetBattle} className="rounded bg-zinc-700 px-3 py-1 text-sm hover:bg-zinc-600">
                  다시 시작
                </button>
              </>
            )}
            {result === "enemy-win" && (
              <>
                <span className="rounded bg-rose-900/60 px-3 py-1 text-rose-300 font-semibold">패배...</span>
                <button onClick={resetBattle} className="rounded bg-zinc-700 px-3 py-1 text-sm hover:bg-zinc-600">
                  다시 시작
                </button>
              </>
            )}
            {result === "caught" && (
              <>
                <span className="rounded bg-sky-900/60 px-3 py-1 text-sky-300 font-semibold">포획 성공!</span>
                <button onClick={handleNextFloor} className="rounded bg-sky-700 px-3 py-1 text-sm font-semibold hover:bg-sky-600">
                  {floor + 1}층으로 →
                </button>
              </>
            )}
          </div>
        )}

        {/* 기술 버튼 그리드 */}
        {!isResultPhase && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {player.moves.map((move) => {
              const mult = getTypeMultiplier(move.type, enemy.type);
              return (
                <button
                  key={move.id}
                  onClick={() => handleMoveClick(move)}
                  disabled={isProcessing}
                  className={`rounded-lg border px-3 py-2 text-left transition disabled:opacity-40 ${typeClass(move.type)}`}
                >
                  <p className="font-semibold text-sm text-white">{move.name}</p>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    {move.type} · {move.power}위력
                  </p>
                  {mult > 1 && <p className="text-xs text-emerald-400 mt-0.5">상성 우위</p>}
                  {mult < 1 && <p className="text-xs text-yellow-600 mt-0.5">상성 불리</p>}
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
            className="mt-2 w-full rounded-lg border border-sky-600 bg-sky-900/30 py-2 text-sm font-semibold text-sky-300 hover:bg-sky-900/50 disabled:opacity-40"
          >
            포획 시도 {enemy.status ? "(상태이상 보너스)" : ""}
          </button>
        )}
      </div>
    </div>
  );
}
