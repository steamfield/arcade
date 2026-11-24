import { TICK_DT } from '@arcade/core';
import * as THREE from 'three';
import type { Racer } from '../logic/types.ts';
import type { TrackFrame, TrackFrames } from './track-geometry.ts';

const FOLLOW = 1 - Math.exp(-10 * TICK_DT);

/**
 * Third-person follow camera. Smoothing is visual only and never feeds back
 * into game logic. It advances once per logic tick, so the framing at a given
 * tick is the same on a 60 Hz or 120 Hz screen and in test mode, where
 * advance(n) runs n ticks and renders once.
 */
export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;
  private readonly track: TrackFrames;
  private readonly frame: TrackFrame = { x: 0, y: 0, z: 0, tx: 0, tz: 0, rx: 0, rz: 0 };
  private readonly goal = new THREE.Vector3();
  private readonly aim = new THREE.Vector3();
  private readonly look = new THREE.Vector3();

  constructor(track: TrackFrames) {
    this.track = track;
    this.camera = new THREE.PerspectiveCamera(53, 1, 0.1, 135);
  }

  /** Call once per logic tick. Snap on initial placement, a restart or a respawn. */
  tick(racer: Racer, snap = false): void {
    const frame = this.track.frameAt(racer.s, this.frame);
    // Follow the trail's height through jumps so the camera clears the arches.
    this.goal.set(
      frame.x + frame.rx * racer.d - frame.tx * 8.7,
      frame.y + 4.45,
      frame.z + frame.rz * racer.d - frame.tz * 8.7,
    );
    this.track.frameAt(racer.s + 10, frame);
    this.aim.set(frame.x + frame.rx * racer.d * 0.45, frame.y + 0.5, frame.z + frame.rz * racer.d * 0.45);
    const follow = snap ? 1 : FOLLOW;
    this.camera.position.lerp(this.goal, follow);
    this.look.lerp(this.aim, follow);
    this.camera.lookAt(this.look);
  }

  /** Glide above the first bend on a continuous path while the title is up. */
  title(seconds: number): void {
    const s = 119 + 37 * Math.sin(seconds * 0.08);
    const { x, y, z, rx, rz } = this.track.frameAt(s, this.frame);
    this.camera.position.set(x + 3 * rx, y + 5.6, z + 3 * rz);
    const ahead = this.track.frameAt(s + 26, this.frame);
    this.camera.lookAt(ahead.x, ahead.y + 0.9, ahead.z);
  }

  /** Frame the pedestal to the right of the card grid. */
  select(pedestal: THREE.Vector3): void {
    const offset = this.camera.aspect * 1.25;
    this.camera.position.set(pedestal.x + offset, pedestal.y + 2.55, pedestal.z - 6.2);
    this.camera.lookAt(pedestal.x + offset, pedestal.y + 0.95, pedestal.z);
  }

  /** Updates the projection when the game viewport changes size. */
  resize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }
}
