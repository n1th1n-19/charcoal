import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { clahe, glyphIndex, mapGlyphs, RAMP, rowsFor } from "../lib/pipeline.ts";

// Luminance to character: the white floor, both ramp ends, and rounding at a boundary.
const n = RAMP.length - 1;
assert.equal(glyphIndex(255, 0.8, 0.8), 0, "white is a space");
assert.equal(glyphIndex(0, 0.8, 0.8), n, "black is the densest glyph");
assert.equal(RAMP[n], "@");
const justUnder = Math.ceil(255 * 0.8 ** (1 / 0.8)) - 1;
assert.notEqual(glyphIndex(justUnder, 0.8, 0.8), 0, "below the floor stays inked");
assert.equal(glyphIndex(justUnder + 1, 0.8, 0.8), 0, "at the floor goes blank");
for (let v = 0; v < 255; v++) {
  assert.ok(glyphIndex(v, 1.18, 1.01) >= glyphIndex(v + 1, 1.18, 1.01), "darker is never sparser");
}
assert.deepEqual([...mapGlyphs(Uint8Array.of(0, 255), 0.8, 0.8)], [n, 0]);
assert.equal(rowsFor(460, 460, 240), 128, "8:15 cell gives the portrait's grid");

// CLAHE against real cv2 output, on sizes that do and do not divide by 8.
const cases = JSON.parse(readFileSync(new URL("./clahe-golden.json", import.meta.url), "utf8"));
for (const c of cases) {
  assert.deepEqual([...clahe(Uint8Array.from(c.src), c.w, c.h, c.clip)], c.out, `clahe ${c.w}x${c.h} clip ${c.clip}`);
}
console.log(`ok: mapping and ${cases.length} CLAHE cases`);

// 3D: loops close seamlessly, rendering is deterministic, and every export holds the right frames.
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { toAnimatedSvg, toAsciicast, toShellPlayer, toTextFrames } from "../lib/exports3d.ts";
import { PRESETS, renderFrame, renderLoop } from "../lib/scene3d.ts";

{
  const [cols, rows] = [24, 12];
  const [w, h] = [cols * 3, rows * 3];
  const lum = new Uint8Array(w * h);
  const rgb = new Uint8Array(w * h * 3);
  const depth = new Uint8Array(w * h);
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const k = j * w + i;
      const d = Math.max(0, 1 - Math.hypot(i / w - 0.5, j / h - 0.5) * 2.2);
      depth[k] = Math.round(d * 255);
      lum[k] = 40 + ((i * 7 + j * 3) % 160);
      rgb.set([i * 5, j * 9, 120], k * 3);
    }
  }
  const field = { w, h, lum, rgb, depth, keep: null };
  const motion = { depth: 1, motion: 1, cutoff: 0, gamma: 0.8, floor: 0.8, darkGround: true };
  for (const { id } of PRESETS) {
    const m = { ...motion, preset: id };
    const a = renderFrame(field, cols, rows, m, 0);
    assert.deepEqual(renderFrame(field, cols, rows, m, 1).cells, a.cells, `${id} loops back to its first frame`);
    assert.deepEqual(renderFrame(field, cols, rows, m, 0).cells, a.cells, `${id} is deterministic`);
    assert.ok(a.cells.some((c) => c > 0), `${id} draws something`);
  }
  const cut = renderFrame(field, cols, rows, { ...motion, cutoff: 0.6, preset: "turntable" }, 0);
  assert.ok(cut.cells.filter((c) => c > 0).length < renderFrame(field, cols, rows, { ...motion, preset: "turntable" }, 0).cells.filter((c) => c > 0).length, "the cutoff empties far cells");
  const frames = renderLoop(field, cols, rows, { ...motion, preset: "turntable" }, 6);
  assert.ok(frames.some((f) => f.cells.join() !== frames[0].cells.join()), "the turntable moves");
  const loop = { cols, rows, fps: 30, frames };

  const svg = toAnimatedSvg(loop, { mode: "Original colors", ground: "dark", frame: false });
  assert.equal(svg.match(/<animate /g)?.length, 6, "one SVG animation per frame");
  assert.equal(svg.match(/<text /g)?.length, 6 * rows, "every frame has every row");
  assert.ok(svg.startsWith("<svg") && svg.endsWith("</svg>"));

  const cast = toAsciicast(loop, "16 colors", "dark").trim().split("\n").map((l) => JSON.parse(l));
  assert.equal(cast[0].version, 2);
  assert.equal(cast.length, 7, "asciicast header plus one event per frame");
  assert.ok(cast.slice(1).every((e: unknown[], i: number) => e[1] === "o" && Math.abs((e[0] as number) - i / 30) < 1e-3));

  assert.equal(toTextFrames(loop).split("\n\f\n").length, 6, "text frames are separated by form feeds");

  // The player is a real shell script: check its syntax, then play one loop and count what it prints.
  const dir = mkdtempSync(join(tmpdir(), "charcoal-"));
  try {
    const file = join(dir, "play.sh");
    writeFileSync(file, toShellPlayer(loop, "Original colors", "dark"));
    execFileSync("sh", ["-n", file]);
    const shown = execFileSync("sh", [file], { env: { ...process.env, CHARCOAL_LOOPS: "1", TERM: "dumb" } }).toString();
    assert.equal(shown.split("\u001b[H").length - 1, 6, "plays each frame once");
    assert.ok(shown.startsWith("\u001b[?25l") && shown.endsWith("\u001b[?25h\n"), "hides the cursor, then restores it");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  console.log(`ok: ${PRESETS.length} 3D presets and 4 exports`);
}

