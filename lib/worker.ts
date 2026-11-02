// Holds the image and every stage's output, and reruns only from the stage a change touched.
import * as P from "@/lib/pipeline";
import { DEPTH, runtime, session, U2NET } from "@/lib/models";
import { GROUNDS, Mode, rasterize } from "@/lib/render";
import { Frame, OVERSAMPLE, Preset, renderLoop } from "@/lib/scene3d";

const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];

export type Settings = {
  cols: number;
  gamma: number;
  floor: number;
  contrast: number;
  clahe: number;
  sharpen: number;
  invert: boolean;
  removeBg: boolean;
  mode: Mode;
  ground: keyof typeof GROUNDS;
  burn: number;
  preset: Preset;
  depth: number;
  motion: number;
  fps: number;
  frames: number;
  cols3d: number;
  cutoff: number;
};

export type Route = "2d" | "3d";

export type Request =
  | { type: "load"; bitmap: ImageBitmap }
  | { type: "render"; id: number; settings: Settings; route: Route };

export type Reply =
  | { type: "stage"; name: string }
  | { type: "download"; loaded: number; total: number }
  | { type: "error"; message: string; model?: boolean }
  | {
      type: "done";
      id: number;
      cols: number;
      rows: number;
      cells: Uint8Array;
      rgb: Uint8Array;
      gridGray: Uint8Array;
      mono: ImageBitmap;
      color: ImageBitmap;
      ms: number;
    }
  | { type: "frames"; id: number; cols: number; rows: number; fps: number; frames: Frame[] };

const post = (m: Reply, transfer: Transferable[] = []) => (self as unknown as Worker).postMessage(m, transfer);

let W = 0;
let H = 0;
let rgba = new Uint8ClampedArray();
let sourceAlpha: Uint8Array | null = null;
let modelMask: Uint8Array | null = null;

const cache = new Map<string, { key: string; value: Uint8Array }>();

function stage(name: string, key: string, run: () => Uint8Array) {
  const hit = cache.get(name);
  if (hit && hit.key === key) return hit.value;
  post({ type: "stage", name });
  const value = run();
  cache.set(name, { key, value });
  return value;
}

const progress = (loaded: number, total: number) => post({ type: "download", loaded, total });

// rembg's u2net session: 320 Lanczos, scale by max, ImageNet normalise, take d0, min-max, Lanczos back.
async function predictMask() {
  const net = await session(U2NET, progress);
  const ort = await runtime();
  const rgb = new Uint8Array(W * H * 3);
  for (let i = 0; i < W * H; i++) {
    rgb[i * 3] = rgba[i * 4];
    rgb[i * 3 + 1] = rgba[i * 4 + 1];
    rgb[i * 3 + 2] = rgba[i * 4 + 2];
  }
  const small = P.resize(rgb, W, H, 320, 320, 3);
  const top = Math.max(small.reduce((a, b) => Math.max(a, b), 0), 1e-6);
  const input = new Float32Array(3 * 320 * 320);
  for (let i = 0; i < 320 * 320; i++) {
    for (let c = 0; c < 3; c++) input[c * 320 * 320 + i] = (small[i * 3 + c] / top - MEAN[c]) / STD[c];
  }
  const tensor = new ort.Tensor("float32", input, [1, 3, 320, 320]);
  const out = await net.run({ [net.inputNames[0]]: tensor });
  const pred = Object.values(out)[0].data;
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < 320 * 320; i++) {
    lo = Math.min(lo, pred[i]);
    hi = Math.max(hi, pred[i]);
  }
  const mask = new Uint8Array(320 * 320);
  for (let i = 0; i < mask.length; i++) mask[i] = Math.trunc(Math.max(0, Math.min(1, (pred[i] - lo) / (hi - lo))) * 255);
  return P.resize(mask, 320, 320, W, H);
}

// Depth Anything V2: short side near 364 in multiples of 14, ImageNet normalise, min-max to 0..255.
// Smaller than the model's 518 because ASCII grids need far less detail, and it runs about twice as fast.
const DEPTH_SHORT = 364;
let depthMap: { gen: number; w: number; h: number; data: Uint8Array } | null = null;

