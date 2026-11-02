// Loads ONNX models for the worker. Each is pinned to a commit, checked against its SHA-256,
// and kept in Cache Storage, because the host's redirect forbids ordinary HTTP caching.

export type ModelSpec = { url: string; sha256: string };

// Pinned to commits so a model cannot change underneath the site.
export const U2NET: ModelSpec = {
  url: "https://huggingface.co/n1th1n-19/charcoal-u2net/resolve/a9f8c0c454f341d4b32ea088f3066cbac1af4421/u2net.onnx",
  sha256: "8d10d2f3bb75ae3b6d527c77944fc5e7dcd94b29809d47a739a7a728a912b491",
};
export const DEPTH: ModelSpec = {
  url: "https://huggingface.co/onnx-community/depth-anything-v2-small/resolve/4472b7362082ad9968fee890ca0f1e5aca36b93d/onnx/model_int8.onnx",
  sha256: "01aa7a23de3f4a0ee1a2bb9997e6918104c85a9f95dea46d27b9b3fb0c6b9001",
};

const CACHE = "charcoal-model-v1";
const ORT_URL = "/ort/ort.wasm.min.mjs";

export type Session = { run(feeds: object): Promise<Record<string, { data: Float32Array; dims: number[] }>>; inputNames: string[] };
export type Ort = {
  Tensor: new (t: string, d: Float32Array, s: number[]) => unknown;
  env: { wasm: { wasmPaths: string } };
  InferenceSession: { create(b: Uint8Array): Promise<Session> };
};

let ort: Ort | null = null;
const sessions = new Map<string, Promise<Session>>();

export async function runtime() {
  if (!ort) {
    ort = (await import(/* turbopackIgnore: true */ /* webpackIgnore: true */ ORT_URL)) as Ort;
    ort.env.wasm.wasmPaths = "/ort/";
  }
  return ort;
}

const sha256 = async (bytes: Uint8Array<ArrayBuffer>) =>
  Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), (v) => v.toString(16).padStart(2, "0")).join("");

async function modelBytes(spec: ModelSpec, onProgress: (loaded: number, total: number) => void) {
  let store: Cache | null = null;
  try {
    store = await caches.open(CACHE);
    const saved = await store.match(spec.url);
    if (saved) {
      const bytes = new Uint8Array(await saved.arrayBuffer());
      if ((await sha256(bytes)) === spec.sha256) return bytes;
      await store.delete(spec.url);
    }
  } catch {
    store = null;
  }
  const res = await fetch(spec.url);
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
    onProgress(loaded, total);
  }
  const bytes = new Uint8Array(loaded);
  let at = 0;
  for (const p of parts) {
    bytes.set(p, at);
    at += p.length;
  }
  if ((await sha256(bytes)) !== spec.sha256) throw new Error("the downloaded file failed its integrity check");
  // Storage can be full or blocked, for example in a private window. The model still works without it.
  await store?.put(spec.url, new Response(bytes, { headers: { "content-type": "application/octet-stream" } })).catch(() => undefined);
  return bytes;
}

// One session per model, shared by every render. A failed load is forgotten so the next try starts fresh.
export function session(spec: ModelSpec, onProgress: (loaded: number, total: number) => void) {
  let loading = sessions.get(spec.url);
  if (!loading) {
    loading = (async () => (await runtime()).InferenceSession.create(await modelBytes(spec, onProgress)))();
    loading.catch(() => sessions.delete(spec.url));
    sessions.set(spec.url, loading);
  }
  return loading;
}
