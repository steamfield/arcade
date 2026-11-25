import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import type { CharacterId } from '../../logic/types.ts';

/**
 * Each character's card swatch, progress marker and 3D accent color.
 * The palette uses Okabe–Ito accents with slate for Shade.
 */
export const RACER_COLORS: Readonly<Record<CharacterId, number>> = {
  grit: 0x0072b2,
  skip: 0xe69f00,
  blaze: 0xd55e00,
  shade: 0x55546d,
  cheeks: 0xcc79a7,
  duke: 0x009e73,
  dusk: 0x56b4e9,
  fang: 0xf0e442,
};

const CREAM = 0xf6ead6;
const INK = 0x272230;
const NOSE = 0x412b30;
const WHITE = 0xfff8ec;

type V3 = readonly [number, number, number];
/** A colour, or a rule giving the colour at a point in model space: how markings are painted on. */
type Paint = number | ((x: number, y: number, z: number) => number);

const spheres = new Map<string, THREE.BufferGeometry>();

/** Sphere detail grows with part size, so a racer stays under 18k triangles. */
function sphereFor(radius: number, glossy: boolean): THREE.BufferGeometry {
  const [w, h] = radius > 0.25 ? [24, 14] : radius > 0.1 || glossy ? [16, 10] : [10, 7];
  const key = `${w}x${h}`;
  let geometry = spheres.get(key);
  if (!geometry) {
    geometry = new THREE.SphereGeometry(1, w, h);
    spheres.set(key, geometry);
  }
  return geometry;
}

/** A cone with a rounded tip, smooth-shaded, for ears, claws and tufts. Its tip is at +y. */
const cone = new THREE.LatheGeometry(
  Array.from({ length: 11 }, (_, i) => {
    const t = i / 10;
    return new THREE.Vector2((1 - t) ** 0.8 * (1 - 0.12 * (1 - t) ** 6), -1 + 2 * t);
  }),
  14,
);
const rounded = new RoundedBoxGeometry(2, 2, 2, 2, 0.55);
const box = mergeVertices(rounded);
rounded.dispose();

const UP = new THREE.Vector3(0, 1, 0);

/**
 * A capsule from `a` to `b` whose radius runs from `ra` to `rb`, for limbs, ears and feathers.
 * `flat` squashes it across its length (front to back for an upright one).
 */
function taper(a: V3, b: V3, ra: number, rb: number, flat = 1): THREE.BufferGeometry {
  const from = new THREE.Vector3(...a);
  const along = new THREE.Vector3(...b).sub(from);
  const length = along.length();
  const profile: THREE.Vector2[] = [];
  for (let i = 0; i <= 4; i++) {
    const t = (i / 4) * (Math.PI / 2);
    profile.push(new THREE.Vector2(ra * Math.sin(t) + 1e-4, -ra * Math.cos(t)));
  }
  for (let i = 0; i <= 4; i++) {
    const t = (i / 4) * (Math.PI / 2);
    profile.push(new THREE.Vector2(rb * Math.cos(t) + 1e-4, length + rb * Math.sin(t)));
  }
  return new THREE.LatheGeometry(profile, 10)
    .scale(1, 1, flat)
    .applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, along.normalize()))
    .translate(from.x, from.y, from.z);
}

/**
 * One mass of a sculpted form: an ellipsoid or a tapered rod. `sculpt` melts overlapping lumps into
 * a single skin, which is what makes a snout grow out of a skull instead of sitting on it.
 */
type Lump =
  | { kind: 'ball'; inverse: THREE.Matrix4; size: V3; least: number }
  | { kind: 'rod'; a: THREE.Vector3; ab: THREE.Vector3; ra: number; rb: number };

const lump = {
  /** An ellipsoid of half-sizes `size` at `at`, turned like `Sketch.blob`. */
  ball(at: V3, size: V3, turn: V3 = [0, 0, 0]): Lump {
    const inverse = new THREE.Matrix4()
      .makeRotationFromEuler(new THREE.Euler(turn[0], turn[1], turn[2], 'ZYX'))
      .setPosition(at[0], at[1], at[2])
      .invert();
    return { kind: 'ball', inverse, size, least: Math.min(size[0], size[1], size[2]) };
  },
  /** A capsule from `a` to `b` with end radii `ra` and `rb`. */
  rod(a: V3, b: V3, ra: number, rb: number): Lump {
    const from = new THREE.Vector3(...a);
    return { kind: 'rod', a: from, ab: new THREE.Vector3(...b).sub(from), ra, rb };
  },
};

const probe = new THREE.Vector3();

/** Roughly how far `p` is outside the melted union of `lumps` (negative inside). */
function distance(lumps: readonly Lump[], p: THREE.Vector3, blend: number): number {
  let total = Infinity;
  for (const part of lumps) {
    let d: number;
    if (part.kind === 'ball') {
      probe.copy(p).applyMatrix4(part.inverse);
      d = (Math.hypot(probe.x / part.size[0], probe.y / part.size[1], probe.z / part.size[2]) - 1) * part.least;
    } else {
      probe.copy(p).sub(part.a);
      const t = THREE.MathUtils.clamp(probe.dot(part.ab) / part.ab.lengthSq(), 0, 1);
      d = probe.addScaledVector(part.ab, -t).length() - (part.ra + (part.rb - part.ra) * t);
    }
    // Polynomial smooth minimum: within `blend` of each other, two lumps fillet together.
    const h = Math.max(blend - Math.abs(total - d), 0) / blend;
    total = Math.min(total, d) - h * h * blend * 0.25;
  }
  return total;
}

const icospheres = new Map<number, THREE.BufferGeometry>();

/** Where a sculpted form's skin is, from its centre toward `dir`, `out` meters proud of it. */
type Skin = (dir: V3, out?: number) => V3;

/**
 * Shrink-wraps a sphere of `detail` subdivisions onto the melted union of `lumps`, as seen from
 * `centre` (every part of the form must be visible from there), and paints it.
 */
