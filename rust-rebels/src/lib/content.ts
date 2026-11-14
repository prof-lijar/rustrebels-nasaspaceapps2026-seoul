// Homepage copy, extracted from docs/rustrebels-martian-map-deck.md.

export const stats = [
  { value: "0.67", unit: "mSv/day", label: "GCR dose equivalent on the surface (Gale crater)", source: "Curiosity RAD, 2012–13" },
  { value: "~100×", unit: "", label: "Earth's natural background (~2.4 mSv/yr)", source: "No global magnetic field" },
  { value: "~20", unit: "g/cm²", label: "CO₂ shielding overhead (Earth: ~1,030 g/cm²)", source: "~6–9 mbar surface pressure" },
  { value: "10%", unit: "", label: "of surface dose equivalent is secondary neutrons, 8–740 MeV", source: "RAD neutron spectrum" },
];

export const hazards = [
  { name: "Solar particle events", body: "Dose rate jumps several-fold within hours." },
  { name: "Radio blackout", body: "SEP ionisation absorbs orbiter relay links." },
  { name: "Dust", body: "Dust devils; a planet-encircling storm in 2018." },
  { name: "Terrain drift", body: "New boulders, rockfalls, migrating ripples." },
  { name: "Soft ground", body: "Loose sand traps. Spirit stuck in 2009." },
];

export const pipeline = [
  { phase: "Phase 1 · Scout (T–24 h)", name: "SuperJar scout", body: "Drone / rover with an 8-sensor payload. Flies the planned route at T–24 h and again at T–1 h." },
  { phase: "Phase 1 · Scout (T–24 h)", name: "Edge AI on board", body: "YOLO hazard detection, lidar point-cloud diff, dose-rate voxel mapping. Sends deltas, not raw video." },
  { phase: "Always on", name: "Digital twin (habitat)", body: "Base: HiRISE DTM, CTX, MOLA, CRISM. Live: dose, dust τ, new hazards. Route and shelter solver." },
  { phase: "Phase 2 · Walk (T–0)", name: "Astronaut HUD", body: "First-person AR display with minimap, nearest shelter, vitals and consumables." },
];

export const payload = [
  { name: "Timepix3 pixel detector", spec: "55 µm · 1.56 ns", body: "Energy, time and track per particle → LET spectrum; separates protons, HZE ions, neutrons." },
  { name: "CdZnTe spectrometer", spec: "~1.5% FWHM @ 662 keV", body: "Room-temperature γ/X-ray spectrum; coded-aperture γ camera for hot-spot direction." },
  { name: "Lidar", spec: "±2 cm · 360°", body: "3D point cloud diffed against the 1 m HiRISE DTM → new rocks, slope change." },
  { name: "GPR · RIMFAX heritage", spec: "150–1200 MHz · ~10 m", body: "Voids, loose regolith and buried ice under the route." },
  { name: "Thermal IR camera", spec: "8–14 µm LWIR", body: "Thermal inertia separates soft sand from bedrock; day/night ΔT." },
  { name: "Weather · MEDA heritage", spec: "p · T · wind · τ dust", body: "Dust-devil and storm-onset warnings along the route." },
  { name: "Stereo camera + YOLO", spec: "~30 fps edge inference", body: "Detects new boulders, ripples and hazards; flags change against the base map." },
  { name: "Compute", spec: "COTS AI SoC + rad-hard", body: "ECC and watchdog resets with a rad-hard fallback. Ingenuity flew a Snapdragon 801 for 72 flights." },
];

export const stormSteps = [
  { time: "T+0", name: "Detect", body: "DONKI / orbiter alert plus a Timepix proton-rate jump." },
  { time: "T+30 s", name: "Warn", body: "HUD turns red; dose rate and time-to-shelter shown." },
  { time: "T+1 min", name: "Reroute", body: "Minimum-dose path to crater wall, overhang or rover." },
  { time: "T ≤ 10 min", name: "Shelter", body: "Hold until rate < 2× baseline; X-ray link if radio drops." },
];

export const waterVest = [
  "Covers active marrow: pelvis, spine, ribs, sternum.",
  "3 cm of water ≈ 3 g/cm², stopping SEP protons below ~55 MeV.",
  "~15 kg on Earth, ≈ 6 kg in Mars gravity. Doubles as drinking and cooling water.",
  "GCR at GeV energies still passes, so EVA time stays the limit.",
];

