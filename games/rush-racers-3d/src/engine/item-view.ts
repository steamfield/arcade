/**
 * Items in the 3D scene: crates on the trail, shots in flight, Mud Pie splats, and item effects on
 * racers (boots flame, burr spikes, sap, stun, a held shield). Reads world state; never changes it.
 */
import { TICK_DT, TICK_HZ } from '@arcade/core';
import * as THREE from 'three';
import { CRATE, ITEMS, RUN } from '../logic/tuning.ts';
import type { Course, World } from '../logic/types.ts';
import { crateMaterial, flameGeometry, starGeometry } from './item-geometry.ts';
import { createSplatView } from './splat-view.ts';
import type { TrackFrame, TrackFrames } from './track-geometry.ts';

export interface ItemView {
  /** Add this to the scene once. */
  root: THREE.Group;
  /** Moves and shows everything for `world`'s current tick. */
  sync(world: World): void;
}

const RACER_COUNT = 4;
const SPIKE_COUNT = 10;
const STAR_COUNT = 3;
const UP = new THREE.Vector3(0, 1, 0);
function throwCapacity(lifetime: number): number {
  return RACER_COUNT * (1 + Math.ceil(lifetime / ITEMS.cooldownTicks));
}

/** Bounds a pie thrown upwards above the highest log, with the lowest ground beneath it. */
function maxPieFlight(course: Course): number {
  let low = course.hills[0]?.y ?? 0;
  let high = low;
  let log = 0;
  for (const hill of course.hills) {
    low = Math.min(low, hill.y);
    high = Math.max(high, hill.y);
  }
  for (const feature of course.features) {
    if (feature.kind === 'log') log = Math.max(log, feature.height);
  }
  const jump = RUN.jumpSpeed ** 2 / (2 * RUN.gravity);
  const height = high - low + log + jump + RUN.radius;
  const vy = RUN.jumpSpeed + ITEMS.pieThrowUp;
  return Math.ceil((TICK_HZ * (vy + Math.sqrt(vy ** 2 + 2 * RUN.gravity * height))) / RUN.gravity) + 1;
}

class Instances extends THREE.InstancedMesh {
  private readonly range = { start: 0, count: 0 };

  constructor(root: THREE.Group, geometry: THREE.BufferGeometry, material: THREE.Material, capacity: number) {
    super(geometry, material, capacity);
    this.count = 0;
    // Moving instances can reappear anywhere along the trail. A cached sphere would go stale.
    this.frustumCulled = false;
    this.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    root.add(this);
  }

  draw(point: THREE.Object3D): void {
    point.updateMatrix();
    this.setMatrixAt(this.count++, point.matrix);
  }

  upload(): void {
    this.visible = this.count > 0;
    if (!this.visible) return;
    this.range.count = this.count * this.instanceMatrix.itemSize;
    this.instanceMatrix.updateRanges[0] = this.range;
    this.instanceMatrix.needsUpdate = true;
  }
}

