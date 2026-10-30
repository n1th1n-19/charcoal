import { createTimeline, stagger, svg } from "animejs";
import { RefObject, useEffect } from "react";
import { reducedMotion } from "@/lib/motion";

// Arriving at a station bleeds its washes onto the sheet, adds the strokes and writes the words.
export function useStoryReveal(scroller: RefObject<HTMLElement | null>, active: number) {
  useEffect(() => {
    if (reducedMotion()) return;
    const root = scroller.current!.children[active];
    const strokes = root.querySelectorAll("[data-ink]");
    if (!strokes.length) return;
    const run = createTimeline()
      .add(root.querySelectorAll("[data-wash]"), { opacity: [0, 1], scale: [0.86, 1], duration: 1300, delay: stagger(240), ease: "outQuad" }, 0)
      .add(svg.createDrawable(strokes), { draw: ["0 0", "0 1"], duration: 800, delay: stagger(140), ease: "inOutSine" }, 700)
      .add(root.querySelectorAll("[data-word]"), { opacity: [0, 1], translateY: [5, 0], delay: stagger(45), duration: 340, ease: "outQuad" }, 1300);
    return () => void run.revert();
  }, [scroller, active]);
}
