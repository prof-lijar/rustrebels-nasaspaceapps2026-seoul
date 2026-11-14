// The astronaut's wardrobe. Every suit is an open model from the internet; none is modelled here.
// Three kinds of file come in, and each needs different handling to walk:
//   clips  - rigged and animated by its artist; we play the artist's walk, run and idle clips.
//   bones  - rigged (a standard humanoid skeleton) but not animated; we drive the bones.
//   static - one unjointed mesh, as NASA publishes its suits; we add a simple skeleton first.
import * as THREE from "three";
import type { GLTF, GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export type SuitId = "explorer" | "android" | "rebel" | "amar" | "stealth" | "classic" | "aces" | "emu";

export interface SuitInfo {
  id: SuitId;
  name: string;
  /** NASA: a model published by NASA of a real suit. Fancy: a game-art suit. */
  kind: "NASA" | "Fancy";
  note: string;
  credit: string;
}

export const SUITS: SuitInfo[] = [
  { id: "explorer", name: "Explorer", kind: "Fancy", note: "Detailed textured suit with its own walk and run", credit: "Astronaut in spacesuit (rigged), supplied by the team" },
  { id: "rebel", name: "Rust Rebel", kind: "Fancy", note: "Sand and orange, gold visor", credit: "Astronaut by Quaternius (CC0), recoloured" },
  { id: "amar", name: "Field Scientist", kind: "Fancy", note: "Sand and teal", credit: "Astronaut by Quaternius (CC0), recoloured" },
  { id: "stealth", name: "Night Shift", kind: "Fancy", note: "Dark armour, original colours", credit: "Astronaut by Quaternius (CC0)" },
  { id: "classic", name: "Classic EVA", kind: "Fancy", note: "White suit, gold visor, backpack", credit: "Rigged Astronaut by J-Toastie (CC BY 3.0)" },
  { id: "android", name: "Android", kind: "Fancy", note: "Robot crew member with its own walk and run", credit: "Android (rigged), supplied by the team" },
  { id: "emu", name: "NASA EMU", kind: "NASA", note: "The spacewalk suit used on the Space Station", credit: "NASA Science 3D Resources" },
  { id: "aces", name: "NASA ACES", kind: "NASA", note: "Orange launch-and-entry suit", credit: "NASA 3D Resources" },
];

export interface Gait {
  /** Walk cycle angle in radians; one full turn is two steps. */
  phase: number;
  /** Ground speed in m/s. */
  speed: number;
  grounded: boolean;
  walkSpeed: number;
  sprintSpeed: number;
}

export interface LoadedSuit {
  id: SuitId;
  root: THREE.Object3D;
  update: (g: Gait, dt: number) => void;
  dispose: () => void;
}

/** Metres of ground one full walk cycle (two steps) covers. People lengthen their stride as they speed up. */
export function strideLength(speed: number): number {
  return 1.35 + 0.38 * speed;
}

const HEIGHT = 1.9; // metres, every suit is scaled to this

type Palette = Record<string, { color: number; emissive?: number; metalness?: number; roughness?: number }>;
const REBEL: Palette = {
  SciFi_Main: { color: 0xd9c2a0 },
  SciFi_MainDark: { color: 0xb69a76 },
  SciFi_Light: { color: 0xf3eee4 },
  SciFi_Light_Accent: { color: 0xe2622a },
  Grey: { color: 0xd99a2b, emissive: 0x5a3508, metalness: 0.6, roughness: 0.2 },
};
const AMAR: Palette = { ...REBEL, SciFi_Light_Accent: { color: 0x1f8f86 } };

/** Where the leg and arm joints sit on an unjointed suit, in metres on the model at 1.9 m, facing -Z. */
interface StaticRig {
  file: string;
  /** Turn about Y that makes the model face -Z. */
  yaw: number;
  /** Below the first height a vertex belongs wholly to a leg; above the second, wholly to the body. */
  legBlend: [number, number];
  kneeBlend: [number, number];
  hip: [number, number, number];
  kneeDrop: number;
  /** Where the body's centre line sits; an arm held out to one side shifts the model off centre. */
  cx: number;
  /** A vertex counts as arm when it is further out than this from the centre line... */
  armOut: [number, number];
  /** ...and between these heights... */
  armLow: [number, number];
  armHigh: [number, number];
  /** Or when it reaches this far forward of the body (hands held in front), off the centre line, between two heights. */
  armAhead: [number, number];
  aheadOut: [number, number];
  aheadLow: [number, number];
  aheadHigh: [number, number];
  shoulder: [number, number, number];
  /**
   * Animate the arms too. Works where NASA posed the arms hanging clear of the body; where they
   * are resting on equipment (EMU) they are left as modelled.
   */
  swingArms?: boolean;
}

// Measured on each model with measureSuit() below.
const STATIC: Partial<Record<SuitId, StaticRig>> = {
  emu: {
    file: "emu_suit.glb", yaw: 0, cx: 0.03,
    legBlend: [0.55, 0.68], kneeBlend: [0.3, 0.4], hip: [0.13, 0.72, -0.18], kneeDrop: 0.34,
    armOut: [0.3, 0.36], armLow: [0.8, 0.9], armHigh: [1.4, 1.5],
    armAhead: [0.36, 0.44], aheadOut: [0.08, 0.14], aheadLow: [0.8, 0.9], aheadHigh: [1.25, 1.33],
    shoulder: [0.3, 1.36, -0.1],
  },
  aces: {
    file: "aces_suit.glb", yaw: 0, cx: 0, swingArms: true,
    legBlend: [0.5, 0.62], kneeBlend: [0.27, 0.37], hip: [0.13, 0.62, 0.03], kneeDrop: 0.3,
    armOut: [0.24, 0.28], armLow: [0.72, 0.8], armHigh: [1.38, 1.46], // the hands hang below the hips
    armAhead: [0.12, 0.17], aheadOut: [0.1, 0.16], aheadLow: [0.72, 0.8], aheadHigh: [1.3, 1.38],
    shoulder: [0.27, 1.36, 0.05],
  },
};

// --- shared helpers -----------------------------------------------------------

/** Scales a model to standing height, puts its soles on y = 0 and turns it to face -Z. */
function stand(model: THREE.Object3D, yaw: number): THREE.Group {
  const turned = new THREE.Group();
  turned.add(model);
  turned.rotation.y = yaw;
  turned.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(turned);
  const k = HEIGHT / (box.max.y - box.min.y);
  const wrap = new THREE.Group();
  wrap.add(turned);
  turned.scale.setScalar(k);
  turned.position.set(-((box.min.x + box.max.x) / 2) * k, -box.min.y * k, -((box.min.z + box.max.z) / 2) * k);
  wrap.updateMatrixWorld(true);
  return wrap;
}

function disposeTree(root: THREE.Object3D): void {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    m.geometry.dispose();
    for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
      for (const v of Object.values(mat)) if (v instanceof THREE.Texture) v.dispose();
      mat.dispose();
    }
  });
}

