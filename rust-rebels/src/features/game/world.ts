// Terrain lookups and route solving on the prepared Jezero dataset.
// World frame (three.js): X = east, Z = south, Y = up. Dataset frame: x = east, y = north.

export const SITE_M = 4096;
export const GRID = 1024; // height samples per side
export const CELL = SITE_M / GRID; // 4 m
const HALF = SITE_M / 2;

export type Vec2 = { x: number; z: number };

export type TerrainMeta = {
  elevation: { min_m: number; max_m: number };
  bounds_lonlat: { west: number; south: number; east: number; north: number };
};

export class World {
  readonly heights: Float32Array; // metres above elevation.min_m, row 0 = north
  readonly sky: Uint8Array; // sky fraction * 255
  readonly minElev: number;

  constructor(heightU16: Uint16Array, sky: Uint8Array, meta: TerrainMeta) {
    const { min_m, max_m } = meta.elevation;
    this.minElev = min_m;
    this.heights = new Float32Array(GRID * GRID);
    const k = (max_m - min_m) / 65535;
    for (let i = 0; i < this.heights.length; i++) this.heights[i] = heightU16[i] * k;
    this.sky = sky;
  }

  /** Bilinear terrain height (world Y) at a world position. */
  heightAt(x: number, z: number): number {
    const fc = Math.min(GRID - 1.001, Math.max(0, (x + HALF) / CELL - 0.5));
    const fr = Math.min(GRID - 1.001, Math.max(0, (z + HALF) / CELL - 0.5));
    const c = Math.floor(fc), r = Math.floor(fr);
    const tx = fc - c, tz = fr - r;
    const h = this.heights, i = r * GRID + c;
    return (h[i] * (1 - tx) + h[i + 1] * tx) * (1 - tz) + (h[i + GRID] * (1 - tx) + h[i + GRID + 1] * tx) * tz;
  }

  /** Slope in degrees over a 4 m baseline. */
  slopeAt(x: number, z: number): number {
    const dx = this.heightAt(x + 2, z) - this.heightAt(x - 2, z);
    const dz = this.heightAt(x, z + 2) - this.heightAt(x, z - 2);
    return (Math.atan(Math.hypot(dx, dz) / 4) * 180) / Math.PI;
  }

  /** Fraction of sky visible, 0..1 (derived from the HiRISE DTM). */
  skyAt(x: number, z: number): number {
    const c = Math.min(GRID - 1, Math.max(0, Math.floor((x + HALF) / CELL)));
    const r = Math.min(GRID - 1, Math.max(0, Math.floor((z + HALF) / CELL)));
    return this.sky[r * GRID + c] / 255;
  }

  inBounds(x: number, z: number, margin = 6): boolean {
    return Math.abs(x) < HALF - margin && Math.abs(z) < HALF - margin;
  }

  elevation(x: number, z: number): number {
    return this.minElev + this.heightAt(x, z);
  }
}

// --- A* route solver on a 16 m grid -----------------------------------------

const N = 256;
const STEP = SITE_M / N;
export const MAX_SLOPE_DEG = 25;

export type Blocker = { x: number; z: number; r: number };

function toCell(v: number): number {
  return Math.min(N - 1, Math.max(0, Math.floor((v + HALF) / STEP)));
}
function toWorld(c: number): number {
  return (c + 0.5) * STEP - HALF;
}

