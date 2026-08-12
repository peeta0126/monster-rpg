import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { getFloorEnemy, getFloorEnemySkill, isBossFloor, MAX_TOWER_FLOOR, getTowerSecretReveal } from "../shared/floorTable";
import { MONSTER_IMAGE_MAP } from "../monster/monsterImages";
import { POTIONS, getMaterial } from "../shared/items";
import { rollBattleDrop } from "../shared/dropTables";
import type { Move, ElementType } from "../shared/game";
import { usePlayerStore, recomputeStatsForLevel, type OwnedMonster } from "../shared/playerStore";
import { monsters } from "../monster/monsters";
import { withImprint } from "../monster/imprint";
import { isAnomalyMove } from "../monster/learnset";
import { applyLevelGrowth } from "../monster/growth";
import { sumEquippedStatBonuses, sumEquippedBonusStats } from "../shared/craftingUtils";

/**
 * OwnedMonster → 배틀 진입용 OwnedMonster.
 *
 * 각인 배수를 먼저 얹고(계열 전체에 붙는 %), 그 위에 장착 장비의 HP 보너스를 더한다.
 * 공/방/속은 각인만 여기서 반영된다 — 장비 쪽 공/방/속·치명·속성 보너스는 데미지 계산
 * 시점에만 임시로 더한다(HP만 전투 내내 상태로 들고 있어야 하는 값이라 예외).
 */
function toBattleEntry(m: OwnedMonster): OwnedMonster {
  const { equippedArtifacts, imprint } = usePlayerStore.getState();
  const imprinted = withImprint(m, imprint);
  const hpBonus = sumEquippedStatBonuses(equippedArtifacts[m.uid] ?? []).hp;
  if (!hpBonus) return imprinted;
  return { ...imprinted, maxHp: imprinted.maxHp + hpBonus, currentHp: imprinted.currentHp + hpBonus };
}

/**
 * 전투가 부풀린 값을 걷어낸 **저장용** 몬스터.
 *
 * 각인 배수도 장비 HP 보너스도 세이브에 새어들면 안 된다 — 한 번 새면 다음 전투에서
 * 그 위에 또 곱해져 배수가 겹친다. 능력치는 종족 기본값 + 레벨 증분으로 다시 계산한다
 * (세이브를 읽을 때 playerStore 가 쓰는 규칙과 같은 것이라, 진화·레벨업이 끼어 있어도
 * 어긋나지 않는다). 현재 HP 는 비율만 지킨다.
 */
function toPersisted(m: OwnedMonster): OwnedMonster {
  const base = monsters.find((b) => b.id === m.id);
  if (!base) return m;
  const stats = recomputeStatsForLevel(base, m.level);
  const ratio = m.maxHp > 0 ? m.currentHp / m.maxHp : 0;
  return {
    ...m,
    ...stats,
    currentHp: m.currentHp <= 0
      ? 0
      : Math.max(1, Math.min(stats.maxHp, Math.round(stats.maxHp * ratio))),
  };
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
  benchExpShare,
  getAIAction,
  isFainted,
  type BattleMonster,
} from "./battleUtils";

import { gameEvents, GAME_EVENT } from "../shared/phaser/events";
import { createBattleGame } from "../shared/phaser/phaserConfig";
import { setBattleInitData } from "./battleInitStore";
import { CaptureOverflowPrompt } from "../monster/CaptureOverflowPrompt";
import { StatBar } from "../shared/ui";
import { ELEMENT_CHIP_CLASS } from "../shared/palette";
import { BattleCommandMenu } from "./BattleCommandMenu";
import { useBattleSettings, logSpeedMs, LOG_SPEEDS } from "../shared/battleSettings";

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

// ─── 컴포넌트 ────────────────────────────────────────────────────────────────────

