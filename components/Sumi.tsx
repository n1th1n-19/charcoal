// Sumi-e scenes, one per chapter. [data-ink] strokes are painted in order by the station,
// and [data-drift] parts keep moving afterwards.
const INK = "#1b1a19";
const RED = "#a8341c";
const n = (v: number) => v.toFixed(1);

function spiral(cx: number, cy: number, turns: number, grow: number, dir: number, tail: [number, number]) {
  let d = `M${tail[0]} ${tail[1]}`;
  const steps = Math.round(turns * 24);
  for (let i = steps; i >= 0; i--) {
    const a = (i / 24) * Math.PI * 2 * dir;
    const r = (i / 24) * grow;
    d += `L${n(cx + r * Math.cos(a))} ${n(cy + r * Math.sin(a))}`;
  }
  return d;
}

function Willow() {
  const strands = [28, 52, 76, 100, 124, 148, 172].map((x, i) => {
    const y = 12 + i * 3;
    const end = 96 + ((i * 37) % 62);
    return { x, y, end, d: `M${x} ${y}C${x + 8} ${y + 40} ${x - 7} ${y + 74} ${x + 3} ${end}` };
  });
  return (
    <>
      <path data-ink d="M2 6C52 16 118 10 198 34" stroke={INK} strokeWidth="6" />
      <path data-ink d="M60 12C84 22 104 22 128 16" stroke={INK} strokeWidth="2.5" />
      <g data-drift="sway" style={{ transformOrigin: "100px 10px" }}>
        {strands.map((s, i) => <path key={i} data-ink d={s.d} stroke={INK} strokeWidth="1.6" />)}
        {strands.flatMap((s, i) =>
          [0.45, 0.7, 0.95].map((t) => (
            <ellipse key={`${i}-${t}`} cx={s.x + 2} cy={s.y + (s.end - s.y) * t} rx="1.6" ry="5" fill={INK} transform={`rotate(${i % 2 ? 24 : -24} ${s.x + 2} ${s.y + (s.end - s.y) * t})`} />
          )),
        )}
      </g>
      {[46, 112, 158].map((x, i) => (
        <ellipse key={x} data-drift="fall" cx={x} cy="60" rx="2" ry="6" fill={RED} style={{ animationDelay: `${i}s` }} />
      ))}
    </>
  );
}

function Flames() {
  return (
    <>
      <path data-ink d="M6 186C44 176 72 196 104 184S164 176 196 186" stroke={INK} strokeWidth="5" />
      <path data-ink d={spiral(66, 118, 2.2, 13, 1, [34, 182])} stroke={RED} strokeWidth="5" />
      <path data-ink d={spiral(134, 92, 2.4, 14, -1, [150, 182])} stroke={RED} strokeWidth="6" />
      <path data-ink d={spiral(94, 54, 2, 11, 1, [100, 182])} stroke={INK} strokeWidth="3.5" />
      <g data-drift="rise">
        {[
          [52, 62],
          [150, 38],
          [120, 20],
          [38, 96],
        ].map(([x, y]) => <circle key={x} cx={x} cy={y} r="2.4" fill={RED} />)}
      </g>
    </>
  );
}

function Enso() {
  const arc = (from: number, to: number, r: number) => {
    let d = "";
    for (let a = from; a <= to; a += 4) {
      const t = (a * Math.PI) / 180;
      d += `${d ? "L" : "M"}${n(100 + r * Math.cos(t))} ${n(100 + r * Math.sin(t))}`;
    }
    return d;
  };
  return (
    <>
      <path data-ink d={arc(115, 440, 74)} stroke={INK} strokeWidth="13" />
      <path data-ink d={arc(120, 300, 79)} stroke={INK} strokeWidth="5" />
      <path data-ink d={arc(250, 420, 69)} stroke={INK} strokeWidth="3" />
    </>
  );
}

function Mountain() {
  return (
    <>
      <circle data-drift="sun" cx="146" cy="46" r="24" fill={RED} />
      <path data-ink d="M6 164L84 52C92 42 106 42 114 52L196 164" stroke={INK} strokeWidth="5" />
      <path data-ink d="M70 72L84 86L94 72L104 88L116 74L132 86" stroke={INK} strokeWidth="2.5" />
      <path data-ink d="M30 164L58 128M150 128L176 164" stroke={INK} strokeWidth="1.6" />
      <g data-drift="mist" stroke={INK} strokeWidth="2" opacity="0.55">
        <path data-ink d="M8 134H82M104 146H192" />
        <path data-ink d="M26 180H118M136 172H186" />
      </g>
    </>
  );
}

const SCENES = [Willow, Flames, Enso, Mountain];

export default function Sumi({ chapter }: { chapter: number }) {
  const Scene = SCENES[chapter];
  return (
    <svg viewBox="0 0 200 200" aria-hidden="true" className="sumi h-full w-full overflow-visible" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <Scene />
    </svg>
  );
}
