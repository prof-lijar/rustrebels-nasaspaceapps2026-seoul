// Marswalk game engine: three.js scene, controls and the mission simulation.
// Real data: terrain, rover waypoints, RAD dose series, DONKI storm record, NASA models.
// Simulated: new hazards, vitals, consumables, scout detections, walking speed.

import * as THREE from "three";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { CELL, GRID, MAX_SLOPE_DEG, SITE_M, World, pathLength, pointAlong, progressAlong, solveRoute, type Blocker, type TerrainMeta, type Vec2 } from "./world";

const DATA = "/dataset";
const HALF = SITE_M / 2;

// Mission, in dataset coordinates (x east, y north). Both are real Perseverance waypoints.
const BASE = { x: -1322, y: 564, label: "Rover base · sol 439 waypoint" };
const GOAL = { x: -1809, y: 1050, label: "Science stop · delta scarp" };

const MARS_G = 3.72;
const EYE = 1.7;
const WALK = 3.2, SPRINT = 6.5; // m/s, game pace
const CLOCK_RATE = 60; // mission seconds per real second
const STORM_REPLAY = 600; // RAD seconds per real second during the storm
const STORM_AT_PROGRESS = 0.3;
const SCOUT_SPEED = 80;
const SENSOR_RANGE = 70;
const DRONE_MANUAL_SPEED = 14; // m/s when flown by hand
const ROVER_SPEED = 4.5; // m/s. The real rover's top speed is about 0.04 m/s; this is game pace.
const ROVER_RESCUE_SPEED = 7.5;
const ROVER_FOLLOW_GAP = 11; // metres the rover keeps behind the astronaut
const DOCK_RANGE = 6.5;
const ROVER_MODEL_YAW = Math.PI; // the NASA model's front (arm, mast) faces +Z; turn it to face the drive direction
const DRONE_SPEED = 30; // m/s on orders
const MAP_RANGE_WIDE = 650; // metres from centre to edge of the expanded map

export type ViewMode = "fpv" | "tpv" | "map";
export type Band = "green" | "amber" | "red";
/** Small ground relief, about 1.4 m across and up to 4.5 cm high or deep. Simulated. */
function bump(x: number, z: number): number {
  const s = 1.4, xi = Math.floor(x / s), zi = Math.floor(z / s);
  const hash = (i: number, j: number) => { const v = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return v - Math.floor(v); };
  let fx = x / s - xi, fz = z / s - zi;
  fx = fx * fx * (3 - 2 * fx);
  fz = fz * fz * (3 - 2 * fz);
  const top = hash(xi, zi) + (hash(xi + 1, zi) - hash(xi, zi)) * fx;
  const bot = hash(xi, zi + 1) + (hash(xi + 1, zi + 1) - hash(xi, zi + 1)) * fx;
  return (top + (bot - top) * fz - 0.5) * 0.09;
}

export type Crew = "superjar" | "rover";
export type RoverMode = "follow" | "hold" | "goto" | "rescue" | "manual";
export type DroneMode = "route" | "recall" | "goto" | "hold" | "manual";
/** Who the keys and the camera belong to. */
export type Control = "astronaut" | Crew;
export type Phase = "scout" | "walk" | "storm" | "sheltered" | "arrived";

export type HudState = {
  view: ViewMode;
  phase: Phase;
  heading: number;
  objective: string;
  objectiveDist: number;
  objectiveBearing: number;
  missionMin: number;
  doseRate: number;
  baseline: number;
  band: Band;
  evaDose: number;
  peakRate: number;
  doseHistory: number[];
  etaShelterS: number | null;
  hr: number;
  spo2: number;
  o2: number;
  battery: number;
  suitKpa: number;
  speed: number;
  slope: number;
  sky: number;
  elevation: number;
  lon: number;
  lat: number;
  /** who: the speaker (SuperJar when absent). to: who an astronaut message was addressed to. */
  log: { t: number; text: string; tone: "info" | "warn" | "alert"; who?: "you" | "rover"; to?: Crew }[];
  droneMode: DroneMode;
  roverMode: RoverMode;
  roverDist: number;
  roverMoving: boolean;
  canDock: boolean;
  docked: boolean;
  droneDist: number;
  mapExpanded: boolean;
  hazardsFound: number;
  hazardsTotal: number;
  uncertainty: number;
  advice: string;
  autopilot: boolean;
  sound: boolean;
  /** The rover's driving sound, switched on its own tab. The master switch still mutes it. */
  roverSound: boolean;
  control: Control;
  /** While flying SuperJar by hand: height over the ground (m), speed (m/s) and climb rate (m/s). */
  flightAlt: number;
  flightSpeed: number;
  flightClimb: number;
  locked: boolean;
  stormSource: string;
  routeLeft: number;
};

type Hazard = { id: number; kind: "boulder" | "sand" | "rockfall"; label: string; x: number; z: number; r: number; found: boolean; mesh: THREE.Object3D; marker?: HTMLDivElement };
type RadPoint = { t: number; e: number };
type Shelter = { id: string; x: number; z: number; sky: number; label: string };
type Marker = { el: HTMLDivElement; pos: THREE.Vector3; text: string; cls: string; show: () => boolean };

function mulberry(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => rej(new Error(`Could not load ${src}`));
    img.src = src;
  });
}

async function getJson<T>(path: string): Promise<T> {
  const r = await fetch(`${DATA}/${path}`);
  if (!r.ok) throw new Error(`Could not load ${path} (${r.status})`);
  return r.json() as Promise<T>;
}

export class MarsEngine {
  private renderer!: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(72, 1, 0.1, 9000);
  private world!: World;
  private meta!: TerrainMeta;
  private ortho!: HTMLImageElement;
  private raf = 0;
  private last = 0;
  private disposed = false;
  private cleanup: (() => void)[] = [];

  // player
  private pos = new THREE.Vector3();
  private vy = 0;
  private grounded = true;
  private yaw = 0;
  private pitch = 0;
  private keys = new Set<string>();
  private speed = 0;
  private walkPhase = 0;
  private astronaut = new THREE.Group();
  private limbs: THREE.Object3D[] = [];
  private suit?: THREE.Object3D; // NASA Z2 suit model; replaces the placeholder figure once loaded
  private rig?: { thighL: THREE.Bone; thighR: THREE.Bone; shinL: THREE.Bone; shinR: THREE.Bone; armL: THREE.Bone; armR: THREE.Bone };
  private view: ViewMode = "fpv";
  private mapZoom = 520;
  private autopilot = false;
  private locked = false;

  // mission
  private phase: Phase = "scout";
  private realT = 0;
  private route: Vec2[] = [];
  private routeMesh?: THREE.InstancedMesh;
  private routeLine?: THREE.Line;
  private hazards: Hazard[] = [];
  private shelters: Shelter[] = [];
  private shelter?: Shelter;
  private base!: Vec2;
  private goal!: Vec2;
  private drone = new THREE.Group();
  private rotors: THREE.Object3D[] = [];
  private droneDist = 0;
  private droneMode: DroneMode = "route";
  private droneTarget: Vec2 = { x: 0, z: 0 };
  private droneArrived = false;
  private mapExpanded = false;

  // rover: support vehicle and mobile shelter
  private rover = new THREE.Group();
  private roverPos: Vec2 = { x: 0, z: 0 };
  private roverYaw = 0.8;
  private roverMode: RoverMode = "follow";
  private roverGoal: Vec2 = { x: 0, z: 0 };
  private roverPath: Vec2[] = [];
  private roverPathAt = -10;
  private roverPathFor: Vec2 = { x: 1e9, z: 1e9 };
  private roverMoving = false;
  private roverArrived = true;
  private roverV = 0; // forward speed, m/s
  private roverW = 0; // turn rate, rad/s, positive to the right
  private roverPivoting = false; // turning on the spot, as the real rover does
  private roverPose: { y: number; pitch: number; roll: number } | null = null;
  private wheelRadius = 0.22;
  /** Six wheels cut out of the model at load time. x/z are in the rover's frame (front is -z). */
  private wheels: { pivot: THREE.Group; spin: THREE.Group; x: number; z: number; steers: boolean; steer: number }[] = [];
  /** Left and right suspension halves, each rocking about its own pivot. */
  private rockers: { group: THREE.Group; side: number; z: number }[] = [];
  private docked = false;
  private roverSound?: HTMLAudioElement;
  private stormRouteAt = 0;
  private rad: RadPoint[] = [];
  private baseline = 11.15;
  private onsetIdx = 0;
  private stormT = 0;
  private stormStartReal = 0;
  private doseRate = 11;
  private evaDose = 0;
  private peakRate = 0;
  private doseHistory: number[] = [];
  private histAcc = 0;
  private hr = 78;
  private o2 = 100;
  private battery = 100;
  private log: HudState["log"] = [];
  private stormSource = "";
  private markers: Marker[] = [];
  private beacon!: THREE.Mesh;
  private sky?: THREE.Mesh;
  private hudAcc = 0;
  private initialRouteLen = 1;

  // sound: NASA Perseverance microphone recordings, plus one synthesised alarm tone
  private wind?: HTMLAudioElement;
  private droneHum?: HTMLAudioElement;
  private laser?: HTMLAudioElement;
  private laserStop = 0;
  private audioCtx?: AudioContext;
  private soundOn = true;
  private roverSoundOn = true;
  // remote control: the astronaut stands still and drives the rover or flies SuperJar
  private control: Control = "astronaut";
  private rcYaw = 0;
  private rcPitch = -0.1;
  private droneAlt = 8; // metres above ground while flown by hand
  private droneVel = new THREE.Vector3();
  private droneTilt = 0; // nose down, radians
  private droneBank = 0;
  private droneYawPrev = 0;
  private rcWarnAt = -10;

  constructor(
    private container: HTMLElement,
    private markerLayer: HTMLDivElement,
    private minimap: HTMLCanvasElement,
    private onHud: (s: HudState) => void,
    private onProgress: (msg: string) => void,
  ) {}

  // --- setup ----------------------------------------------------------------

