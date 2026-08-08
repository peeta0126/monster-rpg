import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { getFloorEnemy, getFloorEnemySkill, isBossFloor, MAX_TOWER_FLOOR, getTowerSecretReveal } from "../shared/floorTable";
import { MONSTER_IMAGE_MAP } from "../monster/monsterImages";
import { POTIONS, getMaterial } from "../shared/items";
import type { Move, ElementType } from "../shared/game";
import { usePlayerStore, type OwnedMonster } from "../shared/playerStore";
import { isAnomalyMove } from "../monster/learnset";
import { applyLevelGrowth } from "../monster/growth";
import { sumEquippedStatBonuses, sumEquippedBonusStats } from "../shared/craftingUtils";

/** OwnedMonster → 배틀 진입용 OwnedMonster. 장착 장비의 HP 보너스를 max/currentHp에 미리 반영한다.
 *  (공/방/속/치명/속성 보너스와 달리 HP는 전투 내내 상태로 유지해야 하는 값이라 별도 처리) */
function withOwnedHpBonus(m: OwnedMonster): OwnedMonster {
  const equipped = usePlayerStore.getState().equippedArtifacts[m.uid] ?? [];
  const hpBonus = sumEquippedStatBonuses(equipped).hp;
  if (!hpBonus) return m;
  return { ...m, maxHp: m.maxHp + hpBonus, currentHp: m.currentHp + hpBonus };
}

// ─── 전투 승리 시 재료 드랍 ───────────────────────────────────────────────────────

function rollBattleDrop(floor: number): { id: string; count: number }[] {
  const drops: { id: string; count: number }[] = [];
  const rollChance = isBossFloor(floor) ? 0.95 : 0.45;
  if (Math.random() > rollChance) return drops;

  // 층수별 드랍 테이블.
  // monster_essence(몬스터 정수)와 enhancement_stone(강화석)은 원래 어느 전투 드랍에도 없어
  // 상위 아티팩트 제작과 장비 레벨업이 통째로 막혀 있었다 — 상위 층 보상에 포함한다.
  const pool: string[] =
    floor >= 31 ? ["iron_fragment", "crystal", "monster_essence", "enhancement_stone"] :
    floor >= 21 ? ["iron_fragment", "crystal", "wood_plank", "monster_essence", "enhancement_stone"] :
    floor >= 11 ? ["iron_fragment", "wood_plank", "leather", "enhancement_stone"] :
                  ["wood_plank", "leather", "herb"];

  const count = isBossFloor(floor) ? 2 + (Math.random() < 0.5 ? 1 : 0) : 1;
  const picked = pool[Math.floor(Math.random() * pool.length)];
  drops.push({ id: picked, count });

  // 보스 층은 추가 드랍
  if (isBossFloor(floor) && Math.random() < 0.6) {
    const extra = pool.filter((p) => p !== picked)[Math.floor(Math.random() * (pool.length - 1))];
    drops.push({ id: extra, count: 1 });
  }

  return drops;
}

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
} from "./battleUtils";

import { gameEvents, GAME_EVENT } from "../shared/phaser/events";
import { createBattleGame } from "../shared/phaser/phaserConfig";
import { setBattleInitData } from "./battleInitStore";
import { PALETTE, hpToken, ELEMENT_CHIP_CLASS } from "../shared/palette";

// ─── 타입 ────────────────────────────────────────────────────────────────────────

type BattleRouteState = {
  from?: string;
  portalId?: string;
  isCatchZone?: boolean;
  floor?: number;
};

const STATUS_LABELS: Record<string, string> = {
  paralysis: "⚡마비", poison: "☠독", freeze: "❄빙결", burn: "🔥화상",
};

// 기술 버튼 색은 shared/palette.ts 의 ELEMENT_CHIP_CLASS 가 단일 출처다.
// 여기서 따로 정하면 숲·몬스터 화면과 속성 색이 어긋난다.
function typeClass(t: string) {
  return ELEMENT_CHIP_CLASS[t as keyof typeof ELEMENT_CHIP_CLASS] ?? ELEMENT_CHIP_CLASS.normal;
}

/** 출전하지 않은 파티원이 받는 경험치 비율 (출전 몬스터 대비) */
const BENCH_EXP_SHARE = 0.5;

// ─── 컴포넌트 ────────────────────────────────────────────────────────────────────

