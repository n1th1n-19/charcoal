// Pure image pipeline, ported from the portrait scripts. No DOM: runs in the worker and in Node.
// Rounding and edge handling follow cv2 and PIL exactly, so output can be diffed against them.

export const RAMP = " .`':,-~=+*ixcoszSXO#%8@";
export const CLAHE_TILES = 8;
export const CELL_ASPECT = 8 / 15;

const fr = Math.fround;
const clamp8 = (v: number) => (v <= 0 ? 0 : v >= 255 ? 255 : v);

// cvRound: nearest, ties to even.
function roundEven(v: number) {
  const r = Math.round(v);
  return Math.abs(v - Math.trunc(v)) === 0.5 && r % 2 !== 0 ? r - 1 : r;
}

export const rowsFor = (w: number, h: number, cols: number) => Math.max(1, Math.round((cols * h * CELL_ASPECT) / w));

// PIL paste with an L mask over transparent black: the background goes black, as in rembg's cutout.
export function cutout(rgba: Uint8ClampedArray, mask: Uint8Array) {
  const out = new Uint8Array(rgba.length);
  for (let i = 0; i < mask.length; i++) {
    const m = mask[i];
    for (let c = 0; c < 3; c++) {
      const t = rgba[i * 4 + c] * m + 128;
      out[i * 4 + c] = ((t >> 8) + t) >> 8;
    }
    out[i * 4 + 3] = m;
  }
  return out;
}

// cv2 RGB2GRAY in 14-bit fixed point.
export function grayscale(rgba: ArrayLike<number>, w: number, h: number) {
  const out = new Uint8Array(w * h);
  for (let i = 0; i < out.length; i++) {
    out[i] = (rgba[i * 4] * 4899 + rgba[i * 4 + 1] * 9617 + rgba[i * 4 + 2] * 1868 + 8192) >> 14;
  }
  return out;
}

const reflect101 = (i: number, n: number) => {
  if (n === 1) return 0;
  while (i < 0 || i >= n) i = i < 0 ? -i : 2 * n - i - 2;
  return i;
};

// cv2.createCLAHE(clipLimit, (8, 8)).apply
export function clahe(src: Uint8Array, w: number, h: number, clipLimit: number) {
  const N = CLAHE_TILES;
  const bins = 256;
  // Sizes that divide evenly are used as is. Others pad the right and bottom, even an axis that divides.
  const even = w % N === 0 && h % N === 0;
  const extW = even ? w : w + N - (w % N);
  const extH = even ? h : h + N - (h % N);
  const tileW = Math.floor(extW / N);
  const tileH = Math.floor(extH / N);
  const area = tileW * tileH;
  const lutScale = Math.fround((bins - 1) / area);
  const clip = clipLimit > 0 ? Math.max(Math.trunc((clipLimit * area) / bins), 1) : 0;

  const at = (x: number, y: number) => src[reflect101(y, h) * w + reflect101(x, w)];
  const lut = new Uint8Array(N * N * bins);
  const hist = new Int32Array(bins);
  for (let ty = 0; ty < N; ty++) {
    for (let tx = 0; tx < N; tx++) {
      hist.fill(0);
      for (let y = ty * tileH; y < (ty + 1) * tileH; y++) {
        for (let x = tx * tileW; x < (tx + 1) * tileW; x++) hist[at(x, y)]++;
      }
      if (clip > 0) {
        let clipped = 0;
        for (let i = 0; i < bins; i++) {
          if (hist[i] > clip) {
            clipped += hist[i] - clip;
            hist[i] = clip;
          }
        }
        const batch = Math.floor(clipped / bins);
        let residual = clipped - batch * bins;
        for (let i = 0; i < bins; i++) hist[i] += batch;
        if (residual) {
          const step = Math.max(Math.floor(bins / residual), 1);
          for (let i = 0; i < bins && residual > 0; i += step, residual--) hist[i]++;
        }
      }
      let sum = 0;
      const base = (ty * N + tx) * bins;
      for (let i = 0; i < bins; i++) {
        sum += hist[i];
        lut[base + i] = clamp8(roundEven(Math.fround(sum * lutScale)));
      }
    }
  }

  const invW = Math.fround(1 / tileW);
  const invH = Math.fround(1 / tileH);
  const x1 = new Int32Array(w);
  const x2 = new Int32Array(w);
  const xa = new Float32Array(w);
  for (let x = 0; x < w; x++) {
    const f = Math.fround(Math.fround(x * invW) - 0.5);
    const t = Math.floor(f);
    xa[x] = Math.fround(f - t);
    x1[x] = Math.max(t, 0) * bins;
    x2[x] = Math.min(t + 1, N - 1) * bins;
  }
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const f = Math.fround(Math.fround(y * invH) - 0.5);
    const t = Math.floor(f);
    const ya = Math.fround(f - t);
    const ya1 = Math.fround(1 - ya);
    const row1 = Math.max(t, 0) * N * bins;
    const row2 = Math.min(t + 1, N - 1) * N * bins;
    for (let x = 0; x < w; x++) {
      const v = src[y * w + x];
      const a = xa[x];
      const a1 = Math.fround(1 - a);
      const top = fr(fr(lut[row1 + x1[x] + v] * a1) + fr(lut[row1 + x2[x] + v] * a));
      const bot = fr(fr(lut[row2 + x1[x] + v] * a1) + fr(lut[row2 + x2[x] + v] * a));
      out[y * w + x] = clamp8(roundEven(fr(fr(top * ya1) + fr(bot * ya))));
    }
  }
  return out;
}

