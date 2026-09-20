import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../auth/authStore";
import { usePlayerStore } from "./playerStore";
import { MONSTER_IMAGE_MAP } from "../monster/monsterImages";
import { useBgm, BGM } from "./audio";

type EndingScene = "black" | "story" | "end" | "credits" | "thanks";
type StoryPhase = "entering" | "viewing" | "dialogue" | "leaving" | "interlude";

interface EndingDialogueLine {
  speaker: "player" | "mother" | "orion";
  text: string;
}

interface EndingStoryScene {
  id: string;
  chapter: 0 | 1 | 2 | 3 | 4;
  moment: "present" | "flashback";
  image: string;
  alt: string;
  imageScale?: string;
  lines: EndingDialogueLine[];
}

const player = (text: string): EndingDialogueLine => ({ speaker: "player", text });
const mother = (text: string): EndingDialogueLine => ({ speaker: "mother", text });

/**
 * 이미지 순서와 대사를 한곳에서 읽을 수 있게 둔다.
 * 첫 장면과 마지막 장면은 같은 0장 이미지를 재사용하지만 서로 다른 대화 장면이다.
 * imageScale은 회상 원본 하단에 포함된 옛 대화창을 화면 밖으로 크롭하기 위한 값이다.
 */
const ENDING_STORY_SCENES: EndingStoryScene[] = [
  {
    id: "reunion",
    chapter: 0,
    moment: "present",
    image: "/assets/ending/스토리 0장.png",
    alt: "깨어난 어머니의 침대 곁에 치료약 병을 든 주인공이 앉아 있다.",
    lines: [
      mother("...여긴..."),
      player("어머니...!"),
      player("정신이 드세요?"),
      mother("내가... 얼마나 누워 있었던 거니?"),
      mother("그동안 무슨 일이 있었던 거야?"),
      player("...많은 일이 있었어요."),
      player("어디서부터 이야기해야 할지 모르겠네요."),
      player("처음부터 이야기해 드릴게요."),
    ],
  },
  {
    id: "the-beginning",
    chapter: 1,
    moment: "flashback",
    image: "/assets/ending/스토리 1장.png",
    alt: "어머니가 갑자기 쓰러졌던 날, 어린 주인공이 곁을 지키고 있다.",
    imageScale: "1.24",
    lines: [
      player("모든 건 그날부터 시작됐어요."),
      player("어머니가 갑자기 쓰러지고..."),
      player("아무리 불러도 눈을 뜨지 않으셨죠."),
      player("그때는 정말 아무것도 몰랐어요."),
      player("어떻게 해야 어머니를 다시 깨울 수 있는지도..."),
    ],
  },
  {
    id: "first-companion",
    chapter: 2,
    moment: "flashback",
    image: "/assets/ending/스토리 2장.png",
    alt: "촌장 오리온이 주인공에게 첫 동료 플레미를 소개하고 있다.",
    imageScale: "1.24",
    lines: [
      player("그때 촌장님이 저를 도와주셨어요."),
      player("혼자서는 위험하다면서..."),
      player("함께 싸워 줄 플레미를 소개해 주셨죠."),
      player("처음에는 저도 많이 서툴렀어요."),
      player("하지만 이 아이가 계속 제 곁에 있어 줬어요."),
    ],
  },
  {
    id: "the-journey",
    chapter: 3,
    moment: "flashback",
    image: "/assets/ending/스토리 3장.png",
    alt: "주인공과 플레미가 숲을 여행하며 약초를 찾고 있다.",
    imageScale: "1.09",
    lines: [
      player("그 뒤로 정말 많은 곳을 돌아다녔어요."),
      player("숲에서 약초도 찾고..."),
      player("처음 보는 몬스터들과 싸우기도 했어요."),
      player("혼자였다면 아마 여기까지 오지 못했을 거예요."),
      player("여행하면서 새로운 동료들도 많이 만났고..."),
      player("서로를 믿는 법을 배웠어요."),
      player("그러면서 조금씩 강해졌어요."),
    ],
  },
  {
    id: "infinite-tower",
    chapter: 4,
    moment: "flashback",
    image: "/assets/ending/스토리 4장.png",
    alt: "주인공과 동료 몬스터들이 무한의 탑에서 오름과 맞서고 있다.",
    imageScale: "1.06",
    lines: [
      player("그리고 결국..."),
      player("어머니를 깨울 방법이 탑의 꼭대기에 있을지도 모른다는 걸 알게 됐어요."),
      player("그래서 계속 올라갔어요."),
      player("몇 번이나 포기하고 싶었지만..."),
      player("저 혼자 싸운 건 아니었어요."),
      player("끝까지 같이 올라와 준 녀석들이 있었거든요."),
      player("그리고 탑의 마지막에서 오름을 쓰러뜨리고..."),
      player("만물의 정수를 얻었어요."),
      player("촌장님은 그 정수라면..."),
      player("어머니를 깨울 약을 만들 수 있을지도 모른다고 하셨어요."),
      player("그래서 포기하지 않았어요."),
      player("꼭 어머니를 다시 만나고 싶었으니까."),
    ],
  },
  {
    id: "home-again",
    chapter: 0,
    moment: "present",
    image: "/assets/ending/스토리 0장.png",
    alt: "모험 이야기를 마친 주인공과 깨어난 어머니가 서로 마주 보고 있다.",
    lines: [
      mother("...그런 일이 있었구나."),
      mother("많이 힘들었겠네."),
      player("조금요."),
      player("그래도 괜찮아요."),
      player("어머니가 다시 깨어나셨으니까."),
      mother("...고마워."),
      player("다녀왔어요, 어머니."),
    ],
  },
];

