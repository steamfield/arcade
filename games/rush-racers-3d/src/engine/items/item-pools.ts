import { TICK_HZ } from '@arcade/core';
import * as THREE from 'three';
import { CRATE, ITEMS, RUN } from '../../logic/tuning.ts';
import type { Course } from '../../logic/types.ts';
import type { TrackFrames } from '../track/track-geometry.ts';
import { crateMaterial, flameGeometry, starGeometry } from './item-geometry.ts';
import { createSplatView } from './splat-view.ts';

const RACER_COUNT = 4;
/** Spikes drawn around each racer using a Burr Ball. */
export const SPIKE_COUNT = 10;
/** Stars circling each stunned racer. */
export const STAR_COUNT = 3;
// Matches the rendered pit depth in track-terrain.ts.
const PIT_DEPTH = 8;

/** Caps concurrent throws from four racers firing at every cooldown interval. */
function throwCapacity(lifetime: number): number {
  return RACER_COUNT * (1 + Math.ceil(lifetime / ITEMS.cooldownTicks));
}

/** Bounds flight from above the highest log down to the lowest possible pit floor. */
function maxPieFlight(course: Course): number {
  let low = course.hills[0]?.y ?? 0;
  let high = low;
  let log = 0;
  let pitDepth = 0;
  for (const hill of course.hills) {
    low = Math.min(low, hill.y);
    high = Math.max(high, hill.y);
  }
  for (const feature of course.features) {
    if (feature.kind === 'log') log = Math.max(log, feature.height);
    if (feature.kind === 'pit') pitDepth = PIT_DEPTH;
  }
  const jump = RUN.jumpSpeed ** 2 / (2 * RUN.gravity);
  const height = high - low + pitDepth + log + jump + RUN.radius;
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
    if (this.count >= this.instanceMatrix.count) return;
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

/** Builds fixed-capacity pools with shared geometry and materials. */
export function createItemPools(course: Course, track: TrackFrames) {
  const root = new THREE.Group();
  const cratePositions = course.features
    .filter((feature) => feature.kind === 'crate')
    .map(({ s, d }) => {
      const { x, y, z, rx, rz } = track.frameAt(s);
      return new THREE.Vector3(x + d * rx, y + CRATE.height, z + d * rz);
    });
  // The crate pool is capped at one box per crate feature, in feature order.
  const crates = new Instances(root, new THREE.BoxGeometry(1.58, 1.58, 1.58), crateMaterial(), cratePositions.length);
  const ball = new THREE.SphereGeometry(1, 12, 8);
  const cone = new THREE.ConeGeometry(1, 2, 6);
  const pieFlight = maxPieFlight(course);
  // The pie pool is capped at the throws that can fit in the longest flight.
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
  // The glob pool is capped at the throws that can fit in a full-range flight.
  const glob = new Instances(root, ball, sapMaterial, throwCapacity(sapFlight));
  // The splat pool is capped by the longest pie flight plus the time a patch stays on the ground.
  const splats = createSplatView(root, course, track, throwCapacity(pieFlight + ITEMS.splatTicks));
  // Racer effects are capped at two flames, ten spikes, three sap lobes, three stars,
  // and one shield bubble per racer.
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
  return { root, cratePositions, crates, pie, glob, splats, flame, burr, trap, stun, shield, dynamic };
}
