"use client";

import { animate, createTimeline, stagger, svg } from "animejs";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Seam, { markSides, seamX, SEAM_EVENT } from "@/components/Seam";
import { Kiln, Sticks, WoodSection } from "@/components/Sketches";
import Story from "@/components/Story";
import { Output, toSvg, toText } from "@/lib/exports";
import { reducedMotion } from "@/lib/motion";
import * as P from "@/lib/pipeline";
import { CELL_H, CELL_W, GROUNDS, Mode, rasterize } from "@/lib/render";
import type { Reply, Settings } from "@/lib/worker";

const STATIONS = ["Specimen", "Kiln", "Easel", "Portfolio"];
const STAGES = ["Remove background", "Grayscale", "CLAHE", "Invert and lift", "Composite", "Sharpen", "Contrast", "Resample", "Sample color", "Map to glyphs"];
const MODES: Mode[] = ["Mono", "16 colors", "Green", "Amber", "Original colors"];
const MIN_STAGE_MS = 240;
const BURN_NEUTRAL = 550;
const SPECIMEN_BACKDROP = 150;

// Phones run out of memory far sooner than desktops. ponytail: fixed caps, measure real devices to refine.
const safePixels = () => (navigator.maxTouchPoints > 0 ? 16e6 : 64e6);

// One dial over three settings. The middle of its range leaves the base values unchanged.
function burnPatch(c: number, invert: boolean) {
  const t = (c - BURN_NEUTRAL) / 350;
  const round = (v: number) => Math.round(v * 100) / 100;
  return { burn: c, gamma: round((invert ? 0.8 : 1.18) * (1 - 0.3 * t)), contrast: round(1.05 * (1 + 0.3 * t)), clahe: round(2.6 * (1 + 0.6 * t)) };
}
const MAX_CANVAS_SIDE = 16384;
const KB = 1024;

const sizeLabel = (bytes: number) => (bytes < KB * KB ? `${Math.round(bytes / KB)} KB` : `${(bytes / KB / KB).toFixed(1)} MB`);

function save(blob: Blob, name: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

const DEFAULTS: Settings = {
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
};

// The sample is a dark subject on a pale ground, so ink on white reads as a positive.
const SAMPLE: Settings = { ...DEFAULTS, invert: false, gamma: 1.18, ground: "white" };

// The specimen drawing is real pipeline output, tuned by hand for the sample photo.
function specimen(img: HTMLImageElement) {
  const [w, h] = [img.naturalWidth, img.naturalHeight];
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0);
  const { data } = ctx.getImageData(0, 0, w, h);
  const cols = 400;
  const rows = P.rowsFor(w, h, cols);
  const gray = P.grayscale(data, w, h);
  const tuned = P.contrast(P.unsharp(P.lift(P.clahe(gray, w, h, 4.4)), w, h, 2, 300, 2), 2);
  const cells = P.mapGlyphs(P.resize(tuned, w, h, cols, rows), 1.8, 1);
  // The photo's backdrop is far paler than the charcoal, so a plain threshold cuts it away.
  const light = P.resize(gray, w, h, cols, rows);
  for (let i = 0; i < cells.length; i++) if (light[i] > SPECIMEN_BACKDROP) cells[i] = 0;
  const rgb = new Uint8Array(w * h * 3);
  for (let i = 0; i < w * h; i++) rgb.set(data.subarray(i * 4, i * 4 + 3), i * 3);
  const { fill, ink } = GROUNDS.white;
  const art = rasterize(cols, rows, cells, P.resize(rgb, w, h, cols, rows, 3), "Original colors", fill, ink);
  // Glyphs were blended onto white. Undoing that blend leaves them on transparency.
  const px = art.data;
  for (let i = 0; i < px.length; i += 4) {
    const a = 255 - Math.min(px[i], px[i + 1], px[i + 2]);
    px[i + 3] = a;
    if (a) for (let c = 0; c < 3; c++) px[i + c] = 255 - ((255 - px[i + c]) * 255) / a;
  }
  const out = new OffscreenCanvas(art.width, art.height);
  out.getContext("2d")!.putImageData(art, 0, 0);
  return out;
}

