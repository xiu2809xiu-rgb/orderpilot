import {
  KNOB_RADIUS,
  KNOB_SIZE,
  roundedOutline,
  sampleRibbon,
  type RibbonSample,
} from "./geometry";
import {
  MOON_LIGHT,
  SUN_LIGHT,
  TURN,
  blend,
  mix,
  paletteVariables,
  rgba,
  wrap,
  type Rgb,
} from "./palette";
import type { Particles } from "./particles";
import type { Frame, Layout, Renderer } from "./types";

/**
 * The 2D painter keeps the room its glow needs at this size: the supplied
 * 140 units of margin would be 18 CSS px here, and about 10 are enough.
 */
export const PAINTER_MARGIN = 10;

/** The supplied blurs were device pixels at 0.83 x 1.5 device pixels a unit. */
const REFERENCE_UNIT = 0.83 * 1.5;

interface RibbonStyle {
  width: number;
  exponent: number;
  offset?: number;
  color: Rgb;
  opacity?: number;
  blur?: number;
}

function paintRibbon(
  ctx: CanvasRenderingContext2D,
  samples: RibbonSample[],
  { width, exponent, offset = 0, color, opacity = 1, blur = 0 }: RibbonStyle,
  blurScale: number,
) {
  const first = samples[0];
  if (!first) return;
  const shape = new Path2D();
  const outline = (point: RibbonSample, side: number): [number, number] => {
    const spread = offset + ((side * width) / 2) * point.taper ** exponent;
    return [point.x + point.nx * spread, point.y + point.ny * spread];
  };
  shape.moveTo(...outline(first, 1));
  for (const sample of samples) shape.lineTo(...outline(sample, 1));
  for (let i = samples.length - 1; i >= 0; i--) {
    const sample = samples[i];
    if (sample) shape.lineTo(...outline(sample, -1));
  }
  shape.closePath();
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.fillStyle = rgba(color);
  const radius = blur * blurScale;
  if (radius && "filter" in ctx) ctx.filter = `blur(${String(radius)}px)`;
  else if (radius) {
    ctx.shadowBlur = radius * 2;
    ctx.shadowColor = ctx.fillStyle;
  }
  ctx.fill(shape);
  ctx.restore();
}

/**
 * The fallback where WebGL2 is missing: the same switch from CSS (track and
 * knob), two ribbons of light and the pixel glyph on a 2D canvas that sits
 * over the track.
 */
