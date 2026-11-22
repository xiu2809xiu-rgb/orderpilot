import { cellFill, snapSpan } from "./geometry";
import { TURN, blend, clamp, mix, rgba } from "./palette";

/** One lit cell of a glyph: column, row, opacity. The origin is the glyph's centre. */
export type Cell = readonly [number, number, number];

export function makeMoon(): Cell[] {
  const pixels: Cell[] = [];
  for (let row = -8; row <= 8; row++) {
    for (let col = -8; col <= 8; col++) {
      if (Math.hypot(col, row) > 6.6) continue;
      const cut = Math.hypot(col - 3.3, row + 2.4);
      if (cut > 5.4) pixels.push([col, row, 1]);
      else if ((col + row) % 2 === 0) pixels.push([col, row, 0.15]);
    }
  }
  return pixels.concat([
    [7, -7, 1],
    [6, -7, 0.45],
    [8, -7, 0.45],
    [7, -8, 0.45],
    [7, -6, 0.45],
  ]);
}

export function makeSun(): Cell[] {
  const pixels: Cell[] = [];
  for (let row = -3; row <= 3; row++) {
    for (let col = -3; col <= 3; col++) {
      if (Math.hypot(col, row) <= 3.7) pixels.push([col, row, 1]);
    }
  }
  for (let ray = 0; ray < 8; ray++) {
    const angle = (ray * Math.PI) / 4;
    const distances = ray % 2 ? [5.9, 7.2] : [5.6, 6.6, 7.6];
    for (const distance of distances) {
      pixels.push([
        Math.round(Math.cos(angle) * distance),
        Math.round(Math.sin(angle) * distance),
        1,
      ]);
    }
  }
  return pixels;
}

/** Index 0 is the moon (night), 1 is the sun (day). A cell is 6.85 track units. */
const GLYPHS = [
  { pixels: makeMoon(), size: 6.85 },
  { pixels: makeSun(), size: 6.85 },
] as const;

const PARTICLE_COUNT =
  Math.max(...GLYPHS.map((glyph) => glyph.pixels.length)) + 20;

interface Dot {
  scatterX: number;
  scatterY: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  tx: number;
  ty: number;
  opacity: number;
  targetOpacity: number;
  phase: number;
}

export interface Pointer {
  x: number;
  y: number;
}

export interface DrawOptions {
  /** A white-on-clear mask for the glass shader, with no glow. */
  mask: boolean;
  /** Device pixels of the target canvas per track unit. */
  unit: number;
}

export interface Particles {
  assign: (index: number, immediate: boolean) => void;
  advance: (
    theme: number,
    agitation: number,
    pointer: Pointer | undefined,
    center: Pointer,
    dt: number,
  ) => { scatter: number; moving: boolean };
  /** Draws in device pixels of `ctx`, ignoring its transform; `origin` is the glyph's centre. */
  draw: (
    ctx: CanvasRenderingContext2D,
    origin: Pointer,
    theme: number,
    scatter: number,
    options: DrawOptions,
  ) => void;
  burst: (strength: number) => void;
}

