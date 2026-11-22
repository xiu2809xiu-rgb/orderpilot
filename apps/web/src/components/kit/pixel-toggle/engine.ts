/*
 * The Pixel Day-Night Toggle: a draggable switch with a glass knob, a pixel
 * moon and sun that scatter and re-form, and a band of light that circles the
 * knob.
 *
 * Source: a post by kaolti on X, https://x.com/kaolti/status/2119151022014894260.
 * Adapted from the bundle Richie supplied on 22 Nov 2026 (a React wrapper, a
 * JavaScript engine and a shadow-DOM runtime), which states no licence. It was
 * restructured to fit this app: strict TypeScript instead of untyped
 * JavaScript; no shadow DOM, so the button is the track, React owns its name
 * and aria-checked, and the engine only draws and animates; sized by the top
 * bar's controls (the supplied scene was a fixed 720 x 540 scaled by CSS, which
 * would also have scaled the focus ring); and crisp pixel art at 36 px. The
 * springs, timings, glyph shapes, palette, shader maths and sound are the
 * supplied ones unless a comment says otherwise. ADR 0062 records the rest.
 */
import { prefersReducedMotion } from "../env";
import { createGlassRenderer } from "./glass";
import {
  DRAG_SLOP_PX,
  FLING_PX_PER_MS,
  TRACK_WIDTH,
  TRAVEL,
  knobGeometry,
  pxToUnits,
  type Box,
} from "./geometry";
import { clamp, mix, paletteVariables } from "./palette";
import { createCanvasRenderer } from "./paint2d";
import { createPixelParticles, type Pointer } from "./particles";
import { createClick } from "./sound";
import { madeByPerson } from "./trust";
import type { Frame, Layout, Renderer } from "./types";

export interface PixelToggleOptions {
  /** True is day (the sun), false is night (the moon). */
  checked: boolean;
  /** The click when a person switches it. On unless false. */
  sound?: boolean;
  /** Called for a person's own click or drag, never for a change of `checked` from outside. */
  onCheckedChange?: (checked: boolean) => void;
}

export interface PixelToggleEngine {
  update: (next: Partial<PixelToggleOptions>) => void;
  destroy: () => void;
}

const DAY_ANGLE = 0.5;
const SLIDE_STIFFNESS = 224;
const SLIDE_DAMPING = 15.5;
const SHAPE_STIFFNESS = 420;
const SHAPE_DAMPING = 24;
/** A canvas is never drawn denser than this: the glass shader costs per pixel. */
const MAX_DPR = 2;

const restAngle = (checked: boolean) => (checked ? DAY_ANGLE : 0);
const smooth = (progress: number) => progress * progress * (3 - 2 * progress);
const easeOut = (progress: number) => 1 - (1 - progress) ** 3;

type Trigger = "click" | "drag" | "cancel" | "update";

interface Drag {
  id: number;
  startX: number;
  startPosition: number;
  x: number;
  at: number;
  velocity: number;
  active: boolean;
  base: number;
}

interface Move {
  from: number;
  start: number;
  duration: number;
}

interface LightMove extends Move {
  to: number;
}

/**
 * Attaches the toggle to a button. It makes its own two canvases inside the
 * button (the glass one and the 2D fallback) and removes them in `destroy`,
 * so that React's development double mount gets fresh canvases and a fresh
 * WebGL2 context, and a context lost on a reused canvas never shows only the
 * fallback.
 */
