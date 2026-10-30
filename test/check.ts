import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { clahe, glyphIndex, mapGlyphs, RAMP, rowsFor } from "../lib/pipeline.ts";

// Luminance to character: the white floor, both ramp ends, and rounding at a boundary.
const n = RAMP.length - 1;
assert.equal(glyphIndex(255, 0.8, 0.8), 0, "white is a space");
assert.equal(glyphIndex(0, 0.8, 0.8), n, "black is the densest glyph");
assert.equal(RAMP[n], "@");
const justUnder = Math.ceil(255 * 0.8 ** (1 / 0.8)) - 1;
assert.notEqual(glyphIndex(justUnder, 0.8, 0.8), 0, "below the floor stays inked");
assert.equal(glyphIndex(justUnder + 1, 0.8, 0.8), 0, "at the floor goes blank");
for (let v = 0; v < 255; v++) {
  assert.ok(glyphIndex(v, 1.18, 1.01) >= glyphIndex(v + 1, 1.18, 1.01), "darker is never sparser");
}
assert.deepEqual([...mapGlyphs(Uint8Array.of(0, 255), 0.8, 0.8)], [n, 0]);
assert.equal(rowsFor(460, 460, 240), 128, "8:15 cell gives the portrait's grid");

// CLAHE against real cv2 output, on sizes that do and do not divide by 8.
const cases = JSON.parse(readFileSync(new URL("./clahe-golden.json", import.meta.url), "utf8"));
for (const c of cases) {
  assert.deepEqual([...clahe(Uint8Array.from(c.src), c.w, c.h, c.clip)], c.out, `clahe ${c.w}x${c.h} clip ${c.clip}`);
}
console.log(`ok: mapping and ${cases.length} CLAHE cases`);
