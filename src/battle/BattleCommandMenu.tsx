import { useCallback, useEffect, useState, type ReactNode } from "react";
import type { Move } from "../shared/game";
import { formatDamageRange, type MovePreview } from "./damagePreview";
import { ELEMENT_CHIP_CLASS, ELEMENT_KO } from "../shared/palette";
import { STATUS_META } from "./statusInfo";

/**
 * 전투 커맨드 2단 메뉴.
 *
 * 1단 [기술 / 가방 / 도망] → 기술은 2단에서 **한 목록**으로.
 *
 * 예전엔 1단이 [공격 / 스킬 / 가방 / 도망] 이었다. 공격=물리, 스킬=특수+상태로 나뉘어
 * 있었는데 데미지 공식은 둘을 구분하지 않는다(특수공격 능력치가 없다). 의미 없는 한 겹인
 * 데다, 몬스터 15마리 중 4마리는 특수 기술이 0개라 "스킬" 버튼이 영구 비활성이었다 —
 * 그중 하나가 시작 몬스터 모시다. 첫 전투부터 회색 버튼을 보게 되는 구조였다.
 *
 * category 는 지운 게 아니라 표시로 옮겼다(공격 모션 방향이 이 값을 계속 쓴다).
 *
 * 메뉴 상태는 전투 진행 상태(내 턴 / 애니메이션 중)와 분리돼 있다. 진행 상태는
 * disabled 로만 들어오고, 메뉴는 자기 커서와 페이지만 관리한다.
 */

export type MenuState =
  | { level: "root" }
  | { level: "moves" }
  | { level: "bag" };

/** 2×2 한 화면. 넘치면 페이지로 넘긴다. */
const PAGE_SIZE = 4;

/** 분류는 아이콘과 이름을 같이 적는다. 아이콘만 두면 무슨 뜻인지 배워야 한다. */
const CATEGORY_LABEL: Record<Move["category"], string> = {
  physical: "⚔물리",
  special: "✦특수",
  status: "◈상태",
};

export interface PotionEntry {
  id: string;
  name: string;
  emoji: string;
  effectLabel: string;
  count: number;
}

interface Props {
  moves: Move[];
  /** 기술 하나의 예상 결과. 계산은 battleUtils 가 하고 여기서는 그리기만 한다. */
  getPreview: (move: Move) => MovePreview;
  potions: PotionEntry[];
  /** 애니메이션 중·상대 턴·결과 표시 중. 연타로 턴이 두 번 소비되면 안 된다. */
  disabled: boolean;
  canFlee: boolean;
  fleeBlockedReason?: string;
  onUseMove: (move: Move) => void;
  onUsePotion: (id: string) => void;
  onFlee: () => void;
}

interface Cell {
  key: string;
  label: string;
  sub?: ReactNode;
  /** 둘째 줄을 얼마나 눌러 둘지. 기본은 곁가지 취급(흐리게) */
  subClass?: string;
  /** 셋째 줄 — 기술 칸에서 "몇 대미지"를 적는 자리 */
  extra?: ReactNode;
  hint?: ReactNode;
  chipClass?: string;
  disabled?: boolean;
  /** 1단의 첫 칸(기술)은 가로 두 칸을 다 쓴다 */
  wide?: boolean;
  testId: string;
  onSelect: () => void;
}

/**
 * "이 기술로 이번 턴에 끝낼 수 있나" — 이 한 줄이 셀에서 가장 중요한 정보다.
 * 확정은 채운 배지, 치명타가 떠야 닿으면 테두리만. 색이 아니라 형태로도 갈린다.
 */
function KoBadge({ ko }: { ko: MovePreview["ko"] }) {
  if (!ko) return null;
  return ko === "sure"
    ? <span data-ko="sure" className="bg-moss-500 px-1 font-bold text-shadow-900">쓰러뜨린다</span>
    : <span data-ko="maybe" className="border border-moss-500 px-1 text-sand-200">쓰러뜨릴 수도</span>;
}

