import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { monsters } from "../data/monsters";
import type { Move, BattlePhase, BattleOutcome } from "../types/game";

import battleBg from "../assets/backgrounds/battle-bg.png";
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

// ─── 로컬 타입 ───────────────────────────────────────────────────────────────────

type BattleRouteState = {
  from?: string;
  portalId?: string;
  /** 포획 가능 구간 여부 (포탈 진입 시 전달) */
  isCatchZone?: boolean;
};

// ─── 상태이상 한글 배지 ──────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  paralysis: "⚡ 마비",
  poison: "☠ 독",
  freeze: "❄ 빙결",
  burn: "🔥 화상",
};

// ─── 몬스터 이미지 맵 ────────────────────────────────────────────────────────────

const MONSTER_IMAGE_MAP: Record<string, string> = {
  flameling: flamelingImg,
  aquabe: aquabeImg,
  leafy: leafyImg,
  burno: burnoImg,
  bubblet: bubbletImg,
  mossy: mossyImg,
};

// ─── 컴포넌트 ────────────────────────────────────────────────────────────────────

export default function BattlePage() {
  const navigate = useNavigate();
  const location = useLocation();

  // 라우트 상태 (베이스캠프 포탈에서 전달)
  const routeState = location.state as BattleRouteState | undefined;
  const from = routeState?.from ?? "unknown";
  const portalId = routeState?.portalId ?? "none";
  const isCatchZone = routeState?.isCatchZone ?? false;

  // Phaser 캔버스 마운트 대상
  const gameRef = useRef<HTMLDivElement | null>(null);

  // ─── 초기 몬스터 세팅 ─────────────────────────────────────────────────────────

  const initialPlayerMonster = monsters[0];

  const getRandomEnemyMonster = () => {
    const candidates = monsters.filter((m) => m.id !== initialPlayerMonster.id);
    return candidates[Math.floor(Math.random() * candidates.length)];
  };

  const initialEnemyMonster = getRandomEnemyMonster();

  // ─── 전투 상태 ────────────────────────────────────────────────────────────────

  const [player, setPlayer] = useState<BattleMonster>(() =>
    createBattleMonster(initialPlayerMonster)
  );
  const [enemy, setEnemy] = useState<BattleMonster>(() =>
    createBattleMonster(initialEnemyMonster)
  );

  /** 전투 페이즈 상태 머신: IDLE → PLAYER_TURN → ENEMY_TURN → CATCH_PHASE → RESULT */
  const [phase, setPhase] = useState<BattlePhase>("IDLE");

  /** 전투 최종 결과 */
  const [result, setResult] = useState<BattleOutcome>("idle");

  /** 액션 처리 중 버튼 비활성화 플래그 */
  const [isProcessing, setIsProcessing] = useState(false);

  /** 전투 로그 목록 */
  const [logs, setLogs] = useState<string[]>([
    `전투 시작! 야생의 ${initialEnemyMonster.name}이(가) 나타났다!`,
  ]);

  // ─── Phaser BattleScene 마운트 ───────────────────────────────────────────────

  useEffect(() => {
    if (!gameRef.current) return;

    // BattleScene preload()가 읽을 이미지 URL 먼저 등록
    setBattleInitData({
      playerImageUrl: MONSTER_IMAGE_MAP[initialPlayerMonster.id] ?? "",
      enemyImageUrl: MONSTER_IMAGE_MAP[initialEnemyMonster.id] ?? "",
      bgImageUrl: battleBg,
    });

    const game = createBattleGame(gameRef.current);

    return () => {
      // 페이지 언마운트 시 Phaser 게임 정리
      gameEvents.emit(GAME_EVENT.BATTLE_END);
      game.destroy(true);
    };
    // 초기 몬스터는 한 번만 세팅하므로 의존성 배열 비움
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── BattleScene 비주얼 동기화 ───────────────────────────────────────────────

  /** 상태 변경 시마다 BattleScene에 최신 HP·상태이상 전송 */
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

  // ─── 유틸 함수 ───────────────────────────────────────────────────────────────

  const addLog = (text: string) => setLogs((prev) => [...prev, text]);

  const addLogs = (texts: string[]) =>
    setLogs((prev) => [...prev, ...texts]);

  /** 상성 배율을 한글 문구로 변환 */
  const getEffectText = (multiplier: number) => {
    if (multiplier >= 2) return "효과가 굉장했다!";
    if (multiplier < 1) return "효과가 별로인 듯하다...";
    return "";
  };

  /**
   * 공격자가 방어자에게 스킬을 사용하는 단일 공격 처리
   * - 데미지 계산 및 적용
   * - 상태이상 발동 처리 (move.statusEffect + move.statusChance)
   * 반환값: 갱신된 방어자 상태, 기절 여부
   */
  const runAttack = (
    attacker: BattleMonster,
    defender: BattleMonster,
    move: Move,
    attackerLabel: string
  ): { updatedDefender: BattleMonster; fainted: boolean } => {
    const attackResult = calculateDamage(attacker, defender, move);

    addLog(`${attackerLabel}의 ${move.name}!`);

    if (!attackResult.isHit) {
      addLog("공격이 빗나갔다!");
      return { updatedDefender: defender, fainted: false };
    }

    let nextDefender = defender;

    // 데미지가 있는 경우 적용
    if (attackResult.damage > 0) {
      nextDefender = applyDamage(defender, attackResult.damage);
      addLog(`${attackResult.damage}의 피해를 입혔다.`);
    }

    // 상성 효과 출력
    const effectText = getEffectText(attackResult.multiplier);
    if (effectText) addLog(effectText);

    // 상태이상 발동 체크 (해당 스킬에 statusEffect가 있을 때만)
    if (move.statusEffect && (move.statusChance ?? 0) > 0) {
      const roll = Math.random() * 100;
      if (roll <= (move.statusChance ?? 0)) {
        const before = nextDefender.status;
        nextDefender = applyStatusEffect(nextDefender, move.statusEffect);
        // 새로 상태이상이 적용된 경우만 로그 출력
        if (before === null && nextDefender.status !== null) {
          const label = STATUS_LABELS[nextDefender.status] ?? nextDefender.status;
          addLog(`${nextDefender.name}에게 ${label} 상태이상이 걸렸다!`);
        }
      }
    }

    const fainted = isFainted(nextDefender);
    if (fainted) addLog(`${defender.name}이(가) 쓰러졌다!`);

    return { updatedDefender: nextDefender, fainted };
  };

  /** 플레이어 승리 처리 (경험치 획득 + 결과 설정) */
  const handlePlayerWin = (
    currentPlayer: BattleMonster,
    defeatedEnemy: BattleMonster
  ) => {
    const expResult = gainExp(currentPlayer, defeatedEnemy.rewardExp);
    const updatedPlayer = expResult.updatedMonster;
    setPlayer(updatedPlayer);
    addLog(
      `${updatedPlayer.name}이(가) 경험치 ${defeatedEnemy.rewardExp}를 획득했다!`
    );
    if (expResult.leveledUp) {
      addLog(
        `${updatedPlayer.name}의 레벨이 ${updatedPlayer.level}(으)로 올랐다!`
      );
    }
    setResult("player-win");
    setPhase("RESULT");
    setIsProcessing(false);
  };

  // ─── 스킬 사용 ────────────────────────────────────────────────────────────────

  /**
   * 플레이어가 스킬을 선택했을 때 전투 턴 진행
   * 순서: 속도 비교 → 빠른 쪽 먼저 공격 → 상태이상 처리 → 양측 공격
   */
  const handleMoveClick = async (move: Move) => {
    if (isProcessing || result !== "idle") return;

    setIsProcessing(true);
    setPhase("PLAYER_TURN");

    let nextPlayer = player;
    let nextEnemy = enemy;

    // AI가 이번 턴에 사용할 스킬 결정 (상성 기반)
    const enemyMove = getAIAction(nextEnemy, nextPlayer);

    // ── 플레이어가 빠른 경우 ──
    const playerFirst = nextPlayer.speed >= nextEnemy.speed;

    if (playerFirst) {
      // 1. 플레이어 상태이상 체크
      const playerStatus = checkStatusEffects(nextPlayer);
      nextPlayer = playerStatus.monster;
      setPlayer(nextPlayer);
      if (playerStatus.logs.length) addLogs(playerStatus.logs);

      // 2. 플레이어 공격 (마비/빙결로 스킵이 아닐 때)
      if (!playerStatus.skipTurn) {
        const atk = runAttack(nextPlayer, nextEnemy, move, nextPlayer.name);
        nextEnemy = atk.updatedDefender;
        setEnemy(nextEnemy);
        if (atk.fainted) {
          handlePlayerWin(nextPlayer, nextEnemy);
          return;
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 500));
      setPhase("ENEMY_TURN");

      // 3. 적 상태이상 체크
      const enemyStatus = checkStatusEffects(nextEnemy);
      nextEnemy = enemyStatus.monster;
      setEnemy(nextEnemy);
      if (enemyStatus.logs.length) addLogs(enemyStatus.logs);

      // 4. 적 공격 (마비/빙결로 스킵이 아닐 때)
      if (!enemyStatus.skipTurn) {
        const atk = runAttack(nextEnemy, nextPlayer, enemyMove, nextEnemy.name);
        nextPlayer = atk.updatedDefender;
        setPlayer(nextPlayer);
        if (atk.fainted) {
          setResult("enemy-win");
          setPhase("RESULT");
          setIsProcessing(false);
          return;
        }
      }
    } else {
      // ── 적이 빠른 경우 ──

      // 1. 적 상태이상 체크
      const enemyStatus = checkStatusEffects(nextEnemy);
      nextEnemy = enemyStatus.monster;
      setEnemy(nextEnemy);
      if (enemyStatus.logs.length) addLogs(enemyStatus.logs);

      setPhase("ENEMY_TURN");

      // 2. 적 공격
      if (!enemyStatus.skipTurn) {
        const atk = runAttack(nextEnemy, nextPlayer, enemyMove, nextEnemy.name);
        nextPlayer = atk.updatedDefender;
        setPlayer(nextPlayer);
        if (atk.fainted) {
          setResult("enemy-win");
          setPhase("RESULT");
          setIsProcessing(false);
          return;
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 500));
      setPhase("PLAYER_TURN");

      // 3. 플레이어 상태이상 체크
      const playerStatus = checkStatusEffects(nextPlayer);
      nextPlayer = playerStatus.monster;
      setPlayer(nextPlayer);
      if (playerStatus.logs.length) addLogs(playerStatus.logs);

      // 4. 플레이어 공격
      if (!playerStatus.skipTurn) {
        const atk = runAttack(nextPlayer, nextEnemy, move, nextPlayer.name);
        nextEnemy = atk.updatedDefender;
        setEnemy(nextEnemy);
        if (atk.fainted) {
          handlePlayerWin(nextPlayer, nextEnemy);
          return;
        }
      }
    }

    setPhase("IDLE");
    setIsProcessing(false);
  };

  // ─── 포획 시도 ────────────────────────────────────────────────────────────────

  /** 포획 버튼 클릭 처리 */
  const handleCatch = () => {
    if (isProcessing || result !== "idle") return;

    setIsProcessing(true);
    setPhase("CATCH_PHASE");

    const catchResult = checkCatchCondition(enemy, isCatchZone);

    addLog(catchResult.message);

    if (!catchResult.canAttempt) {
      // 포획 불가 → 그냥 턴 소모
      setPhase("IDLE");
      setIsProcessing(false);
      return;
    }

    if (catchResult.success) {
      setResult("caught");
      setPhase("RESULT");
    } else {
      // 포획 실패 → 적 공격 진행
      setPhase("ENEMY_TURN");
      const enemyMove = getAIAction(enemy, player);
      const atk = runAttack(enemy, player, enemyMove, enemy.name);
      setPlayer(atk.updatedDefender);
      if (atk.fainted) {
        setResult("enemy-win");
        setPhase("RESULT");
      } else {
        setPhase("IDLE");
      }
    }

    setIsProcessing(false);
  };

  // ─── 재시작 ───────────────────────────────────────────────────────────────────

  const resetBattle = () => {
    const newEnemy = getRandomEnemyMonster();

    // 플레이어는 HP만 회복 (스탯·레벨·경험치 유지)
    setPlayer((prev) => ({
      ...prev,
      currentHp: prev.maxHp,
      status: null,
      skipNextTurn: false,
    }));
    setEnemy(createBattleMonster(newEnemy));
    setLogs([`전투 시작! 야생의 ${newEnemy.name}이(가) 나타났다!`]);
    setResult("idle");
    setPhase("IDLE");
    setIsProcessing(false);
  };

  // ─── 파생 값 ─────────────────────────────────────────────────────────────────

  const playerHpPercent = (player.currentHp / player.maxHp) * 100;
  const playerExpPercent = (player.exp / player.expToNextLevel) * 100;
  const enemyHpPercent = (enemy.currentHp / enemy.maxHp) * 100;

  /** 포획 버튼 활성화 조건: catchZone이고 적 HP 30% 이하 */
  const canShowCatch =
    isCatchZone && enemy.currentHp / enemy.maxHp <= 0.3 && result === "idle";

  // ─── 렌더 ─────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-zinc-950 px-6 py-8 text-white">
      {/* 베이스캠프 복귀 버튼 */}
      <button
        onClick={() => navigate("/")}
        className="absolute left-6 top-6 z-50 rounded-lg bg-black/60 px-4 py-2 text-sm text-white backdrop-blur hover:bg-black/80"
      >
        ← 베이스캠프로
      </button>

      <div className="mx-auto max-w-5xl">
        <h1 className="mb-6 text-3xl font-bold">몬스터 배틀</h1>

        {/* 디버그: 진입 정보 */}
        <div className="mb-4 rounded-xl bg-zinc-800 px-4 py-3 text-sm text-zinc-300">
          <p>from: {from} / portalId: {portalId}</p>
          <p>
            페이즈: <span className="font-semibold text-sky-300">{phase}</span>
            {isCatchZone && (
              <span className="ml-3 rounded bg-emerald-700/50 px-2 py-0.5 text-emerald-300">
                포획 가능 구간
              </span>
            )}
          </p>
        </div>

        {/* ── Phaser 전투 씬 캔버스 영역 ── */}
        <div className="relative mb-6 overflow-hidden rounded-3xl border border-zinc-800 shadow-2xl">
          {/* Phaser가 이 div 안에 canvas를 생성한다 */}
          <div ref={gameRef} style={{ width: "100%", height: "400px" }} />

          {/* React UI 오버레이: 적 상태창 */}
          <div className="absolute right-6 top-6 z-20 w-64 rounded-2xl border border-white/10 bg-black/55 p-4 backdrop-blur-md">
            <div className="flex items-start justify-between">
              <h3 className="text-2xl font-bold text-white">{enemy.name}</h3>
              <div className="rounded-lg bg-white/10 px-2 py-1 text-sm text-zinc-200">
                Lv. {enemy.level}
              </div>
            </div>

            {/* 적 상태이상 배지 */}
            {enemy.status && (
              <div className="mt-1 text-xs font-semibold text-yellow-300">
                {STATUS_LABELS[enemy.status]}
              </div>
            )}

            <div className="mt-3">
              <div className="mb-1 flex justify-between text-xs text-zinc-300">
                <span>HP</span>
                <span>{enemy.currentHp} / {enemy.maxHp}</span>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-rose-400 transition-all duration-300"
                  style={{ width: `${enemyHpPercent}%` }}
                />
              </div>
            </div>
          </div>

          {/* React UI 오버레이: 플레이어 상태창 */}
          <div className="absolute left-6 top-6 z-20 w-72 rounded-2xl border border-white/10 bg-black/55 p-4 backdrop-blur-md">
            <div className="flex items-start justify-between">
              <h3 className="text-2xl font-bold text-white">{player.name}</h3>
              <div className="rounded-lg bg-white/10 px-2 py-1 text-sm text-zinc-200">
                Lv. {player.level}
              </div>
            </div>

            {/* 플레이어 상태이상 배지 */}
            {player.status && (
              <div className="mt-1 text-xs font-semibold text-yellow-300">
                {STATUS_LABELS[player.status]}
              </div>
            )}

            <div className="mt-3">
              <div className="mb-1 flex justify-between text-xs text-zinc-300">
                <span>HP</span>
                <span>{player.currentHp} / {player.maxHp}</span>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-emerald-400 transition-all duration-300"
                  style={{ width: `${playerHpPercent}%` }}
                />
              </div>
            </div>

            <div className="mt-3">
              <div className="mb-1 flex justify-between text-xs text-zinc-300">
                <span>EXP</span>
                <span>{player.exp} / {player.expToNextLevel}</span>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-sky-400 transition-all duration-300"
                  style={{ width: `${playerExpPercent}%` }}
                />
              </div>
            </div>
          </div>

          {/* 승리 오버레이 */}
          {result === "player-win" && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/20 pointer-events-none">
              <div className="rounded-xl bg-emerald-500/25 px-6 py-3 text-xl font-bold text-emerald-300 backdrop-blur-md shadow-lg">
                플레이어 승리!
              </div>
            </div>
          )}

          {/* 포획 성공 오버레이 */}
          {result === "caught" && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/20 pointer-events-none">
              <div className="rounded-xl bg-sky-500/25 px-6 py-3 text-xl font-bold text-sky-300 backdrop-blur-md shadow-lg">
                포획 성공! 🎉
              </div>
            </div>
          )}
        </div>

        {/* ── 기술 선택 패널 ── */}
        <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="mb-4 text-lg font-semibold">기술 선택</p>

          <div className="grid gap-3 sm:grid-cols-2">
            {player.moves.map((move) => {
              const multiplier = getTypeMultiplier(move.type, enemy.type);
              return (
                <button
                  key={move.id}
                  onClick={() => handleMoveClick(move)}
                  disabled={isProcessing || result !== "idle"}
                  className="rounded-xl border border-zinc-700 bg-zinc-800 p-4 text-left transition hover:bg-zinc-700 disabled:opacity-50"
                >
                  <p className="text-lg font-medium">{move.name}</p>
                  <p className="text-sm text-zinc-400">
                    타입: {move.type} / 위력: {move.power} / 명중: {move.accuracy}
                  </p>
                  {move.statusEffect && (
                    <p className="mt-1 text-xs text-purple-400">
                      {STATUS_LABELS[move.statusEffect]} 유발 {move.statusChance}%
                    </p>
                  )}
                  {multiplier > 1 && (
                    <p className="mt-1 text-sm text-emerald-400">상성 우위 기술</p>
                  )}
                  {multiplier < 1 && (
                    <p className="mt-1 text-sm text-yellow-400">상성이 좋지 않음</p>
                  )}
                </button>
              );
            })}
          </div>

          {/* 포획 버튼 (catchZone + 적 HP 30% 이하일 때만 노출) */}
          {canShowCatch && (
            <button
              onClick={handleCatch}
              disabled={isProcessing}
              className="mt-4 w-full rounded-xl border border-sky-600 bg-sky-700/30 py-3 text-lg font-semibold text-sky-300 transition hover:bg-sky-700/50 disabled:opacity-50"
            >
              포획 시도
              {enemy.status && (
                <span className="ml-2 text-sm text-sky-400">
                  (상태이상 적용 중 — 포획률 ×1.5)
                </span>
              )}
            </button>
          )}

          {/* 액션 버튼 & 결과 표시 */}
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              onClick={resetBattle}
              className="rounded-xl bg-white px-4 py-2 font-medium text-black"
            >
              다시 시작
            </button>

            {result === "enemy-win" && (
              <div className="rounded-xl bg-rose-500/20 px-4 py-2 text-rose-300">
                적 승리!
              </div>
            )}

            {result === "caught" && (
              <div className="rounded-xl bg-sky-500/20 px-4 py-2 text-sky-300">
                {enemy.name} 포획 완료!
              </div>
            )}
          </div>
        </div>

        {/* ── 전투 로그 ── */}
        <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="mb-4 text-lg font-semibold">전투 로그</p>
          <div className="max-h-72 space-y-2 overflow-y-auto text-sm text-zinc-300">
            {logs.map((log, index) => (
              <p key={`${log}-${index}`}>{log}</p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