export function mountPixelToggle(
  control: HTMLButtonElement,
  initial: PixelToggleOptions,
): PixelToggleEngine {
  const knob = control.querySelector<HTMLElement>(".pixel-knob");
  const owner = control.ownerDocument;
  const browser = window;
  let options: PixelToggleOptions = { sound: true, ...initial };
  let checked = options.checked;

  const glassCanvas = owner.createElement("canvas");
  glassCanvas.className = "pixel-glass";
  const effectsCanvas = owner.createElement("canvas");
  effectsCanvas.className = "pixel-effects";
  for (const canvas of [glassCanvas, effectsCanvas]) {
    canvas.setAttribute("aria-hidden", "true");
    canvas.hidden = true;
  }
  control.prepend(glassCanvas);
  control.append(effectsCanvas);

  const particles = createPixelParticles();
  const click = createClick();
  const cleanups: (() => void)[] = [];
  const listen = <K extends keyof HTMLElementEventMap>(
    target: HTMLElement,
    type: K,
    handler: (event: HTMLElementEventMap[K]) => void,
  ) => {
    target.addEventListener(type, handler);
    cleanups.push(() => {
      target.removeEventListener(type, handler);
    });
  };

  let renderer: Renderer | null = null;
  let chosen = false;
  let layout: Layout | undefined;
  let cssSize: { width: number; height: number } | undefined;
  let lastFrame: Frame | undefined;

  let position = Number(checked);
  let theme = position;
  let phase = restAngle(checked);
  let speed = 0;
  let stretch = 0;
  let stretchSpeed = 0;
  let press = 0;
  let agitation = 0;
  let colorMove: Move | undefined;
  let lightMove: LightMove | undefined;
  let drag: Drag | undefined;
  let pointer: (Pointer & { at: number }) | undefined;
  let frame = 0;
  let lastTime = 0;
  let suppressClick = false;
  let destroyed = false;

  const reduced = () => prefersReducedMotion();
  const sized = () => layout !== undefined;

  function render(box: Box, scatter: number, transit: number) {
    lastFrame = { box, theme: clamp(theme), phase, transit, scatter };
    renderer?.paint(lastFrame, particles);
  }

  function useCanvasPainter() {
    renderer?.destroy();
    renderer = knob ? createCanvasRenderer(effectsCanvas, control, knob) : null;
    glassCanvas.hidden = true;
    effectsCanvas.hidden = !renderer;
    if (renderer) control.dataset.renderer = "2d";
    else delete control.dataset.renderer;
  }

  /** The first time the control has a size: glass if the browser can, else the 2D painter. */
  function choosePainter() {
    chosen = true;
    renderer = createGlassRenderer(glassCanvas, () => {
      // A lost context draws nothing for good, so change over to the 2D painter.
      if (destroyed) return;
      useCanvasPainter();
      if (layout && renderer) {
        renderer.resize(layout);
        if (lastFrame) renderer.paint(lastFrame, particles);
      }
    });
    if (renderer) {
      glassCanvas.hidden = false;
      effectsCanvas.hidden = true;
      control.dataset.renderer = "glass";
    } else {
      useCanvasPainter();
    }
  }

  /** Called with the control's CSS size (nothing, to keep the last) and when the device pixel ratio may have changed. */
  function measure(width?: number, height?: number) {
    if (destroyed) return;
    if (width !== undefined && height !== undefined)
      cssSize = { width, height };
    if (!cssSize || cssSize.width <= 0 || cssSize.height <= 0) {
      // The top-bar slot is display none under 640 px: draw nothing until it has a size.
      // An animation that was running cannot finish unseen, so it ends where it is going.
      if (layout) {
        layout = undefined;
        snap();
      }
      return;
    }
    const next: Layout = {
      width: cssSize.width,
      height: cssSize.height,
      scale: cssSize.width / TRACK_WIDTH,
      dpr: Math.min(MAX_DPR, browser.devicePixelRatio || 1),
    };
    if (
      layout?.width === next.width &&
      layout.height === next.height &&
      layout.dpr === next.dpr
    ) {
      return;
    }
    if (!chosen) choosePainter();
    layout = next;
    renderer?.resize(next);
    if (lastFrame) renderer?.paint(lastFrame, particles);
  }

  function stop() {
    if (frame) browser.cancelAnimationFrame(frame);
    frame = 0;
    lastTime = 0;
  }

  function snap() {
    stop();
    position = theme = Number(checked);
    phase = restAngle(checked);
    speed = stretch = stretchSpeed = press = agitation = 0;
    colorMove = lightMove = undefined;
    particles.assign(position, true);
    render(knobGeometry(position, stretch, press), 0, 0);
  }

  function requestFrame() {
    if (!frame && !owner.hidden && !reduced() && sized()) {
      frame = browser.requestAnimationFrame(tick);
    }
  }

  function tick(now: number) {
    frame = 0;
    const dt = lastTime ? clamp((now - lastTime) / 1e3, 1e-3, 0.033) : 1 / 60;
    lastTime = now;
    const substep = dt / 4;
    const target = Number(checked);
    let transit = 0;
    if (drag?.active) {
      const positionTheme = 1 / (1 + Math.exp(-(position - 0.5) / 0.07));
      theme = mix(theme, positionTheme, 1 - Math.exp(-dt * 14));
      phase = mix(
        phase,
        drag.base + clamp(position) * DAY_ANGLE,
        1 - Math.exp(-dt * 18),
      );
      speed *= Math.exp(-dt * 16);
      transit = 0.5;
    } else {
      if (colorMove) {
        const p = clamp((now - colorMove.start) / colorMove.duration);
        theme = mix(colorMove.from, target, smooth(p));
        if (p === 1) colorMove = undefined;
      }
      if (lightMove) {
        const p = clamp((now - lightMove.start) / lightMove.duration);
        phase = mix(lightMove.from, lightMove.to, easeOut(p));
        transit = Math.min(1, p * 8) * (1 - p) ** 2.2;
        if (p === 1) lightMove = undefined;
      }
      for (let i = 0; i < 4; i++) {
        speed +=
          ((target - position) * SLIDE_STIFFNESS - speed * SLIDE_DAMPING) *
          substep;
        position += speed * substep;
      }
      if (Math.abs(position - target) < 1e-4 && Math.abs(speed) < 1e-3) {
        position = target;
        speed = 0;
      }
    }
    const stretchGoal = Math.min(0.18, Math.abs(speed) * 0.024);
    for (let i = 0; i < 4; i++) {
      stretchSpeed +=
        ((stretchGoal - stretch) * SHAPE_STIFFNESS -
          stretchSpeed * SHAPE_DAMPING) *
        substep;
      stretch += stretchSpeed * substep;
    }
    if (
      !stretchGoal &&
      Math.abs(stretch) < 1e-4 &&
      Math.abs(stretchSpeed) < 1e-3
    ) {
      stretch = stretchSpeed = 0;
    }
    const pressTarget = Number(Boolean(drag));
    press = mix(press, pressTarget, 1 - Math.exp(-dt * (drag ? 30 : 21)));
    if (Math.abs(press - pressTarget) < 1e-3) press = pressTarget;
    agitation = Math.max(drag && !drag.active ? 0.3 : 0, agitation - dt * 7);
    const box = knobGeometry(position, stretch, press);
    const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    const livePointer = pointer && now - pointer.at < 160 ? pointer : undefined;
    const { scatter, moving } = particles.advance(
      clamp(theme),
      agitation,
      livePointer,
      center,
      dt,
    );
    render(box, scatter, transit);
    if (
      moving ||
      agitation ||
      position !== target ||
      stretch ||
      press !== pressTarget ||
      colorMove ||
      lightMove ||
      drag?.active
    ) {
      requestFrame();
    } else {
      lastTime = 0;
    }
  }

  function change(next: boolean, trigger: Trigger, trusted = false) {
    const changed = next !== checked;
    checked = next;
    if (reduced() || owner.hidden || !sized()) snap();
    else {
      const now = browser.performance.now();
      const clicking = trigger === "click";
      const rest = restAngle(checked);
      const finalPhase = clicking
        ? Math.ceil(phase + 0.1 - rest) + rest
        : Math.round(phase - rest) + rest;
      colorMove = {
        from: theme,
        start: now,
        duration: clicking ? (checked ? 100 : 70) : 140,
      };
      lightMove = {
        from: phase,
        to: finalPhase,
        start: now + (clicking ? 10 : 0),
        duration: clicking ? 900 : 700,
      };
      if (clicking) {
        press = Math.max(press, 0.65);
        agitation = 0.8;
        particles.burst(1.1);
      }
      requestFrame();
    }
    if (changed && trigger !== "update" && trigger !== "cancel") {
      // Only a person's own gesture is heard: a script's click stays silent.
      if (trusted && options.sound !== false) click.play(checked);
      options.onCheckedChange?.(checked);
    }
  }

  /** A pointer's place on the track, in track units: its box is measured now, so a transform on a parent is allowed. */
  function point(event: PointerEvent) {
    const rect = control.getBoundingClientRect();
    const scale = rect.width / TRACK_WIDTH || 1;
    return {
      x: (event.clientX - rect.left) / scale,
      y: (event.clientY - rect.top) / scale,
    };
  }

  listen(control, "pointerdown", (event) => {
    if (!event.isPrimary || event.button !== 0 || drag) return;
    const local = point(event);
    drag = {
      id: event.pointerId,
      startX: local.x,
      startPosition: position,
      x: local.x,
      at: browser.performance.now(),
      velocity: 0,
      active: false,
      base: 0,
    };
    suppressClick = false;
    try {
      control.setPointerCapture(event.pointerId);
    } catch {
      // A synthetic pointer has nothing to capture. The drag still works while it stays over the switch.
    }
    if (!reduced()) {
      agitation = 0.3;
      particles.burst(0.35);
      requestFrame();
    }
  });

  listen(control, "pointermove", (event) => {
    if (drag && event.pointerId !== drag.id) return;
    const local = point(event);
    pointer =
      event.pointerType === "touch" && !drag
        ? undefined
        : { ...local, at: browser.performance.now() };
    if (drag) {
      const delta = local.x - drag.startX;
      if (
        !drag.active &&
        Math.abs(delta) >
          pxToUnits(DRAG_SLOP_PX, control.getBoundingClientRect().width)
      ) {
        drag.active = true;
        drag.base = Math.round(phase - position * DAY_ANGLE);
        control.dataset.dragging = "";
        colorMove = lightMove = undefined;
      }
      if (drag.active) {
        const raw = drag.startPosition + delta / TRAVEL;
        const next =
          raw < 0
            ? -((-raw) ** 0.6) * 0.05
            : raw > 1
              ? 1 + (raw - 1) ** 0.6 * 0.05
              : raw;
        const now = browser.performance.now();
        const elapsed = Math.max(1, now - drag.at);
        drag.velocity = mix(drag.velocity, (local.x - drag.x) / elapsed, 0.5);
        speed = mix(speed, ((next - position) * 1e3) / elapsed, 0.5);
        drag.x = local.x;
        drag.at = now;
        position = next;
        agitation = Math.max(
          agitation,
          clamp(Math.abs(drag.velocity) * 1.6) * 0.9,
        );
        if (reduced()) {
          theme = Number(next >= 0.5);
          phase = drag.base + clamp(next) * DAY_ANGLE;
          particles.assign(theme, true);
          render(knobGeometry(position, stretch, press), 0, 0);
        }
      }
    }
    requestFrame();
  });

  listen(control, "pointerleave", () => {
    pointer = undefined;
    requestFrame();
  });

  function finishDrag(event: PointerEvent) {
    if (drag?.id !== event.pointerId) return;
    const completed = event.type === "pointerup";
    const { active, velocity, at } = drag;
    drag = undefined;
    if (event.pointerType === "touch" || !completed) pointer = undefined;
    delete control.dataset.dragging;
    if (!active) return;
    suppressClick = true;
    const fling =
      browser.performance.now() - at <= 120 &&
      Math.abs(velocity) >
        pxToUnits(FLING_PX_PER_MS, control.getBoundingClientRect().width);
    const next = completed ? (fling ? velocity > 0 : position >= 0.5) : checked;
    change(next, completed ? "drag" : "cancel", madeByPerson(event));
  }
  listen(control, "pointerup", finishDrag);
  listen(control, "pointercancel", finishDrag);
  listen(control, "lostpointercapture", finishDrag);

  // A keyboard click has detail 0 and must always switch it. Only the click
  // that follows a drag (detail 1 or more) is dropped.
  listen(control, "click", (event) => {
    if (event.detail && suppressClick) return;
    change(!checked, "click", madeByPerson(event));
  });

  const onVisibility = () => {
    if (!owner.hidden) return;
    drag = pointer = undefined;
    delete control.dataset.dragging;
    snap();
  };
  owner.addEventListener("visibilitychange", onVisibility);
  cleanups.push(() => {
    owner.removeEventListener("visibilitychange", onVisibility);
  });

  if (typeof browser.matchMedia === "function") {
    const query = browser.matchMedia("(prefers-reduced-motion: reduce)");
    const onMotion = () => {
      if (reduced()) snap();
    };
    query.addEventListener("change", onMotion);
    cleanups.push(() => {
      query.removeEventListener("change", onMotion);
    });
  }

  // Browser zoom changes the device pixel ratio, not the CSS size.
  const onResize = () => {
    measure();
  };
  browser.addEventListener("resize", onResize);
  cleanups.push(() => {
    browser.removeEventListener("resize", onResize);
  });

  const observer = new ResizeObserver(([entry]) => {
    if (entry) measure(entry.contentRect.width, entry.contentRect.height);
  });
  observer.observe(control);
  cleanups.push(() => {
    observer.disconnect();
  });

  snap();
  const start = control.getBoundingClientRect();
  measure(start.width, start.height);

  return {
    update(next) {
      if (destroyed) return;
      options = { ...options, ...next };
      if (typeof next.checked === "boolean" && next.checked !== checked) {
        if (drag) {
          suppressClick = true;
          try {
            control.releasePointerCapture(drag.id);
          } catch {
            // Nothing was captured.
          }
        }
        drag = pointer = undefined;
        delete control.dataset.dragging;
        change(next.checked, "update");
      } else if (reduced() && !drag) snap();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      stop();
      for (const cleanup of cleanups.splice(0)) cleanup();
      renderer?.destroy();
      renderer = null;
      glassCanvas.remove();
      effectsCanvas.remove();
      delete control.dataset.renderer;
      delete control.dataset.dragging;
      // The 2D painter wrote these on a button and a knob that React keeps.
      for (const name of Object.keys(paletteVariables(0))) {
        control.style.removeProperty(name);
      }
      if (knob) {
        for (const side of ["left", "top", "width", "height"]) {
          knob.style.removeProperty(side);
        }
      }
      click.close();
    },
  };
}