async function estimateDepth(gen: number) {
  if (depthMap && depthMap.gen === gen) return depthMap;
  const net = await session(DEPTH, progress);
  const ort = await runtime();
  const scale = DEPTH_SHORT / Math.min(W, H);
  const dw = Math.max(14, Math.round((W * scale) / 14) * 14);
  const dh = Math.max(14, Math.round((H * scale) / 14) * 14);
  const rgb = new Uint8Array(W * H * 3);
  for (let i = 0; i < W * H; i++) {
    rgb[i * 3] = rgba[i * 4];
    rgb[i * 3 + 1] = rgba[i * 4 + 1];
    rgb[i * 3 + 2] = rgba[i * 4 + 2];
  }
  const small = P.resize(rgb, W, H, dw, dh, 3);
  const input = new Float32Array(3 * dw * dh);
  for (let i = 0; i < dw * dh; i++) {
    for (let c = 0; c < 3; c++) input[c * dw * dh + i] = (small[i * 3 + c] / 255 - MEAN[c]) / STD[c];
  }
  const out = await net.run({ [net.inputNames[0]]: new ort.Tensor("float32", input, [1, 3, dh, dw]) });
  const pred = Object.values(out)[0].data;
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < pred.length; i++) {
    lo = Math.min(lo, pred[i]);
    hi = Math.max(hi, pred[i]);
  }
  const data = new Uint8Array(dw * dh);
  for (let i = 0; i < data.length; i++) data[i] = Math.round(((pred[i] - lo) / (hi - lo || 1)) * 255);
  return (depthMap = { gen, w: dw, h: dh, data });
}

// Gives queued messages a turn. A newer request or a new image makes the current render obsolete.
const superseded = async (id: number, gen: number) => {
  await new Promise((r) => setTimeout(r, 0));
  return id !== latest || gen !== generation;
};

async function render(id: number, s: Settings, route: Route) {
  const t0 = performance.now();
  const gen = generation;
  if (s.removeBg && !modelMask) {
    post({ type: "stage", name: "Remove background" });
    try {
      const predicted = await predictMask();
      if (gen !== generation) return;
      modelMask = predicted;
    } catch (e) {
      post({
        type: "error",
        model: true,
        message: `The background model did not load (${e instanceof Error ? e.message : e}). Everything else still works without it.`,
      });
      s = { ...s, removeBg: false };
    }
  }
  const mask = s.removeBg ? modelMask : sourceAlpha;
  const maskKey = s.removeBg ? "model" : sourceAlpha ? "source" : "none";

  const gray = stage("Grayscale", maskKey, () => P.grayscale(mask ? P.cutout(rgba, mask) : rgba, W, H));
  if (await superseded(id, gen)) return;
  const claheKey = `${maskKey}|${s.clahe}`;
  const local = stage("CLAHE", claheKey, () => (s.clahe > 0 ? P.clahe(gray, W, H, s.clahe) : gray));
  if (await superseded(id, gen)) return;
  const liftKey = `${claheKey}|${s.invert}`;
  const lifted = stage("Invert and lift", liftKey, () => P.lift(s.invert ? P.invert(local) : local));
  if (await superseded(id, gen)) return;
  const comp = stage("Composite", liftKey, () => (mask ? P.compositeWhite(lifted, mask, W, H) : lifted));
  if (await superseded(id, gen)) return;
  const sharpKey = `${liftKey}|${s.sharpen}`;
  const sharp = stage("Sharpen", sharpKey, () => P.unsharp(comp, W, H, 2, s.sharpen, 2));
  if (await superseded(id, gen)) return;
  const toneKey = `${sharpKey}|${s.contrast}`;
  const toned = stage("Contrast", toneKey, () => P.contrast(sharp, s.contrast));
  if (await superseded(id, gen)) return;
  if (route === "3d") return render3d(id, gen, s, toned, mask, toneKey);
  const rows = P.rowsFor(W, H, s.cols);
  const gridKey = `${toneKey}|${s.cols}`;
  const grid = stage("Resample", gridKey, () => P.resize(toned, W, H, s.cols, rows));
  if (await superseded(id, gen)) return;
  const rgb = stage("Sample color", String(s.cols), () => {
    const source = new Uint8Array(W * H * 3);
    for (let i = 0; i < W * H; i++) {
      source[i * 3] = rgba[i * 4];
      source[i * 3 + 1] = rgba[i * 4 + 1];
      source[i * 3 + 2] = rgba[i * 4 + 2];
    }
    return P.resize(source, W, H, s.cols, rows, 3);
  });
  if (await superseded(id, gen)) return;
  post({ type: "stage", name: "Map to glyphs" });
  const cells = P.mapGlyphs(grid, s.gamma, s.floor);

  const { fill, ink } = GROUNDS[s.ground];
  const bitmap = (mode: Mode) => {
    const img = rasterize(s.cols, rows, cells, rgb, mode, fill, ink);
    const c = new OffscreenCanvas(img.width, img.height);
    c.getContext("2d")!.putImageData(img, 0, 0);
    return c.transferToImageBitmap();
  };
  const mono = bitmap("Mono");
  const color = bitmap(s.mode);
  post(
    { type: "done", id, cols: s.cols, rows, cells: cells.slice(), rgb: rgb.slice(), gridGray: grid.slice(), mono, color, ms: performance.now() - t0 },
    [mono, color],
  );
}

