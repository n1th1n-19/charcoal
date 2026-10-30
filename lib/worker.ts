// Holds the image and every stage's output, and reruns only from the stage a change touched.
import * as P from "@/lib/pipeline";
import { GROUNDS, Mode, rasterize } from "@/lib/render";

export const MODEL_URL = "/models/u2net.onnx";
const ORT_URL = "/ort/ort.wasm.min.mjs";
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
};

export type Request =
  | { type: "load"; bitmap: ImageBitmap }
  | { type: "render"; id: number; settings: Settings };

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
    };

const post = (m: Reply, transfer: Transferable[] = []) => (self as unknown as Worker).postMessage(m, transfer);

let W = 0;
let H = 0;
let rgba = new Uint8ClampedArray();
let sourceAlpha: Uint8Array | null = null;
let modelMask: Uint8Array | null = null;
let session: { run(feeds: object): Promise<Record<string, { data: Float32Array }>>; inputNames: string[] } | null = null;
let ort: { Tensor: new (t: string, d: Float32Array, s: number[]) => unknown; env: { wasm: { wasmPaths: string } }; InferenceSession: { create(b: Uint8Array): Promise<typeof session> } } | null = null;

const cache = new Map<string, { key: string; value: Uint8Array }>();

function stage(name: string, key: string, run: () => Uint8Array) {
  const hit = cache.get(name);
  if (hit && hit.key === key) return hit.value;
  post({ type: "stage", name });
  const value = run();
  cache.set(name, { key, value });
  return value;
}

async function loadModel() {
  if (session) return session;
  ort = await import(/* turbopackIgnore: true */ /* webpackIgnore: true */ ORT_URL);
  ort!.env.wasm.wasmPaths = "/ort/";
  const res = await fetch(MODEL_URL);
  if (!res.ok || !res.body) throw new Error(`model request returned ${res.status}`);
  const total = Number(res.headers.get("content-length")) || 0;
  const reader = res.body.getReader();
  const parts: Uint8Array[] = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value);
    loaded += value.length;
    post({ type: "download", loaded, total });
  }
  const bytes = new Uint8Array(loaded);
  let at = 0;
  for (const p of parts) {
    bytes.set(p, at);
    at += p.length;
  }
  session = await ort!.InferenceSession.create(bytes);
  return session!;
}

// rembg's u2net session: 320 Lanczos, scale by max, ImageNet normalise, take d0, min-max, Lanczos back.
async function predictMask() {
  const net = await loadModel();
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
  const tensor = new ort!.Tensor("float32", input, [1, 3, 320, 320]);
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

async function render(id: number, s: Settings) {
  const t0 = performance.now();
  if (s.removeBg && !modelMask) {
    post({ type: "stage", name: "Remove background" });
    try {
      modelMask = await predictMask();
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
  const claheKey = `${maskKey}|${s.clahe}`;
  const local = stage("CLAHE", claheKey, () => (s.clahe > 0 ? P.clahe(gray, W, H, s.clahe) : gray));
  const liftKey = `${claheKey}|${s.invert}`;
  const lifted = stage("Invert and lift", liftKey, () => P.lift(s.invert ? P.invert(local) : local));
  const comp = stage("Composite", liftKey, () => (mask ? P.compositeWhite(lifted, mask, W, H) : lifted));
  const sharpKey = `${liftKey}|${s.sharpen}`;
  const sharp = stage("Sharpen", sharpKey, () => P.unsharp(comp, W, H, 2, s.sharpen, 2));
  const toneKey = `${sharpKey}|${s.contrast}`;
  const toned = stage("Contrast", toneKey, () => P.contrast(sharp, s.contrast));
  const rows = P.rowsFor(W, H, s.cols);
  const gridKey = `${toneKey}|${s.cols}`;
  const grid = stage("Resample", gridKey, () => P.resize(toned, W, H, s.cols, rows));
  const rgb = stage("Sample color", String(s.cols), () => {
    const source = new Uint8Array(W * H * 3);
    for (let i = 0; i < W * H; i++) {
      source[i * 3] = rgba[i * 4];
      source[i * 3 + 1] = rgba[i * 4 + 1];
      source[i * 3 + 2] = rgba[i * 4 + 2];
    }
    return P.resize(source, W, H, s.cols, rows, 3);
  });
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

let latest = 0;
let running = false;
let pending: Settings | null = null;

// Drops every request but the newest, so dragging a slider cannot queue work.
async function drain() {
  if (running) return;
  running = true;
  while (pending) {
    const s = pending;
    pending = null;
    try {
      await render(latest, s);
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
  pending = m.settings;
  void drain();
};
