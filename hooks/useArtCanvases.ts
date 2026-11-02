import { RefObject, useCallback, useEffect, useRef } from "react";
import { seamX, SEAM_EVENT } from "@/components/Seam";
import type { Output } from "@/lib/exports";

export type Bitmaps = { mono: ImageBitmap; color: ImageBitmap };

// Owns the canvases that show the drawing, and keeps the mono one clipped to the seam.
export function useArtCanvases(output: Output | null, bitmaps: RefObject<Bitmaps | null>, shown: unknown) {
  const mono = useRef<HTMLCanvasElement>(null);
  const color = useRef<HTMLCanvasElement>(null);
  const finalArt = useRef<HTMLCanvasElement>(null);
  const finalBox = useRef<HTMLDivElement>(null);

  const clipToSeam = useCallback(() => {
    // Every mono art canvas shows only left of the seam, so its color twin shows through on the right.
    document.querySelectorAll<HTMLCanvasElement>("canvas[data-seam-clip]").forEach((canvas) => {
      const r = canvas.getBoundingClientRect();
      canvas.style.clipPath = `inset(0 ${Math.max(0, r.right - seamX())}px 0 0)`;
    });
  }, []);

  useEffect(() => {
    window.addEventListener(SEAM_EVENT, clipToSeam);
    return () => window.removeEventListener(SEAM_EVENT, clipToSeam);
  }, [clipToSeam]);

  // Drawn at the sheet's real pixel size with high-quality scaling. Letting CSS shrink the
  // full-size bitmap skips rows unevenly and shows as horizontal stripes.
  useEffect(() => {
    const paint = () => {
      const pair = bitmaps.current;
      // The Easel is unmounted on the 3D route, so there may be nothing to paint into.
      if (!pair || !mono.current || !color.current || !finalArt.current || !finalBox.current) return;
      for (const [ref, bitmap] of [[mono, pair.mono], [color, pair.color]] as const) {
        const c = ref.current!;
        c.width = Math.max(1, Math.round(c.clientWidth * devicePixelRatio));
        c.height = Math.max(1, Math.round(c.clientHeight * devicePixelRatio));
        const ctx = c.getContext("2d")!;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(bitmap, 0, 0, c.width, c.height);
      }
      const final = finalArt.current!;
      const box = finalBox.current!;
      const fit = Math.min(box.clientWidth / pair.color.width, box.clientHeight / pair.color.height);
      if (fit > 0) {
        final.style.width = `${pair.color.width * fit}px`;
        final.style.height = `${pair.color.height * fit}px`;
        final.width = Math.round(pair.color.width * fit * devicePixelRatio);
        final.height = Math.round(pair.color.height * fit * devicePixelRatio);
        const ctx = final.getContext("2d")!;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(pair.color, 0, 0, final.width, final.height);
      }
      clipToSeam();
    };
    paint();
    const watch = new ResizeObserver(paint);
    if (mono.current) watch.observe(mono.current);
    if (finalBox.current) watch.observe(finalBox.current);
    return () => watch.disconnect();
  }, [output, bitmaps, clipToSeam, shown]);

  return { mono, color, finalArt, finalBox, clipToSeam };
}