function sculpt(
  lumps: readonly Lump[],
  centre: V3,
  color: Paint,
  detail: number,
  blend: number,
): { geometry: THREE.BufferGeometry; skin: Skin } {
  let unit = icospheres.get(detail);
  if (!unit) {
    const raw = new THREE.IcosahedronGeometry(1, detail);
    raw.deleteAttribute('normal');
    raw.deleteAttribute('uv');
    unit = mergeVertices(raw, 1e-5);
    raw.dispose();
    icospheres.set(detail, unit);
  }
  const point = new THREE.Vector3();
  const reach = (x: number, y: number, z: number): number => {
    // Walk in from outside to the outermost skin, then close in on it.
    let far = 1.6;
    const at = (t: number) =>
      distance(lumps, point.set(centre[0] + x * t, centre[1] + y * t, centre[2] + z * t), blend);
    while (far > 0.02 && at(far) > 0) far -= 0.02;
    let near = far;
    far += 0.02;
    for (let i = 0; i < 7; i++) {
      const mid = (near + far) / 2;
      if (at(mid) > 0) far = mid;
      else near = mid;
    }
    return near;
  };
  const geometry = unit.clone();
  const position = geometry.getAttribute('position');
  for (let i = 0; i < position.count; i++) {
    const [x, y, z] = [position.getX(i), position.getY(i), position.getZ(i)];
    const t = reach(x, y, z);
    position.setXYZ(i, centre[0] + x * t, centre[1] + y * t, centre[2] + z * t);
  }
  geometry.computeVertexNormals();
  const skin: Skin = (dir, out = 0) => {
    const n = Math.hypot(dir[0], dir[1], dir[2]);
    const [x, y, z] = [dir[0] / n, dir[1] / n, dir[2] / n];
    const t = reach(x, y, z) + out;
    return [centre[0] + x * t, centre[1] + y * t, centre[2] + z * t];
  };
  return { geometry: paint(geometry, color), skin };
}

/** Each separately posed piece of a racer. Arms and legs are drawn once per side. */
type Slot = 'torso' | 'head' | 'ears' | 'tail' | 'armL' | 'armR' | 'legL' | 'legR';
type Shape = 'round' | 'point' | 'box';

/** How an eye looks: its colours, a slit pupil, and an upper lid for a brow. */
interface Look {
  /** The eyeball. Most animals show no white, so this defaults to the iris colour. */
  white?: number;
  iris?: number;
  slit?: boolean;
  /** How much of the eye the pupil fills, 0..1. */
  pupil?: number;
  /** An upper lid in `color` covering `cover` (0..1) of the eye, its inner end dropped by `tilt` radians. */
  lid?: { color: number; cover: number; tilt: number };
}

/** The drawing kit a character is sketched with. Everything faces -z, in meters, feet at y = 0. */
interface Sketch {
  /** An ellipsoid (or `shape`) of half-sizes `size` at `at`, turned by `turn` radians about x, y, then z. */
  blob(color: Paint, at: V3, size: V3, turn?: V3, shape?: Shape): void;
  /** A capsule from `a` to `b` with end radii `ra` and `rb`. */
  limb(color: Paint, a: V3, b: V3, ra: number, rb: number, flat?: number): void;
  /** Lumps melted into one painted skin, wrapped from `centre`. Returns where that skin is. */
  form(lumps: readonly Lump[], centre: V3, color: Paint, detail?: number, blend?: number): Skin;
  /** A glossy blob for noses and beaks. It rides on the head. */
  shine(color: number, at: V3, size: V3, turn?: V3): void;
  /** An eye of radius `r` set into `skin` toward `dir`. */
  eye(skin: Skin, dir: V3, r: number, look?: Look): void;
  /** Runs `draw` so every part it adds belongs to `slot`. */
  in(slot: Slot, draw: () => void): void;
}

/** A piece of the body that is posed on its own, turning about `pivot`; its geometry is centred there. */
interface Pivoted {
  geometry: THREE.BufferGeometry;
  pivot: THREE.Vector3;
}

export interface RacerGeometry {
  /** Trunk, neck and anything worn on it. */
  torso: THREE.BufferGeometry;
  /** The skull and everything matte on it, turning about the neck. */
  head: Pivoted;
  /** Eyes, noses and beaks, drawn with a glossy material. Centred on the neck like `head`. */
  face: THREE.BufferGeometry;
  /** Pivot is relative to the neck: ears ride on the head. */
  ears?: Pivoted;
  /** Left then right, turning about the shoulders and hips. */
  arms: [Pivoted, Pivoted];
  legs: [Pivoted, Pivoted];
  tail?: Pivoted;
}

const geometries = new Map<CharacterId, RacerGeometry>();
const tint = new THREE.Color();

/** Bakes `color` into vertex colours, warming upward planes and tucking undersides into shadow. */
function paint(geometry: THREE.BufferGeometry, color: Paint): THREE.BufferGeometry {
  // Every piece carries position, normal and colour only, so pieces from any source merge.
  geometry.deleteAttribute('uv');
  const position = geometry.getAttribute('position');
  const normal = geometry.getAttribute('normal');
  const rgb = new Float32Array(position.count * 3);
  if (typeof color === 'number') tint.setHex(color);
  for (let i = 0; i < position.count; i++) {
    if (typeof color !== 'number') tint.setHex(color(position.getX(i), position.getY(i), position.getZ(i)));
    const up = (normal.getY(i) + 1) / 2;
    rgb[i * 3] = tint.r * (0.62 + 0.48 * up);
    rgb[i * 3 + 1] = tint.g * (0.66 + 0.39 * up);
    rgb[i * 3 + 2] = tint.b * (0.72 + 0.29 * up);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(rgb, 3));
  return geometry;
}

/** Where a character's posed pieces turn: the neck, the right shoulder and hip, and the tail's root. */
interface Rig {
  neck: V3;
  shoulder: V3;
  hip: V3;
  tail: V3;
}

/** The shared upright frame: a trunk with a neck, and animal limbs ending in paws. Species add the rest. */
interface Build {
  fur: number;
  /** Throat, chest and belly. */
  belly: number;
  /** Forearms, shanks and paws, for dark socks. Defaults to `fur`. */
  sock?: number;
  /** Extra markings on the trunk; return undefined to keep the fur and belly. */
  coat?: (x: number, y: number, z: number) => number | undefined;
  /** Half-sizes of the trunk, and the height of its centre. */
  torso: V3;
  torsoY: number;
  hipY: number;
  /** How far each hip sits from the centreline. */
  stance: number;
  legR: number;
  armR: number;
  /** The head's centre, which the neck reaches up into, and the neck's radius. */
  head: V3;
  neckR: number;
  /** A neckerchief in the racer's marker colour, knotted at the nape so it shows from behind. */
  scarf: number | null;
  /** Thick straight legs with nails instead of a haunch, shank and paw. */
  stumpy?: boolean;
}

