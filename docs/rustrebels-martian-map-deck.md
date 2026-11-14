# Rust Rebels: Martian Map pitch deck (extracted)

Source: `RustRebels_MartianMap.pdf` (8 slides, 16:9). Extracted 2026-11-14 for the website copy.
Event: NASA Space Apps Challenge 2026 · Seoul. Challenge: Interplanetary Survival Guide: Martian Map.

## 1. Title

**Rust Rebels**
*Science-rich Marswalks. Fewer wrong turns.*

Interplanetary Survival Guide: Martian Map — a scout-first, radiation-aware digital twin for human EVAs.

Site: Jezero Crater · 18.4°N 77.5°E

| Member | Role |
| --- | --- |
| Li Jar | Engineer · KAIST OverEdge |
| Dr. Amar | Researcher · radiation, nuclear & X-ray physics · KAIST |

## 2. The Martian surface: a radiation field with an old map

*Orbital maps are months old. Radiation, dust and terrain change by the hour.*

| Figure | Meaning | Source |
| --- | --- | --- |
| 0.67 mSv/day | GCR dose equivalent on the surface (Gale crater) | Curiosity RAD, 2012–13 |
| ~100× | Earth's natural background (~2.4 mSv/yr) | No global magnetic field |
| ~20 g/cm² | CO₂ shielding overhead (Earth: ~1,030 g/cm²) | ~6–9 mbar surface pressure |
| 10% | of surface dose equivalent is secondary neutrons, 8–740 MeV | RAD neutron spectrum |

What can go wrong on a Marswalk:

- **Solar particle events** — dose rate jumps several-fold within hours
- **Radio blackout** — SEP ionisation absorbs orbiter relay links
- **Dust** — dust devils; planet-encircling storm in 2018
- **Terrain drift** — new boulders, rockfalls, migrating ripples
- **Soft ground** — loose sand traps; Spirit stuck in 2009

## 3. System architecture: scout first, then walk

*SuperJar scouts the route; the digital twin fuses its data with NASA orbital maps; the astronaut sees the result.*

| Phase | Component | Details |
| --- | --- | --- |
| Phase 1 · Scout (T–24 h) | SuperJar scout | Drone / rover · 8-sensor payload. Flies the planned route at T–24 h and again at T–1 h. |
| Phase 1 · Scout (T–24 h) | Edge AI (on board) | YOLO hazard detection · Lidar point-cloud diff · Dose-rate voxel mapping · Sends deltas, not raw video. |
| Always on | Digital twin (habitat) | Base: HiRISE DTM · CTX · MOLA · CRISM. Live: dose, dust τ, new hazards. Route & shelter solver. |
| Phase 2 · Walk (T–0) | Astronaut HUD | First-person AR display · Minimap + nearest shelter · Vitals & consumables. |

Links: on-board bus → UHF mesh + X-ray backup → UHF mesh ≤1 km LOS.

- **Closed loop: detect → update twin → re-plan.** Every new rock or dose hot-spot SuperJar finds re-scores the route before the astronaut leaves.
- **Orbiter relay (MRO, MAVEN) ↔ Earth.** NASA DONKI solar-event alerts trigger the storm protocol.

## 4. SuperJar sensor payload

*Eight instruments, each with flight heritage or a commercial equivalent.*

| Instrument | Spec | What it does |
| --- | --- | --- |
| Timepix3 pixel detector | 55 µm · 1.56 ns | Energy, time & track per particle → LET spectrum; separates p⁺, HZE ions, neutrons |
| CdZnTe spectrometer | ~1.5% FWHM @ 662 keV | Room-temp γ/X-ray spectrum; coded-aperture γ camera for hot-spot direction |
| Lidar | ±2 cm · 360° | 3D point cloud diffed against HiRISE DTM (1 m) → new rocks, slope change |
| GPR · RIMFAX heritage | 150–1200 MHz · ~10 m | Voids, loose regolith and buried ice under the route |
| Thermal IR camera | 8–14 µm LWIR | Thermal inertia separates soft sand from bedrock; day/night ΔT |
| Weather · MEDA heritage | p · T · wind · τ dust | Dust-devil and storm-onset warnings along the route |
| Stereo camera + YOLO | ~30 fps edge inference | Detects new boulders, ripples and hazards; flags change vs base map |
| Compute | COTS AI SoC + rad-hard | ECC + watchdog resets; rad-hard fallback. Ingenuity: Snapdragon 801, 72 flights |

