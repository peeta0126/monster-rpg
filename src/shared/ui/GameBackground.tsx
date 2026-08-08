import { BASECAMP_BACKGROUND_IMAGE } from "../assetPaths";

/**
 * 화면 뒤에 까는 배경 레이어. 순수 검정 대신 이걸 쓴다.
 *
 * 3층 구조다.
 *  1. shadow-900 → shadow-700 세로 그라디언트 (이미지가 뜨기 전에도 검정이 아니도록)
 *  2. 베이스캠프 배경을 blur + 어둡게 깔아 질감을 준다. 새 에셋을 만들지 않고,
 *     베이스캠프에서 이미 캐시된 이미지를 재활용한다 — 이 화면들은 전부 베이스캠프를
 *     거쳐서 들어오므로 실제로는 추가 다운로드가 없다.
 *  3. 비네트로 가장자리를 눌러 가운데 콘텐츠로 시선을 모은다.
 */
export function GameBackground({ tint }: { tint?: string }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className="absolute inset-0 bg-linear-to-b from-shadow-900 via-shadow-700 to-shadow-900" />
      <img
        src={BASECAMP_BACKGROUND_IMAGE}
        alt=""
        className="absolute inset-0 h-full w-full object-cover opacity-25"
        style={{ filter: "blur(10px) brightness(0.3) saturate(0.75)" }}
      />
      {tint && <div className="absolute inset-0" style={{ background: tint }} />}
      <div
        className="absolute inset-0"
        style={{ background: "radial-gradient(ellipse at 50% 40%, transparent 35%, rgba(13,18,35,0.85) 100%)" }}
      />
    </div>
  );
}
