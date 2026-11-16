import type { CSSProperties, ReactNode } from "react";
import { createPortal } from "react-dom";
import "./demo-tour.css";

/** Room between the lit button and the edge of its light. */
const PAD = 8;
/** Room between the light, or the screen's edge, and the card. */
const GAP = 16;

/**
 * The light: a glowing ring on the target and the card beside it. Nothing is
 * dimmed, so the whole page stays in view and usable while the light shows
 * which button comes next. The card goes below the target when the target is
 * in the top part of the screen, else above it; with no target it sits at the
 * bottom right, clear of the page's work.
 */
export function TourOverlay({
  rect,
  children,
}: {
  rect: DOMRect | null;
  children: ReactNode;
}) {
  if (!rect) {
    return createPortal(
      <div className="dx-tour-card" style={{ right: GAP, bottom: GAP }}>
        {children}
      </div>,
      document.body,
    );
  }
  const top = rect.top - PAD;
  const left = rect.left - PAD;
  const width = rect.width + 2 * PAD;
  const height = rect.height + 2 * PAD;
  const below = top + height < window.innerHeight * 0.6;
  const card: CSSProperties = {
    left: Math.max(GAP, Math.min(left, window.innerWidth - 384 - GAP)),
    ...(below
      ? { top: top + height + GAP }
      : { bottom: window.innerHeight - top + GAP }),
  };
  return createPortal(
    <>
      <div className="dx-tour-light" style={{ top, left, width, height }} />
      <div className="dx-tour-card" style={card}>
        {children}
      </div>
    </>,
    document.body,
  );
}
