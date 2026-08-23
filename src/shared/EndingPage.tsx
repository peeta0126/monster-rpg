import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { usePlayerStore } from "./playerStore";
import { useBgm, BGM } from "./audio";

export default function EndingPage() {
  useBgm(BGM.title);

  const navigate = useNavigate();
  const setStoryFlag = usePlayerStore((s) => s.setStoryFlag);

  // 엔딩에 도달했다는 사실을 세이브에 남긴다.
  // bestFloor >= 50(floor_50)은 "오름을 이겼다"까지만 알려주고 엔딩을 봤는지는 구분하지 못한다.
  useEffect(() => { setStoryFlag("tower_cleared"); }, [setStoryFlag]);

  return (
    <div
      className="fixed inset-0 z-[1000] flex flex-col items-center justify-center gap-10 bg-shadow-900 px-6 text-center"
      style={{ fontFamily: "var(--font-title)" }}
    >
      <div className="max-w-md space-y-5 text-pixel-sm leading-loose text-sand-200">
        <p>오리온: …이게 뭐냐.</p>
        <p>오리온: 만물의 정수라니. 이런 게 정말 있었구나.</p>
        <p>오리온: 달여 마시게 해드리마. …기다려보자.</p>
        <p className="text-earth-400">(며칠 후)</p>
        <p>오리온: 열이 내렸다. 정말로 내렸어.</p>
        <p>오리온: …고맙다. 네가 해냈다.</p>
        <p>오리온: 탑 위에 뭐가 있었는지, 이제 이 마을도 알게 됐구나.</p>
        <p>오리온: 어머니는 나을 게다. 이제 정말로.</p>
      </div>

      <p className="text-pixel-md tracking-widest text-ember-500">THE END</p>

      <button
        onClick={() => navigate("/")}
        className="rounded-lg border border-stone-600 px-6 py-3 text-pixel-sm text-sand-300 transition hover:bg-shadow-800"
      >
        &gt; 베이스캠프로 돌아가기
      </button>
    </div>
  );
}