export const xrayLink = [
  "Heritage: NASA XCOM demo on the ISS (NICER / MXS), 2019.",
  "1 km of surface CO₂ ≈ 1.7 g/cm² → est. ~55% (30 keV) to ~75% (60 keV) transmission.",
  "Line-of-sight, ≤ 1 km: SuperJar ↔ astronaut ↔ rover.",
  "Immune to the SEP ionospheric absorption that silences radio.",
];

export const demoViews = [
  { n: "1", name: "Third-person", body: "SuperJar scouts the Jezero delta." },
  { n: "2", name: "SuperJar view", body: "Lidar, YOLO, dose heat map, chat." },
  { n: "3", name: "Astronaut HUD", body: "Walk the scouted route." },
  { n: "4", name: "Storm event", body: "HUD goes red → reroute to shelter." },
];

export const stack = ["Three.js / CesiumJS", "HiRISE DTM → glTF mesh", "LLM agent for SuperJar", "Scripted SEP event", "Runs in any browser"];

export const datasets = [
  { name: "HiRISE DTM + ortho", mission: "MRO", layer: "1 m terrain mesh, change baseline" },
  { name: "CTX mosaic", mission: "MRO", layer: "6 m context imagery" },
  { name: "MOLA", mission: "MGS", layer: "Regional elevation, slope, shelter search" },
  { name: "CRISM", mission: "MRO", layer: "Mineral maps → science stops" },
  { name: "RAD", mission: "Curiosity", layer: "Dose baseline and SEP profile" },
  { name: "MEDA", mission: "Perseverance", layer: "Wind, pressure, dust τ" },
  { name: "RIMFAX", mission: "Perseverance", layer: "Subsurface layer under the route" },
  { name: "DONKI", mission: "NASA CCMC", layer: "Space-weather storm trigger" },
];

export const crew = [
  { name: "Li Jar", role: "Engineer · KAIST OverEdge" },
  { name: "Dr. Amar", role: "Researcher · radiation, nuclear & X-ray physics · KAIST" },
];

export const links = {
  teamPage: "https://www.spaceappschallenge.org/2026/find-a-team/arc-playground/",
  github: "https://github.com/prof-lijar/rustrebels-nasaspaceapps2026-seoul",
  challenge: "https://www.spaceappschallenge.org/2026/challenges/interplanetary-survival-guide-martian-map/",
};

/** Screens captured from the Marswalk app for the tour under the home page hero. */
export const appTour = [
  {
    src: "/images/marswalk/01-start.jpg",
    alt: "Marswalk start screen: the title, the suit picker, and an astronaut in a white and orange suit walking on Mars.",
    title: "Suit up",
    brief: "Pick a suit, from NASA's own EMU and ACES models to game-art designs, and step out at a Perseverance waypoint in Jezero crater.",
  },
  {
    src: "/images/marswalk/02-walk.jpg",
    alt: "Third-person view of the astronaut walking across Jezero, with panels for SuperJar, the minimap, suit vitals and radiation.",
    title: "Walk real terrain",
    brief: "The ground is NASA's HiRISE map of Jezero. You walk at 3.4 km/h, the pace measured for Mars gravity, while the panels track your suit and the radiation dose.",
  },
  {
    src: "/images/marswalk/03-map.jpg",
    alt: "Expanded map of the delta front showing the route to the science stop and four flagged hazards.",
    title: "Plan on the map",
    brief: "SuperJar flags boulders, soft sand and rockfall the base map lacks, and the route bends around them and any slope over 25°. Click a point to send SuperJar or the rover there.",
  },
  {
    src: "/images/marswalk/04-rover.jpg",
    alt: "Chase view of the Perseverance rover under remote control, with the astronaut standing ahead marked YOU.",
    title: "Drive the rover",
    brief: "The rover follows you, comes when called and recharges your suit. Take remote control and its wheels steer and its suspension rides the ground.",
  },
  {
    src: "/images/marswalk/05-superjar.jpg",
    alt: "Chase view of the SuperJar helicopter drone flying low over the sand under remote control.",
    title: "Fly SuperJar",
    brief: "Order the scout drone in plain words, or take the stick yourself: it flies where you look, banks into turns and reports what it finds.",
  },
  {
    src: "/images/marswalk/06-storm.jpg",
    alt: "A red Solar Particle Event alert over the view as the astronaut runs toward the rover for shelter.",
    title: "Survive the storm",
    brief: "A solar storm replayed from Curiosity's September 2017 radiation record cuts the walk short. The rover drives to meet you while a red route leads you to shelter.",
  },
];
