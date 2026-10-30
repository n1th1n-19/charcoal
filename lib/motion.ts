export const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

const SCALE: [number, string][] = [
  [20, "#3f444a"],
  [300, "#551800"],
  [525, "#a51e00"],
  [700, "#e0460a"],
  [900, "#ff8a1f"],
];

// Approximate incandescence by temperature in C, Draper point at 525.
export function heatColor(c: number) {
  let i = SCALE.findIndex(([t]) => t >= c);
  if (i <= 0) return SCALE[Math.max(i, 0)][1];
  const [t0, a] = SCALE[i - 1];
  const [t1, b] = SCALE[i];
  const f = (c - t0) / (t1 - t0);
  const mix = (s: number) =>
    Math.round(parseInt(a.slice(s, s + 2), 16) * (1 - f) + parseInt(b.slice(s, s + 2), 16) * f)
      .toString(16)
      .padStart(2, "0");
  return `#${mix(1)}${mix(3)}${mix(5)}`;
}
