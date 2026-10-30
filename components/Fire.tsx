"use client";

import { useEffect, useRef } from "react";
import { reducedMotion } from "@/lib/motion";

const VERT = `attribute vec2 p; void main() { gl_Position = vec4(p, 0.0, 1.0); }`;

const NOISE = `precision highp float;
uniform vec2 uRes;
uniform float uT, uHeat;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; }
  return v;
}
`;

const FIRE = NOISE + `
// Incandescent ramp: dark red through orange and yellow to a pale core.
vec3 ramp(float f) {
  vec3 c = mix(vec3(0.28, 0.02, 0.0), vec3(0.85, 0.16, 0.01), smoothstep(0.1, 0.38, f));
  c = mix(c, vec3(1.0, 0.52, 0.06), smoothstep(0.35, 0.62, f));
  c = mix(c, vec3(1.0, 0.84, 0.36), smoothstep(0.58, 0.84, f));
  return mix(c, vec3(1.0, 0.97, 0.82), smoothstep(0.88, 1.0, f));
}
float sparks(vec2 uv) {
  float s = 0.0;
  for (float i = 0.0; i < 3.0; i++) {
    vec2 g = uv * vec2(14.0 + i * 5.0, 7.0);
    g.y -= uT * (1.5 + i * 0.5);
    g.x += sin(g.y * 0.9 + i * 2.0 + uT) * 0.3;
    vec2 id = floor(g), f = fract(g) - 0.5;
    float h = hash(id + i * 7.0);
    if (h > 0.88) s += smoothstep(0.1, 0.0, length(f + (vec2(hash(id + 3.0), h) - 0.5) * 0.6));
  }
  return s;
}
void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  float x = (uv.x - 0.5) * 2.0;
  float t = uT;
  vec2 warp = vec2(fbm(vec2(x * 1.6, uv.y * 1.8 - t * 0.9)), fbm(vec2(x * 1.6 + 5.2, uv.y * 1.8 - t * 1.1)));
  float n = fbm(vec2(x * 2.4, uv.y * 2.6 - t * 1.7) + (warp - 0.5) * 2.2);
  // Height breathes on its own, in slow surges and quick licks, and climbs with heat.
  float surge = 0.72 + 0.4 * noise(vec2(t * 0.8, 3.0)) + 0.12 * noise(vec2(t * 4.3, 8.0));
  float tall = mix(0.62, 1.12, uHeat) * surge;
  float y = uv.y / tall;
  float breadth = 0.86 + 0.16 * noise(vec2(t * 1.1, 6.0));
  float waist = max(0.02, breadth * (1.0 - y * 0.55));
  float f = (1.0 - y * 1.08) + (n - 0.5) * 1.8;
  f *= (1.0 - smoothstep(waist * 0.55, waist, abs(x))) * (1.0 - smoothstep(0.72, 0.95, y));
  f = clamp(f * 0.95, 0.0, 1.0);
  float bed = smoothstep(0.06, 0.0, uv.y) * (1.0 - smoothstep(0.9, 0.98, abs(x))) * (0.45 + 0.75 * noise(vec2(x * 9.0, t * 0.7)));
  f = max(f, bed * mix(0.5, 0.75, uHeat));
  float a = smoothstep(0.1, 0.3, f);
  // Paper tooth: pigment skips the low points of the sheet, most at the flame's thin edges.
  vec2 px = gl_FragCoord.xy;
  float tooth = noise(px * 0.62) * 0.6 + noise(px * 1.7) * 0.4;
  a *= smoothstep(0.3, 0.46, tooth + f * 0.24);
  vec3 c = ramp(f);
  float sp = sparks(uv) * max(uHeat, 0.35) * smoothstep(1.0, 0.35, uv.y);
  c += vec3(1.0, 0.6, 0.2) * sp;
  a = clamp(a + sp, 0.0, 1.0);
  gl_FragColor = vec4(c * a, a);
}`;

