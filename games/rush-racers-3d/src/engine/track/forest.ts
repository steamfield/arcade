import { createRng, type Rng } from '@arcade/core';
import * as THREE from 'three';
import type { Theme } from '../themes/types.ts';
import { SCENERY_RUNOUT, TERRAIN_CHUNK, type TerrainGrid, terrainPointAt } from './track-terrain.ts';

interface GroundPoint {
  x: number;
  y: number;
  z: number;
}

interface Prop extends GroundPoint {
  sx: number;
  sy: number;
  sz: number;
  angle: number;
  color: number;
}

interface ForestProps {
  trunks: Prop[];
  boughs: Prop[];
  rounded: Prop[];
}

function addConifer(boughs: Prop[], base: GroundPoint, h: number, wide: number, angle: number, color: number): void {
  for (let layer = 0; layer < 3; layer++) {
    const radius = wide * (1 - layer * 0.2);
    boughs.push({
      ...base,
      y: base.y + h * (0.46 + layer * 0.152),
      sx: radius,
      sy: h * (0.46 - layer * 0.018),
      sz: radius * 0.93,
      angle: angle + layer * 0.51,
      color,
    });
  }
}

function addBroadleaf(
  rounded: Prop[],
  { x, y, z }: GroundPoint,
  h: number,
  wide: number,
  angle: number,
  side: number,
  color: number,
): void {
  rounded.push(
    { x, y: y + h * 0.66, z, sx: wide, sy: h * 0.22, sz: wide, angle, color },
    {
      x: x + side * wide * 0.15,
      y: y + h * 0.79,
      z: z - wide * 0.33,
      sx: wide * 0.75,
      sy: h * 0.19,
      sz: wide * 0.72,
      angle: angle + 0.6,
      color,
    },
  );
}

function addTree(
  { trunks, boughs, rounded }: ForestProps,
  rng: Rng,
  ground: GroundPoint,
  side: number,
  palette: Theme['scenery'],
): void {
  const base = { ...ground, y: ground.y - 0.12 };
  const h = 5.8 + rng.next() * 6.2;
  const wide = 1.3 + rng.next() * 1.3;
  const angle = rng.next() * Math.PI;
  const bark = rng.pick(palette.bark);
  const needles = rng.pick(palette.needles);
  trunks.push({ ...base, y: base.y + h * 0.34, sx: h * 0.044, sy: h * 0.68, sz: h * 0.044, angle, color: bark });
  if (rng.next() < 0.24) addBroadleaf(rounded, base, h, wide, angle, side, rng.pick(palette.leaves));
  else addConifer(boughs, base, h, wide, angle, needles);
}

function addBankProp({ boughs, rounded }: ForestProps, rng: Rng, point: GroundPoint, palette: Theme['scenery']): void {
  const bank = { ...point, angle: rng.next() * Math.PI };
  if (rng.next() < 0.55) {
    const size = 0.28 + rng.next() * 0.54;
    rounded.push({ ...bank, sx: size, sy: size * 0.62, sz: size * 0.79, color: palette.rock });
  } else {
    boughs.push({ ...bank, y: point.y + 0.34, sx: 0.43, sy: 0.8, sz: 0.46, color: palette.shrub });
  }
}

function forestChunk(rng: Rng, grid: TerrainGrid, first: number, end: number, palette: Theme['scenery']): ForestProps {
  const props: ForestProps = { trunks: [], boughs: [], rounded: [] };
  for (const side of [-1, 1]) {
    for (const verge of [3.1, 9, 16, 24]) {
      for (let at = first; at < end - 3; at += 3.9 + rng.next() * 4.5) {
        const s = at + rng.next() * 3;
        const d = side * (grid.halfWidth + verge + rng.next() * 1.9);
        addTree(props, rng, terrainPointAt(grid, s, d), side, palette);
        if (verge > 4) continue;
        const bankD = side * (grid.halfWidth + 0.9 + rng.next() * 1.55);
        addBankProp(props, rng, terrainPointAt(grid, s, bankD), palette);
      }
    }
  }
  return props;
}

/** A tuft of seven thin blades fanned around its base, 1 m tall before scaling. */
function tuftGeometry(): THREE.BufferGeometry {
  const positions: number[] = [];
  for (let blade = 0; blade < 7; blade++) {
    const turn = (blade / 7) * Math.PI * 2;
    const lean = 0.18 + (blade % 2) * 0.14;
    const [cx, cz] = [Math.cos(turn), Math.sin(turn)];
    const [wx, wz] = [-cz * 0.07, cx * 0.07];
    positions.push(cx * 0.05 - wx, 0, cz * 0.05 - wz, cx * 0.05 + wx, 0, cz * 0.05 + wz, cx * lean, 1, cz * lean);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

/** Seeded grass tufts on the verges, from their own rng so tree placement doesn't shift. */
function grassChunk(rng: Rng, grid: TerrainGrid, first: number, end: number, palette: Theme['scenery']): Prop[] {
  const tufts: Prop[] = [];
  for (const side of [-1, 1]) {
    for (let s = first; s < end; s += 0.16 + rng.next() * 0.26) {
      const d = side * (grid.halfWidth + 0.4 + rng.next() ** 1.6 * 15);
      const size = 0.26 + rng.next() * 0.3;
      tufts.push({
        ...terrainPointAt(grid, s, d),
        sx: size * 1.8,
        sy: size,
        sz: size * 1.8,
        angle: rng.next() * Math.PI * 2,
        color: rng.pick(palette.grass),
      });
    }
  }
  return tufts;
}

function forestBatchWriter(root: THREE.Group, material: THREE.Material, shadows: boolean) {
  const transform = new THREE.Object3D();
  const color = new THREE.Color();
  return (geometry: THREE.BufferGeometry, props: Prop[]) => {
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
    mesh.castShadow = shadows;
    mesh.receiveShadow = true;
    root.add(mesh);
  };
}

/** Plants seeded batches of trees, rocks, shrubs and grass tufts on both sides of the trail. */
export function plantForest(
  root: THREE.Group,
  grid: TerrainGrid,
  trackLength: number,
  seed: number,
  palette: Theme['scenery'],
): void {
  const rng = createRng(seed ^ 0x36be471a);
  const grassRng = createRng(seed ^ 0x51a7e2c3);
  const tuft = tuftGeometry();
  const tufts = forestBatchWriter(root, new THREE.MeshLambertMaterial({ side: THREE.DoubleSide }), false);
  const trunk = new THREE.CylinderGeometry(0.59, 1, 1, 6);
  const bough = new THREE.ConeGeometry(1, 1, 6);
  const rock = new THREE.DodecahedronGeometry(1);
  const batch = forestBatchWriter(root, new THREE.MeshLambertMaterial({ flatShading: true }), true);
  const last = trackLength + SCENERY_RUNOUT.finish;
  for (let first = -SCENERY_RUNOUT.start; first < last; first += TERRAIN_CHUNK) {
    const { trunks, boughs, rounded } = forestChunk(rng, grid, first, Math.min(first + TERRAIN_CHUNK, last), palette);
    batch(trunk, trunks);
    batch(bough, boughs);
    batch(rock, rounded);
    tufts(tuft, grassChunk(grassRng, grid, first, Math.min(first + TERRAIN_CHUNK, last), palette));
  }
}
