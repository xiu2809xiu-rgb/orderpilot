import type { Raster } from "./raster.js";

/** A hash of a position in [0, 1): the paper's grain and dirt come from here, not from a seed. */
function grain(x: number, y: number, salt: number): number {
  let h =
    Math.imul(x, 374761393) ^
    Math.imul(y, 668265263) ^
    Math.imul(salt, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const SPECK_CELL = 26;

/** Grey paper, uneven light, grain, a copier streak and dust. Returns 8-bit pixels. */
export function developed(raster: Raster): Uint8Array {
  const { width: WIDTH, height: HEIGHT } = raster;
  const out = new Uint8Array(WIDTH * HEIGHT);
  const { value } = raster;
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const at = y * WIDTH + x;
      // A touch of softness: the scanner lens does not resolve single pixels.
      const left = value[at - (x > 0 ? 1 : 0)] ?? 1;
      const right = value[at + (x < WIDTH - 1 ? 1 : 0)] ?? 1;
      const up = value[at - (y > 0 ? WIDTH : 0)] ?? 1;
      const down = value[at + (y < HEIGHT - 1 ? WIDTH : 0)] ?? 1;
      const soft = 0.5 * (value[at] ?? 1) + 0.125 * (left + right + up + down);
      const dx = x / WIDTH - 0.45;
      const dy = y / HEIGHT - 0.5;
      const light = 0.85 - 0.16 * (dx * dx + dy * dy) - 0.04 * (x / WIDTH);
      const noise = (grain(x, y, 1) + grain(x, y, 2) - 1) * 0.018;
      const streak =
        x === Math.round(WIDTH * 0.83) || x === Math.round(WIDTH * 0.83) + 1
          ? -0.035
          : 0;
      out[at] = Math.round(
        Math.min(1, Math.max(0, soft * (light + noise + streak))) * 255,
      );
    }
  }
  for (let cy = 0; cy < Math.ceil(HEIGHT / SPECK_CELL); cy++) {
    for (let cx = 0; cx < Math.ceil(WIDTH / SPECK_CELL); cx++) {
      if (grain(cx, cy, 3) > 0.07) continue;
      const px = cx * SPECK_CELL + grain(cx, cy, 4) * SPECK_CELL;
      const py = cy * SPECK_CELL + grain(cx, cy, 5) * SPECK_CELL;
      const radius = 0.7 + grain(cx, cy, 6) * 1.1;
      const darkness = 0.35 + grain(cx, cy, 7) * 0.45;
      for (let y = Math.floor(py - 3); y <= Math.ceil(py + 3); y++) {
        for (let x = Math.floor(px - 3); x <= Math.ceil(px + 3); x++) {
          if (x < 0 || y < 0 || x >= WIDTH || y >= HEIGHT) continue;
          const distance = Math.sqrt((x - px) * (x - px) + (y - py) * (y - py));
          if (distance > radius + 0.8) continue;
          const cover = Math.min(1, radius + 0.8 - distance) * darkness;
          const at = y * WIDTH + x;
          out[at] = Math.round((out[at] ?? 0) * (1 - cover));
        }
      }
    }
  }
  return out;
}
