# Traveler atlas normalization

Run `python scripts/resize-player-sprite.py` (requires Pillow).

- Current immutable input: `art-src/player/player-traveler-current-original.png`, 1254×1254.
- Earlier source retained separately: `player-traveler-original.png`.
- Size reference: `public/assets/player/player1.png`, identical to the previous Git atlas, 320×320.
- Runtime output: `public/assets/player/player.png`, 320×320, 25 equal 64×64 cells.
- Measurements and source slicing rectangles: `resize-report.json`.

The artwork has uneven gutters: simply dividing 1254 by five cuts through
heads and boots in the middle rows. The script first looks for empty gutters.
When no straight gutter exists, as in the current input, it detects exactly 25
connected silhouettes and sorts them in their original row/column order. It fails
if it cannot identify exactly 25 silhouettes. Detection uses alpha >= 128; gutter
crops retain up to a two-source-pixel fringe, while connected-component crops use
tight bounding boxes so a neighboring head is not included below a boot. It does
not redraw, mirror, recolor, smooth, or modify the sampled pixels' alpha. Very
faint source noise outside those bounding boxes is not part of the extracted art.
The source already contains partial alpha; normalization does not create new
semi-transparent edge colors. Output RGBA values are a subset of source values
plus transparent black for the canvas.

All poses use the same nominal 0.2352941176 scale (23.53% of source linear size),
with integer output dimensions and Pillow `Image.Resampling.NEAREST`. Resulting
visible bounds at alpha >= 128 are 35–44px wide and 54–57px high. The old artwork
is 54–61px high, so the existing visual size takes precedence over a generic
65–75% frame-height target. The lower fifth of each silhouette anchors its feet
at x=32 (rounding error <=0.5px), with its bottom edge at y=61. Backpack size does
not determine the horizontal anchor.

Runtime code and atlas JSON are unchanged: scale=3, origin=(0.5,0.5), foot inset=3,
physics body=20×10 texture pixels (60×30 world pixels), offset=(22,51). The workshop
also retains its existing CSS display size, foot origin and collision geometry.
The existing atlas names use the first column as idle and columns 2–5 as walking;
all five original poses remain present. Row mapping remains S, SE, E, NE, N.

The traveler atlas is rendered in the basecamp/village and workshop. Forest UI
does not render this atlas; the tower's BattleScene renders party monsters.

## Current-source verification (2026-09-08)

The runtime PNG had been replaced with a different 1254×1254 traveler after the
earlier conversion. The current source is preserved separately and is now the
script's default. Existing `player1.png` and `player2.png` were left untouched.

- Unit tests: 50 passed (playerSprite, campCollision, workshopLayout).
- Actual browser tests: 8 passed (camp collision from 8 locations in 8 directions;
  camp, forest, workshop and tower battle captures; workshop walk animation,
  furniture collision and stage boundaries).
- Production build passed, with the existing large-chunk advisory.
- No visible source pixels (alpha >= 128) lie outside the 25 extraction boxes.
- Output RGBA values are a subset of source RGBA plus transparent canvas pixels.
- All 25 visible foot baselines equal 61; horizontal foot centers are within
  0.5 texture pixels of 32. Mean height is 55.88px versus the reference's 57.76px.
- No runtime TypeScript, atlas JSON, display scales or collision settings changed.

## Earlier-source verification (2026-09-08)

- `node --import tsx --test tests/playerSprite.test.ts tests/campCollision.test.ts tests/workshopLayout.test.ts`: 50 passed.
- `npm run build`: passed (existing large-chunk advisory).
- Playwright design capture/navigation selection: 23 passed, including camp
  collision from eight starting locations in eight directions, workshop walking
  frames, furniture collisions, stage bounds, forest and tower battle captures.
- Viewed the resulting camp and workshop screenshots: full traveler visible,
  backpack retained, and scale appropriate relative to the NPC, doorway and furniture.
- Checked all 25 frame foot baselines and confirmed output RGBA values are sampled
  exclusively from the source (plus transparent canvas pixels).
- Screenshots: `design/screenshots/current/{basecamp,workshop,forest,battle}.png`
  (generated artifacts, ignored by Git).
