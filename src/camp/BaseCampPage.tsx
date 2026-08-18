import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { createBaseCampGame } from "../shared/phaser/phaserConfig";
import { gameEvents, GAME_EVENT } from "../shared/phaser/events";
import type { NpcDialoguePayload } from "../shared/phaser/events";
import { monsters } from "../monster/monsters";
import { MONSTER_IMAGE_MAP } from "../monster/monsterImages";
import { usePlayerStore } from "../shared/playerStore";
import { getNextObjective } from "../shared/nextObjective";
import { ObjectiveBanner } from "../shared/ui/ObjectiveBanner";
import { AudioSettings } from "../shared/ui/AudioSettings";
import { GameMenu, type GameMenuItem } from "../shared/ui/GameMenu";
import type { QuestStatus } from "../shared/playerStore";
import { getFullLearnset } from "../monster/learnset";
import { ALL_QUESTS } from "./campDialogues";
import type { QuestDef } from "./campDialogues";
import { getMaterial } from "../shared/items";
import { PixelIcon } from "../shared/ui/PixelIcon";
import { MAX_TOWER_FLOOR } from "../shared/floorTable";
import { useAuthStore } from "../auth/authStore";

// ── 속성 한글/색상 ──────────────────────────────────────────────────────────────

const TYPE_KO: Record<string, string> = {
  fire: "불꽃", water: "물", grass: "풀",
  electric: "전기", ice: "얼음", normal: "노말", poison: "독",
  none: "무속성",
};

const TYPE_COLOR: Record<string, string> = {
  fire:     "bg-ember-700/25 text-ember-500 border-ember-700",
  water:    "bg-mist-500/25 text-mist-300 border-mist-500",
  grass:    "bg-moss-500/25 text-moss-500 border-moss-500",
  electric: "bg-ember-700/25 text-ember-500 border-ember-700",
  ice:      "bg-mist-500/25 text-mist-300 border-mist-500",
  normal:   "bg-shadow-700/70 text-sand-200 border-stone-600",
  poison:   "bg-mist-500/25 text-mist-300 border-mist-500",
  none:     "bg-gradient-to-r from-mist-500/70 to-mist-500/70 text-mist-300 border-mist-500",
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
  not_accepted: { label: "미수락", className: "border-stone-600 text-sand-300" },
  in_progress:  { label: "진행중", className: "border-ember-700 text-ember-500" },
  completed:    { label: "완료",   className: "border-moss-500 text-moss-500" },
};