export function BattleCommandMenu({
  moves, getPreview, potions, disabled, canFlee, fleeBlockedReason,
  onUseMove, onUsePotion, onFlee,
}: Props) {
  const [menu, setMenu] = useState<MenuState>({ level: "root" });
  const [cursor, setCursor] = useState(0);
  const [page, setPage] = useState(0);

  const goRoot = useCallback(() => {
    setMenu({ level: "root" });
    setCursor(0);
    setPage(0);
  }, []);

  const enter = useCallback((next: MenuState) => {
    setMenu(next);
    setCursor(0);
    setPage(0);
  }, []);

  // ── 셀 구성 ────────────────────────────────────────────────────────────────
  const moveCell = (m: Move): Cell => {
    const p = getPreview(m);
    const status = m.statusEffect ? STATUS_META[m.statusEffect] : null;
    return {
      key: m.id,
      label: m.name,
      // 기술이 무엇인가 — 속성·분류·위력·명중. 고르기 전에 알아야 하는 고정값들이라
      // 한 줄로 눌러 둔다. 위력 0 은 "위력 0"이 아니라 "상태이상"이다(때리는 기술이 아니다).
      sub: (
        <span className="flex flex-wrap items-center gap-x-1.5 whitespace-nowrap">
          <span>{ELEMENT_KO[m.type as keyof typeof ELEMENT_KO] ?? m.type}</span>
          <span>· {CATEGORY_LABEL[m.category]}</span>
          <span>· {p.isStatus ? "상태이상" : `위력 ${m.power}`}</span>
          <span>· 명중 {m.accuracy}</span>
        </span>
      ),
      subClass: "opacity-60",
      // 이번 턴에 무슨 일이 일어나는가 — 셀에서 제일 먼저 읽혀야 하는 줄이라 굵게 둔다.
      extra: (
        <span className="flex flex-wrap items-center gap-x-1.5 whitespace-nowrap">
          {p.isStatus
            ? status && <span className="font-bold">{status.icon}{status.name} {status.duration}</span>
            : <span className="font-bold">예상 {formatDamageRange(p)}</span>}
          {!p.isStatus && p.multiplier !== 1 && (
            <span className="font-bold">{p.multiplier >= 2 ? "▲" : "▼"}×{p.multiplier}</span>
          )}
          {status && (m.statusChance ?? 0) > 0 && (
            <span className="opacity-60">{status.icon}{m.statusChance}%</span>
          )}
          {p.critChance > 0 && !p.isStatus && (
            <span className="opacity-60">치명 {Math.round(p.critChance)}%</span>
          )}
        </span>
      ),
      hint: <KoBadge ko={p.ko} />,
      chipClass: ELEMENT_CHIP_CLASS[m.type as keyof typeof ELEMENT_CHIP_CLASS] ?? ELEMENT_CHIP_CLASS.normal,
      testId: `move-${m.id}`,
      // 턴을 쓰고 나면 1단으로 돌아간다 (JRPG 관례이자, 다음 턴에 커서가 어디 있을지 예측 가능해진다)
      onSelect: () => { onUseMove(m); goRoot(); },
    };
  };

  let cells: Cell[];
  if (menu.level === "root") {
    cells = [
      {
        key: "moves", label: "기술", sub: `${moves.length}개`, wide: true,
        disabled: moves.length === 0, testId: "cmd-moves",
        onSelect: () => enter({ level: "moves" }),
      },
      {
        key: "bag", label: "가방", sub: `물약 ${potions.reduce((a, p) => a + p.count, 0)}개`,
        disabled: potions.every((p) => p.count <= 0), testId: "cmd-bag",
        onSelect: () => enter({ level: "bag" }),
      },
      {
        key: "flee", label: "도망", sub: canFlee ? "전투 포기" : (fleeBlockedReason ?? "불가"),
        disabled: !canFlee, testId: "cmd-flee",
        onSelect: onFlee,
      },
    ];
  } else if (menu.level === "moves") {
    cells = moves.map(moveCell);
  } else {
    cells = potions.map((p) => ({
      key: p.id,
      label: `${p.emoji} ${p.name}`,
      sub: p.effectLabel,
      hint: <span className="opacity-70">×{p.count}</span>,
      disabled: p.count <= 0,
      testId: `potion-${p.id}`,
      onSelect: () => { onUsePotion(p.id); goRoot(); },
    }));
  }

  const atRoot = menu.level === "root";
  const pageCount = Math.max(1, Math.ceil(cells.length / PAGE_SIZE));
  const pageCells = atRoot ? cells : cells.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  // 커서 클램프는 렌더 시점에 한다 — effect 로 setState 하면 한 프레임 어긋난 커서가 그려진다
  const activeCursor = Math.min(cursor, Math.max(0, pageCells.length - 1));

  // ── 키보드 ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (disabled) return;

    /**
     * 1단은 [기술(가로 두 칸)] / [가방][도망] 이라 2×2 규칙이 그대로는 안 맞는다.
     * 2단은 예전과 같은 2×2다.
     */
    const move = (key: string, c: number, n: number): number => {
      if (atRoot) {
        switch (key) {
          case "ArrowUp":    return 0;
          case "ArrowDown":  return c === 0 ? 1 : c;
          case "ArrowLeft":  return c === 2 ? 1 : c;
          case "ArrowRight": return c === 1 ? 2 : c;
        }
        return c;
      }
      switch (key) {
        // 2×2 안에서 좌우는 ±1, 상하는 ±2. 칸이 비어 있으면 넘어가지 않는다.
        case "ArrowLeft":  return c % 2 === 1 ? c - 1 : c;
        case "ArrowRight": return c % 2 === 0 && c + 1 < n ? c + 1 : c;
        case "ArrowUp":    return c >= 2 ? c - 2 : c;
        case "ArrowDown":  return c + 2 < n ? c + 2 : c;
      }
      return c;
    };

    const onKey = (e: KeyboardEvent) => {
      const n = pageCells.length;
      if (n === 0 && e.key !== "Escape") return;

      switch (e.key) {
        case "ArrowLeft":
        case "ArrowRight":
        case "ArrowUp":
        case "ArrowDown":
          e.preventDefault();
          setCursor((c) => Math.min(move(e.key, c, n), n - 1));
          break;
        case "Enter":
        case " ": {
          e.preventDefault();
          const cell = pageCells[activeCursor];
          if (cell && !cell.disabled) cell.onSelect();
          break;
        }
        case "Escape":
          e.preventDefault();
          // 1단에서는 아무 일도 일어나지 않는다
          if (!atRoot) goRoot();
          break;
        case "Tab":
          if (pageCount > 1) {
            e.preventDefault();
            setPage((p) => (p + 1) % pageCount);
            setCursor(0);
          }
          break;
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [disabled, pageCells, activeCursor, atRoot, goRoot, pageCount]);

  const title =
    menu.level === "root" ? null
    : menu.level === "bag" ? "가방 — 물약"
    : "기술";

  return (
    <div
      className="flex min-h-0 flex-1 flex-col gap-1.5"
      data-testid="battle-command"
      onContextMenu={(e) => { e.preventDefault(); if (!atRoot) goRoot(); }}
    >
      {!atRoot && (
        <div className="flex items-center justify-between">
          <p className="text-pixel-sm font-bold text-sand-300">{title}</p>
          <div className="flex items-center gap-2">
            {pageCount > 1 && (
              <span className="text-pixel-sm text-earth-400">
                {page + 1}/{pageCount} · Tab
              </span>
            )}
            <button
              type="button"
              data-testid="cmd-back"
              onClick={goRoot}
              className="rounded border border-earth-500/70 px-1.5 py-0.5 text-pixel-sm text-sand-300
                transition hover:text-cream-100"
            >
              ESC 뒤로
            </button>
          </div>
        </div>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-2 grid-rows-2 gap-1.5">
        {Array.from({ length: PAGE_SIZE }, (_, i) => {
          const cell = pageCells[i];
          if (!cell) {
            // 1단은 세 칸이 정원이라(기술이 가로 두 칸을 쓴다) 빈 칸이 없다.
            if (atRoot) return null;
            return (
              <div key={`empty-${i}`}
                className="flex min-h-13 items-center justify-center border border-earth-500/25 bg-shadow-900/40">
                <span className="text-pixel-sm text-earth-400/50">—</span>
              </div>
            );
          }
          const selected = i === activeCursor;
          return (
            <button
              key={cell.key}
              type="button"
              data-testid={cell.testId}
              disabled={disabled || cell.disabled}
              onMouseEnter={() => setCursor(i)}
              onClick={() => !cell.disabled && cell.onSelect()}
              className={`relative min-h-13 border-2 px-2 py-1.5 text-left transition
                disabled:opacity-30
                ${cell.wide ? "col-span-2" : ""}
                ${cell.chipClass ?? "border-earth-500 bg-shadow-700/80 text-sand-200"}
                ${selected ? "brightness-125" : ""}`}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-pixel-sm font-semibold leading-tight">
                  {/* 선택 표시는 색이 아니라 형태로. 색약에서도 보이고 픽셀아트 관례이기도 하다 */}
                  <span className={selected ? "mr-1" : "mr-1 invisible"}>▶</span>
                  {cell.label}
                </span>
                {cell.hint && <span className="shrink-0 text-pixel-sm">{cell.hint}</span>}
              </div>
              {cell.sub && (
                <div className={`mt-0.5 text-pixel-sm ${cell.subClass ?? "opacity-50"}`}>{cell.sub}</div>
              )}
              {cell.extra && (
                <div className="text-pixel-sm">{cell.extra}</div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