function trunk(k: Sketch, b: Build): Rig {
  const [tw, th, td] = b.torso;
  const neck: V3 = [0, b.torsoY + th * 0.78, b.head[2] * 0.4];
  k.form(
    [
      lump.ball([0, b.torsoY + th * 0.28, -0.01], [tw, th * 0.72, td]),
      lump.ball([0, b.torsoY - th * 0.3, 0.02], [tw * 0.94, th * 0.7, td * 0.98]),
      lump.rod([0, b.torsoY + th * 0.6, 0], [b.head[0], b.head[1] - 0.08, b.head[2] + 0.04], b.neckR * 1.15, b.neckR),
    ],
    [0, b.torsoY, 0],
    (x, y, z) => {
      const marked = b.coat?.(x, y, z);
      if (marked !== undefined) return marked;
      // A bib from the throat to the groin, widest at the belly.
      const u = x / tw;
      return z < -td * 0.28 - td * 1.1 * u * u ? b.belly : b.fur;
    },
    9,
    0.09,
  );
  if (b.scarf !== null) {
    const y = b.torsoY + th * 0.82;
    const r = b.neckR * 1.5;
    k.blob(b.scarf, [0, y, neck[2]], [r, 0.055, r]);
    k.blob(b.scarf, [0.03, y + 0.01, neck[2] + r], [0.055, 0.045, 0.045]);
    k.limb(b.scarf, [0.03, y, neck[2] + r], [0.12, y - 0.2, neck[2] + r + 0.1], 0.045, 0.025, 0.45);
    k.limb(b.scarf, [0.03, y, neck[2] + r], [-0.05, y - 0.24, neck[2] + r + 0.07], 0.045, 0.025, 0.45);
  }
  return {
    neck,
    shoulder: [tw * 0.88, b.torsoY + th * 0.5, 0],
    hip: [b.stance, b.hipY, 0.02],
    tail: [0, b.hipY + 0.06, td * 0.75],
  };
}

function limbs(k: Sketch, b: Build, rig: Rig): void {
  const sock = b.sock ?? b.fur;
  for (const side of [-1, 1]) {
    k.in(side < 0 ? 'legL' : 'legR', () => {
      const x = side * b.stance;
      if (b.stumpy) {
        k.limb(b.fur, [x, b.hipY, 0.02], [x, 0.13, 0.0], b.legR * 1.15, b.legR * 1.05);
        k.blob(b.fur, [x, 0.075, -0.02], [b.legR * 1.25, 0.075, b.legR * 1.4]);
        for (const toe of [-1, 0, 1]) {
          k.blob(0xe9dfb8, [x + toe * b.legR * 0.62, 0.05, -0.02 - b.legR * 1.22], [0.026, 0.036, 0.03]);
        }
        return;
      }
      // A haunch, a thin shank angled back to the hock, and a long paw: an animal's hind leg, stood up.
      const knee: V3 = [x, b.hipY * 0.56, -0.05];
      const hock: V3 = [x, 0.17, 0.05];
      k.limb(b.fur, [x, b.hipY, 0.03], knee, b.legR * 1.55, b.legR * 1.05);
      k.limb(sock, knee, hock, b.legR * 1.05, b.legR * 0.72);
      k.blob(sock, [x, 0.062, -0.06], [b.legR * 1.12, 0.062, b.legR * 2.3]);
      for (const toe of [-1, 0, 1]) {
        k.blob(sock, [x + toe * b.legR * 0.62, 0.052, -0.06 - b.legR * 2.05], [b.legR * 0.42, 0.05, b.legR * 0.55]);
      }
    });
    k.in(side < 0 ? 'armL' : 'armR', () => {
      const [sx, sy, sz] = rig.shoulder;
      const elbow: V3 = [side * (sx + 0.07), sy - 0.22, 0.07];
      const wrist: V3 = [side * (sx + 0.05), sy - 0.3, -0.12];
      k.limb(b.fur, [side * sx, sy, sz], elbow, b.armR * 1.3, b.armR);
      k.limb(sock, elbow, wrist, b.armR, b.armR * 0.85);
      k.blob(sock, [wrist[0], wrist[1] - 0.01, wrist[2] - 0.05], [b.armR * 1.15, b.armR * 0.95, b.armR * 1.35]);
    });
  }
}

/** Offsets from a head's centre, so a skull is sketched around its own origin. */
const from =
  (c: V3) =>
  (x: number, y: number, z: number): V3 => [c[0] + x, c[1] + y, c[2] + z];

function badger(k: Sketch, blue: number): Rig {
  const grey = 0x7d828c;
  const black = 0x26232b;
  const white = 0xf3efe4;
  const c: V3 = [0, 1.22, -0.08];
  const h = from(c);
  const b: Build = {
    fur: grey,
    belly: black,
    sock: black,
    torso: [0.3, 0.36, 0.27],
    torsoY: 0.68,
    hipY: 0.4,
    stance: 0.16,
    legR: 0.085,
    armR: 0.075,
    head: c,
    neckR: 0.17,
    scarf: blue,
  };
  const rig = trunk(k, b);
  limbs(k, b, rig);
  k.in('head', () => {
    // A low wedge: a flat broad skull running straight into a long tapering snout.
    const skin = k.form(
      [
        lump.ball(h(0, 0, 0.04), [0.27, 0.22, 0.27]),
        lump.rod(h(0, -0.04, -0.14), h(0, -0.1, -0.5), 0.15, 0.065),
        lump.ball(h(0, -0.08, -0.12), [0.2, 0.13, 0.2]),
      ],
      c,
      (x, y, z) => {
        const [dx, dy, dz] = [Math.abs(x), y - c[1], z - c[2]];
        if (dy < -0.15) return black;
        // Two black stripes from the nose, widening over each eye and ear, on a white face.
        const t = THREE.MathUtils.clamp((dz + 0.5) / 0.6, 0, 1);
        const stripe = Math.abs(dx - (0.035 + 0.15 * t)) < 0.018 + 0.055 * t;
        if (dz > 0.16) return stripe || dx > 0.19 ? black : grey;
        return stripe ? black : white;
      },
      13,
      0.08,
    );
    for (const side of [-1, 1]) k.eye(skin, [side * 0.52, 0.2, -0.82], 0.036, { iris: 0x1c1410, pupil: 0.9 });
    k.shine(0x1a1418, skin([0, -0.17, -1], -0.01), [0.055, 0.045, 0.04]);
  });
  k.in('ears', () => {
    for (const side of [-1, 1]) {
      k.blob(black, h(side * 0.23, 0.17, 0.08), [0.07, 0.07, 0.04]);
      k.blob(white, h(side * 0.235, 0.2, 0.07), [0.058, 0.05, 0.03]);
    }
  });
  // A canvas trail pack, so Grit reads from behind as well as from the front.
  k.blob(0x9f623a, [0, 0.78, 0.34], [0.2, 0.2, 0.12], [0.1, 0, 0], 'box');
  k.blob(0xc18a51, [0, 0.9, 0.36], [0.21, 0.09, 0.125], [0.1, 0, 0], 'box');
  k.blob(0xf4c474, [0, 0.83, 0.47], [0.045, 0.045, 0.02], [0.1, 0, 0], 'box');
  k.in('tail', () => {
    k.form(
      [lump.rod(rig.tail, [0, 0.4, 0.5], 0.08, 0.1), lump.ball([0, 0.4, 0.52], [0.1, 0.09, 0.13])],
      [0, 0.42, 0.42],
      grey,
      4,
      0.06,
    );
  });
  return rig;
}

