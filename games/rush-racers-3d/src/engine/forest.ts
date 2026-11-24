import { createRng, type Rng } from '@arcade/core';
import * as THREE from 'three';
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

const BARK = [0x65472e, 0x876445, 0x543a2a];
const NEEDLES = [0x3d5636, 0x546739, 0x627d4c, 0x435c39, 0x747a3d];
const LEAVES = [0x889546, 0x9d9343, 0xa08640, 0x809151, 0x6c844b];

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

function addTree({ trunks, boughs, rounded }: ForestProps, rng: Rng, ground: GroundPoint, side: number): void {
  const base = { ...ground, y: ground.y - 0.12 };
  const h = 5.8 + rng.next() * 6.2;
  const wide = 1.3 + rng.next() * 1.3;
  const angle = rng.next() * Math.PI;
  const bark = rng.pick(BARK);
  const needles = rng.pick(NEEDLES);
  trunks.push({ ...base, y: base.y + h * 0.34, sx: h * 0.044, sy: h * 0.68, sz: h * 0.044, angle, color: bark });
  if (rng.next() < 0.24) addBroadleaf(rounded, base, h, wide, angle, side, rng.pick(LEAVES));
  else addConifer(boughs, base, h, wide, angle, needles);
}

function addBankProp({ boughs, rounded }: ForestProps, rng: Rng, point: GroundPoint): void {
  const bank = { ...point, angle: rng.next() * Math.PI };
  if (rng.next() < 0.55) {
    const size = 0.28 + rng.next() * 0.54;
    rounded.push({ ...bank, sx: size, sy: size * 0.62, sz: size * 0.79, color: 0x797464 });
  } else {
    boughs.push({ ...bank, y: point.y + 0.34, sx: 0.43, sy: 0.8, sz: 0.46, color: 0x9d994d });
  }
}

function forestChunk(rng: Rng, grid: TerrainGrid, first: number, end: number): ForestProps {
  const props: ForestProps = { trunks: [], boughs: [], rounded: [] };
  for (const side of [-1, 1]) {
    for (const verge of [3.1, 9, 16, 24]) {
      for (let at = first; at < end - 3; at += 3.9 + rng.next() * 4.5) {
        const s = at + rng.next() * 3;
        const d = side * (grid.halfWidth + verge + rng.next() * 1.9);
        addTree(props, rng, terrainPointAt(grid, s, d), side);
        if (verge > 4) continue;
        const bankD = side * (grid.halfWidth + 0.9 + rng.next() * 1.55);
        addBankProp(props, rng, terrainPointAt(grid, s, bankD));
      }
    }
  }
  return props;
}

function forestBatchWriter(root: THREE.Group) {
  const material = new THREE.MeshLambertMaterial({ flatShading: true });
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
    root.add(mesh);
  };
}

/** Plants seeded batches of trees, rocks, and shrubs on both sides of the trail. */
export function plantForest(root: THREE.Group, grid: TerrainGrid, trackLength: number, seed: number): void {
  const rng = createRng(seed ^ 0x36be471a);
  const trunk = new THREE.CylinderGeometry(0.59, 1, 1, 6);
  const bough = new THREE.ConeGeometry(1, 1, 6);
  const rock = new THREE.DodecahedronGeometry(1);
  const batch = forestBatchWriter(root);
  const last = trackLength + SCENERY_RUNOUT.finish;
  for (let first = -SCENERY_RUNOUT.start; first < last; first += TERRAIN_CHUNK) {
    const { trunks, boughs, rounded } = forestChunk(rng, grid, first, Math.min(first + TERRAIN_CHUNK, last));
    batch(trunk, trunks);
    batch(bough, boughs);
    batch(rock, rounded);
  }
}
