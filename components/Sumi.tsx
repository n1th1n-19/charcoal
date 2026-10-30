// Ink wash scenes, one per chapter, built from the medium's own moves: diluted tones, soft
// gradation (bokashi), wet ink pooling into wet ink (tarashikomi), contourless splashes
// (hatsuboku) and paper left empty. [data-wash] parts bleed in, [data-ink] strokes are painted.
const INK = "#1b1a19";
const RED = "#a8341c";

function Tones({ id }: { id: string }) {
  const fade = (key: string, color: string, top: number, y2 = 1) => (
    <linearGradient id={`${id}-${key}`} x1="0" y1="0" x2="0" y2={y2}>
      <stop offset="0" stopColor={color} stopOpacity={top} />
      <stop offset="0.55" stopColor={color} stopOpacity={top * 0.55} />
      <stop offset="1" stopColor={color} stopOpacity="0" />
    </linearGradient>
  );
  return (
    <defs>
      {fade("dark", INK, 0.92)}
      {fade("mid", INK, 0.55)}
      {fade("pale", INK, 0.26)}
      {fade("red", RED, 0.8)}
      <radialGradient id={`${id}-pool`}>
        <stop offset="0" stopColor={INK} stopOpacity="0.95" />
        <stop offset="0.6" stopColor={INK} stopOpacity="0.55" />
        <stop offset="1" stopColor={INK} stopOpacity="0" />
      </radialGradient>
      <radialGradient id={`${id}-sun`}>
        <stop offset="0" stopColor={RED} stopOpacity="0.85" />
        <stop offset="0.75" stopColor={RED} stopOpacity="0.6" />
        <stop offset="1" stopColor={RED} stopOpacity="0" />
      </radialGradient>
    </defs>
  );
}

const Wash = ({ children }: { children: React.ReactNode }) => <g filter="url(#wash)">{children}</g>;
const Brush = ({ children }: { children: React.ReactNode }) => <g filter="url(#sumi)">{children}</g>;

const LEAVES = [
  [52, 66, -18, 6], [66, 92, 16, 5], [84, 58, -12, 7], [98, 112, 20, 5], [116, 74, -20, 6], [126, 128, 14, 5],
  [144, 88, -14, 6], [158, 116, 18, 5], [40, 104, 16, 5], [74, 130, -16, 4], [108, 146, 12, 4], [172, 76, -18, 5],
];

function Willow() {
  return (
    <>
      <Tones id="w" />
      <Wash>
        <ellipse data-wash cx="112" cy="168" rx="92" ry="20" fill="url(#w-pale)" />
        <path data-wash d="M0 0C30 8 96 2 200 34L200 58C120 26 52 32 0 26Z" fill="url(#w-mid)" />
        <path data-wash d="M0 2C44 10 110 6 176 30C124 18 60 22 0 18Z" fill="url(#w-dark)" />
        <ellipse data-wash cx="30" cy="16" rx="22" ry="12" fill="url(#w-pool)" />
      </Wash>
      <Brush>
        <g fill="none" stroke={INK} strokeLinecap="round">
          <path data-ink d="M34 16C40 60 28 92 40 124" strokeWidth="1.3" opacity="0.55" />
          <path data-ink d="M72 20C80 64 66 104 76 152" strokeWidth="1.5" opacity="0.7" />
          <path data-ink d="M108 22C114 70 102 112 110 164" strokeWidth="1.3" opacity="0.5" />
          <path data-ink d="M146 30C152 66 142 96 150 136" strokeWidth="1.5" opacity="0.65" />
        </g>
        {LEAVES.map(([x, y, r, ry], i) => (
          <ellipse key={i} cx={x} cy={y} rx="1.9" ry={ry} fill={INK} opacity={0.3 + (i % 3) * 0.28} transform={`rotate(${r} ${x} ${y})`} />
        ))}
      </Brush>
    </>
  );
}

function Flames() {
  return (
    <>
      <Tones id="f" />
      <Wash>
        <ellipse data-wash cx="100" cy="180" rx="90" ry="14" fill="url(#f-mid)" />
        <path data-wash d="M100 8C126 46 172 76 166 128C162 166 128 184 100 184C70 184 36 166 36 128C32 92 70 70 72 40C86 52 92 34 100 8Z" fill="url(#f-red)" />
        <path data-wash d="M104 62C118 86 142 102 138 136C134 164 116 176 100 176C80 176 62 162 62 136C60 112 82 104 84 84C92 92 100 82 104 62Z" fill="url(#f-dark)" />
        <ellipse data-wash cx="100" cy="168" rx="46" ry="16" fill="url(#f-pool)" />
      </Wash>
      <Brush>
        <path data-ink d="M18 188C60 178 132 196 184 184" fill="none" stroke={INK} strokeWidth="4" strokeLinecap="round" />
        {[[42, 44, 2.6], [164, 34, 2], [30, 76, 1.5], [178, 70, 1.6], [128, 12, 1.4]].map(([x, y, r]) => (
          <circle key={x} cx={x} cy={y} r={r} fill={INK} opacity="0.75" />
        ))}
      </Brush>
    </>
  );
}

