import { useEffect, useRef, type RefObject } from "react";

/** How far from the end still counts as being at the end, in pixels. */
const NEAR_END_PX = 16;

function toEnd(region: HTMLElement) {
  region.scrollTop = region.scrollHeight - region.clientHeight;
}

function distanceToEnd(region: HTMLElement) {
  return region.scrollHeight - region.clientHeight - region.scrollTop;
}

/** Where the element's top edge sits in the region's scrollable content. */
function topInContent(region: HTMLElement, element: HTMLElement) {
  return (
    element.getBoundingClientRect().top -
    region.getBoundingClientRect().top +
    region.scrollTop
  );
}

/**
 * Keeps a scrolling region at its end while its content grows. An answer keeps
 * growing after it is added (its words are written in, then its table, sources
 * and draft appear), so scrolling once when it is added leaves the end behind.
 * The content is watched instead, and the region follows it until the person
 * scrolls up to read: then it stays where they put it. A new question (`turn`
 * changes) brings them back to the end. The move is instant on purpose, so a
 * smooth scroll in progress is never aimed at a place the content has left.
 *
 * `newest` names the start of the newest answer. The region follows the end
 * only until that start would leave the top of the view: a tall answer is read
 * from its first line, and the end of it is one scroll away. Without it the
 * region follows the end all the way.
 */
export function useStayAtEnd(
  region: RefObject<HTMLElement | null>,
  content: RefObject<HTMLElement | null>,
  turn: number,
  newest?: () => HTMLElement | null,
) {
  const following = useRef(true);
  const lastTop = useRef(0);

  useEffect(() => {
    const scroller = region.current;
    const watched = content.current;
    if (!scroller || !watched) return;
    const follow = () => {
      if (!following.current) return;
      const start = newest?.() ?? null;
      const held = start === null ? null : topInContent(scroller, start);
      // Past the answer's start already means the person put the view there
      // (at the end): the start is only held while the view has not left it.
      if (held !== null && scroller.scrollTop <= held + 1) {
        const end = scroller.scrollHeight - scroller.clientHeight;
        scroller.scrollTop = Math.min(end, held);
      } else {
        toEnd(scroller);
      }
      lastTop.current = scroller.scrollTop;
    };
    const onScroll = () => {
      const top = scroller.scrollTop;
      // Our own moves are already in lastTop, so any difference is the
      // person's. A move up, or a smaller maximum (the panel was maximised,
      // then restored), counts as following only if it lands at the end.
      if (top === lastTop.current) return;
      following.current = distanceToEnd(scroller) <= NEAR_END_PX;
      lastTop.current = top;
    };
    scroller.addEventListener("scroll", onScroll, { passive: true });
    const observer = new ResizeObserver(follow);
    observer.observe(watched);
    observer.observe(scroller);
    return () => {
      scroller.removeEventListener("scroll", onScroll);
      observer.disconnect();
    };
  }, [region, content, newest]);

  useEffect(() => {
    const scroller = region.current;
    if (!scroller) return;
    following.current = true;
    toEnd(scroller);
    lastTop.current = scroller.scrollTop;
  }, [region, turn]);
}
