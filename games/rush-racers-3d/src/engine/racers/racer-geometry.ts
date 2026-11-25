import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
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

const CREAM = 0xffe5bb;
const INK = 0x272230;
const NOSE = 0x412b30;
const WHITE = 0xfff8ec;

const spheres = new Map<string, THREE.BufferGeometry>();

/** Sphere detail grows with part size (28x18 for big masses), so a racer stays under 15k triangles. */
function sphereFor(radius: number, glossy: boolean): THREE.BufferGeometry {
  const [w, h] = radius > 0.3 ? [28, 18] : radius > 0.12 || glossy ? [20, 13] : [14, 10];
  const key = `${w}x${h}`;
  let geometry = spheres.get(key);
  if (!geometry) {
    geometry = new THREE.SphereGeometry(1, w, h);
    spheres.set(key, geometry);
  }
  return geometry;
}

/** A cone with a rounded tip, smooth-shaded, for ears, beaks and tail tips. */
const cone = new THREE.LatheGeometry(
  Array.from({ length: 13 }, (_, i) => {
    const t = i / 12;
    return new THREE.Vector2((1 - t) ** 0.8 * (1 - 0.12 * (1 - t) ** 6), -1 + 2 * t);
  }),
  20,
);
const box = new RoundedBoxGeometry(2, 2, 2, 3, 0.55);

/**
 * `round` is a smooth blob, `point` a rounded cone, `box` a rounded box. `gloss` is a shiny blob
 * (nose, lenses, eye whites) and `eye` is a shiny blob with a white catch-light dot.
 */
type Shape = 'round' | 'point' | 'box' | 'gloss' | 'eye';
/** Parts in a group move on their own in the view: `tail` sways, `ears` flick. */
type Group = 'body' | 'tail' | 'ears';
interface Part {
  (
    color: number,
    x: number,
    y: number,
    z: number,
    width: number,
    height: number,
    depth: number,
    tiltX?: number,
    tiltZ?: number,
    shape?: Shape,
  ): void;
  /** Runs `draw` so every part it adds belongs to `group`. */
  group(group: Group, draw: () => void): void;
}
interface Limb {
  size: [width: number, height: number, depth: number];
  x: number;
  y: number;
  front: number;
  back?: number;
}

/** A piece of the body that is posed on its own, turning about `pivot`; its geometry is centered there. */
interface Pivoted {
  geometry: THREE.BufferGeometry;
  pivot: THREE.Vector3;
}

interface RacerGeometry {
  /** Fur, feathers and shell: the matte vertex-colored mass. */
  body: THREE.BufferGeometry;
  /** Eyes, noses and lenses, drawn with a glossy material. */
  gloss: THREE.BufferGeometry;
  leg: THREE.BufferGeometry;
  limbs: Limb;
  tail?: Pivoted;
  ears?: Pivoted;
}

const geometries = new Map<CharacterId, RacerGeometry>();

function paint(geometry: THREE.BufferGeometry, hex: number): THREE.BufferGeometry {
  const color = new THREE.Color(hex);
  const rgb = new Float32Array(geometry.getAttribute('position').count * 3);
  for (let i = 0; i < rgb.length; i += 3) color.toArray(rgb, i);
  geometry.setAttribute('color', new THREE.BufferAttribute(rgb, 3));
  return geometry;
}

function face(part: Part, y: number, z: number, width: number, muzzle: number, bib = CREAM): void {
  part(bib, 0, y - 0.13, z - 0.12, width * 1.05, 0.135, muzzle);
  part(NOSE, 0, y - 0.1, z - 0.12 - muzzle, 0.105, 0.075, 0.07, 0, 0, 'gloss');
  for (const side of [-1, 1]) part(INK, side * width, y + 0.04, z, 0.085, 0.1, 0.07, 0, 0, 'eye');
}

