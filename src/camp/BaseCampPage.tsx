import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { createBaseCampGame } from "../shared/phaser/phaserConfig";
import { gameEvents, GAME_EVENT } from "../shared/phaser/events";
import type { NpcDialoguePayload } from "../shared/phaser/events";
import { monsters } from "../monster/monsters";
import { MONSTER_IMAGE_MAP, monsterImgStyle } from "../monster/monsterImages";
import { usePlayerStore } from "../shared/playerStore";
import type { QuestStatus } from "../shared/playerStore";
import { getFullLearnset } from "../monster/learnset";
import { ALL_QUESTS } from "./campDialogues";
import type { QuestDef } from "./campDialogues";
import { getMaterial } from "../shared/items";
import { MAX_TOWER_FLOOR } from "../shared/floorTable";
import { useAuthStore } from "../auth/authStore";

// ── 속성 한글/색상 ──────────────────────────────────────────────────────────────

const TYPE_KO: Record<string, string> = {
  fire: "불꽃", water: "물", grass: "풀",
  electric: "전기", ice: "얼음", normal: "노말", poison: "독",
  none: "무속성",
};

const TYPE_COLOR: Record<string, string> = {
  fire:     "bg-red-900/70 text-red-200 border-red-700",
  water:    "bg-blue-900/70 text-blue-200 border-blue-700",
  grass:    "bg-green-900/70 text-green-200 border-green-700",
  electric: "bg-yellow-900/70 text-yellow-200 border-yellow-700",
  ice:      "bg-cyan-900/70 text-cyan-200 border-cyan-700",
  normal:   "bg-zinc-800/70 text-zinc-200 border-zinc-600",
  poison:   "bg-purple-900/70 text-purple-200 border-purple-700",
  none:     "bg-gradient-to-r from-indigo-900/70 to-fuchsia-900/70 text-fuchsia-200 border-fuchsia-700",
};

const TYPE_GROUP_LABEL: Record<string, string> = {
  fire: "불꽃", water: "물", grass: "풀",
  electric: "전기", ice: "얼음", normal: "노말", poison: "독",
};

// ── 몬스터 설명문 ────────────────────────────────────────────────────────────────

const MONSTER_DEX_DESC: Record<string, string> = {
  flameling:  "드넓은 초원을 무리지어 뛰어다닌다. 흥분하면 갈기에서 불꽃이 피어오르며, 가끔 초원을 태우기도 한다. 불꽃 에너지를 발굽에 모아 강력한 킥을 날린다.",
  burno:      "화산 근처 용암 지대에서 생활한다. 몸통이 뜨거운 돌처럼 단단하고, 콧김에서 연기가 피어오른다. 화가 나면 뿔에서 불꽃이 폭발한다.",
  aquabe:     "맑은 시냇가와 연못가에 서식하는 물 도롱뇽이다. 피부에서 미끌미끌한 점액을 분비하며, 독성 성분이 있어 함부로 만지면 안 된다.",
  aquavern:   "아쿠비가 성장하여 강인한 파충류로 진화한 모습이다. 등의 비늘은 강철처럼 단단하며, 거대한 꼬리에서 뿜어내는 물 소용돌이는 바위도 뚫는다.",
  bubblet:    "수면 위를 떠다니는 거품 속에 산다. 물벌레처럼 빠르게 헤엄치며 독 가시를 쏜다. 거품이 터지는 소리로 의사소통한다.",
  leafy:      "등에 무성한 잎사귀 덤불을 달고 다니는 풀 곰이다. 온화한 성격이지만 위협을 받으면 등의 잎에서 날카로운 씨앗을 뿜어낸다.",
  mossy:      "희미한 전기를 머금은 야생 늑대다. 분노할수록 체내 전기가 강해지며, 성장하면서 갈기에 전기 불꽃이 피어오른다. 수백 킬로미터 밖에서도 뇌우를 감지한다.",
  mossevo:    "모시가 진화한 전기 늑대다. 갈기가 날카로운 전기 스파이크로 변했으며, 가슴의 번개 문양에서 고압 전류를 방출한다. 접근하는 것만으로도 털이 곤두선다.",
  mossyfinal: "모치가 극한의 전기 에너지를 흡수해 완성된 전설의 전기 늑대 왕이다. 온몸의 네온 라인은 억제된 번개의 흔적이며, 한번 울부짖으면 폭풍이 일어난다.",
  crystafox:  "이마에 박힌 다이아몬드 수정이 빛을 굴절시켜 주변을 무지갯빛으로 물들인다. 위기를 감지하면 수정 날개를 펼쳐 얼음 파편을 흩뿌린다.",
  frostorb:   "거대한 수정 원반을 달고 천천히 떠다니는 얼음 생물이다. 원반은 주변 수분을 흡수해 얼음으로 바꾸며, 근처에 가면 숨이 하얗게 변한다.",
  nobi:       "어디서나 볼 수 있는 친근한 생물이다. 특별한 능력은 없지만 균형 잡힌 신체 능력으로 어떤 환경에서도 살아남는다. 무리를 이루면 의외의 강함을 발휘한다.",
};