export default function BattlePage() {
  const navigate   = useNavigate();
  const location   = useLocation();
  const routeState = location.state as BattleRouteState | undefined;

  const isCatchZone = routeState?.isCatchZone ?? false;
  const floor       = routeState?.floor ?? 1;

  const gameRef = useRef<HTMLDivElement | null>(null);

  const { updateBestFloor, updatePartyMember, addCapturedMonster,
          addToDexSeen, addToDexCaught, usePotion: consumePotion,
          addMaterial, setStoryFlag, dexCaught, restorePartyHp } = usePlayerStore();

  // 장착 장비의 HP 보너스를 미리 반영한 파티 스냅샷 (공/방/속/치명/속성은 여기서 반영하지 않고
  // 데미지 계산 시점에만 임시로 더한다 — HP만 전투 내내 상태로 들고 있어야 하는 값이라 예외)
  const [initialParty] = useState(() => usePlayerStore.getState().party.map(withOwnedHpBonus));
  const [activePartyIndex, setActivePartyIndex] = useState(0);

  const [partyHp, setPartyHp] = useState<Record<string, number>>(() => {
    const m: Record<string, number> = {};
    for (const mon of initialParty) m[mon.uid] = mon.currentHp;
    return m;
  });
  const [mustSwitch, setMustSwitch] = useState(false);

  // 가방 패널 표시 여부
  const [showBag, setShowBag] = useState(false);
  // 실시간 물약 재고 (사용 시 갱신)
  const [potionCounts, setPotionCounts] = useState<Record<string, number>>(
    () => usePlayerStore.getState().potions,
  );

  const initialPlayer = initialParty[0] ?? usePlayerStore.getState().party[0];
  const initialEnemy  = getFloorEnemy(floor, initialPlayer.id);

  const [player,       setPlayer]       = useState<BattleMonster>(() => createBattleMonsterFromOwned(initialPlayer));
  const [enemyState,   setEnemyState]   = useState<BattleMonster>(() => createBattleMonster(initialEnemy));
  // BattleScene.create()가 BATTLE_LOG 리스너를 등록하기 전까지는 조작을 막는다
  // (그 전에 스킬을 쓰면 sendLogAndWait의 ACK를 영원히 못 받아 전투가 멈춤)
  const [isProcessing,  setIsProcessing]  = useState(true);
  const [battleOutcome, setBattleOutcome] = useState<"win" | "lose" | null>(null);
  const [showResultUI,  setShowResultUI]  = useState(false);
  const [battleDrops,   setBattleDrops]   = useState<{ id: string; count: number }[]>([]);
  /** 최근 전투 로그. 캔버스 로그는 한 줄씩 지나가 버려서 놓치면 확인할 방법이 없었다. */
  const [logHistory,    setLogHistory]    = useState<string[]>([]);
  /** 결과 화면에서 회복을 눌렀는지 (중복 클릭 방지 겸 피드백) */
  const [healed,        setHealed]        = useState(false);
  const [showLog,       setShowLog]       = useState(false);
  /** 기술 칸이 찼을 때 띄우는 "무엇을 잊을까" 선택 창 */
  const [forgetPrompt, setForgetPrompt] = useState<
    { current: Move[]; incoming: Move; resolve: (idx: number | null) => void } | null
  >(null);

  // BATTLE_READY 시점에 최신 값을 읽기 위한 참조 (마운트 effect의 클로저는 초기값에 묶여 있다)
  const playerRef = useRef(player);
  const enemyRef  = useRef(enemyState);
  playerRef.current = player;
  enemyRef.current  = enemyState;

  const enemyTurnRef = useRef(0);
  const cancelledRef = useRef(false);
  // 탑의 비밀 연출은 전투당 한 번만 (같은 보스가 금지된 기술을 여러 번 써도 재생 안 함)
  const towerSecretShownRef = useRef(false);

  // 50층(MAX_TOWER_FLOOR)이 탑의 끝 — 51층 이상 진입 요청은 베이스캠프로 돌려보낸다
  useEffect(() => {
    if (floor > MAX_TOWER_FLOOR) navigate("/", { replace: true });
  }, [floor, navigate]);

  useEffect(() => { cancelledRef.current = false; return () => { cancelledRef.current = true; }; }, []);
  // BattleScene의 BATTLE_LOG 리스너가 등록된 뒤에만 조작을 허용
  useEffect(() => {
    const onReady = () => {
      setIsProcessing(false);
      // 최초 HP를 한 번 더 보낸다. React의 마운트 effect가 씬 create()보다 먼저 돌아서
      // 첫 BATTLE_STATE_UPDATE를 아무도 받지 못했고, 그 탓에 전투 시작 시점에는
      // HP 수치가 빈 문자열로 남아 있었다(첫 공격이 오가야 비로소 채워졌다).
      syncHpToPhaser(playerRef.current, enemyRef.current);
    };
    gameEvents.once(GAME_EVENT.BATTLE_READY, onReady);
    return () => { gameEvents.off(GAME_EVENT.BATTLE_READY, onReady); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!battleOutcome) return;
    const t = setTimeout(() => setShowResultUI(true), 500);
    return () => clearTimeout(t);
  }, [battleOutcome]);

  // ─── Phaser 동기화 ─────────────────────────────────────────────────────────────
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
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        gameEvents.off(GAME_EVENT.BATTLE_LOG_ACK, done);
        resolve();
      };
      // 방어책: ACK가 끝내 오지 않아도 전투가 영구히 멈추지 않도록 타임아웃 처리
      const timer = setTimeout(done, 5000);
      gameEvents.once(GAME_EVENT.BATTLE_LOG_ACK, done);
      gameEvents.emit(GAME_EVENT.BATTLE_LOG, text);
      setLogHistory((prev) => [...prev.slice(-49), text]);
    });
  }, []);

  // ─── Phaser 마운트 ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!gameRef.current) return;
    setBattleInitData({
      playerImageUrl: MONSTER_IMAGE_MAP[initialPlayer.id] ?? "",
      playerName:     initialPlayer.name,
      playerLevel:    initialPlayer.level,
      enemyImageUrl:  MONSTER_IMAGE_MAP[initialEnemy.id] ?? "",
      enemyName:      initialEnemy.name,
      enemyLevel:     initialEnemy.level,
      floor, isBoss: isBossFloor(floor),
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

  const finishBattle = useCallback((outcome: "win" | "lose") => {
    if (cancelledRef.current) return;
    gameEvents.emit(GAME_EVENT.BATTLE_RESULT, { outcome, floor });
    setBattleOutcome(outcome);
  }, [floor]);

  /**
   * 기술 칸(4개)이 찼는데 새 기술을 배울 때, 무엇을 잊을지 플레이어에게 묻는다.
   * 예전에는 가장 약한 기술이 말없이 밀려나서, 일부러 남기고 싶은 상태이상기를 지킬 수 없었다.
   */
  const askWhichToForget = useCallback(
    (current: Move[], incoming: Move) =>
      new Promise<number | null>((resolve) => {
        setForgetPrompt({ current, incoming, resolve });
      }),
    [],
  );

  const answerForget = useCallback((idx: number | null) => {
    setForgetPrompt((p) => { p?.resolve(idx); return null; });
  }, []);

  /**
   * 도망 — 전투를 포기하고 베이스캠프로 돌아간다.
   * 이 전투에서 깎인 HP는 그대로 저장한다(도망이 완전 공짜면 위험한 층을 정찰만 하고 빠지는
   * 무손실 전략이 되므로). 보스층은 도망 대상이 아니다.
   */
  const handleFlee = useCallback(() => {
    if (isProcessing || battleOutcome !== null || isBossFloor(floor)) return;
    for (let i = 0; i < initialParty.length; i++) {
      const m = initialParty[i];
      const hp = i === activePartyIndex ? player.currentHp : (partyHp[m.uid] ?? m.currentHp);
      updatePartyMember({ ...m, currentHp: Math.max(0, hp) });
    }
    navigate("/");
  }, [isProcessing, battleOutcome, floor, initialParty, activePartyIndex, player,
      partyHp, updatePartyMember, navigate]);

  // ─── 파티 전원 기절 여부 ────────────────────────────────────────────────────────
  const hasAlivePartyMember = useCallback(
    (excludeIdx: number, overrideUid?: string, overrideHp?: number): boolean =>
      initialParty.some((m, i) => {
        if (i === excludeIdx) return false;
        const hp = overrideUid === m.uid ? overrideHp : (partyHp[m.uid] ?? m.currentHp);
        return (hp ?? 0) > 0;
      }),
    [initialParty, partyHp],
  );

  // ─── 장착 장비 전투 보너스 ──────────────────────────────────────────────────────
  // 장비는 전투 중 변경될 수 없으므로 매번 최신 store에서 조회해도 안전하다.
  // hp는 데미지 계산이 아니라 전투 진입 시점에 별도로(withOwnedHpBonus) 반영되므로
  // 여기서는 참고용으로만 반환한다(승리 시 저장 데이터에서 다시 빼내기 위해 필요).
  const getEquipCombatBonus = useCallback((uid: string | undefined) => {
    if (!uid) {
      return {
        attack: 0, defense: 0, speed: 0, critRate: 0, elementPower: 0, hp: 0,
        critDamage: 0, expBonus: 0, elementalDamage: {} as Partial<Record<ElementType, number>>,
      };
    }
    const equipped = usePlayerStore.getState().equippedArtifacts[uid] ?? [];
    const totals = sumEquippedStatBonuses(equipped);
    const bonusTotals = sumEquippedBonusStats(equipped);
    // 부가 능력치 fireDamage/waterDamage만 실제 존재하는 속성(fire/water)에 매핑된다.
    // windDamage/earthDamage는 이 게임에 해당 속성 기술이 없어 의도적으로 매핑하지 않는다.
    const elementalDamage: Partial<Record<ElementType, number>> = {};
    if (bonusTotals.fireDamage)  elementalDamage.fire  = bonusTotals.fireDamage;
    if (bonusTotals.waterDamage) elementalDamage.water = bonusTotals.waterDamage;
    return {
      attack: totals.attack, defense: totals.defense, speed: totals.speed,
      critRate: totals.critRate, elementPower: totals.elementPower, hp: totals.hp,
      critDamage: bonusTotals.critDamage, expBonus: bonusTotals.expBonus,
      elementalDamage,
    };
  }, []);

  // ─── 버프 턴 감소 ───────────────────────────────────────────────────────────────
  const tickBuff = (m: BattleMonster): BattleMonster => {
    if (m.attackBuffTurns <= 0) return m;
    const turns = m.attackBuffTurns - 1;
    return { ...m, attackBuffTurns: turns, attackBuffMult: turns > 0 ? m.attackBuffMult : 1.0 };
  };

  // ─── 공격 처리 ─────────────────────────────────────────────────────────────────
  // attackerAtkBonus/defenderDefBonus/attackerCritRateBonus/attackerElementPowerBonus/
  // attackerElementalDamageBonus/attackerCritDamageBonus: 장착 장비 보너스. 데미지 계산에만
  // 임시로 반영하고 반환되는 updated(=defender 원본 기반)에는 섞이지 않으므로 세이브에
  // 새어들지 않는다. 전부 공격자(플레이어) 쪽 보너스만 존재한다(적은 장비를 착용하지 않음).
  const resolveAttack = useCallback(async (
    attacker: BattleMonster, defender: BattleMonster, move: Move,
    currentPlayer: BattleMonster, currentEnemy: BattleMonster, isPlayerAttacking: boolean,
    attackerAtkBonus = 0, defenderDefBonus = 0,
    attackerCritRateBonus = 0, attackerElementPowerBonus = 0,
    attackerElementalDamageBonus: Partial<Record<ElementType, number>> = {},
    attackerCritDamageBonus = 0,
  ): Promise<{ updated: BattleMonster; fainted: boolean }> => {

    const secretReveal = !isPlayerAttacking && !towerSecretShownRef.current
      ? getTowerSecretReveal(floor, move.id)
      : null;
    const isAnomaly = !isPlayerAttacking
      && dexCaught.includes(attacker.id) && isAnomalyMove(attacker.id, move.id);

    if (secretReveal) {
      towerSecretShownRef.current = true;
      await sendLogAndWait(`${attacker.name}의 ⚠${move.name}!`);
      for (const line of secretReveal.lines) {
        await sendLogAndWait(line);
      }
    } else if (isAnomaly) {
      await sendLogAndWait(`${attacker.name}의 ⚠${move.name}!`);
      await sendLogAndWait("…이 몬스터가 쓸 수 있는 기술이 아니다.");
    } else {
      await sendLogAndWait(`${attacker.name}의 ${move.name}!`);
    }
    const effAttacker = attackerAtkBonus ? { ...attacker, attack: attacker.attack + attackerAtkBonus } : attacker;
    const effDefender = defenderDefBonus ? { ...defender, defense: defender.defense + defenderDefBonus } : defender;
    const res = calculateDamage(
      effAttacker, effDefender, move,
      attackerCritRateBonus, attackerElementPowerBonus,
      attackerElementalDamageBonus, attackerCritDamageBonus,
    );

    if (!res.isHit) {
      await sendLogAndWait("공격이 빗나갔다!");
      return { updated: defender, fainted: false };
    }

    let next = defender;
    if (res.damage > 0) {
      next = applyDamage(defender, res.damage);
      if (isPlayerAttacking) syncHpToPhaser(currentPlayer, next);
      else                    syncHpToPhaser(next, currentEnemy);
      if (res.isCrit) await sendLogAndWait("치명타 공격!");
      await sendLogAndWait(`${res.damage}의 피해를 입혔다.`);
    }

    if (res.multiplier >= 2)    await sendLogAndWait("효과가 굉장했다!");
    else if (res.multiplier < 1) await sendLogAndWait("효과가 별로인 듯하다...");

    if (move.statusEffect && (move.statusChance ?? 0) > 0 && Math.random() * 100 <= (move.statusChance ?? 0)) {
      const before = next.status;
      next = applyStatusEffect(next, move.statusEffect);
      if (before === null && next.status !== null) {
        await sendLogAndWait(`${next.name}에게 ${STATUS_LABELS[next.status] ?? next.status} 상태이상이 걸렸다!`);
      }
    }

    const fainted = isFainted(next);
    if (fainted) await sendLogAndWait(`${defender.name}이(가) 쓰러졌다!`);
    return { updated: next, fainted };
  }, [sendLogAndWait, syncHpToPhaser, dexCaught, floor]);

  // ─── 스킬 선택 ──────────────────────────────────────────────────────────────────
  const handleMoveClick = useCallback(async (move: Move) => {
    if (isProcessing || battleOutcome !== null || mustSwitch) return;
    setIsProcessing(true);
    setShowBag(false);

    let np = player;
    let ne = enemyState;

    const playerBonus = getEquipCombatBonus(initialParty[activePartyIndex]?.uid);
    const eTurnIdx = enemyTurnRef.current;
    const eMove    = getFloorEnemySkill(floor, eTurnIdx, ne.moves) ?? getAIAction(ne, np);
    const playerFirst = (np.speed + playerBonus.speed) >= ne.speed;

    const doPlayerTurn = async (): Promise<boolean> => {
      np = tickBuff(np);
      if (np.attackBuffTurns === 0 && player.attackBuffTurns > 0) {
        await sendLogAndWait(`${np.name}의 공격 강화가 풀렸다.`);
      }
      const ps = checkStatusEffects(np);
      np = ps.monster;
      for (const log of ps.logs) { syncHpToPhaser(np, ne); await sendLogAndWait(log); }
      if (ps.skipTurn) return false;
      const res = await resolveAttack(
        np, ne, move, np, ne, true,
        playerBonus.attack, 0, playerBonus.critRate, playerBonus.elementPower,
        playerBonus.elementalDamage, playerBonus.critDamage,
      );
      ne = res.updated;
      return res.fainted;
    };

    const doEnemyTurn = async (): Promise<boolean> => {
      const es = checkStatusEffects(ne);
      ne = es.monster;
      for (const log of es.logs) { syncHpToPhaser(np, ne); await sendLogAndWait(log); }
      if (es.skipTurn) return false;
      const res = await resolveAttack(ne, np, eMove, np, ne, false, 0, playerBonus.defense);
      np = res.updated;
      return res.fainted;
    };

    let playerWon = false, enemyWon = false;
    if (playerFirst) {
      playerWon = await doPlayerTurn();
      if (!playerWon) enemyWon = await doEnemyTurn();
    } else {
      enemyWon = await doEnemyTurn();
      if (!enemyWon) playerWon = await doPlayerTurn();
    }
    enemyTurnRef.current += 1;

    if (playerWon) {
      const earnedExp = Math.floor(ne.rewardExp * (1 + playerBonus.expBonus / 100));
      const prevLevel = np.level;
      const expResult = gainExp(np, earnedExp);
      np = expResult.updatedMonster;
      await sendLogAndWait(`경험치 ${earnedExp}를 획득했다!`);
      if (expResult.leveledUp) await sendLogAndWait(`레벨이 ${np.level}(으)로 올랐다!`);

      // 레벨업에 딸린 성장(기술 습득·진화)을 적용한다
      if (expResult.leveledUp) {
        const growth = await applyLevelGrowth(np, prevLevel, askWhichToForget);
        np = growth.monster;
        for (const mv of growth.forgotten) {
          await sendLogAndWait(`${np.name}은(는) ${mv.name}을(를) 잊어버렸다...`);
        }
        for (const mv of growth.learned) {
          await sendLogAndWait(`${np.name}은(는) ${mv.name}을(를) 배웠다!`);
        }
        if (growth.evolvedFrom) {
          await sendLogAndWait(`…어라? ${growth.evolvedFrom}의 모습이 변하고 있다!`);
          await sendLogAndWait(`${growth.evolvedFrom}은(는) ${np.name}(으)로 진화했다!`);
          addToDexSeen(np.id);
          addToDexCaught(np.id);
        }
      }

      // 재료 드랍
      const battleDrops = rollBattleDrop(floor);
      if (ne.id === "ormr") battleDrops.push({ id: "ormr_essence", count: 1 });
      for (const drop of battleDrops) {
        addMaterial(drop.id, drop.count);
      }
      if (battleDrops.some((d) => d.id === "ormr_essence")) {
        await sendLogAndWait("…이게 뭐지? 처음 보는 물건이다.");
        await sendLogAndWait("촌장님이라면 아실지도 모른다. 가져가 봐야겠다.");
      }

      const owned = initialParty[activePartyIndex];
      if (owned) {
        // np.maxHp/currentHp는 장비 HP 보너스가 반영된 값이므로, 저장 전에 그 비율만큼
        // 빼내어 "장비 없는 기본 스탯" 기준으로 되돌린다(세이브에 보너스가 새어들지 않도록).
        const hpBonus = playerBonus.hp;
        const persistedMaxHp = np.maxHp - hpBonus;
        const persistedCurrentHp = hpBonus > 0
          ? Math.max(1, Math.min(persistedMaxHp, Math.round((np.currentHp * persistedMaxHp) / np.maxHp)))
          : np.currentHp;
        updatePartyMember({ ...owned, ...np, uid: owned.uid, maxHp: persistedMaxHp, currentHp: persistedCurrentHp });
      }

      // 출전하지 않은 파티원에게도 경험치를 나눠준다.
      // 예전에는 마지막에 싸운 한 마리만 경험치를 받아서, 탑을 오를수록 나머지 둘이 방치되고
      // 사실상 1마리로 50층을 가야 했다(교체는 곧 레벨 20짜리를 레벨 40 적 앞에 내놓는 일).
      for (let i = 0; i < initialParty.length; i++) {
        if (i === activePartyIndex) continue;
        const mate = initialParty[i];
        const hp = partyHp[mate.uid] ?? mate.currentHp;
        if (hp <= 0) continue;   // 기절한 몬스터는 분배 대상에서 제외
        const share = Math.max(1, Math.floor(earnedExp * BENCH_EXP_SHARE));
        const bm = createBattleMonsterFromOwned({ ...mate, currentHp: hp });
        const prev = bm.level;
        const res = gainExp(bm, share);
        let grownMate = res.updatedMonster;
        if (res.leveledUp) {
          // 대기 파티원까지 매번 물으면 승리 화면이 선택 창으로 도배된다 → 자동 판단
          const g = await applyLevelGrowth(grownMate, prev);
          grownMate = g.monster;
          if (g.evolvedFrom) { addToDexSeen(grownMate.id); addToDexCaught(grownMate.id); }
        }
        updatePartyMember({ ...mate, ...grownMate, uid: mate.uid });
      }

      updateBestFloor(floor);
      addToDexSeen(ne.id);
      setPlayer(np); setEnemyState(ne);
      setBattleDrops(battleDrops);
      finishBattle("win"); setIsProcessing(false); return;
    }

    if (enemyWon) {
      const uid = initialParty[activePartyIndex]?.uid;
      if (uid) setPartyHp(prev => ({ ...prev, [uid]: 0 }));
      setPlayer({ ...np, currentHp: 0 }); setEnemyState(ne);
      if (hasAlivePartyMember(activePartyIndex, uid, 0)) { setMustSwitch(true); setIsProcessing(false); return; }
      finishBattle("lose"); setIsProcessing(false); return;
    }

    const uid = initialParty[activePartyIndex]?.uid;
    if (uid) setPartyHp(prev => ({ ...prev, [uid]: np.currentHp }));
    setPlayer(np); setEnemyState(ne);
    setIsProcessing(false);
  }, [
    isProcessing, battleOutcome, mustSwitch, player, enemyState, floor,
    activePartyIndex, initialParty, resolveAttack, syncHpToPhaser,
    sendLogAndWait, finishBattle, hasAlivePartyMember, getEquipCombatBonus,
    addMaterial, addToDexCaught, askWhichToForget, partyHp,
    updatePartyMember, updateBestFloor, addToDexSeen,
  ]);

  // ─── 파티 교체 ──────────────────────────────────────────────────────────────────
  const handlePartySwap = useCallback(async (partyIdx: number) => {
    if (isProcessing || battleOutcome !== null || partyIdx === activePartyIndex) return;
    const nextOwned = initialParty[partyIdx];
    if (!nextOwned) return;
    const nextHp = partyHp[nextOwned.uid] ?? nextOwned.currentHp;
    if (nextHp <= 0) return;

    setIsProcessing(true);
    const outUid = initialParty[activePartyIndex]?.uid;
    if (outUid) setPartyHp(prev => ({ ...prev, [outUid]: player.currentHp }));

    if (!mustSwitch) await sendLogAndWait(`${player.name}을(를) 교체한다!`);

    const nextPlayer: BattleMonster = { ...createBattleMonsterFromOwned(nextOwned), currentHp: nextHp };
    setActivePartyIndex(partyIdx);
    setPlayer(nextPlayer);
    setMustSwitch(false);
    setShowBag(false);
    syncHpToPhaser(nextPlayer, enemyState);
    gameEvents.emit(GAME_EVENT.BATTLE_PLAYER_SWITCH, { partyIndex: partyIdx, name: nextOwned.name, level: nextOwned.level });

    if (mustSwitch) { setIsProcessing(false); return; }

    const ne = enemyState;
    const eMove = getFloorEnemySkill(floor, enemyTurnRef.current, ne.moves) ?? getAIAction(ne, nextPlayer);
    const nextDefBonus = getEquipCombatBonus(nextOwned.uid).defense;
    const atk = await resolveAttack(ne, nextPlayer, eMove, nextPlayer, ne, false, 0, nextDefBonus);
    const np2 = atk.updated;
    enemyTurnRef.current += 1;

    if (atk.fainted) {
      setPartyHp(prev => ({ ...prev, [nextOwned.uid]: 0 }));
      setPlayer({ ...np2, currentHp: 0 }); setEnemyState(ne);
      if (hasAlivePartyMember(partyIdx, nextOwned.uid, 0)) setMustSwitch(true);
      else finishBattle("lose");
    } else {
      setPartyHp(prev => ({ ...prev, [nextOwned.uid]: np2.currentHp }));
      setPlayer(np2); setEnemyState(ne);
    }
    setIsProcessing(false);
  }, [
    isProcessing, battleOutcome, activePartyIndex, initialParty, player,
    enemyState, floor, partyHp, mustSwitch,
    resolveAttack, syncHpToPhaser, sendLogAndWait, finishBattle, hasAlivePartyMember,
    getEquipCombatBonus,
  ]);

  // ─── 물약 사용 ──────────────────────────────────────────────────────────────────
  const handleUsePotion = useCallback(async (potionId: string) => {
    if (isProcessing || battleOutcome !== null || mustSwitch) return;
    const potion = POTIONS.find(p => p.id === potionId);
    if (!potion) return;
    if ((potionCounts[potionId] ?? 0) <= 0) return;

    setIsProcessing(true);
    setShowBag(false);

    // 물약 소모
    const ok = consumePotion(potionId);
    if (!ok) { setIsProcessing(false); return; }
    setPotionCounts(prev => ({ ...prev, [potionId]: Math.max(0, (prev[potionId] ?? 0) - 1) }));

    // 효과 적용
    let np = player;
    const eff = potion.effect;
    if (eff.type === "heal") {
      const restored = Math.min(np.maxHp, np.currentHp + eff.amount);
      await sendLogAndWait(`${np.name}의 HP가 ${restored - np.currentHp} 회복됐다!`);
      np = { ...np, currentHp: restored };
    } else if (eff.type === "full_heal") {
      await sendLogAndWait(`${np.name}의 HP가 완전히 회복됐다!`);
      np = { ...np, currentHp: np.maxHp };
    } else if (eff.type === "cure_status") {
      if (np.status) {
        await sendLogAndWait(`${np.name}의 ${STATUS_LABELS[np.status] ?? np.status} 상태가 치료됐다!`);
        np = { ...np, status: null };
      } else {
        await sendLogAndWait("상태이상이 없다...");
      }
    } else if (eff.type === "buff_attack") {
      await sendLogAndWait(`${np.name}의 공격력이 ${eff.turns}턴간 ${eff.multiplier}배로 올랐다!`);
      np = { ...np, attackBuffMult: eff.multiplier, attackBuffTurns: eff.turns };
    }

    // 물약 사용 후 partyHp 업데이트
    const uid = initialParty[activePartyIndex]?.uid;
    if (uid) setPartyHp(prev => ({ ...prev, [uid]: np.currentHp }));
    setPlayer(np);
    syncHpToPhaser(np, enemyState);

    // 적 반격 (아이템 사용 = 1턴 소비)
    const ne = enemyState;
    const eMove = getFloorEnemySkill(floor, enemyTurnRef.current, ne.moves) ?? getAIAction(ne, np);
    const playerDefBonus = getEquipCombatBonus(uid).defense;
    const atk = await resolveAttack(ne, np, eMove, np, ne, false, 0, playerDefBonus);
    np = atk.updated;
    enemyTurnRef.current += 1;

    if (atk.fainted) {
      if (uid) setPartyHp(prev => ({ ...prev, [uid]: 0 }));
      setPlayer({ ...np, currentHp: 0 }); setEnemyState(ne);
      if (hasAlivePartyMember(activePartyIndex, uid, 0)) setMustSwitch(true);
      else finishBattle("lose");
    } else {
      if (uid) setPartyHp(prev => ({ ...prev, [uid]: np.currentHp }));
      setPlayer(np); setEnemyState(ne);
    }
    setIsProcessing(false);
  }, [
    isProcessing, battleOutcome, mustSwitch, player, enemyState,
    floor, potionCounts, activePartyIndex, initialParty,
    consumePotion, resolveAttack, syncHpToPhaser, sendLogAndWait,
    finishBattle, hasAlivePartyMember, getEquipCombatBonus,
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
      if (captureResult === "storage") setStoryFlag("first_capture");
      await sendLogAndWait(captureResult === "storage" ? "보관함에 저장되었다!" : "보관함이 가득 차서 놓아줬다...");
      finishBattle("win"); setIsProcessing(false); return;
    }

    let np = player;
    const ne = enemyState;
    const eMove = getFloorEnemySkill(floor, enemyTurnRef.current, ne.moves) ?? getAIAction(ne, np);
    const playerDefBonus = getEquipCombatBonus(initialParty[activePartyIndex]?.uid).defense;
    const atk = await resolveAttack(ne, np, eMove, np, ne, false, 0, playerDefBonus);
    np = atk.updated; enemyTurnRef.current += 1;

    if (atk.fainted) {
      const uid = initialParty[activePartyIndex]?.uid;
      if (uid) setPartyHp(prev => ({ ...prev, [uid]: 0 }));
      setPlayer({ ...np, currentHp: 0 }); setEnemyState(ne);
      if (hasAlivePartyMember(activePartyIndex, uid, 0)) setMustSwitch(true);
      else finishBattle("lose");
    } else {
      const uid = initialParty[activePartyIndex]?.uid;
      if (uid) setPartyHp(prev => ({ ...prev, [uid]: np.currentHp }));
      setPlayer(np); setEnemyState(ne);
    }
    setIsProcessing(false);
  }, [
    isProcessing, battleOutcome, player, enemyState, isCatchZone, floor,
    activePartyIndex, initialParty,
    resolveAttack, sendLogAndWait, finishBattle, getEquipCombatBonus,
    addCapturedMonster, addToDexCaught, hasAlivePartyMember, setStoryFlag,
  ]);

  // ─── 렌더 헬퍼 ──────────────────────────────────────────────────────────────────
  const canShowCatch = isCatchZone && enemyState.id !== "ormr"
    && enemyState.currentHp / enemyState.maxHp <= 0.3
    && !isProcessing && battleOutcome === null && !mustSwitch;
  const speedFirst = (player.speed + getEquipCombatBonus(initialParty[activePartyIndex]?.uid).speed) >= enemyState.speed;
  const hasPotions = POTIONS.some(p => (potionCounts[p.id] ?? 0) > 0);

  // ─── 렌더 ────────────────────────────────────────────────────────────────────────
  return (
    <div className="relative flex h-screen flex-col bg-shadow-900 text-cream-100 overflow-hidden">

      {/* Phaser 캔버스 */}
      <div ref={gameRef} className="relative flex-1 min-h-0" />

      {/* ══════════ 하단 배틀 패널 ══════════ */}
      <div className="shrink-0 border-t-2 border-earth-500 bg-shadow-900">

        {/* 상태 바 — HP는 전투에서 가장 자주 보는 정보라 바를 크게 잡는다 */}
        <div className="flex items-center justify-between border-b border-earth-500/40 px-3 py-2 text-pixel-sm">
          <div className="flex items-center gap-2">
            <span className="font-bold text-cream-100">{player.name}</span>
            <span className="text-earth-400">Lv.{player.level}</span>
            {(() => {
              const pct = (player.currentHp / player.maxHp) * 100;
              const critical = pct <= 20;
              return (
                <div className="flex items-center gap-2">
                  <div className="h-3 w-48 overflow-hidden rounded-full border border-shadow-900 bg-shadow-700">
                    <div className={`h-full rounded-full transition-all duration-300 ${critical ? "animate-pulse" : ""}`}
                      style={{ width: `${pct}%`, backgroundColor: PALETTE[hpToken(pct)] }} />
                  </div>
                  <span className="font-mono text-pixel-sm font-bold text-sand-200">{player.currentHp}/{player.maxHp}</span>
                </div>
              );
            })()}
            {player.status && (
              <span className="rounded bg-ember-700/18 px-1 py-0.5 text-ember-500 text-pixel-sm">
                {STATUS_LABELS[player.status]}
              </span>
            )}
            {player.attackBuffTurns > 0 && (
              <span className="rounded bg-ember-700/18 px-1 py-0.5 text-ember-500 text-pixel-sm">
                ⚔️ ×{player.attackBuffMult} ({player.attackBuffTurns}턴)
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!mustSwitch && battleOutcome === null && (
              <span className={`text-pixel-sm ${speedFirst ? "text-moss-500" : "text-ember-700"}`}>
                {speedFirst ? "▲ 선공" : "▼ 후공"}
              </span>
            )}
            {isProcessing && !mustSwitch && (
              <span className="text-ember-500 animate-pulse text-pixel-sm">▶ Q / 클릭</span>
            )}
            <span className="rounded bg-ember-700/15 px-1.5 py-0.5 text-ember-500 font-mono text-pixel-sm font-bold">
              {floor}F
            </span>
            <button onClick={() => setShowLog((v) => !v)}
              className={`text-pixel-sm border rounded px-1.5 py-0.5 transition ${
                showLog ? "border-stone-600 text-sand-200" : "border-shadow-700 text-earth-400 hover:text-sand-300"}`}>
              기록
            </button>
            {/* 도망: 보스층에서는 불가 (보스는 정면으로 넘어야 하는 관문) */}
            {battleOutcome === null && (
              <button onClick={handleFlee} disabled={isProcessing || isBossFloor(floor)}
                title={isBossFloor(floor) ? "보스에게서는 도망칠 수 없다" : "이 전투를 포기하고 베이스캠프로"}
                className="text-pixel-sm text-earth-400 hover:text-sand-300 border border-shadow-700 rounded px-1.5 py-0.5 disabled:opacity-30">
                도망
              </button>
            )}
            <button onClick={() => navigate("/")}
              className="text-pixel-sm text-earth-400 hover:text-sand-300 border border-shadow-700 rounded px-1.5 py-0.5">
              나가기
            </button>
          </div>
        </div>

        {/* 로그 — 높이 고정. 텍스트 길이에 따라 레이아웃이 흔들리면 안 된다 (ART_DIRECTION 3-2).
            '기록' 버튼은 지나간 줄을 다시 보는 용도로 남긴다. */}
        <div className="flex h-14 items-center border-b border-earth-500/40 bg-shadow-700/60 px-4">
          <p className="line-clamp-2 text-pixel-sm leading-[18px] text-sand-200">
            {logHistory[logHistory.length - 1] ?? ""}
          </p>
        </div>

        {showLog && (
          <div className="border-b border-earth-500/40 bg-shadow-900/80 px-3 py-2">
            <div className="flex max-h-24 flex-col-reverse gap-0.5 overflow-y-auto">
              {logHistory.length === 0
                ? <p className="text-pixel-sm text-earth-400">아직 기록이 없습니다.</p>
                : [...logHistory].reverse().map((line, i) => (
                    <p key={logHistory.length - i} className={`text-pixel-sm ${i === 0 ? "text-sand-200" : "text-earth-400"}`}>
                      {line}
                    </p>
                  ))}
            </div>
          </div>
        )}

        {/* 전투 중 메인 패널 */}
        {battleOutcome === null && (
          <div className="flex" style={{ minHeight: "148px" }}>

            {/* ─── 파티 벤치 ─────────────────────────────── */}
            <div className="w-44 shrink-0 border-r border-shadow-700 p-2 flex flex-col gap-1.5">
              <p className="text-pixel-sm text-earth-400 font-semibold uppercase tracking-wider">파티</p>
              {initialParty.map((m, idx) => {
                const isActive = idx === activePartyIndex;
                const hp       = isActive ? player.currentHp : (partyHp[m.uid] ?? m.currentHp);
                const hpPct    = Math.max(0, (hp / m.maxHp) * 100);
                const fainted  = hp <= 0;
                const canSwap  = !fainted && !isActive && !isProcessing && !mustSwitch;
                const mustPick = mustSwitch && !fainted && !isActive;

                return (
                  <button key={m.uid}
                    onClick={() => (canSwap || mustPick) && handlePartySwap(idx)}
                    disabled={fainted || (isActive && !mustSwitch)}
                    className={[
                      "relative flex items-center gap-1.5 rounded-lg border px-1.5 py-1 text-left transition-all",
                      isActive  && "border-ember-500/70 bg-ember-700/9",
                      fainted   && "border-shadow-700 bg-shadow-800/10 opacity-40 cursor-not-allowed",
                      mustPick  && "border-mist-500 bg-mist-500/10 hover:bg-mist-500/16 shadow-[0_0_8px_rgba(59,130,246,0.4)] cursor-pointer",
                      canSwap   && "border-stone-600 bg-shadow-800/40 hover:border-sand-300 hover:bg-shadow-700/40 cursor-pointer",
                      !isActive && !fainted && !mustPick && !canSwap && "border-shadow-700 bg-shadow-800/20 cursor-not-allowed",
                    ].filter(Boolean).join(" ")}
                  >
                    <div className="relative shrink-0">
                      <img src={MONSTER_IMAGE_MAP[m.id]} alt={m.nickname ?? m.name} className="h-9 w-9 object-contain"
                        style={fainted ? { filter: "grayscale(100%) brightness(0.4)" } : undefined} />
                      {isActive && <div className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-ember-500 shadow-[0_0_4px_rgba(250,204,21,0.8)]" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-pixel-sm font-semibold text-sand-200 truncate leading-tight">{m.nickname ?? m.name}</p>
                      <p className="text-pixel-sm text-earth-400 leading-tight">Lv.{m.level}</p>
                      <div className="mt-0.5 h-1 w-full rounded-full bg-shadow-700 overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-300"
                          style={{ width: `${hpPct}%`, backgroundColor: PALETTE[hpToken(hpPct)] }} />
                      </div>
                      <p className="text-pixel-sm text-earth-400 font-mono">{hp}/{m.maxHp}</p>
                    </div>
                    {isActive  && <span className="text-pixel-sm text-ember-500 font-bold shrink-0">출전</span>}
                    {fainted   && <span className="text-pixel-sm text-earth-400 shrink-0">기절</span>}
                    {mustPick  && <span className="text-pixel-sm text-mist-300 animate-pulse shrink-0">선택</span>}
                  </button>
                );
              })}
            </div>

            {/* ─── 오른쪽 액션 영역 ──────────────────────── */}
            <div className="flex-1 p-2 flex flex-col gap-1.5 min-w-0">

              {/* 강제 교체 */}
              {mustSwitch ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center">
                  <p className="text-ember-500 font-bold text-pixel-sm">{player.name}이(가) 기절했다!</p>
                  <p className="text-sand-300 text-pixel-sm">← 왼쪽에서 다음 몬스터를 선택하세요</p>
                </div>
              ) : showBag ? (
                /* ──── 가방 패널 ──── */
                <div className="flex-1 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <p className="text-pixel-sm text-sand-300 font-semibold">🎒 가방 — 물약</p>
                    <button onClick={() => setShowBag(false)}
                      className="text-pixel-sm text-earth-400 hover:text-sand-300 border border-shadow-700 rounded px-1.5 py-0.5">
                      닫기
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto flex flex-col gap-1">
                    {POTIONS.map(p => {
                      const cnt = potionCounts[p.id] ?? 0;
                      const effectLabel = (() => {
                        const e = p.effect;
                        if (e.type === "heal")        return `HP +${e.amount}`;
                        if (e.type === "full_heal")   return "HP 완전 회복";
                        if (e.type === "cure_status") return "상태이상 치료";
                        if (e.type === "buff_attack") return `공격 ×${e.multiplier} (${e.turns}턴)`;
                        return "";
                      })();
                      return (
                        <button key={p.id}
                          onClick={() => cnt > 0 && handleUsePotion(p.id)}
                          disabled={cnt <= 0 || isProcessing}
                          className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 text-left transition
                            ${cnt > 0
                              ? "border-ember-700/50 bg-ember-700/10 hover:bg-ember-700/16 text-cream-100"
                              : "border-shadow-700 bg-shadow-800/20 text-earth-400 cursor-not-allowed opacity-50"
                            }`}
                        >
                          <span className="text-title-sm shrink-0">{p.emoji}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-pixel-sm font-semibold leading-tight truncate">{p.name}</p>
                            <p className="text-pixel-sm opacity-70 leading-tight">{effectLabel}</p>
                          </div>
                          <span className={`text-pixel-sm font-mono font-bold shrink-0 ${cnt > 0 ? "text-ember-500" : "text-earth-400"}`}>
                            ×{cnt}
                          </span>
                        </button>
                      );
                    })}
                    {!hasPotions && (
                      <p className="text-center text-pixel-sm text-earth-400 py-3">
                        보유한 물약이 없습니다.<br />
                        <span className="text-shadow-800">농장 → 제작소에서 만들 수 있어요.</span>
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                /* ──── 기술 4슬롯 ──── */
                <>
                  {/* 가방 토글 버튼 (우상단) */}
                  <div className="flex items-center justify-end">
                    <button
                      onClick={() => setShowBag(true)}
                      disabled={isProcessing}
                      className={`flex items-center gap-1 text-pixel-sm rounded border px-1.5 py-0.5 transition
                        ${hasPotions
                          ? "border-ember-700/60 text-ember-500 hover:bg-ember-700/11"
                          : "border-shadow-700 text-earth-400"
                        } disabled:opacity-30`}
                    >
                      🎒 가방 {hasPotions && <span className="text-ember-500 font-bold">●</span>}
                    </button>
                  </div>

                  {/* 기술 2×2 — 항상 4슬롯, 높이 균일 */}
                  <div className="grid grid-cols-2 grid-rows-2 gap-1.5 flex-1">
                    {[0, 1, 2, 3].map(i => {
                      const move = player.moves[i];
                      if (!move) {
                        return (
                          <div key={`empty-${i}`}
                            className="border border-shadow-700/40 bg-shadow-800/10 flex items-center justify-center min-h-[52px]"
                            style={{ borderRadius: 0 }}>
                            <span className="text-shadow-800 text-pixel-sm">—</span>
                          </div>
                        );
                      }
                      const mult = getTypeMultiplier(move.type, enemyState.type);
                      return (
                        <button key={move.id}
                          onClick={() => handleMoveClick(move)}
                          disabled={isProcessing}
                          style={{ borderRadius: 0 }}
                          className={`group relative border-2 px-2 py-1.5 text-left transition
                            hover:brightness-125 focus-visible:brightness-125 disabled:opacity-30 min-h-[52px] ${typeClass(move.type)}`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-semibold text-pixel-sm leading-tight">
                              <span className="invisible mr-1 group-hover:visible group-focus-visible:visible">▶</span>
                              {move.name}
                            </span>
                            <span className="text-pixel-sm opacity-50 uppercase shrink-0">{move.type}</span>
                          </div>
                          <div className="text-pixel-sm opacity-45 mt-0.5">위력 {move.power} · 명중 {move.accuracy}</div>
                          {mult >= 2   && <div className="text-pixel-sm text-moss-500 font-semibold mt-0.5">▲ 효과 굉장!</div>}
                          {mult === 0  && <div className="text-pixel-sm text-earth-400 mt-0.5">✕ 효과 없음</div>}
                          {mult > 0 && mult < 1 && <div className="text-pixel-sm text-ember-500 mt-0.5">▼ 효과 미미</div>}
                        </button>
                      );
                    })}
                  </div>

                  {/* 포획 버튼 */}
                  {canShowCatch && (
                    <button onClick={handleCatch} disabled={isProcessing}
                      className="w-full rounded-lg border border-mist-500 bg-mist-500/15 py-1.5 text-pixel-sm font-semibold text-mist-300 hover:bg-mist-500/25 disabled:opacity-30 transition">
                      포획 시도 {enemyState.status ? "(상태이상 보너스)" : ""}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {battleOutcome !== null && (
          <p className="py-2 text-center text-pixel-sm text-earth-400">잠시 후 선택 화면이 표시됩니다...</p>
        )}
      </div>

      {/* 기술 교체 선택 — 4칸이 찼을 때만 뜬다 */}
      {forgetPrompt && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center bg-shadow-900/75">
          <div className="w-full max-w-md mx-4 border-2 border-ember-700 bg-shadow-900/95 p-5">
            <p className="text-center text-pixel-sm font-bold text-ember-500 mb-1">
              {player.name}이(가) {forgetPrompt.incoming.name}을(를) 배우려 한다!
            </p>
            <p className="text-center text-pixel-sm text-sand-300 mb-4">
              기술은 4개까지만 익힐 수 있다. 무엇을 잊을까?
            </p>

            <div className="mb-3 rounded border border-ember-700/60 bg-ember-700/10 px-3 py-2">
              <p className="text-pixel-sm text-ember-500 mb-0.5">새 기술</p>
              <div className="flex items-center justify-between">
                <span className="text-pixel-sm font-semibold text-ember-500">{forgetPrompt.incoming.name}</span>
                <span className="text-pixel-sm text-ember-500/70 uppercase">{forgetPrompt.incoming.type}</span>
              </div>
              <p className="text-pixel-sm text-ember-500/70">
                위력 {forgetPrompt.incoming.power} · 명중 {forgetPrompt.incoming.accuracy}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-1.5 mb-3">
              {forgetPrompt.current.map((mv, i) => (
                <button key={mv.id} onClick={() => answerForget(i)}
                  className={`border px-2 py-1.5 text-left transition ${typeClass(mv.type)}`}
                  style={{ borderRadius: 0 }}>
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-pixel-sm font-semibold leading-tight">{mv.name}</span>
                    <span className="text-pixel-sm opacity-50 uppercase shrink-0">{mv.type}</span>
                  </div>
                  <div className="text-pixel-sm opacity-45 mt-0.5">위력 {mv.power} · 명중 {mv.accuracy}</div>
                </button>
              ))}
            </div>

            <button onClick={() => answerForget(null)}
              className="w-full border border-stone-600 py-2 text-pixel-sm text-sand-300 hover:bg-shadow-800 transition">
              배우지 않는다
            </button>
          </div>
        </div>
      )}

      {/* 승리 오버레이 */}
      {showResultUI && battleOutcome === "win" && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-shadow-900/65">
          <div className="text-center px-8 py-8 border-2 border-moss-500 bg-shadow-900/95 shadow-2xl max-w-sm w-full mx-4"
            style={{ fontFamily: "var(--font-title)" }}>
            <p className="text-title-md font-bold text-moss-500 mb-3">WIN!</p>
            <p className="text-pixel-sm text-sand-300 mb-3 leading-relaxed">
              {floor === MAX_TOWER_FLOOR ? "탑의 정상을 정복했다…" : "다음 스테이지로?"}
            </p>

            {/* 드랍 재료 표시 */}
            {battleDrops.length > 0 && (
              <div className="mb-4 rounded-lg border border-ember-700/50 bg-ember-700/10 p-3">
                <p className="text-pixel-sm text-ember-500 mb-2">── 재료 획득 ──</p>
                <div className="flex flex-col gap-1">
                  {battleDrops.map((d, i) => {
                    const mat = getMaterial(d.id);
                    return (
                      <p key={i} className="text-pixel-sm text-ember-500">
                        {mat?.emoji ?? "?"} {mat?.name ?? d.id} ×{d.count}
                      </p>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2">
              {/* 회복 — 예전에는 이걸 하려고 탑에서 나가 /monsters까지 갔다가
                  베이스캠프에서 탑까지 다시 걸어와야 했다. 결과 화면에서 바로 처리한다. */}
              <button onClick={() => { restorePartyHp(); setHealed(true); }} disabled={healed}
                className="w-full border-2 border-mist-500 bg-mist-500/15 py-2.5 text-pixel-sm font-semibold text-mist-300 hover:bg-mist-500/25 disabled:opacity-40 transition active:scale-95">
                {healed ? "✓ 파티 회복 완료" : "+ 파티 HP 전회복"}
              </button>
              {floor === MAX_TOWER_FLOOR ? (
                <button onClick={() => navigate("/ending")}
                  className="w-full border-2 border-ember-500 bg-ember-700/25 py-3 text-pixel-sm font-bold text-ember-500 hover:bg-ember-700/40 transition active:scale-95">
                  &gt; 정수를 들고 마을로
                </button>
              ) : (
                <button onClick={() => navigate("/battle", { state: { floor: floor + 1, isCatchZone: false } })}
                  className="w-full border-2 border-moss-500 bg-moss-500/25 py-3 text-pixel-sm font-bold text-moss-500 hover:bg-moss-500/40 transition active:scale-95">
                  &gt; 다음층 ({floor + 1}F)
                </button>
              )}
              <button onClick={() => navigate("/")}
                className="w-full border-2 border-stone-600 bg-shadow-700/80 py-3 text-pixel-sm font-semibold text-sand-200 hover:bg-stone-600/80 transition active:scale-95">
                &gt; 베이스캠프
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 패배 오버레이 */}
      {showResultUI && battleOutcome === "lose" && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-shadow-900/65">
          <div className="text-center px-8 py-10 border-2 border-ember-700 bg-shadow-900/95 shadow-2xl max-w-sm w-full mx-4"
            style={{ fontFamily: "var(--font-title)" }}>
            <p className="text-title-md font-bold text-ember-500 mb-4">LOSE...</p>
            <p className="text-pixel-sm text-sand-300 mb-6 leading-relaxed">{floor}층 재도전?</p>
            <div className="flex flex-col gap-2">
              {/* 회복 — 예전에는 이걸 하려고 탑에서 나가 /monsters까지 갔다가
                  베이스캠프에서 탑까지 다시 걸어와야 했다. 결과 화면에서 바로 처리한다. */}
              <button onClick={() => { restorePartyHp(); setHealed(true); }} disabled={healed}
                className="w-full border-2 border-mist-500 bg-mist-500/15 py-2.5 text-pixel-sm font-semibold text-mist-300 hover:bg-mist-500/25 disabled:opacity-40 transition active:scale-95">
                {healed ? "✓ 파티 회복 완료" : "+ 파티 HP 전회복"}
              </button>
              <button onClick={() => navigate("/battle", { state: { floor, isCatchZone } })}
                className="w-full border-2 border-ember-700 bg-ember-700/25 py-3 text-pixel-sm font-bold text-ember-500 hover:bg-ember-700/40 transition active:scale-95">
                &gt; 재도전 ({floor}F)
              </button>
              <button onClick={() => navigate("/")}
                className="w-full border-2 border-stone-600 bg-shadow-700/80 py-3 text-pixel-sm font-semibold text-sand-200 hover:bg-stone-600/80 transition active:scale-95">
                &gt; 베이스캠프
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