/** A white eye with a dark pupil, for faces whose surroundings are too dark for a bare dark eye. */
function bigEye(part: Part, x: number, y: number, z: number, size: number): void {
  part(WHITE, x, y, z, size, size * 1.1, size * 0.7, 0, 0, 'gloss');
  part(INK, x, y - size * 0.05, z - size * 0.42, size * 0.62, size * 0.75, size * 0.4, 0, 0, 'eye');
}

function badger(part: Part, blue: number): void {
  part(0x596275, 0, 0.83, 0.12, 0.66, 0.58, 0.64);
  part(0xe1ddd2, 0, 1.04, -0.48, 0.49, 0.39, 0.51);
  part(0xf7eddb, 0, 1.31, 0.02, 0.16, 0.18, 0.61, -0.08);
  for (const side of [-1, 1]) {
    part(INK, side * 0.25, 1.12, -0.68, 0.19, 0.28, 0.35, 0.24, side * -0.19);
    part(0x4b5265, side * 0.35, 1.44, -0.37, 0.14, 0.15, 0.12);
    bigEye(part, side * 0.19, 1.1, -0.93, 0.1);
  }
  part(NOSE, 0, 0.98, -0.97, 0.14, 0.105, 0.12, 0, 0, 'gloss');
  part(blue, 0, 1.41, -0.55, 0.48, 0.11, 0.43);
  part(INK, 0, 1.43, -0.93, 0.19, 0.16, 0.115);
  part(0xffd768, 0, 1.45, -1.02, 0.125, 0.11, 0.045);
  part.group('tail', () => part(0x8993a0, 0, 0.68, 0.76, 0.18, 0.155, 0.23));
}

function hare(part: Part, amber: number): void {
  part(0xd5a26e, 0, 1.12, 0.15, 0.37, 0.67, 0.38, -0.21);
  part(amber, 0, 1.03, 0.21, 0.385, 0.32, 0.4);
  part(0xc79064, 0, 1.72, -0.21, 0.37, 0.35, 0.37);
  face(part, 1.72, -0.49, 0.21, 0.15);
  part.group('ears', () => {
    for (const side of [-1, 1]) {
      const x = side * 0.22;
      part(0xc79064, x, 2.29, -0.15, 0.145, side > 0 ? 0.54 : 0.48, 0.135, 0.17, side * -0.17);
      part(0xf6c3a2, x, 2.33, -0.24, 0.08, 0.37, 0.063, 0.17, side * -0.17);
    }
  });
  part.group('tail', () => part(CREAM, 0, 0.94, 0.58, 0.21, 0.22, 0.21));
}

function fox(part: Part, red: number): void {
  part(red, 0, 0.9, 0.14, 0.47, 0.51, 0.58);
  part(0xc14424, 0, 1.27, -0.44, 0.43, 0.37, 0.45);
  face(part, 1.21, -0.73, 0.22, 0.22);
  part.group('ears', () => {
    for (const side of [-1, 1]) {
      part(red, side * 0.29, 1.66, -0.43, 0.218, 0.35, 0.18, 0.05, side * -0.16, 'point');
      part(0xffbd8f, side * 0.29, 1.65, -0.52, 0.134, 0.22, 0.11, 0.05, side * -0.16, 'point');
    }
  });
  part.group('tail', () => {
    part(0xe36b29, -0.19, 1.08, 0.92, 0.29, 0.29, 0.64, -0.53, -0.19);
    part(CREAM, -0.21, 1.32, 1.29, 0.24, 0.22, 0.26, -0.5);
  });
}