/**
 * NASA's ACES file marks every material as see-through, which three.js would draw with
 * an extra full-scene pass and which shows the empty helmet. Draw them solid, in their own colours.
 */
function solidMaterials(root: THREE.Object3D): void {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
      const p = mat as THREE.MeshPhysicalMaterial;
      // Fully metallic surfaces come out black with no reflection map.
      if (!p.metalnessMap && p.metalness > 0.5) p.metalness = 0.1;
      if (!(p.transmission > 0)) continue;
      p.transmission = 0;
      p.transparent = false;
      p.opacity = 1;
      p.metalness = Math.min(p.metalness, 0.1);
    }
  });
}

const smooth = (t: number) => { const c = Math.max(0, Math.min(1, t)); return c * c * (3 - 2 * c); };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * One joint we can turn. Turns are given about the astronaut's own axes (X to their right, Y up,
 * Z behind them) whatever way the bone itself happens to be oriented in the file.
 */
class Joint {
  private rest: THREE.Quaternion;
  private frame: THREE.Quaternion;
  private inv: THREE.Quaternion;
  constructor(readonly bone: THREE.Object3D, space: THREE.Object3D) {
    this.rest = bone.quaternion.clone();
    const spaceQ = space.getWorldQuaternion(new THREE.Quaternion()).invert();
    this.frame = spaceQ.multiply(bone.getWorldQuaternion(new THREE.Quaternion()));
    this.inv = this.frame.clone().invert();
  }
  /** Angles in radians: x swings forward, y turns, z leans to the side. Applied z first, then y, then x. */
  turn(x: number, y = 0, z = 0): void {
    E.set(x, y, z, "XYZ");
    Q.setFromEuler(E);
    this.bone.quaternion.copy(this.rest).multiply(T.copy(this.inv).multiply(Q).multiply(this.frame));
  }
}
const E = new THREE.Euler(), Q = new THREE.Quaternion(), T = new THREE.Quaternion();

