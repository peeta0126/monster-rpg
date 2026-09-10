"""Normalize the supplied traveler without redrawing, recoloring or changing poses.

Requires Pillow. Run from any directory: python scripts/resize-player-sprite.py
The source is immutable; output retains the existing 64px, 5x5 atlas contract.
"""
import argparse
import json
from pathlib import Path
from statistics import median

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]


def silhouette(image):
    # Detection only: do not threshold or otherwise modify output alpha/colors.
    return image.getchannel("A").point(lambda alpha: 255 if alpha >= 128 else 0)


def seams(image, axis):
    """Find empty gutters near nominal fifths (the supplied 1254px art is uneven)."""
    mask = silhouette(image)
    length = image.size[axis]
    edges = [0]
    for index in range(1, 5):
        nominal = round(length * index / 5)
        radius = round(length / 5 * .16)
        candidates = []
        for pos in range(nominal - radius, nominal + radius + 1):
            box = (pos, 0, pos + 1, image.height) if axis == 0 else (0, pos, image.width, pos + 1)
            if mask.crop(box).getbbox() is None:
                candidates.append(pos)
        if not candidates:
            raise ValueError(f"No transparent gutter for axis {axis}, division {index}")
        # Center the nearest contiguous empty run, keeping both neighboring poses whole.
        groups = []
        for pos in candidates:
            if not groups or pos != groups[-1][-1] + 1:
                groups.append([])
            groups[-1].append(pos)
        group = min(groups, key=lambda values: abs(median(values) - nominal))
        edges.append(round(median(group)))
    return edges + [length]


def component_cells(image):
    """Fallback for staggered boots/heads with no straight transparent gutter."""
    width, height = image.size
    mask = bytearray(1 if value >= 128 else 0 for value in image.getchannel("A").getdata())
    components = []
    for start in range(width * height):
        if not mask[start]:
            continue
        stack = [start]
        mask[start] = 0
        count = 0
        left, top, right, bottom = width, height, 0, 0
        while stack:
            pos = stack.pop()
            x, y = pos % width, pos // width
            count += 1
            left, top = min(left, x), min(top, y)
            right, bottom = max(right, x+1), max(bottom, y+1)
            for nx, ny in ((x-1, y), (x+1, y), (x, y-1), (x, y+1)):
                if 0 <= nx < width and 0 <= ny < height and mask[ny*width+nx]:
                    mask[ny*width+nx] = 0
                    stack.append(ny*width+nx)
        if count > width * height / 25 * .02:
            components.append((left, top, right, bottom))
    if len(components) != 25:
        raise ValueError(f"Expected 25 separate silhouettes, found {len(components)}")
    components.sort(key=lambda box: (box[1]+box[3])/2)
    ordered = []
    for row in range(5):
        ordered.extend(sorted(components[row*5:row*5+5], key=lambda box: box[0]))
    # Tight boxes prevent a neighboring head entering a boot's fringe.
    return ordered


def convert(source, reference, output, report_path):
    if source.resolve() == output.resolve():
        raise ValueError("Source and output must differ; preserve the original")
    image = Image.open(source).convert("RGBA")
    old = Image.open(reference).convert("RGBA")
    if old.size != (320, 320):
        raise ValueError("Reference must match the existing 320x320 atlas")
    old_heights = []
    for row in range(5):
        for col in range(5):
            bounds = silhouette(old.crop((col*64, row*64, col*64+64, row*64+64))).getbbox()
            if bounds is None:
                raise ValueError("Empty reference frame")
            old_heights.append(bounds[3] - bounds[1])
    frames = []
    source_cells = []
    try:
        ys = seams(image, 1)
        for row in range(5):
            strip = image.crop((0, ys[row], image.width, ys[row+1]))
            xs = seams(strip, 0)
            for col in range(5):
                source_cells.append([xs[col], ys[row], xs[col+1], ys[row+1]])
        extraction = "transparent gutters"
    except ValueError:
        source_cells = component_cells(image)
        extraction = "25 connected silhouettes in original row/column order"
    for source_cell in source_cells:
        cell = image.crop(source_cell)
        bounds = silhouette(cell).getbbox()
        if bounds is None:
            raise ValueError(f"Empty source frame {source_cell}")
        # Retain edge alpha within the source cell, with up to a two-pixel fringe.
        left, top, right, bottom = bounds
        crop = (max(0, left-2), max(0, top-2), min(cell.width, right+2), min(cell.height, bottom+2))
        frames.append(cell.crop(crop))
    boxes = [silhouette(frame).getbbox() for frame in frames]
    target_height = min(median(old_heights), 58)
    scale = min(target_height / max(b[3]-b[1] for b in boxes), 44 / max(b[2]-b[0] for b in boxes))
    result = Image.new("RGBA", (320, 320), (0, 0, 0, 0))
    metrics = []
    for index, frame in enumerate(frames):
        resized = frame.resize((round(frame.width*scale), round(frame.height*scale)), Image.Resampling.NEAREST)
        mask = silhouette(resized)
        left, top, right, bottom = mask.getbbox()
        # The lower fifth contains boots/legs, excluding the backpack and head.
        foot_top = bottom - max(1, round((bottom-top)*.20))
        foot = mask.crop((0, foot_top, resized.width, bottom)).getbbox()
        foot_x = (foot[0] + foot[2]) / 2
        x, y = round(32-foot_x), 61-bottom
        if x < 0 or y < 0 or x+resized.width > 64 or y+resized.height > 64:
            raise ValueError(f"Frame {index} would clip; reduce target size")
        # No mask argument: copying RGBA directly avoids multiplying alpha twice.
        result.paste(resized, ((index % 5)*64+x, (index // 5)*64+y))
        metrics.append({"row": index//5, "col": index%5, "bounds": [left+x, top+y, right+x, bottom+y], "foot_x": foot_x+x})
    output.parent.mkdir(parents=True, exist_ok=True)
    result.save(output)
    report = {"source": str(source), "extraction": extraction, "source_size": list(image.size), "reference_size": list(old.size), "output_size": list(result.size), "frame_size": [64, 64], "grid": [5, 5], "scale": scale, "reference_height_range": [min(old_heights), max(old_heights)], "source_cells": source_cells, "frames": metrics, "alpha": "Original sampled RGBA preserved; no new interpolated colors/alpha", "foot_baseline": 61}
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({key: value for key, value in report.items() if key not in ("source_cells", "frames")}, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=ROOT / "art-src/player/player-traveler-current-original.png")
    parser.add_argument("--reference", type=Path, default=ROOT / "public/assets/player/player1.png")
    parser.add_argument("--output", type=Path, default=ROOT / "public/assets/player/player.png")
    parser.add_argument("--report", type=Path, default=ROOT / "art-src/player/resize-report.json")
    args = parser.parse_args()
    convert(args.source, args.reference, args.output, args.report)
