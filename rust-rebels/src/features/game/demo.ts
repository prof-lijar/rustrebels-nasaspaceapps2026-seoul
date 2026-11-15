// The 30-second demo: a scripted film, not the simulation. Everything on screen is placed by
// this file as a function of time: where the astronaut, SuperJar and the rover are, where the
// camera sits, and which caption is showing. The real game rules do not run while it plays.

import LINES from "./demo-lines.json";
import { pathLength, pointAlong, progressAlong, type Vec2 } from "./world";

export const DEMO_LENGTH = 30;

export type DemoSpeaker = "SUPERJAR" | "ASTRONAUT" | "NARRATOR";

/** What the page shows over the picture at a given moment. */
export interface DemoUi {
  shot: number;
  second: number;
  slate: [string, string] | null;
  line: { id: string; who: DemoSpeaker; text: string; say: string } | null;
  ping: string | null;
  storm: boolean;
  end: boolean;
}

type P3 = { x: number; y: number; z: number };

/** Where everything is at a given moment. Heights are above the ground under that point unless noted. */
export interface DemoFrame {
  shot: number;
  astro: { x: number; z: number; yaw: number; speed: number };
  drone: { x: number; z: number; up: number; yaw: number; pitch: number; roll: number };
  rover: { x: number; z: number; yaw: number; speed: number };
  /** Camera and target as world points; `y` is height above the ground under the astronaut's stage. */
  cam: { pos: P3; look: P3; fov: number; absolute?: boolean; wide?: boolean }; // wide: uses the whole screen, not just the part clear of the crew panel
  storm: number; // 0 clear sky to 1 full storm
  scan: number | null; // SuperJar's lidar sweep over the scan target: 0 just begun to 1 complete
  tag: boolean; // SuperJar's name tag
  ui: DemoUi;
}