function panther(part: Part, slate: number): void {
  part(0x302836, 0, 0.8, 0.1, 0.49, 0.48, 0.58);
  part(0x382e3d, 0, 1.14, -0.49, 0.49, 0.43, 0.39);
  part(0x775893, 0, 1.08, -0.2, 0.47, 0.13, 0.37, 0.18);
  part(slate, 0, 1.15, 0.055, 0.29, 0.15, 0.38, -0.15);
  for (const side of [-1, 1]) {
    part.group('ears', () => {
      part(0x392c42, side * 0.32, 1.5, -0.42, 0.19, 0.2, 0.13);
      part(0x846b85, side * 0.32, 1.51, -0.53, 0.104, 0.118, 0.047);
    });
    part(0xffcf69, side * 0.26, 1.21, -0.8, 0.1, 0.085, 0.07, 0, 0, 'gloss');
    part(INK, side * 0.26, 1.21, -0.86, 0.04, 0.07, 0.035, 0, 0, 'eye');
  }
  part(0x645164, 0, 1.02, -0.82, 0.23, 0.125, 0.14);
  part(INK, 0, 1.06, -0.95, 0.1, 0.06, 0.065, 0, 0, 'gloss');
  part.group('tail', () => {
    part(0x3c3144, 0.18, 0.96, 0.91, 0.12, 0.14, 0.49, -0.38, -0.29);
    part(0x4a3958, 0.33, 1.2, 1.27, 0.12, 0.29, 0.13, 0.16, -0.26);
  });
}

function chipmunk(part: Part, pink: number): void {
  part(0xab694b, 0, 0.82, 0.14, 0.45, 0.48, 0.43);
  part(0xbc7d55, 0, 1.24, -0.27, 0.44, 0.39, 0.39);
  part(CREAM, 0, 1.1, -0.56, 0.37, 0.22, 0.19);
  part(NOSE, 0, 1.16, -0.75, 0.11, 0.08, 0.07, 0, 0, 'gloss');
  part(pink, 0, 1.39, -0.29, 0.45, 0.105, 0.41, 0.09);
  part.group('ears', () => {
    for (const side of [-1, 1]) part(0xad6948, side * 0.29, 1.57, -0.23, 0.13, 0.155, 0.1);
  });
  for (const side of [-1, 1]) {
    part(0xd9a077, side * 0.3, 1.1, -0.4, 0.17, 0.15, 0.16);
    part(0x623a32, side * 0.18, 1.02, 0.39, 0.082, 0.27, 0.18, -0.5);
    part(INK, side * 0.21, 1.38, -0.59, 0.177, 0.154, 0.11, 0, 0, 'gloss');
    part(0xa6e2e9, side * 0.22, 1.39, -0.68, 0.123, 0.101, 0.047, 0, 0, 'eye');
  }
  part(CREAM, 0, 1.03, 0.44, 0.09, 0.27, 0.17, -0.52);
  part.group('tail', () => part(0xc99269, 0, 0.9, 0.7, 0.18, 0.23, 0.33, -0.42));
}

function tortoise(part: Part, green: number): void {
  part(0x9d8960, 0, 0.53, 0.06, 0.88, 0.32, 0.79);
  part(0x555f38, 0, 0.83, 0.09, 0.9, 0.62, 0.8);
  part(0x858d48, 0, 1.13, 0.12, 0.64, 0.36, 0.61);
  part(green, 0, 1.42, 0.08, 0.43, 0.13, 0.42);
  part(0x84995e, 0, 0.85, -0.68, 0.33, 0.31, 0.45, -0.3);
  part(0xa2ae65, 0, 1.12, -1, 0.38, 0.31, 0.35);
  for (const side of [-1, 1]) {
    part(INK, side * 0.25, 1.18, -1.23, 0.085, 0.09, 0.07, 0, 0, 'eye');
    part(0x72954c, side * 0.21, 1.4, -0.99, 0.2, 0.15, 0.2, 0, side * -0.3);
    part(0xb0b455, side * 0.55, 1.06, 0.37, 0.26, 0.195, 0.31, -0.1, side * -0.3);
  }
  part(0xa5bb54, 0, 1.5, -0.99, 0.19, 0.15, 0.18);
  part.group('tail', () => part(0xd3d977, -0.1, 1.62, -1, 0.08, 0.14, 0.08, -0.24, 0.34, 'point'));
}

