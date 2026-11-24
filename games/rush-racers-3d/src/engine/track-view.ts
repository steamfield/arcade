import { createRng, TICK_DT } from '@arcade/core';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { groundY } from '../logic/course.ts';
import { RUN } from '../logic/tuning.ts';
import type { Course, Feature, Span } from '../logic/types.ts';
import type { TrackFrame, TrackFrames } from './track-geometry.ts';

type Gust = Extract<Feature, { kind: 'gust' }>;

const CHUNK = 96;
const PIT_DEPTH = 8;
const START_RUNOUT = 24;
const FINISH_RUNOUT = 120;
const DIRT = new THREE.Color(0xb68a59);
const SHOULDER = new THREE.Color(0x9f8751);
const GRASS = new THREE.Color(0x6b7945);
const MUD = new THREE.Color(0x553526);
const RIM = new THREE.Color(0x805639);
const WALL = new THREE.Color(0x432f25);
const PIT_FLOOR = new THREE.Color(0x231e1c);
const CHALK = new THREE.Color(0xffecc5);
const DARK_MARK = new THREE.Color(0x694833);

function uniqueSorted(values: number[]): number[] {
  return [...new Set(values)].sort((a, b) => a - b);
}

function adjacent<T>(values: T[]): { a: T; b: T }[] {
  const pairs = [];
  let previous: T | undefined;
  for (const value of values) {
    if (previous !== undefined) pairs.push({ a: previous, b: value });
    previous = value;
  }
  return pairs;
}

function contains(span: Span, s: number, d: number): boolean {
  return s > span.s0 && s < span.s1 && d > span.d0 && d < span.d1;
}

function vergeRise(s: number, d: number, halfWidth: number): number {
  const verge = Math.max(0, Math.abs(d) - halfWidth - 0.6);
  return Math.min(1, verge / 14) * (1.25 + 0.8 * Math.sin(s * 0.12 + d * 0.31));
}

/** The scenery runs a little past the path ends so the camera still has a forest behind the lines. */
function sceneryFrame(track: TrackFrames, s: number): TrackFrame {
  const frame = track.frameAt(s);
  const extra = s - THREE.MathUtils.clamp(s, 0, track.length);
  frame.x += extra * frame.tx;
  frame.z += extra * frame.tz;
  return frame;
}

interface TrackRow {
  s: number;
  frame: TrackFrame;
}