/** Returns a path of world points from a to b, or null when none exists. */
export function solveRoute(world: World, a: Vec2, b: Vec2, blockers: Blocker[]): Vec2[] | null {
  const slope = new Float32Array(N * N);
  const blocked = new Uint8Array(N * N);
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const s = world.slopeAt(toWorld(c), toWorld(r));
      slope[r * N + c] = s;
      if (s > MAX_SLOPE_DEG) blocked[r * N + c] = 1;
    }
  }
  for (const k of blockers) {
    const rc = Math.ceil(k.r / STEP);
    const c0 = toCell(k.x), r0 = toCell(k.z);
    for (let r = r0 - rc; r <= r0 + rc; r++) {
      for (let c = c0 - rc; c <= c0 + rc; c++) {
        if (r < 0 || c < 0 || r >= N || c >= N) continue;
        if (Math.hypot(toWorld(c) - k.x, toWorld(r) - k.z) <= k.r) blocked[r * N + c] = 1;
      }
    }
  }
  const start = toCell(a.z) * N + toCell(a.x);
  const goal = toCell(b.z) * N + toCell(b.x);
  blocked[start] = 0;
  blocked[goal] = 0;

  const g = new Float32Array(N * N).fill(Infinity);
  const from = new Int32Array(N * N).fill(-1);
  const closed = new Uint8Array(N * N);
  const heap: number[] = []; // binary heap of cell ids ordered by f
  const f = new Float32Array(N * N).fill(Infinity);
  const gc = goal % N, gr = Math.floor(goal / N);
  const hCost = (i: number) => Math.hypot((i % N) - gc, Math.floor(i / N) - gr) * STEP;
  const push = (i: number) => {
    heap.push(i);
    let k = heap.length - 1;
    while (k > 0) {
      const p = (k - 1) >> 1;
      if (f[heap[p]] <= f[heap[k]]) break;
      [heap[p], heap[k]] = [heap[k], heap[p]];
      k = p;
    }
  };
  const pop = () => {
    const top = heap[0];
    const last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      let k = 0;
      for (;;) {
        const l = 2 * k + 1, r = l + 1;
        let m = k;
        if (l < heap.length && f[heap[l]] < f[heap[m]]) m = l;
        if (r < heap.length && f[heap[r]] < f[heap[m]]) m = r;
        if (m === k) break;
        [heap[m], heap[k]] = [heap[k], heap[m]];
        k = m;
      }
    }
    return top;
  };

  g[start] = 0;
  f[start] = hCost(start);
  push(start);
  while (heap.length) {
    const cur = pop();
    if (cur === goal) break;
    if (closed[cur]) continue;
    closed[cur] = 1;
    const cc = cur % N, cr = Math.floor(cur / N);
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const nr = cr + dr, nc = cc + dc;
        if (nr < 0 || nc < 0 || nr >= N || nc >= N) continue;
        const ni = nr * N + nc;
        if (blocked[ni] || closed[ni]) continue;
        const s = slope[ni] / 12;
        const cost = g[cur] + Math.hypot(dr, dc) * STEP * (1 + s * s);
        if (cost < g[ni]) {
          g[ni] = cost;
          f[ni] = cost + hCost(ni);
          from[ni] = cur;
          push(ni);
        }
      }
    }
  }
  if (from[goal] === -1 && goal !== start) return null;

  const cells: number[] = [];
  for (let i = goal; i !== -1; i = from[i]) cells.push(i);
  cells.reverse();
  const pts: Vec2[] = cells.map((i) => ({ x: toWorld(i % N), z: toWorld(Math.floor(i / N)) }));
  pts[0] = { ...a };
  pts[pts.length - 1] = { ...b };
  // Two smoothing passes take the stair-steps out of the grid path.
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 1; i < pts.length - 1; i++) {
      pts[i] = { x: (pts[i - 1].x + 2 * pts[i].x + pts[i + 1].x) / 4, z: (pts[i - 1].z + 2 * pts[i].z + pts[i + 1].z) / 4 };
    }
  }
  return pts;
}

export function pathLength(p: Vec2[]): number {
  let d = 0;
  for (let i = 1; i < p.length; i++) d += Math.hypot(p[i].x - p[i - 1].x, p[i].z - p[i - 1].z);
  return d;
}

/** Point at a distance along a path, plus the distance of the closest point to `near`. */
export function pointAlong(p: Vec2[], dist: number): Vec2 {
  let left = dist;
  for (let i = 1; i < p.length; i++) {
    const seg = Math.hypot(p[i].x - p[i - 1].x, p[i].z - p[i - 1].z);
    if (left <= seg && seg > 0) {
      const t = left / seg;
      return { x: p[i - 1].x + (p[i].x - p[i - 1].x) * t, z: p[i - 1].z + (p[i].z - p[i - 1].z) * t };
    }
    left -= seg;
  }
  return p[p.length - 1];
}

export function progressAlong(p: Vec2[], pos: Vec2): number {
  let best = Infinity, bestD = 0, acc = 0;
  for (let i = 1; i < p.length; i++) {
    const ax = p[i - 1].x, az = p[i - 1].z, bx = p[i].x - ax, bz = p[i].z - az;
    const len2 = bx * bx + bz * bz || 1;
    const t = Math.min(1, Math.max(0, ((pos.x - ax) * bx + (pos.z - az) * bz) / len2));
    const d = Math.hypot(pos.x - (ax + bx * t), pos.z - (az + bz * t));
    const seg = Math.sqrt(len2);
    if (d < best) {
      best = d;
      bestD = acc + seg * t;
    }
    acc += seg;
  }
  return bestD;
}