export interface DemoStage {
  route: Vec2[];
  base: Vec2;
  heightAt(x: number, z: number): number;
  scanAt: Vec2; // the object SuperJar is sent to scan: the first thing on the route that the base map does not show
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const ease = (v: number) => { const t = clamp01(v); return t * t * (3 - 2 * t); };
const easeOut = (v: number) => 1 - Math.pow(1 - clamp01(v), 3);
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
/** Heading that faces from one point to another: 0 is north (−z), a quarter turn is east. */
const facing = (fx: number, fz: number, tx: number, tz: number) => Math.atan2(tx - fx, -(tz - fz));

// Shot boundaries, in seconds.
const T = { meet: 3.2, scout: 7.6, walk: 16.4, storm: 20.6, safe: 25.3, end: 29 };
// Inside the scout shot: SuperJar flies out, scans, then comes back to report.
const SCAN = { from: 9.6, back: 12.8, sweep: 2.3 };
const WALK_PACE = 0.95; // m/s, the game's own Mars walking pace

export function createDemo(stage: DemoStage): (t: number) => DemoFrame {
  const len = pathLength(stage.route);
  // The stage: a spot a few metres up the route from base. O is where the film ends, with all three together.
  const O = pointAlong(stage.route, Math.min(len, 11));
  const at = (dx: number, dz: number): Vec2 => ({ x: O.x + dx, z: O.z + dz });
  const S = at(-5.3, 8.4); // where the astronaut starts
  const dir = { x: -0.754, z: -0.657 }; // walking direction
  const walkLen = WALK_PACE * (T.storm - T.walk);
  const E: Vec2 = { x: S.x + dir.x * walkLen, z: S.z + dir.z * walkLen }; // where the walk ends and the run for shelter begins
  const perp = { x: -0.66, z: 0.75 }; // to the walker's sunlit side
  const runLen = Math.hypot(O.x - E.x, O.z - E.z);
  const run = { x: (O.x - E.x) / runLen, z: (O.z - E.z) / runLen };
  const walkYaw = facing(S.x, S.z, E.x, E.z), runYaw = facing(E.x, E.z, O.x, O.z);
  const roverHome = at(3.7, -1.2), droneHome = at(-1.7, 0.9);
  const roverFar = at(3.7 + 15.5, -1.2 - 8);
  const scoutFrom = progressAlong(stage.route, S);
  // The scan: B is the object, u points at it from the astronaut, M is where SuperJar hovers to report.
  const B = stage.scanAt, scanTo = progressAlong(stage.route, B);
  const far = Math.hypot(B.x - S.x, B.z - S.z) || 1;
  const u = { x: (B.x - S.x) / far, z: (B.z - S.z) / far };
  const M: Vec2 = { x: S.x + u.x * 3.2, z: S.z + u.z * 3.2 };
  const scanYaw = facing(S.x, S.z, B.x, B.z);
  const SCAN_UP = 9.5; // hover height over the object, m

  const lines = LINES as { id: string; from: number; to: number; who: DemoSpeaker; text: string; say?: string; onScreen?: string; onScreenDetail?: string }[];
  const finalLine = lines[lines.length - 1];
  const endAt = finalLine?.who === "NARRATOR" ? finalLine.from : T.end;

  return (time: number): DemoFrame => {
    const t = Math.max(0, time);
    const shot = t < T.meet ? 0 : t < T.scout ? 1 : t < T.walk ? 2 : t < T.storm ? 3 : t < T.safe ? 4 : 5;
    const hover = Math.sin(t * 2.1) * 0.07;
    let astro: DemoFrame["astro"], drone: DemoFrame["drone"], rover: DemoFrame["rover"], cam: DemoFrame["cam"];
    let storm = 0, tag = false, ping: string | null = null, scan: number | null = null;
    let slate: [string, string] | null = null;

    const parkedRover = { x: S.x - dir.x * 7 - perp.x * 4.5, z: S.z - dir.z * 7 - perp.z * 4.5, yaw: walkYaw + 0.35, speed: 0 };
    const meetDrone = { x: S.x + dir.x * 3.2, z: S.z + dir.z * 3.2 };

    if (shot === 0) {
      // Arrival: the camera comes down out of the sky to the astronaut while SuperJar descends to meet them.
      const k = easeOut(t / T.meet);
      astro = { x: S.x, z: S.z, yaw: walkYaw, speed: 0 };
      rover = parkedRover;
      drone = { ...meetDrone, up: mix(13, 1.75, ease((t - 0.8) / 3.1)) + hover, yaw: walkYaw + Math.PI, pitch: 0, roll: 0 };
      cam = {
        pos: { x: S.x - dir.x * mix(78, 8.5, k) + perp.x * mix(26, 3.4, k), y: mix(44, 2.6, k), z: S.z - dir.z * mix(78, 8.5, k) + perp.z * mix(26, 3.4, k) },
        look: { x: S.x + dir.x * 1.2, y: 1.5, z: S.z + dir.z * 1.2 },
        fov: 48,
      };
      slate = ["JEZERO CRATER · MARS", "REAL NASA TERRAIN · 18.46°N 77.41°E"];
    } else if (shot === 2 && t >= SCAN.back) {
      // Report: SuperJar flies back from the object and stops in front of the astronaut to say what it found.
      const k = easeOut((t - SCAN.back) / 2.4);
      astro = { x: S.x, z: S.z, yaw: scanYaw, speed: 0 };
      rover = parkedRover;
      drone = { x: mix(B.x, M.x, k), z: mix(B.z, M.z, k), up: mix(SCAN_UP, 1.75, k) + hover, yaw: scanYaw + Math.PI, pitch: 0.3 * (1 - k), roll: Math.sin(t * 1.3) * 0.04 };
      cam = {
        pos: { x: S.x - u.x * 2.3 - u.z * 0.95, y: 1.8, z: S.z - u.z * 2.3 + u.x * 0.95 },
        look: { x: drone.x, y: drone.up, z: drone.z },
        fov: mix(46, 40, k),
      };
      if (t < SCAN.back + 1.9) ping = "ROUTE UPDATED";
      slate = ["SUPERJAR REPORTS BACK", "ONE CHANGE FOUND · ROUTE MOVED AROUND IT"];
    } else if (shot === 2 && t >= SCAN.from) {
      // Scan: SuperJar holds over the object and sweeps it with lidar while the camera circles at ground level.
      const k = clamp01((t - SCAN.from) / (SCAN.back - SCAN.from));
      const ground = stage.heightAt(B.x, B.z);
      const a = Math.atan2(-u.z, -u.x) + mix(-0.75, -0.15, ease(k)); // starts on the astronaut's side of the object
      const c = { x: B.x + Math.cos(a) * 30, z: B.z + Math.sin(a) * 30 };
      astro = { x: S.x, z: S.z, yaw: scanYaw, speed: 0 };
      rover = parkedRover;
      drone = { x: B.x, z: B.z, up: SCAN_UP + hover, yaw: scanYaw + t * 0.5, pitch: 0, roll: 0 };
      cam = { pos: { x: c.x, y: Math.max(stage.heightAt(c.x, c.z), ground) + 2.4, z: c.z }, look: { x: B.x, y: ground + 3.2, z: B.z }, fov: 46, absolute: true };
      scan = clamp01((t - SCAN.from - 0.3) / SCAN.sweep);
      if (scan >= 1) ping = "NEW BOULDER · NOT ON THE BASE MAP";
      slate = ["LIDAR SCAN", "SIMULATED · 1,600 RANGE POINTS"];
    } else if (shot === 1) {
      // Meet SuperJar: over the astronaut's shoulder, pushing in on the helicopter at eye level.
      const k = ease((t - T.meet) / (T.scout - T.meet));
      astro = { x: S.x, z: S.z, yaw: walkYaw, speed: 0 };
      rover = parkedRover;
      drone = { ...meetDrone, up: 1.75 + hover, yaw: walkYaw + Math.PI + Math.sin(t * 0.9) * 0.12, pitch: 0, roll: Math.sin(t * 1.3) * 0.04 };
      cam = {
        pos: { x: S.x - dir.x * mix(1.9, 1.3, k) + perp.x * 0.85, y: 1.78, z: S.z - dir.z * mix(1.9, 1.3, k) + perp.z * 0.85 },
        look: { x: meetDrone.x, y: 1.78, z: meetDrone.z },
        fov: mix(46, 38, k),
      };
      tag = t > T.meet + 0.5;
      slate = ["SUPERJAR", "ON-DEVICE SI · RIDES THE SCOUT HELICOPTER"];
    } else if (shot === 2) {
      // Sent out: riding just behind SuperJar as it flies the route to the object, low and fast.
      const k = ease((t - T.scout) / (SCAN.from - T.scout));
      const s = mix(scoutFrom + 6, Math.max(scoutFrom + 6, scanTo - 14), k);
      const here = pointAlong(stage.route, s), ahead = pointAlong(stage.route, Math.min(len, s + 26)), behind = pointAlong(stage.route, Math.max(0, s - 5.2));
      const ground = (p: Vec2) => stage.heightAt(p.x, p.z);
      // Level flight over rolling ground: follow the average height of the stretch around the helicopter.
      const level = (ground(behind) + ground(here) + ground(pointAlong(stage.route, Math.min(len, s + 12)))) / 3;
      const yaw = facing(here.x, here.z, ahead.x, ahead.z);
      astro = { x: S.x, z: S.z, yaw: walkYaw, speed: 0 };
      rover = parkedRover;
      drone = { x: here.x, z: here.z, up: level + 6 - ground(here) + hover, yaw, pitch: 0.2, roll: Math.sin(t * 1.7) * 0.07 };
      cam = {
        pos: { x: behind.x, y: level + 7.5, z: behind.z },
        look: { x: ahead.x, y: ground(ahead) + 3.2, z: ahead.z },
        fov: 62,
        absolute: true,
        wide: true,
      };
      slate = ["SCOUT PASS", "SUPERJAR FLIES THE ROUTE FIRST"];
    } else if (shot === 3) {
      // Walk and talk: a tracking shot from the sunlit side, SuperJar at the astronaut's shoulder.
      const k = (t - T.walk) / (T.storm - T.walk);
      const a = { x: mix(S.x, E.x, k), z: mix(S.z, E.z, k) };
      astro = { x: a.x, z: a.z, yaw: walkYaw, speed: walkLen / (T.storm - T.walk) };
      rover = { x: a.x - dir.x * 9 - perp.x * -3.2, z: a.z - dir.z * 9 - perp.z * -3.2, yaw: walkYaw, speed: astro.speed };
      drone = { x: a.x - dir.x * 1.5 - perp.x * 0.5, z: a.z - dir.z * 1.5 - perp.z * 0.5, up: 2.3 + hover, yaw: walkYaw, pitch: 0.06, roll: 0 };
      cam = {
        pos: { x: a.x + dir.x * 3.5 + perp.x * 3.1, y: 1.25, z: a.z + dir.z * 3.5 + perp.z * 3.1 },
        look: { x: a.x - perp.x * 0.5, y: 1.6, z: a.z - perp.z * 0.5 },
        fov: 44,
      };
      slate = ["EVA · WALKING AT MARS PACE", "QUIET-DAY DOSE RATE · CURIOSITY RAD REPLAY"];
    } else if (shot === 4) {
      // Storm: the sky turns, the astronaut runs after SuperJar, and the rover drives in to meet them.
      const k = (t - T.storm) / (T.safe - T.storm);
      const a = { x: mix(E.x, O.x, k), z: mix(E.z, O.z, k) };
      const r = { x: mix(roverFar.x, roverHome.x, ease(k)), z: mix(roverFar.z, roverHome.z, ease(k)) };
      astro = { x: a.x, z: a.z, yaw: runYaw, speed: runLen / (T.safe - T.storm) };
      rover = { ...r, yaw: facing(roverFar.x, roverFar.z, roverHome.x, roverHome.z), speed: 3.2 };
      drone = { x: a.x + run.x * 3.4 + run.z * 0.9, z: a.z + run.z * 3.4 - run.x * 0.9, up: 2.7 + hover, yaw: runYaw, pitch: 0.22, roll: 0 };
      cam = {
        pos: { x: a.x - run.x * 5.2 - run.z * 1.7, y: 1.9, z: a.z - run.z * 5.2 + run.x * 1.7 },
        look: { x: a.x + run.x * 4, y: 1.7, z: a.z + run.z * 4 },
        fov: 50,
      };
      storm = ease((t - T.storm) / 0.9);
      slate = null; // the game's own storm banner says it
    } else {
      // Safe: all three together, the camera drifting slowly across the front of them.
      const k = ease((t - T.safe) / 9);
      const camAt = at(mix(-3.4, -1.2, k), mix(7.4, 6.3, k));
      astro = { x: O.x, z: O.z, yaw: facing(O.x, O.z, camAt.x, camAt.z), speed: 0 };
      rover = { ...roverHome, yaw: facing(roverHome.x, roverHome.z, O.x - 2.2, O.z + 6.6) + 0.5, speed: 0 };
      drone = { ...droneHome, up: 2.05 + hover, yaw: facing(droneHome.x, droneHome.z, camAt.x, camAt.z) - 0.6, pitch: 0, roll: 0 };
      cam = { pos: { x: camAt.x, y: 1.25, z: camAt.z }, look: { x: O.x + 0.4, y: 1.35, z: O.z - 0.5 }, fov: 44 };
      storm = 0.75;
      slate = t < T.end ? ["SHELTERED AT THE ROVER", "ASTRONAUT · SUPERJAR · ROVER"] : null;
    }

    const said = lines.find((l) => t >= l.from && t < l.to);
    return {
      shot, astro, drone, rover, cam, storm, tag, scan,
      ui: {
        shot,
        second: Math.min(DEMO_LENGTH, Math.floor(t)),
        slate: said?.onScreen ? [said.onScreen, said.onScreenDetail ?? ""] : slate,
        line: said ? { id: said.id, who: said.who, text: said.text, say: said.say ?? said.text } : null,
        ping,
        storm: shot === 4,
        end: t >= endAt,
      },
    };
  };
}
