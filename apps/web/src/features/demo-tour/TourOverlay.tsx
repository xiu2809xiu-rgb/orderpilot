import type { CSSProperties, ReactNode } from "react";
import { createPortal } from "react-dom";
import "./demo-tour.css";

/** Room between the lit button and the edge of its light. */
const PAD = 8;
/** Room between the light, or the screen's edge, and the card. */
const GAP = 16;

/**
 * The light: four dimmed panels around the target, so only the target can be
 * clicked, a glowing ring on it, and the card beside it. The card goes below
 * the target when the target is in the top part of the screen, else above it.
 * With no target the whole page dims and the card sits in the middle.
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
      <>
        <div className="dx-tour-dim" style={{ inset: 0 }} />
        <div
          className="dx-tour-card"
          style={{ top: "50%", left: "50%", translate: "-50% -50%" }}
        >
          {children}
        </div>
      </>,
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
      <div
        className="dx-tour-dim"
        style={{ top: 0, left: 0, right: 0, height: Math.max(0, top) }}
      />
      <div
        className="dx-tour-dim"
        style={{ top: top + height, left: 0, right: 0, bottom: 0 }}
      />
      <div
        className="dx-tour-dim"
        style={{ top, left: 0, width: Math.max(0, left), height }}
      />
      <div
        className="dx-tour-dim"
        style={{ top, left: left + width, right: 0, height }}
      />
      <div className="dx-tour-light" style={{ top, left, width, height }} />
      <div className="dx-tour-card" style={card}>
        {children}
      </div>
    </>,
    document.body,
  );
}
