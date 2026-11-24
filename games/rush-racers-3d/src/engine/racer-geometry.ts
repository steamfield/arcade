import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { CharacterId } from '../logic/types.ts';

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
const sphere = new THREE.SphereGeometry(1, 12, 8);
const cone = new THREE.ConeGeometry(1, 2, 6);
const box = new THREE.BoxGeometry(2, 2, 2);

type Shape = 'round' | 'point' | 'box';
type Part = (
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
) => void;
interface Limb {
  size: [width: number, height: number, depth: number];
  x: number;
  y: number;
  front: number;
  back?: number;
}

interface RacerGeometry {
  body: THREE.BufferGeometry;
  leg: THREE.BufferGeometry;
  limbs: Limb;
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
  part(NOSE, 0, y - 0.1, z - 0.12 - muzzle, 0.095, 0.065, 0.06);
  for (const side of [-1, 1]) part(INK, side * width, y + 0.04, z, 0.067, 0.08, 0.053);
}

function badger(part: Part, blue: number): void {
  part(0x596275, 0, 0.83, 0.12, 0.66, 0.58, 0.64);
  part(0xe1ddd2, 0, 1.04, -0.48, 0.49, 0.39, 0.51);
  part(0xf7eddb, 0, 1.31, 0.02, 0.16, 0.18, 0.61, -0.08);
  for (const side of [-1, 1]) {
    part(INK, side * 0.25, 1.12, -0.68, 0.19, 0.28, 0.35, 0.24, side * -0.19);
    part(0x4b5265, side * 0.35, 1.44, -0.37, 0.14, 0.15, 0.12);
    part(0xedd6aa, side * 0.19, 1.08, -0.96, 0.055, 0.058, 0.041);
  }
  part(NOSE, 0, 0.98, -0.96, 0.13, 0.095, 0.11);
  part(blue, 0, 1.41, -0.55, 0.48, 0.11, 0.43);
  part(INK, 0, 1.43, -0.93, 0.19, 0.16, 0.115);
  part(0xffd768, 0, 1.45, -1.02, 0.125, 0.11, 0.045);
  part(0x8993a0, 0, 0.68, 0.76, 0.18, 0.155, 0.23);
}

function hare(part: Part, amber: number): void {
  part(0xd5a26e, 0, 1.12, 0.15, 0.37, 0.67, 0.38, -0.21);
  part(amber, 0, 1.03, 0.21, 0.385, 0.32, 0.4);
  part(0xc79064, 0, 1.72, -0.21, 0.37, 0.35, 0.37);
  face(part, 1.72, -0.49, 0.21, 0.15);
  for (const side of [-1, 1]) {
    const x = side * 0.22;
    part(0xc79064, x, 2.29, -0.15, 0.145, side > 0 ? 0.54 : 0.48, 0.135, 0.17, side * -0.17);
    part(0xf6c3a2, x, 2.33, -0.24, 0.08, 0.37, 0.063, 0.17, side * -0.17);
  }
  part(CREAM, 0, 0.94, 0.58, 0.21, 0.22, 0.21);
}

function fox(part: Part, red: number): void {
  part(red, 0, 0.9, 0.14, 0.47, 0.51, 0.58);
  part(0xc14424, 0, 1.27, -0.44, 0.43, 0.37, 0.45);
  face(part, 1.21, -0.73, 0.22, 0.22);
  for (const side of [-1, 1]) {
    part(red, side * 0.29, 1.66, -0.43, 0.218, 0.35, 0.18, 0.05, side * -0.16, 'point');
    part(0xffbd8f, side * 0.29, 1.65, -0.52, 0.134, 0.22, 0.11, 0.05, side * -0.16, 'point');
  }
  part(0xe36b29, -0.19, 1.08, 0.92, 0.29, 0.29, 0.64, -0.53, -0.19);
  part(CREAM, -0.21, 1.32, 1.29, 0.24, 0.22, 0.26, -0.5);
}

