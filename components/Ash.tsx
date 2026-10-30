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
    const glyphs = [...art.current!.querySelectorAll<HTMLElement>("[data-flake]")];
    const flakes = glyphs.filter(() => rnd(0, 100) < 30);
    const fallen = new Set(flakes);
    // Each flake falls and drifts back on its own clock, so the heap never settles.
    const crumble = animate(flakes, {
      translateY: () => [0, rnd(40, 210)],
      translateX: () => [0, rnd(-26, 26)],
      rotate: () => [0, rnd(-160, 160)],
      opacity: [1, 0.12],
      duration: () => rnd(2200, 4200),
      delay: () => rnd(0, 2600),
      loopDelay: 800,
      loop: true,
      alternate: true,
      ease: "inOutQuad",
    });
    // Everything left in place burns: a heat wave crosses the digits, left to right.
    const heat = animate(glyphs.filter((g) => !fallen.has(g)), {
      translateY: [0, -5, 0],
      scale: [1, 1.3, 1],
      color: ["#1b1a19", "#e2571e", "#ffb15e", "#1b1a19"],
      duration: 1500,
      delay: (el: unknown) => (el as HTMLElement).offsetLeft * 2.2,
      loopDelay: 700,
      loop: true,
      ease: "inOutSine",
    });
    // Glyphs keep changing, the way coal shifts as it burns.
    const flicker = setInterval(() => {
      for (let i = 0; i < 28; i++) {
        const node = glyphs[rnd(0, glyphs.length - 1)].firstChild;
        if (node) node.nodeValue = COAL[rnd(0, COAL.length - 1)];
      }
    }, 110);
    const glow = animate(ember.current!, { scale: [1, 1.5], opacity: [0.75, 1], duration: 900, alternate: true, loop: true, ease: "inOutSine" });
    return () => {
      clearInterval(flicker);
      crumble.revert();
      heat.revert();
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
        className="font-art text-[clamp(6px,1.9vw,16px)] leading-[1.05] whitespace-pre select-none"
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
        <p className="text-soft mt-1">Only ash is left here. The rest of Charcoal is still warm.</p>
        <p className="sr-only">Error 404, page not found.</p>
        <Link href="/" className="mt-4 inline-flex min-h-11 items-center rounded-sm bg-char px-5 font-semibold text-sheet">
          Back to Charcoal
        </Link>
      </div>
      <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 bottom-0 h-1/2">
        {[8, 19, 31, 44, 57, 66, 78, 91].map((x, i) => (
          <span key={x} className="ash-spark" style={{ left: `${x}%`, animationDelay: `${i * 0.7}s` }} />
        ))}
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
