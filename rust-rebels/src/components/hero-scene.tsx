"use client";

import { useEffect, useRef, useState } from "react";
import type { MarsEngine } from "@/features/game/engine";
import "@/features/game/cover-tag.css";

export function HeroScene() {
  const stage = useRef<HTMLDivElement>(null);
  const markers = useRef<HTMLDivElement>(null);
  const engine = useRef<MarsEngine | null>(null);
  const [ready, setReady] = useState(false);
  const [paused, setPaused] = useState(false);
  const [failed, setFailed] = useState(false);
  const updatePlayback = useRef<() => void>(() => {});
  const pauseRequested = useRef<boolean | null>(null);

  useEffect(() => {
    const container = stage.current;
    const markerLayer = markers.current;
    if (!container || !markerLayer) return;
    let cancelled = false;
    let visible = false;
    let loading = false;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      const motionPaused = pauseRequested.current ?? reducedMotion.matches;
      setPaused(motionPaused);
      engine.current?.setAnimationPaused(!visible || document.hidden || motionPaused);
    };
    updatePlayback.current = update;

    const start = async () => {
      if (loading || cancelled) return;
      loading = true;
      try {
        const { MarsEngine } = await import("@/features/game/engine");
        if (cancelled) return;
        const scene = new MarsEngine(container, markerLayer, document.createElement("canvas"), () => {}, () => {}, { showcaseOnly: true });
        engine.current = scene;
        update();
        await scene.init();
        if (!cancelled) { setReady(true); update(); }
      } catch {
        if (!cancelled) { engine.current?.dispose(); engine.current = null; setFailed(true); }
      }
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) void start();
      update();
    });
    observer.observe(container);
    document.addEventListener("visibilitychange", update);
    reducedMotion.addEventListener("change", update);
    return () => {
      cancelled = true;
      observer.disconnect();
      document.removeEventListener("visibilitychange", update);
      reducedMotion.removeEventListener("change", update);
      engine.current?.dispose();
      engine.current = null;
    };
  }, []);

  return (
    <>
      <div className={`hero-scene${ready ? " is-ready" : ""}${paused ? " is-paused" : ""}`} aria-hidden="true">
        <div className="hero-scene-stage" ref={stage} />
        <div className="hero-scene-labels" ref={markers} />
      </div>
      {ready && !failed && <button className="hero-motion" type="button" aria-pressed={paused} onClick={() => {
        pauseRequested.current = !paused;
        setPaused(!paused);
        updatePlayback.current();
      }}>{paused ? "Resume scene" : "Pause scene"}</button>}
    </>
  );
}
