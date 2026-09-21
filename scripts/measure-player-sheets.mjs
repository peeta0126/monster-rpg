/**
 * 플레이어 시트에서 "한 칸 크기"와 "발이 닿는 줄"을 다시 잰다.
 *
 * 실행: `node scripts/measure-player-sheets.mjs`
 * 출력은 `src/shared/playerSprite.ts` 의 `PLAYER_SHEET_METRICS` 에 그대로 넣는 꼴이다.
 *
 * 원화를 갈아끼웠으면 이걸 돌려 표를 고쳐라. 안 고치면 캐릭터가 공중에 뜨고,
 * 방향을 바꿀 때마다 판정 바디가 위아래로 튄다. `tests/playerSprite.test.ts` 가 잡는다.
 */
import sharp from "sharp";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../public/assets/player");
const FRAMES = 6;
export const SHEETS = [
  ["south", "south.webp"], ["southeast", "southeast.webp"], ["east", "east.webp"],
  ["northeast", "northeast.webp"], ["north", "north.webp"],
];

/**
 * 한 칸 안에서 불투명한 픽셀이 마지막으로 나오는 줄. 그게 신발 바닥이다.
 *
 * 칸 폭은 시트 폭을 여섯으로 나눈 **몫**이다. Phaser 도 DOM 도 소수점 칸은 못 쓰고,
 * 남는 몇 px 은 칸마다 20px 넘게 있는 투명 여백으로 들어가서 그림에는 안 닿는다.
 */
export async function measureSheet(file) {
  const img = sharp(path.join(ROOT, file));
  const { width, height } = await img.metadata();
  const { data } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const cell = Math.floor(width / FRAMES);
  const bottoms = [];
  for (let i = 0; i < FRAMES; i++) {
    const x0 = i * cell, x1 = (i + 1) * cell;
    let bottom = -1;
    for (let y = height - 1; y >= 0 && bottom < 0; y--) {
      for (let x = x0; x < x1; x++) {
        if (data[(y * width + x) * 4 + 3] > 16) { bottom = y; break; }
      }
    }
    bottoms.push(bottom);
  }
  return { frameWidth: cell, frameHeight: height, bottoms };
}

if (import.meta.filename === process.argv[1]) {
  for (const [dir, file] of SHEETS) {
    const m = await measureSheet(file);
    console.log(
      `  ${dir.padEnd(9)} { frameWidth: ${m.frameWidth}, frameHeight: ${m.frameHeight}, footY: ${m.bottoms[0]} },`
      + `   // ${file}, 걷는 동안 ${Math.min(...m.bottoms)}~${Math.max(...m.bottoms)}`,
    );
  }
}