interface Skeleton {
  /** Index 0 is the astronaut's left (-X), 1 their right. */
  hip: Joint[];
  knee: Joint[];
  foot?: Joint[];
  arm: Joint[];
  elbow?: Joint[];
  spine?: Joint;
  /** Radians each arm must drop to hang at the side (a T-pose needs about 1.25; a standing pose 0). */
  armDrop: number;
  thigh: number;
  shin: number;
  /** Moved up and down so the standing foot stays on the ground. */
  lift: THREE.Object3D;
}

/**
 * Ordinary human gait on a skeleton: the knee folds as the foot leaves the ground and gives a
 * little on landing, the foot lands heel first, the body rides up over the standing leg, and the
 * arms swing against the legs.
 */
function walk(s: Skeleton, g: Gait): void {
  const amp = Math.min(1, g.speed / 0.9);
  const run = smooth((g.speed - g.walkSpeed * 1.2) / (g.sprintSpeed * 0.8 - g.walkSpeed * 1.2));
  const swing = lerp(0.44, 0.78, run) * amp;
  const air = g.grounded ? 0 : 1;
  let reach = 0;
  for (let i = 0; i < 2; i++) {
    let p = (g.phase + (i ? Math.PI : 0)) % (Math.PI * 2);
    if (p > Math.PI) p -= Math.PI * 2;
    if (p <= -Math.PI) p += Math.PI * 2;
    const hip = Math.sin(p) * swing + lerp(0.02, 0.12, run) * amp + air * 0.45;
    const fold = Math.pow(Math.max(0, Math.cos(p + 0.45)), 1.3) * lerp(1.0, 1.7, run);
    const give = Math.pow(Math.max(0, Math.cos(p - Math.PI / 2 - 0.5)), 4) * lerp(0.24, 0.48, run);
    const knee = -(0.03 + (fold + give) * amp) - air * 0.9;
    let foot: number;
    if (Math.abs(p) <= Math.PI / 2) {
      foot = lerp(-0.4, 0.2, smooth((p + Math.PI / 2) / Math.PI));
    } else {
      const u = (p > 0 ? p - Math.PI / 2 : p + Math.PI * 1.5) / Math.PI;
      foot = u < 0.12 ? lerp(0.2, 0, u / 0.12) : u < 0.6 ? 0 : lerp(0, -0.4, Math.pow((u - 0.6) / 0.4, 2));
    }
    s.hip[i].turn(hip);
    s.knee[i].turn(knee);
    s.foot?.[i].turn(foot * amp - (hip + knee));
    reach = Math.max(reach, s.thigh * Math.cos(hip) + s.shin * Math.cos(hip + knee));

    const side = i ? 1 : -1;
    const arm = -Math.sin(p) * lerp(0.36, 0.8, run) * amp + air * 0.3;
    s.arm[i].turn(arm, 0, -side * s.armDrop + side * lerp(0.02, 0.1, run) * (s.armDrop ? 1 : 0));
    // On a T-pose skeleton the forearm lies along X at rest, so bending it forward is a turn about Y.
    const bend = 0.18 + run * 1.1 * amp + Math.max(0, arm) * 0.5;
    if (s.elbow) s.elbow[i].turn(s.armDrop ? 0 : bend, s.armDrop ? side * bend : 0);
  }
  s.spine?.turn(-(0.02 + 0.04 * amp + 0.1 * run * amp), Math.sin(g.phase) * 0.14 * amp);
  s.lift.position.y = reach - (s.thigh + s.shin) + run * amp * 0.04 * Math.abs(Math.sin(g.phase)) + (air ? 0.1 : 0);
}

// --- clips: the artist's own animations --------------------------------------

async function loadClips(id: SuitId, loader: GLTFLoader, palette?: Palette): Promise<LoadedSuit> {
  const gltf: GLTF = await loader.loadAsync("/dataset/models/astronaut.glb");
  const model = gltf.scene;
  model.traverse((o) => { o.frustumCulled = false; });
  if (palette) {
    const done = new Set<THREE.Material>();
    model.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        const look = palette[m.name];
        if (!look || done.has(m) || !(m instanceof THREE.MeshStandardMaterial)) continue;
        done.add(m);
        m.color.setHex(look.color);
        m.metalness = look.metalness ?? 0;
        m.roughness = look.roughness ?? 0.85;
        if (look.emissive) m.emissive.setHex(look.emissive);
      }
    });
  }
  const root = stand(model, Math.PI);
  const play = playClips(model, gltf.animations, 1);
  return { id, root, update: play.update, dispose: () => { play.stop(); disposeTree(root); } };
}