function owl(part: Part, blue: number): void {
  part(0x906a64, 0, 0.75, 0.06, 0.39, 0.51, 0.36);
  part(0xb6927f, 0, 1.15, -0.13, 0.45, 0.34, 0.39);
  for (const side of [-1, 1]) {
    part(CREAM, side * 0.19, 1.16, -0.41, 0.217, 0.22, 0.135, 0, 0, 'gloss');
    part(INK, side * 0.19, 1.18, -0.53, 0.115, 0.135, 0.065, 0, 0, 'eye');
    part(0x63483f, side * 0.39, 0.77, 0.11, 0.125, 0.32, 0.29, -0.46, side * -0.18);
  }
  part(0xffbe5b, 0, 1.03, -0.5, 0.1, 0.12, 0.12, 0.27, Math.PI, 'point');
  part(blue, 0, 0.93, 0.015, 0.442, 0.145, 0.399, 0.19);
  part.group('tail', () => {
    part(blue, -0.17, 0.81, 0.52, 0.11, 0.13, 0.29, -0.35, -0.18, 'box');
    part(0xa2d5f3, 0.04, 0.88, 0.59, 0.085, 0.1, 0.29, -0.26, 0.15, 'box');
  });
  part(0x76534e, 0, 0.48, 0.39, 0.24, 0.1, 0.31, 0.22);
}

function wolf(part: Part, yellow: number): void {
  part(0x818c9b, 0, 0.97, 0.15, 0.52, 0.53, 0.68);
  part(0xb2b9bf, 0, 1.2, -0.31, 0.59, 0.59, 0.48, -0.32);
  part(0x778395, 0, 1.48, -0.52, 0.43, 0.36, 0.42);
  face(part, 1.36, -0.81, 0.22, 0.25, 0xdcd9cc);
  for (const side of [-1, 1]) {
    part.group('ears', () => {
      part(0x5d6879, side * 0.29, 1.81, -0.45, 0.2, 0.365, 0.17, 0.16, side * -0.36, 'point');
      part(0xaaa9ae, side * 0.3, 1.81, -0.53, 0.11, 0.236, 0.11, 0.11, side * -0.36, 'point');
    });
    part(0xa4afba, side * 0.47, 1.23, -0.25, 0.25, 0.32, 0.25, 0.5, side * -2, 'point');
  }
  part(yellow, 0, 1.37, 0.03, 0.36, 0.075, 0.29, -0.43);
  part(yellow, 0.06, 1.39, 0.27, 0.14, 0.26, 0.13, 1.4, -0.35, 'point');
  part.group('tail', () => {
    part(0x757d8b, 0.12, 0.81, 0.97, 0.17, 0.19, 0.5, 0.42, -0.19);
    part(0x5c6779, 0.16, 0.66, 1.22, 0.14, 0.15, 0.28, 0.28);
  });
}

const MODELS: Record<CharacterId, { draw: (part: Part, accent: number) => void; foot: number; limbs: Limb }> = {
  grit: {
    draw: badger,
    foot: 0x4d5262,
    limbs: { size: [0.21, 0.27, 0.24], x: 0.37, y: 0.48, front: -0.37, back: 0.38 },
  },
  skip: {
    draw: hare,
    foot: 0xb88057,
    limbs: { size: [0.126, 0.4, 0.16], x: 0.23, y: 0.74, front: -0.08, back: 0.28 },
  },
  blaze: {
    draw: fox,
    foot: 0x633b37,
    limbs: { size: [0.14, 0.31, 0.18], x: 0.26, y: 0.55, front: -0.34, back: 0.39 },
  },
  shade: {
    draw: panther,
    foot: 0x443750,
    limbs: { size: [0.19, 0.25, 0.2], x: 0.29, y: 0.44, front: -0.33, back: 0.4 },
  },
  cheeks: {
    draw: chipmunk,
    foot: 0x986047,
    limbs: { size: [0.14, 0.23, 0.19], x: 0.26, y: 0.41, front: -0.15, back: 0.31 },
  },
  duke: {
    draw: tortoise,
    foot: 0x859358,
    limbs: { size: [0.25, 0.22, 0.26], x: 0.52, y: 0.39, front: -0.4, back: 0.45 },
  },
  dusk: {
    draw: owl,
    foot: 0xb8854f,
    limbs: { size: [0.12, 0.165, 0.19], x: 0.16, y: 0.29, front: -0.03 },
  },
  fang: {
    draw: wolf,
    foot: 0x6d798d,
    limbs: { size: [0.16, 0.35, 0.22], x: 0.28, y: 0.63, front: -0.31, back: 0.42 },
  },
};