export const invert = (src: Uint8Array) => src.map((v) => 255 - v);

// cv2.convertScaleAbs(alpha=1.05, beta=18)
export function lift(src: Uint8Array, alpha = 1.05, beta = 18) {
  const a = Math.fround(alpha);
  return src.map((v) => clamp8(roundEven(Math.abs(Math.fround(v * a + beta)))));
}

// Alpha feathered with cv2.GaussianBlur((0, 0), 1) on floats, then pasted onto white.
export function compositeWhite(gray: Uint8Array, alpha: Uint8Array, w: number, h: number, sigma = 1) {
  const size = (Math.round(sigma * 8 + 1) | 1);
  const half = (size - 1) / 2;
  const kernel = new Float64Array(size);
  let total = 0;
  for (let i = 0; i < size; i++) total += kernel[i] = Math.exp(-((i - half) ** 2) / (2 * sigma * sigma));
  for (let i = 0; i < size; i++) kernel[i] /= total;

  const small = kernel.map(fr);
  const horiz = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let v = 0;
      for (let k = 0; k < size; k++) v = fr(v + fr(small[k] * fr(alpha[y * w + reflect101(x + k - half, w)] / 255)));
      horiz[y * w + x] = v;
    }
  }
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let m = 0;
      for (let k = 0; k < size; k++) m = fr(m + fr(small[k] * horiz[reflect101(y + k - half, h) * w + x]));
      out[y * w + x] = Math.trunc(clamp8(fr(fr(gray[y * w + x] * m) + fr(255 * fr(1 - m)))));
    }
  }
  return out;
}

// PIL extended box blur along one axis, in 24-bit fixed point.
function boxLine(get: (i: number) => number, put: (i: number, v: number) => void, n: number, radius: number) {
  const r = Math.trunc(radius);
  const ww = Math.trunc(fr(2 ** 24 / fr(fr(radius * 2) + 1)));
  const fw = Math.trunc((2 ** 24 - (r * 2 + 1) * ww) / 2);
  const c = (i: number) => get(i < 0 ? 0 : i >= n ? n - 1 : i);
  let acc = c(0) * (r + 1);
  for (let i = 0; i < r; i++) acc += c(i);
  for (let x = 0; x < n; x++) {
    acc += c(x + r) - c(x - r - 1);
    const bulk = acc * ww + (c(x - r - 1) + c(x + r + 1)) * fw;
    put(x, Math.floor((bulk + 2 ** 23) / 2 ** 24));
  }
}

// PIL GaussianBlur: three box passes on each axis.
function pilGaussian(src: Uint8Array, w: number, h: number, radius: number) {
  const passes = 3;
  const s2 = (radius * radius) / passes;
  const L = Math.sqrt(12 * s2 + 1);
  const l = Math.floor((L - 1) / 2);
  const a = ((2 * l + 1) * (l * (l + 1) - 3 * s2)) / (6 * (s2 - (l + 1) * (l + 1)));
  const box = Math.fround(l + a);
  const buf = src.slice();
  const line = new Uint8Array(Math.max(w, h));
  for (let p = 0; p < passes; p++) {
    for (let y = 0; y < h; y++) {
      line.set(buf.subarray(y * w, (y + 1) * w));
      boxLine((i) => line[i], (i, v) => (buf[y * w + i] = v), w, box);
    }
  }
  for (let p = 0; p < passes; p++) {
    for (let x = 0; x < w; x++) {
      for (let y = 0; y < h; y++) line[y] = buf[y * w + x];
      boxLine((i) => line[i], (i, v) => (buf[i * w + x] = v), h, box);
    }
  }
  return buf;
}