function trackTerrain(root: THREE.Group, course: Course, track: TrackFrames): THREE.Mesh[] {
  const { halfWidth } = course;
  const pits = course.features.filter((feature) => feature.kind === 'pit');
  const mud = course.features.filter((feature) => feature.kind === 'mud');
  const distances = [course.startS, course.startS + 0.65, course.finishS - 0.9, course.finishS, track.length];
  for (let s = -START_RUNOUT; s <= track.length + FINISH_RUNOUT; s++) distances.push(s);
  for (const knot of course.hills) distances.push(knot.s);
  for (const span of [...pits, ...mud]) distances.push(span.s0, span.s1);
  const sides = [-halfWidth - 27, -halfWidth - 12, -halfWidth - 3, halfWidth + 3, halfWidth + 12, halfWidth + 27];
  for (let lane = -4; lane <= 4; lane++) sides.push((lane * halfWidth) / 4);
  for (const span of [...pits, ...mud]) sides.push(span.d0, span.d1);
  const strips = adjacent(uniqueSorted(distances).map((s) => ({ s, frame: sceneryFrame(track, s) })));
  const widths = adjacent(uniqueSorted(sides));
  const holes = strips.map(({ a, b }) =>
    widths.map((width) => pits.some((pit) => contains(pit, (a.s + b.s) / 2, (width.a + width.b) / 2))),
  );
  const material = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const terrain: THREE.Mesh[] = [];

  for (let first = 0; first < strips.length; first += CHUNK) {
    const positions: number[] = [];
    const colors: number[] = [];
    const vertex = ({ s, frame: f }: TrackRow, d: number, height: number, color: THREE.Color) => {
      positions.push(f.x + d * f.rx, f.y + vergeRise(s, d, halfWidth) + height, f.z + d * f.rz);
      const mottling = 0.05 * Math.sin(s * 2.2 + d * 4.9) + 0.07 * Math.sin(s * 0.29 + Math.sin(d) * 2.3);
      const shade = 1 + mottling - 0.11 * Math.min(1, Math.abs(d) / halfWidth);
      colors.push(color.r * shade, color.g * shade, color.b * shade);
    };
    const surface = (a: TrackRow, b: TrackRow, d0: number, d1: number, height: number, color: THREE.Color) => {
      vertex(a, d0, height, color);
      vertex(a, d1, height, color);
      vertex(b, d1, height, color);
      vertex(a, d0, height, color);
      vertex(b, d1, height, color);
      vertex(b, d0, height, color);
    };
    const wall = (a: TrackRow, d0: number, b: TrackRow, d1: number, from: number, to: number, color: THREE.Color) => {
      vertex(a, d0, from, color);
      vertex(b, d1, from, color);
      vertex(b, d1, to, color);
      vertex(a, d0, from, color);
      vertex(b, d1, to, color);
      vertex(a, d0, to, color);
    };
    const pitEdge = (a: TrackRow, d0: number, b: TrackRow, d1: number) => {
      wall(a, d0, b, d1, 0, -0.45, RIM);
      wall(a, d0, b, d1, -0.45, -PIT_DEPTH, WALL);
    };

    for (const [index, { a, b }] of strips.slice(first, first + CHUNK).entries()) {
      const i = first + index;
      const s = (a.s + b.s) / 2;
      const acrossLine =
        (s > course.startS && s < course.startS + 0.65) || (s > course.finishS - 0.9 && s < course.finishS);
      const holeRow = holes[i];
      for (const [j, { a: d0, b: d1 }] of widths.entries()) {
        const d = (d0 + d1) / 2;
        if (holeRow?.[j]) {
          surface(a, b, d0, d1, -PIT_DEPTH, PIT_FLOOR);
          if (!holes[i - 1]?.[j]) pitEdge(a, d0, a, d1);
          if (!holes[i + 1]?.[j]) pitEdge(b, d1, b, d0);
          if (!holeRow[j - 1]) pitEdge(b, d0, a, d0);
          if (!holeRow[j + 1]) pitEdge(a, d1, b, d1);
        } else if (Math.abs(d) <= halfWidth) {
          if (acrossLine) {
            const stripe = Math.floor((d / halfWidth + 1) * 4);
            surface(a, b, d0, d1, 0, stripe % 2 ? DARK_MARK : CHALK);
          } else {
            surface(a, b, d0, d1, 0, DIRT);
            if (mud.some((patch) => contains(patch, s, d))) surface(a, b, d0, d1, 0.025, MUD);
          }
        } else {
          surface(a, b, d0, d1, 0, Math.abs(d) < halfWidth + 3 ? SHOULDER : GRASS);
        }
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    const mesh = new THREE.Mesh(geometry, material);
    root.add(mesh);
    terrain.push(mesh);
  }
  return terrain;
}

interface Prop {
  x: number;
  y: number;
  z: number;
  sx: number;
  sy: number;
  sz: number;
  angle: number;
  color: number;
}

function plantForest(root: THREE.Group, course: Course, track: TrackFrames, seed: number, terrain: THREE.Mesh[]): void {
  const rng = createRng(seed ^ 0x36be471a);
  const trunk = new THREE.CylinderGeometry(0.59, 1, 1, 6);
  const bough = new THREE.ConeGeometry(1, 1, 6);
  const rock = new THREE.DodecahedronGeometry(1);
  const material = new THREE.MeshLambertMaterial({ flatShading: true });
  const transform = new THREE.Object3D();
  const color = new THREE.Color();
  const ray = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(0, -1, 0), 0, 12);
  const hits: THREE.Intersection[] = [];
  const groundBelow = (x: number, y: number, z: number) => {
    // The mesh interpolates the verge between its vertices. Plant on that surface.
    ray.ray.origin.set(x, y + 6, z);
    hits.length = 0;
    return ray.intersectObjects(terrain, false, hits)[0]?.point.y;
  };
  const batch = (geometry: THREE.BufferGeometry, props: Prop[]) => {
    if (!props.length) return;
    const mesh = new THREE.InstancedMesh(geometry, material, props.length);
    for (const [i, p] of props.entries()) {
      transform.position.set(p.x, p.y, p.z);
      transform.scale.set(p.sx, p.sy, p.sz);
      transform.rotation.y = p.angle;
      transform.updateMatrix();
      mesh.setMatrixAt(i, transform.matrix);
      mesh.setColorAt(i, color.setHex(p.color));
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    root.add(mesh);
  };

  for (let first = -START_RUNOUT; first < track.length + FINISH_RUNOUT; first += CHUNK) {
    const trunks: Prop[] = [];
    const boughs: Prop[] = [];
    const roundedProps: Prop[] = [];
    const end = Math.min(first + CHUNK, track.length + FINISH_RUNOUT);
    for (const side of [-1, 1]) {
      for (const verge of [3.1, 9, 16, 24]) {
        for (let at = first; at < end - 3; at += 3.9 + rng.next() * 4.5) {
          const s = at + rng.next() * 3;
          const d = side * (course.halfWidth + verge + rng.next() * 1.9);
          const f = sceneryFrame(track, s);
          const x = f.x + f.rx * d;
          const z = f.z + f.rz * d;
          const ground = groundBelow(x, f.y, z);
          if (ground === undefined) continue;
          const y = ground - 0.12;
          const h = 5.8 + rng.next() * 6.2;
          const wide = 1.3 + rng.next() * 1.3;
          const angle = rng.next() * Math.PI;
          const bark = rng.pick([0x65472e, 0x876445, 0x543a2a]);
          const needles = rng.pick([0x3d5636, 0x546739, 0x627d4c, 0x435c39, 0x747a3d]);
          trunks.push({ x, y: y + h * 0.34, z, sx: h * 0.044, sy: h * 0.68, sz: h * 0.044, angle, color: bark });
          if (rng.next() < 0.24) {
            const leaves = rng.pick([0x889546, 0x9d9343, 0xa08640, 0x809151, 0x6c844b]);
            roundedProps.push(
              { x, y: y + h * 0.66, z, sx: wide, sy: h * 0.22, sz: wide, angle, color: leaves },
              {
                x: x + side * wide * 0.15,
                y: y + h * 0.79,
                z: z - wide * 0.33,
                sx: wide * 0.75,
                sy: h * 0.19,
                sz: wide * 0.72,
                angle: angle + 0.6,
                color: leaves,
              },
            );
          } else {
            for (let layer = 0; layer < 3; layer++) {
              const radius = wide * (1 - layer * 0.2);
              boughs.push({
                x,
                y: y + h * (0.46 + layer * 0.152),
                z,
                sx: radius,
                sy: h * (0.46 - layer * 0.018),
                sz: radius * 0.93,
                angle: angle + layer * 0.51,
                color: needles,
              });
            }
          }
          if (verge > 4) continue;

          const bankD = side * (course.halfWidth + 0.9 + rng.next() * 1.55);
          const bank = { x: f.x + f.rx * bankD, z: f.z + f.rz * bankD, angle: rng.next() * Math.PI };
          const bankY = groundBelow(bank.x, f.y, bank.z);
          if (bankY === undefined) continue;
          if (rng.next() < 0.55) {
            const size = 0.28 + rng.next() * 0.54;
            roundedProps.push({ ...bank, y: bankY, sx: size, sy: size * 0.62, sz: size * 0.79, color: 0x797464 });
          } else {
            boughs.push({ ...bank, y: bankY + 0.34, sx: 0.43, sy: 0.8, sz: 0.46, color: 0x9d994d });
          }
        }
      }
    }
    batch(trunk, trunks);
    batch(bough, boughs);
    batch(rock, roundedProps);
  }
}

function paint(geometry: THREE.BufferGeometry, getColor: (i: number) => THREE.Color): THREE.BufferGeometry {
  const colors = new Float32Array(geometry.getAttribute('position').count * 3);
  for (let i = 0; i < colors.length / 3; i++) getColor(i).toArray(colors, i * 3);
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}

function trackLandmarks(root: THREE.Group, course: Course, track: TrackFrames): void {
  const pieces: THREE.BufferGeometry[] = [];
  const cutWood = new THREE.Color(0xf1ba6e);
  const bark = [new THREE.Color(0x995c32), new THREE.Color(0x865034), new THREE.Color(0xb97541)];
  for (const log of course.features) {
    if (log.kind !== 'log') continue;
    const s = log.s + RUN.logDepth / 2;
    const f = track.frameAt(s);
    const point = track.toWorld(s, (log.d0 + log.d1) / 2, groundY(course, log.s) + log.height / 2);
    const geometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 16, 1);
    const normals = geometry.getAttribute('normal');
    paint(geometry, (i) => {
      if (Math.abs(normals.getY(i)) > 0.5) return cutWood;
      return bark[Math.floor((normals.getZ(i) + 1) * 3 + normals.getX(i) * 2 + 4) % bark.length] ?? cutWood;
    });
    pieces.push(
      geometry
        .rotateZ(-Math.PI / 2)
        .scale(log.d1 - log.d0, log.height, RUN.logDepth)
        .rotateY(-Math.atan2(f.tx, -f.tz))
        .translate(point.x, point.y, point.z),
    );
  }

  for (const [s, title] of [
    [course.startS, 'START'],
    [course.finishS, 'FINISH'],
  ] as const) {
    const f = track.frameAt(s);
    const yaw = -Math.atan2(f.tx, -f.tz);
    const wood = new THREE.Color(0x72432c);
    const trim = new THREE.Color(0x9c6b41);
    const box = (width: number, height: number, depth: number, d: number, y: number, color: THREE.Color) => {
      const p = track.toWorld(s, d, f.y + y);
      pieces.push(
        paint(new THREE.BoxGeometry(width, height, depth), () => color)
          .rotateY(yaw)
          .translate(p.x, p.y, p.z),
      );
    };
    for (const side of [-1, 1]) {
      const post = side * (course.halfWidth + 0.45);
      box(0.61, 6, 0.65, post, 2.875, wood);
      box(0.82, 0.58, 0.81, post, 0.28, trim);
      box(0.77, 0.23, 0.77, post, 5.9, trim);
    }
    box(course.halfWidth * 2 + 1.6, 0.63, 0.74, 0, 5.51, wood);
    box(course.halfWidth * 2 + 1.84, 0.13, 0.88, 0, 5.86, trim);
    const signHeight = 5.18;
    box(6.36, 1.08, 0.38, 0, signHeight, trim);

    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 112;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Cannot draw the track arch sign');
    context.fillStyle = title === 'START' ? '#343b27' : '#504129';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = '#c9a571';
    context.lineWidth = 4;
    context.strokeRect(7, 7, 626, 98);
    context.fillStyle = '#fff1ca';
    context.font = '900 72px system-ui';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(title, 320, 57);
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(6.18, 0.97), new THREE.MeshBasicMaterial({ map }));
    sign.rotation.y = yaw;
    sign.position.set(f.x - f.tx * 0.39, f.y + signHeight, f.z - f.tz * 0.39);
    root.add(sign);
  }
  root.add(new THREE.Mesh(mergeGeometries(pieces), new THREE.MeshLambertMaterial({ vertexColors: true })));
  for (const piece of pieces) piece.dispose();
}

