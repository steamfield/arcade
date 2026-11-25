import { createRng, type Rng } from '@arcade/core';
import * as THREE from 'three';
import type { Theme } from '../themes/types.ts';
import type { loadForestCards } from './forest-cards.ts';
import type { ModelName, NatureKit } from './nature-kit.ts';
import { SCENERY_RUNOUT, TERRAIN_CHUNK, type TerrainGrid, terrainPointAt } from './track-terrain.ts';

export type ForestScenery = NatureKit | Awaited<ReturnType<typeof loadForestCards>>;

export interface Prop {
  model: ModelName;
  x: number;
  y: number;
  z: number;
  scale: number;
  stretch: number;
  angle: number;
  tint: number;
  /** Trees and rocks cast sun shadows; ground cover only receives them. */
  casts: boolean;
}

const PINES = ['Pine_1', 'Pine_2', 'Pine_3', 'Pine_4', 'Pine_5'] as const;
const BROADLEAVES = ['CommonTree_1', 'CommonTree_2', 'CommonTree_3', 'CommonTree_4', 'CommonTree_5'] as const;
const DEAD = ['DeadTree_1', 'DeadTree_2'] as const;
const BUSHES = ['Bush_Common', 'Bush_Common_Flowers', 'Fern_1', 'Plant_1_Big', 'Plant_7'] as const;
const GRASS = ['Grass_Common_Short', 'Grass_Common_Tall', 'Grass_Wispy_Short', 'Grass_Wispy_Tall'] as const;
const BLOOMS = ['Flower_3_Group', 'Flower_4_Group', 'Clover_1', 'Clover_2', 'Mushroom_Common'] as const;
const ROCKS = ['Rock_Medium_1', 'Rock_Medium_2', 'Rock_Medium_3'] as const;
const PEBBLES = ['Pebble_Round_1', 'Pebble_Round_2', 'Pebble_Round_3', 'Pebble_Square_1', 'Pebble_Square_2'] as const;

type Planter = (props: Prop[], rng: Rng, grid: TerrainGrid, first: number, end: number) => void;

function place(grid: TerrainGrid, s: number, d: number, prop: Omit<Prop, 'x' | 'y' | 'z'>, sink = 0.05): Prop {
  const { x, y, z } = terrainPointAt(grid, s, d);
  return { ...prop, x, y: y - sink, z };
}

/** Four loose rows of trees per side, mostly pines, broadleaves among them and a few dead snags far back. */
function trees(palette: Theme['scenery']): Planter {
  return (props, rng, grid, first, end) => {
    for (const side of [-1, 1]) {
      for (const verge of [3.4, 9.5, 16.5, 24]) {
        for (let at = first; at < end - 3; at += 5.2 + rng.next() * 5) {
          const s = at + rng.next() * 3;
          const d = side * (grid.halfWidth + verge + rng.next() * 2.4);
          const roll = rng.next();
          const dead = verge > 10 && roll < 0.05;
          const broad = !dead && roll < 0.32;
          const model = dead ? rng.pick(DEAD) : broad ? rng.pick(BROADLEAVES) : rng.pick(PINES);
          const tints = broad ? palette.broadleaf : palette.conifer;
          props.push(
            place(grid, s, d, {
              model,
              scale: 0.85 + rng.next() * 0.55,
              stretch: 0.9 + rng.next() * 0.25,
              angle: rng.next() * Math.PI * 2,
              tint: rng.pick(tints),
              casts: true,
            }),
          );
        }
      }
    }
  };
}

/** Bushes, ferns and rocks along the trail's edge and between the near trees. */
function undergrowth(palette: Theme['scenery']): Planter {
  return (props, rng, grid, first, end) => {
    for (const side of [-1, 1]) {
      for (let s = first; s < end; s += 1.6 + rng.next() * 2.6) {
        const d = side * (grid.halfWidth + 0.9 + rng.next() ** 1.4 * 9);
        const rock = rng.next() < 0.18;
        props.push(
          place(grid, s, d, {
            model: rock ? rng.pick(ROCKS) : rng.pick(BUSHES),
            scale: rock ? 0.3 + rng.next() * 0.45 : 0.7 + rng.next() * 0.6,
            stretch: 1,
            angle: rng.next() * Math.PI * 2,
            tint: rng.pick(rock ? palette.rock : palette.undergrowth),
            casts: rock || rng.next() < 0.5,
          }),
        );
      }
    }
  };
}

/**
 * Dense grass from the shoulder out, flowers and mushrooms among it, pebbles at the trail's edge.
 * `spacing` stretches the gaps between grass clumps (2 on phones).
 */
