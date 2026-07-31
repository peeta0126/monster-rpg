import { useNavigate } from "react-router-dom";

export default function EndingPage() {
  const navigate = useNavigate();

  return (
    <div
      className="fixed inset-0 z-[1000] flex flex-col items-center justify-center gap-10 bg-black px-6 text-center"
      style={{ fontFamily: "'Press Start 2P', monospace" }}
    >
      <div className="max-w-md space-y-5 text-xs leading-loose text-zinc-300">
        <p>오리온: …이게 뭐냐.</p>
        <p>오리온: 만물의 정수라니. 이런 게 정말 있었구나.</p>
        <p>오리온: 달여 마시게 해드리마. …기다려보자.</p>
        <p className="text-zinc-600">(며칠 후)</p>
        <p>오리온: 열이 내렸다. 정말로 내렸어.</p>
        <p>오리온: …고맙다. 네가 해냈다.</p>
        <p>오리온: 탑 위에 뭐가 있었는지, 이제 이 마을도 알게 됐구나.</p>
        <p>오리온: 어머니는 나을 게다. 이제 정말로.</p>
      </div>

      <p className="text-2xl tracking-widest text-amber-200">THE END</p>

      <button
        onClick={() => navigate("/")}
        className="rounded-lg border border-zinc-700 px-6 py-3 text-xs text-zinc-400 transition hover:bg-zinc-900"
      >
        &gt; 베이스캠프로 돌아가기
      </button>
    </div>
  );
}
