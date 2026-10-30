"use client";

import { useEffect, useRef, useState } from "react";
import Seam from "@/components/Seam";
import Easel from "@/components/stations/Easel";
import Fixative from "@/components/stations/Fixative";
import KilnStation from "@/components/stations/KilnStation";
import Specimen from "@/components/stations/Specimen";
import Notices from "@/components/ui/Notices";
import ProjectLinks from "@/components/ui/ProjectLinks";
import Smudge from "@/components/ui/Smudge";
import StationRail from "@/components/ui/StationRail";
import { Bitmaps, useArtCanvases } from "@/hooks/useArtCanvases";
import { useEngine } from "@/hooks/useEngine";
import { useHistory } from "@/hooks/useHistory";
import { useStations } from "@/hooks/useStations";
import { useStoryReveal } from "@/hooks/useStoryReveal";
import { DEFAULTS, LOADER_MIN_MS } from "@/lib/config";
import type { Output } from "@/lib/exports";
import { reducedMotion } from "@/lib/motion";
import type { Settings } from "@/lib/worker";

export default function App() {
  const bitmaps = useRef<Bitmaps | null>(null);
  const [output, setOutput] = useState<Output | null>(null);

  const history = useHistory(DEFAULTS);
  const canvases = useArtCanvases(output, bitmaps);
  const { scroller, needle, active, goTo } = useStations(canvases.clipToSeam);
  useStoryReveal(scroller, active);
  const engine = useEngine({ settings: history.settings, setSettings: history.setSettings, reset: history.reset, goTo, bitmaps, setOutput });
  const { settings } = history;

  // Held briefly so the loader reads as a moment instead of a flash.
  useEffect(() => {
    const ready = setTimeout(() => (document.documentElement.dataset.ready = ""), reducedMotion() ? 0 : LOADER_MIN_MS);
    return () => clearTimeout(ready);
  }, []);

  const update = (patch: Partial<Settings>) => {
    if (patch.removeBg) engine.burn();
    history.apply(patch);
  };
  const change = (patch: Partial<Settings>) => {
    update(patch);
    history.commit({ ...settings, ...patch });
  };

  return (
    <div
      className="flex h-dvh flex-col"
      onDragStart={(e) => e.preventDefault()}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file) engine.take(file, file.name);
      }}
    >
      <Smudge />
      <Notices error={engine.error} tooLarge={engine.tooLarge} onReduce={engine.takeReduced} onCancel={() => engine.setTooLarge(null)} />
      <main ref={scroller} className="sheet flex min-h-0 flex-1 overflow-x-auto overflow-y-hidden">
        <Specimen source={engine.source} take={engine.take} trySample={engine.trySample} />
        <KilnStation temp={engine.temp} lit={engine.lit} download={engine.download} progress={engine.progress} removeBg={settings.removeBg} />
        <Easel
          source={engine.source}
          art={engine.art}
          settings={settings}
          progress={engine.progress}
          monoCanvas={canvases.mono}
          colorCanvas={canvases.color}
          update={update}
          commit={history.commit}
          change={change}
          undo={history.undo}
          redo={history.redo}
          canUndo={history.canUndo}
          canRedo={history.canRedo}
          ready={!!output}
          onDone={() => goTo(3)}
        />
        <Fixative output={output} source={engine.source} settings={settings} showing={active === 3} previewCanvas={canvases.finalArt} previewBox={canvases.finalBox} />
      </main>
      <ProjectLinks />
      <StationRail needle={needle} active={active} goTo={goTo} />
      <Seam />
    </div>
  );
}
