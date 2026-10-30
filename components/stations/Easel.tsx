"use client";

import type { RefObject } from "react";
import { useState } from "react";
import Story from "@/components/Story";
import { UndoIcon } from "@/components/ui/Icons";
import Progress from "@/components/ui/Progress";
import { burnPatch, MODES, ProgressState, Source, STATION } from "@/lib/config";
import { CELL_H, CELL_W, Mode } from "@/lib/render";
import type { Settings } from "@/lib/worker";

const SLIDERS: [string, keyof Settings, number, number, number][] = [
  ["Burn, C", "burn", 200, 900, 10],
  ["Columns", "cols", 40, 400, 10],
  ["Gamma", "gamma", 0.4, 1.8, 0.01],
  ["Contrast", "contrast", 0.6, 2, 0.01],
  ["White floor", "floor", 0.4, 1, 0.01],
  ["Sharpen", "sharpen", 0, 300, 10],
  ["CLAHE strength", "clahe", 0, 6, 0.1],
];

type Props = {
  source: Source | null;
  art: { cols: number; rows: number } | null;
  settings: Settings;
  progress: ProgressState;
  monoCanvas: RefObject<HTMLCanvasElement | null>;
  colorCanvas: RefObject<HTMLCanvasElement | null>;
  update: (patch: Partial<Settings>) => void;
  commit: (next: Settings) => void;
  change: (patch: Partial<Settings>) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  ready: boolean;
  onDone: () => void;
};

export default function Easel({ source, art, settings, progress, monoCanvas, colorCanvas, update, commit, change, undo, redo, canUndo, canRedo, ready, onDone }: Props) {
  const [adjust, setAdjust] = useState(false);

  return (
      <section aria-label="Easel" className={`${STATION} flex-col gap-3 [@media(max-height:500px)]:flex-row [@media(max-height:500px)]:items-stretch`}>
        <Story chapter={2} compact className={`shrink-0 xl:absolute xl:top-10 xl:left-10 xl:w-64 [@media(max-height:500px)]:hidden ${adjust ? "phone:hidden" : ""}`} />
        <div className="flex min-h-0 flex-1 items-center justify-center @container-size xl:pl-72">
          {!source && <p className="text-soft">The drawing lands here once an image has been through the kiln.</p>}
          <div
            className={`relative z-5 ${source ? "" : "hidden"}`}
            style={art ? { aspectRatio: `${art.cols * CELL_W} / ${art.rows * CELL_H}`, width: `min(100cqw, 100cqh * ${(art.cols * CELL_W) / (art.rows * CELL_H)})` } : undefined}
          >
            <canvas ref={colorCanvas} className="absolute inset-0 h-full w-full" aria-hidden="true" />
            <canvas
              ref={monoCanvas}
              className="absolute inset-0 h-full w-full"
              role="img"
              aria-label="ASCII drawing"
            />
          </div>
        </div>
        <Progress label={progress.label} pct={progress.pct} className={`[@media(max-height:500px)]:hidden ${source ? "" : "invisible"}`} />
        <div data-xscroll className="border-char flex shrink-0 flex-col gap-1 border-t-2 pt-2 phone:max-h-[52dvh] phone:overflow-y-auto [@media(max-height:500px)]:w-1/2 [@media(max-height:500px)]:overflow-y-auto [@media(max-height:500px)]:border-t-0 [@media(max-height:500px)]:pt-0">
          <div className={`grid grid-cols-2 gap-x-5 sm:grid-cols-3 lg:grid-cols-7 [@media(max-height:500px)]:grid-cols-2 ${adjust ? "" : "phone:hidden"}`}>
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
            <button type="button" onClick={undo} disabled={!canUndo} aria-label="Undo" title="Undo" className="border-char hover:bg-sheet grid size-11 place-items-center border disabled:opacity-40">
              <UndoIcon />
            </button>
            <button type="button" onClick={redo} disabled={!canRedo} aria-label="Redo" title="Redo" className="border-char hover:bg-sheet grid size-11 place-items-center border disabled:opacity-40">
              <UndoIcon flip />
            </button>
            <button type="button" onClick={onDone} disabled={!ready} className="bg-char text-sheet min-h-11 px-5 font-semibold disabled:opacity-40">
              Done
            </button>
          </div>
          </div>
        </div>
      </section>
  );
}
