"use client";

import { useEffect, useRef } from "react";
import { reducedMotion } from "@/lib/motion";

const BUBBLES = 18;
const SWEEP = 250;
const START = -125;
const WATER_TOP = 398;
const WATER_BOTTOM = 443;
const seed = (i: number) => (Math.sin(i * 91.7) * 43758.5453) % 1;

const ticks = Array.from({ length: 19 }, (_, i) => {
  const a = ((START + (SWEEP * i) / 18 - 90) * Math.PI) / 180;
  const inner = i % 3 === 0 ? 31 : 36;
  return {
    d: `M${(500 + inner * Math.cos(a)).toFixed(1)} ${(120 + inner * Math.sin(a)).toFixed(1)}L${(500 + 41 * Math.cos(a)).toFixed(1)} ${(120 + 41 * Math.sin(a)).toFixed(1)}`,
    hot: i >= 13,
    major: i % 3 === 0,
  };
});

// Gauge and water glass, moved by one loop from the kiln temperature.
export default function Instruments({ temp }: { temp: number }) {
  const heat = useRef(0);
  heat.current = (temp - 20) / 880;
  const needle = useRef<SVGGElement>(null);
  const water = useRef<SVGPathElement>(null);
  const drop = useRef<SVGCircleElement>(null);
  const bubbles = useRef<(SVGCircleElement | null)[]>([]);

  useEffect(() => {
    const parts = Array.from({ length: BUBBLES }, (_, i) => ({
      x: 506 + Math.abs(seed(i + 1)) * 36,
      y: WATER_BOTTOM - Math.abs(seed(i + 40)) * 44,
      r: 1.4 + Math.abs(seed(i + 80)) * 2.6,
      speed: 0.5 + Math.abs(seed(i + 120)),
    }));
    let angle = START;
    let velocity = 0;
    let dropY = 352;
    let last = performance.now();
    let raf = 0;
    let visible = false;

    const frame = (ms: number) => {
      // Twenty updates a second is plenty here, and the grain filter is costly to redraw.
      if (ms - last < 50) {
        raf = requestAnimationFrame(frame);
        return;
      }
      const dt = Math.min(ms - last, 100) / 16.67;
      last = ms;
      const h = heat.current;

      // Spring toward the reading, with a tremble that grows with heat.
      const goal = START + SWEEP * h + Math.sin(ms / 47) * Math.sin(ms / 131) * h * 3.5;
      velocity += (goal - angle) * 0.03 * dt;
      velocity *= 0.86 ** dt;
      angle += velocity * dt;
      needle.current?.setAttribute("transform", `rotate(${angle.toFixed(2)} 500 120)`);

      const roil = 0.5 + h * 2.4;
      let top = "M500 " + WATER_TOP;
      for (let x = 500; x <= 548; x += 4) {
        const y = WATER_TOP + Math.sin(x * 0.42 + ms / 260) * roil * 0.6 + Math.sin(x * 0.9 - ms / 170) * roil * 0.4;
        top += `L${x} ${y.toFixed(1)}`;
      }
      water.current?.setAttribute("d", `${top}L544 ${WATER_BOTTOM}L504 ${WATER_BOTTOM}Z`);

      // More bubbles rise, and faster, as the water heats.
      const active = Math.round(3 + h * (BUBBLES - 3));
      parts.forEach((b, i) => {
        const el = bubbles.current[i];
        if (!el) return;
        if (i >= active) {
          el.setAttribute("opacity", "0");
          return;
        }
        b.y -= b.speed * (0.25 + h * 1.5) * dt;
        const pop = WATER_TOP + 3;
        if (b.y < pop) {
          b.y = WATER_BOTTOM - Math.random() * 4;
          b.x = 506 + Math.random() * 36;
        }
        el.setAttribute("cx", (b.x + Math.sin(ms / 140 + i) * 1.3).toFixed(1));
        el.setAttribute("cy", b.y.toFixed(1));
        // Grows as it rises and pressure falls.
        el.setAttribute("r", (b.r * (1.5 - (b.y - WATER_TOP) / 75)).toFixed(1));
        el.setAttribute("opacity", "0.85");
      });

      dropY += (1.2 + (dropY - 352) * 0.07) * dt * (h > 0.02 ? 1 : 0);
      if (dropY > WATER_TOP) dropY = 352 - (1 - h) * 60;
      drop.current?.setAttribute("cy", dropY.toFixed(1));
      drop.current?.setAttribute("opacity", dropY > 352 && h > 0.02 ? "1" : "0");

      if (visible && !reducedMotion()) raf = requestAnimationFrame(frame);
    };

    const svg = needle.current!.closest("svg")!;
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      cancelAnimationFrame(raf);
      if (visible) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    });
    io.observe(svg);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);

  // Reduced motion still needs each new reading drawn once.
  useEffect(() => {
    if (reducedMotion()) needle.current?.setAttribute("transform", `rotate(${START + SWEEP * heat.current} 500 120)`);
  }, [temp]);

  return (
    <g className="rough">
      {ticks.map((t, i) => (
        <path key={i} d={t.d} stroke={t.hot ? "#8f3a1e" : "#1b1a19"} strokeWidth={t.major ? 3.6 : 2} />
      ))}
      <path d="M467 145a41 41 0 0 1 -9 -32" fill="none" stroke="#3a6339" strokeWidth="5" />
      <path d="M528 150a41 41 0 0 0 13 -30" fill="none" stroke="#8f3a1e" strokeWidth="5" />
      <g ref={needle} transform={`rotate(${START} 500 120)`}>
        <path d="M500 134L494 120L500 82L506 120Z" fill="#8f3a1e" />
      </g>
      <circle cx="500" cy="120" r="5" fill="#1b1a19" />

      <path ref={water} d={`M500 ${WATER_TOP}L548 ${WATER_TOP}L544 ${WATER_BOTTOM}L504 ${WATER_BOTTOM}Z`} fill="#5f8fab" />
      {Array.from({ length: BUBBLES }, (_, i) => (
        <circle
          key={i}
          ref={(el) => {
            bubbles.current[i] = el;
          }}
          r="2"
          opacity="0"
          fill="#e8e5dc"
          fillOpacity="1"
          stroke="#e8e5dc"
          strokeWidth="1.2"
        />
      ))}
      <circle ref={drop} cx="522" cy="352" r="3" fill="#5f8fab" opacity="0" />
    </g>
  );
}