const SMOKE = NOISE + `
void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  float x = (uv.x - 0.5) * 2.0;
  float y = uv.y;
  float t = uT;
  // The plume leans downwind and sways more the higher it gets.
  float c = 0.3 * y * y + 0.1 * y * sin(y * 4.0 - t * 0.7);
  float w = mix(0.1, 0.16, uHeat) + y * mix(0.3, 0.56, uHeat);
  vec2 warp = vec2(fbm(vec2(x * 1.4, y * 2.0 - t * 0.35)), fbm(vec2(x * 1.4 + 4.1, y * 2.0 - t * 0.45)));
  float n = fbm(vec2((x - c) * 2.6, y * 3.6 - t * 0.75) + (warp - 0.5) * 2.0);
  float body = 1.0 - smoothstep(0.3, 1.0, abs(x - c) / w);
  float a = body * smoothstep(0.26, 0.68, n + 0.14);
  a *= smoothstep(0.0, 0.05, y) * (1.0 - smoothstep(0.5, 1.0, y));
  a = clamp(a * mix(0.4, 0.9, uHeat), 0.0, 1.0);
  vec2 px = gl_FragCoord.xy;
  a *= smoothstep(0.26, 0.5, noise(px * 0.62) * 0.6 + noise(px * 1.7) * 0.4 + a * 0.3);
  vec3 c0 = mix(vec3(0.1, 0.095, 0.09), vec3(0.42, 0.4, 0.37), smoothstep(0.0, 0.8, y));
  gl_FragColor = vec4(c0 * a, a);
}`;

// heat runs 0 to 1. Rendered only while on screen. Reduced motion gets one still frame.
function useShader(frag: string, heat: number, onFrame?: (el: HTMLCanvasElement, eased: number, ms: number) => void) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const target = useRef(heat);
  target.current = heat;

  useEffect(() => {
    const el = canvas.current!;
    const gl = el.getContext("webgl", { premultipliedAlpha: true, alpha: true });
    if (!gl) {
      el.dataset.noGl = "";
      return;
    }
    const shader = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, shader(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, frag));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error(gl.getProgramInfoLog(prog));
      return;
    }
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const attr = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(attr);
    gl.vertexAttribPointer(attr, 2, gl.FLOAT, false, 0, 0);
    const uRes = gl.getUniformLocation(prog, "uRes");
    const uT = gl.getUniformLocation(prog, "uT");
    const uHeat = gl.getUniformLocation(prog, "uHeat");

    let eased = target.current;
    let raf = 0;
    let visible = false;
    const frame = (ms: number) => {
      eased += (target.current - eased) * 0.06;
      const dpr = Math.min(devicePixelRatio, 1);
      const w = Math.round(el.clientWidth * dpr);
      const h = Math.round(el.clientHeight * dpr);
      if (el.width !== w || el.height !== h) {
        el.width = w;
        el.height = h;
        gl.viewport(0, 0, w, h);
      }
      gl.uniform2f(uRes, w, h);
      gl.uniform1f(uT, ms / 1000);
      gl.uniform1f(uHeat, eased);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      onFrame?.(el, eased, ms);
      if (visible && !reducedMotion()) raf = requestAnimationFrame(frame);
    };
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      cancelAnimationFrame(raf);
      if (visible) raf = requestAnimationFrame(frame);
    });
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [frag, onFrame]);

  return canvas;
}

const flickerGlow = (el: HTMLCanvasElement, eased: number, ms: number) => {
  const glow = el.closest(".kiln-stage")?.querySelector<HTMLElement>(".fire-glow");
  if (glow) glow.style.opacity = String((0.3 + 0.7 * eased) * (0.62 + 0.2 * Math.sin(ms / 90) * Math.sin(ms / 233)));
};

export default function Fire({ heat }: { heat: number }) {
  const canvas = useShader(FIRE, heat, flickerGlow);
  return (
    <canvas
      ref={canvas}
      className="h-full w-full data-[no-gl]:bg-[radial-gradient(ellipse_at_50%_100%,#ffb15e,#e2571e_35%,transparent_70%)]"
      aria-hidden="true"
      style={{ borderRadius: "50% 50% 0 0 / 34.4% 34.4% 0 0" }}
    />
  );
}

export function Smoke({ heat }: { heat: number }) {
  const canvas = useShader(SMOKE, heat);
  return <canvas ref={canvas} className="h-full w-full" aria-hidden="true" />;
}