/**
 * Plays the Quaternius skeleton's Idle, Walk and Run clips, blended by ground speed and paced to
 * the feet. size is the figure's scale against the original, since a smaller figure takes shorter steps.
 */
function playClips(model: THREE.Object3D, clips: THREE.AnimationClip[], size: number): { update: LoadedSuit["update"]; stop: () => void } {
  const mixer = new THREE.AnimationMixer(model);
  const clip = (name: string) => clips.find((c) => c.name.endsWith(`|${name}`));
  const [idleC, walkC, runC] = [clip("Idle"), clip("Walk"), clip("Run")];
  if (!idleC || !walkC || !runC) throw new Error("astronaut.glb has no Idle, Walk and Run clips");
  const idle = mixer.clipAction(idleC), walkA = mixer.clipAction(walkC), runA = mixer.clipAction(runC);
  for (const a of [idle, walkA, runA]) a.play();
  // Ground speed at which the clips look right at normal playback on the original figure (estimated by eye).
  const WALK_CLIP = 1.5 * size, RUN_CLIP = 4.6 * size;
  return {
    update: (g, dt) => {
      const moving = Math.min(1, g.speed / 0.6);
      const running = Math.min(1, Math.max(0, (g.speed - g.walkSpeed * 1.15) / (g.sprintSpeed * 0.7 - g.walkSpeed * 1.15)));
      idle.setEffectiveWeight(1 - moving);
      walkA.setEffectiveWeight(moving * (1 - running));
      runA.setEffectiveWeight(moving * running);
      walkA.setEffectiveTimeScale(Math.max(0.6, Math.min(2.2, g.speed / WALK_CLIP)));
      runA.setEffectiveTimeScale(Math.max(0.7, Math.min(1.8, g.speed / RUN_CLIP)));
      mixer.update(dt);
    },
    stop: () => mixer.stopAllAction(),
  };
}

// --- walk and run clips only -------------------------------------------------

/**
 * A rigged model that ships with "walk" and "run" clips but no idle. The clips are measured at
 * load time: how fast the feet travel (so playback can match ground speed) and the moment in the
 * walk when the feet pass each other, which is held as the standing pose.
 */
