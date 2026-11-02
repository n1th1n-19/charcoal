// Turns a glyph grid into pixels. Uses OffscreenCanvas, so worker or main thread only.
import { RAMP } from "./pipeline.ts";

export const CELL_W = 8;
export const CELL_H = 15;
const FONT = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

export const GROUNDS = {
  dark: { fill: [13, 17, 23], ink: [201, 209, 217] },
  white: { fill: [255, 255, 255], ink: [0, 0, 0] },
} as const;

export const ANSI16 = [
  [0, 0, 0], [128, 0, 0], [0, 128, 0], [128, 128, 0], [0, 0, 128], [128, 0, 128], [0, 128, 128], [192, 192, 192],
  [128, 128, 128], [255, 0, 0], [0, 255, 0], [255, 255, 0], [0, 0, 255], [255, 0, 255], [0, 255, 255], [255, 255, 255],
];

export type Mode = "Mono" | "16 colors" | "Green" | "Amber" | "Original colors";

// The color each cell is drawn in, for one mode.
export function cellColor(mode: Mode, rgb: Uint8Array, i: number, ink: readonly number[]): readonly number[] {
  if (mode === "Mono") return ink;
  if (mode === "Green") return [51, 255, 102];
  if (mode === "Amber") return [255, 176, 0];
  const px = [rgb[i * 3], rgb[i * 3 + 1], rgb[i * 3 + 2]];
  if (mode === "Original colors") return px;
  let best = ANSI16[0];
  let score = Infinity;
  for (const c of ANSI16) {
    const d = (c[0] - px[0]) ** 2 + (c[1] - px[1]) ** 2 + (c[2] - px[2]) ** 2;
    if (d < score) {
      score = d;
      best = c;
    }
  }
  return best;
}

let atlas: Uint8Array[] | null = null;

function glyphs() {
  if (atlas) return atlas;
  const canvas = new OffscreenCanvas(CELL_W, CELL_H);
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.font = `${CELL_H * 0.86}px ${FONT}`;
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#fff";
  atlas = [...RAMP].map((ch) => {
    ctx.clearRect(0, 0, CELL_W, CELL_H);
    ctx.fillText(ch, 0, CELL_H * 0.74);
    const { data } = ctx.getImageData(0, 0, CELL_W, CELL_H);
    return Uint8Array.from({ length: CELL_W * CELL_H }, (_, i) => data[i * 4 + 3]);
  });
  return atlas;
}

// One pixel loop for preview and PNG.
export function rasterize(
  cols: number,
  rows: number,
  cells: Uint8Array,
  rgb: Uint8Array,
  mode: Mode,
  fill: readonly number[],
  ink: readonly number[],
) {
  const masks = glyphs();
  const W = cols * CELL_W;
  const H = rows * CELL_H;
  const img = new ImageData(W, H);
  const px = img.data;
  for (let i = 0; i < W * H; i++) {
    px[i * 4] = fill[0];
    px[i * 4 + 1] = fill[1];
    px[i * 4 + 2] = fill[2];
    px[i * 4 + 3] = 255;
  }
  for (let i = 0; i < cells.length; i++) {
    if (cells[i] === 0) continue;
    const mask = masks[cells[i]];
    const color = cellColor(mode, rgb, i, ink);
    const left = (i % cols) * CELL_W;
    const top = Math.floor(i / cols) * CELL_H;
    for (let y = 0; y < CELL_H; y++) {
      for (let x = 0; x < CELL_W; x++) {
        const a = mask[y * CELL_W + x];
        if (!a) continue;
        const o = ((top + y) * W + left + x) * 4;
        px[o] += ((color[0] - px[o]) * a) / 255;
        px[o + 1] += ((color[1] - px[o + 1]) * a) / 255;
        px[o + 2] += ((color[2] - px[o + 2]) * a) / 255;
      }
    }
  }
  return img;
}