/** Builds the trail's crate meshes and fixed pools for every racing item and effect. */
export function createItemView(course: Course, track: TrackFrames): ItemView {
  const root = new THREE.Group();
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const point = new THREE.Object3D();
  const direction = new THREE.Vector3();
  const frame: TrackFrame = { x: 0, y: 0, z: 0, tx: 0, tz: 0, rx: 0, rz: 0 };
  const cratePositions = course.features
    .filter((feature) => feature.kind === 'crate')
    .map(({ s, d }) => {
      const { x, y, z, rx, rz } = track.frameAt(s);
      return new THREE.Vector3(x + d * rx, y + CRATE.height, z + d * rz);
    });
  const crates = new Instances(root, new THREE.BoxGeometry(1.58, 1.58, 1.58), crateMaterial(), cratePositions.length);
  const openColor = new THREE.Color(0xffffff);
  const shutColor = new THREE.Color(0x625743);
  const seenShut = cratePositions.map(() => false);
  for (let i = 0; i < cratePositions.length; i++) crates.setColorAt(i, openColor);

  const ball = new THREE.SphereGeometry(1, 12, 8);
  const cone = new THREE.ConeGeometry(1, 2, 6);
  const pieFlight = maxPieFlight(course);
  const pie = new Instances(
    root,
    new THREE.IcosahedronGeometry(1, 1),
    new THREE.MeshLambertMaterial({ color: 0x854b38 }),
    throwCapacity(pieFlight),
  );
  const sapMaterial = new THREE.MeshPhongMaterial({
    color: 0xea8c23,
    emissive: 0x422200,
    specular: 0xffebad,
    shininess: 38,
  });
  const sapFlight = Math.ceil((TICK_HZ * ITEMS.sapRange) / ITEMS.sapSpeed) + 1;
  const glob = new Instances(root, ball, sapMaterial, throwCapacity(sapFlight));
  const splats = createSplatView(root, course, track, throwCapacity(pieFlight + ITEMS.splatTicks));
  const flame = new Instances(
    root,
    flameGeometry(),
    new THREE.MeshBasicMaterial({ vertexColors: true }),
    RACER_COUNT * 2,
  );
  const burr = new Instances(
    root,
    cone,
    new THREE.MeshLambertMaterial({ color: 0xb65dd0, emissive: 0x381441 }),
    RACER_COUNT * SPIKE_COUNT,
  );
  const trap = new Instances(root, ball, sapMaterial, RACER_COUNT * 3);
  const stun = new Instances(
    root,
    starGeometry(),
    new THREE.MeshLambertMaterial({ color: 0xffe063, emissive: 0x8a6512 }),
    RACER_COUNT * STAR_COUNT,
  );
  const shield = new Instances(
    root,
    new THREE.SphereGeometry(1, 20, 12),
    new THREE.MeshPhongMaterial({
      color: 0xffd979,
      emissive: 0x714d18,
      shininess: 22,
      opacity: 0.22,
      transparent: true,
      depthWrite: false,
    }),
    RACER_COUNT,
  );
  const dynamic = [crates, pie, glob, flame, burr, trap, stun, shield];
  let drawnWorld: World | undefined;
  let drawnTick = -1;
  let reducedMotion = false;

  function place(s: number, d: number, y: number): void {
    const { x, z, rx, rz } = track.frameAt(s, frame);
    point.position.set(x + rx * d, y, z + rz * d);
  }

  function drawCrates(world: World, time: number): void {
    let i = 0;
    for (const position of cratePositions) {
      const shut = (world.crates[i]?.shutTicks ?? 0) > 0;
      if (shut !== seenShut[i]) {
        seenShut[i] = shut;
        crates.setColorAt(i, shut ? shutColor : openColor);
        if (crates.instanceColor) crates.instanceColor.needsUpdate = true;
      }
      point.position.copy(position);
      point.position.y += 0.14 * Math.sin(3.4 * time + i);
      point.rotation.set(0, 0.24 + 1.3 * time + i * 0.47, 0);
      point.scale.setScalar(shut ? 0.88 : 1);
      crates.draw(point);
      i++;
    }
  }

  function drawShots(world: World, time: number): void {
    for (const shot of world.shots) {
      place(shot.s, shot.d, shot.y);
      const heading = Math.atan2(-frame.tx, -frame.tz);
      if (shot.kind === 'pie') {
        point.rotation.set(time * 6, heading, time * 3);
        point.scale.set(0.74, 0.36, 0.66);
        pie.draw(point);
      } else {
        point.rotation.set(0, heading, 0);
        point.scale.set(0.49, 0.49, 0.86);
        glob.draw(point);
      }
    }
  }

  function drawRacerEffects(world: World, time: number): void {
    for (const racer of world.racers) {
      if (racer.state === 'fallen') continue;
      place(racer.s, racer.d, racer.y);
      const { x, y, z } = point.position;
      const { tx, tz, rx, rz } = frame;
      const tall = racer.character === 'skip';
      if (racer.bootsTicks > 0) {
        const length = 0.62 + 0.16 * Math.sin(time * 31);
        direction.set(-tx, -0.1, -tz).normalize();
        point.quaternion.setFromUnitVectors(UP, direction);
        for (let side = -1; side <= 1; side += 2) {
          const footX = x + side * 0.34 * rx;
          const footZ = z + side * 0.34 * rz;
          point.position.set(footX - tx * 1.05, y + 0.3, footZ - tz * 1.05);
          point.scale.set(0.26, length, 0.23);
          flame.draw(point);
        }
      }
      if (racer.burrTicks > 0) {
        for (let i = 0; i < SPIKE_COUNT; i++) {
          const angle = (i * Math.PI * 2) / SPIKE_COUNT;
          const dx = Math.cos(angle);
          const dz = Math.sin(angle);
          direction.set(dx, 0.33, dz).normalize();
          point.quaternion.setFromUnitVectors(UP, direction);
          point.position.set(x + dx * 0.74, y + 1 + (i % 2) * 0.29, z + dz * 0.74);
          point.scale.set(0.24, 0.49, 0.24);
          burr.draw(point);
        }
      }
      if (racer.trappedTicks > 0) {
        point.rotation.set(0, 0, 0);
        point.position.set(x, y + 0.29, z);
        point.scale.set(1.1, 0.46, 0.97);
        trap.draw(point);
        for (let side = -1; side <= 1; side += 2) {
          point.position.set(x + side * 0.65 * rx - tx * 0.42, y + 0.21, z + side * 0.65 * rz - tz * 0.42);
          point.scale.set(0.59, 0.3, 0.61);
          trap.draw(point);
        }
      }
      if (racer.stunTicks > 0) {
        for (let i = 0; i < STAR_COUNT; i++) {
          const angle = 4 * time + (i * Math.PI * 2) / STAR_COUNT;
          point.position.set(x + 0.93 * Math.cos(angle), y + (tall ? 2.88 : 2.16), z + 0.93 * Math.sin(angle));
          point.rotation.set(0, time + i * 0.85, 0.24 * Math.sin(angle));
          point.scale.setScalar(0.28);
          stun.draw(point);
        }
      }
      for (const item of racer.slots) {
        if (item?.kind !== 'shield') continue;
        point.position.set(x, y + (tall ? 1.41 : 1.06), z);
        point.rotation.set(0, 0, 0);
        point.scale.set(1.29, tall ? 1.52 : 1.22, 1.39);
        shield.draw(point);
        break;
      }
    }
  }

  return {
    root,
    sync(world) {
      const reduced = motion.matches;
      if (drawnWorld === world && drawnTick === world.tick && reducedMotion === reduced) return;
      drawnWorld = world;
      drawnTick = world.tick;
      reducedMotion = reduced;
      const time = reduced ? 0 : world.tick * TICK_DT;
      for (const batch of dynamic) batch.count = 0;
      drawCrates(world, time);
      // A finished world is also retained behind the title and character-select screens.
      if (world.phase !== 'finished') {
        drawShots(world, time);
        drawRacerEffects(world, time);
      }
      splats.sync(world.phase === 'finished' ? undefined : world.splats);
      for (const batch of dynamic) batch.upload();
    },
  };
}