export default function App() {
  const scroller = useRef<HTMLElement>(null);
  const mono = useRef<HTMLCanvasElement>(null);
  const color = useRef<HTMLCanvasElement>(null);
  const smudge = useRef<HTMLCanvasElement>(null);
  const specimenArt = useRef<HTMLCanvasElement>(null);
  const needle = useRef<HTMLSpanElement>(null);
  const worker = useRef<Worker | null>(null);
  const bitmaps = useRef<{ mono: ImageBitmap; color: ImageBitmap } | null>(null);
  const committed = useRef(DEFAULTS);
  const request = useRef(0);
  const burning = useRef({ on: false, done: false, queue: [] as string[], heat: { c: 20 } });

  const [active, setActive] = useState(0);
  const [source, setSource] = useState<{ url: string; name: string; w: number; h: number } | null>(null);
  const [settings, setSettings] = useState(DEFAULTS);
  const [past, setPast] = useState<Settings[]>([]);
  const [future, setFuture] = useState<Settings[]>([]);
  const [output, setOutput] = useState<Output | null>(null);
  const [smaller, setSmaller] = useState(false);
  const [frame, setFrame] = useState(false);
  const [pngScale, setPngScale] = useState(2);
  const [copied, setCopied] = useState(false);
  const [adjust, setAdjust] = useState(false);
  const [art, setArt] = useState<{ cols: number; rows: number } | null>(null);
  const [download, setDownload] = useState("");
  const [lit, setLit] = useState(-1);
  const [temp, setTemp] = useState(20);
  const [empty, setEmpty] = useState<OffscreenCanvas | null>(null);
  const [error, setError] = useState("");
  const [tooLarge, setTooLarge] = useState<{ file: File | Blob; name: string; w: number; h: number } | null>(null);

  const goTo = useCallback((index: number) => {
    const el = scroller.current;
    if (!el) return;
    const i = Math.max(0, Math.min(STATIONS.length - 1, index));
    const left = (el.children[i] as HTMLElement).offsetLeft;
    if (reducedMotion()) {
      el.scrollLeft = left;
      return;
    }
    el.dataset.gliding = "";
    animate(el, { scrollLeft: left, duration: 900, ease: "inOutCubic", onComplete: () => delete el.dataset.gliding });
  }, []);

  function clipToSeam() {
    const canvas = mono.current;
    if (!canvas) return;
    const r = canvas.getBoundingClientRect();
    canvas.style.clipPath = `inset(0 ${Math.max(0, r.right - seamX())}px 0 0)`;
  }

  // One gesture moves one station, so a screen never rests between two. Stations leaving fade to ghosts.
  useEffect(() => {
    const el = scroller.current!;
    let wheelLock = 0;
    const onWheel = (e: WheelEvent) => {
      if ((e.target as Element).closest("[data-xscroll]")) return;
      e.preventDefault();
      const delta = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      const now = performance.now();
      if (now < wheelLock || Math.abs(delta) < 8) return;
      wheelLock = now + 1000;
      goTo(Math.round(el.scrollLeft / el.clientWidth) + Math.sign(delta));
    };
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as Element).closest("input, select, [role=slider]")) return;
      const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      if (step) setActive((a) => (goTo(a + step), a));
    };
    const onScroll = () => {
      const middle = el.scrollLeft + el.clientWidth / 2;
      let nearest = 0;
      [...el.children].forEach((child, i) => {
        const s = child as HTMLElement;
        const gap = Math.abs(s.offsetLeft + s.offsetWidth / 2 - middle) / s.offsetWidth;
        if (gap < 0.5) nearest = i;
        s.style.opacity = reducedMotion() ? "1" : String(Math.max(0.16, 1.25 - gap * 1.1));
      });
      setActive(nearest);
      if (needle.current) needle.current.style.left = `${(el.scrollLeft / (el.scrollWidth - el.clientWidth)) * 100}%`;
      markSides();
      clipToSeam();
    };
    onScroll();
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("keydown", onKey);
    window.addEventListener(SEAM_EVENT, clipToSeam);
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(SEAM_EVENT, clipToSeam);
    };
  }, [goTo]);

  // Arriving at a station paints its scene stroke by stroke, stamps the seal, then writes the words.
  useEffect(() => {
    if (reducedMotion()) return;
    const root = scroller.current!.children[active];
    const strokes = root.querySelectorAll("[data-ink]");
    if (!strokes.length) return;
    const run = createTimeline()
      .add(svg.createDrawable(strokes), { draw: ["0 0", "0 1"], duration: 900, delay: stagger(170), ease: "inOutSine" }, 0)
      .add(root.querySelectorAll("[data-hanko]"), { scale: [1.9, 1], opacity: [0, 1], rotate: [-16, -4], duration: 340, ease: "outBack" }, 500)
      .add(root.querySelectorAll("[data-word]"), { opacity: [0, 1], translateY: [5, 0], delay: stagger(45), duration: 340, ease: "outQuad" }, 700);
    return () => void run.revert();
  }, [active]);

  // Dragging a finger or pointer over the sheet leaves a smudge that slowly lifts.
  useEffect(() => {
    if (reducedMotion()) return;
    const c = smudge.current!;
    const ctx = c.getContext("2d")!;
    const size = () => {
      c.width = innerWidth;
      c.height = innerHeight;
    };
    size();
    const onMove = (e: PointerEvent) => {
      const g = ctx.createRadialGradient(e.clientX, e.clientY, 0, e.clientX, e.clientY, 46);
      g.addColorStop(0, "rgba(27,26,25,0.05)");
      g.addColorStop(1, "rgba(27,26,25,0)");
      ctx.fillStyle = g;
      ctx.fillRect(e.clientX - 46, e.clientY - 46, 92, 92);
    };
    const lift = setInterval(() => {
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = "rgba(0,0,0,0.04)";
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.globalCompositeOperation = "source-over";
    }, 120);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("resize", size);
    return () => {
      clearInterval(lift);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("resize", size);
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.ready = "";
    const img = new Image();
    img.onload = () => {
      setEmpty(specimen(img));
    };
    img.src = "/sample/charcoal.jpg";
  }, []);

  // Draws itself in, top to bottom, like a stick working down the sheet.
  useEffect(() => {
    const c = specimenArt.current;
    if (!c || !empty) return;
    const paint = () => {
      c.width = Math.max(1, Math.round(c.clientWidth * devicePixelRatio));
      c.height = Math.round((c.width * empty.height) / empty.width);
      // Halving in stages keeps thin glyph rows from aliasing into horizontal bands.
      let step: OffscreenCanvas = empty;
      while (step.width / 2 > c.width) {
        const half = new OffscreenCanvas(Math.ceil(step.width / 2), Math.ceil(step.height / 2));
        const h = half.getContext("2d")!;
        h.imageSmoothingQuality = "high";
        h.drawImage(step, 0, 0, half.width, half.height);
        step = half;
      }
      const ctx = c.getContext("2d")!;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(step, 0, 0, c.width, c.height);
    };
    paint();
    const watch = new ResizeObserver(paint);
    watch.observe(c);
    if (reducedMotion()) return () => watch.disconnect();
    const run = animate(c, { clipPath: ["inset(0 0 100% 0)", "inset(0 0 0% 0)"], duration: 2200, ease: "inOutSine" });
    return () => {
      watch.disconnect();
      run.revert();
    };
  }, [empty, source]);

  // Stages arrive far faster than the eye, so the kiln plays them at a readable pace.
  useEffect(() => {
    const w = new Worker(new URL("../lib/worker.ts", import.meta.url), { type: "module" });
    worker.current = w;
    w.onmessage = (e: MessageEvent<Reply>) => {
      const m = e.data;
      const b = burning.current;
      if (m.type === "stage") {
        if (b.on) b.queue.push(m.name);
      } else if (m.type === "download") {
        setDownload(m.total ? `Downloading model, ${Math.round(m.loaded / 1e6)} of ${Math.round(m.total / 1e6)} MB` : "Downloading model");
      } else if (m.type === "error") {
        setDownload("");
        setError(m.message);
        if (m.model) setSettings((s) => ({ ...s, removeBg: false }));
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
        setArt({ cols: m.cols, rows: m.rows });
        setOutput({ cols: m.cols, rows: m.rows, cells: m.cells, rgb: m.rgb });
        clipToSeam();
        b.done = true;
      }
    };
    w.onerror = (e) => setError(`The image worker stopped: ${e.message}`);
    const play = setInterval(() => {
      const b = burning.current;
      if (!b.on) return;
      const name = b.queue.shift();
      if (name) {
        const i = STAGES.indexOf(name);
        setLit(i);
        const target = 20 + (880 * (i + 1)) / STAGES.length;
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
  }, [goTo]);

  // Drawn at the sheet's real pixel size with high-quality scaling. Letting CSS shrink the
  // full-size bitmap skips rows unevenly and shows as horizontal stripes.
  useEffect(() => {
    const paint = () => {
      const pair = bitmaps.current;
      if (!pair) return;
      for (const [ref, bitmap] of [[mono, pair.mono], [color, pair.color]] as const) {
        const c = ref.current!;
        c.width = Math.max(1, Math.round(c.clientWidth * devicePixelRatio));
        c.height = Math.max(1, Math.round(c.clientHeight * devicePixelRatio));
        const ctx = c.getContext("2d")!;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(bitmap, 0, 0, c.width, c.height);
      }
      clipToSeam();
    };
    paint();
    const watch = new ResizeObserver(paint);
    watch.observe(mono.current!);
    return () => watch.disconnect();
  }, [output]);

  useEffect(() => {
    if (!source || !worker.current) return;
    worker.current.postMessage({ type: "render", id: ++request.current, settings });
  }, [settings, source]);

  function burn() {
    burning.current = { on: true, done: false, queue: [], heat: burning.current.heat };
    burning.current.heat.c = 20;
    setTemp(20);
    setLit(-1);
    goTo(1);
  }

  function start(bitmap: ImageBitmap, file: File | Blob, name: string, w: number, h: number, initial: Settings) {
    burn();
    worker.current!.postMessage({ type: "load", bitmap }, [bitmap]);
    setPast([]);
    setFuture([]);
    committed.current = initial;
    setSettings(initial);
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
  const update = (patch: Partial<Settings>) => {
    if (patch.removeBg) burn();
    setSettings((s) => ({ ...s, ...patch }));
  };

  // A slider commits when released, so one drag is one undo step.
  const commit = useCallback((next: Settings) => {
    if (JSON.stringify(next) === JSON.stringify(committed.current)) return;
    const before = committed.current;
    setPast((p) => [...p, before]);
    setFuture([]);
    committed.current = next;
  }, []);
  const change = (patch: Partial<Settings>) => {
    update(patch);
    commit({ ...settings, ...patch });
  };
  const restore = useCallback((next: Settings) => {
    committed.current = next;
    setSettings(next);
  }, []);
  const undo = useCallback(() => {
    if (!past.length) return;
    const current = committed.current;
    setFuture((f) => [current, ...f]);
    restore(past[past.length - 1]);
    setPast((p) => p.slice(0, -1));
  }, [past, restore]);
  const redo = useCallback(() => {
    if (!future.length) return;
    const current = committed.current;
    setPast((p) => [...p, current]);
    restore(future[0]);
    setFuture((f) => f.slice(1));
  }, [future, restore]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "z") return;
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  const exportName = source ? `${source.name.replace(/\.[^.]+$/, "")}-charcoal` : "charcoal";
  const svgs = useMemo(() => {
    if (!output || active !== 3) return { still: "", animated: "" };
    const options = { mode: settings.mode, ground: settings.ground, smaller, frame };
    return { still: toSvg(output, { ...options, reveal: false }), animated: toSvg(output, { ...options, reveal: true }) };
  }, [output, active, settings.mode, settings.ground, smaller, frame]);
  const stillBytes = useMemo(() => new Blob([svgs.still]).size, [svgs]);
  const animatedBytes = useMemo(() => new Blob([svgs.animated]).size, [svgs]);
  const saveSvg = (text: string, suffix: string) => save(new Blob([text], { type: "image/svg+xml" }), `${exportName}${suffix}.svg`);
  const pngScales = output ? [1, 2, 3, 4].filter((n) => output.cols * CELL_W * n <= MAX_CANVAS_SIDE && output.rows * CELL_H * n <= MAX_CANVAS_SIDE) : [];

  function savePng() {
    if (!output) return;
    const { fill, ink } = GROUNDS[settings.ground];
    const img = rasterize(output.cols, output.rows, output.cells, output.rgb, settings.mode, fill, ink, pngScale);
    const c = new OffscreenCanvas(img.width, img.height);
    c.getContext("2d")!.putImageData(img, 0, 0);
    void c.convertToBlob({ type: "image/png" }).then((b) => save(b, `${exportName}.png`));
  }

  async function copyText() {
    await navigator.clipboard.writeText(toText(output!));
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  const sliders: [string, keyof Settings, number, number, number][] = [
    ["Burn, C", "burn", 200, 900, 10],
    ["Columns", "cols", 40, 400, 10],
    ["Gamma", "gamma", 0.4, 1.8, 0.01],
    ["Contrast", "contrast", 0.6, 2, 0.01],
    ["White floor", "floor", 0.4, 1, 0.01],
    ["Sharpen", "sharpen", 0, 300, 10],
    ["CLAHE strength", "clahe", 0, 6, 0.1],
  ];

  const station = "station relative flex h-full shrink-0 w-dvw transition-opacity duration-200 p-4 phone:pt-9 md:p-10";

  return (
    <div
      className="flex h-dvh flex-col"
      onDragStart={(e) => e.preventDefault()}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file) take(file, file.name);
      }}
    >
      <canvas ref={smudge} aria-hidden="true" className="pointer-events-none fixed inset-0 z-1" />
      {error && (
        <p role="alert" className="bg-sheet text-sanguine border-sanguine fixed top-3 left-1/2 z-40 max-w-[90vw] -translate-x-1/2 border px-4 py-2">
          {error}
        </p>
      )}
      {tooLarge && (
        <div role="alert" className="bg-sheet border-char fixed top-3 left-1/2 z-40 flex w-[min(90vw,32rem)] -translate-x-1/2 flex-col gap-2 border-2 p-4">
          <p>
            {tooLarge.name} is {Math.round((tooLarge.w * tooLarge.h) / 1e6)} MP, more than this device can safely process. Your original file stays unchanged.
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={takeReduced} className="bg-char text-sheet min-h-11 px-4 font-semibold">
              Convert at {Math.round(safePixels() / 1e6)} MP
            </button>
            <button type="button" onClick={() => setTooLarge(null)} className="border-char min-h-11 border px-4 font-medium">
              Cancel
            </button>
          </div>
        </div>
      )}
      <main ref={scroller} className="sheet flex min-h-0 flex-1 overflow-x-auto overflow-y-hidden">
        <section aria-label="Specimen" className={`${station} flex-col gap-4 short:gap-2 flat:flex-row flat:gap-4 flat:p-3 md:flex-row md:items-center md:gap-10`}>
          <div className="relative flex shrink-0 flex-col gap-3 phone:contents flat:h-full flat:w-1/2 flat:overflow-y-auto md:w-[38%]">
            <h1 data-mono className="text-heading flex items-center gap-2 font-bold">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icons/apple-touch-icon.png" alt="" width={32} height={32} className="rounded-sm" />
              Charcoal
            </h1>
            <p data-mono className="text-title short:text-xl flat:text-2xl md:text-display shrink-0 truncate leading-[1.05] font-bold">
              {source ? source.name : "Lay an image on the sheet"}
            </p>
            <p className="text-soft short:hidden max-w-[40ch]">
              {source
                ? `${source.w} by ${source.h}. Kept at full resolution, on this device only.`
                : "It goes into the kiln as a picture and comes out as a charcoal drawing made of text. Nothing is uploaded or stored."}
            </p>
            <div className="flex flex-wrap gap-3 phone:order-3 phone:grid phone:grid-cols-2 phone:gap-2">
              <label className="bg-char text-sheet focus-within:outline-sanguine inline-flex min-h-12 phone:justify-center phone:px-2 cursor-pointer items-center px-5 font-semibold focus-within:outline-2 focus-within:outline-offset-2">
                Choose image
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) take(file, file.name);
                  }}
                />
              </label>
              <button type="button" onClick={trySample} className="border-char hover:bg-sheet min-h-12 border-2 px-5 font-medium phone:px-2">
                Try the sample
              </button>
            </div>
            <p className="text-label text-soft phone:order-3 short:hidden">Or paste, or drop anywhere on the sheet.</p>
            <Story chapter={0} className="mt-2 phone:order-4 short:mt-0" />
          </div>
          <div className="relative min-h-0 flex-1 self-stretch flat:overflow-hidden phone:order-2 phone:flex phone:items-center phone:justify-center phone:overflow-hidden">
            <div className="absolute -top-6 -right-10 size-72 opacity-40 md:size-[26rem]"><WoodSection /></div>
            {source ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={source.url} alt={`Your image, ${source.name}`} className="relative mx-auto mt-[6vh] max-h-[70%] rotate-[-1.2deg] phone:mt-0 phone:max-h-full flat:mt-0 flat:max-h-full border-8 border-sheet object-contain shadow-[2px_3px_0_#1b1a1955]" />
            ) : (
              <canvas ref={specimenArt} role="img" aria-label="A lump of charcoal drawn in colored ASCII characters" className="relative mt-[6vh] max-h-full w-full object-contain phone:mt-0 flat:mt-0" />
            )}
            <div className="absolute right-4 bottom-2 h-16 w-52 rotate-[-4deg] max-md:hidden"><Sticks /></div>
          </div>
        </section>

        <section aria-label="Kiln" className={`${station} flex-col gap-4 flat:flex-row-reverse flat:p-3 md:flex-row-reverse md:items-center`}>
          <div className="min-h-0 flex-1 self-stretch pt-[16vh] phone:pt-[9dvh] flat:pt-[14dvh]"><Kiln temp={temp} /></div>
          <div className="flex shrink-0 flex-col gap-2 flat:h-full flat:w-1/2 flat:overflow-y-auto md:w-72">
            <Story chapter={1} />
            <p data-mono className="text-title short:text-2xl font-bold tabular-nums">{temp} C</p>
            {download && <p role="status" className="text-label text-soft">{download}</p>}
            <p className="text-label text-soft hidden phone:block flat:block" aria-live="polite">{lit >= 0 ? STAGES[lit] : "Waiting for an image"}</p>
            <ol className="grid grid-cols-2 gap-x-4 phone:hidden flat:hidden md:grid-cols-1 md:gap-y-1">
              {STAGES.map((s, i) => (i === 0 && !settings.removeBg ? null : (
                <li key={s} aria-current={i === lit ? "step" : undefined} className={i === lit ? "text-sanguine font-bold" : i < lit ? "line-through decoration-1" : "text-soft"}>
                  {s}
                </li>
              )))}
            </ol>
          </div>
        </section>

        <section aria-label="Easel" className={`${station} flex-col gap-3 [@media(max-height:500px)]:flex-row [@media(max-height:500px)]:items-stretch`}>
          <Story chapter={2} compact className={`shrink-0 xl:absolute xl:top-10 xl:left-10 xl:w-64 [@media(max-height:500px)]:hidden ${adjust ? "phone:hidden" : ""}`} />
          <div className="flex min-h-0 flex-1 items-center justify-center @container-size xl:pl-72">
            {!source && <p className="text-soft">The drawing lands here once an image has been through the kiln.</p>}
            <div
              className={`relative z-5 ${source ? "" : "hidden"}`}
              style={art ? { aspectRatio: `${art.cols * CELL_W} / ${art.rows * CELL_H}`, width: `min(100cqw, 100cqh * ${(art.cols * CELL_W) / (art.rows * CELL_H)})` } : undefined}
            >
              <canvas ref={color} className="absolute inset-0 h-full w-full" aria-hidden="true" />
              <canvas
                ref={mono}
                className="absolute inset-0 h-full w-full"
                role="img"
                aria-label="ASCII drawing"
              />
            </div>
          </div>
          <div data-xscroll className="border-char flex shrink-0 flex-col gap-1 border-t-2 pt-2 phone:max-h-[52dvh] phone:overflow-y-auto [@media(max-height:500px)]:w-1/2 [@media(max-height:500px)]:overflow-y-auto [@media(max-height:500px)]:border-t-0 [@media(max-height:500px)]:pt-0">
            <div className={`grid grid-cols-2 gap-x-5 sm:grid-cols-3 lg:grid-cols-7 [@media(max-height:500px)]:grid-cols-2 ${adjust ? "" : "phone:hidden"}`}>
            {sliders.map(([label, key, min, max, step]) => (
              <label key={key} className="text-label text-soft flex min-h-11 min-w-0 flex-col justify-center">
                <span className="flex justify-between">
                  <span data-mono>{label}</span>
                  <span className="text-char tabular-nums">{String(settings[key])}</span>
                </span>
                <input
                  type="range"
                  min={min}
                  max={max}
                  step={step}
                  value={Number(settings[key])}
                  onChange={(e) => update(key === "burn" ? burnPatch(Number(e.target.value), settings.invert) : { [key]: Number(e.target.value) })}
                  onPointerUp={() => commit(settings)}
                  onKeyUp={() => commit(settings)}
                  className="accent-sanguine w-full"
                />
              </label>
            ))}
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
            <label className={`text-label text-soft flex min-h-11 shrink-0 items-center gap-2 ${adjust ? "" : "phone:hidden"}`}>
              <input type="checkbox" checked={settings.invert} onChange={(e) => change({ invert: e.target.checked, ...burnPatch(settings.burn, e.target.checked) })} className="accent-sanguine size-5" />
              Invert
            </label>
            <label className={`text-label text-soft flex min-h-11 shrink-0 items-center gap-2 ${adjust ? "" : "phone:hidden"}`}>
              Color
              <select value={settings.mode} onChange={(e) => change({ mode: e.target.value as Mode })} className="bg-sheet text-char border-char min-h-11 border px-2">
                {MODES.map((m) => <option key={m}>{m}</option>)}
              </select>
            </label>
            <label className={`text-label text-soft flex min-h-11 shrink-0 items-center gap-2 ${adjust ? "" : "phone:hidden"}`}>
              Ground
              <select value={settings.ground} onChange={(e) => change({ ground: e.target.value as Settings["ground"] })} className="bg-sheet text-char border-char min-h-11 border px-2">
                <option value="dark">Dark</option>
                <option value="white">White</option>
              </select>
            </label>
            <label className={`text-label text-soft flex min-h-11 shrink-0 items-center gap-2 ${adjust ? "" : "phone:hidden"}`}>
              <input type="checkbox" checked={settings.removeBg} onChange={(e) => change({ removeBg: e.target.checked })} className="accent-sanguine size-5" />
              Remove background (176 MB once)
            </label>
            <div className={`ml-auto flex shrink-0 items-center gap-2 phone:sticky phone:bottom-0 phone:w-full ${adjust ? "phone:bg-paper" : ""}`}>
              <button type="button" onClick={() => setAdjust((v) => !v)} aria-expanded={adjust} className="border-char hidden min-h-11 border px-4 font-medium phone:mr-auto phone:block">
                {adjust ? "Close" : "Adjust"}
              </button>
              <button type="button" onClick={undo} disabled={!past.length} aria-label="Undo" title="Undo" className="border-char hover:bg-sheet grid size-11 place-items-center border disabled:opacity-40">
                <UndoIcon />
              </button>
              <button type="button" onClick={redo} disabled={!future.length} aria-label="Redo" title="Redo" className="border-char hover:bg-sheet grid size-11 place-items-center border disabled:opacity-40">
                <UndoIcon flip />
              </button>
              <button type="button" onClick={() => goTo(3)} disabled={!output} className="bg-char text-sheet min-h-11 px-5 font-semibold disabled:opacity-40">
                Done
              </button>
            </div>
            </div>
          </div>
        </section>

        <section aria-label="Portfolio" className={`${station} flex-col justify-center gap-4 overflow-y-auto flat:gap-2 flat:p-3 md:gap-6 [@media(max-height:640px)]:justify-start`}>
          <h2 data-mono className="text-title short:text-2xl md:text-display font-bold">Fix it and take it</h2>
          <Story chapter={3} className="[@media(max-height:500px)]:hidden" />
          {!output && <p className="text-soft">Finish a drawing on the easel and it will be ready here.</p>}
          <ul data-xscroll className={`strip flex shrink-0 snap-x snap-mandatory gap-3 max-md:overflow-x-auto max-md:py-1 md:flex-wrap md:gap-5 [@media(max-height:500px)]:flex-nowrap [@media(max-height:500px)]:overflow-x-auto ${output ? "" : "hidden"}`}>
            <li className="bg-sheet flex w-[84vw] shrink-0 snap-start flex-col gap-3 p-5 short:gap-1 short:p-4 shadow-[3px_4px_0_#1b1a1944] flat:grid flat:w-[86vw] flat:grid-cols-2 flat:content-start flat:gap-x-4 flat:gap-y-1 flat:rotate-0 flat:p-3 md:w-80 md:-rotate-[1.5deg]">
              <span data-mono className="text-heading font-semibold">SVG</span>
              <span className="text-label text-soft short:hidden flat:hidden">Scales anywhere. Animated reveals row by row, and plays on GitHub.</span>
              <label className="text-label flex min-h-11 items-center gap-2">
                <input type="checkbox" checked={frame} onChange={(e) => setFrame(e.target.checked)} className="accent-sanguine size-5" />
                Add frame
              </label>
              {settings.mode === "Original colors" && (
                <label className="text-label flex min-h-11 items-center gap-2">
                  <input type="checkbox" checked={smaller} onChange={(e) => setSmaller(e.target.checked)} className="accent-sanguine size-5" />
                  Smaller file, fewer colors
                </label>
              )}
              {animatedBytes > KB * KB && (
                <p role="status" className="text-label text-sanguine flat:col-span-2">
                  {animatedBytes > 5 * KB * KB ? "Very large. GitHub and browsers may struggle with it. Try fewer columns or Smaller file." : "Large file. Fewer columns or Smaller file will reduce it."}
                </p>
              )}
              <button type="button" onClick={() => saveSvg(svgs.animated, "-animated")} className="bg-char text-sheet mt-auto min-h-11 px-2 font-semibold whitespace-nowrap short:text-sm flat:col-start-2 flat:row-start-1 flat:mt-0 flat:text-sm">
                Download animated, {sizeLabel(animatedBytes)}
              </button>
              <button type="button" onClick={() => saveSvg(svgs.still, "")} className="border-char min-h-11 border px-2 font-medium whitespace-nowrap short:text-sm flat:col-start-2 flat:row-start-2 flat:text-sm">
                Download still, {sizeLabel(stillBytes)}
              </button>
            </li>
            <li className="bg-sheet flex w-[84vw] shrink-0 snap-start flex-col gap-3 p-5 short:gap-1 short:p-4 shadow-[3px_4px_0_#1b1a1944] md:w-64 md:rotate-[1deg]">
              <span data-mono className="text-heading font-semibold">PNG</span>
              <label className="text-label text-soft flex min-h-11 items-center justify-between gap-2">
                Scale
                <select value={pngScale} onChange={(e) => setPngScale(Number(e.target.value))} className="bg-sheet text-char border-char min-h-11 border px-2">
                  {pngScales.map((n) => (
                    <option key={n} value={n}>{n}x, {output ? `${output.cols * CELL_W * n} by ${output.rows * CELL_H * n}` : ""}</option>
                  ))}
                </select>
              </label>
              <button type="button" onClick={savePng} className="bg-char text-sheet mt-auto min-h-11 px-4 font-semibold">
                Download PNG
              </button>
            </li>
            <li className="bg-sheet flex w-[84vw] shrink-0 snap-start flex-col gap-3 p-5 short:gap-1 short:p-4 shadow-[3px_4px_0_#1b1a1944] md:w-64 md:-rotate-[0.6deg]">
              <span data-mono className="text-heading font-semibold">Plain text</span>
              <span className="text-label text-soft">No color: text files cannot hold it.</span>
              <button type="button" onClick={copyText} className="border-char mt-auto min-h-11 border px-4 font-medium">
                {copied ? "Copied" : "Copy text"}
              </button>
              <button type="button" onClick={() => save(new Blob([toText(output ?? { cols: 0, rows: 0, cells: new Uint8Array(), rgb: new Uint8Array() })], { type: "text/plain" }), `${exportName}.txt`)} className="bg-char text-sheet min-h-11 px-4 font-semibold">
                Download text
              </button>
            </li>
          </ul>
        </section>
      </main>

      <LegalLinks />
      <nav aria-label="Stations" className="ruler bg-sheet relative z-5 grid shrink-0 grid-cols-4 pb-[env(safe-area-inset-bottom)]">
        <span ref={needle} aria-hidden="true" className="bg-sanguine absolute top-0 h-4 w-0.5" />
        {STATIONS.map((name, i) => (
          <button
            key={name}
            type="button"
            onClick={() => goTo(i)}
            aria-current={i === active ? "location" : undefined}
            className={`text-label min-h-12 pt-3 ${i === active ? "font-bold" : "text-soft hover:text-char"}`}
          >
            <span data-mono>{name}</span>
          </button>
        ))}
      </nav>
      <Seam />
    </div>
  );
}

function UndoIcon({ flip }: { flip?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={flip ? { transform: "scaleX(-1)" } : undefined}>
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
    </svg>
  );
}

function LegalLinks() {
  return (
    <nav aria-label="Legal" className="text-label text-soft fixed top-1 right-3 z-20 flex gap-4 md:top-3 md:right-5">
      <Link href="/privacy" className="inline-flex min-h-6 items-center underline">Privacy</Link>
      <Link href="/terms" className="inline-flex min-h-6 items-center underline">Terms</Link>
    </nav>
  );
}
