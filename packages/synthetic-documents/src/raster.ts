export type Point = readonly [number, number];
/** A closed outline. Several of them painted together fill with the non-zero rule, as glyphs do. */
export type Outline = readonly Point[];

interface Edge {
  low: number;
  high: number;
  x0: number;
  y0: number;
  slope: number;
  direction: 1 | -1;
}

// Sub-scanlines for each pixel row: enough for clean edges on 8 pt text at 120 dpi.
const SUB = 4;

/**
 * A greyscale canvas that fills outlines with exact horizontal coverage. It is
 * the least that can draw glyph outlines, rules and boxes, and it is pure
 * arithmetic: the same outlines give the same pixels on any machine.
 * `value` 1 is white paper and 0 is black.
 */
export class Raster {
  readonly value: Float32Array;

  constructor(
    readonly width: number,
    readonly height: number,
    background = 1,
  ) {
    this.value = new Float32Array(width * height).fill(background);
  }

  /** Paints every outline at once, so touching or overlapping contours do not double up. */
  fill(outlines: readonly Outline[], tone: number, opacity = 1): void {
    const edges: Edge[] = [];
    let top = Infinity;
    let bottom = -Infinity;
    let left = Infinity;
    let right = -Infinity;
    for (const outline of outlines) {
      outline.forEach((from, i) => {
        const to = outline[(i + 1) % outline.length];
        if (!to) return;
        top = Math.min(top, from[1]);
        bottom = Math.max(bottom, from[1]);
        left = Math.min(left, from[0]);
        right = Math.max(right, from[0]);
        if (from[1] !== to[1]) {
          edges.push({
            low: Math.min(from[1], to[1]),
            high: Math.max(from[1], to[1]),
            x0: from[0],
            y0: from[1],
            slope: (to[0] - from[0]) / (to[1] - from[1]),
            direction: to[1] > from[1] ? 1 : -1,
          });
        }
      });
    }
    if (edges.length === 0) return;
    const row0 = Math.max(0, Math.floor(top));
    const row1 = Math.min(this.height - 1, Math.floor(bottom));
    const col0 = Math.max(0, Math.floor(left));
    const col1 = Math.min(this.width - 1, Math.floor(right));
    if (row1 < row0 || col1 < col0) return;
    const span = col1 - col0 + 1;
    const cover = new Float32Array(span);
    for (let row = row0; row <= row1; row++) {
      cover.fill(0);
      for (let sub = 0; sub < SUB; sub++) {
        const y = row + (sub + 0.5) / SUB;
        const crossings: [number, number][] = [];
        for (const edge of edges) {
          if (y >= edge.low && y < edge.high) {
            crossings.push([
              edge.x0 + (y - edge.y0) * edge.slope,
              edge.direction,
            ]);
          }
        }
        crossings.sort((a, b) => a[0] - b[0]);
        let winding = 0;
        let start = 0;
        for (const [x, direction] of crossings) {
          const before = winding;
          winding += direction;
          if (before === 0 && winding !== 0) start = x;
          else if (before !== 0 && winding === 0) {
            this.span(cover, col0, start, x);
          }
        }
      }
      for (let i = 0; i < span; i++) {
        const c = Math.min(1, cover[i] ?? 0) * opacity;
        if (c === 0) continue;
        const at = row * this.width + col0 + i;
        this.value[at] = (this.value[at] ?? 1) * (1 - c) + tone * c;
      }
    }
  }

  private span(
    cover: Float32Array,
    col0: number,
    from: number,
    to: number,
  ): void {
    const a = Math.max(from, col0);
    const b = Math.min(to, col0 + cover.length);
    if (b <= a) return;
    const first = Math.floor(a);
    const last = Math.floor(b);
    const add = (col: number, amount: number) => {
      const i = col - col0;
      cover[i] = (cover[i] ?? 0) + amount / SUB;
    };
    if (first === last) {
      add(first, b - a);
      return;
    }
    add(first, first + 1 - a);
    for (let col = first + 1; col < last; col++) add(col, 1);
    if (last < col0 + cover.length) add(last, b - last);
  }
}

/** A thick line as a four-cornered outline. */
export function stroke(from: Point, to: Point, width: number): Outline {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const length = Math.sqrt(dx * dx + dy * dy) || 1;
  const nx = (-dy / length) * (width / 2);
  const ny = (dx / length) * (width / 2);
  return [
    [from[0] + nx, from[1] + ny],
    [to[0] + nx, to[1] + ny],
    [to[0] - nx, to[1] - ny],
    [from[0] - nx, from[1] - ny],
  ];
}
