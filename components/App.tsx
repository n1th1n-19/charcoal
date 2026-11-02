"use client";

import { useEffect, useRef, useState } from "react";
import Seam from "@/components/Seam";
import Easel from "@/components/stations/Easel";
import Fixative from "@/components/stations/Fixative";
import KilnStation from "@/components/stations/KilnStation";
import Maquette from "@/components/stations/Maquette";
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
import { DEFAULTS, LOADER_MIN_MS, stagesFor, stationsFor } from "@/lib/config";
import type { Loop } from "@/lib/exports3d";
import type { Output } from "@/lib/exports";
import { reducedMotion } from "@/lib/motion";
import type { Route, Settings } from "@/lib/worker";

export default function App() {
  const bitmaps = useRef<Bitmaps | null>(null);
  const [output, setOutput] = useState<Output | null>(null);
  const [loop, setLoop] = useState<Loop | null>(null);
  const [route, setRoute] = useState<Route>("2d");

  const history = useHistory(DEFAULTS);
  const canvases = useArtCanvases(output, bitmaps, route);
  const { scroller, needle, active, goTo } = useStations(canvases.clipToSeam);
  useStoryReveal(scroller, active);
  const engine = useEngine({ settings: history.settings, setSettings: history.setSettings, reset: history.reset, goTo, bitmaps, setOutput, route, setLoop });
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
  // Switching with an image already loaded takes it back through the kiln to the other station.
  const chooseRoute = (next: Route) => {
    if (next === route) return;
    setRoute(next);
    if (engine.source) engine.burn();
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
        <Specimen source={engine.source} take={engine.take} trySample={engine.trySample} route={route} onRoute={chooseRoute} />
        <KilnStation temp={engine.temp} lit={engine.lit} download={engine.download} progress={engine.progress} removeBg={settings.removeBg} stages={stagesFor(route)} />
        {route === "3d" ? (
          <Maquette
            source={engine.source}
            loop={loop}
            settings={settings}
            progress={engine.progress}
            update={update}
            commit={history.commit}
            change={change}
            undo={history.undo}
            redo={history.redo}
            canUndo={history.canUndo}
            canRedo={history.canRedo}
            onDone={() => goTo(3)}
          />
        ) : (
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
        )}
        <Fixative output={output} source={engine.source} settings={settings} showing={active === 3} previewCanvas={canvases.finalArt} previewBox={canvases.finalBox} route={route} loop={loop} />
      </main>
      <ProjectLinks />
      <StationRail names={stationsFor(route)} needle={needle} active={active} goTo={goTo} />
      <Seam />
    </div>
  );
}
