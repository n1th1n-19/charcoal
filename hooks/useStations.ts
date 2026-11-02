import { animate } from "animejs";
import { useCallback, useEffect, useRef, useState } from "react";
import { markSides } from "@/components/Seam";
import { STATION_COUNT } from "@/lib/config";
import { reducedMotion } from "@/lib/motion";

// The sideways sheet: which station is showing, and every way of moving between them.
export function useStations(onMoved: () => void) {
  const scroller = useRef<HTMLElement>(null);
  const needle = useRef<HTMLSpanElement>(null);
  const [active, setActive] = useState(0);

  const goTo = useCallback((index: number) => {
    const el = scroller.current;
    if (!el) return;
    const i = Math.max(0, Math.min(STATION_COUNT - 1, index));
    const left = (el.children[i] as HTMLElement).offsetLeft;
    if (reducedMotion()) {
      el.scrollLeft = left;
      return;
    }
    el.dataset.gliding = "";
    animate(el, { scrollLeft: left, duration: 900, ease: "inOutCubic", onComplete: () => delete el.dataset.gliding });
  }, []);

  // One gesture moves one station, so a screen never rests between two. Stations leaving fade to ghosts.
  useEffect(() => {
    const el = scroller.current!;
    let wheelLock = 0;
    const onWheel = (e: WheelEvent) => {
      if ((e.target as Element).closest("[data-xscroll]")) return;
      e.preventDefault();
      const delta = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      const now = performance.now();
      if (now < wheelLock || Math.abs(delta) < 8) return;
      wheelLock = now + 1000;
      goTo(Math.round(el.scrollLeft / el.clientWidth) + Math.sign(delta));
    };
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as Element).closest("input, select, [role=slider]")) return;
      const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      if (step) setActive((a) => (goTo(a + step), a));
    };
    const onScroll = () => {
      const middle = el.scrollLeft + el.clientWidth / 2;
      let nearest = 0;
      [...el.children].forEach((child, i) => {
        const s = child as HTMLElement;
        const gap = Math.abs(s.offsetLeft + s.offsetWidth / 2 - middle) / s.offsetWidth;
        if (gap < 0.5) nearest = i;
        s.style.opacity = reducedMotion() ? "1" : String(Math.max(0.16, 1.25 - gap * 1.1));
      });
      setActive(nearest);
      if (needle.current) needle.current.style.left = `${(el.scrollLeft / (el.scrollWidth - el.clientWidth)) * 100}%`;
      markSides();
      onMoved();
    };
    onScroll();
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("keydown", onKey);
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("keydown", onKey);
    };
  }, [goTo, onMoved]);

  return { scroller, needle, active, goTo };
}
