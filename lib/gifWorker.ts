// Encodes a 3D loop as an animated GIF off the main thread, since a long loop takes a few seconds.
import { encodeGif } from "@/lib/gif";
import { GROUNDS, Mode, rasterize } from "@/lib/render";
import type { Loop } from "@/lib/exports3d";

export type GifRequest = { loop: Loop; mode: Mode; ground: keyof typeof GROUNDS };

self.onmessage = (e: MessageEvent<GifRequest>) => {
  const { loop, mode, ground } = e.data;
  const { fill, ink } = GROUNDS[ground];
  const images = loop.frames.map((f) => rasterize(loop.cols, loop.rows, f.cells, f.rgb, mode, fill, ink));
  const { width, height } = images[0];
  // GIF timing is in hundredths of a second, and browsers slow anything under 2 down to 10.
  const delay = Math.max(2, Math.round(100 / loop.fps));
  const bytes = encodeGif(images.map((i) => i.data), width, height, delay);
  (self as unknown as Worker).postMessage(bytes, [bytes.buffer]);
};