  async init(): Promise<void> {
    this.onProgress("Loading HiRISE terrain");
    const [meta, heightBuf, ortho, skyImg, rad, donki, shelters] = await Promise.all([
      getJson<TerrainMeta>("terrain/terrain.json"),
      fetch(`${DATA}/terrain/height_1024.u16`).then((r) => {
        if (!r.ok) throw new Error("Could not load the heightmap");
        return r.arrayBuffer();
      }),
      loadImage(`${DATA}/terrain/ortho_2048.jpg`),
      loadImage(`${DATA}/terrain/skyview_1024.png`),
      getJson<{ summary: { baseline_before_event: { e: number }; event_onset_reference_utc: string }; series: { t: string; e: number }[] }>("radiation/rad_sep_2017-09.json"),
      getJson<{ events: { type: string; t: string; id: string; detail: string }[] }>("space-weather/donki_2017-09.json"),
      getJson<{ shelters: { id: string; x: number; y: number; sky_fraction: number }[] }>("shelters/shelters.json"),
    ]);
    if (this.disposed) return;
    this.meta = meta;
    this.ortho = ortho;

    const cv = document.createElement("canvas");
    cv.width = cv.height = GRID;
    const cx = cv.getContext("2d", { willReadFrequently: true })!;
    cx.drawImage(skyImg, 0, 0);
    const px = cx.getImageData(0, 0, GRID, GRID).data;
    const sky = new Uint8Array(GRID * GRID);
    for (let i = 0; i < sky.length; i++) sky[i] = px[i * 4];
    this.world = new World(new Uint16Array(heightBuf), sky, meta);

    this.baseline = rad.summary.baseline_before_event.e;
    const onset = Date.parse(rad.summary.event_onset_reference_utc);
    this.rad = rad.series.filter((p) => p.e > 0).map((p) => ({ t: Date.parse(p.t) / 1000, e: p.e }));
    // A few RAD records are a different, shorter observation mode that reads low; drop the outliers.
    this.rad = this.rad.filter((p, i, a) => i === 0 || i === a.length - 1 || p.e > 0.6 * Math.min(a[i - 1].e, a[i + 1].e));
    this.onsetIdx = Math.max(1, this.rad.findIndex((p) => p.t * 1000 >= onset));
    const sep = donki.events.find((e) => e.type === "SEP" && e.t.startsWith("2017-09-10"));
    this.stormSource = sep ? `DONKI ${sep.id} · ${sep.detail}` : "DONKI SEP record, 10 Sep 2017";

    this.base = { x: BASE.x, z: -BASE.y };
    this.goal = { x: GOAL.x, z: -GOAL.y };
    this.shelters = [
      { id: "ROVER", x: this.base.x, z: this.base.z, sky: this.world.skyAt(this.base.x, this.base.z), label: "Rover base" },
      ...shelters.shelters.map((s) => ({ id: s.id, x: s.x, z: -s.y, sky: s.sky_fraction, label: `Terrain shelter ${s.id}` })),
    ];

    this.onProgress("Building the Martian surface");
    this.setupRenderer();
    this.buildSky();
    this.buildTerrain();
    this.buildAstronaut();
    this.buildBeacon();
    this.scatterRocks();
    await this.loadModels();
    if (this.disposed) return;

    this.onProgress("SuperJar is solving the route");
    this.resetMission();
    this.bindInput();
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  private setupRenderer(): void {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.container.appendChild(this.renderer.domElement);
    const resize = () => {
      const w = this.container.clientWidth, h = this.container.clientHeight;
      this.renderer.setSize(w, h);
      this.camera.aspect = w / Math.max(1, h);
      this.camera.updateProjectionMatrix();
    };
    resize();
    window.addEventListener("resize", resize);
    this.cleanup.push(() => window.removeEventListener("resize", resize));

    this.scene.fog = new THREE.FogExp2(0xc79a72, 0.00042);
    this.scene.add(new THREE.HemisphereLight(0xf2d2ae, 0x6b4630, 1.15));
    const sun = new THREE.DirectionalLight(0xfff0dc, 2.3);
    sun.position.set(-0.45, 0.62, 0.55);
    this.scene.add(sun);
  }

  private buildSky(): void {
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: { top: { value: new THREE.Color(0x8d7a66) }, horizon: { value: new THREE.Color(0xd9ae84) }, sun: { value: new THREE.Vector3(-0.45, 0.62, 0.55).normalize() } },
      vertexShader: "varying vec3 d; void main(){ d = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
      fragmentShader: `varying vec3 d; uniform vec3 top; uniform vec3 horizon; uniform vec3 sun;
        void main(){ float h = clamp(d.y,0.0,1.0); vec3 c = mix(horizon, top, pow(h,0.55));
          float s = max(dot(normalize(d), sun),0.0); c += vec3(0.75,0.82,1.0)*pow(s,900.0)*2.0 + vec3(0.35,0.42,0.55)*pow(s,14.0)*0.35;
          gl_FragColor = vec4(c,1.0); }`,
    });
    const dome = new THREE.Mesh(new THREE.SphereGeometry(7000, 32, 16), mat);
    dome.renderOrder = -1;
    dome.frustumCulled = false;
    this.sky = dome;
    this.scene.add(dome);
    this.cleanup.push(() => { dome.geometry.dispose(); mat.dispose(); });
  }

  private buildTerrain(): void {
    const n = GRID;
    const posArr = new Float32Array(n * n * 3);
    const uv = new Float32Array(n * n * 2);
    const h = this.world.heights;
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const i = r * n + c;
        posArr[i * 3] = (c + 0.5) * CELL - HALF;
        posArr[i * 3 + 1] = h[i];
        posArr[i * 3 + 2] = (r + 0.5) * CELL - HALF;
        uv[i * 2] = (c + 0.5) / n;
        uv[i * 2 + 1] = 1 - (r + 0.5) / n;
      }
    }
    const idx = new Uint32Array((n - 1) * (n - 1) * 6);
    let k = 0;
    for (let r = 0; r < n - 1; r++) {
      for (let c = 0; c < n - 1; c++) {
        const a = r * n + c, b = a + 1, d = a + n, e = d + 1;
        idx[k++] = a; idx[k++] = d; idx[k++] = b;
        idx[k++] = b; idx[k++] = d; idx[k++] = e;
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(posArr, 3));
    geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    geo.computeVertexNormals();

    const map = new THREE.Texture(this.ortho);
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    map.needsUpdate = true;

    // Procedural grain so the ground holds up at walking distance. Decoration, not data.
    const dc = document.createElement("canvas");
    dc.width = dc.height = 256;
    const dctx = dc.getContext("2d")!;
    const img = dctx.createImageData(256, 256);
    const rnd = mulberry(7);
    for (let i = 0; i < 256 * 256; i++) {
      const v = 150 + rnd() * 105;
      img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
      img.data[i * 4 + 3] = 255;
    }
    dctx.putImageData(img, 0, 0);
    const detail = new THREE.CanvasTexture(dc);
    detail.wrapS = detail.wrapT = THREE.RepeatWrapping;

    const mat = new THREE.MeshLambertMaterial({ map, color: new THREE.Color(1.9, 1.08, 0.66) });
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.detailMap = { value: detail };
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", "#include <common>\nuniform sampler2D detailMap;")
        .replace(
          "#include <map_fragment>",
          `#include <map_fragment>
           float dNear = texture2D(detailMap, vMapUv * 1400.0).r;
           float dFar = texture2D(detailMap, vMapUv * 170.0).r;
           diffuseColor.rgb *= mix(0.55, 1.3, dNear * 0.55 + dFar * 0.45);`,
        );
    };
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    this.scene.add(mesh);
    this.cleanup.push(() => { geo.dispose(); mat.dispose(); map.dispose(); detail.dispose(); });
  }

  private buildAstronaut(): void {
    const suit = new THREE.MeshStandardMaterial({ color: 0xf1ece2, roughness: 0.75 });
    const rust = new THREE.MeshStandardMaterial({ color: 0xf0703a, roughness: 0.6 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x2a2622, roughness: 0.8 });
    const visor = new THREE.MeshStandardMaterial({ color: 0xd9a441, metalness: 0.9, roughness: 0.18 });
    const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = this.astronaut) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      parent.add(m);
      return m;
    };
    add(new THREE.CapsuleGeometry(0.27, 0.42, 6, 14), suit, 0, 1.15, 0);
    add(new THREE.BoxGeometry(0.5, 0.62, 0.26), suit, 0, 1.22, 0.27); // life-support pack
    add(new THREE.BoxGeometry(0.52, 0.08, 0.28), rust, 0, 1.5, 0.27);
    add(new THREE.SphereGeometry(0.24, 20, 16), suit, 0, 1.72, 0);
    add(new THREE.SphereGeometry(0.19, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.62), visor, 0, 1.73, -0.1).rotation.x = -Math.PI / 2;
    add(new THREE.TorusGeometry(0.2, 0.035, 8, 20), rust, 0, 1.52, 0).rotation.x = Math.PI / 2;
    const limb = (x: number, y: number, len: number, rad: number, tip: THREE.Material) => {
      const pivot = new THREE.Group();
      pivot.position.set(x, y, 0);
      add(new THREE.CapsuleGeometry(rad, len, 4, 10), suit, 0, -len / 2 - rad * 0.4, 0, pivot);
      add(new THREE.SphereGeometry(rad * 1.15, 10, 8), tip, 0, -len - rad * 1.2, 0, pivot);
      this.astronaut.add(pivot);
      this.limbs.push(pivot);
    };
    limb(-0.16, 0.86, 0.5, 0.115, dark); // legs
    limb(0.16, 0.86, 0.5, 0.115, dark);
    limb(-0.38, 1.42, 0.42, 0.09, rust); // arms
    limb(0.38, 1.42, 0.42, 0.09, rust);
    this.scene.add(this.astronaut);
  }

  private buildBeacon(): void {
    const geo = new THREE.CylinderGeometry(1.6, 1.6, 260, 20, 1, true);
    geo.translate(0, 130, 0);
    const mat = new THREE.MeshBasicMaterial({ color: 0x35e0c2, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
    this.beacon = new THREE.Mesh(geo, mat);
    this.scene.add(this.beacon);
  }

  /** Small scattered stones near the mission area. Decoration only. */
  private scatterRocks(): void {
    const rnd = mulberry(2026);
    const count = 7000;
    const geo = new THREE.DodecahedronGeometry(1, 0);
    const mat = new THREE.MeshLambertMaterial({ color: 0x8a5a3c, flatShading: true });
    const inst = new THREE.InstancedMesh(geo, mat, count);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    const cx = (BASE.x + GOAL.x) / 2, cz = -(BASE.y + GOAL.y) / 2;
    for (let i = 0; i < count; i++) {
      const x = cx + (rnd() - 0.5) * 1100, z = cz + (rnd() - 0.5) * 1100;
      const size = 0.1 + Math.pow(rnd(), 3) * 0.8;
      p.set(x, this.world.heightAt(x, z) + size * 0.25, z);
      q.setFromEuler(new THREE.Euler(rnd() * 3, rnd() * 3, rnd() * 3));
      s.set(size * (0.7 + rnd() * 0.6), size * (0.5 + rnd() * 0.4), size * (0.7 + rnd() * 0.6));
      inst.setMatrixAt(i, m.compose(p, q, s));
    }
    this.scene.add(inst);
    this.cleanup.push(() => { geo.dispose(); mat.dispose(); });
  }

  private async loadModels(): Promise<void> {
    const loader = new GLTFLoader();
    const draco = new DRACOLoader().setDecoderPath("/draco/");
    loader.setDRACOLoader(draco);
    this.cleanup.push(() => draco.dispose());
    const fit = (obj: THREE.Object3D, size: number) => {
      const box = new THREE.Box3().setFromObject(obj);
      const dim = box.getSize(new THREE.Vector3());
      const k = size / Math.max(dim.x, dim.y, dim.z);
      obj.scale.setScalar(k);
      const b2 = new THREE.Box3().setFromObject(obj);
      const c = b2.getCenter(new THREE.Vector3());
      obj.position.set(-c.x, -b2.min.y, -c.z);
      const wrap = new THREE.Group();
      wrap.add(obj);
      return wrap;
    };
    const [rover, heli, suit] = await Promise.allSettled([
      loader.loadAsync(`${DATA}/models/perseverance.glb`),
      loader.loadAsync(`${DATA}/models/ingenuity.glb`),
      loader.loadAsync(`${DATA}/models/z2_spacesuit.glb`),
    ]);
    if (suit.status === "fulfilled") {
      const posed = fit(suit.value.scene, 1.95);
      posed.rotation.y = Math.PI; // the model faces +Z; the player faces -Z
      this.suit = this.rigSuit(posed) ?? posed;
      this.astronaut.clear();
      this.limbs = [];
      this.astronaut.add(this.suit);
    }
    if (rover.status === "fulfilled") {
      const r = fit(rover.value.scene, 3.4);
      r.rotation.y = ROVER_MODEL_YAW;
      this.rover.add(r);
      this.rigRover();
    } else {
      this.rover.add(new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.4, 3), new THREE.MeshStandardMaterial({ color: 0xd8d2c6 })));
    }
    this.scene.add(this.rover);
    if (heli.status === "fulfilled") {
      // Only the two rotor assemblies turn. The legs' meshes carry "ROTOR_STOWED" in their names in
      // NASA's file, so match the node names exactly.
      heli.value.scene.traverse((o) => { if (/^rotors_\d+$/.test(o.name)) this.rotors.push(o); });
      // A faint disc over each rotor stands in for blades too fast to see one by one.
      const blur = new THREE.CircleGeometry(0.6, 40).rotateY(Math.PI / 2); // the rotor axis is the node's X
      const blurMat = new THREE.MeshBasicMaterial({ color: 0x1a1a1a, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false });
      for (const r of this.rotors) r.add(new THREE.Mesh(blur, blurMat));
      this.cleanup.push(() => { blur.dispose(); blurMat.dispose(); });
      this.drone.add(fit(heli.value.scene, 2.6)); // drawn about twice life size so it reads at distance
    } else {
      this.drone.add(new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 0.6), new THREE.MeshStandardMaterial({ color: 0xdddddd })));
    }
    const glow = new THREE.PointLight(0x35e0c2, 30, 40);
    glow.position.y = 0.5;
    this.drone.add(glow);
    this.scene.add(this.drone);
  }

  /**
   * NASA ships the Z2 suit as one unjointed mesh. To make it walk we add our own skeleton:
   * six bones (thighs, shins, arms) and per-vertex weights chosen from where each vertex sits.
   * Measured on the model at 1.95 m tall, facing -Z: legs are separate below 0.7 m, the hips
   * end near 0.8 m, and the arms are the parts outside the torso or reaching forward of it.
   */
  private rigSuit(posed: THREE.Object3D): THREE.Object3D | null {
    let source: THREE.Mesh | undefined;
    posed.updateMatrixWorld(true);
    posed.traverse((o) => { if ((o as THREE.Mesh).isMesh && !source) source = o as THREE.Mesh; });
    if (!source) return null;
    const geo = source.geometry.clone().applyMatrix4(source.matrixWorld);
    const pos = geo.attributes.position;
    const n = pos.count;
    const skinIndex = new Uint16Array(n * 4);
    const skinWeight = new Float32Array(n * 4);
    const step = (v: number, a: number, b: number) => { const k = Math.min(1, Math.max(0, (v - a) / (b - a))); return k * k * (3 - 2 * k); };
    const BODY = 0, THIGH_L = 1, SHIN_L = 2, THIGH_R = 3, SHIN_R = 4, ARM_L = 5, ARM_R = 6;
    for (let i = 0; i < n; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), ax = Math.abs(x);
      const leg = 1 - step(y, 0.68, 0.84);
      const shin = leg * (1 - step(y, 0.36, 0.48));
      const thigh = leg - shin;
      const beside = step(ax, 0.25, 0.31) * step(y, 0.9, 0.98) * (1 - step(y, 1.5, 1.58)) * (1 - step(z, 0.1, 0.18));
      const ahead = step(-z, 0.16, 0.24) * step(ax, 0.12, 0.18) * step(y, 0.88, 0.94) * (1 - step(y, 1.36, 1.44));
      const arm = Math.max(beside, ahead) * (1 - leg);
      const left = x < 0;
      const o = i * 4;
      skinIndex[o] = BODY; skinWeight[o] = Math.max(0, 1 - leg - arm);
      skinIndex[o + 1] = left ? THIGH_L : THIGH_R; skinWeight[o + 1] = thigh;
      skinIndex[o + 2] = left ? SHIN_L : SHIN_R; skinWeight[o + 2] = shin;
      skinIndex[o + 3] = left ? ARM_L : ARM_R; skinWeight[o + 3] = arm;
    }
    geo.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(skinIndex, 4));
    geo.setAttribute("skinWeight", new THREE.Float32BufferAttribute(skinWeight, 4));

    const bone = (x: number, y: number, z: number, parent?: THREE.Bone) => {
      const b = new THREE.Bone();
      b.position.set(x, y, z);
      parent?.add(b);
      return b;
    };
    const body = bone(0, 0, 0);
    const thighL = bone(-0.16, 0.8, 0.07, body), shinL = bone(-0.03, -0.38, 0, thighL);
    const thighR = bone(0.16, 0.8, 0.07, body), shinR = bone(0.03, -0.38, 0, thighR);
    const armL = bone(-0.3, 1.42, 0.05, body), armR = bone(0.3, 1.42, 0.05, body);
    const mesh = new THREE.SkinnedMesh(geo, source.material);
    mesh.add(body);
    mesh.bind(new THREE.Skeleton([body, thighL, shinL, thighR, shinR, armL, armR]));
    mesh.frustumCulled = false;
    this.rig = { thighL, thighR, shinL, shinR, armL, armR };
    const wrap = new THREE.Group();
    wrap.add(mesh);
    return wrap;
  }

  // --- mission --------------------------------------------------------------

  resetMission(): void {
    for (const hz of this.hazards) {
      this.scene.remove(hz.mesh);
      hz.marker?.remove();
    }
    for (const mk of this.markers) mk.el.remove();
    this.markers = [];
    this.hazards = [];
    this.phase = "scout";
    this.realT = 0;
    this.stormT = 0;
    this.evaDose = 0;
    this.peakRate = 0;
    this.doseHistory = [];
    this.o2 = 100;
    this.battery = 100;
    this.hr = 78;
    this.log = [];
    this.shelter = undefined;
    this.droneDist = 0;
    this.droneMode = "route";
    this.droneArrived = false;
    this.roverPos = { x: this.base.x + 9, z: this.base.z - 6 };
    this.roverYaw = 0.8;
    this.roverMode = "follow";
    this.roverPath = [];
    this.roverPathAt = -10;
    this.roverArrived = true;
    this.roverV = 0;
    this.roverW = 0;
    this.roverPivoting = false;
    this.roverPose = null;
    this.control = "astronaut";
    this.droneVel.set(0, 0, 0);
    this.docked = false;
    this.pos.set(this.base.x, this.world.heightAt(this.base.x, this.base.z), this.base.z);
    this.drone.position.set(this.base.x, this.pos.y + 3, this.base.z); // SuperJar launches from the rover base
    this.vy = 0;
    this.yaw = Math.atan2(this.goal.x - this.base.x, -(this.goal.z - this.base.z));
    this.pitch = -0.05;

    this.route = solveRoute(this.world, this.base, this.goal, []) ?? [this.base, this.goal];
    this.initialRouteLen = pathLength(this.route);
    this.placeHazards();
    this.drawRoute();
    this.beacon.position.set(this.goal.x, this.world.heightAt(this.goal.x, this.goal.z), this.goal.z);
    (this.beacon.material as THREE.MeshBasicMaterial).color.set(0x35e0c2);

    this.addMarker(() => new THREE.Vector3(this.goal.x, this.world.heightAt(this.goal.x, this.goal.z) + 4, this.goal.z), "SCIENCE STOP", "mg-mk-goal", () => this.phase !== "storm" && this.phase !== "sheltered");
    this.addMarker(() => this.drone.position.clone().setY(this.drone.position.y + 2.2), "SUPERJAR", "mg-mk-drone", () => this.view !== "map" && this.control !== "superjar");
    this.addMarker(() => new THREE.Vector3(this.pos.x, this.pos.y + 2.5, this.pos.z), "YOU", "mg-mk-goal", () => this.control !== "astronaut" && this.view !== "map");
    this.addMarker(() => new THREE.Vector3(this.roverPos.x, this.world.heightAt(this.roverPos.x, this.roverPos.z) + 3.4, this.roverPos.z), "ROVER", "mg-mk-rover", () => this.view !== "map" && this.control !== "rover" && Math.hypot(this.roverPos.x - this.pos.x, this.roverPos.z - this.pos.z) > 9);
    this.addMarker(() => new THREE.Vector3(this.droneTarget.x, this.world.heightAt(this.droneTarget.x, this.droneTarget.z) + 3, this.droneTarget.z), "SUPERJAR TARGET", "mg-mk-drone", () => this.droneMode === "goto"); // only while it is still on its way

    this.say("SuperJar launching. Scouting the route before you step out.", "info");
    this.say(`Base map: HiRISE, ${Math.round(this.initialRouteLen)} m to the science stop.`, "info");
  }

  /** Invented obstacles the base map does not know about. Seeded, so every run is the same. */
  private placeHazards(): void {
    const rnd = mulberry(439);
    const spec: { at: number; kind: Hazard["kind"]; label: string; r: number; side: number }[] = [
      { at: 0.22, kind: "boulder", label: "NEW BOULDER", r: 5, side: 0 },
      { at: 0.4, kind: "sand", label: "SOFT SAND", r: 16, side: 3 },
      { at: 0.62, kind: "rockfall", label: "ROCKFALL", r: 11, side: -2 },
      { at: 0.8, kind: "boulder", label: "NEW BOULDER", r: 4, side: 1 },
    ];
    const rockMat = new THREE.MeshLambertMaterial({ color: 0x70452e, flatShading: true });
    const sandMat = new THREE.MeshLambertMaterial({ color: 0xd6a06a, transparent: true, opacity: 0.85 });
    spec.forEach((s, id) => {
      const p = pointAlong(this.route, this.initialRouteLen * s.at);
      const x = p.x + s.side, z = p.z + s.side;
      const y = this.world.heightAt(x, z);
      const group = new THREE.Group();
      if (s.kind === "sand") {
        const disc = new THREE.Mesh(new THREE.CircleGeometry(s.r, 40), sandMat);
        disc.rotation.x = -Math.PI / 2;
        disc.position.y = 0.12;
        group.add(disc);
      } else {
        const n = s.kind === "rockfall" ? 9 : 1;
        for (let i = 0; i < n; i++) {
          const size = s.kind === "rockfall" ? 1.2 + rnd() * 2.2 : s.r * 0.75;
          const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(size, 1), rockMat);
          const ox = n > 1 ? (rnd() - 0.5) * s.r * 1.5 : 0, oz = n > 1 ? (rnd() - 0.5) * s.r * 1.5 : 0;
          rock.position.set(ox, this.world.heightAt(x + ox, z + oz) - y + size * 0.45, oz);
          rock.scale.set(1, 0.72, 0.9);
          rock.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
          group.add(rock);
        }
      }
      group.position.set(x, y, z);
      this.scene.add(group);
      this.hazards.push({ id, kind: s.kind, label: s.label, x, z, r: s.r, found: false, mesh: group });
    });
  }

  private blockers(): Blocker[] {
    return this.hazards.filter((h) => h.found).map((h) => ({ x: h.x, z: h.z, r: h.r + 14 }));
  }

  private target(): Vec2 {
    return this.phase === "storm" || this.phase === "sheltered" ? this.shelter ?? this.base : this.goal;
  }

  private resolveRoute(): void {
    const from = { x: this.pos.x, z: this.pos.z };
    const next = solveRoute(this.world, from, this.target(), this.blockers());
    if (next) this.route = next;
    else this.say("No safe route found. Holding the last known path.", "warn");
    this.drawRoute();
  }

  private drawRoute(): void {
    if (this.routeMesh) {
      this.scene.remove(this.routeMesh);
      this.routeMesh.geometry.dispose();
      (this.routeMesh.material as THREE.Material).dispose();
    }
    const len = pathLength(this.route);
    const count = Math.max(2, Math.floor(len / 3));
    const geo = new THREE.CircleGeometry(0.34, 3);
    geo.rotateX(-Math.PI / 2);
    const storm = this.phase === "storm" || this.phase === "sheltered";
    const mat = new THREE.MeshBasicMaterial({ color: storm ? 0xff5a3c : 0x35e0c2, transparent: true, opacity: 0.9, fog: false, depthWrite: false });
    const inst = new THREE.InstancedMesh(geo, mat, count);
    const m = new THREE.Matrix4();
    for (let i = 0; i < count; i++) {
      const p = pointAlong(this.route, (i / (count - 1)) * len);
      m.makeTranslation(p.x, this.world.heightAt(p.x, p.z) + 0.25, p.z);
      inst.setMatrixAt(i, m);
    }
    inst.frustumCulled = false;
    inst.renderOrder = 2;
    this.routeMesh = inst;
    this.scene.add(inst);

    // A plain line reads better than the ground markers from the mission-map altitude.
    if (this.routeLine) {
      this.scene.remove(this.routeLine);
      this.routeLine.geometry.dispose();
      (this.routeLine.material as THREE.Material).dispose();
    }
    const linePts = this.route.map((p) => new THREE.Vector3(p.x, this.world.heightAt(p.x, p.z) + 1.5, p.z));
    this.routeLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(linePts), new THREE.LineBasicMaterial({ color: storm ? 0xff5a3c : 0x35e0c2, fog: false, depthTest: false }));
    this.routeLine.frustumCulled = false;
    this.routeLine.renderOrder = 3;
    this.scene.add(this.routeLine);
  }

  private addMarker(pos: () => THREE.Vector3, text: string, cls: string, show: () => boolean = () => true): Marker {
    const el = document.createElement("div");
    el.className = `mg-marker ${cls}`;
    this.markerLayer.appendChild(el);
    const mk: Marker = { el, pos: pos(), text, cls, show };
    Object.defineProperty(mk, "pos", { get: pos });
    this.markers.push(mk);
    return mk;
  }

  private say(text: string, tone: "info" | "warn" | "alert", who?: "you" | "rover", to?: Crew): void {
    this.log.push({ t: this.realT + this.log.length * 1e-6, text, tone, who, to });
    if (this.log.length > 30) this.log.shift();
  }

  /** A line in the rover's own voice, so its replies are not mistaken for SuperJar's. */
  private sayRover(text: string, tone: "info" | "warn" | "alert" = "info"): void {
    this.say(text, tone, "rover");
  }

  private detect(h: Hazard): void {
    h.found = true;
    const y = this.world.heightAt(h.x, h.z);
    const ring = new THREE.Mesh(new THREE.RingGeometry(h.r + 1, h.r + 2.2, 48), new THREE.MeshBasicMaterial({ color: 0xff5a3c, transparent: true, opacity: 0.85, side: THREE.DoubleSide, fog: false, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.5;
    h.mesh.add(ring);
    this.addMarker(() => new THREE.Vector3(h.x, y + (h.kind === "sand" ? 2.5 : 7), h.z), h.label, "mg-mk-hazard");
    this.playLaser();
    this.say(`${h.label} at ${Math.round(progressAlong(this.route, h))} m. Not in the base map. Rerouting.`, "warn");
    this.resolveRoute();
  }

  triggerStorm(): void {
    if (this.phase === "storm" || this.phase === "sheltered") return;
    this.phase = "storm";
    this.setControl("astronaut"); // the astronaut has to run; remote driving ends
    this.stormT = 0;
    this.stormStartReal = this.realT;
    // Rover first: it is the shelter, and it drives to meet the astronaut. Terrain only if the rover is far.
    const here = { x: this.pos.x, z: this.pos.z };
    const d = (s: Shelter) => Math.hypot(s.x - here.x, s.z - here.z);
    this.syncRoverShelter();
    const roverShelter = this.shelters[0];
    const terrain = this.shelters.slice(1).sort((a, b) => d(a) - d(b))[0];
    this.shelter = d(roverShelter) < 450 || !terrain ? roverShelter : terrain;
    const sh = this.shelter;
    (this.beacon.material as THREE.MeshBasicMaterial).color.set(0xff5a3c);
    this.addMarker(() => new THREE.Vector3(sh.x, this.world.heightAt(sh.x, sh.z) + 4.6, sh.z), "SHELTER", "mg-mk-shelter");
    this.playAlarm();
    this.say("SOLAR PARTICLE EVENT. Proton rate rising.", "alert");
    if (sh.id === "ROVER") {
      this.roverMode = "rescue";
      this.docked = false;
      this.say(`Rover is driving to you as your shelter, ${Math.round(d(sh))} m away. Run to meet it.`, "alert");
    } else {
      this.say(`${sh.label}, ${Math.round(d(sh))} m. Sky visible there: ${Math.round(sh.sky * 100)}%.`, "alert");
    }
    this.resolveRoute();
  }

  // --- input ----------------------------------------------------------------

  private bindInput(): void {
    const el = this.renderer.domElement;
    const typing = (e: KeyboardEvent) => e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
    const down = (e: KeyboardEvent) => {
      if (e.repeat || typing(e)) return;
      const k = e.code;
      this.keys.add(k);
      if (k === "KeyV") this.setView(this.view === "fpv" ? "tpv" : "fpv");
      if (k === "KeyM") this.setView(this.view === "map" ? "fpv" : "map");
      if (k === "Digit1") this.setView("fpv");
      if (k === "Digit2") this.setView("tpv");
      if (k === "Digit3") this.setView("map");
      if (k === "KeyP") this.setAutopilot(!this.autopilot);
      if (k === "KeyT") this.triggerStorm();
      if (k === "KeyR") this.resetMission();
      if (k === "KeyN") this.setSound(!this.soundOn);
      if (k === "KeyG") this.setMapExpanded(!this.mapExpanded);
      if (k === "KeyB") this.recallDrone();
      if (k === "KeyE") this.interact();
      if (k === "KeyQ") this.setControl(this.control === "astronaut" ? "superjar" : this.control === "superjar" ? "rover" : "astronaut");
      if (k === "KeyF") this.orderRover(this.roverMode === "follow" ? "hold" : "follow");
      if (["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(k) && this.autopilot && this.control === "astronaut") this.setAutopilot(false);
      if (k === "Space" || k.startsWith("Arrow")) e.preventDefault();
    };
    const up = (e: KeyboardEvent) => this.keys.delete(e.code);
    const move = (e: MouseEvent) => {
      if (!this.locked) return;
      if (this.control !== "astronaut") {
        this.rcYaw += e.movementX * 0.0022;
        this.rcPitch = Math.max(-1.35, Math.min(1.0, this.rcPitch - e.movementY * 0.0022));
        return;
      }
      this.yaw += e.movementX * 0.0022;
      this.pitch = Math.max(-1.35, Math.min(1.35, this.pitch - e.movementY * 0.0022));
    };
    const lock = () => { this.locked = document.pointerLockElement === el; if (!this.locked) this.keys.clear(); };
    const wheel = (e: WheelEvent) => { if (this.view === "map") this.mapZoom = Math.max(160, Math.min(2600, this.mapZoom * (1 + Math.sign(e.deltaY) * 0.12))); };
    const blur = () => this.keys.clear();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    document.addEventListener("mousemove", move);
    document.addEventListener("pointerlockchange", lock);
    el.addEventListener("wheel", wheel, { passive: true });
    el.addEventListener("click", () => this.requestLock());
    this.cleanup.push(() => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
      document.removeEventListener("mousemove", move);
      document.removeEventListener("pointerlockchange", lock);
    });
  }

  requestLock(): void {
    const el = this.renderer?.domElement;
    if (!el || this.locked) return;
    // Pointer lock can be refused (no user gesture, embedded view); the game still runs on autopilot.
    try { void (el.requestPointerLock() as unknown as Promise<void> | undefined)?.catch?.(() => {}); } catch { /* ignored */ }
  }

  /** Must be called from a click or key press: browsers block audio until the user acts. */
  startAudio(): void {
    if (this.wind) return;
    const make = (file: string, loop: boolean, volume: number) => {
      const a = new Audio(`${DATA}/audio/${file}`);
      a.loop = loop;
      a.volume = volume;
      a.preload = "auto";
      return a;
    };
    this.wind = make("mars_wind_supercam_sol4.mp3", true, 0.6);
    this.droneHum = make("ingenuity_flight_loop.mp3", true, 0);
    this.roverSound = make("rover_driving_sol16.mp3", true, 0);
    this.laser = make("supercam_laser_sol12.mp3", false, 0.9);
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (Ctx) this.audioCtx = new Ctx();
    this.applySound();
  }

  private applySound(): void {
    for (const a of [this.wind, this.droneHum, this.roverSound]) {
      if (!a) continue;
      if (this.soundOn) void a.play().catch(() => {});
      else a.pause();
    }
    if (!this.soundOn) this.laser?.pause();
  }

  setRoverSound(on: boolean): void {
    this.roverSoundOn = on;
  }

  setSound(on: boolean): void {
    this.soundOn = on;
    this.applySound();
  }

  private playLaser(): void {
    if (!this.laser || !this.soundOn) return;
    this.laser.currentTime = 0.2;
    void this.laser.play().catch(() => {});
    this.laserStop = this.realT + 2.3; // about seven laser shots
  }

  /** Storm alarm. Synthesised, not a NASA recording. */
  private playAlarm(): void {
    const ctx = this.audioCtx;
    if (!ctx || !this.soundOn) return;
    void ctx.resume();
    for (let i = 0; i < 4; i++) {
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      const at = ctx.currentTime + i * 0.42;
      osc.type = "square";
      osc.frequency.setValueAtTime(i % 2 ? 660 : 880, at);
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.12, at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.3);
      osc.connect(gain).connect(ctx.destination);
      osc.start(at);
      osc.stop(at + 0.32);
    }
  }

  private updateAudio(): void {
    if (this.droneHum) {
      const d = this.drone.position.distanceTo(this.camera.position);
      this.droneHum.volume = Math.max(0, Math.min(0.5, 0.5 * (1 - (d - 8) / 110)));
    }
    if (this.roverSound) {
      const d = Math.hypot(this.roverPos.x - this.camera.position.x, this.roverPos.z - this.camera.position.z);
      const want = this.roverMoving && this.roverSoundOn ? Math.max(0, Math.min(0.55, 0.55 * (1 - (d - 4) / 70))) : 0;
      this.roverSound.volume += (want - this.roverSound.volume) * 0.08;
    }
    if (this.laser && this.laserStop && this.realT > this.laserStop) {
      this.laser.pause();
      this.laserStop = 0;
    }
  }

  setView(v: ViewMode): void { this.view = v; }

  /**
   * Hands the keys and the camera to the rover or to SuperJar, or back to the astronaut.
   * The astronaut stays where they are while driving remotely.
   */
  setControl(who: Control): void {
    if (who === this.control) return;
    if (who === "superjar" && this.scoutBusy()) return;
    // Park whatever was being driven.
    if (this.control === "rover" && this.roverMode === "manual") this.roverMode = "hold";
    if (this.control === "superjar" && this.droneMode === "manual") {
      this.droneTarget = { x: this.drone.position.x, z: this.drone.position.z };
      this.droneMode = "hold";
      this.droneArrived = true;
    }
    this.control = who;
    this.keys.clear();
    if (who === "rover") {
      this.roverMode = "manual";
      this.roverPath = [];
      this.docked = false;
      this.rcYaw = this.roverYaw;
      this.rcPitch = -0.3;
      this.sayRover("Remote control on. W S drive, A D steer, Shift fast. Q hands back.");
    } else if (who === "superjar") {
      this.droneMode = "manual";
      this.droneVel.set(0, 0, 0);
      this.droneAlt = Math.max(2, this.drone.position.y - this.world.heightAt(this.drone.position.x, this.drone.position.z));
      this.rcYaw = Math.PI - this.drone.rotation.y;
      this.droneYawPrev = this.rcYaw;
      this.rcPitch = -0.15;
      this.say("You have the stick. It flies where you look: look down and push W to dive, look up to climb. Space and Shift go straight up and down. Q hands back.", "info");
    } else {
      this.say("Control is back with you.", "info");
    }
  }
  setAutopilot(on: boolean): void { this.autopilot = on; }

  // --- simulation -----------------------------------------------------------

  private frame = (now: number): void => {
    if (this.disposed) return;
    const dt = Math.max(0, Math.min(0.1, (now - this.last) / 1000)); // the first rAF timestamp can precede init
    this.last = now;
    this.step(dt);
    this.render(dt);
    this.raf = requestAnimationFrame(this.frame);
  };

  private step(dt: number): void {
    this.realT += dt;
    // An order, or the storm, can take a vehicle out of manual; the view then returns to the astronaut.
    if ((this.control === "rover" && this.roverMode !== "manual") || (this.control === "superjar" && this.droneMode !== "manual")) {
      this.control = "astronaut";
      this.keys.clear();
    }
    this.movePlayer(dt);
    this.moveRover(dt);
    this.moveDrone(dt);
    this.updateRadiation(dt);
    this.updateBody(dt);

    const here = { x: this.pos.x, z: this.pos.z };
    const done = progressAlong(this.route, here);
    if (this.phase === "scout" && this.droneDist >= this.initialRouteLen) {
      this.phase = "walk";
      this.say(`Scout pass complete. ${this.hazards.filter((h) => h.found).length} changes since the base map. Route updated. You are go.`, "info");
    }
    if (this.phase === "walk") {
      const total = 1 - Math.hypot(this.goal.x - here.x, this.goal.z - here.z) / Math.hypot(this.goal.x - this.base.x, this.goal.z - this.base.z);
      if (total > STORM_AT_PROGRESS) this.triggerStorm();
      else if (Math.hypot(this.goal.x - here.x, this.goal.z - here.z) < 8) {
        this.phase = "arrived";
        this.say("Science stop reached. Sampling window open.", "info");
      }
    }
    if (this.phase === "storm" && this.shelter) {
      // The rover moves, so keep the red route and beacon pointed at where it is now.
      if (this.shelter.id === "ROVER" && this.realT - this.stormRouteAt > 1.2) {
        this.stormRouteAt = this.realT;
        this.resolveRoute();
      }
      this.beacon.position.set(this.shelter.x, this.world.heightAt(this.shelter.x, this.shelter.z), this.shelter.z);
      if (Math.hypot(this.shelter.x - here.x, this.shelter.z - here.z) < (this.shelter.id === "ROVER" ? DOCK_RANGE : 9)) {
        this.phase = "sheltered";
        this.setAutopilot(false);
        if (this.shelter.id === "ROVER") {
          this.roverMode = "hold";
          this.docked = true;
        }
        this.say(`${this.shelter.id === "ROVER" ? "At the rover" : "In shelter"} after ${Math.round(this.realT - this.stormStartReal)} s. Hold until dose rate is under 1.2x baseline.`, "info");
      }
    }
    void done;

    this.hudAcc += dt;
    if (this.hudAcc > 0.066) {
      this.hudAcc = 0;
      this.onHud(this.snapshot());
      this.drawMinimap();
    }
  }

  private movePlayer(dt: number): void {
    let fwd = 0, strafe = 0, sprint = false;
    if (this.autopilot && this.phase === "scout") {
      // wait at base until the scout pass is done
    } else if (this.autopilot && this.phase !== "sheltered" && this.phase !== "arrived") {
      const here = { x: this.pos.x, z: this.pos.z };
      const aim = pointAlong(this.route, progressAlong(this.route, here) + 9);
      const want = Math.atan2(aim.x - here.x, -(aim.z - here.z));
      let d = want - this.yaw;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      this.yaw += d * Math.min(1, dt * 3.5);
      this.pitch += (-0.08 - this.pitch) * Math.min(1, dt * 2);
      fwd = 1;
      sprint = true; // auto-walk runs, so the whole story fits in about a minute
    } else if (this.control === "astronaut") {
      const k = this.keys;
      fwd = (k.has("KeyW") || k.has("ArrowUp") ? 1 : 0) - (k.has("KeyS") || k.has("ArrowDown") ? 1 : 0);
      strafe = (k.has("KeyD") ? 1 : 0) - (k.has("KeyA") ? 1 : 0);
      if (k.has("ArrowLeft")) this.yaw -= dt * 1.8;
      if (k.has("ArrowRight")) this.yaw += dt * 1.8;
      sprint = k.has("ShiftLeft") || k.has("ShiftRight");
      if (k.has("Space") && this.grounded) { this.vy = 3.3; this.grounded = false; }
    }
    const mag = Math.hypot(fwd, strafe);
    let moved = 0;
    if (mag > 0) {
      const inSand = this.hazards.some((h) => h.kind === "sand" && Math.hypot(h.x - this.pos.x, h.z - this.pos.z) < h.r);
      const v = (sprint ? SPRINT : WALK) * (inSand ? 0.35 : 1);
      const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
      const dx = ((fwd * sin + strafe * cos) / mag) * v * dt;
      const dz = ((-fwd * cos + strafe * sin) / mag) * v * dt;
      let nx = this.pos.x + dx, nz = this.pos.z + dz;
      // Too steep to climb in a suit: refuse uphill steps beyond 38 degrees.
      const rise = this.world.heightAt(nx, nz) - this.world.heightAt(this.pos.x, this.pos.z);
      const run = Math.hypot(dx, dz);
      if (rise > run * Math.tan((38 * Math.PI) / 180) && this.grounded) { nx = this.pos.x; nz = this.pos.z; }
      for (const h of this.hazards) {
        if (h.kind === "sand") continue;
        const rr = h.kind === "rockfall" ? h.r * 0.55 : h.r * 0.8;
        const d = Math.hypot(nx - h.x, nz - h.z);
        if (d < rr) { nx = h.x + ((nx - h.x) / (d || 1)) * rr; nz = h.z + ((nz - h.z) / (d || 1)) * rr; }
      }
      const rd = Math.hypot(nx - this.roverPos.x, nz - this.roverPos.z);
      if (rd < 2.3) { nx = this.roverPos.x + ((nx - this.roverPos.x) / (rd || 1)) * 2.3; nz = this.roverPos.z + ((nz - this.roverPos.z) / (rd || 1)) * 2.3; }
      if (this.world.inBounds(nx, nz)) {
        moved = Math.hypot(nx - this.pos.x, nz - this.pos.z);
        this.pos.x = nx;
        this.pos.z = nz;
      }
    }
    this.speed += (moved / Math.max(dt, 1e-4) - this.speed) * Math.min(1, dt * 8);
    this.walkPhase += moved * 1.9;

    const ground = this.world.heightAt(this.pos.x, this.pos.z);
    if (!this.grounded) {
      this.vy -= MARS_G * dt;
      this.pos.y += this.vy * dt;
      if (this.pos.y <= ground) { this.pos.y = ground; this.vy = 0; this.grounded = true; }
    } else {
      this.pos.y = ground;
    }
  }

  private moveDrone(dt: number): void {
    if (this.droneMode === "manual") {
      // Flown like a helicopter: it goes where the nose points. Look down and push forward to dive,
      // look up to climb. Space and Shift raise and lower it without changing heading.
      const k = this.keys, p = this.drone.position;
      const fwd = (k.has("KeyW") || k.has("ArrowUp") ? 1 : 0) - (k.has("KeyS") || k.has("ArrowDown") ? 1 : 0);
      const side = (k.has("KeyD") || k.has("ArrowRight") ? 1 : 0) - (k.has("KeyA") || k.has("ArrowLeft") ? 1 : 0);
      const lift = (k.has("Space") ? 1 : 0) - (k.has("ShiftLeft") || k.has("ShiftRight") ? 1 : 0);
      const sin = Math.sin(this.rcYaw), cos = Math.cos(this.rcYaw), cp = Math.cos(this.rcPitch), sp = Math.sin(this.rcPitch);
      const want = new THREE.Vector3(fwd * sin * cp + side * cos, fwd * sp + lift * 0.6, -fwd * cos * cp + side * sin);
      if (want.lengthSq() > 1) want.normalize();
      want.multiplyScalar(DRONE_MANUAL_SPEED);
      const before = this.droneVel.clone();
      this.droneVel.lerp(want, Math.min(1, dt * 1.8)); // it has momentum: it leans in, then drifts to a stop
      const nx = p.x + this.droneVel.x * dt, nz = p.z + this.droneVel.z * dt;
      if (this.world.inBounds(nx, nz, 20)) { p.x = nx; p.z = nz; } else { this.droneVel.x = 0; this.droneVel.z = 0; }
      // Free height, held between a skid's clearance over the ground and a ceiling.
      const ground = this.world.heightAt(p.x, p.z);
      p.y += this.droneVel.y * dt;
      if (p.y < ground + 1.3) { p.y = ground + 1.3; this.droneVel.y = Math.max(0, this.droneVel.y); }
      if (p.y > ground + 120) { p.y = ground + 120; this.droneVel.y = Math.min(0, this.droneVel.y); }
      this.droneAlt = p.y - ground;
      // The airframe pitches nose-down to accelerate forward and banks into sideways motion and turns.
      const acc = this.droneVel.clone().sub(before).divideScalar(Math.max(dt, 1e-4));
      const vF = this.droneVel.x * sin - this.droneVel.z * cos, vS = this.droneVel.x * cos + this.droneVel.z * sin;
      const aF = acc.x * sin - acc.z * cos;
      const yawRate = (this.rcYaw - this.droneYawPrev) / Math.max(dt, 1e-4);
      this.droneYawPrev = this.rcYaw;
      const tilt = Math.max(-0.45, Math.min(0.45, aF * 0.03 + vF * 0.014 - this.rcPitch * 0.25));
      const bank = Math.max(-0.5, Math.min(0.5, vS * 0.02 + yawRate * vF * 0.012));
      const ease = Math.min(1, dt * 5);
      this.droneTilt += (tilt - this.droneTilt) * ease;
      this.droneBank += (bank - this.droneBank) * ease;
      this.drone.rotation.set(this.droneTilt, Math.PI - this.rcYaw, this.droneBank, "YXZ");
      this.droneUpkeep(dt);
      return;
    }
    const len = pathLength(this.route);
    let want: Vec2, alt: number, cap: number;
    if (this.droneMode === "route") {
      if (this.phase === "scout") {
        this.droneDist = Math.min(this.initialRouteLen, this.droneDist + SCOUT_SPEED * dt);
      } else {
        const ahead = Math.min(len, progressAlong(this.route, { x: this.pos.x, z: this.pos.z }) + 34);
        this.droneDist += (ahead - this.droneDist) * Math.min(1, dt * 1.6);
      }
      want = pointAlong(this.route, Math.min(len, this.droneDist));
      alt = this.phase === "scout" ? 14 : 7;
      cap = this.phase === "scout" ? 200 : DRONE_SPEED * 1.5;
    } else if (this.droneMode === "recall") {
      want = { x: this.pos.x + Math.sin(this.yaw) * 4 + Math.cos(this.yaw) * 1.5, z: this.pos.z - Math.cos(this.yaw) * 4 + Math.sin(this.yaw) * 1.5 };
      alt = 2.6;
      cap = DRONE_SPEED;
    } else {
      want = this.droneTarget;
      alt = 10;
      cap = DRONE_SPEED;
    }
    const prev = this.drone.position.clone();
    const dx = want.x - prev.x, dz = want.z - prev.z;
    const d = Math.hypot(dx, dz);
    const stepLen = Math.min(d, cap * dt);
    if (d > 1e-4) {
      this.drone.position.x += (dx / d) * stepLen;
      this.drone.position.z += (dz / d) * stepLen;
    }
    // Climb for transit so the drone clears ridges, then settle to the working height.
    const cruise = d > 40 ? Math.max(alt, 18) : alt;
    const ty = this.world.heightAt(this.drone.position.x, this.drone.position.z) + cruise + Math.sin(this.realT * 2.1) * 0.35;
    this.drone.position.y += (ty - this.drone.position.y) * Math.min(1, dt * 3);
    const mv = this.drone.position.clone().sub(prev);
    if (mv.x * mv.x + mv.z * mv.z > 1e-5) this.drone.rotation.y = Math.atan2(mv.x, mv.z);
    this.droneTilt *= 1 - Math.min(1, dt * 4);
    this.droneBank *= 1 - Math.min(1, dt * 4);
    this.drone.rotation.x = this.droneTilt;
    this.drone.rotation.z = this.droneBank;
    this.droneUpkeep(dt);
    if (!this.droneArrived && d < 2.5 && this.droneMode !== "route") {
      this.droneArrived = true;
      if (this.droneMode === "goto") {
        this.droneMode = "hold";
        this.say(this.surveyReport(this.droneTarget), "info");
      } else if (this.droneMode === "recall") {
        this.say("SuperJar is back with you.", "info");
      }
    }
  }

  /** Rotors turn and the sensors look for changes, however the drone is being flown. */
  private droneUpkeep(dt: number): void {
    // Blades turn about the mast (each rotor node's own X axis). The lower rotor's node is flipped
    // in the model, so the same turn on both makes them counter-rotate, as on Ingenuity.
    for (const r of this.rotors) r.rotateX(dt * 38);
    for (const h of this.hazards) {
      if (!h.found && Math.hypot(h.x - this.drone.position.x, h.z - this.drone.position.z) < SENSOR_RANGE) this.detect(h);
    }
  }

  // --- SuperJar commands ----------------------------------------------------

  private lonLat(p: Vec2): { lon: number; lat: number } {
    const b = this.meta.bounds_lonlat;
    return { lon: b.west + ((p.x + HALF) / SITE_M) * (b.east - b.west), lat: b.north - ((p.z + HALF) / SITE_M) * (b.north - b.south) };
  }

  /** What SuperJar reports on arriving somewhere. Every figure comes from the terrain data or the hazard list. */
  private surveyReport(p: Vec2): string {
    const { lon, lat } = this.lonLat(p);
    const near = this.hazards.filter((h) => h.found && Math.hypot(h.x - p.x, h.z - p.z) < SENSOR_RANGE);
    const walk = solveRoute(this.world, { x: this.pos.x, z: this.pos.z }, p, this.blockers());
    const slope = this.world.slopeAt(p.x, p.z);
    return [
      `On station at ${lat.toFixed(4)}°N ${lon.toFixed(4)}°E.`,
      `Slope ${slope.toFixed(0)}°${slope > MAX_SLOPE_DEG ? ", too steep to walk" : ""}, sky visible ${Math.round(this.world.skyAt(p.x, p.z) * 100)}%.`,
      near.length ? `${near.length} flagged change${near.length > 1 ? "s" : ""} within ${SENSOR_RANGE} m: ${near.map((h) => h.label.toLowerCase()).join(", ")}.` : `No changes within ${SENSOR_RANGE} m.`,
      walk ? `Walkable route from you: ${Math.round(pathLength(walk))} m.` : "No walkable route from you under 25°.",
    ].join(" ");
  }

  private scoutBusy(): boolean {
    if (this.phase !== "scout") return false;
    this.say("Scout pass in progress. I can take orders once the route is checked.", "info");
    return true;
  }

  /** Sends SuperJar to a point on the map. */
  sendDrone(x: number, z: number, label?: string): void {
    if (this.scoutBusy()) return;
    if (!this.world.inBounds(x, z, 20)) {
      this.say("That point is outside the mapped site.", "warn");
      return;
    }
    this.droneTarget = { x, z };
    this.droneMode = "goto";
    this.droneArrived = false;
    const d = Math.hypot(x - this.drone.position.x, z - this.drone.position.z);
    this.say(`Heading to ${label ?? "the marked point"}, ${Math.round(d)} m. About ${Math.ceil(d / DRONE_SPEED)} s.`, "info");
  }

  recallDrone(): void {
    if (this.scoutBusy()) return;
    this.droneMode = "recall";
    this.droneArrived = false;
    const d = Math.hypot(this.pos.x - this.drone.position.x, this.pos.z - this.drone.position.z);
    this.say(`Coming back to you, ${Math.round(d)} m.`, "info");
  }

  escortDrone(): void {
    if (this.scoutBusy()) return;
    this.droneMode = "route";
    this.droneDist = progressAlong(this.route, { x: this.drone.position.x, z: this.drone.position.z });
    this.say("Back on the route, scouting ahead of you.", "info");
  }

  /**
   * Plain-language orders and questions. Rule-based: every answer is read from the
   * mission state, so SuperJar cannot invent a reading.
   */
  command(input: string, to: Crew = "superjar"): void {
    let text = input.trim();
    if (!text) return;
    // A message that opens with a name goes to that name, whichever tab it was typed in.
    const addressed = text.match(/^(rover|superjar|super jar|drone|jar)\b[\s,:]*/i);
    if (addressed) {
      to = addressed[1].toLowerCase() === "rover" ? "rover" : "superjar";
      text = text.slice(addressed[0].length).trim() || "status";
    }
    this.say(text, "info", "you", to);
    const q = text.toLowerCase();
    const has = (re: RegExp) => re.test(q);
    const here = { x: this.pos.x, z: this.pos.z };
    const dist = (p: Vec2) => Math.hypot(p.x - here.x, p.z - here.z);
    const order = has(/\b(go|send|fly|check|scout|look|survey|inspect|head|move)\b/);

    const coords = q.match(/(-?\d+\.\d+)\s*°?\s*n?[ ,]+(-?\d+\.\d+)/);
    if (coords) {
      const b = this.meta.bounds_lonlat;
      const lat = parseFloat(coords[1]), lon = parseFloat(coords[2]);
      const x = ((lon - b.west) / (b.east - b.west)) * SITE_M - HALF, z = ((b.north - lat) / (b.north - b.south)) * SITE_M - HALF;
      const name = `${lat.toFixed(4)}°N ${lon.toFixed(4)}°E`;
      return to === "rover" ? this.sendRover(x, z, name) : this.sendDrone(x, z, name);
    }
    if (to === "rover") return this.commandRover(q);
    if (has(/\b(come back|comeback|return|recall|to me|come here|back to me|call back)\b/)) return this.recallDrone();
    if (has(/\b(escort|follow|resume|lead|scout ahead|go ahead|carry on)\b/)) return this.escortDrone();
    if (has(/\b(stop|hold|stay|hover|wait)\b/)) {
      if (this.scoutBusy()) return;
      this.droneTarget = { x: this.drone.position.x, z: this.drone.position.z };
      this.droneMode = "hold";
      this.droneArrived = true;
      return this.say("Holding position.", "info");
    }
    const named = this.shelters.find((s) => s.id !== "ROVER" && q.includes(s.id.toLowerCase()));
    if (named && order) return this.sendDrone(named.x, named.z, named.label);
    if (order && has(/shelter/)) {
      const s = [...this.shelters].sort((a, b) => dist(a) - dist(b))[0];
      return this.sendDrone(s.x, s.z, s.label);
    }
    if (order && has(/rover/)) return this.sendDrone(this.roverPos.x, this.roverPos.z, "the rover");
    if (order && has(/base|home/)) return this.sendDrone(this.base.x, this.base.z, "the base");
    if (order && has(/science|goal|objective|scarp|delta/)) return this.sendDrone(this.goal.x, this.goal.z, "the science stop");

    if (has(/shelter/)) {
      const s = [...this.shelters].sort((a, b) => dist(a) - dist(b))[0];
      return this.say(`Nearest shelter: ${s.label}, ${Math.round(dist(s))} m. Sky visible there ${Math.round(s.sky * 100)}%, so it cuts little dose. Say "check the shelter" and I will fly there.`, "info");
    }
    if (has(/radiation|dose|sievert|gray|rad\b/)) {
      return this.say(`Dose rate ${this.doseRate.toFixed(1)} µGy/h, ${(this.doseRate / this.baseline).toFixed(2)}x the quiet baseline of ${this.baseline.toFixed(1)}. This EVA: ${this.evaDose.toFixed(1)} µGy. Source: Curiosity RAD replay, scaled by sky visible here.`, this.band() === "red" ? "alert" : "info");
    }
    if (has(/storm|solar|sun|sep\b|flare/)) {
      return this.say(this.phase === "storm" || this.phase === "sheltered" ? `Storm in progress. ${this.stormSource}. Rate is ${(this.doseRate / this.baseline).toFixed(2)}x baseline.` : "No storm alert. Dose rate is at the quiet baseline. I am watching the DONKI feed.", "info");
    }
    if (has(/hazard|boulder|rock|sand|danger|change|obstacle|new/)) {
      const found = this.hazards.filter((h) => h.found);
      return this.say(found.length ? `${found.length} changes since the base map: ${found.map((h) => `${h.label.toLowerCase()} ${Math.round(dist(h))} m`).join(", ")}. The route already avoids them.` : "Nothing flagged yet.", "info");
    }
    if (has(/route|how far|distance|eta|long|far/)) {
      const left = Math.max(0, pathLength(this.route) - progressAlong(this.route, here));
      return this.say(`${Math.round(left)} m left on the route to ${this.phase === "storm" ? "shelter" : "the science stop"}. About ${Math.ceil(left / WALK)} s walking, ${Math.ceil(left / SPRINT)} s at a run.`, "info");
    }
    if (has(/oxygen|o2|battery|vital|heart|suit|health|pulse/)) {
      return this.say(`Oxygen ${Math.round(this.o2)}%, battery ${Math.round(this.battery)}%, heart rate ${Math.round(this.hr)} bpm. These are simulated.`, "info");
    }
    if (has(/where are you|your position|where.*superjar/)) {
      const p = { x: this.drone.position.x, z: this.drone.position.z };
      const { lon, lat } = this.lonLat(p);
      return this.say(`I am ${Math.round(dist(p))} m from you at ${lat.toFixed(4)}°N ${lon.toFixed(4)}°E.`, "info");
    }
    if (has(/status|report|sitrep|summary|how are we|ok\?/)) {
      return this.say(`${this.advice()} Dose rate ${(this.doseRate / this.baseline).toFixed(2)}x baseline, EVA dose ${this.evaDose.toFixed(1)} µGy, oxygen ${Math.round(this.o2)}%.`, "info");
    }
    this.say('I can: "come back", "scout ahead", "hold", "check the shelter", "go to the science stop", "go to S07", or coordinates like "18.4601, 77.4052". Ask me about radiation, the storm, hazards, the route or your suit. Or open the map (G) and click a point. Driving orders go to the rover: switch to its tab.', "info");
  }

  /** Orders for the rover. It only drives, parks and recharges the suit; questions go to SuperJar. */
  private commandRover(q: string): void {
    const has = (re: RegExp) => re.test(q);
    if (has(/\b(unplug|plug|recharge|charge|dock|refill)\b/)) return this.interact();
    if (has(/\b(stop|hold|stay|park|wait|halt)\b/)) return this.orderRover("hold");
    if (has(/\b(come|here|to me|pick me|bring|fetch|back)\b/)) return this.orderRover("come");
    if (has(/\b(follow|with me|tag along|escort|resume)\b/)) return this.orderRover("follow");
    const place = this.shelters.find((s) => s.id !== "ROVER" && q.includes(s.id.toLowerCase()));
    if (place) return this.sendRover(place.x, place.z, place.label);
    if (has(/science|goal|objective|scarp|delta/)) return this.sendRover(this.goal.x, this.goal.z, "the science stop");
    if (has(/base|home/)) return this.sendRover(this.base.x + 9, this.base.z - 6, "the base");
    const state = { follow: "following you", hold: "parked", goto: "driving to a marked point", rescue: "driving to you as shelter", manual: "under your remote control" }[this.roverMode];
    if (has(/status|report|where|how far|distance/)) return this.sayRover(`${Math.round(this.roverDist())} m from you, ${state}${this.docked ? ", suit plugged in" : ""}.`);
    this.sayRover(`I take driving orders only: "follow", "park", "come here", "go to base", "go to the science stop", "go to S07", coordinates, or "plug in" when you are beside me. Now ${state}, ${Math.round(this.roverDist())} m from you. Ask SuperJar about radiation, hazards and the route.`);
  }

  // --- map ------------------------------------------------------------------

  setMapExpanded(on: boolean): void {
    this.mapExpanded = on;
    if (on && document.pointerLockElement) document.exitPointerLock();
  }

  /** Converts a click on the expanded (north-up) map into a SuperJar order. */
  mapClick(fx: number, fy: number, who: Crew = "superjar"): void {
    if (!this.mapExpanded) return;
    const range = MAP_RANGE_WIDE;
    const x = this.pos.x + (fx - 0.5) * range * 2, z = this.pos.z + (fy - 0.5) * range * 2;
    if (who === "rover") this.sendRover(x, z);
    else this.sendDrone(x, z);
  }

  private updateRadiation(dt: number): void {
    let rad: number;
    if (this.phase === "storm" || this.phase === "sheltered") {
      this.stormT += dt * STORM_REPLAY;
      const t0 = this.rad[this.onsetIdx].t;
      const t = t0 + this.stormT;
      let i = this.onsetIdx;
      while (i < this.rad.length - 2 && this.rad[i + 1].t < t) i++;
      const a = this.rad[i], b = this.rad[i + 1];
      const f = Math.min(1, Math.max(0, (t - a.t) / Math.max(1, b.t - a.t)));
      rad = a.e + (b.e - a.e) * f;
    } else {
      // Quiet days before the event, looped two samples a second for a live-looking readout.
      const f = (this.realT * 0.5) % (this.onsetIdx - 1);
      const i = Math.floor(f);
      rad = this.rad[i].e + (this.rad[i + 1].e - this.rad[i].e) * (f - i);
    }
    this.doseRate = rad * this.world.skyAt(this.pos.x, this.pos.z);
    this.peakRate = Math.max(this.peakRate, this.doseRate);
    this.evaDose += (this.doseRate * dt * CLOCK_RATE) / 3600;
    this.histAcc += dt;
    if (this.histAcc > 0.5) {
      this.histAcc = 0;
      this.doseHistory.push(this.doseRate);
      if (this.doseHistory.length > 90) this.doseHistory.shift();
    }
  }

  private updateBody(dt: number): void {
    const effort = Math.min(1, this.speed / SPRINT) + Math.min(0.5, this.world.slopeAt(this.pos.x, this.pos.z) / 40);
    const target = 76 + effort * 62 + (this.phase === "storm" ? 16 : 0);
    this.hr += (target - this.hr) * Math.min(1, dt * 0.5);
    const hours = (dt * CLOCK_RATE) / 3600;
    this.o2 = Math.max(0, this.o2 - hours * (100 / 8) * (0.8 + effort * 0.7));
    this.battery = Math.max(0, this.battery - hours * (100 / 10));
    if (this.docked) {
      if (this.roverDist() > DOCK_RANGE + 1.5) {
        this.docked = false;
        this.sayRover("Suit unplugged.");
      } else {
        this.o2 = Math.min(100, this.o2 + dt * 5);
        this.battery = Math.min(100, this.battery + dt * 5);
      }
    }
  }

  // --- rover ----------------------------------------------------------------

  private roverDist(): number {
    return Math.hypot(this.roverPos.x - this.pos.x, this.roverPos.z - this.pos.z);
  }

  private syncRoverShelter(): void {
    const s = this.shelters[0];
    s.x = this.roverPos.x;
    s.z = this.roverPos.z;
    s.sky = this.world.skyAt(s.x, s.z);
    s.label = "Rover";
  }

  private moveRover(dt: number): void {
    const here = { x: this.pos.x, z: this.pos.z };
    const dPlayer = this.roverDist();
    let goal: Vec2 | null = null, stopAt = 1.5;
    if (this.roverMode === "follow" || this.roverMode === "rescue") {
      stopAt = this.roverMode === "rescue" ? 4.2 : ROVER_FOLLOW_GAP;
      // Start rolling only once the astronaut has opened a gap, so it does not creep at their heels.
      if (dPlayer > stopAt + (this.roverMoving ? 0 : 5)) goal = here;
    } else if (this.roverMode === "goto") {
      goal = this.roverGoal;
    }
    let wantV = 0, wantW = 0;
    const left = goal ? Math.hypot(goal.x - this.roverPos.x, goal.z - this.roverPos.z) - stopAt : 0;
    if (goal && left > 0) {
      const drift = Math.hypot(goal.x - this.roverPathFor.x, goal.z - this.roverPathFor.z);
      if (!this.roverPath.length || (drift > 10 && this.realT - this.roverPathAt > 1.5)) {
        this.roverPath = solveRoute(this.world, this.roverPos, goal, this.blockers()) ?? [];
        this.roverPathAt = this.realT;
        this.roverPathFor = { ...goal };
        if (!this.roverPath.length && this.roverMode === "goto") {
          this.roverMode = "hold";
          this.sayRover("No drivable route to that point under 25°. Holding.", "warn");
        }
      }
      if (this.roverPath.length) {
        const along = progressAlong(this.roverPath, this.roverPos);
        const aim = pointAlong(this.roverPath, along + 3.5);
        const dx = aim.x - this.roverPos.x, dz = aim.z - this.roverPos.z;
        if (Math.hypot(dx, dz) > 0.05) {
          let turn = Math.atan2(dx, -dz) - this.roverYaw;
          while (turn > Math.PI) turn -= Math.PI * 2;
          while (turn < -Math.PI) turn += Math.PI * 2;
          // Facing well away from the route: stop and turn on the spot, as the real rover does.
          if (Math.abs(turn) > 1.0 && Math.abs(this.roverV) < 1) this.roverPivoting = true;
          else if (Math.abs(turn) < 0.2) this.roverPivoting = false;
          if (this.roverPivoting) {
            wantW = Math.sign(turn) * Math.min(0.9, Math.abs(turn) * 3);
          } else {
            // Falling well behind in follow mode, it speeds up to catch the astronaut.
            const base = this.roverMode === "rescue" || (this.roverMode === "follow" && dPlayer > 28) ? ROVER_RESCUE_SPEED : ROVER_SPEED;
            // Slow for corners, and brake in time to stop at the goal.
            wantV = Math.min(base * Math.max(0.25, 1 - Math.abs(turn) / 1.6), Math.sqrt(8 * left) + 0.4);
            // An arc no tighter than about 1.8 m, which the steered corner wheels can follow.
            const maxW = Math.max(0.15, Math.abs(this.roverV) / 1.8);
            wantW = Math.max(-maxW, Math.min(maxW, turn * 2));
          }
        }
        this.roverArrived = false;
      }
    } else if (this.roverMode === "goto" && !this.roverArrived) {
      this.roverArrived = true;
      this.roverMode = "hold";
      this.roverPath = [];
      this.sayRover(`Parked, ${Math.round(dPlayer)} m from you.`);
    } else {
      this.roverPath = [];
    }
    if (this.roverMode === "manual") {
      const k = this.keys;
      const drive = (k.has("KeyW") || k.has("ArrowUp") ? 1 : 0) - (k.has("KeyS") || k.has("ArrowDown") ? 1 : 0);
      const steer = (k.has("KeyD") || k.has("ArrowRight") ? 1 : 0) - (k.has("KeyA") || k.has("ArrowLeft") ? 1 : 0);
      wantV = drive > 0 ? (k.has("ShiftLeft") || k.has("ShiftRight") ? ROVER_RESCUE_SPEED : ROVER_SPEED) : drive < 0 ? -2.5 : 0;
      // Steering reverses with the direction of travel, as in any vehicle; standing still it turns on the spot.
      wantW = steer * 0.85 * (this.roverV < -0.2 ? -1 : 1);
      // The rover will not drive onto ground over its slope limit, or off the mapped site.
      const way = Math.sign(wantV || this.roverV);
      if (way) {
        const ax = this.roverPos.x + Math.sin(this.roverYaw) * way * 2.4, az = this.roverPos.z - Math.cos(this.roverYaw) * way * 2.4;
        const steep = this.world.slopeAt(ax, az) > MAX_SLOPE_DEG;
        if (steep || !this.world.inBounds(ax, az, 20)) {
          wantV = 0;
          this.roverV = 0;
          if (this.realT - this.rcWarnAt > 4) {
            this.rcWarnAt = this.realT;
            this.sayRover(steep ? `Stopped: ${this.world.slopeAt(ax, az).toFixed(0)}° slope ahead, over my ${MAX_SLOPE_DEG}° limit.` : "Stopped: edge of the mapped site.", "warn");
          }
        }
      }
    }
    if (!wantW) this.roverPivoting = false;
    // The rover has mass: it picks up speed, brakes and swings into turns over time.
    this.roverV += Math.max(-6 * dt, Math.min(3 * dt, wantV - this.roverV));
    this.roverW += Math.max(-4 * dt, Math.min(4 * dt, wantW - this.roverW));
    if (!wantV && Math.abs(this.roverV) < 0.02) this.roverV = 0;
    if (!wantW && Math.abs(this.roverW) < 0.02) this.roverW = 0;
    this.roverYaw += this.roverW * dt;
    if (this.control === "rover") this.rcYaw += this.roverW * dt; // the camera turns with the rover
    this.roverPos.x += Math.sin(this.roverYaw) * this.roverV * dt;
    this.roverPos.z -= Math.cos(this.roverYaw) * this.roverV * dt;
    this.roverMoving = Math.abs(this.roverV) > 0.05 || Math.abs(this.roverW) > 0.05;
    this.syncRoverShelter();
    this.poseRover(dt);
  }

  /** Sits the rover on the ground, turns and steers its wheels, and lets each side's suspension rock. */
  private poseRover(dt: number): void {
    const { x, z } = this.roverPos;
    const sin = Math.sin(this.roverYaw), cos = Math.cos(this.roverYaw);
    // Ground under a point given in the rover's frame. The elevation model has 4 m cells, so small
    // bumps are added to stand in for the stones and ripples it cannot show.
    const ground = (lx: number, lz: number) => {
      const wx = x + cos * lx - sin * lz, wz = z + sin * lx + cos * lz;
      return this.world.heightAt(wx, wz) + bump(wx, wz);
    };
    let y: number, pitch: number, roll: number;
    const sidePitch = [0, 0];
    if (this.wheels.length === 6) {
      // Each side settles on its own three wheels. The body takes the average of the two sides,
      // which is what the differential on a rocker-bogie rover does.
      let sum = 0;
      const mean = [0, 0];
      for (let s = 0; s < 2; s++) {
        const ws = this.wheels.filter((w) => (w.x > 0 ? 1 : 0) === s).sort((a, b) => a.z - b.z);
        const h = ws.map((w) => ground(w.x, w.z));
        sidePitch[s] = Math.atan2(h[0] - h[2], ws[2].z - ws[0].z);
        mean[s] = (h[0] + h[1] + h[2]) / 3;
        sum += mean[s];
      }
      const zMid = this.rockers[0].z;
      pitch = (sidePitch[0] + sidePitch[1]) / 2;
      roll = Math.atan2(mean[1] - mean[0], Math.abs(this.rockers[1].group.position.x - this.rockers[0].group.position.x));
      y = sum / 2 + Math.tan(pitch) * zMid;
    } else {
      y = this.world.heightAt(x, z);
      pitch = Math.atan2(ground(0, -1.3) - ground(0, 1.3), 2.6);
      roll = Math.atan2(ground(1.2, 0) - ground(-1.2, 0), 2.4);
    }
    const p = this.roverPose ?? (this.roverPose = { y, pitch, roll });
    const k = Math.min(1, dt * 9);
    p.y += (y - p.y) * k;
    p.pitch += (pitch - p.pitch) * k;
    p.roll += (roll - p.roll) * k;
    this.rover.position.set(x, p.y, z);
    this.rover.rotation.set(p.pitch, -this.roverYaw, -p.roll, "YXZ");
    for (const r of this.rockers) {
      const want = sidePitch[r.side > 0 ? 1 : 0] - p.pitch;
      r.group.rotation.x += (want - r.group.rotation.x) * k;
    }

    // Each wheel rolls at the speed of the ground passing under it, so the outer wheels turn faster
    // in a corner and the two sides counter-rotate in a turn on the spot. Corner wheels steer.
    for (const w of this.wheels) {
      const vf = this.roverV - this.roverW * w.x; // forward
      const vr = -this.roverW * w.z; // to the right
      let roll = vf;
      if (w.steers) {
        const speed = Math.hypot(vf, vr);
        let want = speed > 0.03 ? Math.atan2(-vr, vf) : this.roverMoving ? w.steer : 0;
        let dir = 1;
        if (want > Math.PI / 2) { want -= Math.PI; dir = -1; }
        else if (want < -Math.PI / 2) { want += Math.PI; dir = -1; }
        w.steer += Math.max(-2.5 * dt, Math.min(2.5 * dt, want - w.steer));
        w.pivot.rotation.y = w.steer;
        roll = speed * dir;
      }
      w.spin.rotation.x -= (roll * dt) / this.wheelRadius;
    }
  }

  /**
   * NASA's rover model is static: all six wheels are one mesh and the suspension another.
   * This cuts the wheels apart so each can spin and steer, and splits the suspension into a left
   * and a right half that rock separately. Geometry is regrouped, not altered.
   */
  private rigRover(): void {
    this.rover.updateMatrixWorld(true);
    const toRover = this.rover.matrixWorld.clone().invert();
    const wheelNode = this.rover.getObjectByName("Wheels_objs");
    const suspNode = this.rover.getObjectByName("suspension");
    if (!wheelNode || !suspNode) return;

    type Part = { geo: THREE.BufferGeometry; mat: THREE.Material | THREE.Material[] };
    /** Sorts every triangle of a node into buckets by where its centre lies in the rover's frame. */
    const split = (node: THREE.Object3D, bucketOf: (x: number, y: number, z: number) => string): Map<string, Part[]> => {
      const out = new Map<string, Part[]>();
      node.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
        g.applyMatrix4(m.matrixWorld.clone().premultiply(toRover));
        const pos = g.getAttribute("position");
        const tris = new Map<string, number[]>();
        for (let t = 0; t < pos.count; t += 3) {
          const key = bucketOf(
            (pos.getX(t) + pos.getX(t + 1) + pos.getX(t + 2)) / 3,
            (pos.getY(t) + pos.getY(t + 1) + pos.getY(t + 2)) / 3,
            (pos.getZ(t) + pos.getZ(t + 1) + pos.getZ(t + 2)) / 3,
          );
          let list = tris.get(key);
          if (!list) tris.set(key, (list = []));
          list.push(t);
        }
        for (const [key, list] of tris) {
          const geo = new THREE.BufferGeometry();
          for (const name of Object.keys(g.attributes)) {
            const src = g.getAttribute(name) as THREE.BufferAttribute;
            const n = src.itemSize;
            const dst = new THREE.BufferAttribute(new (src.array.constructor as new (len: number) => THREE.TypedArray)(list.length * 3 * n), n, src.normalized);
            list.forEach((t, i) => {
              for (let v = 0; v < 3; v++) for (let c = 0; c < n; c++) dst.setComponent(i * 3 + v, c, src.getComponent(t + v, c));
            });
            geo.setAttribute(name, dst);
          }
          let parts = out.get(key);
          if (!parts) out.set(key, (parts = []));
          parts.push({ geo, mat: m.material });
        }
        g.dispose();
      });
      return out;
    };
    const addParts = (to: THREE.Object3D, parts: Part[], shift: THREE.Vector3) => {
      for (const part of parts) {
        part.geo.translate(-shift.x, -shift.y, -shift.z);
        to.add(new THREE.Mesh(part.geo, part.mat));
        this.cleanup.push(() => part.geo.dispose());
      }
    };

    // Measured on the model in the rover's frame: wheel rows sit at about z = -0.6, 0.4 and 1.2.
    const wheelParts = split(wheelNode, (x, _y, z) => `${x < 0 ? "L" : "R"}${z < -0.1 ? 0 : z < 0.8 ? 1 : 2}`);
    if (wheelParts.size !== 6) return; // not the model we measured; leave it in one piece
    const boxes = new Map<string, THREE.Box3>();
    for (const [key, parts] of wheelParts) {
      const box = new THREE.Box3();
      for (const part of parts) { part.geo.computeBoundingBox(); box.union(part.geo.boundingBox!); }
      boxes.set(key, box);
    }
    const zMid = [...boxes.values()].reduce((a, b) => a + (b.min.z + b.max.z) / 2, 0) / 6;
    // The differential bar across the middle stays with the body; the rest goes with its side.
    const suspParts = split(suspNode, (x) => (Math.abs(x) < 0.3 ? "M" : x < 0 ? "L" : "R"));
    addParts(this.rover, suspParts.get("M") ?? [], new THREE.Vector3());

    let radius = 0;
    for (const side of [-1, 1]) {
      const tag = side < 0 ? "L" : "R";
      const origin = new THREE.Vector3(side * 0.65, 0.7, zMid); // where the rocker meets the body
      const rocker = new THREE.Group();
      rocker.position.copy(origin);
      addParts(rocker, suspParts.get(tag) ?? [], origin);
      for (let row = 0; row < 3; row++) {
        const box = boxes.get(tag + row)!;
        const r = (box.max.z - box.min.z) / 2;
        radius += r / 6;
        const axle = new THREE.Vector3((box.min.x + box.max.x) / 2, box.min.y + r, (box.min.z + box.max.z) / 2);
        const pivot = new THREE.Group(), spin = new THREE.Group();
        pivot.position.copy(axle).sub(origin);
        pivot.add(spin);
        addParts(spin, wheelParts.get(tag + row)!, axle);
        rocker.add(pivot);
        this.wheels.push({ pivot, spin, x: axle.x, z: axle.z, steers: row !== 1, steer: 0 });
      }
      this.rover.add(rocker);
      this.rockers.push({ group: rocker, side, z: zMid });
    }
    this.wheelRadius = radius;
    for (const node of [wheelNode, suspNode]) {
      node.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
      node.removeFromParent();
    }
  }

  /** E key: plug into the rover for oxygen and battery, or unplug. */
  interact(): void {
    if (this.docked) {
      this.docked = false;
      return this.sayRover("Suit unplugged.");
    }
    if (this.roverDist() > DOCK_RANGE) return this.sayRover(`I am ${Math.round(this.roverDist())} m away. Get within ${Math.round(DOCK_RANGE)} m to plug in, or order me to come here.`, "info");
    this.docked = true;
    if (this.roverMode !== "rescue") this.roverMode = "hold";
    this.sayRover("Suit plugged in. Recharging oxygen and battery.");
  }

  orderRover(mode: "follow" | "hold" | "come"): void {
    this.docked = false;
    if (mode === "hold") {
      this.roverMode = "hold";
      return this.sayRover("Parked here.");
    }
    if (mode === "come") {
      this.roverGoal = { x: this.pos.x + Math.sin(this.yaw) * 4, z: this.pos.z - Math.cos(this.yaw) * 4 };
      this.roverMode = "goto";
      this.roverArrived = false;
      this.roverPath = [];
      return this.sayRover(`Driving to you, ${Math.round(this.roverDist())} m. About ${Math.ceil(this.roverDist() / ROVER_SPEED)} s.`, "info");
    }
    this.roverMode = "follow";
    this.sayRover(`Following, ${ROVER_FOLLOW_GAP} m behind you.`);
  }

  sendRover(x: number, z: number, label?: string): void {
    if (!this.world.inBounds(x, z, 20)) return this.sayRover("That point is outside the mapped site.", "warn");
    if (this.world.slopeAt(x, z) > MAX_SLOPE_DEG) return this.sayRover(`That point is on a ${this.world.slopeAt(x, z).toFixed(0)}° slope, too steep to park on.`, "warn");
    this.docked = false;
    this.roverGoal = { x, z };
    this.roverMode = "goto";
    this.roverArrived = false;
    this.roverPath = [];
    const d = Math.hypot(x - this.roverPos.x, z - this.roverPos.z);
    this.sayRover(`Driving to ${label ?? "the marked point"}, ${Math.round(d)} m in a straight line.`, "info");
  }

  private band(): Band {
    const k = this.doseRate / this.baseline;
    return k < 1.2 ? "green" : k < 1.5 ? "amber" : "red";
  }

  private advice(): string {
    const found = this.hazards.filter((h) => h.found).length;
    if (this.phase === "scout") return "Hold at base. Scout pass in progress.";
    if (this.phase === "sheltered") return this.band() === "green" ? "Rate back under 1.2x baseline. Clear to return to base." : "Hold in shelter. Rate still elevated.";
    if (this.phase === "storm") return "Abort EVA. Follow the red route to shelter.";
    if (this.phase === "arrived") return "Science stop reached. Watch your oxygen margin.";
    if ((found / Math.max(1, this.initialRouteLen)) * 100 > 1) return "High uncertainty: more than one change per 100 m. Leave this area.";
    return found ? `Route updated around ${found} changes. Continue to the science stop.` : "Route clear. Continue to the science stop.";
  }

  private snapshot(): HudState {
    const tgt = this.target();
    const dx = tgt.x - this.pos.x, dz = tgt.z - this.pos.z;
    const found = this.hazards.filter((h) => h.found).length;
    const b = this.meta.bounds_lonlat;
    const left = Math.max(0, pathLength(this.route) - progressAlong(this.route, { x: this.pos.x, z: this.pos.z }));
    return {
      view: this.view,
      phase: this.phase,
      heading: ((this.yaw * 180) / Math.PI + 3600) % 360,
      objective: this.phase === "storm" || this.phase === "sheltered" ? (this.shelter?.label ?? "Shelter") : GOAL.label,
      objectiveDist: Math.hypot(dx, dz),
      objectiveBearing: ((Math.atan2(dx, -dz) * 180) / Math.PI + 360) % 360,
      missionMin: (this.realT * CLOCK_RATE) / 60,
      doseRate: this.doseRate,
      baseline: this.baseline,
      band: this.band(),
      evaDose: this.evaDose,
      peakRate: this.peakRate,
      doseHistory: this.doseHistory,
      etaShelterS: this.phase === "storm" ? left / SPRINT : null,
      hr: this.hr,
      spo2: 98,
      o2: this.o2,
      battery: this.battery,
      suitKpa: 29.6,
      speed: this.speed,
      slope: this.world.slopeAt(this.pos.x, this.pos.z),
      sky: this.world.skyAt(this.pos.x, this.pos.z),
      elevation: this.world.elevation(this.pos.x, this.pos.z),
      lon: b.west + ((this.pos.x + HALF) / SITE_M) * (b.east - b.west),
      lat: b.north - ((this.pos.z + HALF) / SITE_M) * (b.north - b.south),
      log: this.log.slice(-6),
      hazardsFound: found,
      hazardsTotal: this.hazards.length,
      uncertainty: (found / Math.max(1, this.initialRouteLen)) * 100,
      advice: this.advice(),
      autopilot: this.autopilot,
      sound: this.soundOn,
      roverSound: this.roverSoundOn,
      control: this.control,
      flightAlt: this.droneAlt,
      flightSpeed: this.droneVel.length(),
      flightClimb: this.droneVel.y,
      droneMode: this.droneMode,
      roverMode: this.roverMode,
      roverDist: this.roverDist(),
      roverMoving: this.roverMoving,
      canDock: this.roverDist() <= DOCK_RANGE,
      docked: this.docked,
      droneDist: Math.hypot(this.drone.position.x - this.pos.x, this.drone.position.z - this.pos.z),
      mapExpanded: this.mapExpanded,
      locked: this.locked,
      stormSource: this.stormSource,
      routeLeft: left,
    };
  }

  // --- rendering ------------------------------------------------------------

  private render(dt: number): void {
    const cam = this.camera;
    // The camera follows whoever has the controls: the astronaut, the rover's mast, or SuperJar.
    const remote = this.control !== "astronaut";
    const yaw = remote ? this.rcYaw : this.yaw, pitch = remote ? this.rcPitch : this.pitch;
    const focus = this.control === "rover" ? this.rover.position : this.control === "superjar" ? this.drone.position : this.pos;
    const eye = this.control === "rover" ? 2.7 : this.control === "superjar" ? -0.45 : EYE;
    const chase = this.control === "rover" ? 7.5 : this.control === "superjar" ? 6 : 4.4; // third-person distance
    const head = new THREE.Vector3(focus.x, focus.y + eye, focus.z);
    const dir = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
    if (this.view === "fpv") {
      const bob = remote ? 0 : Math.sin(this.walkPhase * 2) * 0.035 * Math.min(1, this.speed / WALK);
      cam.position.copy(head).setY(head.y + bob);
      cam.lookAt(head.clone().add(dir));
      if (this.control === "superjar") cam.rotateZ(this.droneBank * 0.6); // the horizon tilts as the pilot banks
      cam.fov = this.control === "superjar" ? 82 : 74;
    } else if (this.view === "tpv") {
      const back = dir.clone().multiplyScalar(-chase);
      const want = head.clone().add(back).add(new THREE.Vector3(Math.cos(yaw) * 0.75, remote ? 1.4 : 0.75, Math.sin(yaw) * 0.75));
      want.y = Math.max(want.y, this.world.heightAt(want.x, want.z) + 0.6);
      cam.position.lerp(want, Math.min(1, dt * 12));
      // Driving remotely, aim nearer the vehicle so it sits mid-screen, clear of the panels.
      cam.lookAt(head.clone().add(dir.clone().multiplyScalar(remote ? 3 : 12)));
      cam.fov = 62;
    } else {
      const want = new THREE.Vector3(focus.x - Math.sin(yaw) * this.mapZoom * 0.35, focus.y + this.mapZoom, focus.z + Math.cos(yaw) * this.mapZoom * 0.35);
      cam.position.lerp(want, Math.min(1, dt * 5));
      cam.lookAt(focus.x, focus.y, focus.z);
      cam.fov = 50;
    }
    cam.updateProjectionMatrix();

    if (this.routeLine) this.routeLine.visible = this.view === "map";
    this.astronaut.visible = this.view !== "fpv" || remote;
    this.drone.visible = !(this.view === "fpv" && this.control === "superjar"); // do not film the inside of the drone
    this.astronaut.position.copy(this.pos);
    this.astronaut.rotation.y = -this.yaw;
    this.astronaut.scale.setScalar(this.view === "map" ? Math.max(1, this.mapZoom / 70) : 1);
    const swing = Math.sin(this.walkPhase) * 0.75 * Math.min(1, this.speed / WALK);
    this.limbs.forEach((l, i) => { l.rotation.x = (i % 2 ? -swing : swing) * (i < 2 ? 1 : -0.8); });
    if (this.suit) {
      const gait = Math.min(1, this.speed / WALK);
      this.suit.position.y = Math.abs(Math.sin(this.walkPhase)) * 0.07 * gait;
      this.suit.rotation.z = Math.sin(this.walkPhase) * 0.05 * gait;
      this.suit.rotation.x = -0.06 * gait * Math.min(2, this.speed / WALK);
    }
    if (this.rig) {
      const gait = Math.min(1, this.speed / WALK);
      const run = Math.min(1, Math.max(0, (this.speed - WALK) / (SPRINT - WALK)));
      const reach = (0.5 + run * 0.25) * gait; // thigh swing, radians
      const a = this.walkPhase, air = this.grounded ? 0 : 0.35;
      // Positive X rotation swings a limb forward (the figure faces -Z); knees only fold backward.
      this.rig.thighL.rotation.x = Math.sin(a) * reach + air;
      this.rig.thighR.rotation.x = -Math.sin(a) * reach + air;
      this.rig.shinL.rotation.x = -(0.08 + (0.75 + run * 0.4) * Math.max(0, Math.cos(a + 0.5))) * gait - air * 1.6;
      this.rig.shinR.rotation.x = -(0.08 + (0.75 + run * 0.4) * Math.max(0, -Math.cos(a + 0.5))) * gait - air * 1.6;
      this.rig.armL.rotation.x = -Math.sin(a) * 0.3 * gait;
      this.rig.armR.rotation.x = Math.sin(a) * 0.3 * gait;
    }
    if (this.routeMesh) (this.routeMesh.material as THREE.MeshBasicMaterial).opacity = 0.65 + Math.sin(this.realT * 4) * 0.25;
    (this.beacon.material as THREE.MeshBasicMaterial).opacity = 0.2 + Math.sin(this.realT * 3) * 0.07;

    // Keep the sky centred on the camera; a fixed dome falls outside the far plane near the site edges.
    this.sky?.position.copy(cam.position);
    this.renderer.render(this.scene, cam);
    this.placeMarkers();
    this.updateAudio();
  }

  private placeMarkers(): void {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    const v = new THREE.Vector3();
    for (const mk of this.markers) {
      v.copy(mk.pos);
      const dist = v.distanceTo(this.camera.position);
      v.project(this.camera);
      const on = mk.show() && v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05;
      mk.el.style.display = on ? "block" : "none";
      if (!on) continue;
      mk.el.style.transform = `translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * h}px) translate(-50%, -100%)`;
      mk.el.textContent = `${mk.text} · ${Math.round(dist)} m`;
    }
  }

  private drawMinimap(): void {
    const cv = this.minimap;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const wide = this.mapExpanded;
    const s = cv.width, range = wide ? MAP_RANGE_WIDE : 260; // metres from centre to edge
    const k = s / (range * 2);
    ctx.save();
    ctx.clearRect(0, 0, s, s);
    if (!wide) {
      ctx.beginPath();
      ctx.arc(s / 2, s / 2, s / 2, 0, Math.PI * 2);
      ctx.clip();
    }
    ctx.translate(s / 2, s / 2);
    if (!wide) ctx.rotate(-this.yaw); // small map is heading-up, expanded map is north-up
    const pxPerM = this.ortho.width / SITE_M;
    const sx = (this.pos.x + HALF - range * 1.5) * pxPerM, sz = (this.pos.z + HALF - range * 1.5) * pxPerM;
    ctx.fillStyle = "#1a130e";
    ctx.fillRect(-s, -s, s * 2, s * 2);
    ctx.filter = "sepia(1) saturate(2.2) hue-rotate(-18deg) brightness(0.9)";
    ctx.drawImage(this.ortho, sx, sz, range * 3 * pxPerM, range * 3 * pxPerM, -range * 1.5 * k, -range * 1.5 * k, range * 3 * k, range * 3 * k);
    ctx.filter = "none";
    const P = (x: number, z: number): [number, number] => [(x - this.pos.x) * k, (z - this.pos.z) * k];
    const storm = this.phase === "storm" || this.phase === "sheltered";
    const label = (text: string, x: number, y: number, color: string) => {
      if (!wide) return;
      ctx.font = "700 11px 'Courier New', monospace";
      ctx.lineWidth = 3;
      ctx.strokeStyle = "#000c";
      ctx.strokeText(text, x + 9, y + 4);
      ctx.fillStyle = color;
      ctx.fillText(text, x + 9, y + 4);
    };
    ctx.lineWidth = 3;
    ctx.strokeStyle = storm ? "#ff5a3c" : "#35e0c2";
    ctx.beginPath();
    this.route.forEach((p, i) => { const [x, y] = P(p.x, p.z); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
    ctx.stroke();
    for (const hz of this.hazards) {
      if (!hz.found) continue;
      const [x, y] = P(hz.x, hz.z);
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#ff5a3c";
      ctx.fillStyle = "#ff5a3c44";
      ctx.beginPath();
      ctx.arc(x, y, Math.max(4, hz.r * k), 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      label(hz.label, x, y, "#ff8b73");
    }
    const dot = (x: number, z: number, color: string, r = 5) => { const [a, b] = P(x, z); ctx.fillStyle = color; ctx.beginPath(); ctx.arc(a, b, r, 0, Math.PI * 2); ctx.fill(); return [a, b] as const; };
    for (const sh of this.shelters) {
      if (sh.id === "ROVER") continue; // drawn below as the rover itself
      const [a, b] = dot(sh.x, sh.z, sh === this.shelter ? "#ff5a3c" : "#f5d76e", sh === this.shelter ? 7 : 4);
      label(`${sh.id} · sky ${Math.round(sh.sky * 100)}%`, a, b, "#f5d76e");
    }
    const [ga, gb] = dot(this.goal.x, this.goal.z, "#35e0c2", 6);
    label("SCIENCE STOP", ga, gb, "#35e0c2");
    if (this.droneMode === "goto") {
      const [tx, ty] = P(this.droneTarget.x, this.droneTarget.z);
      const [qx, qy] = P(this.drone.position.x, this.drone.position.z);
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(qx, qy);
      ctx.lineTo(tx, ty);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(tx - 8, ty); ctx.lineTo(tx + 8, ty); ctx.moveTo(tx, ty - 8); ctx.lineTo(tx, ty + 8);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(tx, ty, SENSOR_RANGE * k, 0, Math.PI * 2);
      ctx.stroke();
    }
    {
      const [rx, ry] = P(this.roverPos.x, this.roverPos.z);
      ctx.fillStyle = "#f38d5a";
      ctx.strokeStyle = "#000a";
      ctx.lineWidth = 1;
      ctx.fillRect(rx - 5, ry - 5, 10, 10);
      ctx.strokeRect(rx - 5, ry - 5, 10, 10);
      label("ROVER", rx, ry, "#f38d5a");
      if (this.roverMode === "goto") {
        const [gx, gy] = P(this.roverGoal.x, this.roverGoal.z);
        ctx.strokeStyle = "#f38d5a";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.moveTo(rx, ry);
        if (this.roverPath.length) this.roverPath.forEach((p) => { const [a, b] = P(p.x, p.z); ctx.lineTo(a, b); });
        else ctx.lineTo(gx, gy);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.strokeRect(gx - 6, gy - 6, 12, 12);
      }
    }
    const [da, db] = dot(this.drone.position.x, this.drone.position.z, "#ffffff", wide ? 5 : 3.5);
    label("SUPERJAR", da, db, "#ffffff");
    ctx.restore();

    // player arrow: points up on the small map, along the heading on the north-up map
    ctx.save();
    ctx.translate(s / 2, s / 2);
    if (wide) ctx.rotate(this.yaw);
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = "#000a";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -9); ctx.lineTo(6, 7); ctx.lineTo(0, 3); ctx.lineTo(-6, 7);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    if (wide) {
      const bar = 200 * k; // 200 m scale bar
      ctx.fillStyle = "#fff";
      ctx.fillRect(16, s - 22, bar, 3);
      ctx.font = "700 11px 'Courier New', monospace";
      ctx.fillText("200 m", 16, s - 28);
      ctx.fillText("N ↑", s - 44, 22);
    }
  }

  /** Runs the simulation forward without rendering. Used by automated checks. */
  fastForward(seconds: number): HudState {
    for (let t = 0; t < seconds; t += 0.05) this.step(0.05);
    return this.snapshot();
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    if (document.pointerLockElement) document.exitPointerLock();
    this.cleanup.forEach((f) => f());
    for (const a of [this.wind, this.droneHum, this.roverSound, this.laser]) a?.pause();
    void this.audioCtx?.close();
    for (const mk of this.markers) mk.el.remove();
    this.renderer?.dispose();
    this.renderer?.domElement.remove();
  }
}

export const MAX_ROUTE_SLOPE = MAX_SLOPE_DEG;
