import type { CSSProperties, ReactNode } from "react";
import { createPortal } from "react-dom";
import "./demo-tour.css";

/** Room between the lit button and the edge of its light. */
const PAD = 8;
/** Room between the light, or the screen's edge, and the card. */
const GAP = 16;
/** The card's width (`.dx-tour-card`, 24rem). */
const CARD_W = 384;

/** Beside an open menu, on its left, or in the bottom left corner where there is no room. */
function asideOf(menu: DOMRect): CSSProperties {
  return menu.left > CARD_W + 2 * GAP
    ? { top: menu.top, right: window.innerWidth - menu.left + GAP }
    : { left: GAP, bottom: GAP };
}

/**
 * The light: a glowing ring on the target and the card beside it. Nothing is
 * dimmed, so the whole page stays in view and usable while the light shows
 * which button comes next. The card goes below the target when the target is
 * in the top part of the screen, else above it; with no target it sits at the
 * bottom right, clear of the page's work. While a dropdown menu is open, such
 * as Demo role's, the card steps aside so the list stays clear.
 */
export function TourOverlay({
  rect,
  menu,
  children,
}: {
  rect: DOMRect | null;
  /** An open dropdown menu the card must keep clear of, or null. */
  menu: DOMRect | null;
  children: ReactNode;
}) {
  if (!rect) {
    return createPortal(
      <div
        className="dx-tour-card"
        style={menu ? asideOf(menu) : { right: GAP, bottom: GAP }}
      >
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
  const card: CSSProperties = menu
    ? asideOf(menu)
    : {
        left: Math.max(GAP, Math.min(left, window.innerWidth - CARD_W - GAP)),
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
