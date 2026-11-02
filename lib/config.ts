// Shared constants and small helpers for the app shell.
import type { Mode } from "./render.ts";
import type { Route, Settings } from "./worker.ts";

export const stationsFor = (route: Route) => ["Specimen", "Kiln", route === "3d" ? "Maquette" : "Easel", "Fixative"];
export const STAGES = ["Remove background", "Grayscale", "CLAHE", "Invert and lift", "Composite", "Sharpen", "Contrast", "Resample", "Sample color", "Map to glyphs"];
// The 3D route shares the image stages, then estimates depth and builds frames instead of a single grid.
export const STAGES_3D = [...STAGES.slice(0, STAGES.indexOf("Contrast") + 1), "Estimate depth", "Resample", "Sample color", "Build frames"];
export const stagesFor = (route: Route) => (route === "3d" ? STAGES_3D : STAGES);
export const STATION_COUNT = 4;
export const MODES: Mode[] = ["Mono", "16 colors", "Green", "Amber", "Original colors"];
export const MIN_STAGE_MS = 240;
export const LOADER_MIN_MS = 1400;
export const SAVING_MIN_MS = 250;
export const PICKING_MAX_MS = 1200;
// A list, because Chromium opens its file window slowly for the image/* wildcard.
export const IMAGE_TYPES = "image/jpeg,image/png,image/webp,image/gif,image/avif,image/bmp";
export const READY = { label: "Drawing ready", pct: 100 };
export const BURN_NEUTRAL = 550;
export const MAX_CANVAS_SIDE = 16384;
export const KB = 1024;
export const STATION = "station relative flex h-full shrink-0 w-dvw transition-opacity duration-200 p-4 phone:pt-9 md:p-10";

export type Source = { url: string; name: string; w: number; h: number };
export type ProgressState = { label: string; pct: number };
export type TooLarge = { file: File | Blob; name: string; w: number; h: number };

export const DEFAULTS: Settings = {
  cols: 240,
  gamma: 0.8,
  floor: 0.8,
  contrast: 1.05,
  clahe: 2.6,
  sharpen: 140,
  invert: true,
  removeBg: false,
  mode: "Original colors",
  ground: "dark",
  burn: BURN_NEUTRAL,
  preset: "turntable",
  depth: 0.8,
  motion: 1,
  fps: 12,
  frames: 48,
  cols3d: 120,
  cutoff: 0.15,
};

// The sample is a dark subject on a pale ground, so ink on white reads as a positive.
export const SAMPLE: Settings = { ...DEFAULTS, invert: false, gamma: 1.18, ground: "white" };

// Phones run out of memory far sooner than desktops. ponytail: fixed caps, measure real devices to refine.
export const safePixels = () => (navigator.maxTouchPoints > 0 ? 16e6 : 64e6);

// One dial over three settings. The middle of its range leaves the base values unchanged.
export function burnPatch(c: number, invert: boolean) {
  const t = (c - BURN_NEUTRAL) / 350;
  const round = (v: number) => Math.round(v * 100) / 100;
  return { burn: c, gamma: round((invert ? 0.8 : 1.18) * (1 - 0.3 * t)), contrast: round(1.05 * (1 + 0.3 * t)), clahe: round(2.6 * (1 + 0.6 * t)) };
}

export const sizeLabel = (bytes: number) => (bytes < KB * KB ? `${Math.round(bytes / KB)} KB` : `${(bytes / KB / KB).toFixed(1)} MB`);

export function save(blob: Blob, name: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}