async function loadWalkRun(id: SuitId, loader: GLTFLoader, file: string, yaw: number): Promise<LoadedSuit> {
  const gltf: GLTF = await loader.loadAsync(`/dataset/models/${file}`);
  const model = gltf.scene;
  model.traverse((o) => { o.frustumCulled = false; });
  const root = stand(model, yaw);
  const find = (name: string) => gltf.animations.find((c) => c.name.toLowerCase() === name);
  const walkC = find("walk"), runC = find("run");
  if (!walkC || !runC) throw new Error(`${file} has no walk and run clips`);
  const hips = model.getObjectByName("Hips"), footL = model.getObjectByName("LeftFoot"), footR = model.getObjectByName("RightFoot");
  if (!hips || !footL || !footR) throw new Error(`${file} has no Hips, LeftFoot and RightFoot bones`);

  // Keep the figure on the spot: the game moves it, so any forward travel baked into a clip is removed.
  const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(root.children[0].getWorldQuaternion(new THREE.Quaternion()).invert()).normalize();
  for (const clip of [walkC, runC]) {
    const track = clip.tracks.find((t) => t.name === "Hips.position");
    if (!track) continue;
    const v = track.values, start = new THREE.Vector3(v[0], v[1], v[2]), p = new THREE.Vector3();
    for (let i = 0; i < v.length; i += 3) {
      p.set(v[i], v[i + 1], v[i + 2]).sub(start);
      p.addScaledVector(forward, -p.dot(forward)).add(start).toArray(v, i);
    }
  }

  const mixer = new THREE.AnimationMixer(model);
  const walk = mixer.clipAction(walkC), run = mixer.clipAction(runC);
  // Standing: the arms and body from one frozen moment of the walk, and the legs straight as the
  // model was built (bones a clip does not drive fall back to their built pose).
  const upper = walkC.tracks.filter((t) => !/^(Hips|\w*UpLeg|\w*Leg|\w*Foot)\./.test(t.name));
  const still = mixer.clipAction(new THREE.AnimationClip("stand", walkC.duration, upper));
  const a = new THREE.Vector3(), b = new THREE.Vector3(), h = new THREE.Vector3();
  /** Samples one clip: the ground speed its feet imply, and when the feet are closest together. */
  const measure = (action: THREE.AnimationAction) => {
    const N = 32, T = action.getClip().duration;
    let lo = Infinity, hi = -Infinity, best = 0, gap = Infinity;
    action.play();
    for (let i = 0; i < N; i++) {
      action.time = (i / N) * T;
      mixer.update(0);
      root.updateMatrixWorld(true);
      root.worldToLocal(footL.getWorldPosition(a));
      root.worldToLocal(footR.getWorldPosition(b));
      root.worldToLocal(hips.getWorldPosition(h));
      lo = Math.min(lo, a.z - h.z);
      hi = Math.max(hi, a.z - h.z);
      const d = Math.abs(a.z - b.z); // feet level with each other: the arms are then at mid-swing, beside the body
      if (d < gap) { gap = d; best = action.time; }
    }
    action.stop();
    return { speed: Math.max(0.3, (2 * (hi - lo)) / T), standAt: best };
  };
  const walkM = measure(walk), runM = measure(run);
  for (const action of [still, walk, run]) action.play();
  still.time = walkM.standAt;
  still.setEffectiveTimeScale(0);

  return {
    id, root,
    update: (g, dt) => {
      const moving = Math.min(1, g.speed / 0.6);
      const running = Math.min(1, Math.max(0, (g.speed - g.walkSpeed * 1.15) / (g.sprintSpeed * 0.7 - g.walkSpeed * 1.15)));
      still.setEffectiveWeight(1 - moving);
      walk.setEffectiveWeight(moving * (1 - running));
      run.setEffectiveWeight(moving * running);
      walk.setEffectiveTimeScale(Math.max(0.5, Math.min(2.2, g.speed / walkM.speed)));
      run.setEffectiveTimeScale(Math.max(0.6, Math.min(2, g.speed / runM.speed)));
      mixer.update(dt);
    },
    dispose: () => { mixer.stopAllAction(); disposeTree(root); },
  };
}

// --- bones: a rigged model with no animation ---------------------------------

async function loadBones(id: SuitId, loader: GLTFLoader): Promise<LoadedSuit> {
  const gltf: GLTF = await loader.loadAsync("/dataset/models/astronaut_classic.glb");
  const model = gltf.scene;
  model.traverse((o) => {
    o.frustumCulled = false;
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    // The file's materials are fully metallic, which reads as dark grey without a reflection map.
    for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      if (m instanceof THREE.MeshStandardMaterial) { m.metalness = 0; m.roughness = 0.8; }
    }
  });
  // Measure the figure by its skeleton: the mesh's rest box includes arms held straight out.
  const root = stand(model, Math.PI);
  const bone = (name: string) => {
    let found: THREE.Object3D | undefined;
    model.traverse((o) => { if (!found && o.name.replace(/^mixamorig:?/, "") === name) found = o; });
    if (!found) throw new Error(`astronaut_classic.glb has no ${name} bone`);
    return found;
  };
  // The file's "Left" is the figure's own left; after turning to face -Z that is -X, our index 0.
  const pair = (name: string) => [bone(`Left${name}`), bone(`Right${name}`)]
    .sort((a, b) => a.getWorldPosition(new THREE.Vector3()).x - b.getWorldPosition(new THREE.Vector3()).x)
    .map((b) => new Joint(b, root));
  const at = (name: string) => bone(name).getWorldPosition(new THREE.Vector3());
  const skeleton: Skeleton = {
    hip: pair("UpLeg"), knee: pair("Leg"), foot: pair("Foot"), arm: pair("Arm"), elbow: pair("ForeArm"),
    spine: new Joint(bone("Spine1"), root),
    armDrop: 1.25,
    thigh: at("LeftUpLeg").distanceTo(at("LeftLeg")),
    shin: at("LeftLeg").distanceTo(at("LeftFoot")),
    lift: root.children[0],
  };
  const baseY = skeleton.lift.position.y;
  return {
    id, root,
    update: (g) => { walk(skeleton, g); skeleton.lift.position.y += baseY; },
    dispose: () => disposeTree(root),
  };
}

// --- static: NASA's unjointed suits ------------------------------------------