// PIL ImageFilter.UnsharpMask
export function unsharp(src: Uint8Array, w: number, h: number, radius = 2, percent = 140, threshold = 2) {
  if (percent === 0) return src;
  const blur = pilGaussian(src, w, h, radius);
  const out = new Uint8Array(src.length);
  for (let i = 0; i < src.length; i++) {
    const diff = src[i] - blur[i];
    out[i] = Math.abs(diff) > threshold ? clamp8(src[i] + Math.trunc((diff * percent) / 100)) : src[i];
  }
  return out;
}

// PIL ImageEnhance.Contrast: blends from the rounded image mean.
export function contrast(src: Uint8Array, factor: number) {
  if (factor === 1) return src;
  let sum = 0;
  for (let i = 0; i < src.length; i++) sum += src[i];
  const mean = Math.trunc(sum / src.length + 0.5);
  const f = Math.fround(factor);
  return src.map((v) => clamp8(Math.trunc(Math.fround(mean + f * (v - mean)))));
}

const sinc = (x: number) => (x === 0 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x));
const lanczos3 = (x: number) => (x > -3 && x < 3 ? sinc(x) * sinc(x / 3) : 0);

function coeffs(inSize: number, outSize: number) {
  const scale = inSize / outSize;
  const filterscale = Math.max(scale, 1);
  const support = 3 * filterscale;
  const ss = 1 / filterscale;
  const bounds: [number, number, Int32Array][] = [];
  for (let xx = 0; xx < outSize; xx++) {
    const center = (xx + 0.5) * scale;
    const xmin = Math.max(Math.trunc(center - support + 0.5), 0);
    const xmax = Math.min(Math.trunc(center + support + 0.5), inSize) - xmin;
    const k = new Float64Array(xmax);
    let ww = 0;
    for (let x = 0; x < xmax; x++) ww += k[x] = lanczos3((x + xmin - center + 0.5) * ss);
    const fixed = new Int32Array(xmax);
    for (let x = 0; x < xmax; x++) {
      const v = (k[x] / ww) * 2 ** 22;
      fixed[x] = Math.trunc(v < 0 ? v - 0.5 : v + 0.5);
    }
    bounds.push([xmin, xmax, fixed]);
  }
  return bounds;
}

const fix8 = (v: number) => clamp8(Math.floor(v / 2 ** 22));

// PIL Image.resize(LANCZOS): horizontal pass, then vertical. Interleaved with `channels` values per pixel.
export function resize(src: ArrayLike<number>, w: number, h: number, ow: number, oh: number, channels = 1) {
  const hc = coeffs(w, ow);
  const vc = coeffs(h, oh);
  const mid = new Uint8Array(ow * h * channels);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < ow; x++) {
      const [xmin, n, k] = hc[x];
      for (let c = 0; c < channels; c++) {
        let ss = 2 ** 21;
        for (let i = 0; i < n; i++) ss += src[(y * w + xmin + i) * channels + c] * k[i];
        mid[(y * ow + x) * channels + c] = fix8(ss);
      }
    }
  }
  const out = new Uint8Array(ow * oh * channels);
  for (let y = 0; y < oh; y++) {
    const [ymin, n, k] = vc[y];
    for (let x = 0; x < ow; x++) {
      for (let c = 0; c < channels; c++) {
        let ss = 2 ** 21;
        for (let i = 0; i < n; i++) ss += mid[((ymin + i) * ow + x) * channels + c] * k[i];
        out[(y * ow + x) * channels + c] = fix8(ss);
      }
    }
  }
  return out;
}

export function glyphIndex(px: number, gamma: number, floor: number) {
  const lum = Math.pow(px / 255, gamma);
  if (lum >= floor) return 0;
  return Math.max(0, Math.min(RAMP.length - 1, Math.floor((1 - lum) * (RAMP.length - 1) + 0.5)));
}

export function mapGlyphs(grid: Uint8Array, gamma: number, floor: number) {
  const lookup = Uint8Array.from({ length: 256 }, (_, v) => glyphIndex(v, gamma, floor));
  return grid.map((v) => lookup[v]);
}
