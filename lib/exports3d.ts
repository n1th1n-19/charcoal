// Animated SVG, terminal player, asciinema recording and text frames for a 3D loop.
import { RAMP } from "./pipeline.ts";
import { ANSI16, cellColor, GROUNDS, type Mode } from "./render.ts";
import type { Frame } from "./scene3d.ts";

export type Loop = { cols: number; rows: number; fps: number; frames: Frame[] };
export type Svg3dOptions = { mode: Mode; ground: keyof typeof GROUNDS; frame: boolean; smaller?: boolean };

const CELL_W = 10 / 3;
const CELL_H = 6.25;
const FRAME_PAD = 20;
const ESC = "\u001b";
const SITE = "https://charcoal.daystack.space";

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#x27;" };
const escape = (s: string) => s.replace(/[&<>"']/g, (c) => ESCAPES[c]);
const hex = (c: readonly number[]) => "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("");
// Three-digit colors: fewer distinct values, so neighbouring glyphs merge into longer runs.
const short = (c: readonly number[]) => [17 * Math.round(c[0] / 17), 17 * Math.round(c[1] / 17), 17 * Math.round(c[2] / 17)];
const shortHex = (c: readonly number[]) => "#" + c.map((v) => Math.round(v / 17).toString(16)).join("");
const num = (v: number) => String(Math.round(v * 100) / 100);

function monoRow(f: Frame, cols: number, y: number) {
  let line = "";
  for (let x = 0; x < cols; x++) line += RAMP[f.cells[y * cols + x]];
  return line;
}

// Runs of one color, as a list of [color, text]. Spaces have no color, so they join the run they land in.
function runs(f: Frame, cols: number, y: number, mode: Mode, ink: readonly number[], quantize = false) {
  const out: [readonly number[] | null, string][] = [];
  let color: readonly number[] | null = null;
  let text = "";
  for (let x = 0; x < cols; x++) {
    const i = y * cols + x;
    if (f.cells[i] === 0) {
      text += " ";
      continue;
    }
    const raw = cellColor(mode, f.rgb, i, ink);
    const next = quantize ? short(raw) : raw;
    if (!color || next.join() !== color.join()) {
      if (text) out.push([color, text]);
      color = next;
      text = "";
    }
    text += RAMP[f.cells[i]];
  }
  if (text) out.push([color, text]);
  return out;
}

export function toAnimatedSvg(loop: Loop, o: Svg3dOptions) {
  const { cols, rows, frames, fps } = loop;
  const pad = o.frame ? FRAME_PAD : 0;
  const artW = cols * CELL_W;
  const W = artW + pad * 2;
  const H = rows * CELL_H + pad * 2;
  const { fill, ink } = GROUNDS[o.ground];
  const n = frames.length;
  const dur = n / fps;
  const keyTimes = Array.from({ length: n }, (_, i) => num(i / n)).join(";");
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${num(W)}" height="${num(H)}" viewBox="0 0 ${num(W)} ${num(H)}" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace">`,
    o.frame
      ? `<rect width="${num(W)}" height="${num(H)}" rx="12" fill="${hex(fill)}"/><rect x="0.5" y="0.5" width="${num(W - 1)}" height="${num(H - 1)}" rx="12" fill="none" stroke="${o.ground === "dark" ? "#30363d" : "#d0d7de"}" stroke-width="1"/>`
      : `<rect width="${num(W)}" height="${num(H)}" fill="${hex(fill)}"/>`,
    `<g font-size="${num(CELL_H * 0.86)}" fill="${hex(ink)}">`,
  ];
  frames.forEach((f, i) => {
    // Each frame is shown for its slice of the loop. Frame 0 also shows where SMIL does not run.
    const values = Array.from({ length: n }, (_, k) => (k === i ? "visible" : "hidden")).join(";");
    parts.push(
      `<g visibility="${i === 0 ? "visible" : "hidden"}"><animate attributeName="visibility" values="${values}" keyTimes="${keyTimes}" calcMode="discrete" dur="${num(dur)}s" repeatCount="indefinite"/>`,
    );
    for (let y = 0; y < rows; y++) {
      const body =
        o.mode === "Mono"
          ? escape(monoRow(f, cols, y))
          : runs(f, cols, y, o.mode, ink, o.smaller)
              .map(([c, t]) => (c ? `<tspan fill="${o.smaller ? shortHex(c) : hex(c)}">${escape(t)}</tspan>` : escape(t)))
              .join("");
      parts.push(`<text xml:space="preserve" x="${pad}" y="${num(pad + y * CELL_H + CELL_H * 0.74)}" textLength="${num(artW)}" lengthAdjust="spacing">${body}</text>`);
    }
    parts.push("</g>");
  });
  parts.push("</g></svg>");
  return parts.join("");
}

// Terminal escape codes for one color: real ANSI 16 codes in that mode, 24-bit color otherwise.
function ansi(mode: Mode, c: readonly number[]) {
  if (mode === "16 colors") {
    const i = ANSI16.findIndex((a) => a[0] === c[0] && a[1] === c[1] && a[2] === c[2]);
    return `${ESC}[${i < 8 ? 30 + i : 82 + i}m`;
  }
  return `${ESC}[38;2;${c[0]};${c[1]};${c[2]}m`;
}

function terminalLines(loop: Loop, mode: Mode, ink: readonly number[]) {
  return loop.frames.map((f) =>
    Array.from({ length: loop.rows }, (_, y) =>
      mode === "Mono"
        ? monoRow(f, loop.cols, y)
        : runs(f, loop.cols, y, mode, ink)
            .map(([c, t]) => (c ? ansi(mode, c) + t : t))
            .join("") + `${ESC}[0m`,
    ),
  );
}

// A POSIX shell script that plays the loop. Frames sit after the exit line, so the script reads itself.
export function toShellPlayer(loop: Loop, mode: Mode, ground: keyof typeof GROUNDS) {
  const { ink } = GROUNDS[ground];
  const frames = terminalLines(loop, mode, ink);
  const delay = (1 / loop.fps).toFixed(3);
  const script = `#!/bin/sh
# 3D ASCII animation made with Charcoal, ${SITE}
# Play it: sh this-file.sh   Stop it: Ctrl+C   Play a set number of loops: CHARCOAL_LOOPS=3 sh this-file.sh
# Needs a terminal at least ${loop.cols} columns wide and ${loop.rows + 1} rows tall. On Windows, use Git Bash or WSL.
frames=${loop.frames.length}
lines=${loop.rows}
width=${loop.cols}
delay=${delay}
loops=\${CHARCOAL_LOOPS:-0}
me=$0
have=$(tput cols 2>/dev/null || echo "$width")
if [ "$have" -lt "$width" ]; then
  echo "Make the terminal at least $width columns wide, then run this again."
  exit 1
fi
first=$(awk '/^__CHARCOAL_FRAMES__$/ { print NR + 1; exit }' "$me")
done_playing() {
  printf '\\033[0m\\033[?25h\\n'
  exit 0
}
trap done_playing INT TERM
printf '\\033[?25l\\033[2J'
played=0
while :; do
  i=0
  while [ "$i" -lt "$frames" ]; do
    start=$((first + i * lines))
    printf '\\033[H'
    sed -n "\${start},$((start + lines - 1))p;$((start + lines - 1))q" "$me"
    sleep "$delay"
    i=$((i + 1))
  done
  played=$((played + 1))
  if [ "$loops" -gt 0 ] && [ "$played" -ge "$loops" ]; then done_playing; fi
done
exit 0
__CHARCOAL_FRAMES__
`;
  return script + frames.map((f) => f.join("\n")).join("\n") + "\n";
}

// asciicast v2: a header line, then one [time, "o", text] event per frame.
export function toAsciicast(loop: Loop, mode: Mode, ground: keyof typeof GROUNDS) {
  const { ink } = GROUNDS[ground];
  const frames = terminalLines(loop, mode, ink);
  const header = { version: 2, width: loop.cols, height: loop.rows, title: `Charcoal 3D, ${SITE}`, env: { TERM: "xterm-256color" } };
  const events = frames.map((f, i) => {
    const lead = i === 0 ? `${ESC}[?25l${ESC}[2J` : "";
    return JSON.stringify([Number((i / loop.fps).toFixed(4)), "o", `${lead}${ESC}[H${f.join("\r\n")}`]);
  });
  return [JSON.stringify(header), ...events].join("\n") + "\n";
}

// Plain frames separated by form feeds, the standard page break for text.
export function toTextFrames(loop: Loop) {
  return loop.frames.map((f) => Array.from({ length: loop.rows }, (_, y) => monoRow(f, loop.cols, y)).join("\n")).join("\n\f\n") + "\n";
}