const STATUS_KO: Record<string, string> = {
  burn: "화상", paralysis: "마비", freeze: "빙결", poison: "독",
};

const QUEST_NPC_KO: Record<QuestDef["npcId"], string> = {
  orion: "오리온", baros: "바로스",
};

const QUEST_STATUS_BADGE: Record<QuestStatus, { label: string; className: string }> = {
  not_accepted: { label: "미수락", className: "border-zinc-700 text-zinc-500" },
  in_progress:  { label: "진행중", className: "border-amber-700 text-amber-400" },
  completed:    { label: "완료",   className: "border-emerald-700 text-emerald-400" },
};

const MOVE_TYPE_COLOR: Record<string, string> = {
  fire:     "bg-red-900/60 text-red-300 border-red-800",
  water:    "bg-blue-900/60 text-blue-300 border-blue-800",
  grass:    "bg-green-900/60 text-green-300 border-green-800",
  electric: "bg-yellow-900/60 text-yellow-300 border-yellow-800",
  ice:      "bg-cyan-900/60 text-cyan-300 border-cyan-800",
  normal:   "bg-zinc-800/60 text-zinc-300 border-zinc-700",
  poison:   "bg-purple-900/60 text-purple-300 border-purple-800",
};

// ── 진화 체인 헬퍼 ───────────────────────────────────────────────────────────────

function getEvolutionChain(monsterId: string) {
  const m = monsters.find(x => x.id === monsterId);
  if (!m?.evolutionChainId) return null;
  const chain = monsters
    .filter(x => x.evolutionChainId === m.evolutionChainId)
    .sort((a, b) => (a.evolutionStage ?? 1) - (b.evolutionStage ?? 1));
  return chain.length >= 2 ? chain : null;
}

// ── 도감 세부 뷰 ──────────────────────────────────────────────────────────────────

