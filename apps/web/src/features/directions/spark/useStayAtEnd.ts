import { useEffect, useRef, type RefObject } from "react";

/** How far from the end still counts as being at the end, in pixels. */
const NEAR_END_PX = 16;

function toEnd(region: HTMLElement) {
  region.scrollTop = region.scrollHeight - region.clientHeight;
}

function distanceToEnd(region: HTMLElement) {
  return region.scrollHeight - region.clientHeight - region.scrollTop;
}

/**
 * Keeps a scrolling region at its end while its content grows. An answer keeps
 * growing after it is added (its words are written in, then its table, sources
 * and draft appear), so scrolling once when it is added leaves the end behind.
 * The content is watched instead, and the region follows it until the person
 * scrolls up to read: then it stays where they put it. A new question (`turn`
 * changes) brings them back to the end. The move is instant on purpose, so a
 * smooth scroll in progress is never aimed at a place the content has left.
 */
export function useStayAtEnd(
  region: RefObject<HTMLElement | null>,
  content: RefObject<HTMLElement | null>,
  turn: number,
) {
  const following = useRef(true);
  const lastTop = useRef(0);

  useEffect(() => {
    const scroller = region.current;
    const watched = content.current;
    if (!scroller || !watched) return;
    const follow = () => {
      if (!following.current) return;
      toEnd(scroller);
      lastTop.current = scroller.scrollTop;
    };
    const onScroll = () => {
      // Only a move up is the person's. Our own moves go down, and a smaller
      // maximum (the panel was maximised, then restored) also lands at the end.
      if (scroller.scrollTop < lastTop.current) {
        following.current = distanceToEnd(scroller) <= NEAR_END_PX;
      } else if (distanceToEnd(scroller) <= NEAR_END_PX) {
        following.current = true;
      }
      lastTop.current = scroller.scrollTop;
    };
    scroller.addEventListener("scroll", onScroll, { passive: true });
    const observer = new ResizeObserver(follow);
    observer.observe(watched);
    observer.observe(scroller);
    return () => {
      scroller.removeEventListener("scroll", onScroll);
      observer.disconnect();
    };
  }, [region, content]);

  useEffect(() => {
    const scroller = region.current;
    if (!scroller) return;
    following.current = true;
    toEnd(scroller);
    lastTop.current = scroller.scrollTop;
  }, [region, turn]);
}
