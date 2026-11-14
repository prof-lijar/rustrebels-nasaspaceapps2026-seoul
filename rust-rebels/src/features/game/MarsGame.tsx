"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { MarsEngine, type DroneMode, type HudState, type RoverMode, type ViewMode } from "./engine";
import "./game.css";

const VIEWS: { id: ViewMode; key: string; label: string }[] = [
  { id: "fpv", key: "1", label: "First person" },
  { id: "tpv", key: "2", label: "Third person" },
  { id: "map", key: "3", label: "Mission map" },
];

const DRONE_STATUS: Record<DroneMode, string> = { route: "ESCORT", recall: "WITH YOU", goto: "EN ROUTE", hold: "ON STATION" };
const ROVER_STATUS: Record<RoverMode, string> = { follow: "FOLLOWING", hold: "PARKED", goto: "DRIVING", rescue: "COMING TO YOU" };
const QUICK: { label: string; say: string }[] = [
  { label: "Come back", say: "come back" },
  { label: "Scout ahead", say: "scout ahead" },
  { label: "Check shelter", say: "check the nearest shelter" },
  { label: "Status", say: "status" },
];

const CARDINALS: Record<number, string> = { 0: "N", 45: "NE", 90: "E", 135: "SE", 180: "S", 225: "SW", 270: "W", 315: "NW" };