function groundCover(palette: Theme['scenery'], spacing: number): Planter {
  return (props, rng, grid, first, end) => {
    for (const side of [-1, 1]) {
      for (let s = first; s < end; s += (0.22 + rng.next() * 0.3) * spacing) {
        const d = side * (grid.halfWidth + 0.1 + rng.next() ** 1.7 * 16);
        props.push(
          place(grid, s, d, {
            model: rng.pick(GRASS),
            scale: 0.45 + rng.next() * 0.45,
            stretch: 1,
            angle: rng.next() * Math.PI * 2,
            tint: rng.pick(palette.grass),
            casts: false,
          }),
        );
      }
      for (let s = first; s < end; s += 2.2 + rng.next() * 3.5) {
        const d = side * (grid.halfWidth + 0.6 + rng.next() * 11);
        props.push(
          place(grid, s, d, {
            model: rng.pick(BLOOMS),
            scale: 0.55 + rng.next() * 0.4,
            stretch: 1,
            angle: rng.next() * Math.PI * 2,
            tint: 0xffffff,
            casts: false,
          }),
        );
      }
      for (let s = first; s < end; s += 1.4 + rng.next() * 3.2) {
        const d = side * (grid.halfWidth - 0.7 + rng.next() ** 0.7 * 2.6);
        props.push(
          place(
            grid,
            s,
            d,
            {
              model: rng.pick(PEBBLES),
              scale: 0.7 + rng.next() * 0.9,
              stretch: 1,
              angle: rng.next() * Math.PI * 2,
              tint: rng.pick(palette.rock),
              casts: false,
            },
            0.02,
          ),
        );
      }
    }
  };
}

/** A soft radial falloff used to darken the ground under trees, bushes and rocks. */
function occlusionTexture(): THREE.DataTexture {
  const size = 64;
  const pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const r = Math.hypot((x + 0.5) / size - 0.5, (y + 0.5) / size - 0.5) * 2;
      pixels[(y * size + x) * 4 + 3] = Math.round(255 * Math.max(0, 1 - r) ** 1.6);
    }
  }
  const texture = new THREE.DataTexture(pixels, size, size);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

const OCCLUSION_GEOMETRY = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2);

/** Ground reach of each kind of caster's contact darkening, in model scale units. */
function occlusionRadius(model: ModelName): number {
  if (model.startsWith('Rock')) return 1.6;
  if (model.startsWith('Pine') || model.startsWith('Common') || model.startsWith('Dead')) return 2.8;
  return 1.2;
}

/** Fakes ambient occlusion: a dark soft disc on the ground under each caster. */
function writeOcclusion(root: THREE.Group, material: THREE.Material, props: Prop[]): void {
  if (!props.length) return;
  const mesh = new THREE.InstancedMesh(OCCLUSION_GEOMETRY, material, props.length);
  const transform = new THREE.Object3D();
  for (const [i, p] of props.entries()) {
    const radius = occlusionRadius(p.model) * p.scale;
    transform.position.set(p.x, p.y + 0.08, p.z);
    transform.scale.set(radius, 1, radius);
    transform.rotation.y = p.angle;
    transform.updateMatrix();
    mesh.setMatrixAt(i, transform.matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.renderOrder = 1;
  mesh.computeBoundingSphere();
  root.add(mesh);
}

function writeBatch(root: THREE.Group, kit: NatureKit, props: Prop[]): void {
  const byModel = new Map<ModelName, Prop[]>();
  for (const prop of props) {
    const list = byModel.get(prop.model) ?? [];
    list.push(prop);
    byModel.set(prop.model, list);
  }
  const transform = new THREE.Object3D();
  const color = new THREE.Color();
  for (const [model, list] of byModel) {
    for (const part of kit.parts(model)) {
      const mesh = new THREE.InstancedMesh(part.geometry, part.material, list.length);
      for (const [i, p] of list.entries()) {
        transform.position.set(p.x, p.y, p.z);
        transform.scale.set(p.scale, p.scale * p.stretch, p.scale);
        transform.rotation.y = p.angle;
        transform.updateMatrix();
        mesh.setMatrixAt(i, transform.matrix);
        mesh.setColorAt(i, color.setHex(p.tint));
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.castShadow = list[0]?.casts ?? false;
      mesh.receiveShadow = true;
      mesh.computeBoundingSphere();
      root.add(mesh);
    }
  }
}

/**
 * Plants seeded batches of trees, undergrowth and ground cover from the nature kit on both sides
 * of the trail. Each layer has its own rng. Both renderers share placement and contact shadows;
 * the low tier halves grass density and batches its cutouts by shadow state.
 */
export function plantForest(
  root: THREE.Group,
  grid: TerrainGrid,
  trackLength: number,
  seed: number,
  palette: Theme['scenery'],
  kit: ForestScenery,
  light: boolean,
): void {
  const layers: [Rng, Planter][] = [
    [createRng(seed ^ 0x36be471a), trees(palette)],
    [createRng(seed ^ 0x2d1f00b5), undergrowth(palette)],
    [createRng(seed ^ 0x51a7e2c3), groundCover(palette, light ? 2 : 1)],
  ];
  // The texture is black with a radial alpha, so the disc darkens toward black at its centre.
  const occlusion = new THREE.MeshBasicMaterial({
    map: occlusionTexture(),
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });
  const last = trackLength + SCENERY_RUNOUT.finish;
  for (let first = -SCENERY_RUNOUT.start; first < last; first += TERRAIN_CHUNK) {
    const end = Math.min(first + TERRAIN_CHUNK, last);
    const props: Prop[] = [];
    for (const [rng, planter] of layers) planter(props, rng, grid, first, end);
    const casters = props.filter((p) => p.casts);
    const cover = props.filter((p) => !p.casts);
    writeOcclusion(root, occlusion, casters);
    if ('parts' in kit) {
      writeBatch(root, kit, casters);
      writeBatch(root, kit, cover);
    } else {
      kit.add(root, casters, true);
      kit.add(root, cover, false);
    }
  }
}