function hare(k: Sketch, amber: number): Rig {
  const fur = 0xb98d62;
  const dark = 0x8a6746;
  const c: V3 = [0, 1.36, -0.07];
  const h = from(c);
  const b: Build = {
    fur,
    belly: CREAM,
    torso: [0.21, 0.36, 0.19],
    torsoY: 0.82,
    hipY: 0.58,
    stance: 0.115,
    legR: 0.07,
    armR: 0.055,
    head: c,
    neckR: 0.11,
    scarf: amber,
    coat: (_x, y, z) => (z > 0.02 && y > 0.7 ? dark : undefined),
  };
  const rig = trunk(k, b);
  limbs(k, b, rig);
  k.in('head', () => {
    // A long oval skull with a deep blunt muzzle and full cheeks; the eyes sit out on the sides.
    const skin = k.form(
      [
        lump.ball(h(0, 0.01, 0.03), [0.2, 0.22, 0.25]),
        lump.ball(h(0, -0.07, -0.2), [0.13, 0.14, 0.17]),
        lump.ball(h(-0.09, -0.1, -0.1), [0.11, 0.11, 0.13]),
        lump.ball(h(0.09, -0.1, -0.1), [0.11, 0.11, 0.13]),
      ],
      c,
      (x, y, z) => {
        const [dx, dy, dz] = [Math.abs(x), y - c[1], z - c[2]];
        if (dy < -0.12 && dz < 0.05) return CREAM;
        if (Math.hypot(dx - 0.19, dy - 0.05, (dz + 0.08) * 0.8) < 0.085) return 0xe8d6b8;
        return dy > 0.1 && dx < 0.12 ? dark : fur;
      },
      12,
      0.08,
    );
    for (const side of [-1, 1]) k.eye(skin, [side * 0.86, 0.22, -0.45], 0.06, { iris: 0x3a2414, pupil: 0.8 });
    k.shine(0xc9747a, skin([0, -0.18, -1], -0.008), [0.04, 0.03, 0.025]);
    k.blob(0x6d4a36, skin([0, -0.42, -1], -0.004), [0.008, 0.035, 0.012]);
  });
  k.in('ears', () => {
    for (const side of [-1, 1]) {
      const root = h(side * 0.085, 0.17, 0.1);
      const tip = h(side * (side > 0 ? 0.2 : 0.13), side > 0 ? 0.72 : 0.78, 0.2);
      const mid: V3 = [(root[0] + tip[0]) / 2, (root[1] + tip[1]) / 2, (root[2] + tip[2]) / 2 - 0.02];
      // Long ears with the hare's black tips, pink inside.
      k.limb(fur, root, tip, 0.085, 0.065, 0.5);
      k.blob(0x2e2420, [tip[0], tip[1] + 0.005, tip[2]], [0.068, 0.085, 0.036]);
      k.limb(
        0xe3ab9a,
        [mid[0], mid[1] - 0.14, mid[2] - 0.012],
        [mid[0], mid[1] + 0.12, mid[2] - 0.012],
        0.045,
        0.04,
        0.4,
      );
    }
  });
  k.in('tail', () => {
    k.blob(0x3a2e28, [0, rig.tail[1] + 0.06, rig.tail[2] + 0.04], [0.07, 0.09, 0.07]);
    k.blob(WHITE, [0, rig.tail[1], rig.tail[2] + 0.06], [0.085, 0.085, 0.08]);
  });
  return rig;
}

function fox(k: Sketch): Rig {
  const fur = 0xd4601f;
  const sock = 0x2b2024;
  const c: V3 = [0, 1.26, -0.08];
  const h = from(c);
  const b: Build = {
    fur,
    belly: CREAM,
    sock,
    torso: [0.22, 0.34, 0.2],
    torsoY: 0.74,
    hipY: 0.5,
    stance: 0.12,
    legR: 0.07,
    armR: 0.056,
    head: c,
    neckR: 0.12,
    // Navy, not Blaze's red: red on orange fur disappears.
    scarf: 0x2c3352,
  };
  const rig = trunk(k, b);
  limbs(k, b, rig);
  k.in('head', () => {
    // A wide skull and cheek ruffs that pinch to a long, fine, pointed muzzle.
    const skin = k.form(
      [
        lump.ball(h(0, 0.01, 0.04), [0.25, 0.21, 0.24]),
        lump.rod(h(0, -0.05, -0.14), h(0, -0.11, -0.5), 0.12, 0.042),
        lump.rod(h(-0.13, -0.07, -0.03), h(-0.36, -0.15, 0.06), 0.12, 0.02),
        lump.rod(h(0.13, -0.07, -0.03), h(0.36, -0.15, 0.06), 0.12, 0.02),
      ],
      c,
      (x, y, z) => {
        const [dx, dy, dz] = [Math.abs(x), y - c[1], z - c[2]];
        // White lips, jaw and cheeks, rising toward the tips of the ruff.
        return dz < 0.12 && dy < -0.085 + 0.42 * Math.max(0, dx - 0.07) ? WHITE : fur;
      },
      14,
      0.07,
    );
    for (const side of [-1, 1]) {
      k.eye(skin, [side * 0.42, 0.16, -0.88], 0.045, {
        iris: 0xd9941f,
        slit: true,
        lid: { color: fur, cover: 0.3, tilt: 0.35 },
      });
    }
    k.shine(0x1a1418, skin([0, -0.2, -1], -0.006), [0.04, 0.034, 0.03]);
  });
  k.in('ears', () => {
    for (const side of [-1, 1]) {
      const at = h(side * 0.16, 0.3, 0.07);
      // Big upright ears, black behind and pale inside.
      k.blob(sock, at, [0.105, 0.2, 0.08], [0.12, 0, side * -0.22], 'point');
      k.blob(fur, [at[0], at[1] - 0.09, at[2] + 0.004], [0.11, 0.12, 0.055], [0.12, 0, side * -0.22], 'point');
      k.blob(0xf2dcc2, [at[0], at[1] - 0.03, at[2] - 0.03], [0.065, 0.15, 0.03], [0.12, 0, side * -0.22], 'point');
    }
  });
  k.in('tail', () => {
    // A brush as long as the body, thickest two thirds along, with a white tip.
    k.form(
      [
        lump.rod(rig.tail, [0, 0.72, 0.56], 0.06, 0.17),
        lump.rod([0, 0.72, 0.56], [0, 0.98, 0.84], 0.17, 0.15),
        lump.rod([0, 0.98, 0.84], [0, 1.16, 0.98], 0.15, 0.03),
      ],
      [0, 0.8, 0.62],
      (_x, y, z) => ((y - 0.98) * 0.62 + (z - 0.84) * 0.78 > 0.02 ? WHITE : fur),
      8,
      0.05,
    );
  });
  return rig;
}

