"use client";

import { useEffect, useRef } from "react";
import { reducedMotion } from "@/lib/motion";

// Dragging a finger or pointer over the sheet leaves a smudge that slowly lifts.
export default function Smudge() {
  const smudge = useRef<HTMLCanvasElement>(null);

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

  return <canvas ref={smudge} aria-hidden="true" className="pointer-events-none fixed inset-0 z-1" />;
}