export default function BattlePage() {
  const navigate   = useNavigate();
  const location   = useLocation();
  const routeState = location.state as BattleRouteState | undefined;

  const isCatchZone = routeState?.isCatchZone ?? false;
  const floor       = routeState?.floor ?? 1;

  const gameRef = useRef<HTMLDivElement | null>(null);
  const { autoAdvance, logSpeed, toggleAuto, cycleSpeed } = useBattleSettings();

  const { updateBestFloor, updatePartyMember, addCapturedMonster, absorbCapture,
          addToDexSeen, addToDexCaught, usePotion: consumePotion,
          addMaterial, setStoryFlag, dexCaught, restorePartyHp } = usePlayerStore();

  // 각인 배수와 장착 장비 HP 보너스를 미리 반영한 파티 스냅샷
  const [initialParty] = useState(() => usePlayerStore.getState().party.map(toBattleEntry));
  const [activePartyIndex, setActivePartyIndex] = useState(0);

  const [partyHp, setPartyHp] = useState<Record<string, number>>(() => {
    const m: Record<string, number> = {};
    for (const mon of initialParty) m[mon.uid] = mon.currentHp;
    return m;
  });
  const [mustSwitch, setMustSwitch] = useState(false);

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
  /** 보관함이 가득 차서 자리를 못 준 포획 — 각인으로 흡수할지 물어본다 */
  const [overflowCapture, setOverflowCapture] = useState<BattleMonster | null>(null);
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
      let autoTimer: ReturnType<typeof setTimeout> | undefined;
      const done = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        clearTimeout(autoTimer);
        gameEvents.off(GAME_EVENT.BATTLE_LOG_ACK, done);
        resolve();
      };
      // 방어책: ACK가 끝내 오지 않아도 전투가 영구히 멈추지 않도록 타임아웃 처리
      const timer = setTimeout(done, 6000);
      gameEvents.once(GAME_EVENT.BATTLE_LOG_ACK, done);
      gameEvents.emit(GAME_EVENT.BATTLE_LOG, text);
      setLogHistory((prev) => [...prev.slice(-49), text]);

      // 자동 진행. 설정을 매번 읽으므로 전투 도중에 켜고 꺼도 다음 줄부터 반영된다.
      // Q 를 누르면 그전에 ACK 가 와서 타이머는 done() 에서 정리된다.
      const { autoAdvance, logSpeed } = useBattleSettings.getState();
      if (autoAdvance) {
        autoTimer = setTimeout(() => gameEvents.emit(GAME_EVENT.BATTLE_LOG_ADVANCE), logSpeedMs(logSpeed));
      }
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
      updatePartyMember(toPersisted({ ...m, currentHp: Math.max(0, hp) }));
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

    // 연출용 신호. 계산 결과를 그대로 넘길 뿐, 여기서 아무것도 바꾸지 않는다.
    const hitTarget = isPlayerAttacking ? "enemy" : "player";
    gameEvents.emit(GAME_EVENT.BATTLE_HIT, {
      target: hitTarget, damage: res.damage, multiplier: res.multiplier,
      isCrit: res.isCrit, isHit: res.isHit, category: move.category,
    });

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
      if (expResult.leveledUp) {
        gameEvents.emit(GAME_EVENT.BATTLE_SPARKLE, "player");
        await sendLogAndWait(`레벨이 ${np.level}(으)로 올랐다!`);
      }

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
        updatePartyMember(toPersisted({ ...owned, ...np, uid: owned.uid }));
      }

      // 출전하지 않은 파티원에게도 경험치를 나눠준다.
      // 예전에는 마지막에 싸운 한 마리만 경험치를 받아서, 탑을 오를수록 나머지 둘이 방치되고
      // 사실상 1마리로 50층을 가야 했다(교체는 곧 레벨 20짜리를 레벨 40 적 앞에 내놓는 일).
      for (let i = 0; i < initialParty.length; i++) {
        if (i === activePartyIndex) continue;
        const mate = initialParty[i];
        const hp = partyHp[mate.uid] ?? mate.currentHp;
        if (hp <= 0) continue;   // 기절한 몬스터는 분배 대상에서 제외
        const share = Math.max(1, Math.floor(earnedExp * benchExpShare(mate.level, np.level)));
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
        updatePartyMember(toPersisted({ ...mate, ...grownMate, uid: mate.uid }));
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
      gameEvents.emit(GAME_EVENT.BATTLE_SPARKLE, "enemy");
      const captureResult = addCapturedMonster(enemyState);
      addToDexCaught(enemyState.id);
      if (captureResult === "storage") setStoryFlag("first_capture");
      await sendLogAndWait(captureResult === "storage" ? "보관함에 저장되었다!" : "보관함이 가득 찼다...");
      // 자리가 없다고 그냥 없애지 않는다 — 각인으로 흡수할 길이 생겼다
      if (captureResult === "full") setOverflowCapture(enemyState);
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
  // 메뉴에 넘길 물약 목록. 효과 설명은 여기서 한 번만 만든다.
  const potionEntries = POTIONS.map((p) => {
    const e = p.effect;
    const effectLabel =
      e.type === "heal"        ? `HP +${e.amount}` :
      e.type === "full_heal"   ? "HP 완전 회복" :
      e.type === "cure_status" ? "상태이상 치료" :
      e.type === "buff_attack" ? `공격 ×${e.multiplier} (${e.turns}턴)` : "";
    return { id: p.id, name: p.name, emoji: p.emoji, effectLabel, count: potionCounts[p.id] ?? 0 };
  });

  // ─── 렌더 ────────────────────────────────────────────────────────────────────────
  return (
    <div className="relative flex h-screen flex-col bg-shadow-900 text-cream-100 overflow-hidden">

      {/* Phaser 캔버스 */}
      <div ref={gameRef} className="relative flex-1 min-h-0" />

      {/* ══════════ 하단 배틀 패널 ══════════ */}
      <div data-testid="battle-panel" className="shrink-0 border-t-2 border-earth-500 bg-shadow-900">

        {/* 상태 바 — HP는 전투에서 가장 자주 보는 정보라 바를 크게 잡는다 */}
        <div className="flex items-center justify-between border-b border-earth-500/40 px-3 py-2 text-pixel-sm">
          <div className="flex items-center gap-2">
            <span className="font-bold text-cream-100">{player.name}</span>
            <span className="text-earth-400">Lv.{player.level}</span>
            <StatBar value={player.currentHp} max={player.maxHp} showNumbers className="w-64" />
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
            {/* 자동 진행 — 로그 한 줄마다 Q 를 누르는 게 엔딩까지 8천 번이다 */}
            <button onClick={toggleAuto}
              data-testid="log-auto"
              title="로그 자동 진행"
              className={`rounded border px-1.5 py-0.5 text-pixel-sm transition ${
                autoAdvance ? "border-ember-500 text-ember-500" : "border-earth-500/60 text-earth-400 hover:text-sand-300"}`}>
              {autoAdvance ? "▶ 자동" : "❙❙ 수동"}
            </button>
            {autoAdvance && (
              <button onClick={cycleSpeed}
                data-testid="log-speed"
                title="로그 속도"
                className="rounded border border-earth-500/60 px-1.5 py-0.5 text-pixel-sm text-sand-300 transition hover:text-cream-100">
                {LOG_SPEEDS.find((x) => x.id === logSpeed)?.label}
              </button>
            )}
            <button onClick={() => setShowLog((v) => !v)}
              className={`text-pixel-sm border rounded px-1.5 py-0.5 transition ${
                showLog ? "border-stone-600 text-sand-200" : "border-shadow-700 text-earth-400 hover:text-sand-300"}`}>
              기록
            </button>
            <button onClick={() => navigate("/")}
              className="text-pixel-sm text-earth-400 hover:text-sand-300 border border-shadow-700 rounded px-1.5 py-0.5">
              나가기
            </button>
          </div>
        </div>

        {/* 로그 — 높이 고정. 텍스트 길이에 따라 레이아웃이 흔들리면 안 된다 (ART_DIRECTION 3-2).
            '기록' 버튼은 지나간 줄을 다시 보는 용도로 남긴다. */}
        <div className="flex h-14 items-center border-b border-earth-500/40 bg-shadow-700/60 px-4">
          <p data-testid="battle-log-line" className="line-clamp-2 text-pixel-sm leading-[18px] text-sand-200">
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
                      <StatBar value={hp} max={m.maxHp} height={6} className="mt-0.5" />
                      <p className="font-mono text-pixel-sm text-earth-400">{hp}/{m.maxHp}</p>
                    </div>
                    {isActive  && <span className="text-pixel-sm text-ember-500 font-bold shrink-0">출전</span>}
                    {fainted   && <span className="text-pixel-sm text-earth-400 shrink-0">기절</span>}
                    {mustPick  && <span className="text-pixel-sm text-mist-300 animate-pulse shrink-0">선택</span>}
                  </button>
                );
              })}
            </div>

            {/* ─── 오른쪽 액션 영역 ──────────────────────── */}
            <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-2">
              {mustSwitch ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
                  <p className="text-pixel-sm font-bold text-ember-500">{player.name}이(가) 기절했다!</p>
                  <p className="text-pixel-sm text-sand-300">← 왼쪽에서 다음 몬스터를 선택하세요</p>
                </div>
              ) : (
                <>
                  <BattleCommandMenu
                    moves={player.moves}
                    enemyType={enemyState.type ?? "normal"}
                    potions={potionEntries}
                    disabled={isProcessing}
                    canFlee={!isBossFloor(floor)}
                    fleeBlockedReason="보스는 못 피한다"
                    onUseMove={handleMoveClick}
                    onUsePotion={handleUsePotion}
                    onFlee={handleFlee}
                  />

                  {canShowCatch && (
                    <button onClick={handleCatch} disabled={isProcessing}
                      data-testid="cmd-catch"
                      className="w-full rounded-lg border border-mist-500 bg-mist-500/15 py-1.5 text-pixel-sm font-semibold text-mist-300 transition hover:bg-mist-500/25 disabled:opacity-30">
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

      {/* 보관함이 꽉 찬 채로 잡았을 때 — 사라지기 전에 한 번 묻는다 */}
      {overflowCapture && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center bg-shadow-900/75 px-4">
          <CaptureOverflowPrompt
            monster={overflowCapture}
            onAbsorb={() => {
              if (absorbCapture(overflowCapture) === "ok") setOverflowCapture(null);
            }}
            onRelease={() => setOverflowCapture(null)}
          />
        </div>
      )}

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
                  className={`border px-2 py-1.5 text-left transition ${ELEMENT_CHIP_CLASS[mv.type as keyof typeof ELEMENT_CHIP_CLASS] ?? ELEMENT_CHIP_CLASS.normal}`}
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