function panther(k: Sketch): Rig {
  const fur = 0x2c2733;
  const sheen = 0x403a4d;
  const c: V3 = [0, 1.24, -0.07];
  const h = from(c);
  const b: Build = {
    fur,
    belly: 0x38323f,
    torso: [0.24, 0.34, 0.21],
    torsoY: 0.72,
    hipY: 0.47,
    stance: 0.13,
    legR: 0.08,
    armR: 0.066,
    head: c,
    neckR: 0.13,
    // Lavender: Shade's slate marker is lost against black fur.
    scarf: 0x8f8db8,
  };
  const rig = trunk(k, b);
  limbs(k, b, rig);
  k.in('head', () => {
    // A cat's head: round and broad, with a short muzzle built from two whisker pads and a chin.
    const skin = k.form(
      [
        lump.ball(h(0, 0, 0.03), [0.26, 0.23, 0.25]),
        lump.ball(h(0, -0.07, -0.19), [0.13, 0.1, 0.12]),
        lump.ball(h(-0.06, -0.09, -0.26), [0.075, 0.062, 0.07]),
        lump.ball(h(0.06, -0.09, -0.26), [0.075, 0.062, 0.07]),
        lump.ball(h(0, -0.15, -0.22), [0.06, 0.05, 0.07]),
      ],
      c,
      (x, y, z) => {
        const [dx, dy, dz] = [Math.abs(x), y - c[1], z - c[2]];
        return dz < -0.2 && dy < -0.03 && dx < 0.14 ? sheen : fur;
      },
      13,
      0.05,
    );
    for (const side of [-1, 1]) {
      k.eye(skin, [side * 0.42, 0.14, -0.9], 0.058, {
        iris: 0xe6c341,
        slit: true,
        lid: { color: fur, cover: 0.26, tilt: 0.3 },
      });
    }
    k.shine(0x9a6672, skin([0, -0.16, -1], -0.012), [0.04, 0.028, 0.025]);
  });
  k.in('ears', () => {
    for (const side of [-1, 1]) {
      k.blob(fur, h(side * 0.19, 0.2, 0.06), [0.085, 0.085, 0.04], [0, 0, side * -0.3]);
      k.blob(0x6b5a6e, h(side * 0.19, 0.2, 0.035), [0.05, 0.052, 0.022], [0, 0, side * -0.3]);
    }
  });
  k.in('tail', () => {
    const path: V3[] = [
      rig.tail,
      [0.02, 0.44, 0.42],
      [0.06, 0.4, 0.6],
      [0.11, 0.44, 0.78],
      [0.15, 0.56, 0.9],
      [0.18, 0.72, 0.94],
      [0.19, 0.88, 0.9],
      [0.18, 1.0, 0.8],
    ];
    for (let i = 1; i < path.length; i++) k.limb(fur, path[i - 1] as V3, path[i] as V3, 0.05, 0.05);
  });
  return rig;
}

function chipmunk(k: Sketch, pink: number): Rig {
  const fur = 0xb26f3d;
  const stripe = 0x3d2a22;
  const pale = 0xf1e3c6;
  const c: V3 = [0, 1.12, -0.08];
  const h = from(c);
  // Five dark and four pale stripes run down a chipmunk's back.
  const back = (x: number): number | undefined => {
    const dx = Math.abs(x);
    if (dx < 0.022 || (dx > 0.085 && dx < 0.115) || (dx > 0.16 && dx < 0.185)) return stripe;
    if (dx > 0.115 && dx < 0.16) return pale;
    return undefined;
  };
  const b: Build = {
    fur,
    belly: pale,
    torso: [0.25, 0.31, 0.23],
    torsoY: 0.62,
    hipY: 0.38,
    stance: 0.13,
    legR: 0.07,
    armR: 0.056,
    head: c,
    neckR: 0.14,
    scarf: pink,
    coat: (x, y, z) => (z > 0.06 && y < 0.86 ? back(x) : undefined),
  };
  const rig = trunk(k, b);
  limbs(k, b, rig);
  k.in('head', () => {
    // A small pointed face on stuffed cheek pouches.
    const skin = k.form(
      [
        lump.ball(h(0, 0.01, 0.03), [0.23, 0.21, 0.24]),
        lump.rod(h(0, -0.04, -0.14), h(0, -0.09, -0.4), 0.12, 0.05),
        lump.ball(h(-0.15, -0.09, -0.08), [0.15, 0.13, 0.15]),
        lump.ball(h(0.15, -0.09, -0.08), [0.15, 0.13, 0.15]),
      ],
      c,
      (x, y, z) => {
        const [dx, dy, dz] = [Math.abs(x), y - c[1], z - c[2]];
        if (dz < 0.1 && dy < -0.1) return pale;
        if (dz > 0.12) return dx < 0.03 ? stripe : fur;
        // Face stripes: pale above and below the eye, dark through it, dark down the crown.
        const lift = dy - 0.25 * (dz + 0.2);
        if (dx > 0.06 && lift > 0.075 && lift < 0.105) return pale;
        if (dx > 0.06 && lift > 0.035 && lift < 0.075) return stripe;
        if (dx > 0.06 && lift > 0.0 && lift < 0.035) return pale;
        return dx < 0.03 && dy > 0.05 ? stripe : fur;
      },
      14,
      0.07,
    );
    for (const side of [-1, 1]) k.eye(skin, [side * 0.6, 0.27, -0.75], 0.046, { iris: 0x17100e, pupil: 0.9 });
    k.shine(0x4a2f2a, skin([0, -0.2, -1], -0.006), [0.032, 0.026, 0.024]);
  });
  k.in('ears', () => {
    for (const side of [-1, 1]) {
      k.blob(fur, h(side * 0.17, 0.2, 0.08), [0.06, 0.07, 0.035], [0, 0, side * -0.25]);
      k.blob(0xd9a58a, h(side * 0.17, 0.2, 0.058), [0.036, 0.044, 0.02], [0, 0, side * -0.25]);
    }
  });
  k.in('tail', () => {
    // Held straight up the back, flat and bushy, dark down the middle with a pale edge.
    k.form(
      [lump.rod(rig.tail, [0, 0.62, 0.42], 0.06, 0.1), lump.ball([0, 0.9, 0.5], [0.15, 0.36, 0.1], [0.12, 0, 0])],
      [0, 0.8, 0.46],
      (x, y) => (y < 0.56 ? fur : Math.abs(x) < 0.035 ? stripe : Math.abs(x) > 0.105 ? pale : fur),
      9,
      0.06,
    );
  });
  return rig;
}

