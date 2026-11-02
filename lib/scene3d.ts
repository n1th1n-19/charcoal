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

// Samples at twice the cell resolution, so a turned surface still covers every cell.
export const OVERSAMPLE = 2;

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

export function renderFrame(field: Field, cols: number, rows: number, m: Motion, t: number): Frame {
  const { w, h } = field;
  const p = pose(m.preset, t, m.motion);
  // World units: the image spans x in [-1, 1], and y keeps the grid's aspect.
  const aspect = rows / cols;
  const sx = 2 / w;
  const sy = (2 * aspect) / h;
  const relief = 0.55 * m.depth * p.relief;
  const zOf = (i: number) => (field.depth[i] / 255 - 0.5) * relief;
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
  const cut = m.cutoff * 255;
  const dark = m.darkGround;

  const n = cols * rows;
  const zbuf = new Float32Array(n).fill(Infinity);
  const tone = new Uint8Array(n);
  const src = new Int32Array(n).fill(-1);

  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const k = j * w + i;
      if (field.keep && field.keep[k] < 128) continue;
      if (field.depth[k] < cut) continue;
      const x = (i + 0.5) * sx - 1;
      const y = (j + 0.5) * sy - aspect;
      const z = zOf(k) + waveZ(x, y);
      const [rx, ry, rz] = rotate(x + p.tx, y + p.ty, z);
      const depthToCam = p.dist - rz;
      if (depthToCam <= 0.05) continue;
      const px = (rx * p.focal) / depthToCam;
      const py = (ry * p.focal) / depthToCam;
      const c = Math.floor(((px * FILL + 1) / 2) * cols);
      const r = Math.floor(((py * FILL + aspect) / (2 * aspect)) * rows);
      if (c < 0 || c >= cols || r < 0 || r >= rows) continue;
      const cell = r * cols + c;
      if (depthToCam >= zbuf[cell]) continue;
      zbuf[cell] = depthToCam;

      // Surface normal from the depth slope, turned with the object.
      const zl = i > 0 ? zOf(k - 1) + waveZ(x - sx, y) : z;
      const zr = i < w - 1 ? zOf(k + 1) + waveZ(x + sx, y) : z;
      const zu = j > 0 ? zOf(k - w) + waveZ(x, y - sy) : z;
      const zd = j < h - 1 ? zOf(k + w) + waveZ(x, y + sy) : z;
      const [nx, ny, nz] = rotate(-(zr - zl) / (2 * sx), -(zd - zu) / (2 * sy), 1);
      const nl = Math.hypot(nx, ny, nz) || 1;
      const lambert = Math.max(0, (nx * lx + ny * ly + nz * lz) / nl);
      const shade = 0.35 + 0.85 * lambert;

      const lum = field.lum[k];
      const bright = dark ? 255 - lum : lum;
      const lit = Math.min(255, bright * shade);
      tone[cell] = Math.round(dark ? 255 - lit : lit);
      src[cell] = k;
    }
  }

  // Closes single-cell gaps left inside a surface by its rotation.
  for (let r = 1; r < rows - 1; r++) {
    for (let c = 1; c < cols - 1; c++) {
      const cell = r * cols + c;
      if (src[cell] >= 0) continue;
      const lr = src[cell - 1] >= 0 && src[cell + 1] >= 0;
      const ud = src[cell - cols] >= 0 && src[cell + cols] >= 0;
      if (!lr && !ud) continue;
      const from = lr ? cell - 1 : cell - cols;
      src[cell] = src[from];
      tone[cell] = tone[from];
    }
  }

  const cells = new Uint8Array(n);
  const rgb = new Uint8Array(n * 3);
  for (let cell = 0; cell < n; cell++) {
    const k = src[cell];
    if (k < 0) continue;
    cells[cell] = glyphIndex(tone[cell], m.gamma, m.floor);
    rgb[cell * 3] = field.rgb[k * 3];
    rgb[cell * 3 + 1] = field.rgb[k * 3 + 1];
    rgb[cell * 3 + 2] = field.rgb[k * 3 + 2];
  }
  return { cells, rgb };
}

export function renderLoop(field: Field, cols: number, rows: number, m: Motion, frames: number): Frame[] {
  return Array.from({ length: frames }, (_, i) => renderFrame(field, cols, rows, m, i / frames));
}
