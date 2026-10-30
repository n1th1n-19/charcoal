"use client";

import type { RefObject } from "react";
import { useMemo, useState } from "react";
import Story from "@/components/Story";
import { KB, MAX_CANVAS_SIDE, SAVING_MIN_MS, save, sizeLabel, Source, STATION } from "@/lib/config";
import { Output, toSvg, toText } from "@/lib/exports";
import { CELL_H, CELL_W, GROUNDS, rasterize } from "@/lib/render";
import type { Settings } from "@/lib/worker";

type Props = {
  output: Output | null;
  source: Source | null;
  settings: Settings;
  showing: boolean;
  previewCanvas: RefObject<HTMLCanvasElement | null>;
  previewBox: RefObject<HTMLDivElement | null>;
};

export default function Fixative({ output, source, settings, showing, previewCanvas, previewBox }: Props) {
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
    const img = rasterize(output.cols, output.rows, output.cells, output.rgb, settings.mode, fill, ink, pngScale);
    const c = new OffscreenCanvas(img.width, img.height);
    c.getContext("2d")!.putImageData(img, 0, 0);
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
        {!output && <p className="text-soft">Finish a drawing on the easel and it will be ready here.</p>}
        </div>
        <div ref={previewBox} className="hidden min-h-0 items-center justify-center wide:flex">
          <canvas ref={previewCanvas} role="img" aria-label="Your finished drawing" className={output ? "" : "hidden"} />
          {!output && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/loader.webp" alt="" className="max-h-full max-w-full object-contain opacity-30" />
          )}
        </div>
        <ul data-xscroll className={`strip flex shrink-0 snap-x wide:col-span-2 wide:flex-nowrap snap-mandatory gap-3 max-md:overflow-x-auto max-md:py-1 md:flex-wrap md:gap-5 [@media(max-height:500px)]:flex-nowrap [@media(max-height:500px)]:overflow-x-auto ${output ? "" : "hidden"}`}>
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
      </section>
  );
}
