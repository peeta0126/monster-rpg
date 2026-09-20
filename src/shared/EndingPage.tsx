import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePlayerStore } from "./playerStore";
import { useBgm, BGM } from "./audio";

type EndingScene = "black" | "story" | "end" | "credits" | "thanks";

interface EndingStorySlide {
  image: string;
  text: string;
  position?: string;
}

const ENDING_STORY_SLIDES: EndingStorySlide[] = [
  {
    image: "/assets/ending/스토리 1장.png",
    position: "center center",
    text: "평화롭던 어느 날,\n어머니가 원인을 알 수 없는 병으로 쓰러졌다.",
  },
  {
    image: "/assets/ending/스토리 2장.png",
    position: "center center",
    text: "어머니를 구하기 위해 길을 나섰고,\n오리온은 내게 첫 동료 플레미를 맡겼다.",
  },
  {
    image: "/assets/ending/스토리 3장.png",
    position: "center center",
    text: "숲을 누비며 재료를 모으고,\n함께 싸우며 우리는 조금씩 서로를 믿게 되었다.",
  },
  {
    image: "/assets/ending/스토리 4장.png",
    position: "center center",
    text: "새로운 동료들과 수많은 전투를 넘어,\n우리는 마침내 무한의 탑 깊은 곳까지 도달했다.",
  },
  {
    image: "/assets/ending/스토리 5장.png",
    position: "center center",
    text: "그리고 긴 여정 끝에 얻은 치료약은,\n마침내 어머니에게 닿았다.",
  },
];

const STORY_SCENE_DURATION = 4700;
const OPENING_BLACK_DURATION = 1000;
const STORY_OUTRO_DURATION = 2800;
const END_TITLE_DURATION = 3000;
const CREDITS_DURATION = 10500;
const THANKS_DURATION = 4000;

export default function EndingPage() {
  useBgm(BGM.title);

  const navigate = useNavigate();
  const setStoryFlag = usePlayerStore((s) => s.setStoryFlag);
  const [scene, setScene] = useState<EndingScene>("black");
  const [storyIndex, setStoryIndex] = useState(0);

  // 이 페이지는 라우트 가드를 통과한 최종 퀘스트 완료자(또는 다시보기)만 마운트된다.
  useEffect(() => { setStoryFlag("tower_cleared"); }, [setStoryFlag]);

  // 첫 컷을 보여주기 전에 모든 이미지를 받아 두어 장면 사이의 검은 깜빡임을 막는다.
  useEffect(() => {
    let cancelled = false;
    const images = ENDING_STORY_SLIDES.map(() => new Image());
    const preload = images.map(
      (image, index) =>
        new Promise<void>((resolve) => {
          image.onload = () => resolve();
          image.onerror = () => resolve();
          image.src = ENDING_STORY_SLIDES[index].image;
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

  const advanceStory = useCallback(() => {
    setStoryIndex((current) => {
      if (current < ENDING_STORY_SLIDES.length - 1) return current + 1;
      return ENDING_STORY_SLIDES.length;
    });
  }, []);

  useEffect(() => {
    if (scene !== "story") return;
    const timer = window.setTimeout(
      storyIndex < ENDING_STORY_SLIDES.length ? advanceStory : () => setScene("end"),
      storyIndex < ENDING_STORY_SLIDES.length ? STORY_SCENE_DURATION : STORY_OUTRO_DURATION,
    );
    return () => window.clearTimeout(timer);
  }, [advanceStory, scene, storyIndex]);

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

  useEffect(() => {
    if (scene !== "story" || storyIndex >= ENDING_STORY_SLIDES.length) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space" && event.code !== "Enter") return;
      event.preventDefault();
      advanceStory();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [advanceStory, scene]);

  const isStoryOutro = scene === "story" && storyIndex >= ENDING_STORY_SLIDES.length;
  const visibleStoryIndex = Math.min(storyIndex, ENDING_STORY_SLIDES.length - 1);
  const story = ENDING_STORY_SLIDES[visibleStoryIndex];

  return (
    <div
      className={`fixed inset-0 z-[1000] overflow-hidden bg-shadow-900 text-center ${scene === "story" && !isStoryOutro ? "cursor-pointer" : ""}`}
      style={{ fontFamily: "var(--font-title)" }}
      data-testid={`ending-scene-${scene}`}
      data-story-index={scene === "story" ? visibleStoryIndex : undefined}
      onClick={scene === "story" && !isStoryOutro ? advanceStory : undefined}
    >
      {scene === "story" && (
        <figure
          className={`ending-story-scene ${visibleStoryIndex === ENDING_STORY_SLIDES.length - 1 ? "ending-story-final" : ""} ${isStoryOutro ? "ending-story-outro" : ""}`}
        >
          {ENDING_STORY_SLIDES.map((storySlide, index) => (
            <img
              key={storySlide.image}
              className={`ending-story-image ${index === visibleStoryIndex ? "ending-story-image-active" : ""}`}
              src={storySlide.image}
              alt={index === visibleStoryIndex ? storySlide.text.replace("\n", " ") : ""}
              aria-hidden={index !== visibleStoryIndex}
              style={{ objectPosition: storySlide.position }}
            />
          ))}
          <figcaption key={story.text} className="ending-story-narration" aria-live="polite">
            {story.text}
          </figcaption>
          {isStoryOutro && <span className="ending-story-blackout" aria-hidden="true" />}
        </figure>
      )}

      {scene === "end" && (
        <div className="ending-title-scene flex h-full items-center justify-center px-6">
          <p className="text-pixel-lg tracking-[0.35em] text-ember-500">THE END</p>
        </div>
      )}

      {scene === "credits" && (
        <div className="ending-credits-window mx-auto h-full max-w-2xl px-6 text-sand-200">
          <div className="ending-credits-roll space-y-16">
            <section className="space-y-5">
              <p className="text-pixel-md tracking-widest text-ember-500">MONSTER RPG</p>
              <p className="text-pixel-sm text-earth-400">무한의 탑 이야기</p>
            </section>
            <section className="space-y-4">
              <p className="text-title-sm text-sand-300">기획 · 개발</p>
              <p className="text-pixel-sm">건국대학교 소프트웨어학과 졸업작품</p>
            </section>
            <section className="space-y-4">
              <p className="text-title-sm text-sand-300">GAME DESIGN</p>
              <p className="text-pixel-sm">스토리 · 전투 · 몬스터 · 제작</p>
            </section>
            <section className="space-y-4">
              <p className="text-title-sm text-sand-300">ART &amp; SOUND</p>
              <p className="text-pixel-sm">픽셀 월드 · 인터페이스 · 음악</p>
            </section>
            <section className="space-y-4">
              <p className="text-title-sm text-sand-300">SPECIAL THANKS</p>
              <p className="text-pixel-sm">탑의 끝까지 함께해 주신 모든 분께</p>
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
    </div>
  );
}