/**
 * NASA publishes its suits as solid, unjointed models. To make one walk like the game-art suits
 * we borrow the Quaternius astronaut's skeleton and animations (public domain): the skeleton is
 * scaled to fit inside the NASA suit, the suit's body and legs are attached to it, and the
 * artist's own walk, run and idle clips then move them. Arms are animated too where NASA posed
 * them hanging clear of the body.
 */
async function loadStatic(id: SuitId, loader: GLTFLoader, rig: StaticRig): Promise<LoadedSuit> {
  const [suitFile, donor] = await Promise.all([
    loader.loadAsync(`/dataset/models/${rig.file}`),
    loader.loadAsync("/dataset/models/astronaut.glb"),
  ]);
  solidMaterials(suitFile.scene);
  const posed = stand(suitFile.scene, rig.yaw);
  const root = new THREE.Group();

  // The donor: keep its skeleton, in the pose it was built in, and drop its own surface.
  const armature = donor.scene;
  const skins: THREE.SkinnedMesh[] = [];
  armature.traverse((o) => { if ((o as THREE.SkinnedMesh).isSkinnedMesh) skins.push(o as THREE.SkinnedMesh); });
  for (const skin of skins) {
    skin.skeleton.pose();
    skin.removeFromParent();
    skin.geometry.dispose();
  }
  const holder = new THREE.Group(); // turns the donor to face -Z and scales it to the suit
  holder.rotation.y = Math.PI;
  holder.add(armature);
  root.add(holder);
  root.updateMatrixWorld(true);
  const bone = (name: string) => {
    const found = armature.getObjectByName(name);
    if (!found) throw new Error(`astronaut.glb has no ${name} bone`);
    return found;
  };
  const at = (o: THREE.Object3D) => o.getWorldPosition(new THREE.Vector3());
  const sides = ["L", "R"] as const; // the donor's left is the figure's own left: -X once it faces -Z

  // Size the whole skeleton by leg length, so hips, knees and the animated feet all stay in step.
  const [hx, hy, hz] = rig.hip, [sx, sy, sz] = rig.shoulder;
  const size = hy / at(bone("UpperLegL")).y;
  holder.scale.setScalar(size);
  holder.position.set(rig.cx, 0, hz);
  root.updateMatrixWorld(true);
  holder.position.z += hz - at(bone("UpperLegL")).z; // hips over the suit's hips, front to back
  root.updateMatrixWorld(true);

  /** Moves a bone, given a point in the figure's space, without disturbing its parent. */
  const place = (b: THREE.Object3D, world: THREE.Vector3) => {
    b.position.copy(b.parent!.worldToLocal(world.clone()));
    root.updateMatrixWorld(true);
  };
  // Hips as wide as the suit's, and the spine stretched so the shoulders reach the suit's shoulders.
  sides.forEach((side, i) => {
    const leg = bone(`UpperLeg${side}`);
    place(leg, new THREE.Vector3(rig.cx + (i ? hx : -hx), at(leg).y, at(leg).z));
  });
  const spine = ["Abdomen", "Torso", "Chest"].map(bone);
  const reach = (sy - at(bone("Hips")).y) / (at(bone("ShoulderL")).y - at(bone("Hips")).y);
  for (const b of spine) b.position.multiplyScalar(reach);
  root.updateMatrixWorld(true);

  // Which vertices are arm: those out to the side of the body or held in front of it.
  const step = (v: number, a: number, b: number) => smooth((v - a) / (b - a));
  const sources: THREE.Mesh[] = [];
  posed.traverse((o) => { if ((o as THREE.Mesh).isMesh) sources.push(o as THREE.Mesh); });
  const geos = sources.map((m) => m.geometry.clone().applyMatrix4(m.matrixWorld));
  const armOf = (x: number, y: number, z: number) => {
    const ax = Math.abs(x - rig.cx);
    const beside = step(ax, rig.armOut[0], rig.armOut[1]) * step(y, rig.armLow[0], rig.armLow[1]) * (1 - step(y, rig.armHigh[0], rig.armHigh[1]));
    const ahead = step(-z, rig.armAhead[0], rig.armAhead[1]) * step(ax, rig.aheadOut[0], rig.aheadOut[1])
      * step(y, rig.aheadLow[0], rig.aheadLow[1]) * (1 - step(y, rig.aheadHigh[0], rig.aheadHigh[1]));
    return Math.max(beside, ahead);
  };
  /** Turns a bone so that its child lies toward a point, and stretches the child out to reach it. */
  const aim = (b: THREE.Object3D, child: THREE.Object3D, target: THREE.Vector3) => {
    const from = at(b);
    const turn = new THREE.Quaternion().setFromUnitVectors(at(child).sub(from).normalize(), target.clone().sub(from).normalize());
    const parentQ = b.parent!.getWorldQuaternion(new THREE.Quaternion());
    b.quaternion.copy(parentQ.clone().invert().multiply(turn).multiply(parentQ).multiply(b.quaternion));
    root.updateMatrixWorld(true);
    child.position.setLength(child.position.length() * (target.distanceTo(from) / at(child).distanceTo(from)));
    root.updateMatrixWorld(true);
  };
  // Arms: lay the donor's arm bones along the suit's own arms (shoulder, elbow, wrist), so the
  // sleeves are attached where the bones really are. Otherwise the arms ride on the chest.
  const mean = (pts: THREE.Vector3[]) => pts.reduce((sum, q) => sum.add(q), new THREE.Vector3()).divideScalar(pts.length);
  const arms = sides.map((side, i) => {
    if (!rig.swingArms) return null;
    const pts: THREE.Vector3[] = [];
    for (const geo of geos) {
      const pos = geo.attributes.position;
      for (let k = 0; k < pos.count; k += 2) {
        const x = pos.getX(k), y = pos.getY(k), z = pos.getZ(k);
        if ((x < rig.cx ? 0 : 1) === i && armOf(x, y, z) > 0.6) pts.push(new THREE.Vector3(x, y, z));
      }
    }
    if (pts.length < 40) return null;
    const shoulder = new THREE.Vector3(rig.cx + (i ? sx : -sx), sy, sz);
    const far = [...pts].sort((a, b) => b.distanceToSquared(shoulder) - a.distanceToSquared(shoulder)).slice(0, Math.ceil(pts.length * 0.12));
    const hand = mean(far.map((q) => q.clone()));
    const axis = hand.clone().sub(shoulder), len = axis.length();
    axis.normalize();
    // The elbow is wherever the middle of the arm actually is, off the straight line if the arm is bent.
    const middle = pts.filter((q) => { const t = q.clone().sub(shoulder).dot(axis) / len; return t > 0.42 && t < 0.54; });
    const elbow = middle.length > 5 ? mean(middle.map((q) => q.clone())) : shoulder.clone().lerp(hand, 0.48);
    const upper = bone(`UpperArm${side}`), lower = bone(`LowerArm${side}`), wrist = bone(`Wrist${side}`);
    place(upper, shoulder);
    aim(upper, lower, elbow);
    aim(lower, wrist, hand);
    return { shoulder, elbow, hand };
  });
  // Attach the suit's surface. Each vertex follows the bones of the region it sits in.
  const bones: THREE.Bone[] = [];
  armature.traverse((o) => { if ((o as THREE.Bone).isBone) bones.push(o as THREE.Bone); });
  const skeleton = new THREE.Skeleton(bones);
  const slot = (name: string) => bones.indexOf(bone(name) as THREE.Bone);
  const hipsI = slot("Hips"), chestI = slot("Chest");
  const legI = sides.map((side) => ({ upper: slot(`UpperLeg${side}`), lower: slot(`LowerLeg${side}`), foot: slot(`Foot${side}`) }));
  const armI = sides.map((side) => ({ upper: slot(`UpperArm${side}`), lower: slot(`LowerArm${side}`) }));
  const knee = at(bone("LowerLegL")).y;
  const waist: [number, number] = [rig.legBlend[1] + 0.08, rig.legBlend[1] + 0.3];
  for (const geo of geos) {
    const pos = geo.attributes.position;
    const index = new Uint16Array(pos.count * 4), weight = new Float32Array(pos.count * 4);
    const p = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      p.fromBufferAttribute(pos, i);
      const side = p.x < rig.cx ? 0 : 1;
      const arm = armOf(p.x, p.y, p.z);
      const leg = (1 - step(p.y, rig.legBlend[0], rig.legBlend[1])) * (1 - arm);
      const trunk = Math.max(0, 1 - arm - leg);
      const picks: [number, number][] = [];
      const up = step(p.y, waist[0], waist[1]);
      // An arm vertex leaves the chest gradually over the first hand's width past the shoulder
      // joint, which keeps the shoulder from pinching, then follows the upper arm or the forearm.
      const fit = arms[side];
      let onArm = 0, fore = 0;
      if (fit && arm > 0) {
        const down = fit.elbow.clone().sub(fit.shoulder).normalize();
        onArm = arm * step(p.clone().sub(fit.shoulder).dot(down), -0.03, 0.11);
        fore = step(p.clone().sub(fit.elbow).dot(fit.hand.clone().sub(fit.elbow).normalize()), -0.06, 0.06);
      }
      const chestShare = trunk * up + arm - onArm;
      if (trunk > 0) picks.push([hipsI, trunk * (1 - up)]);
      if (chestShare > 0) picks.push([chestI, chestShare]);
      if (fit && onArm > 0) picks.push([armI[side].lower, onArm * fore], [armI[side].upper, onArm * (1 - fore)]);
      if (leg > 0) {
        const foot = 1 - step(p.y, 0.1, 0.2); // the boot, which the animated foot bone plants on the ground
        const shin = (1 - step(p.y, knee - 0.07, knee + 0.07)) * (1 - foot);
        picks.push([legI[side].foot, leg * foot], [legI[side].lower, leg * shin], [legI[side].upper, leg * (1 - foot - shin)]);
      }
      picks.sort((a, b) => b[1] - a[1]);
      const top = picks.slice(0, 4), total = top.reduce((sum, w) => sum + w[1], 0) || 1;
      top.forEach(([b, w], k) => { index[i * 4 + k] = b; weight[i * 4 + k] = w / total; });
    }
    geo.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(index, 4));
    geo.setAttribute("skinWeight", new THREE.Float32BufferAttribute(weight, 4));
  }
  geos.forEach((geo, k) => {
    const mesh = new THREE.SkinnedMesh(geo, sources[k].material);
    mesh.frustumCulled = false;
    root.add(mesh);
    mesh.bind(skeleton, new THREE.Matrix4());
    sources[k].geometry.dispose();
  });

  // The clips also slide the shoulder bones about; that would undo the fit above, so those tracks are dropped.
  const clips = donor.animations.map((c) => new THREE.AnimationClip(c.name, c.duration, c.tracks.filter((t) => !/^(Shoulder|UpperArm|LowerArm|UpperLeg|Abdomen|Torso|Chest)\w*\.position$/.test(t.name))));
  const play = playClips(armature, clips, size);
  return { id, root, update: play.update, dispose: () => { play.stop(); disposeTree(root); skeleton.dispose(); } };
}

