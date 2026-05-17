import { useRef, useEffect } from "react";
import { ROOM_COLS, ROOM_ROWS, TILE_SIZE } from "../../constants/housing";
import { getFloorTile } from "../../data/floorTiles";

export function IndoorRoomBg({
  width, height, stageLeft, stageTop, cs, floorTileId,
}: {
  width: number; height: number;
  stageLeft: number; stageTop: number; cs: number;
  floorTileId: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    canvas.width  = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;

    const ts    = TILE_SIZE * cs;
    const roomW = ROOM_COLS * ts;
    const roomH = ROOM_ROWS * ts;
    const ft    = getFloorTile(floorTileId);

    // ── 배경 ─────────────────────────────────────────────────────────────────
    ctx.fillStyle = "#080502";
    ctx.fillRect(0, 0, width, height);

    // ── 바닥 타일 ─────────────────────────────────────────────────────────────
    for (let ty = 0; ty < ROOM_ROWS; ty++) {
      for (let tx = 0; tx < ROOM_COLS; tx++) {
        const x = stageLeft + tx * ts;
        const y = stageTop  + ty * ts;

        ctx.fillStyle = ft.normalBg;
        ctx.fillRect(x, y, ts, ts);

        // 체커보드 어두운 칸
        if ((tx + ty) % 2 !== 0) {
          ctx.fillStyle = "rgba(0,0,0,0.16)";
          ctx.fillRect(x, y, ts, ts);
        }

        // 상단 하이라이트 (빛의 방향감)
        ctx.fillStyle = "rgba(255,255,255,0.07)";
        ctx.fillRect(x, y, ts, ts * 0.12);

        // 타일 테두리
        const bw = Math.max(0.8, cs * 1.2);
        ctx.strokeStyle = ft.normalOutline;
        ctx.lineWidth = bw;
        ctx.strokeRect(x + bw / 2, y + bw / 2, ts - bw, ts - bw);
      }
    }

    // ── 방 외곽 프레임 ────────────────────────────────────────────────────────
    const fw = Math.max(2.5, cs * 4);
    ctx.strokeStyle = "#2C1406";
    ctx.lineWidth = fw;
    ctx.strokeRect(stageLeft + fw / 2, stageTop + fw / 2, roomW - fw, roomH - fw);

    // 내부 금빛 장식선
    const ip = fw + Math.max(1, cs * 1.5);
    ctx.strokeStyle = "rgba(244,169,54,0.35)";
    ctx.lineWidth = Math.max(0.8, cs * 1.2);
    ctx.strokeRect(stageLeft + ip, stageTop + ip, roomW - ip * 2, roomH - ip * 2);

  }, [width, height, stageLeft, stageTop, cs, floorTileId]);

  return (
    <canvas
      ref={ref}
      style={{ position: "absolute", inset: 0, zIndex: 0, display: "block" }}
    />
  );
}