/**
 * 크레딧.
 *
 * 크레딧은 글이 아니라 명단이다. 한 카드에 역할 하나, 그 아래 그 일을 한 것 하나.
 * 설명하려 들면 그 순간 크레딧이 아니라 소개문이 된다.
 *
 * 글자만으로 채우지 않는다 — 여기서 제일 오래 보게 되는 건 얼굴과 동료다.
 * 마지막 카드 둘(YOUR PARTY · PLAYED BY)은 이 세이브에서 꺼내 그리므로
 * 사람마다 다르게 나온다. 그게 이 크레딧이 그 사람 것인 이유다.
 */
const CREDIT_ROLES = [
  "DIRECTION · GAME DESIGN",
  "SCENARIO · BATTLE · MONSTERS",
  "CRAFTING · PIXEL ART · INTERFACE",
  "PROGRAMMING",
];

interface EndingCastMember {
  name: string;
  title: string;
  portrait: string;
}

const ENDING_CAST: EndingCastMember[] = [
  { name: "오리온", title: "이장",        portrait: "/assets/player/Orion_portrait.webp" },
  { name: "바로스", title: "탑의 문지기", portrait: "/assets/player/Baros_portrait.webp" },
];

interface EndingTrack {
  title: string;
  where: string;
}

const CREDIT_TRACKS: EndingTrack[] = [
  { title: "탑의 문 앞에서", where: "타이틀 · 엔딩" },
  { title: "돌아올 곳",      where: "베이스캠프" },
  { title: "잎사귀 사이로",  where: "숲" },
  { title: "모루와 불씨",    where: "제작 공방" },
  { title: "한 층 더",       where: "탑의 전투" },
  { title: "문 너머의 것",   where: "보스" },
];

const OPENING_BLACK_DURATION = 1000;
const STORY_FADE_DURATION = 900;
const STORY_IMAGE_HOLD_DURATION = 850;
const STORY_INTERLUDE_DURATION = 320;
const FINAL_LINE_HOLD_DURATION = 2600;
const INPUT_LOCK_DURATION = 180;
const END_TITLE_DURATION = 3000;
// 크레딧은 스스로 굴러가므로 읽는 속도가 곧 이 값이다. 항목을 더했으면 같이 늘릴 것 —
// 굴러가는 거리는 내용 높이가 정하는데 시간이 그대로면 그만큼 빨리 지나간다.
// CSS 의 animation-duration 도 이 값으로 먹인다(한 곳에서만 정한다).
const CREDITS_DURATION = 34000;
const THANKS_DURATION = 4000;