export function loadSuit(id: SuitId, loader: GLTFLoader): Promise<LoadedSuit> {
  const rig = STATIC[id];
  if (rig) return loadStatic(id, loader, rig);
  if (id === "classic") return loadBones(id, loader);
  if (id === "explorer") return loadWalkRun(id, loader, "astronaut_realistic.glb", Math.PI);
  if (id === "android") return loadWalkRun(id, loader, "android.glb", Math.PI);
  return loadClips(id, loader, id === "rebel" ? REBEL : id === "amar" ? AMAR : undefined);
}

/**
 * Development aid for placing joints on a new unjointed suit: for each 5 cm of height on the
 * standing model, the widths occupied left to right and the front-to-back extent.
 */
export async function measureSuit(file: string, loader: GLTFLoader, yaw = 0): Promise<string[]> {
  const gltf: GLTF = await loader.loadAsync(`/dataset/models/${file}`);
  const posed = stand(gltf.scene, yaw);
  const rows = new Map<number, { xs: Set<number>; z0: number; z1: number }>();
  const v = new THREE.Vector3();
  posed.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const pos = m.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
      const k = Math.floor(v.y / 0.05);
      let row = rows.get(k);
      if (!row) rows.set(k, (row = { xs: new Set(), z0: 9, z1: -9 }));
      row.xs.add(Math.round(v.x / 0.03));
      row.z0 = Math.min(row.z0, v.z);
      row.z1 = Math.max(row.z1, v.z);
    }
  });
  disposeTree(posed);
  return [...rows.entries()].sort((a, b) => b[0] - a[0]).map(([k, row]) => {
    let line = "";
    for (let c = -24; c <= 24; c++) line += row.xs.has(c) ? "#" : c === 0 ? "|" : ".";
    return `${(k * 0.05).toFixed(2)} ${line} z ${row.z0.toFixed(2)}..${row.z1.toFixed(2)}`;
  });
}
