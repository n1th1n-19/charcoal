const SPARKS = [14, 27, 38, 52, 63, 74, 86];

// CSS only: this has to paint before any script arrives.
export default function BurnLoader() {
  return (
    <div className="burn" role="status" aria-label="Loading Charcoal">
      <div className="burn-stack">
        <div className="burn-art" aria-hidden="true">
          <div className="wipe wipe-wood">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/loader.webp" alt="" fetchPriority="high" />
          </div>
          <div className="wipe wipe-ink">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/loader.webp" alt="" fetchPriority="high" />
          </div>
          <div className="burn-front" />
        </div>
        <p className="burn-name">Charcoal</p>
        <p className="burn-note">Lighting the kiln</p>
      </div>
      <div className="burn-sparks" aria-hidden="true">
        {SPARKS.map((x, i) => (
          <span key={x} className="ash-spark" style={{ left: `${x}%`, animationDelay: `${i * 0.5}s` }} />
        ))}
      </div>
      {/* Inline because the CSS minifier drops unprefixed backdrop-filter. */}
      <div className="burn-veil" style={{ backdropFilter: "grayscale(1)", WebkitBackdropFilter: "grayscale(1)" }} />
      <div className="burn-seam" />
    </div>
  );
}