function tortoise(k: Sketch, green: number): Rig {
  const skin0 = 0x8c8a55;
  const scute = 0x6b5633;
  const seam = 0x3d3220;
  const plastron = 0xe8d58e;
  const c: V3 = [0, 1.2, -0.2];
  const h = from(c);
  const b: Build = {
    fur: skin0,
    belly: plastron,
    torso: [0.3, 0.36, 0.24],
    torsoY: 0.66,
    hipY: 0.36,
    stance: 0.17,
    legR: 0.095,
    armR: 0.08,
    head: c,
    neckR: 0.1,
    scarf: null,
    stumpy: true,
  };
  // The carapace's scutes: a row down the spine, a row each side, and a rim of marginals.
  const dome: V3 = [0, 0.7, 0.14];
  const cells: V3[] = [];
  for (const y of [-0.24, -0.08, 0.08, 0.24]) cells.push([0, y, 1]);
  for (const side of [-1, 1]) for (const y of [-0.17, 0, 0.17]) cells.push([side * 0.2, y, 0.8]);
  const shell = (x: number, y: number): number => {
    const [dx, dy] = [x - dome[0], y - dome[1]];
    const rim = Math.hypot(dx / 0.36, dy / 0.4);
    if (rim > 0.82) return Math.abs(((Math.atan2(dy, dx) / Math.PI) * 9) % 1) < 0.14 ? seam : 0x8a7343;
    let [nearest, second] = [Infinity, Infinity];
    for (const cell of cells) {
      const d = Math.hypot(dx - cell[0], dy - cell[1]) / cell[2];
      if (d < nearest) [nearest, second] = [d, nearest];
      else if (d < second) second = d;
    }
    // Seams where two scutes meet; each scute pales toward its centre like growth rings.
    if (second - nearest < 0.028) return seam;
    return nearest < 0.045 ? 0xa8904f : nearest < 0.085 ? 0x86703d : scute;
  };
  const rig: Rig = {
    neck: [0, 0.98, -0.1],
    shoulder: [0.28, 0.82, -0.04],
    hip: [b.stance, b.hipY, 0.04],
    tail: [0, 0.36, 0.3],
  };
  k.form(
    [
      lump.ball(dome, [0.37, 0.41, 0.3]),
      lump.ball([0, 0.68, -0.02], [0.3, 0.34, 0.16]),
      lump.rod([0, 0.9, -0.06], h(0, -0.06, 0.06), 0.12, 0.09),
    ],
    [0, 0.72, 0.06],
    (x, y, z) => {
      if (y > 0.96 && z < 0.02) return skin0;
      if (z > 0.07) return shell(x, y);
      // A pale band where carapace meets plastron, then the flat yellow underside.
      return z > 0.02 ? 0x8a7343 : plastron;
    },
    15,
    0.06,
  );
  // Racing stripes in Duke's green, painted over the shell.
  for (const side of [-1, 1]) {
    k.limb(green, [side * 0.085, 1.08, 0.24], [side * 0.085, 0.92, 0.41], 0.026, 0.026, 0.5);
    k.limb(green, [side * 0.085, 0.92, 0.41], [side * 0.085, 0.6, 0.445], 0.026, 0.026, 0.5);
    k.limb(green, [side * 0.085, 0.6, 0.445], [side * 0.085, 0.38, 0.33], 0.026, 0.026, 0.5);
  }
  limbs(k, b, rig);
  k.in('head', () => {
    // A blunt reptile head: flat on top, with a hard beak and a down-turned mouth line.
    const skin = k.form(
      [
        lump.ball(h(0, 0, 0.02), [0.16, 0.14, 0.19]),
        lump.ball(h(0, -0.03, -0.13), [0.13, 0.11, 0.13]),
        lump.ball(h(-0.09, 0.06, -0.07), [0.06, 0.05, 0.08]),
        lump.ball(h(0.09, 0.06, -0.07), [0.06, 0.05, 0.08]),
      ],
      c,
      (x, y, z) => {
        const [dx, dy, dz] = [Math.abs(x), y - c[1], z - c[2]];
        if (dz < -0.1 && Math.abs(dy + 0.065 + 0.12 * dx) < 0.009) return seam;
        if (dy < -0.07) return 0xb5ad6a;
        return dz < -0.2 && dx < 0.05 ? 0x6f6c40 : skin0;
      },
      11,
      0.05,
    );
    for (const side of [-1, 1]) {
      k.eye(skin, [side * 0.62, 0.2, -0.7], 0.036, {
        iris: 0x1d1a12,
        pupil: 0.9,
        lid: { color: 0x77753f, cover: 0.42, tilt: -0.2 },
      });
      k.blob(seam, skin([side * 0.12, 0.05, -1], -0.006), [0.008, 0.008, 0.008]);
    }
    k.blob(green, h(0, 0.105, 0.03), [0.15, 0.03, 0.17]);
  });
  k.in('tail', () => k.blob(skin0, [0, 0.33, 0.36], [0.045, 0.1, 0.045], [-2.2, 0, 0], 'point'));
  return rig;
}

