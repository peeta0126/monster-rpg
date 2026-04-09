import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePlayerStore } from "../store/playerStore";
import {
  FURNITURE, getFurniture, countMaterials,
  MATERIAL_LABEL, RARITY_LABEL, RARITY_COLOR, MATERIAL_SET_TIERS,
} from "../data/furniture";
import type { FurnitureMaterial } from "../data/furniture";
import { getMaterial } from "../data/items";

// ─── 방 안 가구 슬롯 위치 (% 기준, 방 컨테이너 기준) ───────────────────────────

const SLOT_POSITIONS = [
  { x: 16, y: 34 }, { x: 48, y: 34 }, { x: 80, y: 34 },
  { x: 16, y: 62 }, { x: 48, y: 62 }, { x: 80, y: 62 },
];
const SLOT_W = 110; // px
const SLOT_H = 88;  // px

// ─── 방 배경 (CSS only) ───────────────────────────────────────────────────────

function RoomBackground() {
  return (
    <>
      {/* 바닥 */}
      <div style={{
        position: "absolute", inset: 0,
        background: "linear-gradient(180deg, #7b5c3a 0%, #7b5c3a 18%, #c8a87a 18%, #c8a87a 88%, #6b4a28 88%, #6b4a28 100%)",
      }} />
      {/* 바닥 나무 결 */}
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} style={{
          position: "absolute", left: 0, right: 0,
          top: `${18 + i * (70 / 7)}%`, height: "1px",
          background: "rgba(0,0,0,0.12)",
        }} />
      ))}
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} style={{
          position: "absolute", top: "18%", bottom: "12%",
          left: `${i * 10}%`, width: "1px",
          background: "rgba(0,0,0,0.07)",
        }} />
      ))}
      {/* 상단 벽 테두리 */}
      <div style={{
        position: "absolute", left: 0, right: 0, top: "18%", height: "4px",
        background: "#5a3e1e",
      }} />
      {/* 하단 벽 테두리 */}
      <div style={{
        position: "absolute", left: 0, right: 0, bottom: "12%", height: "4px",
        background: "#5a3e1e",
      }} />

      {/* 왼쪽 문 (농장) */}
      <div style={{
        position: "absolute", left: "2%", top: "38%", width: "5.5%", height: "34%",
        background: "#4a7c59", border: "3px solid #3e2000", borderRadius: "4px 4px 0 0",
      }}>
        <div style={{ position: "absolute", right: "10%", top: "50%", width: "8px", height: "8px", borderRadius: "50%", background: "#f0c040" }} />
        <div style={{ position: "absolute", bottom: "100%", left: "50%", transform: "translateX(-50%)", whiteSpace: "nowrap", color: "#a0d8a0", fontSize: "10px", paddingBottom: "4px" }}>🌾 농장</div>
      </div>

      {/* 오른쪽 문 (바깥) */}
      <div style={{
        position: "absolute", right: "2%", top: "38%", width: "5.5%", height: "34%",
        background: "#4a5c7c", border: "3px solid #3e2000", borderRadius: "4px 4px 0 0",
      }}>
        <div style={{ position: "absolute", left: "10%", top: "50%", width: "8px", height: "8px", borderRadius: "50%", background: "#f0c040" }} />
        <div style={{ position: "absolute", bottom: "100%", left: "50%", transform: "translateX(-50%)", whiteSpace: "nowrap", color: "#a0b8d8", fontSize: "10px", paddingBottom: "4px" }}>🌲 바깥</div>
      </div>

      {/* 창문 2개 */}
      {[28, 72].map((left) => (
        <div key={left} style={{
          position: "absolute", left: `${left - 5}%`, top: "2%", width: "10%", height: "14%",
          background: "rgba(135,206,235,0.65)", border: "3px solid #d4a060", borderRadius: "2px",
        }}>
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px" }}>🌤️</div>
          {/* 창틀 십자 */}
          <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: "2px", background: "#d4a060", opacity: 0.7 }} />
          <div style={{ position: "absolute", top: "50%", left: 0, right: 0, height: "2px", background: "#d4a060", opacity: 0.7 }} />
        </div>
      ))}

      {/* 방 이름 */}
      <div style={{
        position: "absolute", left: "50%", top: "1%", transform: "translateX(-50%)",
        color: "#ffe4b5", fontSize: "14px", fontWeight: "bold",
        background: "#2a1000cc", padding: "3px 12px", borderRadius: "6px",
      }}>
        🏠 나의 집
      </div>
    </>
  );
}

// ─── 가구 슬롯 (방 안에 표시) ─────────────────────────────────────────────────

