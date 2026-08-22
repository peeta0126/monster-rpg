import type { ReactNode } from "react";
import type { ArtifactBonusStat, ArtifactStatBonus, ItemQuality } from "../crafting";
import {
  QUALITY_COLOR,
  QUALITY_LABEL,
  QUALITY_GLOW,
  qualityTint,
  getArtifactDisplayStats,
  getEquipmentMaxLevel,
} from "../craftingUtils";
import { PALETTE, rgba } from "../palette";
import { PixelIcon } from "./PixelIcon";
import { isIconName, type IconName } from "./icons";

/**
 * 장비 한 칸 — **화면마다 따로 그리지 않는다.**
 *
 * 가방·모루 네 탭·몬스터 장착 슬롯·제작 결과가 전부 자기 손으로 카드를 그리고 있었다.
 * 그래서 같은 장비가 화면마다 다르게 보였다. 어디는 아이콘이 있고 어디는 글자만 있었고,
 * 능력치는 세 곳이 제작 시점의 원본을 찍어 실제보다 3.7배 낮은 숫자를 말했다.
 *
 * 크기는 두 단계다. 좁은 자리(`compact`)는 아이콘·이름·등급·강화까지만 그리고 능력치를
 * 접는다 — 모루 왼쪽 목록이나 재료 고르는 자리처럼 여러 개가 세로로 서는 곳이다.
 */

/** 카드가 알아야 하는 것만. ArtifactInstance 도 CraftedItem 도 이 모양에 맞는다. */
export interface ArtifactCardItem {
  itemId:       string;
  name:         string;
  quality:      ItemQuality;
  statBonuses:  ArtifactStatBonus[];
  level?:       number;
  enhancement?: number;
  source?:      string;
  bonusStats?:  ArtifactBonusStat[];
}

export type ArtifactCardSize = "compact" | "full";

interface ArtifactCardProps {
  artifact:  ArtifactCardItem;
  /** 기본은 좁은 자리. 능력치까지 보여줄 자리만 "full" */
  size?:     ArtifactCardSize;
  selected?: boolean;
  /** 조건을 못 채운 후보를 흐리게 */
  dim?:      boolean;
  /** 제작 직후처럼 한 번 크게 보여줄 자리 */
  glow?:     boolean;
  /** 등급 옆에 한 줄 더 (슬롯 이름 등) */
  note?:     string;
  onClick?:  () => void;
  /** 오른쪽 끝에 붙는 조작 (해제 버튼 등). 있으면 카드는 button 이 아니라 div 가 된다 */
  action?:   ReactNode;
  /** 카드 아래에 붙는 것 (장착하기 띠 등) */
  footer?:   ReactNode;
  className?: string;
  /** 등장 애니메이션처럼 부르는 쪽에서만 아는 것 */
  style?: React.CSSProperties;
}

function iconOf(itemId: string): IconName {
  return isIconName(itemId) ? itemId : "artifact";
}