function owl(k: Sketch, blue: number): Rig {
  const feather = 0x7b5a3c;
  const dark = 0x4a3524;
  const buff = 0xe6cfa0;
  const c: V3 = [0, 1.13, -0.05];
  const h = from(c);
  const rig: Rig = {
    neck: [0, 0.94, -0.02],
    shoulder: [0.27, 0.86, 0.02],
    hip: [0.11, 0.3, 0.02],
    tail: [0, 0.38, 0.22],
  };
  // An owl has no visible neck: the body is one upright egg, barred buff and brown down the front.
  k.form(
    [lump.ball([0, 0.62, 0], [0.3, 0.4, 0.26]), lump.ball([0, 0.86, -0.01], [0.26, 0.2, 0.22])],
    [0, 0.64, 0],
    (x, y, z) => {
      if (z > -0.08 - 0.9 * x * x) return Math.sin(y * 34 + Math.abs(x) * 9) > 0.55 ? dark : feather;
      return Math.sin(y * 46 - Math.abs(x) * 22) > 0.5 ? feather : buff;
    },
    11,
    0.1,
  );
  k.blob(blue, [0, 0.96, -0.01], [0.24, 0.05, 0.21]);
  k.blob(blue, [0.03, 0.97, 0.2], [0.05, 0.04, 0.04]);
  k.limb(blue, [0.03, 0.96, 0.2], [0.12, 0.76, 0.3], 0.045, 0.025, 0.45);
  k.limb(blue, [0.03, 0.96, 0.2], [-0.05, 0.72, 0.28], 0.045, 0.025, 0.45);
  for (const side of [-1, 1]) {
    k.in(side < 0 ? 'legL' : 'legR', () => {
      const x = side * 0.11;
      // Feathered thighs over bare yellow feet: three talons forward and one back.
      k.limb(buff, [x, 0.3, 0.02], [x, 0.14, 0.02], 0.085, 0.06);
      k.limb(0xd9a02e, [x, 0.14, 0.02], [x, 0.05, 0.0], 0.04, 0.036);
      for (const toe of [-1, 0, 1]) {
        k.limb(0xd9a02e, [x, 0.04, 0], [x + toe * 0.065, 0.032, -0.14], 0.032, 0.024);
        k.blob(0x2a221c, [x + toe * 0.075, 0.03, -0.17], [0.014, 0.032, 0.014], [-1.9, 0, 0], 'point');
      }
      k.limb(0xd9a02e, [x, 0.04, 0], [x, 0.032, 0.09], 0.03, 0.022);
    });
    k.in(side < 0 ? 'armL' : 'armR', () => {
      const [sx, sy] = rig.shoulder;
      // A folded wing: one blade from the shoulder to past the hip, barred like flight feathers.
      k.form(
        [
          lump.ball([side * (sx + 0.02), sy - 0.16, 0.05], [0.07, 0.2, 0.17], [0.2, 0, side * 0.12]),
          lump.ball([side * (sx + 0.04), sy - 0.42, 0.14], [0.045, 0.2, 0.11], [0.5, 0, side * 0.12]),
        ],
        [side * (sx + 0.03), sy - 0.26, 0.08],
        (_x, y, z) => (Math.sin((y - z * 0.7) * 42) > 0.45 ? dark : feather),
        6,
        0.06,
      );
    });
  }
  k.in('head', () => {
    // A wide flat-faced head. The facial disc and brow are painted on, ringed in dark feathers.
    const skin = k.form(
      [lump.ball(h(0, 0, 0.02), [0.3, 0.24, 0.25]), lump.ball(h(0, -0.02, -0.1), [0.25, 0.2, 0.16])],
      c,
      (x, y, z) => {
        const [dx, dy, dz] = [Math.abs(x), y - c[1], z - c[2]];
        if (dz > -0.02) return Math.sin(y * 40 + dx * 12) > 0.6 ? dark : feather;
        const ring = Math.hypot(dx - 0.115, (dy - 0.01) * 1.05);
        if (ring < 0.135) return ring > 0.118 ? dark : Math.sin(ring * 150) > 0.7 ? 0xcdb07c : buff;
        return dy > 0.02 && dx < 0.1 ? WHITE : feather;
      },
      13,
      0.08,
    );
    for (const side of [-1, 1]) k.eye(skin, [side * 0.42, 0.06, -0.9], 0.075, { iris: 0xf0b21e, pupil: 0.55 });
    k.blob(0x3a2e22, skin([0, -0.12, -1], 0.012), [0.04, 0.075, 0.05], [Math.PI + 0.75, 0, 0], 'point');
  });
  k.in('ears', () => {
    for (const side of [-1, 1]) {
      k.blob(dark, h(side * 0.2, 0.25, 0.0), [0.07, 0.13, 0.035], [0.1, 0, side * -0.55], 'point');
      k.blob(feather, h(side * 0.19, 0.22, -0.02), [0.04, 0.09, 0.02], [0.1, 0, side * -0.55], 'point');
    }
  });
  k.in('tail', () => {
    for (const side of [-1, 0, 1]) {
      k.blob(side === 0 ? feather : dark, [side * 0.085, 0.3, 0.33], [0.07, 0.025, 0.17], [0.75, side * -0.4, 0]);
    }
  });
  return rig;
}

function wolf(k: Sketch, yellow: number): Rig {
  const fur = 0x6f7783;
  const dark = 0x434954;
  const pale = 0xe4e1d8;
  const c: V3 = [0, 1.36, -0.09];
  const h = from(c);
  const b: Build = {
    fur,
    belly: pale,
    torso: [0.26, 0.37, 0.23],
    torsoY: 0.8,
    hipY: 0.54,
    stance: 0.135,
    legR: 0.08,
    armR: 0.066,
    head: c,
    neckR: 0.16,
    scarf: yellow,
    // A dark saddle over the shoulders and down the spine.
    coat: (x, y, z) => (z > 0.1 && Math.abs(x) < 0.16 - (0.96 - y) * 0.12 ? dark : undefined),
  };
  const rig = trunk(k, b);
  limbs(k, b, rig);
  k.in('head', () => {
    // Heavier than the fox everywhere: a broad skull, a deep square muzzle and a thick neck ruff.
    const skin = k.form(
      [
        lump.ball(h(0, 0.01, 0.05), [0.26, 0.23, 0.26]),
        lump.rod(h(0, -0.05, -0.14), h(0, -0.1, -0.52), 0.14, 0.085),
        lump.ball(h(0, 0.07, -0.16), [0.17, 0.08, 0.1]),
        lump.rod(h(-0.14, -0.08, 0.0), h(-0.36, -0.2, 0.1), 0.14, 0.03),
        lump.rod(h(0.14, -0.08, 0.0), h(0.36, -0.2, 0.1), 0.14, 0.03),
      ],
      c,
      (x, y, z) => {
        const [dx, dy, dz] = [Math.abs(x), y - c[1], z - c[2]];
        if (dz < 0.16 && dy < -0.075 + 0.36 * Math.max(0, dx - 0.08)) return pale;
        // Pale spots over the eyes, a dark line down the muzzle and a dark crown.
        if (Math.hypot(dx - 0.1, dy - 0.135, (dz + 0.2) * 0.6) < 0.04) return pale;
        if (dx < 0.05 && dz < -0.2) return dark;
        return dy > 0.12 || dz > 0.2 ? dark : fur;
      },
      14,
      0.07,
    );
    for (const side of [-1, 1]) {
      k.eye(skin, [side * 0.38, 0.14, -0.9], 0.042, {
        iris: 0xe2b23a,
        pupil: 0.45,
        lid: { color: dark, cover: 0.34, tilt: 0.45 },
      });
    }
    k.shine(0x16131a, skin([0, -0.17, -1], -0.01), [0.055, 0.045, 0.04]);
  });
  k.in('ears', () => {
    for (const side of [-1, 1]) {
      const at = h(side * 0.17, 0.27, 0.1);
      k.blob(dark, at, [0.09, 0.15, 0.075], [0.1, 0, side * -0.24], 'point');
      k.blob(0xb9b4ac, [at[0], at[1] - 0.03, at[2] - 0.028], [0.05, 0.1, 0.025], [0.1, 0, side * -0.24], 'point');
    }
  });
  k.in('tail', () => {
    // A thick tail carried low, dark along the top and at the tip.
    k.form(
      [
        lump.rod(rig.tail, [0, 0.5, 0.46], 0.07, 0.13),
        lump.rod([0, 0.5, 0.46], [0, 0.36, 0.68], 0.13, 0.12),
        lump.rod([0, 0.36, 0.68], [0, 0.26, 0.82], 0.12, 0.04),
      ],
      [0, 0.45, 0.54],
      (_x, y, z) => (z > 0.74 || y - 0.5 + (z - 0.5) * 0.55 > 0.09 ? dark : fur),
      8,
      0.05,
    );
  });
  return rig;
}

