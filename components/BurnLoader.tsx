import { LOADER_ART } from "@/lib/loaderArt";

export default function BurnLoader() {
  return (
    <div className="burn" role="status" aria-label="Loading Charcoal">
      <div className="burn-art" aria-hidden="true">
        <div className="burn-wood">{LOADER_ART}</div>
        <div className="burn-ink">{LOADER_ART}</div>
      </div>
    </div>
  );
}
