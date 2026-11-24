import type { Locator, Page } from "@playwright/test";
import { expect, signInAs, test } from "../src/index.js";

// Story D (issue #384): a scroll area marks the side that has more. A unit
// test cannot say where a mark is drawn, whether the browser keeps it at the
// edge of the visible box while the content scrolls, or whether a tap under it
// still reaches the control, because jsdom has no layout. So this spec uses a
// real one, on the Orders "By stage" board at tablet width: nine columns and
// Done are far wider than the box, and a missed held order is what the marks
// are for. The contrast of the marks is a unit test (ScrollRegion.contrast.test.ts).
//
// The marks are `.sr-edge-start` and `.sr-edge-end`, two frames inside the
// `.sr-edges` rail that ScrollRegion puts last in the box. Each frame is as
// large as the visible box and pinned over it; the mark is a 32 px strip at
// its left or right edge. The spec reads the frames' boxes and their computed
// style, never a screenshot.

const TABLET = { width: 820, height: 1180 };
const BOARD = "/orders?view=stage&source=sample";
/** --sr-mark in ScrollRegion.css: 2rem. */
const MARK_PX = 32;
/** Sub-pixel layout and a rounded scrollWidth: one pixel is the same place. */
const SLACK_PX = 1;

interface Box {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

interface Frame {
  box: Box;
  opacity: number;
  zIndex: string;
  pointerEvents: string;
  backgroundSize: string;
  backgroundImage: string;
  borderLeftWidth: string;
  borderRightWidth: string;
  transitionDuration: string;
  transitionProperty: string;
}

interface Reading {
  /** The visible box of the region: inside its border, without a scrollbar. */
  visible: Box;
  maxLeft: number;
  maxTop: number;
  scrollLeft: number;
  scrollTop: number;
  start: Frame;
  end: Frame;
  railDisplay: string;
  railHidden: string | null;
  railTabStops: number;
}

/** What the browser draws for one region now: where the frames are and how they look. */
function read(region: Locator): Promise<Reading> {
  return region.evaluate((el): Reading => {
    const outer = el.getBoundingClientRect();
    const left = outer.left + el.clientLeft;
    const top = outer.top + el.clientTop;
    const frame = (side: "start" | "end"): Frame => {
      const node = el.querySelector(`:scope > .sr-edges > .sr-edge-${side}`);
      if (!node) throw new Error(`The ${side} mark is not in the region.`);
      const r = node.getBoundingClientRect();
      const css = getComputedStyle(node);
      return {
        box: { left: r.left, right: r.right, top: r.top, bottom: r.bottom },
        opacity: Number(css.opacity),
        zIndex: css.zIndex,
        pointerEvents: css.pointerEvents,
        backgroundSize: css.backgroundSize,
        backgroundImage: css.backgroundImage,
        borderLeftWidth: css.borderLeftWidth,
        borderRightWidth: css.borderRightWidth,
        transitionDuration: css.transitionDuration,
        transitionProperty: css.transitionProperty,
      };
    };
    const rail = el.querySelector(":scope > .sr-edges");
    if (!rail) throw new Error("The rail is not in the region.");
    return {
      visible: {
        left,
        top,
        right: left + el.clientWidth,
        bottom: top + el.clientHeight,
      },
      maxLeft: el.scrollWidth - el.clientWidth,
      maxTop: el.scrollHeight - el.clientHeight,
      scrollLeft: el.scrollLeft,
      scrollTop: el.scrollTop,
      start: frame("start"),
      end: frame("end"),
      railDisplay: getComputedStyle(rail).display,
      railHidden: rail.getAttribute("aria-hidden"),
      railTabStops: rail.querySelectorAll("[tabindex]").length,
    };
  });
}

/** Scrolls the region to a fraction of its range on each axis, as a finger would. */
async function scrollToFraction(
  region: Locator,
  across: number,
  down = 0,
): Promise<void> {
  await region.evaluate(
    (el, [x, y]) => {
      el.scrollTo({
        left: (el.scrollWidth - el.clientWidth) * (x ?? 0),
        top: (el.scrollHeight - el.clientHeight) * (y ?? 0),
        behavior: "instant",
      });
    },
    [across, down],
  );
}

/** The marks that are drawn, by their opacity. The fade is over once both are 0 or 1. */
async function drawn(region: Locator): Promise<{ start: number; end: number }> {
  const { start, end } = await read(region);
  return { start: start.opacity, end: end.opacity };
}

function expectNear(actual: number, wanted: number, what: string): void {
  expect(
    Math.abs(actual - wanted),
    `${what}: ${String(actual)} against ${String(wanted)}`,
  ).toBeLessThanOrEqual(SLACK_PX);
}

/** Both frames are over the whole visible box, wherever the content has scrolled to. */
function expectFramesOnVisibleBox(r: Reading): void {
  for (const side of ["start", "end"] as const) {
    const box = r[side].box;
    expectNear(box.left, r.visible.left, `${side} frame left`);
    expectNear(box.right, r.visible.right, `${side} frame right`);
    expectNear(box.top, r.visible.top, `${side} frame top`);
    expectNear(box.bottom, r.visible.bottom, `${side} frame bottom`);
  }
}

async function openBoard(page: Page): Promise<Locator> {
  await signInAs(page, "SUPPORT");
  await page.goto(BOARD);
  const region = page.getByRole("region", { name: "Orders by stage" });
  await expect(region.locator("[data-peek-opener]").first()).toBeVisible();
  const r = await read(region);
  // The board is nine columns and Done at 15.5 rem each: far wider than 820 px.
  expect(
    r.maxLeft,
    "the board must scroll sideways at 820 px or this spec proves nothing",
  ).toBeGreaterThan(MARK_PX * 4);
  return region;
}

test.describe("Scroll areas show which side has more: the Orders board at tablet width", () => {
  test.use({ viewport: TABLET });

  test("at the start the right edge is marked and the left is not", async ({
    page,
  }) => {
    const region = await openBoard(page);
    await expect.poll(() => drawn(region)).toEqual({ start: 0, end: 1 });
    const r = await read(region);
    expect(r.scrollLeft).toBeLessThanOrEqual(SLACK_PX);
    expectFramesOnVisibleBox(r);
    // The mark is a strip of 2 rem at the frame's own edge, so it is drawn at
    // the right edge of the region and not inside the cards.
    expect(r.end.backgroundSize).toBe(`${String(MARK_PX)}px 100%`);
    expect(r.end.backgroundImage).toContain("linear-gradient");
    expectNear(r.end.box.right, r.visible.right, "the right mark's edge");
  });

  test("in the middle both edges are marked, and at the end only the left", async ({
    page,
  }) => {
    const region = await openBoard(page);

    await scrollToFraction(region, 0.5);
    await expect.poll(() => drawn(region)).toEqual({ start: 1, end: 1 });
    expectFramesOnVisibleBox(await read(region));

    await scrollToFraction(region, 1);
    await expect.poll(() => drawn(region)).toEqual({ start: 1, end: 0 });
    const atEnd = await read(region);
    expect(atEnd.maxLeft - atEnd.scrollLeft).toBeLessThanOrEqual(SLACK_PX);
    expectFramesOnVisibleBox(atEnd);

    await scrollToFraction(region, 0);
    await expect.poll(() => drawn(region)).toEqual({ start: 0, end: 1 });
  });

  test("a change of the window's size moves the marks with no reload", async ({
    page,
  }) => {
    const region = await openBoard(page);
    await scrollToFraction(region, 0.5);
    await expect.poll(() => drawn(region)).toEqual({ start: 1, end: 1 });
    await page.setViewportSize({ width: 1000, height: 1180 });
    // The frames follow the new visible box, and the scroll position is kept
    // or clamped, so the marks stay true to it.
    await expect
      .poll(async () => {
        const r = await read(region);
        return Math.abs(r.end.box.right - r.visible.right) <= SLACK_PX;
      })
      .toBe(true);
    const r = await read(region);
    expectFramesOnVisibleBox(r);
    expect({
      start: r.start.opacity === 1,
      end: r.end.opacity === 1,
    }).toEqual({
      start: r.scrollLeft > SLACK_PX,
      end: r.maxLeft - r.scrollLeft > SLACK_PX,
    });
  });

  test("a card under the right mark opens when it is clicked", async ({
    page,
  }) => {
    const region = await openBoard(page);
    // Scroll so that a column with cards runs 40 px past the right edge: it
    // then lies under the whole mark, and its card is under the mark's strip.
    const orderNo = await region.evaluate((el, past) => {
      const box = el.getBoundingClientRect();
      for (const column of Array.from(el.querySelectorAll(".od-column"))) {
        const opener = column.querySelector("[data-peek-opener]");
        if (!opener) continue;
        const right =
          column.getBoundingClientRect().right -
          box.left -
          el.clientLeft +
          el.scrollLeft;
        // The column's right edge, at this scroll position, is `past` px
        // beyond the visible box's right edge.
        const target = right - el.clientWidth - past;
        if (target > 0 && target <= el.scrollWidth - el.clientWidth) {
          el.scrollTo({ left: target, top: 0, behavior: "instant" });
          return opener.getAttribute("data-peek-opener");
        }
      }
      return null;
    }, 40);
    expect(
      orderNo,
      "a column with cards that can straddle the edge",
    ).not.toBeNull();
    await expect.poll(async () => (await read(region)).end.opacity).toBe(1);

    const card = region.locator(`[data-peek-opener="${String(orderNo)}"]`);
    const cardBox = await card.boundingBox();
    const r = await read(region);
    if (!cardBox) throw new Error("The card has no box.");
    const x = r.visible.right - MARK_PX / 2;
    const y = cardBox.y + cardBox.height / 2;
    expect(y, "the card is in view").toBeGreaterThan(r.visible.top);
    expect(y, "the card is in view").toBeLessThan(r.visible.bottom);

    // The mark is over this point and takes no hit: the browser's own answer
    // is the card, never the rail.
    const hit = await page.evaluate(
      ([px, py]) => {
        const found = document.elementFromPoint(px ?? 0, py ?? 0);
        return {
          inRail: found?.closest(".sr-edges") !== null,
          inCard: found?.closest(".od-card") !== null,
        };
      },
      [x, y],
    );
    expect(hit).toEqual({ inRail: false, inCard: true });

    await page.mouse.click(x, y);
    const peek = page.getByRole("dialog");
    await expect(peek.getByText(String(orderNo))).toBeVisible();
  });

  test("the marks are hidden from screen readers and add no tab stop", async ({
    page,
  }) => {
    const region = await openBoard(page);
    const r = await read(region);
    expect(r.railHidden).toBe("true");
    expect(r.railTabStops).toBe(0);
    expect(r.start.pointerEvents).toBe("none");
    expect(r.end.pointerEvents).toBe("none");
    // The region itself is the one stop, because it overflows.
    await expect(region).toHaveAttribute("tabindex", "0");
    await expect(region.locator(".sr-edges")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });

  test("the page itself never scrolls sideways, at the start, in the middle or at the end", async ({
    page,
  }) => {
    const region = await openBoard(page);
    for (const at of [0, 0.5, 1]) {
      await scrollToFraction(region, at);
      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      );
      expect(
        overflow,
        `page overflow with the board at ${String(at)}`,
      ).toBeLessThanOrEqual(0);
    }
  });
});

test.describe("Scroll areas show which side has more: a box that is tall and wide", () => {
  // The board never scrolls down at tablet width: it is as tall as its columns
  // and the page scrolls instead (the cards are not cut). The component
  // gallery's "Orders" table is a box with a max height and more columns than
  // 820 px holds, so it scrolls both ways, on data that never changes.
  test.use({ viewport: { width: 820, height: 480 } });

  test("the marks stay on the visible box while the content scrolls down and across", async ({
    page,
  }) => {
    await signInAs(page, "SUPPORT");
    await page.goto("/gallery");
    const region = page.getByRole("region", {
      name: "Orders, scrollable table",
      exact: true,
    });
    await expect(region.getByRole("columnheader").first()).toBeVisible();
    const before = await read(region);
    expect(
      before.maxTop,
      "the table must scroll down at 480 px high or this proves nothing",
    ).toBeGreaterThan(MARK_PX * 2);
    expect(
      before.maxLeft,
      "the table must scroll across at 820 px or this proves nothing",
    ).toBeGreaterThan(MARK_PX * 2);

    for (const [across, down] of [
      [0.5, 0.5],
      [1, 1],
      [0.25, 1],
    ] as const) {
      await scrollToFraction(region, across, down);
      await expect
        .poll(async () => {
          const r = await read(region);
          return (
            Math.abs(r.end.box.top - r.visible.top) <= SLACK_PX &&
            Math.abs(r.end.box.bottom - r.visible.bottom) <= SLACK_PX
          );
        })
        .toBe(true);
      const r = await read(region);
      expect(r.scrollTop, "scrolled down").toBeGreaterThan(0);
      expect(r.scrollLeft, "scrolled across").toBeGreaterThan(0);
      expectFramesOnVisibleBox(r);
    }
  });
});

test.describe("Scroll areas show which side has more: a box with padding", () => {
  test.use({ viewport: { width: 820, height: 600 } });

  // The order peek's scroll box has padding (1.25rem 1.5rem). A browser pins a
  // sticky box inside that padding, so without the script's correction the
  // marks sit a padding's width inside the box and the right one is pushed out
  // of view. The peek rarely scrolls sideways, so a wide block is added to it.
  test("the marks stay on the visible box of a padded scroll box", async ({
    page,
  }) => {
    const board = await openBoard(page);
    await board.locator("[data-peek-opener]").first().click();
    const region = page.getByRole("region", { name: "Order summary" });
    await expect(region).toBeVisible();
    await region.evaluate((el) => {
      const wide = document.createElement("div");
      wide.style.cssText = "width:1400px;height:20px";
      el.firstElementChild?.after(wide);
    });
    const before = await read(region);
    expect(before.maxLeft, "the peek must scroll across").toBeGreaterThan(
      MARK_PX * 2,
    );
    expect(before.maxTop, "the peek must scroll down").toBeGreaterThan(
      MARK_PX * 2,
    );
    for (const [across, down] of [
      [0, 0],
      [0.5, 0],
      [0.5, 0.5],
      [1, 1],
    ] as const) {
      await scrollToFraction(region, across, down);
      await expect
        .poll(async () => {
          const r = await read(region);
          return (
            Math.abs(r.end.box.left - r.visible.left) <= SLACK_PX &&
            Math.abs(r.end.box.top - r.visible.top) <= SLACK_PX
          );
        })
        .toBe(true);
      expectFramesOnVisibleBox(await read(region));
    }
  });
});

test.describe("Scroll areas show which side has more: a box that fits", () => {
  test.use({ viewport: { width: 1366, height: 900 } });

  // The Orders list fits its box at 1366 px: its columns are fitted to the
  // width (orderFit.ts), so nothing lies past an edge.
  test("shows no mark", async ({ page }) => {
    await signInAs(page, "SUPPORT");
    await page.goto("/orders?source=sample");
    const region = page.getByRole("region", { name: "Orders table" });
    await expect(
      region.getByRole("link", { name: /^SO-\d{4}$/ }).first(),
    ).toBeVisible();
    const r = await read(region);
    expect(
      r.maxLeft,
      "the Orders list must fit at 1366 px or this proves nothing",
    ).toBeLessThanOrEqual(SLACK_PX);
    await expect.poll(() => drawn(region)).toEqual({ start: 0, end: 0 });
    await expect(region).not.toHaveAttribute("data-more-start");
    await expect(region).not.toHaveAttribute("data-more-end");
  });
});

test.describe("Scroll areas show which side has more: under a frozen column", () => {
  test.use({ viewport: { width: 820, height: 1000 } });

  // The access matrix pins its first column with z-10. The left mark is
  // drawn under every frozen cell, so a pinned column is never shaded.
  test("the left mark is under the pinned first column", async ({ page }) => {
    await signInAs(page, "SYSTEM_ADMIN");
    await page.goto("/governance");
    const region = page.getByRole("region", { name: "Permissions by role" });
    await expect(region.getByRole("columnheader").first()).toBeVisible();
    const before = await read(region);
    expect(
      before.maxLeft,
      "the matrix must scroll sideways at 820 px or this proves nothing",
    ).toBeGreaterThan(MARK_PX * 2);

    await scrollToFraction(region, 0.5);
    await expect.poll(() => drawn(region)).toEqual({ start: 1, end: 1 });
    const pinned = await region.evaluate((el) =>
      Array.from(el.querySelectorAll('[class~="sticky"]')).map((cell) =>
        Number(getComputedStyle(cell).zIndex),
      ),
    );
    expect(pinned.length, "pinned cells in the matrix").toBeGreaterThan(0);
    const r = await read(region);
    expect(Number(r.start.zIndex)).toBeLessThan(Math.min(...pinned));
  });
});

test.describe("Scroll areas show which side has more: other ways of looking", () => {
  test.use({ viewport: TABLET });

  test("forced colours draw a line, not a gradient", async ({ page }) => {
    const region = await openBoard(page);
    await page.emulateMedia({ forcedColors: "active" });
    const r = await read(region);
    expect(r.start.backgroundImage).toBe("none");
    expect(r.end.backgroundImage).toBe("none");
    expect(r.start.borderLeftWidth).toBe("1px");
    expect(r.end.borderRightWidth).toBe("1px");
  });

  test("reduced motion has no fade, and otherwise the fade is 160 ms", async ({
    page,
  }) => {
    const region = await openBoard(page);
    await page.emulateMedia({ reducedMotion: "reduce" });
    // The global reduced-motion rule in index.css sets every duration to
    // 0.01ms with !important, so the duration is never "0s" here. What shows
    // that this rule's own `transition: none` holds is the property.
    expect((await read(region)).end.transitionProperty).toBe("none");
    await page.emulateMedia({ reducedMotion: "no-preference" });
    expect((await read(region)).end.transitionDuration).toBe("0.16s");
  });

  test("print draws no mark", async ({ page }) => {
    const region = await openBoard(page);
    await page.emulateMedia({ media: "print" });
    expect((await read(region)).railDisplay).toBe("none");
    await page.emulateMedia({ media: "screen" });
    expect((await read(region)).railDisplay).toBe("block");
  });
});
