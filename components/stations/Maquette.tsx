"use client";

import { useEffect, useRef, useState } from "react";
import Story from "@/components/Story";
import { UndoIcon } from "@/components/ui/Icons";
import Progress from "@/components/ui/Progress";
import { MODES, ProgressState, Source, STATION } from "@/lib/config";
import type { Loop } from "@/lib/exports3d";
import { reducedMotion } from "@/lib/motion";
import { CELL_H, CELL_W, GROUNDS, Mode, rasterize } from "@/lib/render";
import { PRESETS } from "@/lib/scene3d";
import type { Settings } from "@/lib/worker";

const SLIDERS: [string, keyof Settings, number, number, number][] = [
  ["Depth", "depth", 0, 1.5, 0.05],
  ["Cut background", "cutoff", 0, 0.8, 0.01],
  ["Motion", "motion", 0.2, 1.5, 0.05],
  ["Speed, fps", "fps", 4, 24, 1],
  ["Loop, frames", "frames", 12, 96, 6],
  ["Columns", "cols3d", 40, 200, 10],
  ["Gamma", "gamma", 0.4, 1.8, 0.01],
  ["Contrast", "contrast", 0.6, 2, 0.01],
];

type Props = {
  source: Source | null;
  loop: Loop | null;
  settings: Settings;
  progress: ProgressState;
  update: (patch: Partial<Settings>) => void;
  commit: (next: Settings) => void;
  change: (patch: Partial<Settings>) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onDone: () => void;
};

// Draws one frame of the loop into a canvas, at the canvas's real pixel size.
export function drawFrame(canvas: HTMLCanvasElement, loop: Loop, index: number, mode: Mode, ground: Settings["ground"]) {
  const { fill, ink } = GROUNDS[ground];
  const f = loop.frames[index % loop.frames.length];
  const img = rasterize(loop.cols, loop.rows, f.cells, f.rgb, mode, fill, ink);
  const native = new OffscreenCanvas(img.width, img.height);
  native.getContext("2d")!.putImageData(img, 0, 0);
  canvas.width = Math.max(1, Math.round(canvas.clientWidth * devicePixelRatio));
  canvas.height = Math.max(1, Math.round(canvas.clientHeight * devicePixelRatio));
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(native, 0, 0, canvas.width, canvas.height);
}

