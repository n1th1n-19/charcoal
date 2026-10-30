import { useCallback, useEffect, useRef, useState } from "react";
import type { Settings } from "@/lib/worker";

// Settings with undo and redo. A slider commits when released, so one drag is one undo step.
export function useHistory(initial: Settings) {
  const committed = useRef(initial);
  const [settings, setSettings] = useState(initial);
  const [past, setPast] = useState<Settings[]>([]);
  const [future, setFuture] = useState<Settings[]>([]);

  const apply = (patch: Partial<Settings>) => setSettings((s) => ({ ...s, ...patch }));

  const commit = useCallback((next: Settings) => {
    if (JSON.stringify(next) === JSON.stringify(committed.current)) return;
    const before = committed.current;
    setPast((p) => [...p, before]);
    setFuture([]);
    committed.current = next;
  }, []);

  const restore = useCallback((next: Settings) => {
    committed.current = next;
    setSettings(next);
  }, []);

  const reset = useCallback((next: Settings) => {
    setPast([]);
    setFuture([]);
    restore(next);
  }, [restore]);

  const undo = useCallback(() => {
    if (!past.length) return;
    const current = committed.current;
    setFuture((f) => [current, ...f]);
    restore(past[past.length - 1]);
    setPast((p) => p.slice(0, -1));
  }, [past, restore]);

  const redo = useCallback(() => {
    if (!future.length) return;
    const current = committed.current;
    setPast((p) => [...p, current]);
    restore(future[0]);
    setFuture((f) => f.slice(1));
  }, [future, restore]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "z") return;
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  return { settings, setSettings, apply, commit, reset, undo, redo, canUndo: past.length > 0, canRedo: future.length > 0 };
}
