// Plain text and SVG output. SVG is a port of make_ascii_svg.py: same geometry, timing and escaping.
import { RAMP } from "./pipeline.ts";
import { cellColor, GROUNDS, type Mode } from "./render.ts";

export type Output = { cols: number; rows: number; cells: Uint8Array; rgb: Uint8Array };
export type SvgOptions = { mode: Mode; ground: keyof typeof GROUNDS; reveal: boolean; smaller: boolean; frame: boolean };

const CELL_W = 10 / 3;
const CELL_H = 6.25;
const FRAME_PAD = 20;
const ROW_DUR = 0.05;
const STAGGER = 0.05;

// Python prints whole floats with a trailing .0.
const float = (v: number) => (Number.isInteger(v) ? v.toFixed(1) : String(v));

// Python formats exact ties to even, where toFixed rounds them up.
function fixed(v: number, digits: number) {
  const scaled = v * 10 ** digits;
  if (scaled % 1 !== 0.5) return v.toFixed(digits);
  const down = Math.floor(scaled);
  return ((down % 2 === 0 ? down : down + 1) / 10 ** digits).toFixed(digits);
}

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#x27;" };
const escape = (s: string) => s.replace(/[&<>"']/g, (c) => ESCAPES[c]);

const hex = (c: readonly number[], smaller: boolean) =>
  smaller
    ? "#" + c.map((v) => Math.round(v / 17).toString(16)).join("")
    : "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("");

export function toText({ cols, rows, cells }: Output) {
  const lines: string[] = [];
  for (let y = 0; y < rows; y++) {
    let line = "";
    for (let x = 0; x < cols; x++) line += RAMP[cells[y * cols + x]];
    lines.push(line);
  }
  return lines.join("\n");
}

// One <tspan> per run of a color. A space has no color, so it joins the run it lands in.
function colorRow(out: Output, y: number, o: SvgOptions, ink: readonly number[]) {
  let html = "";
  let run = "";
  let fill = "";
  const flush = () => {
    if (!run) return;
    html += fill ? `<tspan fill="${fill}">${escape(run)}</tspan>` : escape(run);
    run = "";
  };
  for (let x = 0; x < out.cols; x++) {
    const i = y * out.cols + x;
    if (out.cells[i] === 0) {
      run += " ";
      continue;
    }
    const next = hex(cellColor(o.mode, out.rgb, i, ink), o.smaller);
    if (next !== fill) {
      flush();
      fill = next;
    }
    run += RAMP[out.cells[i]];
  }
  flush();
  return html;
}

export function toSvg(out: Output, o: SvgOptions) {
  const PAD = o.frame ? FRAME_PAD : 0;
  const artW = out.cols * CELL_W;
  const artH = out.rows * CELL_H;
  const canvasW = artW + PAD * 2;
  const canvasH = artH + PAD * 2;
  const { fill, ink } = GROUNDS[o.ground];
  const inkHex = hex(ink, false);
  const dark = o.ground === "dark";
  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${float(canvasW)}" height="${float(canvasH)}" viewBox="0 0 ${float(canvasW)} ${float(canvasH)}" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace">`,
    ...(o.frame
      ? [
          dark
            ? '<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#111722"/><stop offset="1" stop-color="#0d1117"/></linearGradient></defs>'
            : "<defs></defs>",
          `<rect width="${float(canvasW)}" height="${float(canvasH)}" rx="12" fill="${dark ? "url(#bg)" : hex(fill, false)}"/>`,
          `<rect x="0.5" y="0.5" width="${float(canvasW - 1)}" height="${float(canvasH - 1)}" rx="12" fill="none" stroke="${dark ? "#30363d" : "#d0d7de"}" stroke-width="1"/>`,
        ]
      : [`<rect width="${float(canvasW)}" height="${float(canvasH)}" fill="${hex(fill, false)}"/>`]),
  ];
  const fontSize = fixed(CELL_H * 0.86, 1);
  for (let ry = 0; ry < out.rows; ry++) {
    const y = PAD + ry * CELL_H + CELL_H * 0.74;
    const rowY = PAD + ry * CELL_H;
    const delay = ry * STAGGER;
    let line = "";
    if (o.mode === "Mono") {
      for (let x = 0; x < out.cols; x++) line += RAMP[out.cells[ry * out.cols + x]];
      line = escape(line);
    } else {
      line = colorRow(out, ry, o, ink);
    }
    const text = `<text xml:space="preserve" x="${PAD}" y="${fixed(y, 1)}" fill="${inkHex}" font-size="${fontSize}" textLength="${float(artW)}" lengthAdjust="spacing">${line}</text>`;
    if (!o.reveal) {
      parts.push(text);
      continue;
    }
    parts.push(
      `<clipPath id="r${ry}"><rect x="${PAD}" y="${fixed(rowY, 1)}" height="${CELL_H}" width="0"><animate attributeName="width" from="0" to="${float(artW)}" begin="${delay.toFixed(3)}s" dur="${ROW_DUR.toFixed(2)}s" fill="freeze"/></rect></clipPath>`,
      `<g clip-path="url(#r${ry})">${text}</g>`,
      `<rect y="${fixed(rowY + 1, 1)}" width="${CELL_W}" height="${CELL_H - 2}" fill="${inkHex}" opacity="0"><animate attributeName="x" from="${PAD}" to="${float(PAD + artW)}" begin="${delay.toFixed(3)}s" dur="${ROW_DUR.toFixed(2)}s" fill="freeze"/><set attributeName="opacity" to="0.85" begin="${delay.toFixed(3)}s"/><set attributeName="opacity" to="0" begin="${(delay + ROW_DUR).toFixed(3)}s"/></rect>`,
    );
  }
  parts.push("</svg>");
  return parts.join("");
}
