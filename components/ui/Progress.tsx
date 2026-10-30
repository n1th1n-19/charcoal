export default function Progress({ label, name, pct, className = "" }: { label?: string; name?: string; pct: number; className?: string }) {
  return (
    <div role="status" aria-label={`${label ?? name}, ${pct} percent`} className={`text-label text-soft flex shrink-0 items-center gap-3 ${className}`}>
      {label && <span data-mono className="shrink-0">{label}</span>}
      <span className="bg-smudge/30 h-1 min-w-0 flex-1 overflow-hidden rounded-full">
        <span className="burn-bar block h-full origin-left" style={{ transform: `scaleX(${pct / 100})` }} />
      </span>
      <span className="text-char w-10 shrink-0 text-right font-bold tabular-nums">{pct}%</span>
    </div>
  );
}