export default function EndingPage() {
  useBgm(BGM.title);

  const navigate = useNavigate();
  const username = useAuthStore((s) => s.username);
  const setStoryFlag = usePlayerStore((s) => s.setStoryFlag);
  // 마지막 카드 둘은 이 세이브를 그대로 읽는다. 사람마다 다른 크레딧이 되는 자리다.
  const party = usePlayerStore((s) => s.party);
  const bestFloor = usePlayerStore((s) => s.bestFloor);
  const dexCaught = usePlayerStore((s) => s.dexCaught);
  const [scene, setScene] = useState<EndingScene>("black");
  const [storyIndex, setStoryIndex] = useState(0);
  const [storyPhase, setStoryPhase] = useState<StoryPhase>("entering");
  const [lineIndex, setLineIndex] = useState(0);
  const inputLockedUntil = useRef(0);

  // 이 페이지는 라우트 가드를 통과한 최종 퀘스트 완료자(또는 다시보기)만 마운트된다.
  useEffect(() => { setStoryFlag("tower_cleared"); }, [setStoryFlag]);

  // 첫 컷 전에 모든 고유 이미지를 받아 두어 장면 사이에 자산 로딩이 끼지 않게 한다.
  useEffect(() => {
    let cancelled = false;
    // 크레딧의 얼굴과 동료도 같이 받아 둔다. 굴러가는 도중에 도착하면 그 줄만 늦게 뜬다.
    const sources = [...new Set([
      ...ENDING_STORY_SCENES.map((storyScene) => storyScene.image),
      ...ENDING_CAST.map((member) => member.portrait),
      // 파티는 여기서 한 번만 읽는다. 의존성에 걸면 세이브가 늦게 들어올 때 이 effect 가
      // 다시 돌면서 이미 지나간 장면을 처음부터 다시 연다.
      ...usePlayerStore.getState().party.map((m) => MONSTER_IMAGE_MAP[m.id]).filter(Boolean),
    ])];
    const images = sources.map(() => new Image());
    const preload = images.map(
      (image, index) => new Promise<void>((resolve) => {
        image.onload = () => resolve();
        image.onerror = () => resolve();
        image.src = sources[index];
        if (image.complete) resolve();
      }),
    );
    const openingTimer = { id: 0 };
    const openingBlack = new Promise<void>((resolve) => {
      openingTimer.id = window.setTimeout(resolve, OPENING_BLACK_DURATION);
    });

    void Promise.all([...preload, openingBlack]).then(() => {
      if (!cancelled) setScene("story");
    });

    return () => {
      cancelled = true;
      window.clearTimeout(openingTimer.id);
      images.forEach((image) => {
        image.onload = null;
        image.onerror = null;
      });
    };
  }, []);

  // 장면 전환 중에는 입력을 받지 않고 정해진 페이드 순서만 진행한다.
  useEffect(() => {
    if (scene !== "story") return;
    let duration: number | null = null;
    let next: (() => void) | null = null;

    if (storyPhase === "entering") {
      duration = STORY_FADE_DURATION;
      next = () => setStoryPhase("viewing");
    } else if (storyPhase === "viewing") {
      duration = STORY_IMAGE_HOLD_DURATION;
      next = () => setStoryPhase("dialogue");
    } else if (storyPhase === "leaving") {
      duration = STORY_FADE_DURATION;
      next = () => setStoryPhase("interlude");
    } else if (storyPhase === "interlude") {
      duration = STORY_INTERLUDE_DURATION;
      next = () => {
        if (storyIndex === ENDING_STORY_SCENES.length - 1) {
          setScene("end");
          return;
        }
        setStoryIndex((current) => current + 1);
        setLineIndex(0);
        setStoryPhase("entering");
      };
    }

    if (duration === null || !next) return;
    const timer = window.setTimeout(next, duration);
    return () => window.clearTimeout(timer);
  }, [scene, storyIndex, storyPhase]);

  const story = ENDING_STORY_SCENES[storyIndex];
  const dialogueLine = story.lines[lineIndex];
  const isLastStoryScene = storyIndex === ENDING_STORY_SCENES.length - 1;
  const isFinalLine = lineIndex === story.lines.length - 1;

  // 최종 대사는 버튼 안내 없이 잠시 남겨 둔 뒤 자동으로 암전한다.
  useEffect(() => {
    if (scene !== "story" || storyPhase !== "dialogue" || !isLastStoryScene || !isFinalLine) return;
    const timer = window.setTimeout(() => setStoryPhase("leaving"), FINAL_LINE_HOLD_DURATION);
    return () => window.clearTimeout(timer);
  }, [isFinalLine, isLastStoryScene, scene, storyPhase]);

  const advanceDialogue = useCallback(() => {
    if (scene !== "story" || storyPhase !== "dialogue") return;
    if (isLastStoryScene && isFinalLine) return;

    const now = Date.now();
    if (now < inputLockedUntil.current) return;
    inputLockedUntil.current = now + INPUT_LOCK_DURATION;

    if (!isFinalLine) {
      setLineIndex((current) => current + 1);
      return;
    }
    setStoryPhase("leaving");
  }, [isFinalLine, isLastStoryScene, scene, storyPhase]);

  useEffect(() => {
    if (scene !== "story" || storyPhase !== "dialogue") return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || (event.code !== "Space" && event.code !== "Enter")) return;
      event.preventDefault();
      advanceDialogue();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [advanceDialogue, scene, storyPhase]);

  useEffect(() => {
    const nextScene = scene === "end" ? "credits" : scene === "credits" ? "thanks" : null;
    const duration =
      scene === "end"
        ? END_TITLE_DURATION
        : scene === "credits"
          ? CREDITS_DURATION
          : scene === "thanks"
            ? THANKS_DURATION
            : null;

    if (scene === "thanks") {
      const timer = window.setTimeout(() => navigate("/", { replace: true }), duration ?? 0);
      return () => window.clearTimeout(timer);
    }
    if (!nextScene || duration === null) return;

    const timer = window.setTimeout(() => setScene(nextScene), duration);
    return () => window.clearTimeout(timer);
  }, [navigate, scene]);

  const dialogueVisible = scene === "story" && storyPhase === "dialogue";
  const canAdvance = dialogueVisible && !(isLastStoryScene && isFinalLine);
  const playerDisplayName = username?.trim() || "주인공";
  const speakerName = dialogueLine.speaker === "player"
    ? playerDisplayName
    : dialogueLine.speaker === "mother"
      ? "어머니"
      : "오리온";

  return (
    <main
      className={`fixed inset-0 z-[1000] overflow-hidden bg-shadow-900 text-center ${canAdvance ? "cursor-pointer" : ""}`}
      style={{ fontFamily: "var(--font-title)" }}
      data-testid={`ending-scene-${scene}`}
      data-story-id={scene === "story" ? story.id : undefined}
      data-story-chapter={scene === "story" ? story.chapter : undefined}
      data-story-phase={scene === "story" ? storyPhase : undefined}
      data-line-index={dialogueVisible ? lineIndex : undefined}
      onClick={canAdvance ? advanceDialogue : undefined}
    >
      {scene === "story" && (
        <figure
          className={`ending-story-scene ending-story-${storyPhase} ${story.moment === "flashback" ? "ending-story-flashback" : "ending-story-present"}`}
        >
          <div
            className="ending-story-frame"
            style={{ "--ending-image-scale": story.imageScale ?? "1" } as CSSProperties}
          >
            <img className="ending-story-image" src={story.image} alt={story.alt} />

            {story.moment === "flashback" && (
              <p className="ending-flashback-label" aria-hidden="true">그동안의 이야기</p>
            )}

            {dialogueVisible && (
              <figcaption
                key={`${story.id}-${lineIndex}`}
                className="ending-dialogue-panel"
                aria-live="polite"
              >
                <span className="ending-dialogue-speaker" title={speakerName}>{speakerName}</span>
                <span className="ending-dialogue-text">{dialogueLine.text}</span>
                {canAdvance && (
                  <span className="ending-dialogue-hint">클릭 / Enter / Space</span>
                )}
              </figcaption>
            )}
          </div>
        </figure>
      )}

      {scene === "end" && (
        <div className="ending-title-scene flex h-full items-center justify-center px-6">
          <p className="text-pixel-lg tracking-[0.35em] text-ember-500">THE END</p>
        </div>
      )}

      {scene === "credits" && (
        <div className="ending-credits-window mx-auto h-full max-w-2xl px-6 text-sand-200">
          <div
            className="ending-credits-roll space-y-24"
            style={{ animationDuration: `${CREDITS_DURATION}ms` }}
          >
            <section className="space-y-4">
              <p className="text-pixel-md tracking-widest text-ember-500">MONSTER RPG</p>
              <p className="text-pixel-sm text-earth-400">무한의 탑 이야기</p>
            </section>

            <section className="space-y-6">
              <div className="space-y-2">
                {CREDIT_ROLES.map((role) => (
                  <p key={role} className="text-pixel-sm tracking-widest text-earth-400">{role}</p>
                ))}
              </div>
              <p className="text-title-sm text-cream-100">건국대학교 컴퓨터공학과 졸업작품</p>
            </section>

            <section className="space-y-8">
              <div className="space-y-2">
                <p className="text-pixel-sm tracking-widest text-earth-400">CAST</p>
                <p className="text-pixel-sm text-sand-300">등장인물</p>
              </div>
              <div className="flex items-start justify-center gap-12">
                {ENDING_CAST.map((member) => (
                  <div key={member.name} className="space-y-3">
                    <img
                      src={member.portrait}
                      alt={member.name}
                      className="mx-auto h-32 w-32 object-contain"
                    />
                    <p className="text-pixel-sm text-earth-400">{member.title}</p>
                    <p className="text-title-sm text-cream-100">{member.name}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-8">
              <div className="space-y-2">
                <p className="text-pixel-sm tracking-widest text-earth-400">MUSIC</p>
                <p className="text-pixel-sm text-sand-300">음악</p>
              </div>
              <div className="mx-auto grid max-w-md gap-3">
                {CREDIT_TRACKS.map((track) => (
                  <div key={track.title} className="grid grid-cols-2 items-baseline gap-4">
                    <p className="text-pixel-sm text-right text-cream-100">「{track.title}」</p>
                    <p className="text-pixel-sm text-left text-earth-400">{track.where}</p>
                  </div>
                ))}
              </div>
            </section>

            {party.length > 0 && (
              <section className="space-y-8">
                <div className="space-y-2">
                  <p className="text-pixel-sm tracking-widest text-earth-400">YOUR PARTY</p>
                  <p className="text-pixel-sm text-sand-300">끝까지 함께 오른 동료</p>
                </div>
                <div className="flex items-end justify-center gap-10">
                  {party.map((m) => (
                    <div key={m.uid} className="space-y-3">
                      <img
                        src={MONSTER_IMAGE_MAP[m.id]}
                        alt={m.name}
                        className="mx-auto h-32 w-32 object-contain"
                      />
                      <p className="text-title-sm text-cream-100">{m.nickname || m.name}</p>
                      <p className="text-pixel-sm text-earth-400">Lv.{m.level}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="space-y-6">
              <p className="text-pixel-sm tracking-widest text-earth-400">PLAYED BY</p>
              <p className="text-title-sm text-cream-100">{playerDisplayName}</p>
              <div className="mx-auto grid max-w-md gap-3">
                {[
                  ["오른 층", `${bestFloor}층`],
                  ["만난 몬스터", `${dexCaught.length}종`],
                ].map(([label, value]) => (
                  <div key={label} className="grid grid-cols-2 items-baseline gap-4">
                    <p className="text-pixel-sm text-right text-earth-400">{label}</p>
                    <p className="text-pixel-sm text-left text-sand-300">{value}</p>
                  </div>
                ))}
              </div>
            </section>

            <p className="text-pixel-sm text-earth-400">— 끝 —</p>
          </div>
        </div>
      )}

      {scene === "thanks" && (
        <div className="ending-thanks-scene flex h-full items-center justify-center px-6">
          <p className="text-pixel-md tracking-[0.2em] text-cream-100">THANK YOU FOR PLAYING</p>
        </div>
      )}
    </main>
  );
}
