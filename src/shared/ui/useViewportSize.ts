import { useEffect, useState } from "react";

/** 창 크기. 리사이즈 때만 다시 그린다 — 걸어 다니는 동안은 아무 일도 안 일어난다. */
export function useViewportSize() {
  const [size, setSize] = useState(() => ({
    w: typeof window === "undefined" ? 0 : window.innerWidth,
    h: typeof window === "undefined" ? 0 : window.innerHeight,
  }));

  useEffect(() => {
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return size;
}
