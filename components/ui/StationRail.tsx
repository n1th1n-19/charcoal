import type { RefObject } from "react";
import { STATIONS } from "@/lib/config";

type Props = { needle: RefObject<HTMLSpanElement | null>; active: number; goTo: (index: number) => void };

export default function StationRail({ needle, active, goTo }: Props) {
  return (
    <nav aria-label="Stations" className="ruler bg-sheet relative z-5 grid shrink-0 grid-cols-4 pb-[env(safe-area-inset-bottom)]">
      <span ref={needle} aria-hidden="true" className="bg-sanguine absolute top-0 h-4 w-0.5" />
      {STATIONS.map((name, i) => (
        <button
          key={name}
          type="button"
          onClick={() => goTo(i)}
          aria-current={i === active ? "location" : undefined}
          className={`text-label min-h-12 pt-3 ${i === active ? "font-bold" : "text-soft hover:text-char"}`}
        >
          <span data-mono>{name}</span>
        </button>
      ))}
    </nav>
  );
}