/** Each character's sketch and its overall size, so the cast differs in height as well as shape. */
const MODELS: Record<CharacterId, { draw: (k: Sketch, accent: number) => Rig; scale: number }> = {
  grit: { draw: badger, scale: 1.2 },
  skip: { draw: hare, scale: 1.12 },
  blaze: { draw: fox, scale: 1.2 },
  shade: { draw: panther, scale: 1.18 },
  cheeks: { draw: chipmunk, scale: 1.14 },
  duke: { draw: tortoise, scale: 1.2 },
  dusk: { draw: owl, scale: 1.3 },
  fang: { draw: wolf, scale: 1.22 },
};

type Pieces = Record<Slot | 'face', THREE.BufferGeometry[]>;

function place(geometry: THREE.BufferGeometry, at: V3, turn: V3 = [0, 0, 0]): THREE.BufferGeometry {
  return geometry.rotateX(turn[0]).rotateY(turn[1]).rotateZ(turn[2]).translate(at[0], at[1], at[2]);
}

function ball(color: Paint, at: V3, size: V3, turn?: V3, glossy = false): THREE.BufferGeometry {
  const unit = sphereFor(Math.max(size[0], size[1], size[2]), glossy);
  return paint(place(unit.clone().scale(size[0], size[1], size[2]), at, turn), color);
}

/** Builds an eye facing -z at the origin, then turns it to face out of the head and sets it in place. */
function drawEye(pieces: Pieces, slot: Slot, skin: Skin, dir: V3, r: number, look: Look): void {
  const side = Math.sign(dir[0]);
  const yaw = -Math.atan2(dir[0], -dir[2]);
  const at = skin(dir, -r * 0.45);
  const set = (geometry: THREE.BufferGeometry) => geometry.rotateY(yaw).translate(at[0], at[1], at[2]);
  const { iris = 0x5a3a22, white = iris, slit = false, pupil = 0.5, lid } = look;
  pieces.face.push(
    set(ball(white, [0, 0, 0], [r, r, r * 0.62], undefined, true)),
    set(
      ball(
        INK,
        [0, 0, -r * 0.5],
        [r * (slit ? 0.2 : pupil * 0.8), r * (slit ? 0.7 : pupil * 0.8), r * 0.22],
        undefined,
        true,
      ),
    ),
    set(ball(WHITE, [-r * 0.3, r * 0.32, -r * 0.62], [r * 0.2, r * 0.2, r * 0.1], undefined, true)),
  );
  if (lid) {
    const y = r * (1.7 - lid.cover * 1.6);
    pieces[slot].push(set(ball(lid.color, [0, y, -r * 0.1], [r * 1.25, r * 0.8, r * 0.7], [0, 0, side * lid.tilt])));
  }
}

/** Merges a bucket, scales it and centres it on `pivot` (or, without one, a point near its base). */
function finish(list: THREE.BufferGeometry[], scale: number, pivot?: V3): Pivoted | undefined {
  if (list.length === 0) return undefined;
  const merged = mergeGeometries(list).scale(scale, scale, scale);
  for (const piece of list) piece.dispose();
  const at = new THREE.Vector3();
  if (pivot) at.set(pivot[0], pivot[1], pivot[2]).multiplyScalar(scale);
  else {
    merged.computeBoundingBox();
    const bounds = merged.boundingBox as THREE.Box3;
    at.set(0, bounds.min.y + (bounds.max.y - bounds.min.y) * 0.25, (bounds.min.z + bounds.max.z) / 2);
  }
  merged.translate(-at.x, -at.y, -at.z);
  return { geometry: merged, pivot: at };
}

/**
 * Builds a character as vertex-coloured pieces: trunk, head with its glossy face, ears, arms, legs
 * and tail, each centred on the joint it turns about. The result is cached per character and shared
 * by every RacerView for that character. Callers must never dispose it.
 */
export function geometryFor(character: CharacterId): RacerGeometry {
  const cached = geometries.get(character);
  if (cached) return cached;
  const { draw, scale } = MODELS[character];
  const pieces: Pieces = { torso: [], head: [], face: [], ears: [], tail: [], armL: [], armR: [], legL: [], legR: [] };
  let slot: Slot = 'torso';
  const k: Sketch = {
    blob(color, at, size, turn, shape = 'round') {
      if (shape === 'round') pieces[slot].push(ball(color, at, size, turn));
      else pieces[slot].push(paint(place((shape === 'point' ? cone : box).clone().scale(...size), at, turn), color));
    },
    limb: (color, a, b, ra, rb, flat) => void pieces[slot].push(paint(taper(a, b, ra, rb, flat), color)),
    form(lumps, centre, color, detail = 10, blend = 0.07) {
      const { geometry, skin } = sculpt(lumps, centre, color, detail, blend);
      pieces[slot].push(geometry);
      return skin;
    },
    shine: (color, at, size, turn) => void pieces.face.push(ball(color, at, size, turn, true)),
    eye: (skin, dir, r, look = {}) => drawEye(pieces, slot, skin, dir, r, look),
    in(next, drawSlot) {
      const outer = slot;
      slot = next;
      drawSlot();
      slot = outer;
    },
  };
  const rig = draw(k, RACER_COLORS[character]);
  const mirrored = ([x, y, z]: V3): V3 => [-x, y, z];
  const need = (list: THREE.BufferGeometry[], pivot?: V3) => finish(list, scale, pivot) as Pivoted;
  const head = need(pieces.head, rig.neck);
  const ears = finish(pieces.ears, scale);
  ears?.pivot.sub(head.pivot);
  const geometry: RacerGeometry = {
    torso: need(pieces.torso, [0, 0, 0]).geometry,
    head,
    face: need(pieces.face, rig.neck).geometry,
    ears,
    arms: [need(pieces.armL, mirrored(rig.shoulder)), need(pieces.armR, rig.shoulder)],
    legs: [need(pieces.legL, mirrored(rig.hip)), need(pieces.legR, rig.hip)],
    tail: finish(pieces.tail, scale, rig.tail),
  };
  geometries.set(character, geometry);
  return geometry;
}