export function createCanvasRenderer(
  canvas: HTMLCanvasElement,
  control: HTMLElement,
  knob: HTMLElement,
): Renderer | null {
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  let layout: Layout | undefined;
  let previousTheme: number | undefined;
  return {
    resize(next) {
      layout = next;
      const { width, height, dpr } = next;
      canvas.style.width = `${String(width + 2 * PAINTER_MARGIN)}px`;
      canvas.style.height = `${String(height + 2 * PAINTER_MARGIN)}px`;
      canvas.style.left = `${String(-PAINTER_MARGIN)}px`;
      canvas.style.top = `${String(-PAINTER_MARGIN)}px`;
      canvas.width = Math.round((width + 2 * PAINTER_MARGIN) * dpr);
      canvas.height = Math.round((height + 2 * PAINTER_MARGIN) * dpr);
    },
    paint({ box, theme, phase, transit, scatter }: Frame, dots: Particles) {
      if (!layout) return;
      const { scale, dpr } = layout;
      if (theme !== previousTheme) {
        for (const [name, value] of Object.entries(paletteVariables(theme))) {
          control.style.setProperty(name, value);
        }
        previousTheme = theme;
      }
      const px = (units: number) => `${String(units * scale)}px`;
      Object.assign(knob.style, {
        left: px(box.x),
        top: px(box.y),
        width: px(box.width),
        height: px(box.height),
      });
      const unit = scale * dpr;
      const blurScale = unit / REFERENCE_UNIT;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(
        unit,
        0,
        0,
        unit,
        dpr * PAINTER_MARGIN,
        dpr * PAINTER_MARGIN,
      );
      const padding = 8;
      const outside = roundedOutline(
        {
          x: box.x - padding,
          y: box.y - padding,
          width: box.width + 2 * padding,
          height: box.height + 2 * padding,
        },
        KNOB_RADIUS + padding,
      );
      const inside = roundedOutline(box, KNOB_RADIUS);
      const arcFraction =
        mix(0.31, 0.33, theme) * (1 - 0.12 * Math.sin(TURN * wrap(phase, 0.5)));
      const outer = sampleRibbon(
        outside,
        outside.phaseDistance(phase),
        outside.perimeter * arcFraction,
      );
      const inner = sampleRibbon(
        inside,
        inside.phaseDistance(phase),
        inside.perimeter * arcFraction * 1.25,
      );
      const wash = blend(MOON_LIGHT, SUN_LIGHT, theme);
      const bright = blend(wash, [255, 255, 255], 0.72);
      const body = blend(wash, bright, 0.48);
      const night = theme < 0.55;
      ctx.globalCompositeOperation = night ? "lighter" : "source-over";
      paintRibbon(
        ctx,
        outer,
        {
          width: 64,
          exponent: 0.5,
          offset: 16,
          color: wash,
          blur: 25,
          opacity: mix(0.86, 0.54, theme),
        },
        blurScale,
      );
      paintRibbon(
        ctx,
        outer,
        {
          width: 18,
          exponent: 0.6,
          offset: 4,
          color: wash,
          blur: 8,
          opacity: 0.74,
        },
        blurScale,
      );
      paintRibbon(
        ctx,
        outer,
        { width: 9, exponent: 0.75, color: body, blur: 2, opacity: 0.94 },
        blurScale,
      );
      paintRibbon(
        ctx,
        outer,
        { width: 3.5, exponent: 0.6, color: bright, blur: 0.35 },
        blurScale,
      );
      ctx.globalCompositeOperation = "source-over";
      const clip = new Path2D();
      clip.roundRect(box.x, box.y, box.width, box.height, KNOB_RADIUS);
      ctx.save();
      ctx.clip(clip);
      const edge = inner[24];
      if (edge) {
        const depth = KNOB_SIZE * mix(0.57, 0.7, theme) * (1 + transit * 0.3);
        ctx.save();
        ctx.translate(edge.x, edge.y);
        ctx.rotate(Math.atan2(edge.nx, -edge.ny));
        ctx.scale(KNOB_SIZE * 0.84, depth * 0.62);
        const oriented = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
        oriented.addColorStop(0, rgba(bright, mix(0.91, 0.84, theme)));
        oriented.addColorStop(0.23, rgba(wash, mix(0.9, 0.52, theme)));
        oriented.addColorStop(0.56, rgba(wash, mix(0.46, 0.23, theme)));
        oriented.addColorStop(1, rgba(wash, 0));
        ctx.fillStyle = oriented;
        ctx.fillRect(-1, -1, 2, 2);
        ctx.restore();
      }
      paintRibbon(
        ctx,
        inner,
        {
          width: 22,
          exponent: 0.5,
          color: night ? bright : body,
          blur: 8,
          opacity: 0.76 - transit * 0.35,
        },
        blurScale,
      );
      paintRibbon(
        ctx,
        inner,
        { width: 8, exponent: 0.6, color: bright, blur: 2, opacity: 0.92 },
        blurScale,
      );
      // The glyph is drawn in whole device pixels of this canvas, from the
      // knob's centre rounded to one.
      dots.draw(
        ctx,
        {
          x: Math.round(dpr * (PAINTER_MARGIN + inside.center.x * scale)),
          y: Math.round(dpr * (PAINTER_MARGIN + inside.center.y * scale)),
        },
        theme,
        scatter,
        { mask: false, unit },
      );
      ctx.restore();
    },
    destroy() {
      layout = undefined;
    },
  };
}
