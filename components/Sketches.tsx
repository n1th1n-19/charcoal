import Fire, { Smoke } from "@/components/Fire";
import Instruments from "@/components/Instruments";

// Hand-drawn figures, generated from a seeded walk so server and client match.
function rng(seed: number) {
  return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}
const n = (v: number) => v.toFixed(1);

function wobble(points: [number, number][], r: () => number, amp = 1.6) {
  return "M" + points.map(([x, y]) => `${n(x + (r() - 0.5) * amp)} ${n(y + (r() - 0.5) * amp)}`).join("L");
}

function hatch(x: number, y: number, w: number, h: number, step: number, r: () => number) {
  let d = "";
  for (let i = 0; i < w + h; i += step) {
    const a: [number, number] = [x + Math.min(i, w), y + Math.max(0, i - w)];
    const b: [number, number] = [x + Math.max(0, i - h), y + Math.min(i, h)];
    d += wobble([a, b], r, 2.5);
  }
  return d;
}

export function WoodSection() {
  const r = rng(11);
  const rings = Array.from({ length: 17 }, (_, i) => {
    const R = 16 + i * 10 + r() * 3;
    const pts: [number, number][] = [];
    const lob = r() * 6;
    for (let a = 0; a <= 64; a++) {
      const t = (a / 64) * Math.PI * 2;
      const q = R * (1 + 0.035 * Math.sin(t * 3 + lob));
      pts.push([200 + q * Math.cos(t), 200 + q * 0.94 * Math.sin(t)]);
    }
    return <path key={i} d={wobble(pts, r, 1.2)} strokeWidth={i % 4 === 3 ? 2.4 : 1} />;
  });
  const rays = Array.from({ length: 46 }, (_, i) => {
    const t = (i / 46) * Math.PI * 2 + r() * 0.06;
    const a = 18 + r() * 50;
    const b = 120 + r() * 58;
    return <path key={i} d={wobble([[200 + a * Math.cos(t), 200 + a * Math.sin(t)], [200 + b * Math.cos(t), 200 + b * Math.sin(t)]], r)} strokeWidth="0.7" />;
  });
  const cells = [];
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 11; x++) {
      const w = 13 - y * 0.6;
      cells.push(<rect key={`${x}-${y}`} x={n(286 + x * 14 + (y % 2) * 5)} y={n(226 + y * 15)} width={n(w)} height="12" rx="4" />);
    }
  }
  return (
    <svg viewBox="0 0 460 400" aria-hidden="true" className="rough h-full w-full">
      <g fill="none" stroke="#6b4422">
        <path d="M200 16c70-3 160 50 170 150 8 90-60 200-170 214C100 390 24 300 22 200 20 90 110 20 200 16z" strokeWidth="5" />
        {rings}
        {rays}
      </g>
      <g fill="#e8e5dc" stroke="#3a6339" strokeWidth="1.5">{cells}</g>
    </svg>
  );
}

export function Sticks() {
  const r = rng(5);
  return (
    <svg viewBox="0 0 300 70" aria-hidden="true" className="rough h-full w-full">
      {[0, 1, 2, 3].map((i) => {
        const y = 12 + i * 15;
        const len = 170 + r() * 110;
        return <path key={i} d={`M${n(6 + r() * 12)} ${y}L${n(len)} ${n(y - 3 + r() * 6)}`} stroke="#1b1a19" strokeWidth={6 + r() * 4} strokeLinecap="round" />;
      })}
    </svg>
  );
}

export function Kiln({ temp }: { temp: number }) {
  const r = rng(23);
  let bricks = "";
  for (let y = 120; y < 400; y += 22) {
    for (let x = 96 + ((y / 22) % 2) * 22; x < 400; x += 44) {
      bricks += wobble([[x, y], [x + 40, y], [x + 40, y + 19], [x, y + 19], [x, y]], r, 2.2);
    }
  }
  return (
    <svg viewBox="0 0 660 500" role="img" aria-label={`Kiln at ${temp} degrees`} className="h-full w-full overflow-visible">
      <defs>
        <radialGradient id="glow">
          <stop offset="0" stopColor="#ff8a1f" stopOpacity="0.75" />
          <stop offset="0.5" stopColor="#e2571e" stopOpacity="0.3" />
          <stop offset="1" stopColor="#e2571e" stopOpacity="0" />
        </radialGradient>
      </defs>
      <foreignObject x="96" y="-210" width="300" height="250">
        <Smoke heat={(temp - 20) / 880} />
      </foreignObject>
      <g className="rough" fill="none" stroke="#1b1a19" strokeLinecap="round">
        <path d="M84 440C70 240 110 96 250 84c150-12 190 150 176 356z" fill="#b9b3a6" strokeWidth="6" />
        <path d={bricks} strokeWidth="1.3" />
        <path d={hatch(84, 280, 110, 160, 7, r)} strokeWidth="1.6" />
        <path d="M216 84V30h60v54" fill="#b9b3a6" strokeWidth="5" />
        <path d={hatch(216, 30, 26, 54, 5, r)} strokeWidth="1.3" />
        <path d="M60 442h396M40 470h440" strokeWidth="5" />
        <path d="M426 200h96v150" strokeWidth="9" />
        <path d="M426 200h96v150" stroke="#d9d5cb" strokeWidth="4" />
        <path d="M494 350h60l-8 96h-44z" strokeWidth="4" fill="#e8e5dc" />
        <circle cx="500" cy="120" r="46" fill="#e8e5dc" strokeWidth="4" />
        <path d="M500 166v34" strokeWidth="5" />
      </g>
      <ellipse className="fire-glow" cx="250" cy="370" rx="250" ry="190" fill="url(#glow)" opacity="0" style={{ mixBlendMode: "multiply" }} />
      <path d="M130 440V322A120 62 0 0 1 370 322V440Z" fill="#1b1a19" className="rough" />
      <foreignObject x="130" y="260" width="240" height="180">
        <Fire heat={(temp - 20) / 880} />
      </foreignObject>
      <Instruments temp={temp} />
    </svg>
  );
}