function DexDetail({ monsterId, seen, caught, onBack, onGoTo }: {
  monsterId: string;
  seen: boolean;
  caught: boolean;
  onBack: () => void;
  onGoTo: (id: string) => void;
}) {
  const m = monsters.find(x => x.id === monsterId);
  if (!m) return null;
  const learnset = getFullLearnset(monsterId);
  const dexSeen   = usePlayerStore((s) => s.dexSeen);
  const chain     = getEvolutionChain(monsterId);

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
            <span className={`inline-block rounded border px-2 py-0.5 text-xs mt-0.5 ${TYPE_COLOR[m.type ?? "none"] ?? TYPE_COLOR.normal}`}>
              {TYPE_KO[m.type ?? "none"]}
            </span>
          )}
        </div>
        {caught && <span className="text-xs font-bold text-emerald-400 border border-emerald-700 rounded px-2 py-0.5">포획</span>}
      </div>

      <div className="overflow-y-auto flex-1 p-5 space-y-5">
        {/* 이미지 + 스탯 */}
        <div className="flex gap-5 items-start">
          <div className="w-28 h-28 flex items-center justify-center bg-white rounded-xl border border-zinc-200 shrink-0 overflow-hidden">
            <img src={MONSTER_IMAGE_MAP[m.id]} alt={m.name}
              className="w-24 h-24 object-contain"
              style={seen ? { ...monsterImgStyle(m.id), mixBlendMode: "multiply" } : { filter: "brightness(0)", opacity: 0.4 }}/>
          </div>
          {caught && (
            <div className="flex-1 grid grid-cols-2 gap-2">
              {([["HP", m.maxHp], ["공격", m.attack], ["방어", m.defense], ["속도", m.speed]] as [string, number][]).map(([label, val]) => (
                <div key={label} className="bg-zinc-900 rounded-lg p-2.5 border border-zinc-800">
                  <p className="text-[10px] text-zinc-600 uppercase tracking-wider">{label}</p>
                  <p className="text-lg font-black text-zinc-100">{val}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 진화 체인 */}
        {chain && (
          <div className="bg-zinc-900/60 rounded-xl border border-zinc-800 p-4">
            <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-3">진화 계열</p>
            <div className="flex items-center justify-center gap-1">
              {chain.map((cm, i) => {
                const isCurrent = cm.id === monsterId;
                const isSeen    = dexSeen.includes(cm.id);
                // 이전 몬스터의 evolvesAtLevel = 이 화살표에 표시할 레벨
                const evoLevel  = i > 0 ? chain[i - 1].evolvesAtLevel : undefined;
                return (
                  <div key={cm.id} className="flex items-center gap-1">
                    {i > 0 && (
                      <div className="flex flex-col items-center px-1">
                        <span className="text-yellow-500 text-sm leading-none">→</span>
                        {evoLevel && (
                          <span className="text-[9px] text-yellow-700 leading-none mt-0.5">Lv.{evoLevel}</span>
                        )}
                      </div>
                    )}
                    <button
                      onClick={() => !isCurrent && onGoTo(cm.id)}
                      className={`flex flex-col items-center gap-1 rounded-xl p-2 border transition
                        ${isCurrent
                          ? "border-yellow-600 bg-yellow-950/40 cursor-default"
                          : "border-zinc-700 bg-zinc-900 hover:border-zinc-500 active:scale-95"}`}
                    >
                      <div className="w-14 h-14 flex items-center justify-center bg-white rounded-lg overflow-hidden">
                        <img
                          src={MONSTER_IMAGE_MAP[cm.id]}
                          alt={cm.name}
                          className="w-12 h-12 object-contain"
                          style={isSeen ? { ...monsterImgStyle(cm.id), mixBlendMode: "multiply" } : { filter: "brightness(0)", opacity: 0.5 }}
                        />
                      </div>
                      <span className={`text-[11px] font-semibold ${isCurrent ? "text-yellow-300" : isSeen ? "text-zinc-200" : "text-zinc-500"}`}>
                        {cm.name}
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 설명문 */}
        {seen && (
          <div className="bg-zinc-900/60 rounded-xl border border-zinc-800 p-4">
            <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-2">도감 설명</p>
            <p className="text-sm text-zinc-300 leading-relaxed">
              {MONSTER_DEX_DESC[m.id] ?? "아직 알려진 정보가 없다."}
            </p>
          </div>
        )}

        {/* 레벨업 스킬 테이블 (포획한 경우에만) */}
        {caught && learnset.length > 0 && (
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
                    <th className="text-left px-4 py-2 text-[10px] text-zinc-600 uppercase tracking-wider">상태이상</th>
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
                      <td className="px-4 py-2 text-zinc-500">
                        {entry.move.statusEffect
                          ? `${STATUS_KO[entry.move.statusEffect] ?? entry.move.statusEffect} ${entry.move.statusChance ?? 0}%`
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {seen && !caught && (
          <p className="text-[10px] text-zinc-700 text-center">* 포획 후 학습 기술 열람 가능</p>
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

// ── 도감 모달 ──────────────────────────────────────────────────────────────────────

function DexModal({ onClose }: { onClose: () => void }) {
  const dexSeen   = usePlayerStore((s) => s.dexSeen);
  const dexCaught = usePlayerStore((s) => s.dexCaught);
  const [filter, setFilter]     = useState<string>("all");
  const [detailId, setDetailId] = useState<string | null>(null);

  const typeGroups = ["fire", "water", "grass", "electric", "ice", "normal", "poison"];

  // 오름(최종 보스)은 포획 불가능한 존재라 도감 완성률에 포함시키지 않는다
  const visibleMonsters = monsters.filter((m) => m.id !== "ormr");

  const filteredMonsters = filter === "all"
    ? visibleMonsters
    : visibleMonsters.filter((m) => m.type === filter);

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
            onGoTo={(id) => setDetailId(id)}
          />
        ) : (
          /* ── 목록 뷰 ── */
          <>
            {/* 헤더 */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 shrink-0">
              <div>
                <h2 className="text-xl font-bold text-zinc-100">몬스터 도감</h2>
                <p className="text-xs text-zinc-500 mt-0.5">
                  조우 {dexSeen.filter(id => monsters.find(m=>m.id===id)).length}/{visibleMonsters.length}
                  &nbsp;·&nbsp;
                  포획 {dexCaught.filter(id => monsters.find(m=>m.id===id)).length}/{visibleMonsters.length}
                </p>
              </div>
              <button
                onClick={onClose}
                className="rounded-lg bg-zinc-800 px-3 py-1 text-sm text-zinc-400 hover:text-zinc-200"
              >
                닫기
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
                      {/* 포획 뱃지 고정 높이 영역 - 없어도 공간 유지 */}
                      <span className={`self-end text-xs font-bold h-4 leading-none ${caught ? "text-emerald-400" : "invisible"}`}>포획</span>

                      <div className="relative h-20 w-20 flex items-center justify-center bg-white rounded-lg overflow-hidden">
                        {seen ? (
                          <img
                            src={MONSTER_IMAGE_MAP[m.id]}
                            alt={m.name}
                            className="h-20 w-20 object-contain"
                            style={{ ...monsterImgStyle(m.id), mixBlendMode: "multiply" }}
                          />
                        ) : (
                          <img
                            src={MONSTER_IMAGE_MAP[m.id]}
                            alt="???"
                            className="h-20 w-20 object-contain"
                            style={{ filter: "brightness(0)", opacity: 0.5 }}
                          />
                        )}
                      </div>

                      <div className="text-center w-full">
                        {seen ? (
                          <>
                            <p className="font-bold text-zinc-100 text-sm">{m.name}</p>
                            <span className={`mt-0.5 inline-block rounded border px-2 py-0.5 text-xs ${TYPE_COLOR[m.type ?? "none"] ?? TYPE_COLOR.normal}`}>
                              {TYPE_KO[m.type ?? "none"] ?? m.type}
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

// ── 퀘스트 로그 모달 ──────────────────────────────────────────────────────────────

function QuestLogModal({ onClose }: { onClose: () => void }) {
  const questStatus = usePlayerStore((s) => s.questStatus);
  const materials    = usePlayerStore((s) => s.materials);

  const visibleQuests = ALL_QUESTS.filter(
    (q) => (questStatus[q.id] ?? "not_accepted") !== "not_accepted",
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative flex flex-col w-full max-w-lg max-h-[85vh] rounded-2xl border border-zinc-700 bg-zinc-950 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 shrink-0">
          <div>
            <h2 className="text-xl font-bold text-zinc-100">퀘스트</h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              진행중 {visibleQuests.filter((q) => questStatus[q.id] === "in_progress").length}
              &nbsp;·&nbsp;
              완료 {visibleQuests.filter((q) => questStatus[q.id] === "completed").length}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg bg-zinc-800 px-3 py-1 text-sm text-zinc-400 hover:text-zinc-200"
          >
            닫기
          </button>
        </div>

        {/* 목록 */}
        <div className="overflow-y-auto flex-1 p-5 space-y-3">
          {visibleQuests.length === 0 && (
            <div className="text-center py-10 text-zinc-700">
              <p className="text-sm">아직 진행 중인 퀘스트가 없습니다.</p>
              <p className="text-xs mt-1 text-zinc-800">마을 사람에게 말을 걸어보세요.</p>
            </div>
          )}

          {visibleQuests.map((q) => {
            const status = questStatus[q.id] ?? "not_accepted";
            const badge  = QUEST_STATUS_BADGE[status];
            const have   = materials[q.objective.itemId] ?? 0;
            const need   = q.objective.amount;
            const pct    = Math.min(100, Math.round((have / need) * 100));
            const objMat = getMaterial(q.objective.itemId);

            return (
              <div
                key={q.id}
                className={`rounded-xl border p-4 ${
                  status === "completed"
                    ? "border-zinc-800 bg-zinc-900/40 opacity-60"
                    : "border-zinc-700 bg-zinc-900"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="rounded border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400 shrink-0">
                      {QUEST_NPC_KO[q.npcId]}
                    </span>
                    <p className="font-bold text-zinc-100 text-sm truncate">{q.title}</p>
                  </div>
                  <span className={`shrink-0 rounded border px-2 py-0.5 text-[10px] font-semibold ${badge.className}`}>
                    {badge.label}
                  </span>
                </div>

                {status === "in_progress" && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-[11px] text-zinc-500 mb-1">
                      <span>{objMat?.emoji ?? ""} {objMat?.name ?? q.objective.itemId}</span>
                      <span className="font-mono">{Math.min(have, need)} / {need}</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-amber-500 transition-all duration-300"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="mt-3 flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] text-zinc-700">보상</span>
                  {q.rewards.map((r) => {
                    const mat = getMaterial(r.itemId);
                    return (
                      <span key={r.itemId} className="rounded bg-zinc-800/70 px-1.5 py-0.5 text-[10px] text-zinc-400">
                        {mat?.emoji ?? "?"} {mat?.name ?? r.itemId} ×{r.amount}
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── 탑 층수 선택 모달 ──────────────────────────────────────────────────────────────

function TowerModal({
  bestFloor,
  onSelect,
  onClose,
}: {
  bestFloor: number;
  onSelect: (floor: number) => void;
  onClose: () => void;
}) {
  const maxSelectable = Math.min(bestFloor + 1, MAX_TOWER_FLOOR);
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

// ── 메뉴 모달 ──────────────────────────────────────────────────────────────────────

function MenuModal({
  onClose,
  onOpenQuestLog,
  onOpenDex,
  onGoToMonsters,
  onGoToFarm,
}: {
  onClose: () => void;
  onOpenQuestLog: () => void;
  onOpenDex: () => void;
  onGoToMonsters: () => void;
  onGoToFarm: () => void;
}) {
  const logout = useAuthStore((s) => s.logout);
  const isGuest = useAuthStore((s) => s.isGuest);

  const items = [
    { label: "퀘스트",    emoji: "📜", color: "border-orange-800/60 text-orange-300 hover:bg-orange-950/40", onClick: onOpenQuestLog },
    { label: "내 몬스터", emoji: "👾", color: "border-indigo-800/60 text-indigo-300 hover:bg-indigo-950/40", onClick: onGoToMonsters },
    { label: "가방",      emoji: "🎒", color: "border-amber-800/60 text-amber-300 hover:bg-amber-950/40",   onClick: onGoToFarm },
    { label: "도감",      emoji: "📖", color: "border-zinc-600 text-zinc-300 hover:bg-zinc-800/60",         onClick: onOpenDex },
    { label: isGuest ? "로그인" : "로그아웃", emoji: "🚪", color: "border-red-900/60 text-red-300 hover:bg-red-950/40", onClick: logout },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm rounded-2xl border border-zinc-700 bg-zinc-950 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-zinc-100">메뉴</h2>
          <span className="text-[10px] text-zinc-600">ESC: 닫기</span>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          {items.map((it) => (
            <button
              key={it.label}
              onClick={it.onClick}
              className={`flex flex-col items-center gap-1.5 rounded-xl border bg-zinc-900/70 py-4 text-sm font-semibold transition active:scale-95 ${it.color}`}
            >
              <span className="text-2xl">{it.emoji}</span>
              {it.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── BaseCampPage ───────────────────────────────────────────────────────────────────

export default function BaseCampPage() {
  const gameRef = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState<boolean>(
    () => Boolean((location.state as { openMenu?: boolean } | null)?.openMenu),
  );
  const [dexOpen, setDexOpen]           = useState(false);
  const [questLogOpen, setQuestLogOpen] = useState(false);
  const [towerPayload, setTowerPayload] = useState<{ from: string; portalId: string; isCatchZone: boolean } | null>(null);
  const [npcDialogue, setNpcDialogue]   = useState<NpcDialoguePayload | null>(null);
  const [dialogueLineIndex, setDialogueLineIndex] = useState(0);
  const bestFloor = usePlayerStore((s) => s.bestFloor);
  const setStoryFlag = usePlayerStore((s) => s.setStoryFlag);
  const acceptQuest = usePlayerStore((s) => s.acceptQuest);
  const completeQuest = usePlayerStore((s) => s.completeQuest);

  useEffect(() => {
    if (!gameRef.current) return;

    const game = createBaseCampGame(gameRef.current);

    const handleEnterBattle = (payload?: {
      from?: string;
      portalId?: string;
      isCatchZone?: boolean;
      floor?: number;
    }) => {
      setTowerPayload({
        from: payload?.from ?? "basecamp",
        portalId: payload?.portalId ?? "none",
        isCatchZone: payload?.isCatchZone ?? false,
      });
    };

    const handleEnterForest  = () => navigate("/forest");
    const handleEnterWorkshop = () => navigate("/workshop");
    const handleShowNpcDialogue = (payload: NpcDialoguePayload) => {
      setNpcDialogue(payload);
      setDialogueLineIndex(0);
    };

    gameEvents.on(GAME_EVENT.ENTER_BATTLE, handleEnterBattle);
    gameEvents.on(GAME_EVENT.ENTER_FOREST, handleEnterForest);
    gameEvents.on(GAME_EVENT.ENTER_HOUSING, handleEnterWorkshop);
    gameEvents.on(GAME_EVENT.SHOW_NPC_DIALOGUE, handleShowNpcDialogue);

    return () => {
      gameEvents.off(GAME_EVENT.ENTER_BATTLE, handleEnterBattle);
      gameEvents.off(GAME_EVENT.ENTER_FOREST, handleEnterForest);
      gameEvents.off(GAME_EVENT.ENTER_HOUSING, handleEnterWorkshop);
      gameEvents.off(GAME_EVENT.SHOW_NPC_DIALOGUE, handleShowNpcDialogue);
      game.destroy(true);
    };
  }, [navigate]);

  const advanceNpcDialogue = () => {
    if (!npcDialogue) return;
    if (dialogueLineIndex < npcDialogue.lines.length - 1) {
      setDialogueLineIndex((i) => i + 1);
      return;
    }
    if (npcDialogue.setsFlag) setStoryFlag(npcDialogue.setsFlag);
    if (npcDialogue.acceptQuestId) acceptQuest(npcDialogue.acceptQuestId);
    if (npcDialogue.completeQuest) {
      const { questId, objective, rewards, setsFlag } = npcDialogue.completeQuest;
      completeQuest(questId, objective, rewards, setsFlag);
    }
    setNpcDialogue(null);
    setDialogueLineIndex(0);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === " " && npcDialogue) { e.preventDefault(); advanceNpcDialogue(); return; }
      if (e.key === "Tab") {
        if (npcDialogue || towerPayload || dexOpen || questLogOpen) return;
        e.preventDefault();
        setMenuOpen((v) => !v);
        return;
      }
      if (e.key === "Escape") {
        if (npcDialogue) { setNpcDialogue(null); setDialogueLineIndex(0); return; }
        if (dexOpen) { setDexOpen(false); setMenuOpen(true); return; }
        if (questLogOpen) { setQuestLogOpen(false); setMenuOpen(true); return; }
        if (towerPayload) { setTowerPayload(null); return; }
        if (menuOpen) { setMenuOpen(false); return; }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dexOpen, questLogOpen, towerPayload, npcDialogue, dialogueLineIndex, menuOpen]);

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

      {/* 메뉴 버튼 */}
      <button
        onClick={() => setMenuOpen(true)}
        className="fixed bottom-4 right-4 z-40 rounded-xl border border-zinc-600 bg-zinc-900/90 px-4 py-2 text-sm font-semibold text-zinc-300 shadow-lg hover:bg-zinc-800 hover:text-zinc-100 backdrop-blur"
      >
        ☰ 메뉴 (Tab)
      </button>

      {menuOpen && (
        <MenuModal
          onClose={() => setMenuOpen(false)}
          onOpenQuestLog={() => { setMenuOpen(false); setQuestLogOpen(true); }}
          onOpenDex={() => { setMenuOpen(false); setDexOpen(true); }}
          onGoToMonsters={() => navigate("/monsters")}
          onGoToFarm={() => navigate("/farm", { state: { from: "basecamp" } })}
        />
      )}

      {dexOpen && <DexModal onClose={() => setDexOpen(false)} />}

      {questLogOpen && <QuestLogModal onClose={() => setQuestLogOpen(false)} />}

      {towerPayload && (
        <TowerModal
          bestFloor={bestFloor}
          onSelect={handleTowerSelect}
          onClose={() => setTowerPayload(null)}
        />
      )}

      {npcDialogue && (
        <div
          className="fixed inset-x-0 bottom-0 z-50 flex justify-center p-4 pb-6"
          onClick={advanceNpcDialogue}
        >
          <div
            className="flex items-stretch w-full max-w-2xl rounded-2xl overflow-hidden border-2 border-amber-700/60 bg-zinc-950/96 shadow-2xl cursor-pointer"
            style={{ boxShadow: "0 0 40px rgba(180,140,60,0.25)" }}
            onClick={(e) => { e.stopPropagation(); advanceNpcDialogue(); }}
          >
            {/* 초상화 */}
            <div className="shrink-0 w-28 bg-zinc-900/80 flex items-end justify-center p-3">
              <img
                src={npcDialogue.portraitPath}
                alt={npcDialogue.name}
                className="w-24 h-36 object-cover rounded-xl border border-zinc-700"
              />
            </div>
            {/* 대사 영역 */}
            <div className="flex-1 flex flex-col justify-between p-4">
              <div>
                <p className="text-amber-300 font-bold text-base mb-2">{npcDialogue.name}</p>
                <p className="text-zinc-100 text-sm leading-relaxed">
                  {npcDialogue.lines[dialogueLineIndex]}
                </p>
              </div>
              <p className="text-zinc-600 text-xs self-end">
                {dialogueLineIndex < npcDialogue.lines.length - 1
                  ? "클릭 / Space: 다음  ·  ESC: 닫기"
                  : "클릭 / Space: 닫기  ·  ESC: 닫기"}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