type Pieces = Record<Group | 'gloss', THREE.BufferGeometry[]>;

/** Turns one sketched part into smooth geometry in the right bucket (eyes also get a catch-light). */
function build(pieces: Pieces, group: Group, args: Parameters<Part>): void {
  const [color, x, y, z, sx, sy, sz, tiltX = 0, tiltZ = 0, shape = 'round'] = args;
  const glossy = shape === 'gloss' || shape === 'eye';
  const unit = shape === 'point' ? cone : shape === 'box' ? box : sphereFor(Math.max(sx, sy, sz), glossy);
  const place = (g: THREE.BufferGeometry) => g.rotateX(tiltX).rotateZ(tiltZ).translate(x, y, z);
  const bucket = glossy ? pieces.gloss : pieces[group];
  bucket.push(paint(place(unit.clone().scale(sx, sy, sz)), color));
  if (shape === 'eye') {
    const dot = sphereFor(0, true)
      .clone()
      .scale(sx * 0.3, sy * 0.3, sz * 0.3)
      .translate(-0.3 * sx, 0.38 * sy, -0.8 * sz);
    pieces.gloss.push(paint(place(dot), WHITE));
  }
}

/** Merges a bucket and, for a posed piece, re-centers it on a pivot at its base nearest the body. */
function finish(list: THREE.BufferGeometry[], pivoted: boolean): THREE.BufferGeometry | Pivoted | undefined {
  if (list.length === 0) return undefined;
  const merged = mergeGeometries(list);
  for (const piece of list) piece.dispose();
  if (!pivoted) return merged;
  merged.computeBoundingBox();
  const box3 = merged.boundingBox as THREE.Box3;
  const pivot = new THREE.Vector3(0, box3.min.y + (box3.max.y - box3.min.y) * 0.3, (box3.min.z + box3.max.z) / 2);
  merged.translate(0, -pivot.y, -pivot.z);
  return { geometry: merged, pivot };
}

/**
 * Builds the vertex-colored body, its glossy eyes and noses, separate tail and ears for secondary
 * motion, and a foot for the stride. The result is cached per character and shared by every
 * RacerView for that character. Callers must never dispose it.
 */
export function geometryFor(character: CharacterId): RacerGeometry {
  const cached = geometries.get(character);
  if (cached) return cached;
  const { draw, foot, limbs } = MODELS[character];
  const pieces: Pieces = { body: [], tail: [], ears: [], gloss: [] };
  let group: Group = 'body';
  const part = ((...args: Parameters<Part>) => build(pieces, group, args)) as Part;
  part.group = (next, drawGroup) => {
    group = next;
    drawGroup();
    group = 'body';
  };
  draw(part, RACER_COLORS[character]);
  const [width, height, depth] = limbs.size;
  const leg = paint(
    sphereFor(0.2, false)
      .clone()
      .scale(width, height, depth)
      .translate(0, -height * 0.8, -0.05),
    foot,
  );
  const geometry: RacerGeometry = {
    body: finish(pieces.body, false) as THREE.BufferGeometry,
    gloss: finish(pieces.gloss, false) as THREE.BufferGeometry,
    leg,
    limbs,
    tail: finish(pieces.tail, true) as Pivoted | undefined,
    ears: finish(pieces.ears, true) as Pivoted | undefined,
  };
  geometries.set(character, geometry);
  return geometry;
}
