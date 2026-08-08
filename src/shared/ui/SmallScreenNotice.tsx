import { useEffect, useState } from "react";

/**
 * 이 게임은 키보드(WASD/방향키/스페이스)로만 조작한다. 터치 입력 경로가 없어서
 * 좁은 화면에서는 화면이 들어가도 플레이가 불가능하다. 억지로 욱여넣는 대신
 * 안내를 띄우고 막는다.
 *
 * 태블릿 세로(768)까지는 지원한다. 창을 늘리면 바로 사라진다.
 */
const MIN_WIDTH = 768;
const MIN_HEIGHT = 480;

function tooSmall() {
  if (typeof window === "undefined") return false;
  return window.innerWidth < MIN_WIDTH || window.innerHeight < MIN_HEIGHT;
}

export function SmallScreenNotice() {
  const [blocked, setBlocked] = useState(tooSmall);

  useEffect(() => {
    const onResize = () => setBlocked(tooSmall());
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, []);

  if (!blocked) return null;

  return (
    <div className="fixed inset-0 z-[4000] flex flex-col items-center justify-center gap-5
      bg-shadow-900 px-8 text-center">
      <p className="text-pixel-md">🖥️</p>
      <p className="text-title-sm font-black text-cream-100">
        화면이 작아 플레이할 수 없습니다
      </p>
      <p className="max-w-sm text-pixel-sm leading-relaxed text-sand-300">
        이 게임은 키보드로 조작합니다.<br />
        가로 {MIN_WIDTH}px 이상인 데스크탑이나 태블릿에서 열어주세요.
      </p>
      <p className="text-pixel-sm text-earth-400">
        WASD / 방향키 이동 · SPACE 상호작용
      </p>
    </div>
  );
}