## 5. SuperJar first-person view: scouting the route

*What the scout sees and reports, hours before the astronaut steps out.*

Mock HUD: `SUPERJAR · SCOUT · SOL 214 · 10:42 LMST · ALT 12 m` · Dose rate 9.2 µGy/h · LET: GCR nominal · no SEP · `NEW BOULDER 0.94 · Δh +0.8 m`.

1. **Lidar mesh** — live point cloud draped on terrain; slopes > 25° flagged
2. **YOLO change detection** — object not in HiRISE DTM → new-hazard layer
3. **3D dose heat map** — Timepix voxels: green < 10, amber 10–20, red > 20 µGy/h
4. **Agent chat** — ask SuperJar in plain language; answers come from twin data

Example reply: "Route B clear to WP3. New boulder at 212 m (not in HiRISE DTM). Nearest shelter: crater wall, 140 m NE."

## 6. Astronaut helmet display: one glance, every number

*First-person AR built on the twin SuperJar just updated.*

- Heading tape: NW · 330 · N · 030 · NE. Waypoint: WP3 · 420 m · ETA 9 min.
- Radiation: 9.2 µGy/h now · 38 µGy this EVA · LET spectrum (keV/µm, Timepix).
- Hazard callout: NEW ROCK · 18 m. Minimap with shelter: 140 m NE.
- Vitals: HR 92 bpm · BP 124/80 mmHg · RESP 16/min · SpO₂ 98%.
- Consumables: O₂ 74% · 5 h 12 m; H₂O 2.1 L · shield + drink; Suit 29.6 kPa · batt 81%.

## 7. Solar storm protocol: detect, warn, reroute, shield

*The one moment that decides a Marswalk, handled in under ten minutes.*

| Step | When | What happens |
| --- | --- | --- |
| Detect | T+0 | DONKI / orbiter alert + Timepix proton-rate jump |
| Warn | T+30 s | HUD turns red; dose rate and time-to-shelter shown |
| Reroute | T+1 min | Minimum-dose path to crater wall, overhang or rover |
| Shelter | T ≤ 10 min | Hold until rate < 2× baseline; X-ray link if radio drops |

**Water vest: torso + hips**

- Covers active marrow: pelvis, spine, ribs, sternum
- 3 cm H₂O ≈ 3 g/cm² → stops SEP protons < ~55 MeV
- ~15 kg (≈ 6 kg in Mars gravity); also drinking and cooling water
- GCR (GeV) still passes → limit by EVA time

**Backup link: X-ray communication** (experimental · radio stays primary)

- Heritage: NASA XCOM demo on ISS (NICER / MXS), 2019
- 1 km of surface CO₂ ≈ 1.7 g/cm² → est. ~55% (30 keV) to ~75% (60 keV) transmission
- Line-of-sight, ≤ 1 km: SuperJar ↔ astronaut ↔ rover
- Immune to SEP ionospheric absorption of radio

## 8. Live demo in the browser, built on real NASA data

*One crater, three views, one solar storm — anyone can try it at our project link.*

Views:

1. **Third-person** — SuperJar scouts the Jezero delta
2. **SuperJar view** — lidar, YOLO, dose heat map, chat
3. **Astronaut HUD** — walk the scouted route
4. **Storm event** — HUD red → reroute to shelter

Stack: Three.js / CesiumJS · HiRISE DTM → glTF mesh · LLM agent for SuperJar · Scripted SEP event · Runs in any browser.

| Dataset | Mission | Layer in our twin |
| --- | --- | --- |
| HiRISE DTM + ortho | MRO | 1 m terrain mesh, change baseline |
| CTX mosaic | MRO | 6 m context imagery |
| MOLA | MGS | Regional elevation, slope, shelter search |
| CRISM | MRO | Mineral maps → science stops |
| RAD | Curiosity | Dose baseline and SEP profile |
| MEDA | Perseverance | Wind, pressure, dust τ |
| RIMFAX | Perseverance | Subsurface layer under the route |
| DONKI | NASA CCMC | Space-weather storm trigger |
