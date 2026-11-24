/**
 * Items in the 3D scene: crates on the trail, shots in flight, Mud Pie splats, and item effects on
 * racers (boots flame, burr spikes, sap, stun, a held shield). Reads world state; never changes it.
 */
import { TICK_DT } from '@arcade/core';
import * as THREE from 'three';
import { groundY } from '../logic/course.ts';
import type { Course, Racer, World } from '../logic/types.ts';
import { createItemPools, SPIKE_COUNT, STAR_COUNT } from './item-pools.ts';
import type { TrackFrame, TrackFrames } from './track-geometry.ts';

/** Scene meshes for crates, projectiles and active item effects. */
export interface ItemView {
  /** Add this to the scene once. */
  root: THREE.Group;
  /** Moves and shows everything for `world`'s current tick. */
  sync(world: World): void;
}

const UP = new THREE.Vector3(0, 1, 0);

/** Builds the trail's crate meshes and fixed pools for every racing item and effect. */
export function createItemView(course: Course, track: TrackFrames): ItemView {
  const { root, cratePositions, crates, pie, glob, splats, flame, burr, trap, stun, shield, dynamic } = createItemPools(
    course,
    track,
  );
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const point = new THREE.Object3D();
  const direction = new THREE.Vector3();
  const racerPosition = new THREE.Vector3();
  const frame: TrackFrame = { x: 0, y: 0, z: 0, tx: 0, tz: 0, rx: 0, rz: 0 };
  const openColor = new THREE.Color(0xffffff);
  const shutColor = new THREE.Color(0x625743);
  const seenShut = cratePositions.map(() => false);
  for (let i = 0; i < cratePositions.length; i++) crates.setColorAt(i, openColor);

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
      const y = shot.kind === 'pie' ? shot.y : groundY(course, shot.s) + shot.height;
      place(shot.s, shot.d, y);
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

  function drawBoots(time: number): void {
    const { x, y, z } = racerPosition;
    const { tx, tz, rx, rz } = frame;
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

  function drawBurr(): void {
    const { x, y, z } = racerPosition;
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

  function drawTrap(): void {
    const { x, y, z } = racerPosition;
    const { tx, tz, rx, rz } = frame;
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

  function drawStun(time: number, tall: boolean): void {
    const { x, y, z } = racerPosition;
    for (let i = 0; i < STAR_COUNT; i++) {
      const angle = 4 * time + (i * Math.PI * 2) / STAR_COUNT;
      point.position.set(x + 0.93 * Math.cos(angle), y + (tall ? 2.88 : 2.16), z + 0.93 * Math.sin(angle));
      point.rotation.set(0, time + i * 0.85, 0.24 * Math.sin(angle));
      point.scale.setScalar(0.28);
      stun.draw(point);
    }
  }

  function drawShield(racer: Racer, tall: boolean): void {
    for (const item of racer.slots) {
      if (item?.kind !== 'shield') continue;
      const { x, y, z } = racerPosition;
      point.position.set(x, y + (tall ? 1.41 : 1.06), z);
      point.rotation.set(0, 0, 0);
      point.scale.set(1.29, tall ? 1.52 : 1.22, 1.39);
      shield.draw(point);
      break;
    }
  }

  function drawRacerEffects(world: World, time: number): void {
    for (const racer of world.racers) {
      if (racer.state === 'fallen') continue;
      place(racer.s, racer.d, racer.y);
      racerPosition.copy(point.position);
      const tall = racer.character === 'skip';
      if (racer.bootsTicks > 0) drawBoots(time);
      if (racer.burrTicks > 0) drawBurr();
      if (racer.trappedTicks > 0) drawTrap();
      if (racer.stunTicks > 0) drawStun(time, tall);
      drawShield(racer, tall);
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