function windLeaves(root: THREE.Group, course: Course, track: TrackFrames, seed: number) {
  const rng = createRng(seed ^ 0xa91e3493);
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const leaf = new THREE.PlaneGeometry(0.42, 0.17).rotateZ(Math.PI / 4);
  const material = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide });
  const gusts = course.features
    .filter((feature) => feature.kind === 'gust')
    .map((gust: Gust) => {
      const count = Math.ceil((gust.s1 - gust.s0) * 1.35);
      const mesh = new THREE.InstancedMesh(leaf, material, count);
      // Leaves wrap across the full span. Render the small batch without cached instance bounds.
      mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      const leaves = Array.from({ length: count }, (_, i) => {
        mesh.setColorAt(i, new THREE.Color(rng.pick([0xffd483, 0xc8803a, 0xf1ae51])));
        return {
          frame: track.frameAt(gust.s0 + rng.next() * (gust.s1 - gust.s0)),
          across: rng.next(),
          height: 0.55 + rng.next() * 2.15,
        };
      });
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      root.add(mesh);
      return { gust, mesh, leaves };
    });
  const point = new THREE.Object3D();
  let drawnTick = -1;
  return (tick: number) => {
    if (drawnTick === tick) return;
    drawnTick = tick;
    const time = tick * TICK_DT;
    const flutter = motion.matches ? 0 : time;
    for (const { gust, mesh, leaves } of gusts) {
      const width = gust.d1 - gust.d0;
      let i = 0;
      for (const { frame, across, height } of leaves) {
        const drift = across + (time * gust.push) / width;
        const d = gust.d0 + (drift - Math.floor(drift)) * width;
        point.position.set(
          frame.x + frame.rx * d,
          frame.y + height + 0.28 * Math.sin(flutter * 5 + i),
          frame.z + frame.rz * d,
        );
        point.rotation.set(flutter * 3 + i, flutter * 2 + i, flutter * 4 + i);
        point.updateMatrix();
        mesh.setMatrixAt(i, point.matrix);
        i++;
      }
      mesh.instanceMatrix.needsUpdate = true;
    }
  };
}

export function createTrackView(course: Course, track: TrackFrames, seed: number) {
  const root = new THREE.Group();
  const terrain = trackTerrain(root, course, track);
  plantForest(root, course, track, seed, terrain);
  trackLandmarks(root, course, track);
  return { root, tick: windLeaves(root, course, track, seed) };
}
