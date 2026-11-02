// Animated GIF encoder: one shared 255-color palette, frames that store only what changed, and LZW.
// No DOM: frames come in as RGBA, so it runs in a worker and in Node tests.

const TRANSPARENT = 255;
const BINS = 1 << 15;

// 5 bits per channel. Fine enough for glyph edges, small enough to search quickly.
const bin = (r: number, g: number, b: number) => ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);

type Box = { bins: number[]; count: number };

// Median cut over the colors actually used, weighted by how often each appears.
function palette(hist: Float64Array, sums: Float64Array, size: number) {
  const used: number[] = [];
  for (let i = 0; i < BINS; i++) if (hist[i]) used.push(i);
  const channel = (b: number, c: number) => (b >> (10 - 5 * c)) & 31;
  let boxes: Box[] = [{ bins: used, count: used.reduce((n, b) => n + hist[b], 0) }];
  while (boxes.length < size) {
    boxes.sort((a, b) => b.count - a.count);
    const box = boxes.find((b) => b.bins.length > 1);
    if (!box) break;
    let wide = 0;
    let spread = -1;
    for (let c = 0; c < 3; c++) {
      let lo = 31;
      let hi = 0;
      for (const b of box.bins) {
        const v = channel(b, c);
        lo = Math.min(lo, v);
        hi = Math.max(hi, v);
      }
      if (hi - lo > spread) {
        spread = hi - lo;
        wide = c;
      }
    }
    box.bins.sort((a, b) => channel(a, wide) - channel(b, wide));
    let half = 0;
    let cut = 0;
    while (cut < box.bins.length - 1 && half + hist[box.bins[cut]] <= box.count / 2) half += hist[box.bins[cut++]];
    cut = Math.max(1, cut);
    const left = box.bins.slice(0, cut);
    const right = box.bins.slice(cut);
    boxes = boxes.filter((b) => b !== box);
    boxes.push({ bins: left, count: left.reduce((n, b) => n + hist[b], 0) }, { bins: right, count: right.reduce((n, b) => n + hist[b], 0) });
  }
  const colors = new Uint8Array(256 * 3);
  const lookup = new Uint8Array(BINS);
  boxes.forEach((box, i) => {
    let n = 0;
    const s = [0, 0, 0];
    for (const b of box.bins) {
      n += hist[b];
      for (let c = 0; c < 3; c++) s[c] += sums[b * 3 + c];
      lookup[b] = i;
    }
    for (let c = 0; c < 3; c++) colors[i * 3 + c] = Math.round(s[c] / (n || 1));
  });
  return { colors, lookup };
}

// GIF's variable-width LZW. The dictionary is stamped with a generation, so a reset costs nothing.
function lzw(indices: Uint8Array, out: number[]) {
  const MIN = 8;
  const CLEAR = 1 << MIN;
  const END = CLEAR + 1;
  const dict = new Int32Array(4096 * 256);
  const stamp = new Int32Array(4096 * 256);
  let gen = 1;
  let size = MIN + 1;
  let next = END + 1;
  let acc = 0;
  let bits = 0;
  const block: number[] = [];
  const emit = (code: number) => {
    acc |= code << bits;
    bits += size;
    while (bits >= 8) {
      block.push(acc & 255);
      acc >>>= 8;
      bits -= 8;
    }
  };
  out.push(MIN);
  emit(CLEAR);
  let prefix = indices[0];
  for (let i = 1; i < indices.length; i++) {
    const k = indices[i];
    const key = prefix * 256 + k;
    if (stamp[key] === gen) {
      prefix = dict[key];
      continue;
    }
    emit(prefix);
    if (next < 4096) {
      dict[key] = next;
      stamp[key] = gen;
      if (next === 1 << size && size < 12) size++;
      next++;
    } else {
      emit(CLEAR);
      gen++;
      size = MIN + 1;
      next = END + 1;
    }
    prefix = k;
  }
  emit(prefix);
  emit(END);
  if (bits) block.push(acc & 255);
  for (let i = 0; i < block.length; i += 255) {
    const chunk = block.slice(i, i + 255);
    out.push(chunk.length, ...chunk);
  }
  out.push(0);
}

// frames: RGBA images, all w by h. delay is per frame, in hundredths of a second.
export function encodeGif(frames: Uint8ClampedArray[], w: number, h: number, delay: number) {
  const hist = new Float64Array(BINS);
  const sums = new Float64Array(BINS * 3);
  for (const f of frames) {
    for (let i = 0; i < w * h; i++) {
      const b = bin(f[i * 4], f[i * 4 + 1], f[i * 4 + 2]);
      hist[b]++;
      sums[b * 3] += f[i * 4];
      sums[b * 3 + 1] += f[i * 4 + 1];
      sums[b * 3 + 2] += f[i * 4 + 2];
    }
  }
  const { colors, lookup } = palette(hist, sums, 255);

  const out: number[] = [];
  const text = (s: string) => out.push(...[...s].map((c) => c.charCodeAt(0)));
  const word = (v: number) => out.push(v & 255, (v >> 8) & 255);
  text("GIF89a");
  word(w);
  word(h);
  out.push(0xf7, 0, 0, ...colors);
  // Loops forever.
  out.push(0x21, 0xff, 11);
  text("NETSCAPE2.0");
  out.push(3, 1, 0, 0, 0);

  let previous: Uint8Array | null = null;
  for (const f of frames) {
    const idx = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) idx[i] = lookup[bin(f[i * 4], f[i * 4 + 1], f[i * 4 + 2])];
    // After the first frame, only the rectangle that changed is stored, and unchanged pixels inside it are see-through.
    let [x0, y0, x1, y1] = [0, 0, w - 1, h - 1];
    if (previous) {
      [x0, y0, x1, y1] = [w, h, -1, -1];
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if (idx[y * w + x] === previous[y * w + x]) continue;
          x0 = Math.min(x0, x);
          y0 = Math.min(y0, y);
          x1 = Math.max(x1, x);
          y1 = Math.max(y1, y);
        }
      }
      if (x1 < 0) [x0, y0, x1, y1] = [0, 0, 0, 0];
    }
    const [fw, fh] = [x1 - x0 + 1, y1 - y0 + 1];
    const rect = new Uint8Array(fw * fh);
    for (let y = 0; y < fh; y++) {
      for (let x = 0; x < fw; x++) {
        const i = (y + y0) * w + x + x0;
        rect[y * fw + x] = previous && idx[i] === previous[i] ? TRANSPARENT : idx[i];
      }
    }
    out.push(0x21, 0xf9, 4, previous ? 0x05 : 0x04);
    word(delay);
    out.push(previous ? TRANSPARENT : 0, 0);
    out.push(0x2c);
    word(x0);
    word(y0);
    word(fw);
    word(fh);
    out.push(0);
    lzw(rect, out);
    previous = idx;
  }
  out.push(0x3b);
  return Uint8Array.from(out);
}
