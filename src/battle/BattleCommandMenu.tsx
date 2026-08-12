import { useCallback, useEffect, useState, type ReactNode } from "react";
import type { Move } from "../shared/game";
import { formatDamageRange, type MovePreview } from "./damagePreview";
import { ELEMENT_CHIP_CLASS } from "../shared/palette";

/**
 * 전투 커맨드 2단 메뉴.
 *
 * 1단 [공격 / 스킬 / 가방 / 도망] → 공격·스킬은 2단에서 기술 목록으로.
 * 공격은 physical, 스킬은 special·status 기술이다 — 게임 데이터에 이미 있는
 * category 를 그대로 쓴다. 해당 분류에 기술이 없으면 1단에서 비활성.
 *
 * 메뉴 상태는 전투 진행 상태(내 턴 / 애니메이션 중)와 분리돼 있다. 진행 상태는
 * disabled 로만 들어오고, 메뉴는 자기 커서와 페이지만 관리한다.
 */

export type MenuState =
  | { level: "root" }
  | { level: "moves"; group: "attack" | "skill" }
  | { level: "bag" };

/** 2×2 한 화면. 넘치면 페이지로 넘긴다. */
const PAGE_SIZE = 4;

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
  hint?: ReactNode;
  chipClass?: string;
  disabled?: boolean;
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

  const attackMoves = moves.filter((m) => m.category === "physical");
  const skillMoves  = moves.filter((m) => m.category !== "physical");

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
    return {
      key: m.id,
      label: m.name,
      // 한 줄에 다 넣는다. 예상 데미지가 굵고, 나머지는 눌러 둔다 — 셀에서 제일 먼저
      // 읽혀야 하는 건 "몇 대미지"이고 배율·명중은 그 이유를 대는 곁가지다.
      sub: (
        <span className="flex items-center gap-1.5 whitespace-nowrap">
          {p.isStatus
            ? <span className="opacity-60">보조 기술</span>
            : <span className="font-bold">예상 {formatDamageRange(p)}</span>}
          {p.multiplier !== 1 && (
            <span className="font-bold">{p.multiplier >= 2 ? "▲" : "▼"}×{p.multiplier}</span>
          )}
          {p.accuracy < 100 && <span className="opacity-60">명중 {p.accuracy}</span>}
          {p.critChance > 0 && !p.isStatus && <span className="opacity-60">치명 {Math.round(p.critChance)}%</span>}
        </span>
      ),
      // 예상 데미지가 들어오면서 둘째 줄이 곁가지가 아니라 판단 근거가 됐다.
      // 통째로 흐리게 두면(다른 셀의 기본값 opacity-50) 정작 숫자가 안 읽힌다.
      subClass: "",
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
        key: "attack", label: "공격", sub: `물리 ${attackMoves.length}개`,
        disabled: attackMoves.length === 0, testId: "cmd-attack",
        onSelect: () => enter({ level: "moves", group: "attack" }),
      },
      {
        key: "skill", label: "스킬", sub: `특수 ${skillMoves.length}개`,
        disabled: skillMoves.length === 0, testId: "cmd-skill",
        onSelect: () => enter({ level: "moves", group: "skill" }),
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
    cells = (menu.group === "attack" ? attackMoves : skillMoves).map(moveCell);
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

  const pageCount = Math.max(1, Math.ceil(cells.length / PAGE_SIZE));
  const pageCells = cells.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const atRoot = menu.level === "root";
  // 커서 클램프는 렌더 시점에 한다 — effect 로 setState 하면 한 프레임 어긋난 커서가 그려진다
  const activeCursor = Math.min(cursor, Math.max(0, pageCells.length - 1));

  // ── 키보드 ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (disabled) return;

    const onKey = (e: KeyboardEvent) => {
      const n = pageCells.length;
      if (n === 0 && e.key !== "Escape") return;

      switch (e.key) {
        // 2×2 안에서 좌우는 ±1, 상하는 ±2. 칸이 비어 있으면 넘어가지 않는다.
        case "ArrowLeft":  e.preventDefault(); setCursor((c) => (c % 2 === 1 ? c - 1 : c)); break;
        case "ArrowRight": e.preventDefault(); setCursor((c) => (c % 2 === 0 && c + 1 < n ? c + 1 : c)); break;
        case "ArrowUp":    e.preventDefault(); setCursor((c) => (c >= 2 ? c - 2 : c)); break;
        case "ArrowDown":  e.preventDefault(); setCursor((c) => (c + 2 < n ? c + 2 : c)); break;
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
    : menu.group === "attack" ? "공격 — 물리 기술" : "스킬 — 특수 기술";

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
            </button>
          );
        })}
      </div>
    </div>
  );
}
