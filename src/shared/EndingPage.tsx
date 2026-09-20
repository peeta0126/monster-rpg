import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../auth/authStore";
import { usePlayerStore } from "./playerStore";
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
 * 이 게임이 어떤 게임인지 설명하는 자리가 아니다 — 그건 방금 다섯 시간 동안 본 사람이
 * 제일 잘 안다. 여기 적는 건 **어떻게 만들어졌는가**다. 무엇을 손으로 세었고, 무엇을
 * 일부러 안 했고, 어디서 한 번 무너졌는지.
 *
 * 그래서 수치는 규모 자랑이 아니라 품으로만 적는다("속성 여덟" X, "예순네 칸을 손으로" O).
 * 표를 늘렸으면 여기 숫자도 같이 고칠 것.
 */
interface EndingCreditsSection {
  title: string;
  subtitle?: string;
  lines: string[];
}

const ENDING_CREDITS: EndingCreditsSection[] = [
  {
    title: "기획 · 개발",
    lines: ["건국대학교 컴퓨터공학과 졸업작품"],
  },
  {
    title: "STORY",
    subtitle: "스토리",
    lines: [
      "삼백 줄 남짓의 대사를 한 줄씩 썼습니다",
      "이장 오리온과 탑의 문지기 바로스는",
      "같은 일을 끝까지 서로 다르게 말하도록 말투를 따로 두었습니다",
      "아홉 개의 부탁이 탑을 오르는 속도를 잡습니다",
    ],
  },
  {
    title: "BATTLE",
    subtitle: "전투",
    lines: [
      "속성 상성 예순네 칸을 손으로 채웠습니다",
      "약점이 겹치면 한 속성이 계열을 통째로 지워 버려서",
      "두 속성을 가진 몬스터는 셋만 남겼습니다",
      "층마다 승률을 재고 다시 맞추기를 반복했습니다",
    ],
  },
  {
    title: "MONSTERS",
    subtitle: "몬스터",
    lines: [
      "스물여섯 마리를 그리고 진화로 이었습니다",
      "서른일곱 가지 기술을 누가 언제 배우는지 표에 적었습니다",
      "레벨로 밀어붙이는 길은 일부러 막아 두었습니다",
    ],
  },
  {
    title: "CRAFTING",
    subtitle: "제작",
    lines: [
      "모으고, 만들고, 강화하고, 다시 부수는 고리를 짰습니다",
      "제작대마다 다른 미니게임을 붙였습니다",
      "마지막 한 병에만 레시피를 주지 않았습니다",
    ],
  },
  {
    title: "PIXEL WORLD",
    subtitle: "픽셀 월드",
    lines: [
      "걸어 다니는 두 무대의 테두리를 선분 쉰한 줄로 둘렀습니다",
      "한 줄만 열려도 사람은 지붕 위로 걸어 나갑니다",
      "실제로 한 번 나갔고, 그 틈은 12픽셀이었습니다",
    ],
  },
  {
    title: "INTERFACE",
    subtitle: "인터페이스",
    lines: [
      "픽셀 폰트가 깨지지 않도록 글자를 열두 배수에만 놓았습니다",
      "색은 한 벌의 표에서만 꺼내 썼습니다",
      "창이 넓어지면 글자가 아니라 칸이 늘어납니다",
    ],
  },
  {
    title: "MUSIC",
    subtitle: "음악",
    lines: [
      "「탑의 문 앞에서」 — 타이틀, 그리고 이 엔딩",
      "「돌아올 곳」 — 베이스캠프",
      "「잎사귀 사이로」 — 숲",
      "「모루와 불씨」 — 제작 공방",
      "「한 층 더」 — 탑의 전투",
      "「문 너머의 것」 — 보스",
    ],
  },
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
    const sources = [...new Set(ENDING_STORY_SCENES.map((storyScene) => storyScene.image))];
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
            className="ending-credits-roll space-y-16"
            style={{ animationDuration: `${CREDITS_DURATION}ms` }}
          >
            <section className="space-y-5">
              <p className="text-pixel-md tracking-widest text-ember-500">MONSTER RPG</p>
              <p className="text-pixel-sm text-earth-400">무한의 탑 이야기</p>
            </section>
            {ENDING_CREDITS.map((section) => (
              <section key={section.title} className="space-y-4">
                <p className="text-title-sm text-sand-300">{section.title}</p>
                {section.subtitle && (
                  <p className="text-pixel-sm text-earth-400">{section.subtitle}</p>
                )}
                <div className="space-y-2">
                  {section.lines.map((line) => (
                    <p key={line} className="text-pixel-sm leading-relaxed">{line}</p>
                  ))}
                </div>
              </section>
            ))}
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
