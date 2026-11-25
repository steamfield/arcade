import { createRng, TICK_DT } from '@arcade/core';
import * as THREE from 'three';
import type { Course, Feature } from '../../logic/types.ts';
import type { TrackFrame, TrackFrames } from './track-geometry.ts';

type Gust = Extract<Feature, { kind: 'gust' }>;

interface Leaf {
  frame: TrackFrame;
  across: number;
  height: number;
}

interface GustBatch {
  gust: Gust;
  mesh: THREE.InstancedMesh;
  leaves: Leaf[];
}

function buildBatches(
  root: THREE.Group,
  course: Course,
  track: TrackFrames,
  seed: number,
  palette: readonly number[],
): GustBatch[] {
  const rng = createRng(seed ^ 0xa91e3493);
  const leaf = new THREE.PlaneGeometry(0.42, 0.17).rotateZ(Math.PI / 4);
  const material = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide });
  return course.features
    .filter((feature) => feature.kind === 'gust')
    .map((gust) => {
      const count = Math.ceil((gust.s1 - gust.s0) * 1.35);
      const mesh = new THREE.InstancedMesh(leaf, material, count);
      // Leaves wrap across the full span. Render the small batch without cached instance bounds.
      mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      const leaves = Array.from({ length: count }, (_, i) => {
        mesh.setColorAt(i, new THREE.Color(rng.pick(palette)));
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
}

function drawGust({ gust, mesh, leaves }: GustBatch, point: THREE.Object3D, time: number, flutter: number): void {
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

/** Adds seeded gust leaves and returns a function that animates them at a given race tick. */
export function windLeaves(
  root: THREE.Group,
  course: Course,
  track: TrackFrames,
  seed: number,
  palette: readonly number[],
) {
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const batches = buildBatches(root, course, track, seed, palette);
  const point = new THREE.Object3D();
  let drawnTick = -1;
  return (tick: number) => {
    if (drawnTick === tick) return;
    drawnTick = tick;
    const time = tick * TICK_DT;
    const flutter = motion.matches ? 0 : time;
    for (const batch of batches) drawGust(batch, point, time, flutter);
  };
}
