"use client";

import { animate } from "animejs";
import { useEffect, useRef, useState } from "react";
import { Sticks, WoodSection } from "@/components/Sketches";
import Story from "@/components/Story";
import { IMAGE_TYPES, LOADER_MIN_MS, PICKING_MAX_MS, Source, STATION } from "@/lib/config";
import { reducedMotion } from "@/lib/motion";
import type { Route } from "@/lib/worker";

type Props = { source: Source | null; take: (file: File, name: string) => void; trySample: () => void; route: Route; onRoute: (route: Route) => void };

export default function Specimen({ source, take, trySample, route, onRoute }: Props) {
  const specimenArt = useRef<HTMLImageElement>(null);
  const [picking, setPicking] = useState(false);

  // Draws itself in, top to bottom, like a stick working down the sheet.
  useEffect(() => {
    if (reducedMotion() || !specimenArt.current) return;
    const run = animate(specimenArt.current, { clipPath: ["inset(0 0 100% 0)", "inset(0 0 0% 0)"], duration: 2200, delay: LOADER_MIN_MS, ease: "inOutSine" });
    return () => void run.revert();
  }, [source]);

  return (
      <section aria-label="Specimen" className={`${STATION} flex-col gap-4 short:gap-2 flat:flex-row flat:gap-4 flat:p-3 md:flex-row md:items-center md:gap-10`}>
        <div className="relative flex shrink-0 flex-col gap-3 phone:contents flat:h-full flat:w-1/2 flat:overflow-y-auto md:w-[38%]">
          <h1 data-mono className="text-heading flex items-center gap-2 font-bold">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/apple-touch-icon.png" alt="" width={32} height={32} className="rounded-sm" />
            Charcoal
          </h1>
          <p data-mono className={`text-title short:text-xl flat:text-2xl md:text-display shrink-0 leading-[1.05] font-bold ${source ? "truncate" : ""}`}>
            {source ? source.name : "Lay an image on the sheet"}
          </p>
          <p className="text-soft short:hidden max-w-[40ch]">
            {source
              ? `${source.w} by ${source.h}. Kept at full resolution, on this device only.`
              : "It goes into the kiln as a picture and comes out as a charcoal drawing made of text. Nothing is uploaded or stored."}
          </p>
          <div role="radiogroup" aria-label="What to make" className="border-char grid w-fit grid-cols-2 border-2 phone:order-3 phone:w-full">
            {(
              [
                ["2d", "Drawing"],
                ["3d", "3D animation"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={route === id}
                onClick={() => onRoute(id)}
                className={`min-h-11 px-4 font-semibold ${route === id ? "bg-char text-sheet" : "hover:bg-sheet"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-3 phone:order-3 phone:grid phone:grid-cols-2 phone:gap-2">
            <label className="bg-char text-sheet focus-within:outline-sanguine inline-flex min-h-12 phone:justify-center phone:px-2 cursor-pointer items-center px-5 font-semibold focus-within:outline-2 focus-within:outline-offset-2">
              <span className="min-w-[7rem] text-center">{picking ? "Opening files" : "Choose image"}</span>
              <input
                type="file"
                accept={IMAGE_TYPES}
                className="sr-only"
                onClick={(e) => {
                  setPicking(true);
                  const done = () => setPicking(false);
                  window.addEventListener("focus", done, { once: true });
                  e.currentTarget.addEventListener("cancel", done, { once: true });
                  setTimeout(done, PICKING_MAX_MS);
                }}
                onChange={(e) => {
                  setPicking(false);
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
          {!source && <div className="absolute -top-6 -right-10 size-72 opacity-40 md:size-[26rem]"><WoodSection /></div>}
          {source ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={source.url} alt={`Your image, ${source.name}`} className="relative z-5 mx-auto mt-[6vh] max-h-[70%] object-contain phone:mt-0 phone:max-h-full flat:mt-0 flat:max-h-full" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img ref={specimenArt} src="/loader.webp" alt="A lump of charcoal drawn in colored ASCII characters" className="relative mt-[6vh] max-h-full w-full object-contain phone:mt-0 flat:mt-0" />
          )}
          {!source && <div className="absolute right-4 bottom-2 h-16 w-52 rotate-[-4deg] max-md:hidden"><Sticks /></div>}
        </div>
      </section>
  );
}
