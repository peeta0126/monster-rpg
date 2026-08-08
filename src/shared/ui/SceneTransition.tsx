import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

/**
 * 라우트 전환 커버.
 *
 * 화면 전체를 덮는 한 장을 두고 불투명도만 조절한다. 이전 화면과 다음 화면이 겹쳐
 * 보이지 않는 건 라우터가 한 번에 하나만 렌더하기 때문이고, 여기서는 "바뀌는 순간"을
 * 가려 준다.
 *
 * Phaser 화면은 캔버스가 만들어지는 동안 검은 프레임이 한 번 번쩍인다.
 * 그래서 커버를 걷기 전에 window.__PHASER_READY__ 를 기다린다.
 */

const OUT_MS = 180;
const IN_MS = 200;
/** 씬이 영영 준비되지 않아도 화면이 잠기면 안 된다 */
const READY_TIMEOUT_MS = 2500;

/** Phaser 캔버스를 만드는 경로 */
const CANVAS_ROUTES = new Set(["/", "/battle"]);

type Phase = "idle" | "covering" | "uncovering";

function prefersReducedMotion() {
  return typeof window !== "undefined"
    && (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);
}

export function SceneTransition() {
  const { pathname } = useLocation();
  const [phase, setPhase] = useState<Phase>("idle");
  const [flash, setFlash] = useState(false);
  const [seenPath, setSeenPath] = useState(pathname);

  // 경로가 바뀌면 렌더 중에 상태를 맞춘다. effect 로 하면 한 프레임 늦어서
  // 커버가 씌워지기 전에 다음 화면이 먼저 보인다.
  if (seenPath !== pathname) {
    setSeenPath(pathname);
    if (!prefersReducedMotion()) {
      setPhase("covering");
      setFlash(pathname === "/battle");   // 전투 진입만 조금 강하게 (JRPG 관례)
    }
  }

  useEffect(() => {
    if (phase !== "covering") return;
    let cancelled = false;

    (async () => {
      await new Promise((r) => setTimeout(r, OUT_MS));
      if (CANVAS_ROUTES.has(pathname)) {
        const deadline = Date.now() + READY_TIMEOUT_MS;
        while (!window.__PHASER_READY__ && Date.now() < deadline) {
          await new Promise((r) => setTimeout(r, 40));
        }
      }
      if (!cancelled) setPhase("uncovering");
    })();

    return () => { cancelled = true; };
  }, [phase, pathname]);

  useEffect(() => {
    if (phase !== "uncovering") return;
    const t = setTimeout(() => { setPhase("idle"); setFlash(false); }, IN_MS);
    return () => clearTimeout(t);
  }, [phase]);

  if (phase === "idle") return null;

  const covered = phase === "covering";
  return (
    <div
      className="pointer-events-none fixed inset-0 z-[3500]"
      style={{
        background: flash ? "var(--color-ember-700)" : "var(--color-shadow-900)",
        opacity: covered ? 1 : 0,
        transition: `opacity ${covered ? OUT_MS : IN_MS}ms ease-${covered ? "in" : "out"}`,
      }}
      aria-hidden
      data-testid="scene-transition"
    />
  );
}
