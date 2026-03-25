import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { monsters } from "../data/monsters";
import type { Move } from "../types/game";

import battleBg from "../assets/backgrounds/battle-bg.png";
import flamelingImg from "../assets/monsters/flameling.png";
import aquabeImg from "../assets/monsters/aquabe.png";
import leafyImg from "../assets/monsters/leafy.png";
import burnoImg from "../assets/monsters/burno.png";
import bubbletImg from "../assets/monsters/bubblet.png";
import mossyImg from "../assets/monsters/mossy.png";

import {
  applyDamage,
  calculateDamage,
  createBattleMonster,
  gainExp,
  getTypeMultiplier,
  isFainted,
  type BattleMonster,
} from "../utils/battle";

type BattleResult = "idle" | "player-win" | "enemy-win";

type BattleRouteState = {
  from?: string;
  portalId?: string;
};

export default function BattlePage() {
  const navigate = useNavigate();
  const location = useLocation();

  const routeState = location.state as BattleRouteState | undefined;
  const from = routeState?.from ?? "unknown";
  const portalId = routeState?.portalId ?? "none";

  const initialPlayerMonster = monsters[0];

  const getRandomEnemyMonster = () => {
    const enemyCandidates = monsters.filter(
      (monster) => monster.id !== initialPlayerMonster.id,
    );

    const randomIndex = Math.floor(Math.random() * enemyCandidates.length);
    return enemyCandidates[randomIndex];
  };

  const initialEnemyMonster = getRandomEnemyMonster();

  const [player, setPlayer] = useState<BattleMonster>(() =>
    createBattleMonster(initialPlayerMonster),
  );
  const [enemy, setEnemy] = useState<BattleMonster>(() =>
    createBattleMonster(initialEnemyMonster),
  );
  const [logs, setLogs] = useState<string[]>([
    `전투 시작! 야생의 ${initialEnemyMonster.name}이(가) 나타났다!`,
  ]);
  const [result, setResult] = useState<BattleResult>("idle");
  const [isProcessing, setIsProcessing] = useState(false);

  const addLog = (text: string) => {
    setLogs((prev) => [...prev, text]);
  };

  const resetBattle = () => {
    const newEnemyMonster = getRandomEnemyMonster();

    setPlayer((prevPlayer) => ({
      ...prevPlayer,
      currentHp: prevPlayer.maxHp,
    }));
    setEnemy(createBattleMonster(newEnemyMonster));
    setLogs([`전투 시작! 야생의 ${newEnemyMonster.name}이(가) 나타났다!`]);
    setResult("idle");
    setIsProcessing(false);
  };

  const getEffectText = (multiplier: number) => {
    if (multiplier >= 2) return "효과가 굉장했다!";
    if (multiplier < 1) return "효과가 별로인 듯하다...";
    return "";
  };

  const getRandomEnemyMove = (enemyMonster: BattleMonster) => {
    const index = Math.floor(Math.random() * enemyMonster.moves.length);
    return enemyMonster.moves[index];
  };

  const runAttack = (
    attacker: BattleMonster,
    defender: BattleMonster,
    move: Move,
    attackerLabel: string,
  ) => {
    const attackResult = calculateDamage(attacker, defender, move);

    addLog(`${attackerLabel}의 ${move.name}!`);

    if (!attackResult.isHit) {
      addLog("공격이 빗나갔다!");
      return {
        updatedDefender: defender,
        fainted: false,
      };
    }

    const nextDefender = applyDamage(defender, attackResult.damage);
    addLog(`${attackResult.damage}의 피해를 입혔다.`);

    const effectText = getEffectText(attackResult.multiplier);
    if (effectText) {
      addLog(effectText);
    }

    const fainted = isFainted(nextDefender);
    if (fainted) {
      addLog(`${defender.name}이(가) 쓰러졌다!`);
    }

    return {
      updatedDefender: nextDefender,
      fainted,
    };
  };

  const handlePlayerWin = (
    currentPlayer: BattleMonster,
    defeatedEnemy: BattleMonster,
  ) => {
    const expResult = gainExp(currentPlayer, defeatedEnemy.rewardExp);
    const updatedPlayer = expResult.updatedMonster;

    setPlayer(updatedPlayer);
    addLog(
      `${updatedPlayer.name}이(가) 경험치 ${defeatedEnemy.rewardExp}를 획득했다!`,
    );

    if (expResult.leveledUp) {
      addLog(
        `${updatedPlayer.name}의 레벨이 ${updatedPlayer.level}(으)로 올랐다!`,
      );
    }

    setResult("player-win");
    setIsProcessing(false);
  };

  const handleMoveClick = async (move: Move) => {
    if (isProcessing || result !== "idle") return;

    setIsProcessing(true);

    let nextPlayer = player;
    let nextEnemy = enemy;

    const enemyMove = getRandomEnemyMove(nextEnemy);
    const playerFirst = nextPlayer.speed >= nextEnemy.speed;

    if (playerFirst) {
      const firstAttack = runAttack(
        nextPlayer,
        nextEnemy,
        move,
        nextPlayer.name,
      );
      nextEnemy = firstAttack.updatedDefender;
      setEnemy(nextEnemy);

      if (firstAttack.fainted) {
        handlePlayerWin(nextPlayer, nextEnemy);
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 500));

      const secondAttack = runAttack(
        nextEnemy,
        nextPlayer,
        enemyMove,
        nextEnemy.name,
      );
      nextPlayer = secondAttack.updatedDefender;
      setPlayer(nextPlayer);

      if (secondAttack.fainted) {
        setResult("enemy-win");
        setIsProcessing(false);
        return;
      }
    } else {
      const firstAttack = runAttack(
        nextEnemy,
        nextPlayer,
        enemyMove,
        nextEnemy.name,
      );
      nextPlayer = firstAttack.updatedDefender;
      setPlayer(nextPlayer);

      if (firstAttack.fainted) {
        setResult("enemy-win");
        setIsProcessing(false);
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 500));

      const secondAttack = runAttack(
        nextPlayer,
        nextEnemy,
        move,
        nextPlayer.name,
      );
      nextEnemy = secondAttack.updatedDefender;
      setEnemy(nextEnemy);

      if (secondAttack.fainted) {
        handlePlayerWin(nextPlayer, nextEnemy);
        return;
      }
    }

    setIsProcessing(false);
  };

  const playerHpPercent = (player.currentHp / player.maxHp) * 100;
  const playerExpPercent = (player.exp / player.expToNextLevel) * 100;
  const enemyHpPercent = (enemy.currentHp / enemy.maxHp) * 100;

  const monsterImageMap: Record<string, string> = {
    flameling: flamelingImg,
    aquabe: aquabeImg,
    leafy: leafyImg,
    burno: burnoImg,
    bubblet: bubbletImg,
    mossy: mossyImg,
  };

  const playerImage = monsterImageMap[player.id];
  const enemyImage = monsterImageMap[enemy.id];

  return (
    <div className="min-h-screen bg-zinc-950 px-6 py-8 text-white">
      <button
        onClick={() => navigate("/")}
        className="absolute left-6 top-6 z-50 rounded-lg bg-black/60 px-4 py-2 text-sm text-white backdrop-blur hover:bg-black/80"
      >
        ← 베이스캠프로
      </button>

      <div className="mx-auto max-w-5xl">
        <h1 className="mb-6 text-3xl font-bold">몬스터 배틀 MVP</h1>

        <div className="mb-4 rounded-xl bg-zinc-800 px-4 py-3 text-sm text-zinc-300">
          <p>from: {from}</p>
          <p>portalId: {portalId}</p>
        </div>

        <div
          className="relative mb-6 h-[420px] overflow-hidden rounded-3xl border border-zinc-800 bg-cover bg-center shadow-2xl"
          style={{ backgroundImage: `url(${battleBg})` }}
        >
          <div className="absolute inset-0 bg-black/15" />

          {/* 적 상태창 */}
          <div className="absolute right-6 top-6 z-20 w-64 rounded-2xl border border-white/10 bg-black/45 p-4 backdrop-blur-md">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-2xl font-bold text-white">{enemy.name}</h3>
              </div>
              <div className="rounded-lg bg-white/10 px-2 py-1 text-sm text-zinc-200">
                Lv. {enemy.level}
              </div>
            </div>

            <div className="mt-4">
              <div className="mb-1 flex justify-between text-xs text-zinc-300">
                <span>HP</span>
                <span>
                  {enemy.currentHp} / {enemy.maxHp}
                </span>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-rose-400 transition-all duration-300"
                  style={{ width: `${enemyHpPercent}%` }}
                />
              </div>
            </div>
          </div>

          {/* 플레이어 상태창 */}
          <div className="absolute left-6 top-6 z-20 w-72 rounded-2xl border border-white/10 bg-black/45 p-4 backdrop-blur-md">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-2xl font-bold text-white">{player.name}</h3>
              </div>
              <div className="rounded-lg bg-white/10 px-2 py-1 text-sm text-zinc-200">
                Lv. {player.level}
              </div>
            </div>

            <div className="mt-4">
              <div className="mb-1 flex justify-between text-xs text-zinc-300">
                <span>HP</span>
                <span>
                  {player.currentHp} / {player.maxHp}
                </span>
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
                <span>
                  {player.exp} / {player.expToNextLevel}
                </span>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-sky-400 transition-all duration-300"
                  style={{ width: `${playerExpPercent}%` }}
                />
              </div>
            </div>
          </div>

          {/* 몬스터 이미지 */}
          <div className="relative z-10 flex h-full items-end justify-between px-12 py-8">
            <div className="flex flex-col items-center">
              <img
                src={playerImage}
                alt={player.name}
                className="battle-monster-player h-40 w-40 object-contain"
              />
            </div>

            <div className="flex flex-col items-center">
              <img
                src={enemyImage}
                alt={enemy.name}
                className="battle-monster-enemy h-40 w-40 object-contain"
              />
            </div>
          </div>
        </div>

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
                    타입: {move.type} / 위력: {move.power} / 명중:{" "}
                    {move.accuracy}
                  </p>

                  {multiplier > 1 && (
                    <p className="mt-2 text-sm text-emerald-400">
                      상성 우위 기술
                    </p>
                  )}

                  {multiplier < 1 && (
                    <p className="mt-2 text-sm text-yellow-400">
                      상성이 좋지 않음
                    </p>
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-5 flex gap-3">
            <button
              onClick={resetBattle}
              className="rounded-xl bg-white px-4 py-2 font-medium text-black"
            >
              다시 시작
            </button>

            {result === "player-win" && (
              <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/15 pointer-events-none">
                <div className="rounded-xl bg-emerald-500/25 px-6 py-3 text-xl font-bold text-emerald-300 backdrop-blur-md shadow-lg">
                  플레이어 승리!
                </div>
              </div>
            )}

            {result === "enemy-win" && (
              <div className="rounded-xl bg-rose-500/20 px-4 py-2 text-rose-300">
                적 승리!
              </div>
            )}
          </div>
        </div>

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