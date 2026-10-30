"use client";

import { animate, createSeededRandom, stagger } from "animejs";
import Link from "next/link";
import { useEffect, useRef } from "react";
import Seam from "@/components/Seam";
import { reducedMotion } from "@/lib/motion";

const GLYPHS: Record<string, string[]> = {
  "4": ["#..#", "#..#", "#..#", "####", "...#", "...#", "...#"],
  "0": ["####", "#..#", "#..#", "#..#", "#..#", "#..#", "####"],
};
const COAL = "#%8@XOS";

function heap() {
  const rnd = createSeededRandom(404);
  const lines: string[] = [];
  for (let y = 0; y < 7; y++) {
    for (let pass = 0; pass < 2; pass++) {
      lines.push(
        ["4", "0", "4"]
          .map((d) =>
            [...GLYPHS[d][y]].map((c) => (c === "#" ? Array.from({ length: 4 }, () => COAL[rnd(0, COAL.length - 1)]).join("") : "    ")).join(""),
          )
          .join("    "),
      );
    }
  }
  return lines;
}

export default function Ash() {
  const art = useRef<HTMLDivElement>(null);
  const ember = useRef<HTMLDivElement>(null);
  const lines = heap();

  useEffect(() => {
    document.documentElement.dataset.ready = "";
    if (reducedMotion()) return;
    const rnd = createSeededRandom(19);
    const flakes = [...art.current!.querySelectorAll<HTMLElement>("[data-flake]")].filter(() => rnd(0, 100) < 12);
    const fall = animate(flakes, {
      translateY: () => rnd(30, 150),
      translateX: () => rnd(-14, 14),
      opacity: [1, 0.25],
      duration: () => rnd(900, 1900),
      delay: stagger(5, { from: "random" }),
      ease: "inQuad",
    });
    const glow = animate(ember.current!, { scale: [1, 1.25], duration: 1100, alternate: true, loop: true, ease: "inOutSine" });
    return () => {
      fall.revert();
      glow.revert();
    };
  }, []);

  return (
    <main
      className="flex h-dvh flex-col items-center justify-center gap-8 px-4"
      onPointerMove={(e) => {
        const el = ember.current;
        if (el) el.style.translate = `${e.clientX - innerWidth * 0.75}px ${e.clientY - innerHeight * 0.75}px`;
      }}
    >
      <div
        ref={art}
        aria-hidden="true"
        className="font-art text-[clamp(7px,1.9vw,16px)] leading-[1.05] whitespace-pre select-none"
      >
        {lines.map((line, y) => (
          <div key={y}>
            {[...line].map((c, x) =>
              c === " " ? " " : <span key={x} data-flake className="inline-block">{c}</span>,
            )}
          </div>
        ))}
      </div>
      <div className="relative text-center">
        <h1 data-mono className="text-title font-bold">This page burned down.</h1>
        <p className="sr-only">Error 404, page not found.</p>
        <Link href="/" className="mt-4 inline-flex min-h-11 items-center rounded-sm bg-char px-5 font-semibold text-sheet">
          Back to Charcoal
        </Link>
      </div>
      <div
        ref={ember}
        aria-hidden="true"
        className="pointer-events-none fixed top-3/4 left-3/4 size-3 rounded-full bg-[#ffb15e] shadow-[0_0_28px_10px_#e2571e]"
      />
      <Seam />
    </main>
  );
}