function RoomSlot({
  index, furnitureId, editMode, isTarget, onClick,
}: {
  index: number;
  furnitureId: string | null;
  editMode: boolean;
  isTarget: boolean;
  onClick: () => void;
}) {
  const pos = SLOT_POSITIONS[index];
  const f   = furnitureId ? getFurniture(furnitureId) : null;

  const borderColor = isTarget
    ? "#fbbf24"
    : editMode
      ? "rgba(255,255,255,0.4)"
      : f ? "rgba(255,255,255,0.15)" : "transparent";

  return (
    <div
      onClick={onClick}
      style={{
        position: "absolute",
        left: `calc(${pos.x}% - ${SLOT_W / 2}px)`,
        top:  `calc(${pos.y}% - ${SLOT_H / 2}px)`,
        width: `${SLOT_W}px`,
        height: `${SLOT_H}px`,
        border: `2px ${isTarget ? "solid" : "dashed"} ${borderColor}`,
        borderRadius: "10px",
        background: f
          ? `${intToRgba(f.color, 0.75)}`
          : editMode ? "rgba(255,255,255,0.05)" : "transparent",
        cursor: editMode ? "pointer" : "default",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "4px",
        transition: "all 0.15s",
        boxShadow: f ? "0 4px 12px rgba(0,0,0,0.35)" : "none",
      }}
    >
      {f ? (
        <>
          <span style={{ fontSize: "26px", lineHeight: 1 }}>{f.emoji}</span>
          <span style={{ fontSize: "10px", color: "#fff", fontWeight: "bold", textShadow: "0 1px 3px #000" }}>{f.name}</span>
          <span style={{ fontSize: "9px", color: RARITY_COLOR[f.rarity] }}>{RARITY_LABEL[f.rarity]}</span>
          {editMode && (
            <span style={{ fontSize: "8px", color: "rgba(255,255,255,0.5)", marginTop: "2px" }}>클릭하여 제거</span>
          )}
        </>
      ) : editMode ? (
        <span style={{ fontSize: "22px", color: "rgba(255,255,255,0.25)" }}>+</span>
      ) : null}
    </div>
  );
}

function intToRgba(color: number, alpha: number) {
  const r = (color >> 16) & 0xff;
  const g = (color >> 8)  & 0xff;
  const b =  color        & 0xff;
  return `rgba(${r},${g},${b},${alpha})`;
}

// ─── 편집 패널 (가구 목록, 제작, 세트 효과) ──────────────────────────────────

type EditTab = "inventory" | "craft" | "bonuses";