function panther(part: Part, slate: number): void {
  part(0x302836, 0, 0.8, 0.1, 0.49, 0.48, 0.58);
  part(0x382e3d, 0, 1.14, -0.49, 0.49, 0.43, 0.39);
  part(0x775893, 0, 1.08, -0.2, 0.47, 0.13, 0.37, 0.18);
  part(slate, 0, 1.15, 0.055, 0.29, 0.15, 0.38, -0.15);
  for (const side of [-1, 1]) {
    part(0x392c42, side * 0.32, 1.5, -0.42, 0.19, 0.2, 0.13);
    part(0x846b85, side * 0.32, 1.51, -0.53, 0.104, 0.118, 0.047);
    part(0xffcf69, side * 0.26, 1.21, -0.8, 0.076, 0.06, 0.061);
    part(INK, side * 0.26, 1.21, -0.847, 0.028, 0.049, 0.025);
  }
  part(0x645164, 0, 1.02, -0.82, 0.23, 0.125, 0.14);
  part(INK, 0, 1.06, -0.95, 0.097, 0.055, 0.06);
  part(0x3c3144, 0.18, 0.96, 0.91, 0.12, 0.14, 0.49, -0.38, -0.29);
  part(0x4a3958, 0.33, 1.2, 1.27, 0.12, 0.29, 0.13, 0.16, -0.26);
}

function chipmunk(part: Part, pink: number): void {
  part(0xab694b, 0, 0.82, 0.14, 0.45, 0.48, 0.43);
  part(0xbc7d55, 0, 1.24, -0.27, 0.44, 0.39, 0.39);
  part(CREAM, 0, 1.1, -0.56, 0.37, 0.22, 0.19);
  part(NOSE, 0, 1.16, -0.75, 0.098, 0.07, 0.061);
  part(pink, 0, 1.39, -0.29, 0.45, 0.105, 0.41, 0.09);
  for (const side of [-1, 1]) {
    part(0xad6948, side * 0.29, 1.57, -0.23, 0.13, 0.155, 0.1);
    part(0x623a32, side * 0.18, 1.02, 0.39, 0.082, 0.27, 0.18, -0.5);
    part(INK, side * 0.21, 1.38, -0.59, 0.177, 0.154, 0.11);
    part(0xa6e2e9, side * 0.22, 1.39, -0.68, 0.123, 0.101, 0.047);
  }
  part(CREAM, 0, 1.03, 0.44, 0.09, 0.27, 0.17, -0.52);
  part(0xc99269, 0, 0.9, 0.7, 0.18, 0.23, 0.33, -0.42);
}

function tortoise(part: Part, green: number): void {
  part(0x9d8960, 0, 0.53, 0.06, 0.88, 0.32, 0.79);
  part(0x555f38, 0, 0.83, 0.09, 0.9, 0.62, 0.8);
  part(0x858d48, 0, 1.13, 0.12, 0.64, 0.36, 0.61);
  part(green, 0, 1.42, 0.08, 0.43, 0.13, 0.42);
  part(0x84995e, 0, 0.85, -0.68, 0.33, 0.31, 0.45, -0.3);
  part(0xa2ae65, 0, 1.12, -1, 0.38, 0.31, 0.35);
  for (const side of [-1, 1]) {
    part(INK, side * 0.25, 1.18, -1.23, 0.062, 0.065, 0.045);
    part(0x72954c, side * 0.21, 1.4, -0.99, 0.2, 0.15, 0.2, 0, side * -0.3);
    part(0xb0b455, side * 0.55, 1.06, 0.37, 0.26, 0.195, 0.31, -0.1, side * -0.3);
  }
  part(0xa5bb54, 0, 1.5, -0.99, 0.19, 0.15, 0.18);
  part(0xd3d977, -0.1, 1.62, -1, 0.08, 0.14, 0.08, -0.24, 0.34, 'point');
}

