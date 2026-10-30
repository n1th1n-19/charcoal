// Placeholder log until the pipeline can generate it at build time.
function logArt() {
  const ramp = " .:-=+*#%@";
  const rows: string[] = [];
  for (let y = -7; y <= 7; y++) {
    let row = "";
    for (let x = -32; x <= 32; x++) {
      const end = x > 24 ? ((x - 24) / 8) ** 2 : 0;
      const inside = (y / 7) ** 2 + end <= 1;
      const grain = Math.sin(x * 0.35 + Math.sin(y * 1.3) * 2) * 0.5 + 0.5;
      const rings = x > 24 ? Math.sin(Math.hypot((x - 26) * 0.5, y) * 2) * 0.5 + 0.5 : grain;
      row += inside ? ramp[1 + Math.round(rings * 8)] : " ";
    }
    rows.push(row);
  }
  return rows.join("\n");
}

export default function BurnLoader() {
  const art = logArt();
  return (
    <div className="burn" role="status" aria-label="Loading Charcoal">
      <div className="burn-art" aria-hidden="true">
        <div className="burn-wood">{art}</div>
        <div className="burn-ink">{art}</div>
      </div>
    </div>
  );
}
