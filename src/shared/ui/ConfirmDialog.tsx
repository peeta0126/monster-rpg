import { useEffect } from "react";
import { PALETTE, rgba } from "../palette";
import { PixelButton } from "./PixelButton";

/**
 * 되돌릴 수 없는 일을 하기 전에 한 번 더 묻는 창.
 *
 * 예전에는 버튼이 자기 자리에서 "확인?" 으로 바뀌고, 같은 자리를 한 번 더 누르면
 * 나갔다. 누르던 손이 그대로 두 번째 누름이 되는 자리라 **연타 한 번이 곧 삭제**였다.
 * 화면 가운데로 올려서 손이 한 번 움직이게 하고, 나가는 문(확인)과 물러나는
 * 문(취소)을 따로 둔다.
 */
export function ConfirmDialog({
  message,
  detail,
  confirmLabel = "확인",
  cancelLabel = "취소",
  onConfirm,
  onCancel,
}: {
  message: string;
  /** 무엇을 지우는지 (아이템 이름 등) */
  detail?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  // ESC 로 물러난다. 잡는 단계(capture)에서 멈춰야 뒤에 있는 화면의 ESC(가방 → 마을)가
  // 같이 안 걸린다 — 창을 닫으려던 손이 화면까지 나가 버린다.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      onCancel();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onCancel]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      data-testid="confirm-dialog"
      className="fixed inset-0 z-[80] flex items-center justify-center p-gutter"
      style={{ background: rgba("shadow900", 0.82) }}
      onClick={onCancel}
    >
      <div
        className="flex w-full max-w-stage flex-col items-center gap-4 rounded-2xl px-6 py-6 text-center"
        style={{
          background: rgba("shadow900", 0.98),
          border: `2px solid ${PALETTE.earth500}`,
          boxShadow: `0 16px 48px ${rgba("shadow900", 0.8)}`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-title-sm font-black text-cream-100">{message}</p>
        {detail && <p className="text-pixel-sm font-bold" style={{ color: PALETTE.sand300 }}>{detail}</p>}

        <div className="flex items-center justify-center gap-2">
          {/* 처음 잡히는 것이 취소다. 창이 뜬 김에 엔터를 누른 손이 삭제하면
              이중장치를 둔 뜻이 없어진다 */}
          <PixelButton variant="ghost" autoFocus onClick={onCancel}>{cancelLabel}</PixelButton>
          <PixelButton variant="danger" onClick={onConfirm}>{confirmLabel}</PixelButton>
        </div>
      </div>
    </div>
  );
}
