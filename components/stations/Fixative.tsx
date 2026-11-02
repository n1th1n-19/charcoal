"use client";

import type { RefObject } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { drawFrame } from "@/components/stations/Maquette";
import Story from "@/components/Story";
import { KB, MAX_CANVAS_SIDE, SAVING_MIN_MS, save, sizeLabel, Source, STATION } from "@/lib/config";
import { Output, toSvg, toText } from "@/lib/exports";
import { Loop, toAnimatedSvg, toAsciicast, toShellPlayer, toTextFrames } from "@/lib/exports3d";
import { CELL_H, CELL_W, GROUNDS, rasterize } from "@/lib/render";
import type { Route, Settings } from "@/lib/worker";

type Props = {
  output: Output | null;
  source: Source | null;
  settings: Settings;
  showing: boolean;
  previewCanvas: RefObject<HTMLCanvasElement | null>;
  previewBox: RefObject<HTMLDivElement | null>;
  route: Route;
  loop: Loop | null;
};

export default function Fixative({ output, source, settings, showing, previewCanvas, previewBox, route, loop }: Props) {
  const is3d = route === "3d";
  const [smaller, setSmaller] = useState(false);
  const [frame, setFrame] = useState(false);
  const [pngScale, setPngScale] = useState(2);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState("");

  const exportName = source ? `${source.name.replace(/\.[^.]+$/, "")}-charcoal` : "charcoal";
  const svgs = useMemo(() => {
    if (!output || !showing) return { still: "", animated: "" };
    const options = { mode: settings.mode, ground: settings.ground, smaller, frame };
    return { still: toSvg(output, { ...options, reveal: false }), animated: toSvg(output, { ...options, reveal: true }) };
  }, [output, showing, settings.mode, settings.ground, smaller, frame]);
  const stillBytes = useMemo(() => new Blob([svgs.still]).size, [svgs]);
  const animatedBytes = useMemo(() => new Blob([svgs.animated]).size, [svgs]);
  const saveSvg = (text: string, suffix: string) => save(new Blob([text], { type: "image/svg+xml" }), `${exportName}${suffix}.svg`);
  const files3d = useMemo(() => {
    if (!loop || !showing || !is3d) return null;
    return {
      svg: toAnimatedSvg(loop, { mode: settings.mode, ground: settings.ground, frame, smaller }),
      sh: toShellPlayer(loop, settings.mode, settings.ground),
      cast: toAsciicast(loop, settings.mode, settings.ground),
      txt: toTextFrames(loop),
    };
  }, [loop, showing, is3d, settings.mode, settings.ground, frame, smaller]);
  const bytes3d = useMemo(
    () => (files3d ? Object.fromEntries(Object.entries(files3d).map(([k, v]) => [k, new Blob([v]).size])) : {}) as Record<string, number>,
    [files3d],
  );

  // The 3D preview shows the loop's first frame, fitted to its box.
  const preview3d = useRef<HTMLCanvasElement>(null);
  const box3d = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!is3d || !loop) return;
    const paint = () => {
      const box = box3d.current!;
      const c = preview3d.current!;
      const ratio = (loop.cols * CELL_W) / (loop.rows * CELL_H);
      const width = Math.min(box.clientWidth, box.clientHeight * ratio);
      if (width <= 0) return;
      c.style.width = `${width}px`;
      c.style.height = `${width / ratio}px`;
      drawFrame(c, loop, 0, settings.mode, settings.ground);
    };
    paint();
    const watch = new ResizeObserver(paint);
    watch.observe(box3d.current!);
    return () => watch.disconnect();
  }, [is3d, loop, settings.mode, settings.ground]);

  const pngScales = output ? [1, 2, 3, 4].filter((n) => output.cols * CELL_W * n <= MAX_CANVAS_SIDE && output.rows * CELL_H * n <= MAX_CANVAS_SIDE) : [];

  // The short pause lets the label paint before heavy work, and the hold keeps it readable.
  async function saveAs(key: string, make: () => void | Promise<void>) {
    setSaving(key);
    await new Promise((r) => setTimeout(r, 30));
    try {
      await make();
    } finally {
      setTimeout(() => setSaving(""), SAVING_MIN_MS);
    }
  }

  async function savePng() {
    if (!output) return;
    const { fill, ink } = GROUNDS[settings.ground];
    // Scaling with smoothing off repeats each pixel, which keeps characters crisp and is far faster.
    const img = rasterize(output.cols, output.rows, output.cells, output.rgb, settings.mode, fill, ink);
    const base = new OffscreenCanvas(img.width, img.height);
    base.getContext("2d")!.putImageData(img, 0, 0);
    const c = new OffscreenCanvas(img.width * pngScale, img.height * pngScale);
    const ctx = c.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(base, 0, 0, c.width, c.height);
    save(await c.convertToBlob({ type: "image/png" }), `${exportName}.png`);
  }

  async function copyText() {
    await navigator.clipboard.writeText(toText(output!));
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  return (
      <section aria-label="Fixative" className={`${STATION} flex-col justify-center gap-4 overflow-y-auto flat:gap-2 flat:p-3 md:gap-6 wide:grid wide:grid-cols-2 wide:grid-rows-[minmax(0,1fr)_auto] wide:gap-x-10 [@media(max-height:640px)]:justify-start`}>
        <div className="flex flex-col gap-4 flat:gap-2 md:gap-6 wide:self-center">
        <h2 data-mono className="text-title short:text-2xl md:text-display font-bold">Fix it and take it</h2>
        <Story chapter={3} className="[@media(max-height:500px)]:hidden" />
        {!(is3d ? loop : output) && <p className="text-soft">{is3d ? "Finish an animation on the maquette and it will be ready here." : "Finish a drawing on the easel and it will be ready here."}</p>}
        </div>
        <div ref={box3d} className={`hidden min-h-0 items-center justify-center ${is3d ? "wide:flex" : ""}`}>
          <canvas ref={preview3d} role="img" aria-label="Your finished 3D animation, first frame" className={loop ? "" : "hidden"} />
          {!loop && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/loader.webp" alt="" className="max-h-full max-w-full object-contain opacity-30" />
          )}
        </div>
        <div ref={previewBox} className={`hidden min-h-0 items-center justify-center ${is3d ? "" : "wide:flex"}`}>
          <canvas ref={previewCanvas} role="img" aria-label="Your finished drawing" className={output ? "" : "hidden"} />
          {!output && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/loader.webp" alt="" className="max-h-full max-w-full object-contain opacity-30" />
          )}
        </div>
        <ul data-xscroll className={`strip flex shrink-0 snap-x wide:col-span-2 wide:flex-nowrap snap-mandatory gap-3 max-md:overflow-x-auto max-md:py-1 md:flex-wrap md:gap-5 [@media(max-height:500px)]:flex-nowrap [@media(max-height:500px)]:overflow-x-auto ${output && !is3d ? "" : "hidden"}`}>
          <li className="bg-sheet flex w-[84vw] shrink-0 snap-start flex-col gap-3 p-5 short:gap-1 short:p-4 shadow-[3px_4px_0_#1b1a1944] flat:grid flat:w-[86vw] flat:grid-cols-2 flat:content-start flat:gap-x-4 flat:gap-y-1 flat:rotate-0 flat:p-3 md:w-80 md:-rotate-[1.5deg] wide:w-auto wide:flex-[1.3] wide:basis-0">
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
            <button type="button" disabled={!!saving} onClick={() => saveAs("animated", () => saveSvg(svgs.animated, "-animated"))} className="bg-char text-sheet mt-auto min-h-11 px-2 font-semibold whitespace-nowrap short:text-sm flat:col-start-2 flat:row-start-1 flat:mt-0 flat:text-sm">
              {saving === "animated" ? "Downloading" : `Download animated, ${sizeLabel(animatedBytes)}`}
            </button>
            <button type="button" disabled={!!saving} onClick={() => saveAs("still", () => saveSvg(svgs.still, ""))} className="border-char min-h-11 border px-2 font-medium whitespace-nowrap short:text-sm flat:col-start-2 flat:row-start-2 flat:text-sm">
              {saving === "still" ? "Downloading" : `Download still, ${sizeLabel(stillBytes)}`}
            </button>
          </li>
          <li className="bg-sheet flex w-[84vw] shrink-0 snap-start flex-col gap-3 p-5 short:gap-1 short:p-4 shadow-[3px_4px_0_#1b1a1944] md:w-64 md:rotate-[1deg] wide:w-auto wide:flex-1 wide:basis-0">
            <span data-mono className="text-heading font-semibold">PNG</span>
            <label className="text-label text-soft flex min-h-11 items-center justify-between gap-2">
              Scale
              <select value={pngScale} onChange={(e) => setPngScale(Number(e.target.value))} className="bg-sheet text-char border-char min-h-11 border px-2">
                {pngScales.map((n) => (
                  <option key={n} value={n}>{n}x, {output ? `${output.cols * CELL_W * n} by ${output.rows * CELL_H * n}` : ""}</option>
                ))}
              </select>
            </label>
            <button type="button" disabled={!!saving} onClick={() => saveAs("png", savePng)} className="bg-char text-sheet mt-auto min-h-11 px-4 font-semibold">
              {saving === "png" ? "Downloading" : "Download PNG"}
            </button>
          </li>
          <li className="bg-sheet flex w-[84vw] shrink-0 snap-start flex-col gap-3 p-5 short:gap-1 short:p-4 shadow-[3px_4px_0_#1b1a1944] md:w-64 md:-rotate-[0.6deg] wide:w-auto wide:flex-1 wide:basis-0">
            <span data-mono className="text-heading font-semibold">Plain text</span>
            <span className="text-label text-soft">No color: text files cannot hold it.</span>
            <button type="button" onClick={copyText} className="border-char mt-auto min-h-11 border px-4 font-medium">
              {copied ? "Copied" : "Copy text"}
            </button>
            <button type="button" disabled={!!saving} onClick={() => saveAs("text", () => save(new Blob([toText(output ?? { cols: 0, rows: 0, cells: new Uint8Array(), rgb: new Uint8Array() })], { type: "text/plain" }), `${exportName}.txt`))} className="bg-char text-sheet min-h-11 px-4 font-semibold">
              {saving === "text" ? "Downloading" : "Download text"}
            </button>
          </li>
        </ul>
        <ul data-xscroll className={`strip flex shrink-0 snap-x wide:col-span-2 wide:flex-nowrap snap-mandatory gap-3 max-md:overflow-x-auto max-md:py-1 md:flex-wrap md:gap-5 [@media(max-height:500px)]:flex-nowrap [@media(max-height:500px)]:overflow-x-auto ${loop && is3d ? "" : "hidden"}`}>
          <li className="bg-sheet flex w-[84vw] shrink-0 snap-start flex-col gap-3 p-5 short:gap-1 short:p-4 shadow-[3px_4px_0_#1b1a1944] md:w-64 wide:w-auto wide:flex-1 wide:basis-0 md:-rotate-[1.5deg]">
            <span data-mono className="text-heading font-semibold">Animated SVG</span>
            <span className="text-label text-soft short:hidden">Loops forever, with no JavaScript. Plays on GitHub.</span>
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
            {(bytes3d.svg ?? 0) > KB * KB && (
              <p role="status" className="text-label text-sanguine">
                {bytes3d.svg > 5 * KB * KB ? "Very large. Try fewer columns or a shorter loop." : "Large file. Fewer columns or a shorter loop will reduce it."}
              </p>
            )}
            <button type="button" disabled={!!saving} onClick={() => saveAs("svg3d", () => save(new Blob([files3d!.svg], { type: "image/svg+xml" }), `${exportName}-3d.svg`))} className="bg-char text-sheet mt-auto min-h-11 px-2 font-semibold whitespace-nowrap">
              {saving === "svg3d" ? "Downloading" : `Download SVG, ${sizeLabel(bytes3d.svg ?? 0)}`}
            </button>
          </li>
          <li className="bg-sheet flex w-[84vw] shrink-0 snap-start flex-col gap-3 p-5 short:gap-1 short:p-4 shadow-[3px_4px_0_#1b1a1944] md:w-64 wide:w-auto wide:flex-1 wide:basis-0 md:rotate-[1deg]">
            <span data-mono className="text-heading font-semibold">Terminal player</span>
            <span className="text-label text-soft">Run it with <code>sh {exportName}-3d.sh</code>. On Windows, use Git Bash or WSL.</span>
            <button type="button" disabled={!!saving} onClick={() => saveAs("sh", () => save(new Blob([files3d!.sh], { type: "text/x-shellscript" }), `${exportName}-3d.sh`))} className="bg-char text-sheet mt-auto min-h-11 px-2 font-semibold whitespace-nowrap">
              {saving === "sh" ? "Downloading" : `Download script, ${sizeLabel(bytes3d.sh ?? 0)}`}
            </button>
          </li>
          <li className="bg-sheet flex w-[84vw] shrink-0 snap-start flex-col gap-3 p-5 short:gap-1 short:p-4 shadow-[3px_4px_0_#1b1a1944] md:w-64 wide:w-auto wide:flex-1 wide:basis-0 md:-rotate-[0.6deg]">
            <span data-mono className="text-heading font-semibold">asciinema</span>
            <span className="text-label text-soft">For <code>asciinema play</code> and web players.</span>
            <button type="button" disabled={!!saving} onClick={() => saveAs("cast", () => save(new Blob([files3d!.cast], { type: "application/x-asciicast" }), `${exportName}-3d.cast`))} className="bg-char text-sheet mt-auto min-h-11 px-2 font-semibold whitespace-nowrap">
              {saving === "cast" ? "Downloading" : `Download cast, ${sizeLabel(bytes3d.cast ?? 0)}`}
            </button>
          </li>
          <li className="bg-sheet flex w-[84vw] shrink-0 snap-start flex-col gap-3 p-5 short:gap-1 short:p-4 shadow-[3px_4px_0_#1b1a1944] md:w-64 wide:w-auto wide:flex-1 wide:basis-0 md:rotate-[0.8deg]">
            <span data-mono className="text-heading font-semibold">Text frames</span>
            <span className="text-label text-soft">No color. Frames are split by form feeds, for your own tools.</span>
            <button type="button" disabled={!!saving} onClick={() => saveAs("txt3d", () => save(new Blob([files3d!.txt], { type: "text/plain" }), `${exportName}-3d.txt`))} className="bg-char text-sheet mt-auto min-h-11 px-2 font-semibold whitespace-nowrap">
              {saving === "txt3d" ? "Downloading" : `Download text, ${sizeLabel(bytes3d.txt ?? 0)}`}
            </button>
          </li>
        </ul>
      </section>
  );
}