/** `random` is a parameter so that a test can fix the scatter. */
export function createPixelParticles(random = Math.random): Particles {
  let glyph = 0;
  const dots: Dot[] = Array.from({ length: PARTICLE_COUNT }, () => {
    const angle = random() * TURN;
    const distance = Math.sqrt(random()) * 74;
    return {
      scatterX: Math.cos(angle) * distance,
      scatterY: Math.sin(angle) * distance * 0.85,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      tx: 0,
      ty: 0,
      opacity: 0,
      targetOpacity: 0,
      phase: random() * TURN,
    };
  });

  function assign(index: number, immediate: boolean) {
    glyph = index;
    const { pixels, size } = GLYPHS[index] ?? GLYPHS[0];
    const targets = [...pixels];
    for (let i = targets.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      const a = targets[i];
      const b = targets[j];
      if (a && b) {
        targets[i] = b;
        targets[j] = a;
      }
    }
    dots.forEach((dot, i) => {
      const target = targets[i];
      dot.tx = target ? target[0] * size : dot.scatterX;
      dot.ty = target ? target[1] * size : dot.scatterY;
      dot.targetOpacity = target?.[2] ?? 0;
      if (immediate) {
        dot.x = dot.tx;
        dot.y = dot.ty;
        dot.opacity = dot.targetOpacity;
        dot.vx = dot.vy = 0;
      }
    });
  }

  function burst(strength: number) {
    for (const dot of dots) {
      const angle = random() * TURN;
      const speed = (60 + random() * 200) * strength;
      dot.vx += Math.cos(angle) * speed;
      dot.vy += Math.sin(angle) * speed;
    }
  }

  function advance(
    theme: number,
    agitation: number,
    pointer: Pointer | undefined,
    center: Pointer,
    dt: number,
  ) {
    const nextGlyph = theme > 0.5 ? 1 : 0;
    if (nextGlyph !== glyph) assign(nextGlyph, false);
    const scatter = Math.max(
      agitation,
      clamp(1 - Math.abs(2 * theme - 1) * 1.6),
    );
    let moving = false;
    for (const dot of dots) {
      dot.phase += dt * 2;
      const tx =
        mix(dot.tx, dot.scatterX, scatter) + Math.sin(dot.phase) * scatter * 6;
      const ty =
        mix(dot.ty, dot.scatterY, scatter) +
        Math.cos(dot.phase * 0.82) * scatter * 6;
      dot.vx += ((tx - dot.x) * 340 - dot.vx * 27) * dt;
      dot.vy += ((ty - dot.y) * 340 - dot.vy * 27) * dt;
      if (pointer) {
        const dx = dot.x - (pointer.x - center.x);
        const dy = dot.y - (pointer.y - center.y);
        const distance = Math.hypot(dx, dy);
        if (distance > 0 && distance < 49) {
          const force = ((1 - (distance / 49) ** 2) * 2800 * dt) / distance;
          dot.vx += dx * force;
          dot.vy += dy * force;
        }
      }
      dot.x += dot.vx * dt;
      dot.y += dot.vy * dt;
      const opacity = Math.max(
        dot.targetOpacity * (1 - scatter * 0.25),
        scatter * 0.55,
      );
      dot.opacity = mix(
        dot.opacity,
        opacity,
        Math.min(1, dt * (opacity > dot.opacity ? 9 : 12)),
      );
      moving ||=
        Math.abs(tx - dot.x) + Math.abs(ty - dot.y) > 0.15 ||
        Math.abs(dot.vx) + Math.abs(dot.vy) > 0.8 ||
        Math.abs(opacity - dot.opacity) > 5e-3;
    }
    return { scatter, moving };
  }

  function draw(
    ctx: CanvasRenderingContext2D,
    origin: Pointer,
    theme: number,
    scatter: number,
    { mask, unit }: DrawOptions,
  ) {
    const { size } = GLYPHS[glyph] ?? GLYPHS[0];
    const fill = cellFill(size * unit);
    const color = mask
      ? ([255, 255, 255] as const)
      : blend([255, 245, 233], [37, 34, 31], theme);
    ctx.save();
    // Whole device pixels are what keeps the cells crisp, so the caller's
    // transform (a scale for the track) must not move them.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (!mask) ctx.shadowColor = "#fff0d9";
    for (const dot of dots) {
      if (dot.opacity < 0.02) continue;
      const speed = clamp(Math.hypot(dot.vx, dot.vy) / 420);
      const extent = size * fill * (1 - speed * 0.35) * (1 - scatter * 0.35);
      if (!mask) {
        // The supplied glow was 4 device pixels at 1.245 device pixels a unit.
        ctx.shadowBlur =
          dot.targetOpacity > 0.9
            ? Math.max(0, (1 - 2 * theme) * 4 * (unit / 1.245))
            : 0;
      }
      ctx.fillStyle = rgba(color, dot.opacity * (1 - speed * 0.2));
      const across = snapSpan(dot.x, extent, unit);
      const down = snapSpan(dot.y, extent, unit);
      ctx.fillRect(
        origin.x + across.start,
        origin.y + down.start,
        across.size,
        down.size,
      );
    }
    ctx.restore();
  }

  return { assign, advance, draw, burst };
}
