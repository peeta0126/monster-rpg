import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import {
  getFloorEnemy, getFloorEnemySkill, isBossFloor, isGateFloor, MAX_TOWER_FLOOR,
  getTowerSecretReveal, bossRegenAmount, getBossRegen,
} from "../shared/floorTable";
import { MONSTER_IMAGE_MAP } from "../monster/monsterImages";
import { POTIONS, getMaterial } from "../shared/items";
import { withJosa } from "../shared/josa";
import { PixelIcon } from "../shared/ui/PixelIcon";
import { rollBattleDrop } from "../shared/dropTables";
import type { Move, ElementType } from "../shared/game";
import { usePlayerStore, recomputeStatsForLevel, type OwnedMonster } from "../shared/playerStore";
import { monsters } from "../monster/monsters";
import { withImprint } from "../monster/imprint";
import { isAnomalyMove } from "../monster/learnset";
import { applyLevelGrowth } from "../monster/growth";
import { sumEquippedStatBonuses, sumEquippedBonusStats } from "../shared/craftingUtils";
import { useBgm, BGM } from "../shared/audio";

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
  checkStatusEffects,
  createBattleMonster,
  createBattleMonsterFromOwned,
  gainExp,
  benchExpShare,
  expLevelGapMultiplier,
  getAIAction,
  isFainted,
  tickSpeedGauge,

  type BattleMonster,
} from "./battleUtils";

import { gameEvents, GAME_EVENT } from "../shared/phaser/events";
import { createBattleGame } from "../shared/phaser/phaserConfig";
import { setBattleInitData } from "./battleInitStore";
import { ELEMENT_CHIP_CLASS } from "../shared/palette";
import { BattleCommandMenu } from "./BattleCommandMenu";
import { PartyStrip } from "./PartyStrip";
import { EnemyCard } from "./EnemyCard";
import { TurnOrderBar } from "./TurnOrderBar";
import { previewMove } from "./damagePreview";
import { statusDetail, statusLabel, STATUS_META } from "./statusInfo";
import { TypeChartPanel } from "./TypeChartPanel";
import { ExpGainOverlay } from "./ExpGainOverlay";
import { ExpStatusRow } from "./ExpStatusRow";
import { useExpPlayback } from "./expPlayback";
import { useBattleSettings, logSpeedMs, LOG_SPEEDS } from "../shared/battleSettings";

// ─── 타입 ────────────────────────────────────────────────────────────────────────

type BattleRouteState = {
  from?: string;
  portalId?: string;
  floor?: number;
};


/** 무대 우상단에 적는 층 표시. 보스는 캔버스가 ★BOSS★ 뱃지로 따로 말한다 */
function floorLabelOf(floor: number): string {
  return isGateFloor(floor) ? `${floor}층 · 관문` : `${floor}층`;
}

// ─── 컴포넌트 ────────────────────────────────────────────────────────────────────