export default function Maquette({ source, loop, settings, progress, update, commit, change, undo, redo, canUndo, canRedo, onDone }: Props) {
  const mono = useRef<HTMLCanvasElement>(null);
  const color = useRef<HTMLCanvasElement>(null);
  const [adjust, setAdjust] = useState(false);
  const [playing, setPlaying] = useState(true);
  const [frame, setFrame] = useState(0);

  useEffect(() => setPlaying(!reducedMotion()), []);

  // Plays at the loop's own frame rate, and only redraws when the frame changes.
  useEffect(() => {
    if (!loop) return;
    let raf = 0;
    let shown = -1;
    const start = performance.now() - (frame / loop.fps) * 1000;
    const tick = (now: number) => {
      const i = playing ? Math.floor(((now - start) / 1000) * loop.fps) % loop.frames.length : frame;
      if (i !== shown) {
        shown = i;
        drawFrame(mono.current!, loop, i, "Mono", settings.ground);
        drawFrame(color.current!, loop, i, settings.mode, settings.ground);
        window.dispatchEvent(new Event("charcoal:seam"));
        if (playing) setFrame(i);
      }
      if (playing) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // frame is read as the resume point, not a trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loop, playing, settings.mode, settings.ground]);

  const ratio = loop ? (loop.cols * CELL_W) / (loop.rows * CELL_H) : 1;

  return (
    <section aria-label="Maquette" className={`${STATION} flex-col gap-3 [@media(max-height:500px)]:flex-row [@media(max-height:500px)]:items-stretch`}>
      <Story chapter={4} compact className={`shrink-0 xl:absolute xl:top-10 xl:left-10 xl:w-64 [@media(max-height:500px)]:hidden ${adjust ? "phone:hidden" : ""}`} />
      <div className="flex min-h-0 flex-1 items-center justify-center @container-size xl:pl-72">
        {!loop && <p className="text-soft">{source ? "Building the 3D frames." : "The 3D animation lands here once an image has been through the kiln."}</p>}
        <div className={`relative z-5 ${loop ? "" : "hidden"}`} style={{ aspectRatio: String(ratio), width: `min(100cqw, 100cqh * ${ratio})` }}>
          <canvas ref={color} className="absolute inset-0 h-full w-full" aria-hidden="true" />
          <canvas ref={mono} data-seam-clip className="absolute inset-0 h-full w-full" role="img" aria-label={`3D ASCII animation, ${PRESETS.find((p) => p.id === settings.preset)?.label}`} />
        </div>
      </div>
      <Progress label={progress.label} pct={progress.pct} className={`[@media(max-height:500px)]:hidden ${source ? "" : "invisible"}`} />
      <div data-xscroll className="border-char flex shrink-0 flex-col gap-1 border-t-2 pt-2 phone:max-h-[52dvh] phone:overflow-y-auto [@media(max-height:500px)]:w-1/2 [@media(max-height:500px)]:overflow-y-auto [@media(max-height:500px)]:border-t-0 [@media(max-height:500px)]:pt-0">
        <div role="radiogroup" aria-label="Animation preset" className={`grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8 ${adjust ? "" : "phone:hidden"}`}>
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={settings.preset === p.id}
              title={p.blurb}
              onClick={() => change({ preset: p.id })}
              className={`flex min-h-11 items-center gap-2 border px-2 text-left text-sm ${settings.preset === p.id ? "border-sanguine bg-sheet font-semibold" : "border-smudge hover:bg-sheet"}`}
            >
              <span aria-hidden="true" className="preset-stage">
                <span className="preset-icon" data-preset={p.id} />
              </span>
              <span className="min-w-0 leading-tight">{p.label}</span>
            </button>
          ))}
        </div>
        <div className={`grid grid-cols-2 gap-x-5 sm:grid-cols-3 lg:grid-cols-8 [@media(max-height:500px)]:grid-cols-2 ${adjust ? "" : "phone:hidden"}`}>
          {SLIDERS.map(([label, key, min, max, step]) => (
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
                onChange={(e) => update({ [key]: Number(e.target.value) })}
                onPointerUp={() => commit(settings)}
                onKeyUp={() => commit(settings)}
                className="accent-sanguine w-full"
              />
            </label>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
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
            <input type="checkbox" checked={settings.invert} onChange={(e) => change({ invert: e.target.checked })} className="accent-sanguine size-5" />
            Invert
          </label>
          <label className={`text-label text-soft flex min-h-11 shrink-0 items-center gap-2 ${adjust ? "" : "phone:hidden"}`}>
            <input type="checkbox" checked={settings.removeBg} onChange={(e) => change({ removeBg: e.target.checked })} className="accent-sanguine size-5" />
            Remove background (176 MB once)
          </label>
          <div className={`ml-auto flex shrink-0 items-center gap-2 phone:sticky phone:bottom-0 phone:w-full ${adjust ? "phone:bg-paper" : ""}`}>
            <button type="button" onClick={() => setAdjust((v) => !v)} aria-expanded={adjust} className="border-char hidden min-h-11 border px-4 font-medium phone:mr-auto phone:block">
              {adjust ? "Close" : "Adjust"}
            </button>
            <button type="button" onClick={() => setPlaying((v) => !v)} disabled={!loop} aria-label={playing ? "Pause" : "Play"} title={playing ? "Pause" : "Play"} className="border-char hover:bg-sheet grid size-11 place-items-center border disabled:opacity-40">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
                {playing ? <path d="M7 5h3v14H7zM14 5h3v14h-3z" /> : <path d="M8 5v14l11-7z" />}
              </svg>
            </button>
            <button type="button" onClick={undo} disabled={!canUndo} aria-label="Undo" title="Undo" className="border-char hover:bg-sheet grid size-11 place-items-center border disabled:opacity-40">
              <UndoIcon />
            </button>
            <button type="button" onClick={redo} disabled={!canRedo} aria-label="Redo" title="Redo" className="border-char hover:bg-sheet grid size-11 place-items-center border disabled:opacity-40">
              <UndoIcon flip />
            </button>
            <button type="button" onClick={onDone} disabled={!loop} className="bg-char text-sheet min-h-11 px-5 font-semibold disabled:opacity-40">
              Done
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