function Enso() {
  const arc = (from: number, to: number, r: number) => {
    let d = "";
    for (let a = from; a <= to; a += 4) {
      const t = (a * Math.PI) / 180;
      d += `${d ? "L" : "M"}${(100 + r * Math.cos(t)).toFixed(1)} ${(100 + r * Math.sin(t)).toFixed(1)}`;
    }
    return d;
  };
  return (
    <>
      <Tones id="e" />
      <Wash>
        <ellipse data-wash cx="100" cy="100" rx="82" ry="82" fill="url(#e-pale)" opacity="0.5" />
        <ellipse data-wash cx="56" cy="164" rx="30" ry="20" fill="url(#e-pool)" />
      </Wash>
      <Brush>
        <g fill="none" stroke={INK} strokeLinecap="round">
          <path data-ink d={arc(115, 300, 72)} strokeWidth="19" opacity="0.92" />
          <path data-ink d={arc(290, 420, 72)} strokeWidth="10" opacity="0.72" />
          <path data-ink d={arc(410, 452, 72)} strokeWidth="3.5" opacity="0.5" />
        </g>
        {[[150, 170, 2.6], [162, 158, 1.5], [38, 62, 1.8], [24, 86, 1.1], [176, 44, 1.4]].map(([x, y, r]) => (
          <circle key={x} cx={x} cy={y} r={r} fill={INK} opacity="0.7" />
        ))}
      </Brush>
    </>
  );
}

function Mountain() {
  return (
    <>
      <Tones id="m" />
      <Wash>
        <circle data-wash cx="148" cy="44" r="24" fill="url(#m-sun)" />
        <path data-wash d="M0 150C30 112 58 66 92 62C120 60 150 110 200 138L200 176L0 176Z" fill="url(#m-pale)" />
        <path data-wash d="M-6 164C24 134 44 92 70 92C96 92 120 136 156 158L150 188L-6 188Z" fill="url(#m-mid)" />
        <path data-wash d="M84 188C112 148 134 118 156 120C176 122 192 150 206 166L206 196L84 196Z" fill="url(#m-dark)" />
        <ellipse data-wash cx="70" cy="96" rx="20" ry="9" fill="url(#m-pool)" />
      </Wash>
      <Brush>
        <g fill="none" stroke={INK} strokeLinecap="round">
          <path data-ink d="M92 62C84 68 80 80 72 88" strokeWidth="2.4" opacity="0.7" />
          <path data-ink d="M156 120C148 126 146 134 138 142" strokeWidth="2" opacity="0.65" />
        </g>
      </Brush>
    </>
  );
}

// Moving parts stay out of the filtered picture, so the painted scene never has to redraw.
function Drift({ chapter }: { chapter: number }) {
  if (chapter === 0) {
    return [46, 112, 158].map((x, i) => (
      <ellipse key={x} data-drift="fall" cx={x} cy="60" rx="2" ry="5.5" fill={i === 1 ? RED : INK} opacity="0.7" style={{ animationDelay: `${i * 2}s` }} />
    ));
  }
  if (chapter === 1) {
    return [[58, 58], [146, 44], [112, 22]].map(([x, y], i) => (
      <circle key={x} data-drift="rise" cx={x} cy={y} r="2.2" fill={RED} style={{ animationDelay: `${i * 1.2}s` }} />
    ));
  }
  return null;
}

const SCENES = [Willow, Flames, Enso, Mountain];

export default function Sumi({ chapter }: { chapter: number }) {
  const Scene = SCENES[chapter];
  return (
    <>
      <svg viewBox="0 0 200 200" aria-hidden="true" className="h-full w-full overflow-visible will-change-transform">
        <Scene />
      </svg>
      <svg viewBox="0 0 200 200" aria-hidden="true" className="absolute inset-0 h-full w-full overflow-visible will-change-transform">
        <Drift chapter={chapter} />
      </svg>
    </>
  );
}
