// Turns an image and its depth map into a looping 3D ASCII animation. No DOM: runs in the worker and in Node.
import { glyphIndex } from "./pipeline.ts";

export type Preset = "turntable" | "nod" | "orbit" | "drift" | "dolly" | "emerge" | "ripple" | "sweep";

export const PRESETS: { id: Preset; label: string; blurb: string }[] = [
  { id: "turntable", label: "Turntable", blurb: "Swings left and right" },
  { id: "nod", label: "Nod", blurb: "Tilts up and down" },
  { id: "orbit", label: "Orbit", blurb: "Small circular wobble" },
  { id: "drift", label: "Parallax drift", blurb: "Camera slides in a figure-eight" },
  { id: "dolly", label: "Dolly zoom", blurb: "Moves in while the view widens" },
  { id: "emerge", label: "Emerge", blurb: "Relief rises and sinks" },
  { id: "ripple", label: "Ripple", blurb: "A wave runs across the surface" },
  { id: "sweep", label: "Sweep light", blurb: "The light circles the subject" },
];

// Samples at three times the cell resolution. Each cell averages the samples on its front surface,
// so a glyph changes only when the surface under it really changes, instead of flickering.
export const OVERSAMPLE = 3;
// Samples this close behind a cell's front sample count as the same surface.
const SURFACE_BAND = 0.04;

export type Field = {
  w: number;
  h: number;
  // Processed luminance, as the 2D pipeline would map it to glyphs.
  lum: Uint8Array;
  rgb: Uint8Array;
  // 0 is far and 255 is near.
  depth: Uint8Array;
  // 0 where the background was removed.
  keep: Uint8Array | null;
};

export type Motion = {
  preset: Preset;
  // Relief height, 0 is flat.
  depth: number;
  // Scales how far the preset moves.
  motion: number;
  // Depth below this, from 0 to 1, counts as background and is left empty.
  cutoff: number;
  gamma: number;
  floor: number;
  // On a dark ground dense glyphs read as bright, so lighting works the other way.
  darkGround: boolean;
};

export type Frame = { cells: Uint8Array; rgb: Uint8Array };

type Pose = { yaw: number; pitch: number; tx: number; ty: number; dist: number; focal: number; relief: number; ripple: boolean; wave: number; light: [number, number, number] };

const TAU = Math.PI * 2;
const REST_DIST = 3;
const FILL = 0.9;
const DEFAULT_LIGHT: [number, number, number] = norm([-0.45, -0.55, 0.7]);

function norm([x, y, z]: [number, number, number]): [number, number, number] {
  const l = Math.hypot(x, y, z) || 1;
  return [x / l, y / l, z / l];
}

// Every pose uses whole periods of t, so the last frame flows straight back into the first.
export function pose(preset: Preset, t: number, motion: number): Pose {
  const a = TAU * t;
  const p: Pose = { yaw: 0, pitch: 0, tx: 0, ty: 0, dist: REST_DIST, focal: REST_DIST, relief: 1, ripple: false, wave: 0, light: DEFAULT_LIGHT };
  if (preset === "turntable") p.yaw = 0.6 * motion * Math.sin(a);
  else if (preset === "nod") p.pitch = 0.45 * motion * Math.sin(a);
  else if (preset === "orbit") {
    p.yaw = 0.35 * motion * Math.sin(a);
    p.pitch = 0.25 * motion * Math.cos(a);
  } else if (preset === "drift") {
    p.tx = 0.22 * motion * Math.sin(a);
    p.ty = 0.12 * motion * Math.sin(2 * a);
    p.yaw = -0.5 * p.tx;
    p.pitch = 0.5 * p.ty;
  } else if (preset === "dolly") {
    // Distance and focal length move together, so the subject's plane keeps its size and only depth shifts.
    p.dist = REST_DIST - 1.4 * motion * (0.5 - 0.5 * Math.cos(a));
    p.focal = p.dist;
  } else if (preset === "emerge") {
    p.relief = 0.5 - 0.5 * Math.cos(a);
    p.yaw = 0.2 * motion * Math.sin(a);
  } else if (preset === "ripple") {
    p.ripple = true;
    p.wave = t;
    p.pitch = 0.35;
  } else if (preset === "sweep") {
    p.light = norm([0.8 * Math.cos(a), 0.8 * Math.sin(a), 0.6]);
  }
  return p;
}