export function ArtifactCard({
  artifact, size = "compact", selected = false, dim = false, glow = false,
  note, onClick, action, footer, className = "", style,
}: ArtifactCardProps) {
  const color = QUALITY_COLOR[artifact.quality];
  const lv    = artifact.level ?? 1;
  const enh   = artifact.enhancement ?? 0;
  const maxLv = getEquipmentMaxLevel(artifact.quality);
  // "다 키웠다"는 레벨로 정한다. 강화는 배지가 따로 말한다.
  const maxed = lv >= maxLv;
  const stats = size === "full" ? getArtifactDisplayStats(artifact) : [];

  // 버튼 안에 버튼을 넣을 수 없다. 조작이 붙는 자리는 카드 자체를 div 로 둔다.
  const Tag = action ? "div" : "button";

  return (
    <Tag
      {...(Tag === "button"
        ? { type: "button" as const, disabled: !onClick }
        : {})}
      onClick={onClick}
      className={`w-full overflow-hidden rounded-xl text-left transition ${className}`}
      style={{
        background: selected ? rgba("earth500", 0.28) : rgba("shadow900", 0.88),
        border: `1px solid ${selected ? PALETTE.ember500 : qualityTint(artifact.quality, 0.4)}`,
        boxShadow: selected
          ? `0 0 14px ${rgba("earth500", 0.7)}`
          : glow ? `0 0 40px ${QUALITY_GLOW[artifact.quality]}`
          : maxed ? `0 0 12px ${qualityTint(artifact.quality, 0.25)}`
          : "none",
        opacity: dim ? 0.4 : 1,
        cursor: onClick ? "pointer" : "default",
        ...style,
      }}
    >
      <div className="flex items-center gap-3 p-3">
        {/* 아이콘 + 강화 배지 */}
        <div className="relative shrink-0">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-xl"
            style={{
              background: rgba("shadow900", 0.35),
              border: `1px solid ${maxed ? PALETTE.ember500 : qualityTint(artifact.quality, 0.27)}`,
              boxShadow: maxed ? `0 0 10px ${rgba("ember500", 0.45)}` : "none",
            }}
          >
            <PixelIcon name={iconOf(artifact.itemId)} size={32} />
          </div>
          {enh > 0 && (
            <span
              className="absolute -right-1.5 -top-1.5 rounded-md px-1 py-0.5 text-pixel-sm font-black leading-none"
              style={{
                background: rgba("shadow900", 0.96),
                border: `1px solid ${PALETTE.ember500}`,
                color: PALETTE.ember500,
              }}
            >
              +{enh}
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-pixel-sm font-black" style={{ color: PALETTE.cream100 }}>
            {artifact.name}
          </p>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
            <span className="text-pixel-sm font-bold" style={{ color }}>
              {QUALITY_LABEL[artifact.quality]}
            </span>
            {/* Lv.1 은 안 적는다 — 갓 만든 것이 기본값이라 줄만 길어진다 */}
            {lv > 1 && (
              <span className="text-pixel-sm font-bold" style={{ color: PALETTE.sand300 }}>
                Lv.{lv}
              </span>
            )}
            {maxed && (
              <span
                className="rounded px-1 py-0.5 text-pixel-sm font-black leading-none"
                style={{
                  background: rgba("ember500", 0.18),
                  border: `1px solid ${rgba("ember500", 0.6)}`,
                  color: PALETTE.ember500,
                }}
              >
                MAX
              </span>
            )}
            {artifact.source === "synthesis" && (
              <span
                className="rounded-full px-1.5 py-0.5 text-pixel-sm font-black leading-none"
                style={{
                  background: rgba("mist300", 0.09),
                  border: `1px solid ${rgba("mist300", 0.13)}`,
                  color: PALETTE.mist300,
                }}
              >
                합성
              </span>
            )}
            {note && (
              <span className="text-pixel-sm" style={{ color: PALETTE.earth400 }}>{note}</span>
            )}
          </div>
        </div>

        {action}
      </div>

      {/* 능력치 — 부가 능력치(레벨 10마다 해제)는 청록으로 갈라 놓는다 */}
      {stats.length > 0 && (
        <div className="px-3 pb-3">
          <div
            className="space-y-1 rounded-lg p-2.5"
            style={{ background: rgba("shadow900", 0.35), border: `1px solid ${rgba("cream100", 0.06)}` }}
          >
            {stats.map((line) => (
              <p key={line.key} className="flex justify-between gap-2 text-pixel-sm font-bold">
                <span style={{ color: line.bonus ? PALETTE.mist500 : PALETTE.earth500 }}>
                  {line.label}
                </span>
                <span style={{ color: line.bonus ? PALETTE.mist300 : PALETTE.cream100 }}>
                  +{line.value}{line.percent ? "%" : ""}
                </span>
              </p>
            ))}
          </div>
        </div>
      )}

      {footer}
    </Tag>
  );
}