function owl(part: Part, blue: number): void {
  part(0x906a64, 0, 0.75, 0.06, 0.39, 0.51, 0.36);
  part(0xb6927f, 0, 1.15, -0.13, 0.45, 0.34, 0.39);
  for (const side of [-1, 1]) {
    part(CREAM, side * 0.19, 1.16, -0.41, 0.217, 0.22, 0.135);
    part(INK, side * 0.19, 1.18, -0.53, 0.09, 0.111, 0.048);
    part(0x63483f, side * 0.39, 0.77, 0.11, 0.125, 0.32, 0.29, -0.46, side * -0.18);
  }
  part(0xffbe5b, 0, 1.03, -0.5, 0.1, 0.12, 0.12, 0.27, Math.PI, 'point');
  part(blue, 0, 0.93, 0.015, 0.442, 0.145, 0.399, 0.19);
  part(blue, -0.17, 0.81, 0.52, 0.11, 0.13, 0.29, -0.35, -0.18, 'box');
  part(0xa2d5f3, 0.04, 0.88, 0.59, 0.085, 0.1, 0.29, -0.26, 0.15, 'box');
  part(0x76534e, 0, 0.48, 0.39, 0.24, 0.1, 0.31, 0.22);
}

function wolf(part: Part, yellow: number): void {
  part(0x818c9b, 0, 0.97, 0.15, 0.52, 0.53, 0.68);
  part(0xb2b9bf, 0, 1.2, -0.31, 0.59, 0.59, 0.48, -0.32);
  part(0x778395, 0, 1.48, -0.52, 0.43, 0.36, 0.42);
  face(part, 1.36, -0.81, 0.22, 0.25, 0xdcd9cc);
  for (const side of [-1, 1]) {
    part(0x5d6879, side * 0.29, 1.81, -0.45, 0.2, 0.365, 0.17, 0.16, side * -0.36, 'point');
    part(0xaaa9ae, side * 0.3, 1.81, -0.53, 0.11, 0.236, 0.11, 0.11, side * -0.36, 'point');
    part(0xa4afba, side * 0.47, 1.23, -0.25, 0.25, 0.32, 0.25, 0.5, side * -2, 'point');
  }
  part(yellow, 0, 1.37, 0.03, 0.36, 0.075, 0.29, -0.43);
  part(yellow, 0.06, 1.39, 0.27, 0.14, 0.26, 0.13, 1.4, -0.35, 'point');
  part(0x757d8b, 0.12, 0.81, 0.97, 0.17, 0.19, 0.5, 0.42, -0.19);
  part(0x5c6779, 0.16, 0.66, 1.22, 0.14, 0.15, 0.28, 0.28);
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

/**
 * Builds a vertex-colored body and a separate foot for the stride. The result is cached per
 * character and shared by every RacerView for that character. Callers must never dispose it.
 */
export function geometryFor(character: CharacterId): RacerGeometry {
  const cached = geometries.get(character);
  if (cached) return cached;
  const { draw, foot, limbs } = MODELS[character];
  const pieces: THREE.BufferGeometry[] = [];
  draw((color, x, y, z, sx, sy, sz, tiltX = 0, tiltZ = 0, shape = 'round') => {
    const unit = shape === 'point' ? cone : shape === 'box' ? box : sphere;
    const piece = unit.clone().scale(sx, sy, sz).rotateX(tiltX).rotateZ(tiltZ).translate(x, y, z);
    pieces.push(paint(piece, color));
  }, RACER_COLORS[character]);
  const body = mergeGeometries(pieces);
  for (const piece of pieces) piece.dispose();
  const [width, height, depth] = limbs.size;
  const leg = paint(
    sphere
      .clone()
      .scale(width, height, depth)
      .translate(0, -height * 0.8, -0.05),
    foot,
  );
  const geometry = { body, leg, limbs };
  geometries.set(character, geometry);
  return geometry;
}
