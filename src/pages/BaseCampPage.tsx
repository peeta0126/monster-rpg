import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createBaseCampGame } from "../game/phaser/phaserConfig";
import { gameEvents, GAME_EVENT } from "../game/phaser/events";
import { monsters } from "../data/monsters";
import { MONSTER_IMAGE_MAP, monsterImgStyle } from "../data/monsterImages";
import { usePlayerStore } from "../store/playerStore";
import { LEARNSET } from "../data/learnset";

// ─── 속성 한글/색상 ────────────────────────────────────────────────────────────────

const TYPE_KO: Record<string, string> = {
  fire: "불꽃", water: "물", grass: "풀",
  electric: "전기", ice: "얼음", normal: "노말",
};

const TYPE_COLOR: Record<string, string> = {
  fire:     "bg-red-900/70 text-red-200 border-red-700",
  water:    "bg-blue-900/70 text-blue-200 border-blue-700",
  grass:    "bg-green-900/70 text-green-200 border-green-700",
  electric: "bg-yellow-900/70 text-yellow-200 border-yellow-700",
  ice:      "bg-cyan-900/70 text-cyan-200 border-cyan-700",
  normal:   "bg-zinc-800/70 text-zinc-200 border-zinc-600",
};

const TYPE_GROUP_LABEL: Record<string, string> = {
  fire: "🔥 불꽃", water: "💧 물", grass: "🌿 풀",
  electric: "⚡ 전기", ice: "❄️ 얼음", normal: "⬜ 노말",
};

// ─── 몬스터 설명문 ────────────────────────────────────────────────────────────��───

const MONSTER_DEX_DESC: Record<string, string> = {
  flameling: "드넓은 초원을 무리지어 뛰어다닌다. 흥분하면 갈기에서 불꽃이 피어오르며, 가끔 초원을 태우기도 한다. ��꽃 에너지를 발굽에 모아 강력한 킥을 날린다.",
  burno:     "화산 근처 용암 지대에서 생활한다. 몸통이 뜨거운 돌처럼 단단하고, 콧김에서 연기가 피어오른다. 화가 나면 뿔에서 불꽃이 폭발한다.",
  aquabe:    "맑은 시냇가와 연못가에 서식하는 물 도롱뇽이다. 피부에서 미끌미끌한 점액을 분비하며, 독성 성분이 있어 함부로 만지면 안 된다.",
  bubblet:   "수면 위를 떠다니는 거품 속에 산다. 물벌레처럼 빠르게 헤엄치며 독 가시를 쏜다. 거품이 터지는 소리로 의사소통한다.",
  leafy:     "숲 속 나뭇가지 사이에서 새싹처럼 자란다. 몸 색깔이 주변 식물과 똑같아 찾기 어렵다. 차가운 이슬을 머금은 잎새를 날려 공격한다.",
  mossy:     "오래된 숲의 바위에 이끼처럼 달라붙어 잠든다. 깨어나면 엄청난 힘으로 움직이며 독성 포자를 뿜는다. 수백 년 된 개체도 있다고 전해진다.",
  voltiny:   "볼에 전기를 저장하는 전기 쥐. 꼬리를 흔들면 불꽃이 튄다. 무리를 지어 살며 서로의 전기로 통신한다. 흥분 시 주변 기기가 오작동한다.",
  zapbear:   "어두운 숲속에 사는 전기 곰. 몸 표면의 노란 줄무늬를 통해 전기를 방전한다. 겨울잠을 자지 않고 연중 전기를 모은다.",
  frostlet:  "얼음 수정으로 이루어진 신비로운 생물. 팔에서 날카로운 크리스탈을 발사하며, 배의 눈꽃 무늬는 기온이 낮을수록 밝게 빛난다.",
  blizzwolf: "눈보라가 몰아치는 설원을 4족으로 달리는 얼음 늑대. 얼음 이빨은 강철도 부순다. 무리의 우두머리는 절대영도의 숨결을 내뿜는다.",
  fluffin:   "솜사탕 같은 분홍빛 털로 뒤덮인 온순한 생물. 천적을 만나면 털을 부풀려 두 배로 커 보인다. 달콤한 향기가 나지만 독가루를 품고 있다.",
  stonepup:  "돌처럼 단단한 피부를 가진 강아지 몬스터. 바위 틈새에서 자고, 돌 머리로 박치기를 즐긴다. 오래된 개체일수록 피부에 깊은 균열이 생긴다.",
};

