import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { createBaseCampGame } from "../shared/phaser/phaserConfig";
import { gameEvents, GAME_EVENT } from "../shared/phaser/events";
import type { NpcDialoguePayload } from "../shared/phaser/events";
import { monsters } from "../monster/monsters";
import { MONSTER_IMAGE_MAP } from "../monster/monsterImages";
import { usePlayerStore } from "../shared/playerStore";
import type { OwnedMonster } from "../shared/playerStore";
import { getNextObjective } from "../shared/nextObjective";
import { ObjectiveBanner } from "../shared/ui/ObjectiveBanner";
import { AudioSettings } from "../shared/ui/AudioSettings";
import { useBgm, BGM } from "../shared/audio";
import { GameMenu, type GameMenuItem } from "../shared/ui/GameMenu";
import type { QuestStatus } from "../shared/playerStore";
import { getFullLearnset } from "../monster/learnset";
import { ALL_QUESTS, activeQuestFor } from "./campDialogues";
import type { QuestDef } from "./campDialogues";
import { evaluateObjective, objectiveWhere } from "./questObjectives";
import type { QuestSnapshot } from "./questObjectives";
import { monsterReward, grantedMonsterLevel, rewardDisplay } from "./questRewards";
import type { QuestReward, RewardDisplay } from "./questRewards";
import { scaleToLevel } from "../shared/floorTable";
import { applyLevelGrowth } from "../monster/growth";
import { getMaterial } from "../shared/items";
import { PixelIcon } from "../shared/ui/PixelIcon";
import { MAX_TOWER_FLOOR } from "../shared/floorTable";
import { useAuthStore } from "../auth/authStore";
import { QUALITY_COLOR, QUALITY_LABEL } from "../shared/craftingUtils";
import { PALETTE } from "../shared/palette";

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
  // 훅은 조건부 return 보다 먼저 불러야 한다. 없는 id 로 들어와서 일찍 return 하면
  // 렌더마다 훅 개수가 달라져 React 가 "Rendered fewer hooks than expected"로 죽는다.
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-shadow-900/80 p-gutter backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative flex flex-col w-full max-w-board max-h-[92vh] rounded-2xl border border-stone-600 bg-shadow-900 shadow-2xl overflow-hidden"
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

            {/* 몬스터 그리드. 아래를 흐리게 덮어 "더 있다"를 표시한다.
                안 그러면 마지막 줄이 잘린 채 끝나 스크롤이 있는지 알 수 없다.

                흐림막을 얹으려고 감싼 칸이라 안쪽도 flex 로 이어 준다. h-full 로 두면
                높이가 부모가 아니라 내용을 따라가서, 스크롤할 게 자기 안에는 없는
                채로 부모가 잘라내기만 한다. 도감이 첫 화면에서 멈춰 있었다. */}
            <div className="relative flex min-h-0 flex-1 flex-col">
              <div className="flex-1 overflow-y-auto p-5">
              <div className="grid gap-3"
                style={{ gridTemplateColumns: "repeat(auto-fill, minmax(148px, 1fr))" }}>
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

// ── 받은 것 화면 ─────────────────────────────────────────────────────────────────

/**
 * 퀘스트 보상을 받은 직후 한 장.
 *
 * 원래는 대사만 흐르고 조용히 가방에 들어갔다. 뭘 받았는지 모른 채 대화가 끝나니
 * 보상이 아무리 좋아도 밋밋했다. 제목엔 퀘스트 이름을 그대로 쓴다. 뭘 하고 받은
 * 건지가 붙어 있어야 기억에 남는다.
 */