// Softens model noise in the depth map, so shading follows the shape rather than its grain.
export function smoothDepth(depth: Uint8Array, w: number, h: number, radius = 2) {
  const tmp = new Float32Array(w * h);
  const out = new Uint8Array(w * h);
  const span = radius * 2 + 1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0;
      for (let k = -radius; k <= radius; k++) sum += depth[y * w + Math.min(w - 1, Math.max(0, x + k))];
      tmp[y * w + x] = sum / span;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0;
      for (let k = -radius; k <= radius; k++) sum += tmp[Math.min(h - 1, Math.max(0, y + k)) * w + x];
      out[y * w + x] = Math.round(sum / span);
    }
  }
  return out;
}

export function renderFrame(field: Field, cols: number, rows: number, m: Motion, t: number): Frame {
  const { w, h } = field;
  const p = pose(m.preset, t, m.motion);
  // World units: the image spans x in [-1, 1], and y keeps the grid's aspect.
  const aspect = rows / cols;
  const sx = 2 / w;
  const sy = (2 * aspect) / h;
  const relief = 0.55 * m.depth * p.relief;
  const cut = m.cutoff * 255;
  const kept = (k: number) => !(field.keep && field.keep[k] < 128) && field.depth[k] >= cut;

  // Turns around the subject's own middle depth, so it swings in place instead of sliding.
  let mid = 0;
  let count = 0;
  for (let k = 0; k < w * h; k++) {
    if (!kept(k)) continue;
    mid += field.depth[k];
    count++;
  }
  mid = count ? mid / count / 255 : 0.5;
  const zOf = (k: number) => (field.depth[k] / 255 - mid) * relief;
  const waveZ = (x: number, y: number) => {
    if (!p.ripple) return 0;
    const r = Math.hypot(x, y / Math.max(aspect, 0.01));
    return 0.06 * m.motion * Math.sin(12 * r - TAU * p.wave) * Math.max(0, 1 - r * 0.6);
  };
  const cy = Math.cos(p.yaw), syw = Math.sin(p.yaw);
  const cp = Math.cos(p.pitch), sp = Math.sin(p.pitch);
  const rotate = (x: number, y: number, z: number): [number, number, number] => {
    const x1 = x * cy + z * syw;
    const z1 = -x * syw + z * cy;
    return [x1, y * cp - z1 * sp, y * sp + z1 * cp];
  };
  const [lx, ly, lz] = p.light;
  // Lighting is scaled so a surface facing the camera keeps its own tone, and only turns change it.
  const flat = 0.6 + 0.4 * Math.max(0, DEFAULT_LIGHT[2]);
  const dark = m.darkGround;

  // Every sample's cell and distance, worked out once and used by both passes.
  const n = cols * rows;
  const at = new Int32Array(w * h).fill(-1);
  const dist = new Float32Array(w * h);
  // Position in cell units, kept for the weighted splat in the second pass.
  const fx = new Float32Array(w * h);
  const fy = new Float32Array(w * h);
  const front = new Float32Array(n).fill(Infinity);
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const k = j * w + i;
      if (!kept(k)) continue;
      const x = (i + 0.5) * sx - 1;
      const y = (j + 0.5) * sy - aspect;
      const [rx, ry, rz] = rotate(x + p.tx, y + p.ty, zOf(k) + waveZ(x, y));
      const d = p.dist - rz;
      if (d <= 0.05) continue;
      const u = ((((rx * p.focal) / d) * FILL + 1) / 2) * cols;
      const v = ((((ry * p.focal) / d) * FILL + aspect) / (2 * aspect)) * rows;
      const c = Math.floor(u);
      const r = Math.floor(v);
      if (c < 0 || c >= cols || r < 0 || r >= rows) continue;
      const cell = r * cols + c;
      at[k] = cell;
      dist[k] = d;
      fx[k] = u;
      fy[k] = v;
      if (d < front[cell]) front[cell] = d;
    }
  }

  // Each sample feeds the four cells around it, weighted by how close it is to each centre, so a small
  // move shifts the averages gradually instead of snapping a sample from one cell to the next.
  const tone = new Float32Array(n);
  const color = new Float32Array(n * 3);
  const weight = new Float32Array(n);
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const k = j * w + i;
      const cell = at[k];
      if (cell < 0) continue;
      const x = (i + 0.5) * sx - 1;
      const y = (j + 0.5) * sy - aspect;
      const z = zOf(k) + waveZ(x, y);
      const zl = i > 0 && kept(k - 1) ? zOf(k - 1) + waveZ(x - sx, y) : z;
      const zr = i < w - 1 && kept(k + 1) ? zOf(k + 1) + waveZ(x + sx, y) : z;
      const zu = j > 0 && kept(k - w) ? zOf(k - w) + waveZ(x, y - sy) : z;
      const zd = j < h - 1 && kept(k + w) ? zOf(k + w) + waveZ(x, y + sy) : z;
      const [nx, ny, nz] = rotate(-(zr - zl) / (2 * sx), -(zd - zu) / (2 * sy), 1);
      const nl = Math.hypot(nx, ny, nz) || 1;
      const lambert = Math.max(0, (nx * lx + ny * ly + nz * lz) / nl);
      const shade = (0.6 + 0.4 * lambert) / flat;
      const lum = field.lum[k];
      const bright = Math.min(255, (dark ? 255 - lum : lum) * shade);
      const value = dark ? 255 - bright : bright;
      const gx = fx[k] - 0.5;
      const gy = fy[k] - 0.5;
      const c0 = Math.floor(gx);
      const r0 = Math.floor(gy);
      const ax = gx - c0;
      const ay = gy - r0;
      for (let dy = 0; dy < 2; dy++) {
        const rr = r0 + dy;
        if (rr < 0 || rr >= rows) continue;
        for (let dx = 0; dx < 2; dx++) {
          const cc = c0 + dx;
          if (cc < 0 || cc >= cols) continue;
          const target = rr * cols + cc;
          // Only the surface that is in front at that cell may contribute to it.
          if (dist[k] > front[target] + SURFACE_BAND) continue;
          const wt = (dx ? ax : 1 - ax) * (dy ? ay : 1 - ay);
          if (wt <= 0) continue;
          tone[target] += value * wt;
          color[target * 3] += field.rgb[k * 3] * wt;
          color[target * 3 + 1] += field.rgb[k * 3 + 1] * wt;
          color[target * 3 + 2] += field.rgb[k * 3 + 2] * wt;
          weight[target] += wt;
        }
      }
    }
  }

  // Closes single-cell gaps left inside a surface by its rotation.
  for (let r = 1; r < rows - 1; r++) {
    for (let c = 1; c < cols - 1; c++) {
      const cell = r * cols + c;
      if (weight[cell]) continue;
      const from = weight[cell - 1] && weight[cell + 1] ? cell - 1 : weight[cell - cols] && weight[cell + cols] ? cell - cols : -1;
      if (from < 0) continue;
      tone[cell] = tone[from];
      color.copyWithin(cell * 3, from * 3, from * 3 + 3);
      weight[cell] = weight[from];
    }
  }

  const cells = new Uint8Array(n);
  const rgb = new Uint8Array(n * 3);
  for (let cell = 0; cell < n; cell++) {
    const wgt = weight[cell];
    if (!wgt || front[cell] === Infinity) continue;
    cells[cell] = glyphIndex(Math.round(tone[cell] / wgt), m.gamma, m.floor);
    rgb[cell * 3] = Math.round(color[cell * 3] / wgt);
    rgb[cell * 3 + 1] = Math.round(color[cell * 3 + 1] / wgt);
    rgb[cell * 3 + 2] = Math.round(color[cell * 3 + 2] / wgt);
  }
  return { cells, rgb };
}

export function renderLoop(field: Field, cols: number, rows: number, m: Motion, frames: number): Frame[] {
  return Array.from({ length: frames }, (_, i) => renderFrame(field, cols, rows, m, i / frames));
}