const MOVE_TYPE_COLOR: Record<string, string> = {
  fire:     "bg-red-900/60 text-red-300 border-red-800",
  water:    "bg-blue-900/60 text-blue-300 border-blue-800",
  grass:    "bg-green-900/60 text-green-300 border-green-800",
  electric: "bg-yellow-900/60 text-yellow-300 border-yellow-800",
  ice:      "bg-cyan-900/60 text-cyan-300 border-cyan-800",
  normal:   "bg-zinc-800/60 text-zinc-300 border-zinc-700",
};

// ─── 도감 세부 뷰 ────────────────────────────────────────────────────────────────

function DexDetail({ monsterId, seen, caught, onBack }: {
  monsterId: string; seen: boolean; caught: boolean; onBack: () => void;
}) {
  const m = monsters.find(x => x.id === monsterId);
  if (!m) return null;
  const learnset = LEARNSET[monsterId] ?? [];

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* 헤더 */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-zinc-800 shrink-0">
        <button onClick={onBack}
          className="rounded-lg bg-zinc-800 px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-200 flex items-center gap-1">
          ← 도감
        </button>
        <div className="flex-1">
          <h3 className="text-lg font-bold text-zinc-100">{seen ? m.name : "???"}</h3>
          {seen && (
            <span className={`inline-block rounded border px-2 py-0.5 text-xs mt-0.5 ${TYPE_COLOR[m.type] ?? TYPE_COLOR.normal}`}>
              {TYPE_KO[m.type]}
            </span>
          )}
        </div>
        {caught && <span className="text-xs font-bold text-emerald-400 border border-emerald-700 rounded px-2 py-0.5">포획</span>}
      </div>

      <div className="overflow-y-auto flex-1 p-5 space-y-5">
        {/* 이미지 + 스탯 */}
        <div className="flex gap-5 items-start">
          <div className="w-28 h-28 flex items-center justify-center bg-zinc-900 rounded-xl border border-zinc-800 shrink-0">
            <img src={MONSTER_IMAGE_MAP[m.id]} alt={m.name}
              className="w-24 h-24 object-contain"
              style={seen ? monsterImgStyle(m.id) : { filter:"brightness(0)", opacity:0.3 }}/>
          </div>
          {caught && (
            <div className="flex-1 grid grid-cols-2 gap-2">
              {([["HP", m.maxHp], ["공격", m.attack], ["방어", m.defense], ["속도", m.speed]] as [string,number][]).map(([label, val]) => (
                <div key={label} className="bg-zinc-900 rounded-lg p-2.5 border border-zinc-800">
                  <p className="text-[10px] text-zinc-600 uppercase tracking-wider">{label}</p>
                  <p className="text-lg font-black text-zinc-100">{val}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 설명문 */}
        {seen && (
          <div className="bg-zinc-900/60 rounded-xl border border-zinc-800 p-4">
            <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-2">도감 설명</p>
            <p className="text-sm text-zinc-300 leading-relaxed">
              {MONSTER_DEX_DESC[m.id] ?? "아직 알려진 정보가 없다."}
            </p>
          </div>
        )}

        {/* 레벨업 스킬 테이블 */}
        {seen && learnset.length > 0 && (
          <div>
            <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-2">레벨업 스킬</p>
            <div className="rounded-xl border border-zinc-800 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-zinc-900 border-b border-zinc-800">
                    <th className="text-left px-4 py-2 text-[10px] text-zinc-600 uppercase tracking-wider w-16">레벨</th>
                    <th className="text-left px-4 py-2 text-[10px] text-zinc-600 uppercase tracking-wider">스킬</th>
                    <th className="text-left px-4 py-2 text-[10px] text-zinc-600 uppercase tracking-wider">속성</th>
                    <th className="text-right px-4 py-2 text-[10px] text-zinc-600 uppercase tracking-wider">위력</th>
                    <th className="text-right px-4 py-2 text-[10px] text-zinc-600 uppercase tracking-wider">명중</th>
                  </tr>
                </thead>
                <tbody>
                  {learnset.map((entry, i) => (
                    <tr key={i} className={`border-b border-zinc-800/50 ${i % 2 === 0 ? "bg-zinc-950" : "bg-zinc-900/30"}`}>
                      <td className="px-4 py-2 font-bold text-amber-400">{entry.level}</td>
                      <td className="px-4 py-2 text-zinc-100 font-medium">{entry.move.name}</td>
                      <td className="px-4 py-2">
                        <span className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${MOVE_TYPE_COLOR[entry.move.type] ?? MOVE_TYPE_COLOR.normal}`}>
                          {TYPE_KO[entry.move.type] ?? entry.move.type}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right text-zinc-300 font-mono">
                        {entry.move.power === 0 ? "—" : entry.move.power}
                      </td>
                      <td className="px-4 py-2 text-right text-zinc-500 font-mono">{entry.move.accuracy}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!caught && (
              <p className="text-[10px] text-zinc-700 mt-2 text-center">* 포획 후 전체 스킬 정보 열람 가능</p>
            )}
          </div>
        )}

        {!seen && (
          <div className="text-center py-8 text-zinc-700">
            <p className="text-3xl mb-2">?</p>
            <p className="text-sm">아직 조우한 적 없는 몬스터입니다.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── 도감 모달 ────────────────────────────────────────────────────────────────────

function DexModal({ onClose }: { onClose: () => void }) {
  const dexSeen   = usePlayerStore((s) => s.dexSeen);
  const dexCaught = usePlayerStore((s) => s.dexCaught);
  const [filter, setFilter] = useState<string>("all");
  const [detailId, setDetailId] = useState<string | null>(null);

  const typeGroups = ["fire", "water", "grass", "electric", "ice", "normal"];

  const filteredMonsters = filter === "all"
    ? monsters
    : monsters.filter((m) => m.type === filter);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative flex flex-col w-full max-w-3xl max-h-[92vh] rounded-2xl border border-zinc-700 bg-zinc-950 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {detailId ? (
          /* ── 세부 뷰 ── */
          <DexDetail
            monsterId={detailId}
            seen={dexSeen.includes(detailId)}
            caught={dexCaught.includes(detailId)}
            onBack={() => setDetailId(null)}
          />
        ) : (
          /* ── 목록 뷰 ── */
          <>
            {/* 헤더 */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 shrink-0">
              <div>
                <h2 className="text-xl font-bold text-zinc-100">몬스터 도감</h2>
                <p className="text-xs text-zinc-500 mt-0.5">
                  조우 {dexSeen.length}/{monsters.length} &nbsp;·&nbsp; 포획 {dexCaught.length}/{monsters.length}
                </p>
              </div>
              <button
                onClick={onClose}
                className="rounded-lg bg-zinc-800 px-3 py-1 text-sm text-zinc-400 hover:text-zinc-200"
              >
                닫기 (P)
              </button>
            </div>

            {/* 속성 필터 탭 */}
            <div className="flex gap-1.5 px-5 py-3 overflow-x-auto shrink-0 border-b border-zinc-800/50">
              <button
                onClick={() => setFilter("all")}
                className={`rounded-lg px-3 py-1 text-xs font-semibold whitespace-nowrap transition
                  ${filter === "all" ? "bg-zinc-600 text-white" : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"}`}
              >
                전체
              </button>
              {typeGroups.map((t) => (
                <button
                  key={t}
                  onClick={() => setFilter(t)}
                  className={`rounded-lg px-3 py-1 text-xs font-semibold whitespace-nowrap transition
                    ${filter === t ? "bg-zinc-600 text-white" : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"}`}
                >
                  {TYPE_GROUP_LABEL[t]}
                </button>
              ))}
            </div>

            {/* 몬스터 그리드 */}
            <div className="overflow-y-auto flex-1 p-5">
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                {filteredMonsters.map((m) => {
                  const seen   = dexSeen.includes(m.id);
                  const caught = dexCaught.includes(m.id);
                  return (
                    <button
                      key={m.id}
                      onClick={() => setDetailId(m.id)}
                      className={`rounded-xl border p-3 flex flex-col items-center gap-2 transition text-left w-full
                        hover:border-zinc-500 hover:bg-zinc-800/50 active:scale-95
                        ${caught
                          ? "border-zinc-600 bg-zinc-900"
                          : seen
                            ? "border-zinc-700 bg-zinc-900/60"
                            : "border-zinc-800 bg-zinc-900/30"}`}
                    >
                      {/* 포획 뱃지 */}
                      {caught && (
                        <span className="self-end text-xs text-emerald-400 font-bold -mb-1">포획</span>
                      )}

                      {/* 이미지 */}
                      <div className="relative h-20 w-20 flex items-center justify-center">
                        {seen ? (
                          <img
                            src={MONSTER_IMAGE_MAP[m.id]}
                            alt={m.name}
                            className="h-20 w-20 object-contain"
                            style={monsterImgStyle(m.id)}
                          />
                        ) : (
                          <img
                            src={MONSTER_IMAGE_MAP[m.id]}
                            alt="???"
                            className="h-20 w-20 object-contain"
                            style={{ filter: "brightness(0)", opacity: 0.4 }}
                          />
                        )}
                      </div>

                      {/* 이름/속성 */}
                      <div className="text-center w-full">
                        {seen ? (
                          <>
                            <p className="font-bold text-zinc-100 text-sm">{m.name}</p>
                            <span className={`mt-0.5 inline-block rounded border px-2 py-0.5 text-xs ${TYPE_COLOR[m.type] ?? TYPE_COLOR.normal}`}>
                              {TYPE_KO[m.type] ?? m.type}
                            </span>
                          </>
                        ) : (
                          <>
                            <p className="font-bold text-zinc-600 text-sm">???</p>
                            <span className="mt-0.5 inline-block rounded border px-2 py-0.5 text-xs border-zinc-700 bg-zinc-800/50 text-zinc-600">
                              미발견
                            </span>
                          </>
                        )}
                      </div>

                      {/* 클릭 힌트 */}
                      {seen && (
                        <span className="text-[9px] text-zinc-700 mt-auto">탭하여 상세보기</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── 탑 층수 선택 모달 ────────────────────────────────────────────────────────────

function TowerModal({
  bestFloor,
  onSelect,
  onClose,
}: {
  bestFloor: number;
  onSelect: (floor: number) => void;
  onClose: () => void;
}) {
  const maxSelectable = bestFloor + 1;
  // 5층 단위 체크포인트 목록
  const checkpoints: number[] = [1];
  for (let f = 5; f <= maxSelectable; f += 5) checkpoints.push(f);
  if (!checkpoints.includes(maxSelectable)) checkpoints.push(maxSelectable);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm rounded-2xl border border-blue-900/60 bg-zinc-950 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-zinc-100 mb-1">무한의 탑</h2>
        <p className="text-xs text-zinc-500 mb-4">
          {bestFloor > 0 ? `최고 도달 층: ${bestFloor}층` : "아직 탑에 오른 기록이 없습니다."}
        </p>

        <div className="flex flex-col gap-2">
          <button
            onClick={() => onSelect(1)}
            className="w-full rounded-xl border border-zinc-700 bg-zinc-800/70 py-2.5 text-sm font-semibold text-zinc-200 hover:bg-zinc-700 transition"
          >
            1층부터 시작
          </button>

          {bestFloor >= 1 && (
            <>
              <div className="text-xs text-zinc-600 text-center pt-1">— 이어하기 —</div>
              <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                {checkpoints.filter((f) => f > 1).map((f) => (
                  <button
                    key={f}
                    onClick={() => onSelect(f)}
                    className={`rounded-xl border py-2 text-sm font-bold transition
                      ${f === maxSelectable
                        ? "border-blue-600 bg-blue-950/70 text-blue-300 hover:bg-blue-900/80"
                        : "border-zinc-700 bg-zinc-800/60 text-zinc-300 hover:bg-zinc-700"}`}
                  >
                    {f}층
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <button
          onClick={onClose}
          className="mt-4 w-full rounded-xl border border-zinc-800 py-2 text-sm text-zinc-500 hover:text-zinc-300 transition"
        >
          취소
        </button>
      </div>
    </div>
  );
}

// ─── BaseCampPage ─────────────────────────────────────────────────────────────────

export default function BaseCampPage() {
  const gameRef = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();
  const [dexOpen, setDexOpen] = useState(false);
  const [towerPayload, setTowerPayload] = useState<{ from: string; portalId: string; isCatchZone: boolean } | null>(null);
  const bestFloor = usePlayerStore((s) => s.bestFloor);

  useEffect(() => {
    if (!gameRef.current) return;

    const game = createBaseCampGame(gameRef.current);

    const handleEnterBattle = (payload?: {
      from?: string;
      portalId?: string;
      isCatchZone?: boolean;
      floor?: number;
    }) => {
      // 탑 입구: 층 선택 모달 표시
      setTowerPayload({
        from: payload?.from ?? "basecamp",
        portalId: payload?.portalId ?? "none",
        isCatchZone: payload?.isCatchZone ?? false,
      });
    };

    const handleEnterFarm   = () => navigate("/farm");
    const handleEnterForest = () => navigate("/forest");
    const handleOpenDex = () => setDexOpen(true);

    gameEvents.on(GAME_EVENT.ENTER_BATTLE, handleEnterBattle);
    gameEvents.on(GAME_EVENT.ENTER_FARM, handleEnterFarm);
    gameEvents.on(GAME_EVENT.ENTER_FOREST, handleEnterForest);
    gameEvents.on("open-dex", handleOpenDex);

    return () => {
      gameEvents.off(GAME_EVENT.ENTER_BATTLE, handleEnterBattle);
      gameEvents.off(GAME_EVENT.ENTER_FARM, handleEnterFarm);
      gameEvents.off(GAME_EVENT.ENTER_FOREST, handleEnterForest);
      gameEvents.off("open-dex", handleOpenDex);
      game.destroy(true);
    };
  }, [navigate]);

  // ESC/P 키 핸들링
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "p" || e.key === "P") && !dexOpen) setDexOpen(true);
      if (e.key === "Escape") {
        if (dexOpen) setDexOpen(false);
        if (towerPayload) setTowerPayload(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dexOpen, towerPayload]);

  const handleTowerSelect = (floor: number) => {
    if (!towerPayload) return;
    setTowerPayload(null);
    navigate("/battle", {
      state: {
        from: towerPayload.from,
        portalId: towerPayload.portalId,
        isCatchZone: towerPayload.isCatchZone,
        floor,
      },
    });
  };

  return (
    <div style={{ width: "100vw", height: "100vh", overflow: "hidden", background: "#111" }}>
      <div ref={gameRef} style={{ width: "100%", height: "100%" }} />

      {/* 도감 버튼 (우하단) */}
      <button
        onClick={() => setDexOpen(true)}
        className="fixed bottom-4 right-4 z-40 rounded-xl border border-zinc-600 bg-zinc-900/90 px-4 py-2 text-sm font-semibold text-zinc-300 shadow-lg hover:bg-zinc-800 hover:text-zinc-100 backdrop-blur"
      >
        도감 (P)
      </button>

      {dexOpen && <DexModal onClose={() => setDexOpen(false)} />}

      {towerPayload && (
        <TowerModal
          bestFloor={bestFloor}
          onSelect={handleTowerSelect}
          onClose={() => setTowerPayload(null)}
        />
      )}
    </div>
  );
}
