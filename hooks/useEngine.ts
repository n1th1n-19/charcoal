import { animate } from "animejs";
import { Dispatch, RefObject, SetStateAction, useCallback, useEffect, useRef, useState } from "react";
import type { Bitmaps } from "@/hooks/useArtCanvases";
import { MIN_STAGE_MS, ProgressState, READY, safePixels, SAMPLE, Source, stagesFor, TooLarge } from "@/lib/config";
import type { Loop } from "@/lib/exports3d";
import type { Output } from "@/lib/exports";
import { reducedMotion } from "@/lib/motion";
import type { Reply, Route, Settings } from "@/lib/worker";

type Options = {
  settings: Settings;
  setSettings: Dispatch<SetStateAction<Settings>>;
  reset: (next: Settings) => void;
  goTo: (index: number) => void;
  bitmaps: RefObject<Bitmaps | null>;
  setOutput: (output: Output) => void;
  route: Route;
  setLoop: (loop: Loop) => void;
};

// Talks to the image worker: taking in images, requesting renders, and pacing the kiln.
export function useEngine({ settings, setSettings, reset, goTo, bitmaps, setOutput, route, setLoop }: Options) {
  const routeRef = useRef(route);
  routeRef.current = route;
  const worker = useRef<Worker | null>(null);
  const request = useRef(0);
  const burning = useRef({ on: false, done: false, queue: [] as string[], heat: { c: 20 } });

  const [source, setSource] = useState<Source | null>(null);
  const [art, setArt] = useState<{ cols: number; rows: number } | null>(null);
  const [progress, setProgress] = useState<ProgressState>(READY);
  const [download, setDownload] = useState("");
  const [lit, setLit] = useState(-1);
  const [temp, setTemp] = useState(20);
  const [error, setError] = useState("");
  const [tooLarge, setTooLarge] = useState<TooLarge | null>(null);

  // Stages arrive far faster than the eye, so the kiln plays them at a readable pace.
  useEffect(() => {
    const w = new Worker(new URL("../lib/worker.ts", import.meta.url), { type: "module" });
    worker.current = w;
    w.onmessage = (e: MessageEvent<Reply>) => {
      const m = e.data;
      const b = burning.current;
      if (m.type === "stage") {
        if (b.on) b.queue.push(m.name);
        setProgress({ label: m.name, pct: Math.round(((stagesFor(routeRef.current).indexOf(m.name) + 1) / stagesFor(routeRef.current).length) * 100) });
      } else if (m.type === "download") {
        if (m.total) setProgress({ label: "Downloading model", pct: Math.round((m.loaded / m.total) * 100) });
        setDownload(m.total ? `Downloading model, ${Math.round(m.loaded / 1e6)} of ${Math.round(m.total / 1e6)} MB` : "Downloading model");
      } else if (m.type === "error") {
        setDownload("");
        setProgress(READY);
        setError(m.message);
        if (m.model) setSettings((s) => ({ ...s, removeBg: false }));
        b.done = true;
      } else if (m.type === "frames") {
        setDownload("");
        if (m.id !== request.current) return;
        setProgress(READY);
        setLoop({ cols: m.cols, rows: m.rows, fps: m.fps, frames: m.frames });
        b.done = true;
      } else if (m.type === "done") {
        setDownload("");
        if (m.id !== request.current) {
          m.mono.close();
          m.color.close();
          return;
        }
        bitmaps.current?.mono.close();
        bitmaps.current?.color.close();
        bitmaps.current = { mono: m.mono, color: m.color };
        setProgress(READY);
        setArt({ cols: m.cols, rows: m.rows });
        setOutput({ cols: m.cols, rows: m.rows, cells: m.cells, rgb: m.rgb });
        b.done = true;
      }
    };
    w.onerror = (e) => setError(`The image worker stopped: ${e.message}`);
    const play = setInterval(() => {
      const b = burning.current;
      if (!b.on) return;
      const name = b.queue.shift();
      if (name) {
        const stages = stagesFor(routeRef.current);
        const i = stages.indexOf(name);
        setLit(i);
        const target = 20 + (880 * (i + 1)) / stages.length;
        if (reducedMotion()) setTemp(Math.round(target));
        else animate(b.heat, { c: target, duration: MIN_STAGE_MS, ease: "linear", onUpdate: () => setTemp(Math.round(b.heat.c)) });
      } else if (b.done) {
        b.on = false;
        goTo(2);
      }
    }, MIN_STAGE_MS);
    return () => {
      clearInterval(play);
      w.terminate();
    };
  }, [goTo, bitmaps, setOutput, setSettings, setLoop]);

  useEffect(() => {
    if (!source || !worker.current) return;
    setProgress({ label: "Starting", pct: 0 });
    worker.current.postMessage({ type: "render", id: ++request.current, settings, route });
  }, [settings, source, route]);

  const burn = useCallback(() => {
    burning.current = { on: true, done: false, queue: [], heat: burning.current.heat };
    burning.current.heat.c = 20;
    setTemp(20);
    setLit(-1);
    goTo(1);
  }, [goTo]);

  function start(bitmap: ImageBitmap, file: File | Blob, name: string, w: number, h: number, initial: Settings) {
    burn();
    worker.current!.postMessage({ type: "load", bitmap }, [bitmap]);
    reset(initial);
    setSource({ url: URL.createObjectURL(file), name, w, h });
  }

  async function take(file: File | Blob, name: string, initial: Settings = settings) {
    setTooLarge(null);
    if (!file.type.startsWith("image/")) {
      setError(`${name} is not an image. Use JPEG, PNG, WebP or GIF.`);
      return;
    }
    setError("");
    let bitmap: ImageBitmap;
    try {
      bitmap = await createImageBitmap(file);
    } catch {
      setError(`This browser could not read ${name}. Try saving it as JPEG or PNG.`);
      return;
    }
    const { width: w, height: h } = bitmap;
    if (w * h > safePixels()) {
      bitmap.close();
      setTooLarge({ file, name, w, h });
      return;
    }
    start(bitmap, file, name, w, h, initial);
  }

  async function takeReduced() {
    if (!tooLarge) return;
    const { file, name, w, h } = tooLarge;
    const scale = Math.sqrt(safePixels() / (w * h));
    const [rw, rh] = [Math.floor(w * scale), Math.floor(h * scale)];
    setTooLarge(null);
    try {
      start(await createImageBitmap(file, { resizeWidth: rw, resizeHeight: rh, resizeQuality: "high" }), file, name, rw, rh, settings);
    } catch {
      setError(`This device could not resize ${name}. Resize it elsewhere and try again.`);
    }
  }

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const file = e.clipboardData?.files[0];
      if (file) take(file, "the pasted image");
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  });

  const trySample = async () => take(await (await fetch("/sample/charcoal.jpg")).blob(), "charcoal.jpg", SAMPLE);

  return { source, art, progress, download, lit, temp, error, tooLarge, setTooLarge, burn, take, takeReduced, trySample };
}