async function render3d(id: number, gen: number, s: Settings, toned: Uint8Array, mask: Uint8Array | null, toneKey: string) {
  post({ type: "stage", name: "Estimate depth" });
  let depth;
  try {
    depth = await estimateDepth(gen);
  } catch (e) {
    post({ type: "error", message: `The depth model did not load (${e instanceof Error ? e.message : e}). Check your connection and try again.` });
    return;
  }
  if (await superseded(id, gen)) return;
  const cols = s.cols3d;
  const rows = P.rowsFor(W, H, cols);
  const [fw, fh] = [cols * OVERSAMPLE, rows * OVERSAMPLE];
  const lum = stage("Resample", `3d|${toneKey}|${cols}`, () => P.resize(toned, W, H, fw, fh));
  if (await superseded(id, gen)) return;
  const rgb = stage("Sample color", `3d|${cols}`, () => {
    const source = new Uint8Array(W * H * 3);
    for (let i = 0; i < W * H; i++) {
      source[i * 3] = rgba[i * 4];
      source[i * 3 + 1] = rgba[i * 4 + 1];
      source[i * 3 + 2] = rgba[i * 4 + 2];
    }
    return P.resize(source, W, H, fw, fh, 3);
  });
  if (await superseded(id, gen)) return;
  post({ type: "stage", name: "Build frames" });
  const field = {
    w: fw,
    h: fh,
    lum,
    rgb,
    depth: P.resize(depth.data, depth.w, depth.h, fw, fh),
    keep: mask ? P.resize(mask, W, H, fw, fh) : null,
  };
  const motion = { preset: s.preset, depth: s.depth, motion: s.motion, cutoff: s.cutoff, gamma: s.gamma, floor: s.floor, darkGround: s.ground === "dark" };
  const frames = renderLoop(field, cols, rows, motion, s.frames);
  post({ type: "frames", id, cols, rows, fps: s.fps, frames }, frames.flatMap((f) => [f.cells.buffer, f.rgb.buffer]));
}

let latest = 0;
let generation = 0;
let running = false;
let pending: { settings: Settings; route: Route } | null = null;

// Drops every request but the newest, so dragging a slider cannot queue work.
async function drain() {
  if (running) return;
  running = true;
  while (pending) {
    const { settings, route } = pending;
    pending = null;
    try {
      await render(latest, settings, route);
    } catch (e) {
      post({ type: "error", message: `This image is too large for this device to process (${W} by ${H}). ${e instanceof Error ? e.message : ""}` });
    }
  }
  running = false;
}

self.onmessage = (e: MessageEvent<Request>) => {
  const m = e.data;
  if (m.type === "load") {
    W = m.bitmap.width;
    H = m.bitmap.height;
    try {
      const c = new OffscreenCanvas(W, H);
      const ctx = c.getContext("2d", { willReadFrequently: true })!;
      ctx.drawImage(m.bitmap, 0, 0);
      rgba = ctx.getImageData(0, 0, W, H).data;
    } catch {
      post({ type: "error", message: `This image is too large for this device to read (${W} by ${H}). Resize it and try again.` });
      return;
    }
    m.bitmap.close();
    generation++;
    depthMap = null;
    cache.clear();
    modelMask = null;
    sourceAlpha = null;
    for (let i = 3; i < rgba.length; i += 4) {
      if (rgba[i] < 255) {
        sourceAlpha = Uint8Array.from({ length: W * H }, (_, p) => rgba[p * 4 + 3]);
        break;
      }
    }
    return;
  }
  latest = m.id;
  pending = { settings: m.settings, route: m.route };
  void drain();
};
