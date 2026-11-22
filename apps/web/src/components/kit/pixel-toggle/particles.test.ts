import { describe, expect, it, vi } from "vitest";
import { createPixelParticles, makeMoon, makeSun } from "./particles";

/** A random source that cycles through fixed numbers, so a scatter is the same every run. */
function fixed() {
  let i = 0;
  return () => {
    i += 1;
    return (i * 0.6180339887) % 1;
  };
}

function key(cell: readonly [number, number, number]) {
  return `${String(cell[0])},${String(cell[1])}`;
}

describe("the pixel moon", () => {
  const moon = makeMoon();
  const at = new Map(moon.map((cell) => [key(cell), cell[2]]));

  it("fits in a 17 by 17 grid around its centre", () => {
    for (const [col, row] of moon) {
      expect(Math.abs(col)).toBeLessThanOrEqual(8);
      expect(Math.abs(row)).toBeLessThanOrEqual(8);
    }
  });

  it("is a crescent: solid on the left, hollowed on the upper right", () => {
    expect(at.get("-4,0")).toBe(1);
    expect(at.has("3,-2")).toBe(false);
    // The hollow keeps a dither of faint cells, on every other cell.
    expect(at.get("4,-2")).toBe(0.15);
    expect(at.has("4,-1")).toBe(false);
  });

  it("has a star: one bright cell with four faint ones around it", () => {
    expect(at.get("7,-7")).toBe(1);
    for (const around of ["6,-7", "8,-7", "7,-8", "7,-6"]) {
      expect(at.get(around)).toBe(0.45);
    }
  });

  it("has no cell twice", () => {
    expect(at.size).toBe(moon.length);
  });
});

describe("the pixel sun", () => {
  const sun = makeSun();
  const cells = new Set(sun.map(key));

  it("has a round body of radius 3.7 cells, with its four corners cut", () => {
    expect(cells.has("0,0")).toBe(true);
    expect(cells.has("3,2")).toBe(true);
    expect(cells.has("3,3")).toBe(false);
  });

  it("has eight rays: three cells on the straight ones and two on the diagonal ones", () => {
    for (const straight of ["6,0", "7,0", "8,0", "0,8", "-8,0", "0,-6"]) {
      expect(cells.has(straight)).toBe(true);
    }
    for (const diagonal of ["4,4", "5,5", "-4,-4", "-5,5"]) {
      expect(cells.has(diagonal)).toBe(true);
    }
    expect(cells.has("6,6")).toBe(false);
  });

  it("is all solid, with no cell twice", () => {
    expect(sun.every((cell) => cell[2] === 1)).toBe(true);
    expect(cells.size).toBe(sun.length);
  });
});

describe("the particles", () => {
  /** A canvas context that records the rectangles it is asked to fill. */
  function recorder() {
    const rects: [number, number, number, number][] = [];
    const ctx = {
      save: vi.fn(),
      restore: vi.fn(),
      setTransform: vi.fn(),
      fillRect: (...rect: [number, number, number, number]) => {
        rects.push(rect);
      },
      fillStyle: "",
      shadowBlur: 0,
      shadowColor: "",
    } as unknown as CanvasRenderingContext2D;
    return { ctx, rects };
  }

  it("draws the moon in whole device pixels, with no gap between cells under 2 pixels", () => {
    const particles = createPixelParticles(fixed());
    particles.assign(0, true);
    const { ctx, rects } = recorder();
    particles.draw(ctx, { x: 17, y: 17 }, 0, 0, { mask: true, unit: 0.13 });
    expect(rects.length).toBeGreaterThan(40);
    for (const rect of rects) {
      for (const value of rect) expect(Number.isInteger(value)).toBe(true);
      expect(rect[2]).toBeGreaterThanOrEqual(1);
      expect(rect[3]).toBeGreaterThanOrEqual(1);
    }
  });

  it("draws the sun the same way at a larger scale, with the gap and one width for every cell", () => {
    const particles = createPixelParticles(fixed());
    particles.assign(1, true);
    const { ctx, rects } = recorder();
    particles.draw(ctx, { x: 64, y: 64 }, 1, 0, { mask: true, unit: 0.5 });
    const widths = new Set(rects.map((rect) => rect[2]));
    expect([...widths]).toEqual([3]);
    for (const rect of rects) expect(Number.isInteger(rect[0])).toBe(true);
  });

  it("draws nothing for a cell that has faded out", () => {
    const particles = createPixelParticles(fixed());
    const { ctx, rects } = recorder();
    // Nothing is assigned and every dot starts clear.
    particles.draw(ctx, { x: 0, y: 0 }, 0, 0, { mask: true, unit: 0.2 });
    expect(rects).toHaveLength(0);
  });

  it("keeps the same scatter when it is given the same random source", () => {
    const a = createPixelParticles(fixed());
    const b = createPixelParticles(fixed());
    a.assign(0, true);
    b.assign(0, true);
    const first = recorder();
    const second = recorder();
    a.draw(first.ctx, { x: 20, y: 20 }, 0, 0, { mask: true, unit: 0.3 });
    b.draw(second.ctx, { x: 20, y: 20 }, 0, 0, { mask: true, unit: 0.3 });
    expect(first.rects).toEqual(second.rects);
  });

  it("settles: after enough time at rest it reports that nothing moves", () => {
    const particles = createPixelParticles(fixed());
    particles.assign(1, true);
    let moving = true;
    for (let i = 0; i < 600 && moving; i++) {
      moving = particles.advance(
        1,
        0,
        undefined,
        { x: 0, y: 0 },
        1 / 60,
      ).moving;
    }
    expect(moving).toBe(false);
  });
});
