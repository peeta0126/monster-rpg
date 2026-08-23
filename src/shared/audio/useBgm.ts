import { useEffect } from "react";
import { playBgm } from "./soundManager";
import type { BgmKey } from "./keys";

/**
 * 이 화면에서 흐를 곡.
 *
 * **화면이 사라질 때 멈추지 않는다.** 다음 화면이 자기 곡을 걸면 그때 넘어간다 —
 * 떠날 때 끄면 화면을 옮길 때마다 정적이 한 번씩 생기고, 마을 ↔ 가방처럼 같은
 * 곡을 쓰는 사이에서는 곡이 처음으로 되감긴다.
 *
 * 같은 키로 다시 불려도 안전하다(soundManager 가 무시한다). 그래서 층이 바뀌어
 * 전투 화면이 통째로 다시 마운트돼도 전투곡은 이어진다.
 */
export function useBgm(key: BgmKey): void {
  useEffect(() => { playBgm(key); }, [key]);
}