function RewardScreen({ title, items, onClose }: {
  title: string;
  items: RewardDisplay[];
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-shadow-900/85 backdrop-blur-sm"
      data-testid="quest-rewards" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border-2 border-ember-700/60 bg-shadow-900 shadow-2xl overflow-hidden"
        style={{ boxShadow: "0 0 40px rgba(233,148,65,0.25)" }}
        onClick={(e) => e.stopPropagation()}>
        <div className="border-b border-shadow-700 px-6 py-4">
          <p className="text-pixel-sm text-earth-400">{title}</p>
          <h2 className="text-title-sm font-black text-cream-100 mt-0.5">받은 것</h2>
        </div>

        <div className="p-5 space-y-2">
          {items.map((it, i) => (
            <div key={`${it.name}-${i}`}
              className="flex items-center gap-3 rounded-xl border border-stone-600 bg-shadow-800 p-3">
              {it.monsterId
                ? <img src={MONSTER_IMAGE_MAP[it.monsterId]} alt={it.name}
                    className="h-16 w-16 shrink-0 object-contain" />
                : it.icon && <PixelIcon name={it.icon} size={32} />}
              <div className="min-w-0 flex-1">
                <p className="text-pixel-sm font-bold text-cream-100">
                  {it.name}
                  {it.amount !== undefined && <span className="text-sand-300"> ×{it.amount}</span>}
                </p>
                {(it.quality || it.detail) && (
                  <p className="text-pixel-sm mt-0.5" style={{ color: it.quality ? QUALITY_COLOR[it.quality] : PALETTE.earth400 }}>
                    {it.quality && QUALITY_LABEL[it.quality]}
                    {it.quality && it.detail ? " · " : ""}
                    {it.detail}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-shadow-700 px-5 py-4">
          <button onClick={onClose}
            className="w-full rounded-xl border border-ember-700 bg-ember-700/20 py-2 text-pixel-sm font-bold text-ember-500 hover:bg-ember-700/30">
            확인
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 퀘스트 로그 모달 ──────────────────────────────────────────────────────────────

/**
 * 퀘스트로 받는 몬스터 한 마리를 만든다.
 *
 * 레벨을 정해 주는 게 핵심이다. 이야기로 받는 몬스터는 늘 1레벨이었는데, 그동안은
 * 시작 몬스터라 문제가 없었을 뿐이다. 10층에서 1레벨을 주면 안 주느니만 못하다.
 *
 * 그 레벨까지의 기술 습득이랑 진화를 반드시 태운다. 숲의 포획이 쓰는 경로와 같다.
 * 빼먹으면 레벨만 높고 기술이 둘뿐인 개체가 나간다.
 */
async function buildQuestMonster(
  reward: Extract<QuestReward, { kind: "monster" }>,
): Promise<OwnedMonster | undefined> {
  const base = monsters.find((m) => m.id === reward.monsterId);
  if (!base) return undefined;
  const partyTop = usePlayerStore.getState().party.reduce((max, m) => Math.max(max, m.level), 0);
  const level = grantedMonsterLevel(reward, partyTop);
  const scaled = scaleToLevel(base, level);
  const owned: OwnedMonster = {
    ...scaled,
    uid: `quest-${reward.monsterId}-${Date.now().toString(36)}`,
    currentHp: scaled.maxHp,
  };
  const grown = (await applyLevelGrowth(owned, 1)).monster;
  return { ...grown, currentHp: grown.maxHp };
}

/**
 * 퀘스트 목표 판정에 필요한 것만 추린 지금 상태.
 *
 * 목표가 넷으로 나뉘면서 재료 말고도 층·도감·장비를 봐야 한다. 화면마다 따로 모으면
 * 판정 기준이 화면 수만큼 생기므로 여기 한 곳에서 만든다.
 */
function useQuestSnapshot(): QuestSnapshot {
  const materials         = usePlayerStore((s) => s.materials);
  const potions           = usePlayerStore((s) => s.potions);
  const bestFloor         = usePlayerStore((s) => s.bestFloor);
  const dexCaught         = usePlayerStore((s) => s.dexCaught);
  const equippedArtifacts = usePlayerStore((s) => s.equippedArtifacts);
  const craftedArtifacts  = usePlayerStore((s) => s.craftedArtifacts);
  const partyCount        = usePlayerStore((s) => s.party.length);
  const storageCount      = usePlayerStore((s) => s.storage.length);
  return {
    materials, potions, bestFloor, dexCaught, equippedArtifacts, craftedArtifacts,
    partyCount, storageCount,
  };
}

function QuestLogModal({ onClose }: { onClose: () => void }) {
  const questStatus = usePlayerStore((s) => s.questStatus);
  const storyFlags  = usePlayerStore((s) => s.storyFlags);
  const bestFloor   = usePlayerStore((s) => s.bestFloor);
  const snapshot    = useQuestSnapshot();
  const [showDone, setShowDone] = useState(false);

  const status = (q: QuestDef) => questStatus[q.id] ?? "not_accepted";

  const inProgress = ALL_QUESTS.filter((q) => status(q) === "in_progress");
  const completed  = ALL_QUESTS.filter((q) => status(q) === "completed");
  // 아직 수락 안 했지만 지금 가면 받을 수 있는 것. 제목은 가린다.
  // 무슨 부탁인지는 만나서 듣는 게 맞다
  const waiting = (["orion", "baros"] as const)
    .map((npcId) => activeQuestFor(npcId, storyFlags, bestFloor, questStatus))
    .filter((q): q is QuestDef => !!q && status(q) === "not_accepted");

  // 맨 위 한 장. 지금 뭘 해야 하는지 적는다. 진행 중인 것 중 첫째가 기본이고,
  // 없으면 받으러 갈 사람을 가리킨다
  const headline = (() => {
    const doing = inProgress[0];
    if (doing) {
      const p = evaluateObjective(doing.objective, snapshot);
      return {
        fromQuestId: doing.id,
        title: doing.title,
        line: p.label,
        where: p.done ? `${QUEST_NPC_KO[doing.npcId]}에게 돌아가기` : objectiveWhere(doing.objective),
        rewards: doing.rewards,
        progress: p,
      };
    }
    if (waiting[0]) {
      return {
        fromQuestId: null,
        title: "할 말이 있어 보인다",
        line: `${QUEST_NPC_KO[waiting[0].npcId]}에게 말을 걸어 보세요`,
        where: waiting[0].npcId === "baros" ? "탑 입구" : "마을 안쪽",
        rewards: null,
        progress: null,
      };
    }
    return null;
  })();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-shadow-900/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative flex flex-col w-full max-w-stage max-h-[85vh] rounded-2xl border border-stone-600 bg-shadow-900 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-shadow-700 shrink-0">
          <div>
            <h2 className="text-pixel-md font-bold text-cream-100">퀘스트</h2>
            <p className="text-pixel-sm text-sand-300 mt-0.5">
              진행중 {inProgress.length}
              &nbsp;·&nbsp;
              완료 {completed.length} / {ALL_QUESTS.length}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg bg-shadow-700 px-3 py-1 text-pixel-sm text-sand-300 hover:text-sand-200"
          >
            닫기
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-3">
          {/* 지금 할 일. 목록에 섞어 두면 여덟 개 사이에서 찾아야 한다 */}
          {headline && (
            <div className="rounded-xl border-2 border-ember-700/70 bg-ember-700/10 p-4"
              data-testid="quest-headline">
              <p className="text-pixel-sm text-ember-500 font-bold">지금 할 일</p>
              <p className="mt-1 text-pixel-sm font-bold text-cream-100">{headline.title}</p>
              <div className="mt-1 flex items-center justify-between gap-2 text-pixel-sm">
                <span className="text-sand-300">{headline.line}</span>
                {headline.progress && (
                  <span className={headline.progress.done ? "text-moss-500 font-bold" : "font-mono text-sand-300"}>
                    {headline.progress.need !== undefined
                      ? `${headline.progress.have ?? 0} / ${headline.progress.need}`
                      : (headline.progress.done ? "충족" : "아직")}
                  </span>
                )}
              </div>
              {headline.progress?.need !== undefined && (
                <div className="mt-1 h-1.5 w-full rounded-full bg-shadow-900/70 overflow-hidden">
                  <div className="h-full rounded-full bg-ember-500 transition-all duration-300"
                    style={{ width: `${Math.min(100, Math.round(((headline.progress.have ?? 0) / headline.progress.need) * 100))}%` }} />
                </div>
              )}
              <p className="mt-1.5 text-pixel-sm text-earth-400">→ {headline.where}</p>
              {headline.rewards && (
                <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                  <span className="text-pixel-sm text-earth-400">보상</span>
                  {headline.rewards.map((r) => rewardDisplay(r, true)).map((d, i) => (
                    <span key={`${d.name}-${i}`}
                      className="flex items-center gap-1 rounded bg-shadow-900/60 px-1.5 py-0.5 text-pixel-sm text-sand-300">
                      {d.icon && <PixelIcon name={d.icon} size={16} />}
                      {d.name}{d.amount !== undefined ? ` ×${d.amount}` : ""}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {!headline && inProgress.length === 0 && completed.length === 0 && (
            <div className="text-center py-10 text-earth-400">
              <p className="text-pixel-sm">아직 받은 부탁이 없습니다.</p>
              <p className="text-pixel-sm mt-1 text-shadow-800">마을 사람에게 말을 걸어보세요.</p>
            </div>
          )}

          {/* 진행 중. 맨 위 판에 올린 하나는 뺀다. 같은 내용을 두 번 읽게 할 이유가 없다 */}
          {inProgress.slice(headline?.fromQuestId ? 1 : 0).map((q) => (
            <QuestCard key={q.id} quest={q} status="in_progress" snapshot={snapshot} />
          ))}

          {/* 받을 수 있는 것. 제목을 가린다 */}
          {waiting.map((q) => (
            <div key={q.id}
              className="rounded-xl border border-dashed border-stone-600 bg-shadow-800/50 p-4">
              <div className="flex items-center gap-2">
                <span className="rounded border border-stone-600 bg-shadow-700 px-1.5 py-0.5 text-pixel-sm text-sand-300">
                  {QUEST_NPC_KO[q.npcId]}
                </span>
                <p className="text-pixel-sm text-sand-300">할 말이 있어 보인다</p>
              </div>
            </div>
          ))}

          {/* 완료. 접어 둔다. 여덟 개가 다 펼쳐져 있으면 진행 중인 하나를 못 찾는다 */}
          {completed.length > 0 && (
            <div className="pt-1">
              <button
                onClick={() => setShowDone((v) => !v)}
                className="w-full rounded-lg border border-shadow-700 bg-shadow-800/60 px-3 py-2 text-pixel-sm text-sand-300 hover:text-sand-200"
              >
                완료한 부탁 {completed.length}개 {showDone ? "접기" : "펼치기"}
              </button>
              {showDone && (
                <div className="mt-2 space-y-2">
                  {completed.map((q) => (
                    <QuestCard key={q.id} quest={q} status="completed" snapshot={snapshot} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** 퀘스트 카드 한 장. 진행도는 목표 종류마다 다르게 그린다 */
function QuestCard({ quest, status, snapshot }: {
  quest: QuestDef;
  status: QuestStatus;
  snapshot: QuestSnapshot;
}) {
  const badge = QUEST_STATUS_BADGE[status];
  const progress = evaluateObjective(quest.objective, snapshot);
  const objMat = quest.objective.kind === "material" ? getMaterial(quest.objective.itemId) : undefined;
  const done = status === "completed";

  return (
    <div className={`rounded-xl border p-4 ${
      done ? "border-shadow-700 bg-shadow-800/40 opacity-60" : "border-stone-600 bg-shadow-800"
    }`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="rounded border border-stone-600 bg-shadow-700 px-1.5 py-0.5 text-pixel-sm text-sand-300 shrink-0">
            {QUEST_NPC_KO[quest.npcId]}
          </span>
          <p className="font-bold text-cream-100 text-pixel-sm truncate">{quest.title}</p>
        </div>
        <span className={`shrink-0 rounded border px-2 py-0.5 text-pixel-sm font-semibold ${badge.className}`}>
          {badge.label}
        </span>
      </div>

      {!done && (
        <div className="mt-3">
          <div className="flex items-center justify-between text-pixel-sm text-sand-300 mb-1">
            <span className="flex items-center gap-1.5">
              {objMat && <PixelIcon name={objMat.icon} size={16} />}
              {progress.label}
            </span>
            {/* 숫자로 셀 수 있는 목표만 개수를 적는다. "1/1" 은 아무 정보도 아니다 */}
            <span className={progress.done ? "text-moss-500 font-bold" : "font-mono"}>
              {progress.need !== undefined
                ? `${progress.have ?? 0} / ${progress.need}`
                : (progress.done ? "충족" : "아직")}
            </span>
          </div>
          {progress.need !== undefined && (
            <div className="h-1.5 w-full rounded-full bg-shadow-700 overflow-hidden">
              <div
                className="h-full rounded-full bg-ember-500 transition-all duration-300"
                style={{ width: `${Math.min(100, Math.round(((progress.have ?? 0) / progress.need) * 100))}%` }}
              />
            </div>
          )}
        </div>
      )}

      <div className="mt-3 flex items-center gap-1.5 flex-wrap">
        <span className="text-pixel-sm text-earth-400">보상</span>
        {/* 아직 안 받은 것은 몬스터를 가린다. 뭘 받을지 미리 알면 완료 대사가 죽는다 */}
        {quest.rewards.map((r) => rewardDisplay(r, !done)).map((d, i) => (
          <span key={`${d.name}-${i}`}
            className="flex items-center gap-1 rounded bg-shadow-700/70 px-1.5 py-0.5 text-pixel-sm text-sand-300">
            {d.icon && <PixelIcon name={d.icon} size={16} />}
            {d.name}{d.amount !== undefined ? ` ×${d.amount}` : ""}
          </span>
        ))}
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

        {/* 파티가 비어 있으면 층을 고를 수 없다. 첫 몬스터는 이장에게서 받는다 */}
        {partyEmpty && (
          <p className="mb-4 rounded-xl border border-ember-500/50 bg-ember-700/12 px-3 py-2 text-pixel-sm text-ember-500">
            함께 오를 몬스터가 없다. 마을 안쪽의 이장 오리온에게 말을 걸어 보자.
          </p>
        )}

        {/* 회복은 여기서 바로 한다. 원래는 /monsters까지 갔다가 탑 앞까지 다시 걸어와야 했다 */}
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

  // 메뉴를 닫으면 소리 패널도 접는다. 다시 열었을 때 펼쳐진 채로 나오면 목록이 밀린다.
  // effect 로 하면 한 번 더 렌더되고, 그 사이 프레임에 펼쳐진 메뉴가 보인다.
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
  useBgm(BGM.basecamp);

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
  /** 방금 받은 것들. 대사가 끝난 뒤 한 장 띄운다 */
  const [rewardScreen, setRewardScreen] = useState<{ title: string; items: RewardDisplay[] } | null>(null);
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

  // 이 화면은 캔버스뿐이라 "다음에 뭘 하지"가 어디에도 안 적혀 있었다.
  // 진행 중인 부탁이 있으면 그게 앞선다. 원래는 1층 이후로 "N층에 도전해 보세요"만
  // 반복해서, 벽에 부딪힌 사람한테 제작·강화를 한 번도 안 짚어 줬다.
  const questSnapshot = useQuestSnapshot();
  const questStatus = usePlayerStore((s) => s.questStatus);
  const activeQuestLine = (() => {
    const doing = ALL_QUESTS.find((q) => questStatus[q.id] === "in_progress");
    if (!doing) return null;
    const p = evaluateObjective(doing.objective, questSnapshot);
    return p.done
      ? { text: `${QUEST_NPC_KO[doing.npcId]}에게 돌아가 보세요`, where: doing.npcId === "baros" ? "탑 입구" : "마을 안쪽" }
      : { text: `${doing.title} — ${p.label}`, where: objectiveWhere(doing.objective) };
  })();
  const objective = getNextObjective({
    storyFlags,
    bestFloor,
    potionCount: craftedPotions.reduce((a, p) => a + p.quantity, 0),
    activeQuest: activeQuestLine,
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
  /**
   * 대사가 끝났을 때 실제로 벌어지는 일. 대화창을 어떻게 닫든 한 번은 지나가야 한다.
   *
   * 원래는 마지막 줄까지 넘겨야 여기 왔다. ESC 로 닫으면 플래그도 보상도 안 들어가서,
   * 완료 대사를 보고 ESC 를 누른 사람은 재료만 그대로 든 채 아무것도 못 받았다. 재료
   * 몇 개일 땐 티가 안 났는데, 몬스터를 주기 시작하면 사고다.
   */
  const applyDialogueOutcome = useCallback(async (payload: NpcDialoguePayload) => {
    if (payload.dialogueId) markDialogueSeen(payload.dialogueId);
    if (payload.grantsMonsterId) grantMonster(payload.grantsMonsterId);
    if (payload.setsFlag) setStoryFlag(payload.setsFlag);
    if (payload.acceptQuestId) acceptQuest(payload.acceptQuestId);
    if (payload.completeQuest) {
      const { questId, objective, rewards, setsFlag } = payload.completeQuest;
      const wanted = monsterReward(rewards);
      // 몬스터는 여기서 만들어 넘긴다. 기술 습득이랑 진화를 태우는 경로가 비동기라
      // 스토어 안에서는 못 만든다. 숲의 포획도 같은 경로를 쓴다
      const monster = wanted ? await buildQuestMonster(wanted) : undefined;
      const granted = completeQuest({ questId, objective, rewards, setsFlag, monster });
      if (granted?.length) {
        setRewardScreen({ title: payload.completeQuest.questTitle, items: granted });
      }
    }
  }, [markDialogueSeen, setStoryFlag, grantMonster, acceptQuest, completeQuest]);

  const closeNpcDialogue = useCallback(() => {
    if (!npcDialogue) return;
    const payload = npcDialogue;
    setNpcDialogue(null);
    setDialogueLineIndex(0);
    void applyDialogueOutcome(payload);
  }, [npcDialogue, applyDialogueOutcome]);

  // 키 핸들러 effect가 이 함수를 참조하므로 useCallback으로 고정한다.
  // 매 렌더 새로 만들면 effect 의존성에 넣을 수 없고(리스너를 매번 재등록하게 된다),
  // 빼면 오래된 클로저를 잡아 대화가 엉뚱한 줄에서 멈출 수 있다.
  const advanceNpcDialogue = useCallback(() => {
    if (!npcDialogue) return;
    if (dialogueLineIndex < npcDialogue.lines.length - 1) {
      setDialogueLineIndex((i) => i + 1);
      return;
    }
    closeNpcDialogue();
  }, [npcDialogue, dialogueLineIndex, closeNpcDialogue]);

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
        // ESC 로 닫아도 지급은 된다. 안 읽고 넘긴 것과 못 받은 것은 다르다
        if (npcDialogue) { closeNpcDialogue(); return; }
        if (dexOpen) { setDexOpen(false); setMenuOpen(true); return; }
        if (questLogOpen) { setQuestLogOpen(false); setMenuOpen(true); return; }
        if (towerPayload) { setTowerPayload(null); return; }
        if (menuOpen) { setMenuOpen(false); return; }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dexOpen, questLogOpen, towerPayload, npcDialogue, dialogueLineIndex, menuOpen, advanceNpcDialogue, closeNpcDialogue]);

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

      {/* 조작 안내. 이 화면은 캔버스뿐이라 안내가 없으면 이동법조차 알 수 없다.
          공방 하단 안내와 같은 문구를 쓴다. */}
      <div className="pointer-events-none fixed bottom-gutter left-gutter z-40 rounded-xl border
        border-stone-600 bg-shadow-900/80 px-3 py-1.5 text-pixel-sm text-sand-300 backdrop-blur">
        WASD / 방향키 이동 · E 상호작용 · TAB 메뉴
      </div>

      {/* 우상단 메뉴. 버튼 아래로 펼쳐진다 */}
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

      {rewardScreen && (
        <RewardScreen
          title={rewardScreen.title}
          items={rewardScreen.items}
          onClose={() => setRewardScreen(null)}
        />
      )}

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
