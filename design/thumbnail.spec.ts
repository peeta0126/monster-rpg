import { test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * 제출용 16:9 썸네일을 만든다 (1920x1080).
 *
 * 게임을 새로 띄워 찍지 않고 `design/screenshots/current` 의 캡처를 조합한다.
 * 그 캡처들은 이미 검토를 통과한 화면이라, 썸네일이 실제 화면과 어긋날 일이 없다.
 * 캡처가 없으면 `npm run design:shot` 을 먼저 돌려야 한다.
 *
 *   npm run submission:thumb
 *
 * 결과: public/thumbnail.png (배포되는 화면의 OG 이미지도 겸한다)
 *
 * 원본 캡처는 1440x900 이고 전투 캔버스는 그 안에서 좌우에 띠를 두고 앉아 있다.
 * 그대로 늘리면 띠까지 같이 커져 위아래가 비므로, 캔버스만 잘라 쓴다(HERO_* 상수).
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = path.join(HERE, "screenshots", "current");
const OUT = path.join(HERE, "..", "public", "thumbnail.png");
const FONTS = path.join(HERE, "..", "public", "assets", "fonts");

// docs/ART_DIRECTION.md 1-2 표의 값. 여기는 src/ 밖이라 토큰을 못 읽어 값을 적는다.
const SHADOW_900 = "#0D1223";
const SHADOW_700 = "#1E354A";
const CREAM_100 = "#F3E5B9";
const SAND_300 = "#CDB27E";
const EMBER_500 = "#E99441";
const EARTH_500 = "#844B3F";

/** 전투 캔버스에서 몬스터 둘이 다 들어오는 구간 (원본 1440x900 기준) */
const HERO_SCALE = 2560 / 1440;
const HERO_LEFT = Math.round(-180 * HERO_SCALE);
const HERO_TOP = Math.round(-150 * HERO_SCALE);

function dataUri(file: string, mime: string): string {
  return `data:${mime};base64,${fs.readFileSync(file).toString("base64")}`;
}

function shot(name: string): string {
  const file = path.join(SHOTS, name);
  if (!fs.existsSync(file)) {
    throw new Error(`캡처가 없습니다: ${file}\n먼저 npm run design:shot 을 돌리세요.`);
  }
  return dataUri(file, "image/png");
}

test("submission: 16:9 썸네일", async ({ page }) => {
  const hero = shot("battle.png");
  const tiles = [
    { src: shot("basecamp.png"), label: "베이스캠프" },
    { src: shot("forest-deep.png"), label: "숲 탐험" },
    { src: shot("workshop.png"), label: "공방 제작" },
  ];

  const regular = dataUri(path.join(FONTS, "Galmuri11.woff2"), "font/woff2");
  const bold = dataUri(path.join(FONTS, "Galmuri11-Bold.woff2"), "font/woff2");

  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.setContent(`
    <style>
      @font-face { font-family: Galmuri; src: url(${regular}) format("woff2"); font-weight: 400; }
      @font-face { font-family: Galmuri; src: url(${bold}) format("woff2"); font-weight: 700; }
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body {
        width: 1920px; height: 1080px; overflow: hidden;
        background: ${SHADOW_900};
        font-family: Galmuri, monospace;
        color: ${CREAM_100};
        display: flex; flex-direction: column;
      }

      .hero { position: relative; height: 680px; overflow: hidden; }
      .hero img {
        position: absolute; width: 2560px;
        left: ${HERO_LEFT}px; top: ${HERO_TOP}px;
      }
      .veil {
        position: absolute; inset: 0;
        background:
          linear-gradient(to top, ${SHADOW_900} 1%, rgba(13,18,35,0.25) 34%, rgba(13,18,35,0) 62%),
          radial-gradient(120% 95% at 50% 42%, rgba(13,18,35,0) 44%, rgba(13,18,35,0.78) 100%);
      }
      .badge {
        position: absolute; right: 64px; top: 56px;
        border: 2px solid ${EMBER_500}; border-radius: 6px;
        padding: 10px 20px; font-size: 24px; color: ${EMBER_500};
        background: rgba(13,18,35,0.72);
      }

      .foot { flex: 1; display: flex; gap: 40px; padding: 0 64px 52px; align-items: flex-end; }

      .brand { width: 620px; flex: none; }
      .brand h1 { font-size: 72px; font-weight: 700; letter-spacing: 2px; line-height: 1.05; }
      .brand .kr { font-size: 36px; color: ${EMBER_500}; margin-top: 20px; }
      .brand .sub { font-size: 24px; color: ${SAND_300}; margin-top: 14px; line-height: 1.5; }

      .strip { flex: 1; display: flex; gap: 24px; }
      .tile { flex: 1; }
      .tile .frame {
        aspect-ratio: 16 / 9; overflow: hidden; position: relative;
        border: 2px solid ${EARTH_500}; border-radius: 6px; background: ${SHADOW_700};
      }
      .tile img { position: absolute; width: 100%; top: -8%; }
      .tile .label { font-size: 24px; color: ${SAND_300}; margin-top: 14px; text-align: center; }
    </style>

    <div class="hero">
      <img src="${hero}" />
      <div class="veil"></div>
      <div class="badge">브라우저에서 바로 플레이</div>
    </div>

    <div class="foot">
      <div class="brand">
        <h1>VOYAGER<br />ATELIER</h1>
        <div class="kr">모으고 · 캐고 · 만들어 · 오른다</div>
        <div class="sub">50층 탑을 오르는 몬스터 수집 RPG</div>
      </div>
      <div class="strip">
        ${tiles
          .map(
            (t) =>
              `<div class="tile"><div class="frame"><img src="${t.src}" /></div><div class="label">${t.label}</div></div>`,
          )
          .join("")}
      </div>
    </div>
  `);

  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: OUT, clip: { x: 0, y: 0, width: 1920, height: 1080 } });
  console.log(`썸네일: ${OUT} (${(fs.statSync(OUT).size / 1024).toFixed(0)}KB)`);
});