// GIF: decode what the encoder writes, and check every frame comes back pixel for pixel.
import { encodeGif } from "../lib/gif.ts";

function decodeGif(b: Uint8Array) {
  const w = b[6] | (b[7] << 8);
  const h = b[8] | (b[9] << 8);
  const table = b.subarray(13, 13 + 768);
  let p = 13 + 768;
  const frames: Uint8Array[] = [];
  let canvas = new Uint8Array(w * h * 3);
  let transparent = -1;
  let loops = -1;
  while (b[p] !== 0x3b) {
    if (b[p] === 0x21) {
      if (b[p + 1] === 0xf9) transparent = b[p + 3] & 1 ? b[p + 6] : -1;
      if (b[p + 1] === 0xff) loops = b[p + 16] | (b[p + 17] << 8);
      p += 2;
      while (b[p]) p += b[p] + 1;
      p++;
      continue;
    }
    const [x0, y0, fw, fh] = [0, 2, 4, 6].map((o) => b[p + 1 + o] | (b[p + 2 + o] << 8));
    p += 10;
    const min = b[p++];
    const data: number[] = [];
    while (b[p]) {
      data.push(...b.subarray(p + 1, p + 1 + b[p]));
      p += b[p] + 1;
    }
    p++;
    // Standard LZW decoding.
    const clear = 1 << min;
    let size = min + 1;
    let dict: number[][] = [];
    const reset = () => {
      dict = Array.from({ length: clear + 2 }, (_, i) => [i]);
      size = min + 1;
    };
    reset();
    const out: number[] = [];
    let prev: number[] | null = null;
    let bit = 0;
    for (;;) {
      let code = 0;
      for (let i = 0; i < size; i++, bit++) code |= ((data[bit >> 3] >> (bit & 7)) & 1) << i;
      if (code === clear) {
        reset();
        prev = null;
        continue;
      }
      if (code === clear + 1) break;
      const entry: number[] = code < dict.length ? dict[code] : [...prev!, prev![0]];
      out.push(...entry);
      if (prev) dict.push([...prev, entry[0]]);
      if (dict.length === 1 << size && size < 12) size++;
      prev = entry;
    }
    canvas = canvas.slice();
    for (let y = 0; y < fh; y++) {
      for (let x = 0; x < fw; x++) {
        const v = out[y * fw + x];
        if (v === transparent) continue;
        const i = ((y + y0) * w + x + x0) * 3;
        canvas.set(table.subarray(v * 3, v * 3 + 3), i);
      }
    }
    frames.push(canvas);
  }
  return { w, h, frames, loops };
}

{
  const [w, h, n] = [97, 61, 5];
  let seed = 9;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) >>> 16) & 3;
  const frames = Array.from({ length: n }, (_, f) => {
    const a = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) {
      const x = i % w;
      const moving = x > f * 15 && x < f * 15 + 20;
      a.set([moving ? 224 : rnd() * 64, (x & 7) * 32, moving ? 32 : 96, 255], i * 4);
    }
    return a;
  });
  const gif = decodeGif(encodeGif(frames, w, h, 8));
  assert.equal(gif.frames.length, n, "GIF keeps every frame");
  assert.equal(gif.loops, 0, "GIF loops forever");
  gif.frames.forEach((f, k) => {
    for (let i = 0; i < w * h; i++) {
      for (let c = 0; c < 3; c++) assert.equal(f[i * 3 + c], frames[k][i * 4 + c], `GIF frame ${k} pixel ${i}`);
    }
  });
  console.log("ok: GIF round trip");
}