function EditPanel({
  selectedId, onSelect, tab, onTabChange,
}: {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  tab: EditTab;
  onTabChange: (t: EditTab) => void;
}) {
  const { materials, furnitureInventory, craftFurniture, placedFurniture, getHousingBonuses } = usePlayerStore();
  const [lastCrafted, setLastCrafted] = useState<string | null>(null);

  const inventory  = FURNITURE.filter((f) => (furnitureInventory[f.id] ?? 0) > 0);
  const bonuses    = getHousingBonuses();
  const counts     = countMaterials(placedFurniture);

  const handleCraft = (id: string) => {
    if (craftFurniture(id)) {
      setLastCrafted(id);
      setTimeout(() => setLastCrafted(null), 1400);
    }
  };

  return (
    <div style={{
      position: "fixed", right: 0, top: 0, bottom: 0, width: "340px",
      background: "rgba(10,6,2,0.97)", borderLeft: "1px solid #3a2510",
      display: "flex", flexDirection: "column", zIndex: 50,
    }}>
      {/* 탭 */}
      <div style={{ display: "flex", borderBottom: "1px solid #3a2510", flexShrink: 0 }}>
        {(["inventory", "craft", "bonuses"] as EditTab[]).map((t) => (
          <button
            key={t}
            onClick={() => onTabChange(t)}
            style={{
              flex: 1, padding: "11px 0", fontSize: "12px", fontWeight: "bold",
              color: tab === t ? "#fbbf24" : "#666",
              background: "none", border: "none",
              borderBottom: tab === t ? "2px solid #fbbf24" : "2px solid transparent",
              cursor: "pointer", transition: "color 0.15s",
            }}
          >
            {t === "inventory" ? "보유 가구" : t === "craft" ? "제작" : "세트 효과"}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "12px" }}>

        {/* ── 보유 가구 탭 ── */}
        {tab === "inventory" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {selectedId && (
              <div style={{
                padding: "8px 12px", borderRadius: "8px",
                background: "rgba(251,191,36,0.15)", border: "1px solid #fbbf24",
                fontSize: "11px", color: "#fbbf24", textAlign: "center",
              }}>
                ✓ {getFurniture(selectedId)?.name} 선택됨 — 방의 슬롯을 클릭하세요
                <button
                  onClick={() => onSelect(null)}
                  style={{ marginLeft: "8px", color: "#aaa", background: "none", border: "none", cursor: "pointer", fontSize: "11px" }}
                >
                  취소
                </button>
              </div>
            )}

            {inventory.length === 0 ? (
              <div style={{ textAlign: "center", color: "#555", fontSize: "12px", padding: "32px 0" }}>
                <div style={{ fontSize: "32px", marginBottom: "8px" }}>🪑</div>
                <p>보유한 가구가 없습니다.</p>
                <p style={{ marginTop: "4px", color: "#444" }}>제작 탭에서 가구를 만들어보세요.</p>
              </div>
            ) : inventory.map((f) => (
              <button
                key={f.id}
                onClick={() => onSelect(selectedId === f.id ? null : f.id)}
                style={{
                  display: "flex", alignItems: "center", gap: "10px",
                  padding: "10px 12px", borderRadius: "10px",
                  border: `1px solid ${selectedId === f.id ? "#fbbf24" : "#2a1a0a"}`,
                  background: selectedId === f.id ? "rgba(251,191,36,0.12)" : "rgba(255,255,255,0.03)",
                  cursor: "pointer", textAlign: "left", transition: "all 0.15s",
                }}
              >
                <span style={{ fontSize: "24px", flexShrink: 0 }}>{f.emoji}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                    <span style={{ color: "#e5e5e5", fontSize: "12px", fontWeight: "bold" }}>{f.name}</span>
                    <span style={{
                      fontSize: "9px", padding: "1px 5px", borderRadius: "4px",
                      background: "rgba(0,0,0,0.4)", color: RARITY_COLOR[f.rarity],
                    }}>{RARITY_LABEL[f.rarity]}</span>
                  </div>
                  <div style={{ color: "#888", fontSize: "10px", marginTop: "2px" }}>{MATERIAL_LABEL[f.material]} 계열</div>
                </div>
                <span style={{ fontSize: "12px", color: "#fbbf24", fontWeight: "bold", fontFamily: "monospace" }}>
                  ×{furnitureInventory[f.id] ?? 0}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* ── 제작 탭 ── */}
        {tab === "craft" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {(["wood", "iron", "crystal", "leather"] as FurnitureMaterial[]).map((mat) => {
              const items = FURNITURE.filter((f) => f.material === mat);
              const matColors: Record<FurnitureMaterial, string> = {
                wood: "#92400e", iron: "#374151", crystal: "#4c1d95", leather: "#7c2d12",
              };
              return (
                <div key={mat}>
                  <div style={{
                    display: "flex", alignItems: "center", gap: "8px",
                    marginBottom: "6px",
                  }}>
                    <span style={{
                      fontSize: "10px", fontWeight: "bold", padding: "2px 8px",
                      borderRadius: "4px", background: matColors[mat], color: "#fff",
                    }}>
                      {MATERIAL_LABEL[mat]}
                    </span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {items.map((f) => {
                      const canCraft = Object.entries(f.recipe).every(([id, n]) => (materials[id] ?? 0) >= n);
                      const owned    = furnitureInventory[f.id] ?? 0;
                      const crafted  = lastCrafted === f.id;
                      return (
                        <div key={f.id} style={{
                          padding: "10px", borderRadius: "10px",
                          border: `1px solid ${crafted ? "#34d399" : "#2a1a0a"}`,
                          background: crafted ? "rgba(52,211,153,0.08)" : "rgba(255,255,255,0.02)",
                        }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span style={{ fontSize: "20px" }}>{f.emoji}</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                                <span style={{ color: "#e5e5e5", fontSize: "11px", fontWeight: "bold" }}>{f.name}</span>
                                <span style={{ fontSize: "8px", color: RARITY_COLOR[f.rarity], background: "rgba(0,0,0,0.4)", padding: "1px 4px", borderRadius: "3px" }}>
                                  {RARITY_LABEL[f.rarity]}
                                </span>
                                {owned > 0 && <span style={{ fontSize: "9px", color: "#fbbf24" }}>보유 ×{owned}</span>}
                              </div>
                            </div>
                          </div>
                          {/* 재료 */}
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", margin: "8px 0 6px" }}>
                            {Object.entries(f.recipe).map(([mid, need]) => {
                              const have = materials[mid] ?? 0;
                              const mat  = getMaterial(mid);
                              const ok   = have >= need;
                              return (
                                <span key={mid} style={{
                                  fontSize: "9px", padding: "2px 7px", borderRadius: "12px",
                                  border: `1px solid ${ok ? "#444" : "#7f1d1d"}`,
                                  color: ok ? "#ccc" : "#f87171",
                                  fontFamily: "monospace",
                                }}>
                                  {mat?.emoji} {mat?.name ?? mid} {have}/{need}
                                </span>
                              );
                            })}
                          </div>
                          <button
                            onClick={() => handleCraft(f.id)}
                            disabled={!canCraft}
                            style={{
                              padding: "5px 14px", borderRadius: "7px", fontSize: "11px", fontWeight: "bold",
                              border: "1px solid",
                              borderColor: crafted ? "#34d399" : canCraft ? "#d97706" : "#333",
                              background: crafted ? "rgba(52,211,153,0.2)" : canCraft ? "rgba(217,119,6,0.2)" : "transparent",
                              color: crafted ? "#34d399" : canCraft ? "#fbbf24" : "#555",
                              cursor: canCraft ? "pointer" : "not-allowed",
                              transition: "all 0.15s",
                            }}
                          >
                            {crafted ? "완성! ✓" : "제작"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── 세트 효과 탭 ── */}
        {tab === "bonuses" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {bonuses.activeSets.length > 0 && (
              <div style={{
                padding: "12px", borderRadius: "10px",
                border: "1px solid rgba(52,211,153,0.3)", background: "rgba(52,211,153,0.06)",
              }}>
                <p style={{ color: "#666", fontSize: "9px", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "8px" }}>활성 보너스</p>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  {bonuses.grassTypePower > 0    && <p style={{ color: "#86efac", fontSize: "12px" }}>🌿 풀타입 기술 위력 +{bonuses.grassTypePower}%</p>}
                  {bonuses.hpPercent > 0         && <p style={{ color: "#6ee7b7", fontSize: "12px" }}>❤️ 최대 HP +{bonuses.hpPercent}%</p>}
                  {bonuses.attackPercent > 0     && <p style={{ color: "#fca5a5", fontSize: "12px" }}>⚔️ 공격력 +{bonuses.attackPercent}%</p>}
                  {bonuses.defensePercent > 0    && <p style={{ color: "#93c5fd", fontSize: "12px" }}>🛡️ 방어력 +{bonuses.defensePercent}%</p>}
                  {bonuses.towerDropBonus > 0    && <p style={{ color: "#67e8f9", fontSize: "12px" }}>🗼 탑 드랍 +{bonuses.towerDropBonus}%</p>}
                  {bonuses.catchRateBonus > 0    && <p style={{ color: "#fde047", fontSize: "12px" }}>🎯 포획률 +{bonuses.catchRateBonus}%</p>}
                  {bonuses.potionBonusPercent > 0 && <p style={{ color: "#f9a8d4", fontSize: "12px" }}>🧪 물약 +{bonuses.potionBonusPercent}%</p>}
                  {bonuses.expBonusPercent > 0   && <p style={{ color: "#c4b5fd", fontSize: "12px" }}>✨ 경험치 +{bonuses.expBonusPercent}%</p>}
                </div>
              </div>
            )}

            {(["wood", "iron", "crystal", "leather"] as FurnitureMaterial[]).map((mat) => {
              const tiers = MATERIAL_SET_TIERS[mat];
              const cur   = counts[mat];
              const max   = tiers[tiers.length - 1].count;
              const matHues: Record<FurnitureMaterial, string> = {
                wood: "#fbbf24", iron: "#9ca3af", crystal: "#c084fc", leather: "#fb923c",
              };
              return (
                <div key={mat} style={{
                  padding: "12px", borderRadius: "10px",
                  border: `1px solid ${cur > 0 ? matHues[mat] + "44" : "#2a1a0a"}`,
                  background: cur > 0 ? `${matHues[mat]}08` : "rgba(255,255,255,0.01)",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                    <span style={{ fontSize: "11px", fontWeight: "bold", color: matHues[mat] }}>{MATERIAL_LABEL[mat]}</span>
                    <span style={{ fontSize: "10px", color: "#888", fontFamily: "monospace" }}>{cur}/{max} 종</span>
                  </div>
                  {/* 진행 바 */}
                  <div style={{ height: "4px", borderRadius: "2px", background: "#1a0e06", marginBottom: "8px" }}>
                    <div style={{
                      height: "4px", borderRadius: "2px",
                      background: matHues[mat],
                      width: `${Math.min(100, (cur / max) * 100)}%`,
                      transition: "width 0.3s",
                    }} />
                  </div>
                  {tiers.map((tier) => (
                    <div key={tier.count} style={{
                      display: "flex", alignItems: "center", gap: "6px",
                      padding: "4px 6px", borderRadius: "6px", marginBottom: "3px",
                      background: cur >= tier.count ? `${matHues[mat]}18` : "transparent",
                      opacity: cur >= tier.count ? 1 : 0.35,
                    }}>
                      <span style={{ fontSize: "12px" }}>{cur >= tier.count ? "✅" : `${tier.count}종`}</span>
                      <span style={{ fontSize: "10px", color: cur >= tier.count ? matHues[mat] : "#888", fontWeight: "bold" }}>{tier.name}</span>
                      <span style={{ fontSize: "9px", color: "#888", marginLeft: "auto" }}>{tier.description}</span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── HousingPage ──────────────────────────────────────────────────────────────

export default function HousingPage() {
  const navigate = useNavigate();
  const { placedFurniture, furnitureInventory, placeFurniture, removeFurniture, getHousingBonuses } = usePlayerStore();

  const [editMode,      setEditMode]      = useState(false);
  const [selectedId,    setSelectedId]    = useState<string | null>(null);
  const [editTab,       setEditTab]       = useState<EditTab>("inventory");

  const bonuses = getHousingBonuses();

  const handleSlotClick = (slotIndex: number) => {
    if (!editMode) return;
    const occupant = placedFurniture[slotIndex];

    if (selectedId) {
      // 선택된 가구를 슬롯에 배치
      placeFurniture(slotIndex, selectedId);
      setSelectedId(null);
    } else if (occupant) {
      // 배치된 가구를 제거하고 인벤토리로 복귀
      removeFurniture(slotIndex);
    }
  };

  const toggleEdit = () => {
    setEditMode((v) => !v);
    setSelectedId(null);
  };

  return (
    <div style={{ width: "100vw", height: "100vh", overflow: "hidden", position: "relative", background: "#1a0e06" }}>
      {/* ── 방 (full area) ── */}
      <div style={{ position: "absolute", inset: 0 }}>
        <RoomBackground />

        {/* 가구 슬롯 */}
        {SLOT_POSITIONS.map((_, i) => (
          <RoomSlot
            key={i}
            index={i}
            furnitureId={placedFurniture[i]}
            editMode={editMode}
            isTarget={editMode && selectedId !== null}
            onClick={() => handleSlotClick(i)}
          />
        ))}
      </div>

      {/* ── 상단 HUD (항상 표시) ── */}
      <div style={{
        position: "fixed", top: "16px", left: "16px", zIndex: 40,
        display: "flex", gap: "8px",
      }}>
        <button
          onClick={() => navigate("/")}
          style={btnStyle("#3f3f46", "#71717a")}
        >
          ← 바깥으로
        </button>
        <button
          onClick={() => navigate("/farm")}
          style={btnStyle("#14532d", "#4ade80")}
        >
          🌾 농장
        </button>
      </div>

      {/* ── 우측 하단: 편집 버튼 + 보너스 알림 ── */}
      <div style={{
        position: "fixed", bottom: "16px", right: "16px", zIndex: 40,
        display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "8px",
      }}>
        {/* 활성 세트 뱃지 (편집 모드 아닐 때) */}
        {!editMode && bonuses.activeSets.length > 0 && (
          <div style={{
            padding: "6px 12px", borderRadius: "8px", fontSize: "11px",
            background: "rgba(0,0,0,0.75)", border: "1px solid rgba(52,211,153,0.4)",
            color: "#34d399",
          }}>
            ✨ 세트 {bonuses.activeSets.length}개 활성
          </div>
        )}
        <button
          onClick={toggleEdit}
          style={editMode ? btnStyle("#78350f", "#fbbf24", true) : btnStyle("#451a03", "#fb923c")}
        >
          {editMode ? "✓ 편집 완료" : "✏️ 방 꾸미기"}
        </button>
      </div>

      {/* ── 편집 패널 ── */}
      {editMode && (
        <EditPanel
          selectedId={selectedId}
          onSelect={setSelectedId}
          tab={editTab}
          onTabChange={setEditTab}
        />
      )}
    </div>
  );
}

function btnStyle(bg: string, color: string, active = false): React.CSSProperties {
  return {
    padding: "8px 16px",
    borderRadius: "10px",
    fontSize: "13px",
    fontWeight: "bold",
    background: bg,
    color,
    border: `1px solid ${active ? color + "88" : color + "44"}`,
    cursor: "pointer",
    boxShadow: active ? `0 0 12px ${color}44` : "none",
    transition: "all 0.15s",
  };
}
