"use client";

import { animate, spring } from "animejs";
import { useEffect, useRef } from "react";
import { reducedMotion } from "@/lib/motion";

export const SEAM_EVENT = "charcoal:seam";

export function seamX() {
  return parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--seam-px")) || innerWidth / 2;
}

function setSeam(px: number) {
  const x = Math.max(0, Math.min(innerWidth, px));
  const root = document.documentElement.style;
  root.setProperty("--seam", `${x}px`);
  root.setProperty("--seam-px", String(x));
  window.dispatchEvent(new Event(SEAM_EVENT));
}

// Sets each [data-mono] element's side of the burn front, which drives its MONO axis.
export function markSides() {
  const x = seamX();
  document.querySelectorAll<HTMLElement>("[data-mono]").forEach((el) => {
    const r = el.getBoundingClientRect();
    el.dataset.side = (r.left + r.right) / 2 < x ? "mono" : "color";
  });
}

export default function Seam() {
  const handle = useRef<HTMLButtonElement>(null);
  const ratio = useRef(0.5);

  useEffect(() => {
    const sweep = { x: 0 };
    const sync = () => {
      handle.current?.setAttribute("aria-valuenow", String(Math.round(ratio.current * 100)));
      markSides();
    };
    const toSeam = (px: number) => {
      ratio.current = px / innerWidth;
      setSeam(px);
      sync();
    };
    const onResize = () => toSeam(ratio.current * innerWidth);
    window.addEventListener("resize", onResize);

    if (reducedMotion()) {
      toSeam(innerWidth / 2);
      return () => window.removeEventListener("resize", onResize);
    }
    const flicker = animate(document.documentElement, {
      "--glow": [0.7, 1.4],
      duration: 900,
      ease: "inOutSine",
      alternate: true,
      loop: true,
    });
    animate(sweep, {
      x: innerWidth / 2,
      ease: spring({ bounce: 0.3, duration: 900 }),
      onUpdate: () => toSeam(sweep.x),
    });
    return () => {
      flicker.revert();
      window.removeEventListener("resize", onResize);
    };
  }, []);

  const place = (px: number) => {
    ratio.current = px / innerWidth;
    setSeam(px);
    handle.current?.setAttribute("aria-valuenow", String(Math.round(ratio.current * 100)));
    markSides();
  };

  const recentre = () => {
    if (reducedMotion()) return place(innerWidth / 2);
    const from = { x: ratio.current * innerWidth };
    animate(from, { x: innerWidth / 2, ease: spring({ bounce: 0.35, duration: 500 }), onUpdate: () => place(from.x) });
  };

  return (
    <>
      {/* Inline because the CSS minifier drops unprefixed backdrop-filter. */}
      <div className="seam-veil" style={{ backdropFilter: "grayscale(1)", WebkitBackdropFilter: "grayscale(1)" }} />
      <div className="seam-line" />
      <button
        ref={handle}
        type="button"
        className="seam-handle"
        role="slider"
        aria-label="Burn front, mono left and color right"
        aria-orientation="horizontal"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={50}
        onDoubleClick={recentre}
        onPointerDown={(e) => e.currentTarget.setPointerCapture(e.pointerId)}
        onPointerMove={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) place(e.clientX);
        }}
        onKeyDown={(e) => {
          const step = e.key === "ArrowLeft" ? -0.02 : e.key === "ArrowRight" ? 0.02 : 0;
          if (!step) return;
          e.preventDefault();
          e.stopPropagation();
          place((ratio.current + step) * innerWidth);
        }}
      />
    </>
  );
}
