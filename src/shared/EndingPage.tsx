import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePlayerStore } from "./playerStore";
import { useBgm, BGM } from "./audio";

type EndingScene = "black" | "end" | "credits" | "thanks";

export default function EndingPage() {
  useBgm(BGM.title);

  const navigate = useNavigate();
  const setStoryFlag = usePlayerStore((s) => s.setStoryFlag);
  const [scene, setScene] = useState<EndingScene>("black");

  // 이 페이지는 라우트 가드를 통과한 최종 퀘스트 완료자(또는 다시보기)만 마운트된다.
  useEffect(() => { setStoryFlag("tower_cleared"); }, [setStoryFlag]);

  useEffect(() => {
    const timers = [
      window.setTimeout(() => setScene("end"), 900),
      window.setTimeout(() => setScene("credits"), 4500),
      window.setTimeout(() => setScene("thanks"), 15500),
      window.setTimeout(() => navigate("/", { replace: true }), 19900),
    ];
    return () => timers.forEach(window.clearTimeout);
  }, [navigate]);

  return (
    <div
      className="fixed inset-0 z-[1000] overflow-hidden bg-shadow-900 px-6 text-center"
      style={{ fontFamily: "var(--font-title)" }}
      data-testid={`ending-scene-${scene}`}
    >
      {scene === "end" && (
        <div className="ending-title-scene flex h-full items-center justify-center">
          <p className="text-pixel-lg tracking-[0.35em] text-ember-500">THE END</p>
        </div>
      )}

      {scene === "credits" && (
        <div className="ending-credits-window mx-auto h-full max-w-2xl text-sand-200">
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
        <div className="ending-thanks-scene flex h-full items-center justify-center">
          <p className="text-pixel-md tracking-[0.2em] text-cream-100">THANK YOU FOR PLAYING</p>
        </div>
      )}
    </div>
  );
}