const MOVE_TYPE_COLOR: Record<string, string> = {
  fire:     "bg-ember-700/25 text-ember-500 border-ember-700",
  water:    "bg-mist-500/25 text-mist-300 border-mist-500",
  grass:    "bg-moss-500/25 text-moss-500 border-moss-500",
  electric: "bg-ember-700/25 text-ember-500 border-ember-700",
  ice:      "bg-mist-500/25 text-mist-300 border-mist-500",
  normal:   "bg-shadow-700/60 text-sand-200 border-stone-600",
  poison:   "bg-mist-500/25 text-mist-300 border-mist-500",
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
  // 훅은 조건부 return보다 먼저 호출해야 한다 — 존재하지 않는 id로 들어와 일찍 return하면
  // 렌더마다 훅 개수가 달라져 React가 "Rendered fewer hooks than expected"로 죽는다.
  const dexSeen = usePlayerStore((s) => s.dexSeen);

  const m = monsters.find(x => x.id === monsterId);
  if (!m) return null;
  const learnset = getFullLearnset(monsterId);
  const chain    = getEvolutionChain(monsterId);

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* 헤더 */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-shadow-700 shrink-0">
        <button onClick={onBack}
          className="rounded-lg bg-shadow-700 px-3 py-1.5 text-pixel-sm text-sand-300 hover:text-sand-200 flex items-center gap-1">
          ← 도감
        </button>
        <div className="flex-1">
          <h3 className="text-title-sm font-bold text-cream-100">{seen ? m.name : "???"}</h3>
          {seen && (
            <span className={`inline-block rounded border px-2 py-0.5 text-pixel-sm mt-0.5 ${TYPE_COLOR[m.type ?? "none"] ?? TYPE_COLOR.normal}`}>
              {TYPE_KO[m.type ?? "none"]}
            </span>
          )}
        </div>
        {caught && <span className="text-pixel-sm font-bold text-moss-500 border border-moss-500 rounded px-2 py-0.5">포획</span>}
      </div>

      <div className="overflow-y-auto flex-1 p-5 space-y-5">
        {/* 이미지 + 스탯 */}
        <div className="flex gap-5 items-start">
          <div className="w-28 h-28 flex items-center justify-center bg-cream-100 rounded-xl border border-sand-200 shrink-0 overflow-hidden">
            <img src={MONSTER_IMAGE_MAP[m.id]} alt={m.name}
              className="w-24 h-24 object-contain"
              style={seen ? { mixBlendMode: "multiply" } : { filter: "brightness(0)", opacity: 0.4 }}/>
          </div>
          {caught && (
            <div className="flex-1 grid grid-cols-2 gap-2">
              {([["HP", m.maxHp], ["공격", m.attack], ["방어", m.defense], ["속도", m.speed]] as [string, number][]).map(([label, val]) => (
                <div key={label} className="bg-shadow-800 rounded-lg p-2.5 border border-shadow-700">
                  <p className="text-pixel-sm text-earth-400 uppercase tracking-wider">{label}</p>
                  <p className="text-title-sm font-black text-cream-100">{val}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 진화 체인 */}
        {chain && (
          <div className="bg-shadow-800/60 rounded-xl border border-shadow-700 p-4">
            <p className="text-pixel-sm text-earth-400 uppercase tracking-wider mb-3">진화 계열</p>
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
                        <span className="text-ember-500 text-pixel-sm leading-none">→</span>
                        {evoLevel && (
                          <span className="text-pixel-sm text-ember-700 leading-none mt-0.5">Lv.{evoLevel}</span>
                        )}
                      </div>
                    )}
                    <button
                      onClick={() => !isCurrent && onGoTo(cm.id)}
                      className={`flex flex-col items-center gap-1 rounded-xl p-2 border transition
                        ${isCurrent
                          ? "border-ember-500 bg-ember-700/11 cursor-default"
                          : "border-stone-600 bg-shadow-800 hover:border-sand-300 active:scale-95"}`}
                    >
                      <div className="w-14 h-14 flex items-center justify-center bg-cream-100 rounded-lg overflow-hidden">
                        <img
                          src={MONSTER_IMAGE_MAP[cm.id]}
                          alt={cm.name}
                          className="w-12 h-12 object-contain"
                          style={isSeen ? { mixBlendMode: "multiply" } : { filter: "brightness(0)", opacity: 0.5 }}
                        />
                      </div>
                      <span className={`text-pixel-sm font-semibold ${isCurrent ? "text-ember-500" : isSeen ? "text-sand-200" : "text-sand-300"}`}>
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
          <div className="bg-shadow-800/60 rounded-xl border border-shadow-700 p-4">
            <p className="text-pixel-sm text-earth-400 uppercase tracking-wider mb-2">도감 설명</p>
            <p className="text-pixel-sm text-sand-200 leading-relaxed">
              {MONSTER_DEX_DESC[m.id] ?? "아직 알려진 정보가 없다."}
            </p>
          </div>
        )}

        {/* 레벨업 스킬 테이블 (포획한 경우에만) */}
        {caught && learnset.length > 0 && (
          <div>
            <p className="text-pixel-sm text-earth-400 uppercase tracking-wider mb-2">레벨업 스킬</p>
            <div className="rounded-xl border border-shadow-700 overflow-hidden">
              <table className="w-full text-pixel-sm">
                <thead>
                  <tr className="bg-shadow-800 border-b border-shadow-700">
                    <th className="text-left px-4 py-2 text-pixel-sm text-earth-400 uppercase tracking-wider w-16">레벨</th>
                    <th className="text-left px-4 py-2 text-pixel-sm text-earth-400 uppercase tracking-wider">스킬</th>
                    <th className="text-left px-4 py-2 text-pixel-sm text-earth-400 uppercase tracking-wider">속성</th>
                    <th className="text-right px-4 py-2 text-pixel-sm text-earth-400 uppercase tracking-wider">위력</th>
                    <th className="text-right px-4 py-2 text-pixel-sm text-earth-400 uppercase tracking-wider">명중</th>
                    <th className="text-left px-4 py-2 text-pixel-sm text-earth-400 uppercase tracking-wider">상태이상</th>
                  </tr>
                </thead>
                <tbody>
                  {learnset.map((entry, i) => (
                    <tr key={i} className={`border-b border-shadow-700/50 ${i % 2 === 0 ? "bg-shadow-900" : "bg-shadow-800/30"}`}>
                      <td className="px-4 py-2 font-bold text-ember-500">{entry.level}</td>
                      <td className="px-4 py-2 text-cream-100 font-medium">{entry.move.name}</td>
                      <td className="px-4 py-2">
                        <span className={`rounded border px-1.5 py-0.5 text-pixel-sm font-semibold ${MOVE_TYPE_COLOR[entry.move.type] ?? MOVE_TYPE_COLOR.normal}`}>
                          {TYPE_KO[entry.move.type] ?? entry.move.type}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right text-sand-200 font-mono">
                        {entry.move.power === 0 ? "—" : entry.move.power}
                      </td>
                      <td className="px-4 py-2 text-right text-sand-300 font-mono">{entry.move.accuracy}%</td>
                      <td className="px-4 py-2 text-sand-300">
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
          <p className="text-pixel-sm text-earth-400 text-center">* 포획 후 학습 기술 열람 가능</p>
        )}

        {!seen && (
          <div className="text-center py-8 text-earth-400">
            <p className="text-title-md mb-2">?</p>
            <p className="text-pixel-sm">아직 조우한 적 없는 몬스터입니다.</p>
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-shadow-900/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative flex flex-col w-full max-w-3xl max-h-[92vh] rounded-2xl border border-stone-600 bg-shadow-900 shadow-2xl overflow-hidden"
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
            <div className="flex items-center justify-between px-6 py-4 border-b border-shadow-700 shrink-0">
              <div>
                <h2 className="text-pixel-md font-bold text-cream-100">몬스터 도감</h2>
                <p className="text-pixel-sm text-sand-300 mt-0.5">
                  조우 {dexSeen.filter(id => monsters.find(m=>m.id===id)).length}/{visibleMonsters.length}
                  &nbsp;·&nbsp;
                  포획 {dexCaught.filter(id => monsters.find(m=>m.id===id)).length}/{visibleMonsters.length}
                </p>
              </div>
              <button
                onClick={onClose}
                className="rounded-lg bg-shadow-700 px-3 py-1 text-pixel-sm text-sand-300 hover:text-sand-200"
              >
                닫기
              </button>
            </div>

            {/* 속성 필터 탭 */}
            <div className="flex gap-1.5 px-5 py-3 overflow-x-auto shrink-0 border-b border-shadow-700/50">
              <button
                onClick={() => setFilter("all")}
                className={`rounded-lg px-3 py-1 text-pixel-sm font-semibold whitespace-nowrap transition
                  ${filter === "all" ? "bg-stone-600 text-cream-100" : "bg-shadow-700 text-sand-300 hover:text-sand-200"}`}
              >
                전체
              </button>
              {typeGroups.map((t) => (
                <button
                  key={t}
                  onClick={() => setFilter(t)}
                  className={`rounded-lg px-3 py-1 text-pixel-sm font-semibold whitespace-nowrap transition
                    ${filter === t ? "bg-stone-600 text-cream-100" : "bg-shadow-700 text-sand-300 hover:text-sand-200"}`}
                >
                  {TYPE_GROUP_LABEL[t]}
                </button>
              ))}
            </div>

            {/* 몬스터 그리드 — 아래를 흐리게 덮어 "더 있다"를 표시한다.
                안 그러면 마지막 줄이 잘린 채 끝나 스크롤이 있는지 알 수 없다. */}
            <div className="relative flex-1 overflow-hidden">
              <div className="h-full overflow-y-auto p-5">
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                {filteredMonsters.map((m) => {
                  const seen   = dexSeen.includes(m.id);
                  const caught = dexCaught.includes(m.id);
                  return (
                    <button
                      key={m.id}
                      onClick={() => setDetailId(m.id)}
                      className={`rounded-xl border p-3 flex flex-col items-center gap-2 transition text-left w-full
                        hover:border-sand-300 hover:bg-shadow-700/50 active:scale-95
                        ${caught
                          ? "border-stone-600 bg-shadow-800"
                          : seen
                            ? "border-stone-600 bg-shadow-800/60"
                            : "border-shadow-700 bg-shadow-800/30"}`}
                    >
                      {/* 포획 뱃지 고정 높이 영역 - 없어도 공간 유지 */}
                      <span className={`self-end text-pixel-sm font-bold h-4 leading-none ${caught ? "text-moss-500" : "invisible"}`}>포획</span>

                      <div className={`relative h-20 w-20 flex items-center justify-center rounded-lg overflow-hidden
                        ${seen ? "bg-cream-100" : "bg-shadow-700"}`}>
                        {seen ? (
                          <img
                            src={MONSTER_IMAGE_MAP[m.id]}
                            alt={m.name}
                            className="h-20 w-20 object-contain"
                            style={{ mixBlendMode: "multiply" }}
                          />
                        ) : (
                          <img
                            src={MONSTER_IMAGE_MAP[m.id]}
                            alt="???"
                            className="h-20 w-20 object-contain"
                            style={{ filter: "brightness(0)", opacity: 0.35 }}
                          />
                        )}
                      </div>

                      <div className="text-center w-full">
                        {seen ? (
                          <>
                            <p className="font-bold text-cream-100 text-pixel-sm">{m.name}</p>
                            <span className={`mt-0.5 inline-block rounded border px-2 py-0.5 text-pixel-sm ${TYPE_COLOR[m.type ?? "none"] ?? TYPE_COLOR.normal}`}>
                              {TYPE_KO[m.type ?? "none"] ?? m.type}
                            </span>
                          </>
                        ) : (
                          <>
                            <p className="font-bold text-earth-400 text-pixel-sm">???</p>
                            <span className="mt-0.5 inline-block rounded border px-2 py-0.5 text-pixel-sm border-stone-600 bg-shadow-700/50 text-earth-400">
                              미발견
                            </span>
                          </>
                        )}
                      </div>

                      {seen && (
                        <span className="text-pixel-sm text-sand-300 mt-auto">눌러서 상세보기</span>
                      )}
                    </button>
                  );
                })}
                </div>
              </div>
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8"
                style={{ background: "linear-gradient(to top, rgba(13, 18, 35, 1), rgba(13, 18, 35, 0))" }} />
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-shadow-900/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative flex flex-col w-full max-w-lg max-h-[85vh] rounded-2xl border border-stone-600 bg-shadow-900 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-shadow-700 shrink-0">
          <div>
            <h2 className="text-pixel-md font-bold text-cream-100">퀘스트</h2>
            <p className="text-pixel-sm text-sand-300 mt-0.5">
              진행중 {visibleQuests.filter((q) => questStatus[q.id] === "in_progress").length}
              &nbsp;·&nbsp;
              완료 {visibleQuests.filter((q) => questStatus[q.id] === "completed").length}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg bg-shadow-700 px-3 py-1 text-pixel-sm text-sand-300 hover:text-sand-200"
          >
            닫기
          </button>
        </div>

        {/* 목록 */}
        <div className="overflow-y-auto flex-1 p-5 space-y-3">
          {visibleQuests.length === 0 && (
            <div className="text-center py-10 text-earth-400">
              <p className="text-pixel-sm">아직 진행 중인 퀘스트가 없습니다.</p>
              <p className="text-pixel-sm mt-1 text-shadow-800">마을 사람에게 말을 걸어보세요.</p>
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
                    ? "border-shadow-700 bg-shadow-800/40 opacity-60"
                    : "border-stone-600 bg-shadow-800"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="rounded border border-stone-600 bg-shadow-700 px-1.5 py-0.5 text-pixel-sm text-sand-300 shrink-0">
                      {QUEST_NPC_KO[q.npcId]}
                    </span>
                    <p className="font-bold text-cream-100 text-pixel-sm truncate">{q.title}</p>
                  </div>
                  <span className={`shrink-0 rounded border px-2 py-0.5 text-pixel-sm font-semibold ${badge.className}`}>
                    {badge.label}
                  </span>
                </div>

                {status === "in_progress" && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-pixel-sm text-sand-300 mb-1">
                      <span className="flex items-center gap-1.5">
                        {objMat && <PixelIcon name={objMat.icon} size={16} />}
                        {objMat?.name ?? q.objective.itemId}
                      </span>
                      <span className="font-mono">{Math.min(have, need)} / {need}</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-shadow-700 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-ember-500 transition-all duration-300"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="mt-3 flex items-center gap-1.5 flex-wrap">
                  <span className="text-pixel-sm text-earth-400">보상</span>
                  {q.rewards.map((r) => {
                    const mat = getMaterial(r.itemId);
                    return (
                      <span key={r.itemId}
                        className="flex items-center gap-1 rounded bg-shadow-700/70 px-1.5 py-0.5 text-pixel-sm text-sand-300">
                        {mat && <PixelIcon name={mat.icon} size={16} />}
                        {mat?.name ?? r.itemId} ×{r.amount}
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
  cleared,
  partyEmpty,
  onSelect,
  onClose,
  onHeal,
  healed,
}: {
  bestFloor: number;
  cleared: boolean;
  partyEmpty: boolean;
  onSelect: (floor: number) => void;
  onClose: () => void;
  onHeal: () => void;
  healed: boolean;
}) {
  const maxSelectable = Math.min(bestFloor + 1, MAX_TOWER_FLOOR);
  const checkpoints: number[] = [1];
  for (let f = 5; f <= maxSelectable; f += 5) checkpoints.push(f);
  if (!checkpoints.includes(maxSelectable)) checkpoints.push(maxSelectable);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-shadow-900/75 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm rounded-2xl border border-mist-500/60 bg-shadow-900 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 mb-1">
          <h2 className="text-title-sm font-bold text-cream-100">무한의 탑</h2>
          {cleared && (
            <span className="rounded border border-ember-500/70 bg-ember-700/15 px-1.5 py-0.5 text-pixel-sm font-bold text-ember-500">
              정복 완료
            </span>
          )}
        </div>
        <p className="text-pixel-sm text-sand-300 mb-4">
          {bestFloor > 0 ? `최고 도달 층: ${bestFloor}층` : "아직 탑에 오른 기록이 없습니다."}
        </p>

        {/* 파티가 비어 있으면 층을 고를 수 없다 — 첫 몬스터는 이장에게서 받는다 */}
        {partyEmpty && (
          <p className="mb-4 rounded-xl border border-ember-500/50 bg-ember-700/12 px-3 py-2 text-pixel-sm text-ember-500">
            함께 오를 몬스터가 없다. 마을 안쪽의 이장 오리온에게 말을 걸어 보자.
          </p>
        )}

        {/* 회복을 여기서 바로 — 예전에는 /monsters까지 갔다가 탑 앞까지 다시 걸어와야 했다 */}
        <button
          onClick={onHeal}
          disabled={healed || partyEmpty}
          className="mb-3 w-full rounded-xl border border-mist-500/70 bg-mist-500/15 py-2 text-pixel-sm font-semibold text-mist-300 hover:bg-mist-500/25 disabled:opacity-40 transition"
        >
          {healed ? "✓ 파티 회복 완료" : "+ 파티 HP 전회복"}
        </button>

        <div className="flex flex-col gap-2">
          <button
            onClick={() => onSelect(1)}
            disabled={partyEmpty}
            className="w-full rounded-xl border border-stone-600 bg-shadow-700/70 py-2.5 text-pixel-sm font-semibold text-sand-200 hover:bg-stone-600 disabled:opacity-40 disabled:hover:bg-shadow-700/70 transition"
          >
            1층부터 시작
          </button>

          {!partyEmpty && bestFloor >= 1 && (
            <>
              <div className="text-pixel-sm text-earth-400 text-center pt-1">— 이어하기 —</div>
              <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                {checkpoints.filter((f) => f > 1).map((f) => (
                  <button
                    key={f}
                    onClick={() => onSelect(f)}
                    className={`rounded-xl border py-2 text-pixel-sm font-bold transition
                      ${f === maxSelectable
                        ? "border-mist-500 bg-mist-500/15 text-mist-300 hover:bg-mist-500/25"
                        : "border-stone-600 bg-shadow-700/60 text-sand-200 hover:bg-stone-600"}`}
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
          className="mt-4 w-full rounded-xl border border-shadow-700 py-2 text-pixel-sm text-sand-300 hover:text-sand-200 transition"
        >
          취소
        </button>
      </div>
    </div>
  );
}

// ── 우상단 메뉴 ────────────────────────────────────────────────────────────────────

function CampMenu({
  open,
  onOpen,
  onClose,
  onOpenQuestLog,
  onOpenDex,
  onGoToMonsters,
  onGoToFarm,
  onOpenTower,
  towerCleared,
  onReplayEnding,
}: {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onOpenQuestLog: () => void;
  onOpenDex: () => void;
  onGoToMonsters: () => void;
  onGoToFarm: () => void;
  onOpenTower: () => void;
  towerCleared: boolean;
  onReplayEnding: () => void;
}) {
  const logout = useAuthStore((s) => s.logout);
  const isGuest = useAuthStore((s) => s.isGuest);
  const [showAudio, setShowAudio] = useState(false);

  // 메뉴를 닫으면 소리 패널도 접는다 — 다시 열었을 때 펼쳐진 채로 나오면 목록이 밀린다.
  // effect 로 하면 한 번 더 렌더되고 그 사이 프레임에 펼쳐진 메뉴가 보인다.
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (!open) setShowAudio(false);
  }

  const items: GameMenuItem[] = [
    // 탑 재도전 때마다 캐릭터를 탑까지 걸어가게 하지 않기 위해 메뉴에서도 층 선택을 연다
    { label: "무한의 탑", icon: "tower", tone: "info",   onClick: onOpenTower },
    { label: "퀘스트",    icon: "quest", tone: "accent", onClick: onOpenQuestLog },
    { label: "내 몬스터", icon: "monsters", tone: "info",   onClick: onGoToMonsters },
    { label: "가방",      icon: "bag", tone: "accent", onClick: onGoToFarm },
    { label: "도감",      icon: "dex",                 onClick: onOpenDex },
    // 엔딩을 본 사람만 다시 볼 수 있다
    ...(towerCleared
      ? [{ label: "엔딩 다시 보기", icon: "trophy" as const, tone: "gold" as const, onClick: onReplayEnding }]
      : []),
    {
      label: "소리",
      icon: "sound",
      separated: true,
      onClick: () => setShowAudio((v) => !v),
      panel: showAudio ? <div className="px-2 py-2"><AudioSettings /></div> : null,
    },
    { label: isGuest ? "로그인" : "로그아웃", icon: "door", tone: "accent", onClick: logout },
  ];

  return (
    <GameMenu
      open={open}
      onOpen={onOpen}
      onClose={onClose}
      items={items}
      badge={towerCleared ? "클리어" : undefined}
    />
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
  const [towerPayload, setTowerPayload] = useState<{ from: string; portalId: string } | null>(null);
  const [healed, setHealed] = useState(false);
  const [npcDialogue, setNpcDialogue]   = useState<NpcDialoguePayload | null>(null);
  const [dialogueLineIndex, setDialogueLineIndex] = useState(0);
  const bestFloor = usePlayerStore((s) => s.bestFloor);
  const towerCleared = usePlayerStore((s) => s.storyFlags.tower_cleared);
  const restorePartyHp = usePlayerStore((s) => s.restorePartyHp);
  const setStoryFlag = usePlayerStore((s) => s.setStoryFlag);
  const markDialogueSeen = usePlayerStore((s) => s.markDialogueSeen);
  const grantMonster = usePlayerStore((s) => s.grantMonster);
  const partySize = usePlayerStore((s) => s.party.length);
  const storyFlags = usePlayerStore((s) => s.storyFlags);
  const craftedPotions = usePlayerStore((s) => s.craftedPotions);

  // 이 화면은 캔버스뿐이라 "다음에 뭘 하지"가 어디에도 안 적혀 있었다
  const objective = getNextObjective({
    storyFlags,
    bestFloor,
    potionCount: craftedPotions.reduce((a, p) => a + p.quantity, 0),
  });
  const acceptQuest = usePlayerStore((s) => s.acceptQuest);
  const completeQuest = usePlayerStore((s) => s.completeQuest);

  useEffect(() => {
    if (!gameRef.current) return;

    const game = createBaseCampGame(gameRef.current);

    const handleEnterBattle = (payload?: { from?: string; portalId?: string }) => {
      setTowerPayload({
        from: payload?.from ?? "basecamp",
        portalId: payload?.portalId ?? "none",
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

  // 키 핸들러 effect가 이 함수를 참조하므로 useCallback으로 고정한다.
  // 매 렌더 새로 만들면 effect 의존성에 넣을 수 없고(리스너를 매번 재등록하게 된다),
  // 빼면 오래된 클로저를 잡아 대화가 엉뚱한 줄에서 멈출 수 있다.
  const advanceNpcDialogue = useCallback(() => {
    if (!npcDialogue) return;
    if (dialogueLineIndex < npcDialogue.lines.length - 1) {
      setDialogueLineIndex((i) => i + 1);
      return;
    }
    if (npcDialogue.dialogueId) markDialogueSeen(npcDialogue.dialogueId);
    if (npcDialogue.grantsMonsterId) grantMonster(npcDialogue.grantsMonsterId);
    if (npcDialogue.setsFlag) setStoryFlag(npcDialogue.setsFlag);
    if (npcDialogue.acceptQuestId) acceptQuest(npcDialogue.acceptQuestId);
    if (npcDialogue.completeQuest) {
      const { questId, objective, rewards, setsFlag } = npcDialogue.completeQuest;
      completeQuest(questId, objective, rewards, setsFlag);
    }
    setNpcDialogue(null);
    setDialogueLineIndex(0);
  }, [npcDialogue, dialogueLineIndex, setStoryFlag, markDialogueSeen, grantMonster, acceptQuest, completeQuest]);

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
  }, [dexOpen, questLogOpen, towerPayload, npcDialogue, dialogueLineIndex, menuOpen, advanceNpcDialogue]);

  const handleTowerSelect = (floor: number) => {
    if (!towerPayload) return;
    setTowerPayload(null);
    navigate("/battle", {
      state: {
        from: towerPayload.from,
        portalId: towerPayload.portalId,
        floor,
      },
    });
  };

  return (
    <div style={{ width: "100vw", height: "100vh", overflow: "hidden", background: "var(--color-shadow-900)" }}>
      <div ref={gameRef} style={{ width: "100%", height: "100%" }} />

      <ObjectiveBanner objective={objective} />

      {/* 조작 안내 — 이 화면은 캔버스뿐이라 안내가 없으면 이동법조차 알 수 없다.
          공방 하단 안내와 같은 문구를 쓴다. */}
      <div className="pointer-events-none fixed bottom-4 left-4 z-40 rounded-xl border border-stone-600
        bg-shadow-900/80 px-3 py-1.5 text-pixel-sm text-sand-300 backdrop-blur">
        WASD / 방향키 이동 · E 상호작용 · TAB 메뉴
      </div>

      {/* 우상단 메뉴 — 버튼 아래로 펼쳐진다 */}
      <CampMenu
        open={menuOpen}
        onOpen={() => setMenuOpen(true)}
        onClose={() => setMenuOpen(false)}
        onOpenQuestLog={() => { setMenuOpen(false); setQuestLogOpen(true); }}
        onOpenDex={() => { setMenuOpen(false); setDexOpen(true); }}
        onGoToMonsters={() => navigate("/monsters")}
        onGoToFarm={() => navigate("/farm", { state: { from: "basecamp" } })}
        towerCleared={towerCleared}
        onReplayEnding={() => { setMenuOpen(false); navigate("/ending"); }}
        onOpenTower={() => {
          setMenuOpen(false);
          setHealed(false);
          setTowerPayload({ from: "menu", portalId: "none" });
        }}
      />


      {dexOpen && <DexModal onClose={() => setDexOpen(false)} />}

      {questLogOpen && <QuestLogModal onClose={() => setQuestLogOpen(false)} />}

      {towerPayload && (
        <TowerModal
          bestFloor={bestFloor}
          cleared={towerCleared}
          partyEmpty={partySize === 0}
          onSelect={handleTowerSelect}
          onClose={() => { setTowerPayload(null); setHealed(false); }}
          onHeal={() => { restorePartyHp(); setHealed(true); }}
          healed={healed}
        />
      )}

      {npcDialogue && (
        <div
          className="fixed inset-x-0 bottom-0 z-50 flex justify-center p-4 pb-6"
          onClick={advanceNpcDialogue}
        >
          <div
            className="flex items-stretch w-full max-w-2xl rounded-2xl overflow-hidden border-2 border-ember-700/60 bg-shadow-900/96 shadow-2xl cursor-pointer"
            style={{ boxShadow: "0 0 40px rgba(233,148,65,0.25)" }}
            onClick={(e) => { e.stopPropagation(); advanceNpcDialogue(); }}
          >
            {/* 초상화 */}
            <div className="shrink-0 w-28 bg-shadow-800/80 flex items-end justify-center p-3">
              <img
                src={npcDialogue.portraitPath}
                alt={npcDialogue.name}
                className="w-24 h-36 object-cover rounded-xl border border-stone-600"
              />
            </div>
            {/* 대사 영역 */}
            <div className="flex-1 flex flex-col justify-between p-4">
              <div>
                <p className="text-ember-500 font-bold text-title-sm mb-2">{npcDialogue.name}</p>
                <p className="text-cream-100 text-pixel-sm leading-relaxed">
                  {npcDialogue.lines[dialogueLineIndex]}
                </p>
              </div>
              <p className="text-earth-400 text-pixel-sm self-end">
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