export default function BattlePage() {
  const navigate   = useNavigate();
  const location   = useLocation();
  const routeState = location.state as BattleRouteState | undefined;

  const floor       = routeState?.floor ?? 1;

  // 보스 층 판정은 층 표(floorTable)의 것 하나뿐이다 — 여기서 10 을 다시 적지 않는다.
  // 층이 바뀌어 이 화면이 통째로 다시 마운트돼도 같은 키면 곡이 안 끊긴다.
  useBgm(isBossFloor(floor) ? BGM.boss : BGM.battle);

  const gameRef = useRef<HTMLDivElement | null>(null);
  const { autoAdvance, logSpeed, toggleAuto, cycleSpeed } = useBattleSettings();

  const { updateBestFloor, updatePartyMember,
          addToDexSeen, addToDexCaught, usePotion: consumePotion,
          addMaterial, dexCaught } = usePlayerStore();

  // 각인 배수와 장착 장비 HP 보너스를 미리 반영한 파티 스냅샷
  const [initialParty] = useState(() => usePlayerStore.getState().party.map(toBattleEntry));
  const [activePartyIndex, setActivePartyIndex] = useState(0);

  const [partyHp, setPartyHp] = useState<Record<string, number>>(() => {
    const m: Record<string, number> = {};
    for (const mon of initialParty) m[mon.uid] = mon.currentHp;
    return m;
  });
  const [mustSwitch, setMustSwitch] = useState(false);
  /**
   * 키보드 포커스가 어느 구역에 있는가.
   *
   * 두 구역(파티·커맨드)이 각자 키를 듣는데 둘 다 듣고 있으면 ← 한 번에 두 곳이 움직인다.
   * 그래서 "지금 듣는 쪽"을 여기서 하나만 정한다 — 화면의 밝기도 이 값을 따라간다.
   */
  const [focusZone, setFocusZone] = useState<"party" | "command">("command");
  const [partyCursor, setPartyCursor] = useState(0);

  // 실시간 물약 재고 (사용 시 갱신)
  const [potionCounts, setPotionCounts] = useState<Record<string, number>>(
    () => usePlayerStore.getState().potions,
  );

  const initialPlayer = initialParty[0] ?? usePlayerStore.getState().party[0];
  /**
   * ⚠️ **한 전투에 한 번만 굴린다.** 맨몸으로 두면 렌더마다 다시 굴러서, 적이 랜덤으로
   * 정해지는 층에서 캔버스와 하단 UI 가 서로 다른 굴림을 잡는다 — 49층에서 캔버스는
   * 크리샤를, 상대 카드는 모시를 보여줬다. 첫 렌더의 굴림은 아래 useState 초기화가,
   * 나중 렌더의 굴림은 씬 초기 데이터가 가져갔기 때문이다.
   *
   * 지금은 층마다 구성이 정해져 있지만 랜덤 갈래가 사라진 건 아니다 — 내 선봉과 그 층의
   * 적이 같은 종이면 거울 싸움을 피하려고 풀에서 다시 뽑는다(getFloorEnemy 의 excludeId).
   */
  const initialEnemy = useMemo(
    () => getFloorEnemy(floor, initialPlayer.id),
    [floor, initialPlayer.id],
  );

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
  const [showLog,       setShowLog]       = useState(false);
  /** 속성 상성표. 전투를 멈추지 않고 패널 위에 떠 있기만 한다 */
  const [showTypeChart, setShowTypeChart] = useState(false);
  /**
   * 승리 직후 경험치 바가 차오르는 연출. 끝나야 다음 로그로 넘어간다.
   * 레벨업 순간의 반짝임은 씬이 그린다 — 바는 하단에 있고 몬스터는 캔버스에 있어서,
   * 둘이 같이 반응해야 "쟤가 컸다"로 읽힌다.
   */
  const { view: expView, play: playExp, advance: advanceExp } = useExpPlayback(
    useCallback(() => gameEvents.emit(GAME_EVENT.BATTLE_SPARKLE, "player"), []),
  );
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
  /** 적이 직전에 쓴 기술. 같은 기술을 두 턴 연속으로 던지지 않게 하는 데만 쓴다 */
  const lastEnemyMoveRef = useRef<string | undefined>(undefined);
  /** 보스 회복 기믹은 전투당 한 번뿐이다 */
  const bossRegenUsedRef = useRef(false);
  const cancelledRef = useRef(false);
  /**
   * 속도 게이지(battleUtils.tickSpeedGauge). 빠른 쪽만 찬다.
   * 화면에도 남은 턴을 적어야 해서 상태로 한 벌 복사해 둔다 — ref 는 다시 그리지 않는다.
   */
  const playerGaugeRef = useRef(0);
  const enemyGaugeRef  = useRef(0);
  const [gauges, setGauges] = useState({ player: 0, enemy: 0 });
  const syncGauges = useCallback(() => {
    setGauges({ player: playerGaugeRef.current, enemy: enemyGaugeRef.current });
  }, []);
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

  /**
   * 결과 화면과 기술 교체 창의 키보드.
   *
   * 전투는 키보드로 다 되는데 마지막 두 화면만 마우스를 요구하면, 한 판에 한 번은 반드시
   * 손이 마우스로 간다. Enter 는 주 행동, Esc 는 물러나기 — 게임 전체에서 같은 약속이다.
   */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (forgetPrompt) {
        if (e.key === "Escape") { e.preventDefault(); answerForgetRef.current(null); }
        else if (/^[1-4]$/.test(e.key)) {
          const idx = Number(e.key) - 1;
          if (idx < forgetPrompt.current.length) { e.preventDefault(); answerForgetRef.current(idx); }
        }
        return;
      }
      if (!showResultUI || !battleOutcome) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        (document.querySelector("[data-testid=result-primary]") as HTMLButtonElement | null)?.click();
      } else if (e.key === "Escape") {
        e.preventDefault();
        (document.querySelector("[data-testid=result-camp], [data-testid=result-primary]") as HTMLButtonElement | null)?.click();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showResultUI, battleOutcome, forgetPrompt]);

  // 상성표는 T, 기록은 L. code 로 보는 건 한글 자판에서도 같은 키가 되게 하려는 것.
  // Esc 는 쓰지 않는다 — 커맨드 메뉴의 "뒤로"와 같은 키라 표를 닫으면서 커서까지 되돌아간다.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "KeyT") { e.preventDefault(); setShowTypeChart((v) => !v); return; }
      if (e.code === "KeyL") { e.preventDefault(); setShowLog((v) => !v); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ─── Phaser 동기화 ─────────────────────────────────────────────────────────────
  const syncHpToPhaser = useCallback((p: BattleMonster, e: BattleMonster) => {
    gameEvents.emit(GAME_EVENT.BATTLE_STATE_UPDATE, {
      playerHp: p.currentHp, playerMaxHp: p.maxHp,
      playerStatus: p.status, playerStatusTurns: p.statusTurns,
      enemyHp:  e.currentHp, enemyMaxHp:  e.maxHp,
      enemyStatus:  e.status, enemyStatusTurns: e.statusTurns,
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
      enemyType:      initialEnemy.type,
      floor, floorLabel: floorLabelOf(floor), isBoss: isBossFloor(floor),
      partyImageUrls: initialParty.map(m => MONSTER_IMAGE_MAP[m.id] ?? ""),
      partyNames:     initialParty.map(m => m.name),
      partyLevels:    initialParty.map(m => m.level),
    });
    const game = createBattleGame(gameRef.current);

    /**
     * 캔버스는 FIT 이라 부모 크기에 맞춰 줄어야 하는데, Phaser 는 **창** 크기가
     * 바뀔 때만 다시 잰다. 하단 패널은 기술 목록을 펼치면 창은 그대로인 채 혼자
     * 커지므로, 캔버스가 옛 크기로 남아 아래가 잘렸다 — 내 몬스터 HP 상자가
     * 딱 그 자리에 있어서 기술을 고르는 동안 반쯤 사라졌다.
     */
    const observer = new ResizeObserver(() => game.scale.refresh());
    observer.observe(gameRef.current);

    return () => {
      cancelledRef.current = true;
      observer.disconnect();
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
  /** 키보드 쪽에서 부르는 최신 참조 (선언 순서 때문에 effect 가 직접 못 잡는다) */
  const answerForgetRef = useRef(answerForget);
  answerForgetRef.current = answerForget;

  /**
   * 경험치 연출을 띄우고 끝날 때까지 기다린다. 로그 한 줄과 같은 자리를 차지하는 대신
   * 바가 차오르고, 레벨이 오르면 거기서 멈춰 오른 스탯을 보여준다.
   * 기록 패널에는 예전과 같은 한 줄을 남긴다 — 연출은 지나가고 기록은 남아야 한다.
   */
  const playExpGain = useCallback((before: BattleMonster, gained: number): Promise<void> => {
    setLogHistory((prev) => [...prev.slice(-49), `경험치 ${withJosa(gained, "을를")} 획득했다!`]);
    if (cancelledRef.current) return Promise.resolve();
    return playExp(before, gained);
  }, [playExp]);

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

  /** 파티 구역이 그릴 값. 화면 부품이 스토어 모양을 몰라도 되게 여기서 한 번 빚는다 */
  const partyView = initialParty.map((m, idx) => {
    const isActive = idx === activePartyIndex;
    const hp = isActive ? player.currentHp : (partyHp[m.uid] ?? m.currentHp);
    return {
      uid: m.uid, id: m.id, name: m.nickname ?? m.name, level: m.level,
      currentHp: hp, maxHp: m.maxHp,
      status: isActive ? player.status : null,
      statusTurns: isActive ? player.statusTurns : 0,
      isActive, fainted: hp <= 0,
    };
  });

  /**
   * 속도 차가 쌓여 한 번 더 움직이기까지 몇 턴 남았는가. 굴림이 아니라 누적이라
   * 미리 적을 수 있다 — "이번엔 누가 먼저 움직이지?"를 예측할 수 있어야 한다는 조건이
   * 무작위 선공을 못 쓰게 만든다.
   */

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

    // 이미 상태이상이 걸린 상대에게 상태기를 쓰면 그 턴은 통째로 날아간다. 예전엔 아무
    // 반응도 없이 다음 줄로 넘어가서, 안 걸린 건지 원래 그런 건지 알 수가 없었다.
    if (move.power === 0 && move.statusEffect && next.status !== null) {
      await sendLogAndWait(`${withJosa(next.name, "은는")} 이미 ${statusLabel(next.status)} 상태다. 효과가 없었다...`);
    } else if (move.statusEffect && (move.statusChance ?? 0) > 0 && Math.random() * 100 <= (move.statusChance ?? 0)) {
      const before = next.status;
      next = applyStatusEffect(next, move.statusEffect);
      if (before === null && next.status !== null) {
        await sendLogAndWait(`${next.name}에게 ${statusLabel(next.status)} 상태이상이 걸렸다!`);
      }
    }

    const fainted = isFainted(next);
    if (fainted) await sendLogAndWait(`${withJosa(defender.name, "이가")} 쓰러졌다!`);
    return { updated: next, fainted };
  }, [sendLogAndWait, syncHpToPhaser, dexCaught, floor]);

  /**
   * 턴 머리의 상태이상 처리.
   *
   * ⚠️ 여기서 기절 판정을 하는 게 이 함수의 존재 이유다. 예전엔 checkStatusEffects 가
   * HP 만 깎고 아무도 확인하지 않아서, 화상으로 HP 가 0 이 된 몬스터가 그 턴에 멀쩡히
   * 공격하고 다음에 **맞을 때까지** 계속 싸웠다. 쓰러졌으면 그 턴의 공격은 나가지 않는다.
   */
  const runStatusPhase = useCallback(async (
    mon: BattleMonster, other: BattleMonster, isPlayer: boolean,
  ): Promise<{ mon: BattleMonster; skip: boolean; fainted: boolean }> => {
    const s = checkStatusEffects(mon);
    const updated = s.monster;
    for (const log of s.logs) {
      if (isPlayer) syncHpToPhaser(updated, other);
      else          syncHpToPhaser(other, updated);
      await sendLogAndWait(log);
    }
    const fainted = isFainted(updated);
    if (fainted) await sendLogAndWait(`${withJosa(updated.name, "이가")} 쓰러졌다!`);
    return { mon: updated, skip: s.skipTurn || fainted, fainted };
  }, [sendLogAndWait, syncHpToPhaser]);

  /** 이번에 적이 낼 기술. 고정 순서가 있는 층이면 그것을, 아니면 AI 가 고른다 */
  const nextEnemyMove = useCallback((e: BattleMonster, p: BattleMonster): Move => {
    const idx = enemyTurnRef.current;
    enemyTurnRef.current += 1;
    const last = lastEnemyMoveRef.current;
    const move = getFloorEnemySkill(floor, idx, e.moves, last) ?? getAIAction(e, p, floor, last);
    lastEnemyMoveRef.current = move.id;
    return move;
  }, [floor]);

  /**
   * 승리 정산 — 경험치·성장·드랍·저장까지.
   *
   * 예전엔 이 60줄이 handleMoveClick 안에만 있었다. 그런데 이제 적은 공격을 맞고서만
   * 쓰러지는 게 아니다(화상·독으로 죽고, 물약 턴이나 교체 턴에도 죽는다). 그때마다
   * 정산을 베껴 두면 어느 한 길에서만 경험치가 안 들어오는 사고가 난다.
   *
   * activeIdx 를 인자로 받는 이유는 교체 턴 때문이다 — 그 순간의 setState 는 아직
   * 반영 전이라 activePartyIndex 를 읽으면 교체 전 몬스터에게 경험치가 들어간다.
   */
  const resolveVictory = useCallback(async (
    won: BattleMonster, ne: BattleMonster, activeIdx: number,
  ) => {
    let np = won;
    const bonus = getEquipCombatBonus(initialParty[activeIdx]?.uid);
    // 레벨차 배수는 **받는 쪽마다** 다르다. 여기서 한 번 곱해 버리면 뒤처진 벤치 몬스터도
    // 선봉의 배수를 물려받는다 — 그럼 따라잡기가 안 된다.
    const baseExp = ne.rewardExp * (1 + bonus.expBonus / 100);
    const leadGapMult = expLevelGapMultiplier(ne.level, np.level);
    const earnedExp = Math.floor(baseExp * leadGapMult);
    const prevLevel = np.level;
    const beforeExp = np;
    const expResult = gainExp(np, earnedExp);
    np = expResult.updatedMonster;
    // 반짝임은 연출이 그 레벨에 닿는 순간에 터진다(useExpPlayback). 여기서 미리 터뜨리면
    // 바가 차기도 전에 몬스터만 번쩍이고, 여러 레벨이 올라도 한 번밖에 안 뜬다.
    if (expResult.leveledUp) {
      setLogHistory((prev) => [...prev.slice(-49), `레벨이 ${withJosa(np.level, "로")} 올랐다!`]);
    }
    // 경험치가 왜 안 들어오는지 말해 준다. 이 줄이 없으면 플레이어는 고장으로 읽는다 —
    // 실제로는 "이 층은 이제 네 밥이 아니다, 위로 가라"는 설계다.
    if (leadGapMult <= 0) {
      await sendLogAndWait(`${withJosa(np.name, "은는")} 이 층의 상대에게서 더 배울 것이 없다.`);
    } else if (leadGapMult < 0.35) {
      await sendLogAndWait(`${np.name}에게는 너무 약한 상대다. 배울 게 거의 없다…`);
    }
    // 로그 한 줄 대신 바가 차오르는 걸 보여준다. 레벨업이면 여기서 멈춰 오른 스탯을 띄운다.
    await playExpGain(beforeExp, earnedExp);

    // 레벨업에 딸린 성장(기술 습득·진화)을 적용한다
    if (expResult.leveledUp) {
      const growth = await applyLevelGrowth(np, prevLevel, askWhichToForget);
      np = growth.monster;
      for (const mv of growth.forgotten) {
        await sendLogAndWait(`${withJosa(np.name, "은는")} ${withJosa(mv.name, "을를")} 잊어버렸다...`);
      }
      for (const mv of growth.learned) {
        await sendLogAndWait(`${withJosa(np.name, "은는")} ${withJosa(mv.name, "을를")} 배웠다!`);
      }
      if (growth.evolvedFrom) {
        await sendLogAndWait(`…어라? ${growth.evolvedFrom}의 모습이 변하고 있다!`);
        await sendLogAndWait(`${withJosa(growth.evolvedFrom, "은는")} ${withJosa(np.name, "로")} 진화했다!`);
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

    const owned = initialParty[activeIdx];
    if (owned) {
      updatePartyMember(toPersisted({ ...owned, ...np, uid: owned.uid }));
    }

    // 출전하지 않은 파티원에게도 경험치를 나눠준다.
    // 예전에는 마지막에 싸운 한 마리만 경험치를 받아서, 탑을 오를수록 나머지 둘이 방치되고
    // 사실상 1마리로 50층을 가야 했다(교체는 곧 레벨 20짜리를 레벨 40 적 앞에 내놓는 일).
    for (let i = 0; i < initialParty.length; i++) {
      if (i === activeIdx) continue;
      const mate = initialParty[i];
      const hp = partyHp[mate.uid] ?? mate.currentHp;
      if (hp <= 0) continue;   // 기절한 몬스터는 분배 대상에서 제외
      // 하한 1 을 두지 않는다 — 1 경험치라도 들어오면 죽은 갈이가 기술적으로는 살아난다
      const share = Math.floor(
        baseExp * expLevelGapMultiplier(ne.level, mate.level) * benchExpShare(mate.level, np.level),
      );
      if (share <= 0) continue;
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
    finishBattle("win");
  }, [
    floor, initialParty, partyHp, getEquipCombatBonus, playExpGain, askWhichToForget,
    sendLogAndWait, addMaterial, addToDexSeen, addToDexCaught,
    updatePartyMember, updateBestFloor, finishBattle,
  ]);

  /**
   * 플레이어가 공격 말고 다른 걸 한 턴(물약·교체·포획)의 적 차례.
   * 상태이상 → 공격 → (속도 게이지가 찼으면) 한 번 더. 어느 단계에서든 기절하면 거기서 멈춘다.
   */
  const runEnemyTurn = useCallback(async (
    startPlayer: BattleMonster, startEnemy: BattleMonster, defBonus: number, playerSpeed: number,
  ): Promise<{ player: BattleMonster; enemy: BattleMonster; playerFainted: boolean; enemyFainted: boolean }> => {
    let p = startPlayer;
    let e = startEnemy;

    const st = await runStatusPhase(e, p, false);
    e = st.mon;
    if (st.fainted) return { player: p, enemy: e, playerFainted: false, enemyFainted: true };

    const tick = tickSpeedGauge(enemyGaugeRef.current, e.speed, playerSpeed);
    enemyGaugeRef.current = tick.gauge.charge;

    if (!st.skip) {
      const res = await resolveAttack(e, p, nextEnemyMove(e, p), p, e, false, 0, defBonus);
      p = res.updated;
      if (res.fainted) return { player: p, enemy: e, playerFainted: true, enemyFainted: false };
    }

    if (tick.extra) {
      await sendLogAndWait(`${withJosa(e.name, "이가")} 한 번 더 움직인다!`);
      const res = await resolveAttack(e, p, nextEnemyMove(e, p), p, e, false, 0, defBonus);
      p = res.updated;
      if (res.fainted) return { player: p, enemy: e, playerFainted: true, enemyFainted: false };
    }

    syncGauges();
    return { player: p, enemy: e, playerFainted: false, enemyFainted: false };
  }, [runStatusPhase, resolveAttack, nextEnemyMove, sendLogAndWait, syncGauges]);

  // ─── 한 라운드 ──────────────────────────────────────────────────────────────────
  /**
   * 플레이어의 행동 한 번과 그에 딸린 적의 차례.
   *
   * 공격이든 방어든 라운드 구조는 같아서 한 함수로 둔다 — 방어를 따로 짜면 상태이상·속도
   * 게이지·기절 판정이 두 벌이 되고, 그 둘은 반드시 어긋난다(이 저장소에서 물약 턴이
   * 그랬다).
   */
  const runRound = useCallback(async (action: { kind: "move"; move: Move } | { kind: "guard" }) => {
    if (isProcessing || battleOutcome !== null || mustSwitch) return;
    setIsProcessing(true);

    let np = player;
    let ne = enemyState;

    // 방어는 **적이 때리기 전에** 서 있어야 한다. 적이 선공이어도 막아야 하므로 라운드 맨 앞에서 건다
    if (action.kind === "guard") {
      np = { ...np, guarding: true };
      await sendLogAndWait(`${withJosa(np.name, "이가")} 몸을 웅크렸다. 다음 공격을 견딘다!`);
    }

    const playerBonus = getEquipCombatBonus(initialParty[activePartyIndex]?.uid);
    const playerSpeed = np.speed + playerBonus.speed;
    const playerFirst = playerSpeed >= ne.speed;

    // 속도 게이지는 한 턴에 한 번만 찬다. 차 있는 쪽이 그 턴에 한 번 더 움직인다.
    const pTick = tickSpeedGauge(playerGaugeRef.current, playerSpeed, ne.speed);
    const eTick = tickSpeedGauge(enemyGaugeRef.current, ne.speed, playerSpeed);
    playerGaugeRef.current = pTick.gauge.charge;
    enemyGaugeRef.current  = eTick.gauge.charge;

    const playerAttack = async (): Promise<boolean> => {
      if (action.kind === "guard") return false;   // 방어한 턴에는 공격이 없다
      const res = await resolveAttack(
        np, ne, action.move, np, ne, true,
        playerBonus.attack, 0, playerBonus.critRate, playerBonus.elementPower,
        playerBonus.elementalDamage, playerBonus.critDamage,
      );
      ne = res.updated;
      if (res.fainted) return true;
      // 보스 기믹 — 한 번은 몸을 추스른다(40층 모왕). 숫자만 큰 보스는 "몇 대 더"의 문제라
      // 장비가 있으나 없으나 결론이 같지만, 회복이 끼면 "정해진 턴 안에 넣을 수 있나"가 된다
      if (!bossRegenUsedRef.current) {
        const heal = bossRegenAmount(floor, ne.currentHp, ne.maxHp);
        if (heal > 0) {
          bossRegenUsedRef.current = true;
          ne = { ...ne, currentHp: Math.min(ne.maxHp, ne.currentHp + heal) };
          syncHpToPhaser(np, ne);
          gameEvents.emit(GAME_EVENT.BATTLE_SPARKLE, "enemy");
          await sendLogAndWait(getBossRegen(floor)?.line ?? `${withJosa(ne.name, "이가")} 회복했다!`);
        }
      }
      return false;
    };

    const enemyAttack = async (): Promise<boolean> => {
      const res = await resolveAttack(ne, np, nextEnemyMove(ne, np), np, ne, false, 0, playerBonus.defense);
      np = res.updated;
      return res.fainted;
    };

    /**
     * 반환값은 둘 다 "이 차례의 주인 기준"이다 — [상대를 쓰러뜨렸나, 내가 쓰러졌나].
     * 뒤엣것은 상태이상 피해로 자기 턴에 죽는 경우다.
     */
    const doPlayerTurn = async (): Promise<[boolean, boolean]> => {
      np = tickBuff(np);
      if (np.attackBuffTurns === 0 && player.attackBuffTurns > 0) {
        await sendLogAndWait(`${np.name}의 공격 강화가 풀렸다.`);
      }
      const ps = await runStatusPhase(np, ne, true);
      np = ps.mon;
      if (ps.fainted) return [false, true];      // 화상·독으로 여기서 죽으면 공격은 안 나간다
      if (ps.skip) return [false, false];
      return [await playerAttack(), false];
    };

    const doEnemyTurn = async (): Promise<[boolean, boolean]> => {
      const es = await runStatusPhase(ne, np, false);
      ne = es.mon;
      if (es.fainted) return [false, true];
      if (es.skip) return [false, false];
      return [await enemyAttack(), false];
    };

    let playerWon = false, enemyWon = false;
    if (playerFirst) {
      [playerWon, enemyWon] = await doPlayerTurn();
      if (!playerWon && !enemyWon) [enemyWon, playerWon] = await doEnemyTurn();
    } else {
      [enemyWon, playerWon] = await doEnemyTurn();
      if (!playerWon && !enemyWon) [playerWon, enemyWon] = await doPlayerTurn();
    }

    // 속도 차가 쌓인 쪽의 추가 행동. 상태이상 처리는 턴에 한 번뿐이라 여기서는 때리기만 한다.
    if (!playerWon && !enemyWon && pTick.extra) {
      await sendLogAndWait(`${withJosa(np.name, "이가")} 한 번 더 움직인다!`);
      playerWon = await playerAttack();
    } else if (!playerWon && !enemyWon && eTick.extra) {
      await sendLogAndWait(`${withJosa(ne.name, "이가")} 한 번 더 움직인다!`);
      enemyWon = await enemyAttack();
    }
    syncGauges();

    // 방어 자세는 그 턴에만 유효하다
    np = { ...np, guarding: false };

    if (playerWon) {
      await resolveVictory(np, ne, activePartyIndex);
      setIsProcessing(false); return;
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
    activePartyIndex, initialParty, resolveAttack, nextEnemyMove, runStatusPhase,
    sendLogAndWait, finishBattle, hasAlivePartyMember, getEquipCombatBonus,
    resolveVictory, syncGauges, syncHpToPhaser,
  ]);

  const handleMoveClick = useCallback((move: Move) => runRound({ kind: "move", move }), [runRound]);
  /** 방어 — 그 턴 피해 절반, 새 상태이상 차단. 대신 공격이 없다 */
  const handleGuard = useCallback(() => runRound({ kind: "guard" }), [runRound]);

  // ─── 파티 교체 ──────────────────────────────────────────────────────────────────
  /** 키보드에서 부를 때 쓰는 최신 참조 — 선언 순서 때문에 직접 못 부른다 */
  const handlePartySwapRef = useRef<(i: number) => void>(() => {});

  /**
   * 파티 구역의 키보드. 커맨드 메뉴와 **동시에 듣지 않는다**(focusZone 이 하나뿐).
   * 기절해서 반드시 골라야 하는 상황에서는 자동으로 이쪽에 포커스가 온다.
   */
  useEffect(() => {
    if (isProcessing && !mustSwitch) return;
    if (focusZone !== "party" && !mustSwitch) return;

    const onKey = (e: KeyboardEvent) => {
      const n = initialParty.length;
      switch (e.key) {
        case "ArrowUp":
          e.preventDefault(); setPartyCursor((c) => Math.max(0, c - 1)); break;
        case "ArrowDown":
          e.preventDefault(); setPartyCursor((c) => Math.min(n - 1, c + 1)); break;
        case "ArrowRight":
        case "Escape":
          // 기절 교체 중에는 빠져나갈 수 없다 — 고르는 것 말고 할 게 없는 상태다
          if (mustSwitch) return;
          e.preventDefault(); setFocusZone("command"); break;
        case "Enter":
        case " ": {
          e.preventDefault();
          const target = partyView[partyCursor];
          if (target && !target.fainted && !target.isActive) handlePartySwapRef.current(partyCursor);
          break;
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focusZone, mustSwitch, isProcessing, initialParty.length, partyCursor, partyView]);

  // 기절하면 고를 곳으로 포커스를 옮겨 준다. 손이 알아서 가야 하는 자리다
  useEffect(() => {
    if (!mustSwitch) return;
    setFocusZone("party");
    const first = partyView.findIndex((m) => !m.fainted && !m.isActive);
    if (first >= 0) setPartyCursor(first);
    // partyView 는 매 렌더 새로 만들어지므로 의존성에 넣으면 커서가 계속 되돌아간다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mustSwitch]);

  const handlePartySwap = useCallback(async (partyIdx: number) => {
    if (isProcessing || battleOutcome !== null || partyIdx === activePartyIndex) return;
    const nextOwned = initialParty[partyIdx];
    if (!nextOwned) return;
    const nextHp = partyHp[nextOwned.uid] ?? nextOwned.currentHp;
    if (nextHp <= 0) return;

    setIsProcessing(true);
    const outUid = initialParty[activePartyIndex]?.uid;
    if (outUid) setPartyHp(prev => ({ ...prev, [outUid]: player.currentHp }));

    if (!mustSwitch) await sendLogAndWait(`${withJosa(player.name, "을를")} 교체한다!`);

    const nextPlayer: BattleMonster = { ...createBattleMonsterFromOwned(nextOwned), currentHp: nextHp };
    setActivePartyIndex(partyIdx);
    setPlayer(nextPlayer);
    setMustSwitch(false);
    syncHpToPhaser(nextPlayer, enemyState);
    gameEvents.emit(GAME_EVENT.BATTLE_PLAYER_SWITCH, { partyIndex: partyIdx, name: nextOwned.name, level: nextOwned.level });

    if (mustSwitch) { setIsProcessing(false); return; }

    // 새로 나온 몬스터의 속도로 게이지를 다시 잡는다 — 앞선 몬스터가 쌓아 둔 값을
    // 물려받으면, 느린 몬스터를 내보내자마자 연속 공격이 터지는 일이 생긴다.
    playerGaugeRef.current = 0;
    enemyGaugeRef.current  = 0;

    const bonus = getEquipCombatBonus(nextOwned.uid);
    const turn = await runEnemyTurn(nextPlayer, enemyState, bonus.defense, nextPlayer.speed + bonus.speed);
    const np2 = turn.player;

    if (turn.enemyFainted) {
      await resolveVictory(np2, turn.enemy, partyIdx);
      setIsProcessing(false);
      return;
    }
    if (turn.playerFainted) {
      setPartyHp(prev => ({ ...prev, [nextOwned.uid]: 0 }));
      setPlayer({ ...np2, currentHp: 0 }); setEnemyState(turn.enemy);
      if (hasAlivePartyMember(partyIdx, nextOwned.uid, 0)) setMustSwitch(true);
      else finishBattle("lose");
    } else {
      setPartyHp(prev => ({ ...prev, [nextOwned.uid]: np2.currentHp }));
      setPlayer(np2); setEnemyState(turn.enemy);
    }
    setIsProcessing(false);
  }, [
    isProcessing, battleOutcome, activePartyIndex, initialParty, player,
    enemyState, partyHp, mustSwitch,
    syncHpToPhaser, sendLogAndWait, finishBattle, hasAlivePartyMember,
    getEquipCombatBonus, runEnemyTurn, resolveVictory,
  ]);
  handlePartySwapRef.current = handlePartySwap;

  // ─── 물약 사용 ──────────────────────────────────────────────────────────────────
  const handleUsePotion = useCallback(async (potionId: string) => {
    if (isProcessing || battleOutcome !== null || mustSwitch) return;
    const potion = POTIONS.find(p => p.id === potionId);
    if (!potion) return;
    if ((potionCounts[potionId] ?? 0) <= 0) return;

    setIsProcessing(true);

    // 물약을 꺼내는 것도 턴이다 — 화상·독은 여기서도 깎는다. 여기서 쓰러지면 물약은
    // 쓰지 않은 것이 되고(재고도 그대로), 마비·빙결이면 꺼내지도 못한 채 턴만 넘어간다.
    const uid = initialParty[activePartyIndex]?.uid;
    const bonus = getEquipCombatBonus(uid);
    const pre = await runStatusPhase(player, enemyState, true);
    if (pre.fainted) {
      if (uid) setPartyHp(prev => ({ ...prev, [uid]: 0 }));
      setPlayer({ ...pre.mon, currentHp: 0 });
      if (hasAlivePartyMember(activePartyIndex, uid, 0)) setMustSwitch(true);
      else finishBattle("lose");
      setIsProcessing(false); return;
    }
    if (pre.skip) {
      setPlayer(pre.mon);
      const skipped = await runEnemyTurn(pre.mon, enemyState, bonus.defense, pre.mon.speed + bonus.speed);
      if (skipped.enemyFainted) { await resolveVictory(skipped.player, skipped.enemy, activePartyIndex); setIsProcessing(false); return; }
      if (skipped.playerFainted) {
        if (uid) setPartyHp(prev => ({ ...prev, [uid]: 0 }));
        setPlayer({ ...skipped.player, currentHp: 0 }); setEnemyState(skipped.enemy);
        if (hasAlivePartyMember(activePartyIndex, uid, 0)) setMustSwitch(true);
        else finishBattle("lose");
      } else {
        if (uid) setPartyHp(prev => ({ ...prev, [uid]: skipped.player.currentHp }));
        setPlayer(skipped.player); setEnemyState(skipped.enemy);
      }
      setIsProcessing(false); return;
    }

    // 물약 소모
    const ok = consumePotion(potionId);
    if (!ok) { setIsProcessing(false); return; }
    setPotionCounts(prev => ({ ...prev, [potionId]: Math.max(0, (prev[potionId] ?? 0) - 1) }));

    // 효과 적용
    let np = pre.mon;
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
        await sendLogAndWait(`${np.name}의 ${statusLabel(np.status)} 상태가 치료됐다!`);
        np = { ...np, status: null, statusTurns: 0 };
      } else {
        await sendLogAndWait("상태이상이 없다...");
      }
    } else if (eff.type === "buff_attack") {
      await sendLogAndWait(`${np.name}의 공격력이 ${eff.turns}턴간 ${eff.multiplier}배로 올랐다!`);
      np = { ...np, attackBuffMult: eff.multiplier, attackBuffTurns: eff.turns };
    }

    // 물약 사용 후 partyHp 업데이트
    if (uid) setPartyHp(prev => ({ ...prev, [uid]: np.currentHp }));
    setPlayer(np);
    syncHpToPhaser(np, enemyState);

    // 적 반격 (아이템 사용 = 1턴 소비)
    const turn = await runEnemyTurn(np, enemyState, bonus.defense, np.speed + bonus.speed);
    np = turn.player;

    if (turn.enemyFainted) {
      await resolveVictory(np, turn.enemy, activePartyIndex);
      setIsProcessing(false); return;
    }
    if (turn.playerFainted) {
      if (uid) setPartyHp(prev => ({ ...prev, [uid]: 0 }));
      setPlayer({ ...np, currentHp: 0 }); setEnemyState(turn.enemy);
      if (hasAlivePartyMember(activePartyIndex, uid, 0)) setMustSwitch(true);
      else finishBattle("lose");
    } else {
      if (uid) setPartyHp(prev => ({ ...prev, [uid]: np.currentHp }));
      setPlayer(np); setEnemyState(turn.enemy);
    }
    setIsProcessing(false);
  }, [
    isProcessing, battleOutcome, mustSwitch, player, enemyState,
    potionCounts, activePartyIndex, initialParty,
    consumePotion, syncHpToPhaser, sendLogAndWait, runStatusPhase, runEnemyTurn,
    finishBattle, hasAlivePartyMember, getEquipCombatBonus, resolveVictory,
  ]);

  // ─── 렌더 헬퍼 ──────────────────────────────────────────────────────────────────
  const activeBonus = getEquipCombatBonus(initialParty[activePartyIndex]?.uid);
  const activeSpeed = player.speed + activeBonus.speed;
  const speedFirst = activeSpeed >= enemyState.speed;
  void speedFirst;   // 순서는 이제 턴 바가 보여준다 (TurnOrderBar)

  /**
   * 기술 셀에 들어갈 예상 결과. 전투가 실제로 쓰는 계산 함수를 그대로 부른다
   * (damagePreview → battleUtils.computeDamage). 보너스도 resolveAttack 에 넘기는 것과
   * 같은 것을 넘긴다 — 여기서 하나라도 빠지면 표시와 실제가 어긋난다.
   */
  const getMovePreview = (move: Move) =>
    previewMove(player, enemyState, move, {
      attack: activeBonus.attack,
      critRate: activeBonus.critRate,
      elementPower: activeBonus.elementPower,
      critDamage: activeBonus.critDamage,
      elementalDamage: activeBonus.elementalDamage,
    });
  // 메뉴에 넘길 물약 목록. 효과 설명은 여기서 한 번만 만든다.
  const potionEntries = POTIONS.map((p) => {
    const e = p.effect;
    const effectLabel =
      e.type === "heal"        ? `HP +${e.amount}` :
      e.type === "full_heal"   ? "HP 완전 회복" :
      e.type === "cure_status" ? "상태이상 치료" :
      e.type === "buff_attack" ? `공격 ×${e.multiplier} (${e.turns}턴)` : "";
    return { id: p.id, name: p.name, icon: p.icon, effectLabel, count: potionCounts[p.id] ?? 0 };
  });

  // ─── 렌더 ────────────────────────────────────────────────────────────────────────
  return (
    <div className="relative flex h-screen flex-col bg-shadow-900 text-cream-100 overflow-hidden">

      {/* Phaser 캔버스 */}
      <div ref={gameRef} className="relative flex-1 min-h-0" />

      {/* ══════════ 하단 배틀 패널 ══════════ */}
      <div data-testid="battle-panel" data-floor={floor} className="relative shrink-0 border-t-2 border-earth-500 bg-shadow-900">

        {/* 상성표 — 패널 바로 위에 뜬다. 레이아웃을 밀지 않으니 캔버스가 줄었다 늘었다 하지 않고,
            열어 둔 채로 기술을 골라도 된다. */}
        {showTypeChart && (
          <div className="absolute bottom-full right-3 z-40 mb-2">
            <TypeChartPanel enemyType={enemyState.type} onClose={() => setShowTypeChart(false)} />
          </div>
        )}

        {/* ── ① 턴 바 ──────────────────────────────────────────────────────────
            예전 이 자리는 플레이어 HP 바였는데, 그건 캔버스 패널이 이미 크게 보여준다.
            같은 걸 두 번 그리는 대신 캔버스가 못 하는 것 — 이번 라운드의 순서 — 을 놓는다. */}
        <div className="flex items-center justify-between gap-3 border-b border-earth-500/40 px-3 py-2 text-pixel-sm">
          <div className="flex min-w-0 items-center gap-3">
            {battleOutcome === null && !mustSwitch && (
              <TurnOrderBar
                player={player} enemy={enemyState}
                playerSpeed={activeSpeed}
                playerCharge={gauges.player} enemyCharge={gauges.enemy}
              />
            )}
            {player.status && (
              <span data-testid="chip-status"
                className="flex shrink-0 items-center gap-1 rounded bg-ember-700/20 px-1 py-0.5 text-pixel-sm text-ember-500">
                <PixelIcon name={STATUS_META[player.status].icon} size={16} />
                {statusDetail(player.status, player.statusTurns)}
              </span>
            )}
            {player.attackBuffTurns > 0 && (
              <span data-testid="chip-buff"
                className="shrink-0 rounded bg-ember-700/20 px-1 py-0.5 text-pixel-sm text-ember-500">
                ▲공격 ×{player.attackBuffMult} ({player.attackBuffTurns}턴)
              </span>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {/* 지금 무엇을 기다리는지. 로그 대기와 내 차례는 다른 상태다 */}
            {isProcessing && !mustSwitch && (
              <span data-testid="log-wait" className="animate-pulse text-pixel-sm text-ember-500">▶ Q / 클릭</span>
            )}
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
            <button onClick={() => setShowTypeChart((v) => !v)}
              data-testid="cmd-type-chart"
              title="속성 상성표 (T)"
              className={`text-pixel-sm border rounded px-1.5 py-0.5 transition ${
                showTypeChart ? "border-mist-500 text-mist-300" : "border-shadow-700 text-earth-400 hover:text-sand-300"}`}>
              상성 T
            </button>
            <button onClick={() => setShowLog((v) => !v)}
              data-testid="cmd-log"
              title="지나간 로그 (L)"
              className={`text-pixel-sm border rounded px-1.5 py-0.5 transition ${
                showLog ? "border-stone-600 text-sand-200" : "border-shadow-700 text-earth-400 hover:text-sand-300"}`}>
              기록 L
            </button>
            <button onClick={() => navigate("/")}
              data-testid="cmd-exit"
              className="text-pixel-sm text-earth-400 hover:text-sand-300 border border-shadow-700 rounded px-1.5 py-0.5">
              나가기
            </button>
          </div>
        </div>

        {/* ── ② 경험치 줄 ────────────────────────────────────────────────────
            자기 줄을 쓴다. 위 줄은 칩이 뜨는 대로 늘어나므로 거기 끼우면 칩 둘에 눌린다. */}
        <ExpStatusRow
          name={expView?.name ?? player.name}
          level={expView?.level ?? player.level}
          exp={expView ? Math.round(expView.ratio * expView.expToNext) : player.exp}
          expToNext={expView?.expToNext ?? player.expToNextLevel}
          fillMs={expView?.fillMs ?? 0}
          levelUp={expView?.card !== null && expView !== null}
        />

        {/* 로그 한 줄 — 캔버스 로그 상자와 같은 내용이다. 접근성·테스트용으로 DOM 에도 남기되
            자리를 적게 쓴다(예전엔 56px 짜리 띠가 대부분 비어 있었다). */}
        <div className="flex h-7 items-center border-b border-earth-500/40 bg-shadow-700/50 px-3">
          <p data-testid="battle-log-line" className="truncate text-pixel-sm text-sand-200">
            {logHistory[logHistory.length - 1] ?? ""}
          </p>
        </div>

        {showLog && (
          <div data-testid="battle-log-history"
            className="border-b border-earth-500/40 bg-shadow-900/80 px-3 py-2">
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

        {/* 전투 중 메인 패널 — 파티 · 커맨드 · 상대 카드 세 구역 */}
        {battleOutcome === null && (
          <div className="flex" style={{ minHeight: "152px" }}>

            <PartyStrip
              members={partyView}
              focused={focusZone === "party"}
              cursor={partyCursor}
              mustPick={mustSwitch}
              disabled={isProcessing}
              onHover={(i) => { setFocusZone("party"); setPartyCursor(i); }}
              onSelect={handlePartySwap}
            />

            <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-2">
              {mustSwitch ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
                  <p className="text-pixel-sm font-bold text-ember-500">{withJosa(player.name, "이가")} 기절했다!</p>
                  <p data-testid="must-switch" className="text-pixel-sm text-sand-300">
                    ← 왼쪽에서 다음 몬스터를 선택하세요 (←→ · Enter)
                  </p>
                </div>
              ) : (
                <BattleCommandMenu
                  moves={player.moves}
                  getPreview={getMovePreview}
                  potions={potionEntries}
                  disabled={isProcessing}
                  focused={focusZone === "command"}
                  canFlee={!isBossFloor(floor)}
                  fleeBlockedReason="보스는 못 피한다"
                  onUseMove={handleMoveClick}
                  onUsePotion={handleUsePotion}
                  onGuard={handleGuard}
                  onFlee={handleFlee}
                  onLeaveLeft={() => setFocusZone("party")}
                />
              )}
            </div>

            {/* ─── 상대 카드 ─────────────────────────────── */}
            <div className="w-48 shrink-0 border-l border-shadow-700 p-2">
              <EnemyCard
                enemy={enemyState}
                moves={player.moves}
                playerType={player.type}
              />
            </div>
          </div>
        )}

        {battleOutcome !== null && (
          <p className="py-2 text-center text-pixel-sm text-earth-400">잠시 후 선택 화면이 표시됩니다...</p>
        )}
      </div>

      {/* 레벨업 카드 — 오른 스탯은 상태 줄 한 칸에 안 들어간다 */}
      {expView && <ExpGainOverlay view={expView} onAdvance={advanceExp} />}

      {/* 기술 교체 선택 — 4칸이 찼을 때만 뜬다 */}
      {forgetPrompt && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center bg-shadow-900/75">
          <div className="w-full max-w-md mx-4 border-2 border-ember-700 bg-shadow-900/95 p-5">
            <p className="text-center text-pixel-sm font-bold text-ember-500 mb-1">
              {withJosa(player.name, "이가")} {withJosa(forgetPrompt.incoming.name, "을를")} 배우려 한다!
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
                  data-testid={`forget-${i}`}
                  className={`border px-2 py-1.5 text-left transition ${ELEMENT_CHIP_CLASS[mv.type as keyof typeof ELEMENT_CHIP_CLASS] ?? ELEMENT_CHIP_CLASS.normal}`}
                  style={{ borderRadius: 0 }}>
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-pixel-sm font-semibold leading-tight">
                      <span className="mr-1 opacity-60">{i + 1}</span>{mv.name}
                    </span>
                    <span className="text-pixel-sm opacity-50 uppercase shrink-0">{mv.type}</span>
                  </div>
                  <div className="text-pixel-sm opacity-45 mt-0.5">위력 {mv.power} · 명중 {mv.accuracy}</div>
                </button>
              ))}
            </div>

            <button onClick={() => answerForget(null)}
              data-testid="forget-none"
              className="w-full border border-stone-600 py-2 text-pixel-sm text-sand-300 hover:bg-shadow-800 transition">
              배우지 않는다 <span className="opacity-70">(Esc)</span>
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
              {floor === MAX_TOWER_FLOOR ? "탑의 정상을 정복했다…" : "다음 층으로?"}
            </p>

            {/* 드랍 재료 표시 */}
            {battleDrops.length > 0 && (
              <div className="mb-4 rounded-lg border border-ember-700/50 bg-ember-700/10 p-3">
                <p className="text-pixel-sm text-ember-500 mb-2">── 재료 획득 ──</p>
                <div className="flex flex-col gap-1">
                  {battleDrops.map((d, i) => {
                    const mat = getMaterial(d.id);
                    return (
                      <p key={i} className="flex items-center justify-center gap-1.5 text-pixel-sm text-ember-500">
                        {mat && <PixelIcon name={mat.icon} size={16} />}
                        {mat?.name ?? d.id} ×{d.count}
                      </p>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 파티 상태 — 다음 층으로 갈지 내려갈지는 이 숫자를 보고 정한다.
                예전엔 여기 "전회복" 버튼이 있어서 볼 이유가 없었다. */}
            <div className="mb-4 flex flex-col gap-1">
              {partyView.map((m) => (
                <p key={m.uid} className="flex items-center justify-between text-pixel-sm">
                  <span className={m.fainted ? "text-earth-400" : "text-sand-200"}>{m.name}</span>
                  <span className={m.fainted ? "text-ember-700" : m.currentHp / m.maxHp <= 0.3 ? "text-ember-500" : "text-sand-300"}>
                    {m.fainted ? "기절" : `${m.currentHp}/${m.maxHp}`}
                  </span>
                </p>
              ))}
            </div>

            <div className="flex flex-col gap-2">
              {floor === MAX_TOWER_FLOOR ? (
                <button onClick={() => navigate("/ending")}
                  data-testid="result-primary"
                  className="w-full border-2 border-ember-500 bg-ember-700/25 py-3 text-pixel-sm font-bold text-ember-500 hover:bg-ember-700/40 transition active:scale-95">
                  &gt; 정수를 들고 마을로 <span className="opacity-70">(Enter)</span>
                </button>
              ) : (
                <button onClick={() => navigate("/battle", { state: { floor: floor + 1 } })}
                  data-testid="result-primary"
                  className="w-full border-2 border-moss-500 bg-moss-500/25 py-3 text-pixel-sm font-bold text-moss-500 hover:bg-moss-500/40 transition active:scale-95">
                  &gt; 다음층 ({floor + 1}F) <span className="opacity-70">(Enter)</span>
                </button>
              )}
              <button onClick={() => navigate("/")}
                data-testid="result-camp"
                className="w-full border-2 border-stone-600 bg-shadow-700/80 py-3 text-pixel-sm font-semibold text-sand-200 hover:bg-stone-600/80 transition active:scale-95">
                &gt; 베이스캠프에서 정비 <span className="opacity-70">(Esc)</span>
              </button>
              <p className="text-pixel-sm text-earth-400">
                회복은 캠프·몬스터 화면에서. 탑 안에서는 물약뿐이다.
              </p>
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
              {/* 전멸한 채로 재도전은 허구다 — 캠프에서 회복하고 오는 게 유일한 길이다 */}
              <button onClick={() => navigate("/")}
                data-testid="result-primary"
                className="w-full border-2 border-ember-700 bg-ember-700/25 py-3 text-pixel-sm font-bold text-ember-500 hover:bg-ember-700/40 transition active:scale-95">
                &gt; 캠프로 돌아가 회복한다 <span className="opacity-70">(Enter)</span>
              </button>
              <p className="text-pixel-sm text-earth-400">
                파티가 전멸했다. 캠프에서 회복하고 장비를 손본 뒤 다시 오르자.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