function clock(min: number): string {
  const h = Math.floor(min / 60), m = Math.floor(min % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function Compass({ heading, bearing }: { heading: number; bearing: number }) {
  const ticks = [];
  for (let d = -90; d <= 90; d += 15) {
    const deg = (Math.round(heading / 15) * 15 + d + 360) % 360;
    const off = ((deg - heading + 540) % 360) - 180;
    ticks.push(
      <span key={d} className={`mg-tick ${CARDINALS[deg] ? "mg-tick-major" : ""}`} style={{ left: `${50 + off * 0.52}%` }}>
        {CARDINALS[deg] ?? String(deg).padStart(3, "0")}
      </span>,
    );
  }
  const rel = ((bearing - heading + 540) % 360) - 180;
  const clamped = Math.max(-92, Math.min(92, rel));
  return (
    <div className="mg-compass" aria-label={`Heading ${Math.round(heading)} degrees`}>
      {ticks}
      <span className="mg-compass-needle" />
      <span className="mg-compass-target" style={{ left: `${50 + clamped * 0.52}%` }} />
    </div>
  );
}

function Spark({ data, baseline }: { data: number[]; baseline: number }) {
  if (data.length < 2) return <svg className="mg-spark" viewBox="0 0 180 44" />;
  const max = Math.max(baseline * 2.4, ...data);
  const pts = data.map((v, i) => `${(i / 89) * 180},${44 - (v / max) * 42}`).join(" ");
  const by = 44 - (baseline / max) * 42;
  return (
    <svg className="mg-spark" viewBox="0 0 180 44" role="img" aria-label="Dose rate, last 45 seconds">
      <line x1="0" x2="180" y1={by} y2={by} className="mg-spark-base" />
      <polyline points={pts} className="mg-spark-line" />
    </svg>
  );
}

function Bar({ label, value, unit, sim = true }: { label: string; value: number; unit: string; sim?: boolean }) {
  return (
    <div className="mg-bar">
      <span>{label}{sim && <i className="mg-sim">SIM</i>}</span>
      <div className="mg-bar-track"><div style={{ width: `${Math.max(0, Math.min(100, value))}%` }} className={value < 25 ? "mg-bar-low" : ""} /></div>
      <b>{Math.round(value)}{unit}</b>
    </div>
  );
}

export function MarsGame() {
  const stage = useRef<HTMLDivElement>(null);
  const markers = useRef<HTMLDivElement>(null);
  const minimap = useRef<HTMLCanvasElement>(null);
  const engine = useRef<MarsEngine | null>(null);
  const [hud, setHud] = useState<HudState | null>(null);
  const [status, setStatus] = useState("Starting");
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [started, setStarted] = useState(false);
  const [info, setInfo] = useState(false);
  const [draft, setDraft] = useState("");
  const [mapWho, setMapWho] = useState<"superjar" | "rover">("superjar");
  const chat = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!stage.current || !markers.current || !minimap.current) return;
    const eng = new MarsEngine(stage.current, markers.current, minimap.current, setHud, setStatus);
    engine.current = eng;
    if (process.env.NODE_ENV !== "production") (window as unknown as { __mars?: MarsEngine }).__mars = eng;
    eng.init().then(() => setReady(true)).catch((e: unknown) => setError(e instanceof Error ? e.message : "The scene failed to load."));
    return () => { eng.dispose(); engine.current = null; };
  }, []);

  // Enter or C opens the chat box; the engine ignores keys while typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!started || e.target instanceof HTMLInputElement) return;
      if (e.code === "Enter" || e.code === "KeyC") {
        e.preventDefault();
        if (document.pointerLockElement) document.exitPointerLock();
        chat.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [started]);

  const send = (text: string) => {
    engine.current?.command(text);
    setDraft("");
  };

  const begin = (auto: boolean) => {
    setStarted(true);
    engine.current?.startAudio();
    engine.current?.setAutopilot(auto);
    if (!auto) engine.current?.requestLock();
  };

  const storm = hud?.phase === "storm";
  const ratio = hud ? hud.doseRate / hud.baseline : 1;

  return (
    <div className={`mg-root ${hud ? `mg-band-${hud.band}` : ""} ${storm ? "mg-storm" : ""} ${hud?.view === "fpv" ? "mg-fpv" : ""}`}>
      <div ref={stage} className="mg-stage" />
      <div ref={markers} className="mg-markers" />
      <div className="mg-visor" aria-hidden="true" />

      <div className={`mg-hud ${started && hud ? "" : "mg-hidden"}`}>
        <div className="mg-top">
          <Compass heading={hud?.heading ?? 0} bearing={hud?.objectiveBearing ?? 0} />
          <div className="mg-objective">
            <span>{storm || hud?.phase === "sheltered" ? "SHELTER" : "OBJECTIVE"}</span>
            <b>{hud?.objective}</b>
            <em>{Math.round(hud?.objectiveDist ?? 0)} m{hud?.etaShelterS != null && ` · ${Math.ceil(hud.etaShelterS)} s at a run`}</em>
          </div>
        </div>

        {storm && (
          <div className="mg-alert" role="alert">
            <b>SOLAR PARTICLE EVENT</b>
            <span>Dose rate {ratio.toFixed(1)}× baseline · get to shelter</span>
            <small>{hud?.stormSource} · RAD replay, Sep 2017</small>
          </div>
        )}

        <section className="mg-panel mg-left">
          <header><b>SUPERJAR</b><span>{hud?.phase === "scout" ? "SCOUTING" : DRONE_STATUS[hud?.droneMode ?? "route"]} · {Math.round(hud?.droneDist ?? 0)} m · {hud?.hazardsFound}/{hud?.hazardsTotal} changes<i className="mg-sim">SIM</i></span></header>
          <p className="mg-advice">{hud?.advice}</p>
          <ul className="mg-log">
            {hud?.log.map((l) => <li key={`${l.t}-${l.text}`} className={l.who ? "mg-log-you" : `mg-log-${l.tone}`}>{l.who && <b>YOU › </b>}{l.text}</li>)}
          </ul>
          <div className="mg-rover">
            <span><b>ROVER</b> {ROVER_STATUS[hud?.roverMode ?? "follow"]} · {Math.round(hud?.roverDist ?? 0)} m{hud?.docked && " · PLUGGED IN"}<i className="mg-sim">SIM</i></span>
            <div role="group" aria-label="Rover orders">
              <button type="button" className={hud?.roverMode === "follow" ? "mg-on" : ""} onClick={() => engine.current?.orderRover("follow")}>Follow</button>
              <button type="button" className={hud?.roverMode === "hold" ? "mg-on" : ""} onClick={() => engine.current?.orderRover("hold")}>Park</button>
              <button type="button" onClick={() => engine.current?.orderRover("come")}>Come here</button>
            </div>
          </div>
          <div className="mg-quick" role="group" aria-label="Quick orders for SuperJar">
            {QUICK.map((q) => <button key={q.label} type="button" onClick={() => send(q.say)}>{q.label}</button>)}
          </div>
          <form className="mg-chat" onSubmit={(e) => { e.preventDefault(); send(draft); }}>
            <input
              ref={chat}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Escape") e.currentTarget.blur(); }}
              placeholder="Talk to SuperJar (Enter)"
              aria-label="Message to SuperJar"
              maxLength={120}
              autoComplete="off"
            />
            <button type="submit" disabled={!draft.trim()}>Send</button>
          </form>
        </section>

        <section className={`mg-panel mg-map ${hud?.mapExpanded ? "mg-map-wide" : ""}`}>
          {hud?.mapExpanded && (
            <header>
              <b className="mg-map-who" role="group" aria-label="Who to send">
                SEND
                <button type="button" className={mapWho === "superjar" ? "mg-on" : ""} aria-pressed={mapWho === "superjar"} onClick={() => setMapWho("superjar")}>SuperJar</button>
                <button type="button" className={mapWho === "rover" ? "mg-on" : ""} aria-pressed={mapWho === "rover"} onClick={() => setMapWho("rover")}>Rover</button>
              </b>
              <span>Click a point · north up<button type="button" className="mg-map-close" onClick={() => engine.current?.setMapExpanded(false)}>Close <kbd>G</kbd></button></span>
            </header>
          )}
          <canvas
            ref={minimap}
            width={hud?.mapExpanded ? 620 : 220}
            height={hud?.mapExpanded ? 620 : 220}
            role="button"
            tabIndex={0}
            aria-label={hud?.mapExpanded ? `Map. Click a point to send ${mapWho === "rover" ? "the rover" : "SuperJar"} there.` : "Minimap. Click to expand."}
            onClick={(e) => {
              if (!hud?.mapExpanded) return engine.current?.setMapExpanded(true);
              const r = e.currentTarget.getBoundingClientRect();
              engine.current?.mapClick((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height, mapWho);
            }}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") engine.current?.setMapExpanded(!hud?.mapExpanded); }}
          />
          {!hud?.mapExpanded && <p className="mg-map-hint">Click or <kbd>G</kbd> to expand</p>}
          <dl>
            <div><dt>LAT</dt><dd>{hud?.lat.toFixed(4)}°N</dd></div>
            <div><dt>LON</dt><dd>{hud?.lon.toFixed(4)}°E</dd></div>
            <div><dt>ELEV</dt><dd>{Math.round(hud?.elevation ?? 0)} m</dd></div>
            <div><dt>SLOPE</dt><dd>{(hud?.slope ?? 0).toFixed(0)}°</dd></div>
          </dl>
        </section>

        <section className="mg-panel mg-vitals">
          <header><b>SUIT</b><span>EVA {clock(hud?.missionMin ?? 0)} · clock ×60</span></header>
          <div className="mg-vital-row">
            <div><span>HR<i className="mg-sim">SIM</i></span><b>{Math.round(hud?.hr ?? 0)}</b><em>bpm</em></div>
            <div><span>SpO₂<i className="mg-sim">SIM</i></span><b>{hud?.spo2}</b><em>%</em></div>
            <div><span>SUIT<i className="mg-sim">SIM</i></span><b>{hud?.suitKpa}</b><em>kPa</em></div>
          </div>
          <Bar label="O₂" value={hud?.o2 ?? 0} unit="%" />
          <Bar label="BATT" value={hud?.battery ?? 0} unit="%" />
        </section>

        <section className="mg-panel mg-rad">
          <header><b>RADIATION</b><span>Curiosity RAD replay</span></header>
          <div className="mg-rad-main">
            <b>{(hud?.doseRate ?? 0).toFixed(1)}</b>
            <span>µGy/h<br /><em>{ratio.toFixed(2)}× baseline</em></span>
          </div>
          <Spark data={hud?.doseHistory ?? []} baseline={hud?.baseline ?? 11} />
          <dl>
            <div><dt>THIS EVA</dt><dd>{(hud?.evaDose ?? 0).toFixed(1)} µGy</dd></div>
            <div><dt>PEAK</dt><dd>{(hud?.peakRate ?? 0).toFixed(1)} µGy/h</dd></div>
            <div><dt>SKY</dt><dd>{Math.round((hud?.sky ?? 1) * 100)}%</dd></div>
          </dl>
        </section>

        <div className="mg-bottom">
          <div className="mg-views" role="group" aria-label="Camera view">
            {VIEWS.map((v) => (
              <button key={v.id} type="button" className={hud?.view === v.id ? "mg-on" : ""} onClick={() => engine.current?.setView(v.id)}>
                <kbd>{v.key}</kbd>{v.label}
              </button>
            ))}
            <button type="button" className={hud?.autopilot ? "mg-on" : ""} onClick={() => engine.current?.setAutopilot(!hud?.autopilot)}><kbd>P</kbd>Auto-walk</button>
            <button type="button" onClick={() => engine.current?.triggerStorm()}><kbd>T</kbd>Storm</button>
            <button type="button" className={hud?.sound ? "mg-on" : ""} aria-pressed={hud?.sound ?? true} onClick={() => engine.current?.setSound(!hud?.sound)}><kbd>N</kbd>Sound {hud?.sound ? "on" : "off"}</button>
            <button type="button" onClick={() => engine.current?.resetMission()}><kbd>R</kbd>Restart</button>
            <button type="button" onClick={() => setInfo(true)}>Data</button>
          </div>
          {!hud?.locked && !hud?.autopilot && hud?.view !== "map" && <p className="mg-hint">Click the scene to look around · WASD move · Shift run · Space jump · V switch view</p>}
        </div>

        {hud?.canDock && hud.phase !== "scout" && (
          <p className="mg-prompt"><kbd>E</kbd> {hud.docked ? "Unplug from the rover" : "Plug into the rover: oxygen and battery"}</p>
        )}
        {hud?.view === "fpv" && <span className="mg-cross" aria-hidden="true" />}
      </div>

      {hud?.phase === "sheltered" && started && (
        <div className="mg-debrief">
          <b>{hud.docked ? "SHELTERING AT THE ROVER" : "IN SHELTER"}</b>
          <p>EVA dose {hud.evaDose.toFixed(1)} µGy · peak {hud.peakRate.toFixed(1)} µGy/h · now {ratio.toFixed(2)}× baseline</p>
          <button type="button" onClick={() => engine.current?.resetMission()}>Run it again</button>
        </div>
      )}

      {!started && (
        <div className="mg-start">
          <p className="mg-eyebrow">Rust Rebels · NASA Space Apps 2026 · Seoul</p>
          <div className="mg-title">MARS<span>WALK</span></div>
          <p className="mg-lede">Jezero crater, delta front. SuperJar scouts the route. You walk it. Then the Sun interrupts.</p>
          {error ? (
            <p className="mg-error" role="alert">{error} Reload the page to try again.</p>
          ) : ready ? (
            <div className="mg-start-actions">
              <button type="button" className="mg-primary" onClick={() => begin(false)}>Start the EVA</button>
              <button type="button" onClick={() => begin(true)}>Watch the auto-walk</button>
            </div>
          ) : (
            <p className="mg-loading">{status}…</p>
          )}
          <ul className="mg-keys">
            <li><kbd>W A S D</kbd> move</li><li><kbd>Mouse</kbd> look</li><li><kbd>Shift</kbd> run</li><li><kbd>Space</kbd> jump</li>
            <li><kbd>V</kbd> first / third person</li><li><kbd>M</kbd> mission map</li><li><kbd>P</kbd> auto-walk</li><li><kbd>T</kbd> solar storm</li><li><kbd>N</kbd> sound on / off</li><li><kbd>Enter</kbd> talk to SuperJar</li><li><kbd>G</kbd> map: send SuperJar</li><li><kbd>B</kbd> call SuperJar back</li><li><kbd>F</kbd> rover follow / park</li><li><kbd>E</kbd> plug into the rover</li>
          </ul>
          <Link href="/" className="mg-back">← Back to the pitch</Link>
        </div>
      )}

      {info && (
        <div className="mg-info" role="dialog" aria-label="Data and credits">
          <div>
            <b>What is real, what is simulated</b>
            <dl>
              <dt>Real NASA data</dt>
              <dd>Terrain and imagery: HiRISE mosaic of Jezero, 4 m mesh, 2 m image (NASA/JPL-Caltech/University of Arizona/USGS). Base and science stop: Perseverance waypoints (NASA/JPL-Caltech). Dose rate: Curiosity RAD, 7–14 Sep 2017 (NASA/JPL-Caltech/SwRI). Storm alert: NASA DONKI. Rover and helicopter models: NASA/JPL-Caltech. Astronaut: NASA&apos;s Z2 planetary-surface prototype suit, from NASA 3D Resources. Sound: Perseverance microphone recordings of Martian wind (sol 4), the Ingenuity helicopter in flight, the SuperCam laser (sol 12), played when SuperJar flags a hazard, and Perseverance driving (sol 16), played when the rover moves (NASA/JPL-Caltech/LANL/CNES/CNRS/ISAE-Supaero).</dd>
              <dt>Derived by us</dt>
              <dd>Slope, route, sky fraction and shelter spots, all computed from the HiRISE elevation. Dose rate shown is RAD × sky fraction. That is a geometric estimate, not a dose calculation.</dd>
              <dt>Simulated</dt>
              <dd>New boulders, sand and rockfall; SuperJar&apos;s detections and its flight speed on orders; the rover driving itself, following you and recharging your suit, and its speed (about 100 times the real rover&apos;s); vitals, oxygen and battery; walking speed; small scattered stones and ground grain; the storm alarm tone. The mission clock runs 60× real time and the storm replays 600× faster than it happened.</dd>
              <dt>Know this</dt>
              <dd>The rover is shown as the storm shelter because the pitch says so; the game applies no dose reduction there, since we have no figure for it. SuperJar&apos;s chat is rule-based: it reads answers from the mission state and has no language model behind it. RAD measured Gale crater, not Jezero. Ground colour is a tint over a greyscale image. The drone is drawn about twice life size. The suit model has no joints, so the walking motion comes from a simple skeleton we added (thighs, shins, arms); it is our animation, not NASA motion data. Recordings are made louder than the originals and the helicopter gets quieter with distance.</dd>
            </dl>
            <button type="button" onClick={() => setInfo(false)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
