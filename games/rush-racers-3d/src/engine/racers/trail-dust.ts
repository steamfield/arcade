import { createRng } from '@arcade/core';
import * as THREE from 'three';
import type { Racer } from '../../logic/types.ts';
import type { TrackFrame, TrackFrames } from '../track/track-geometry.ts';

const CAPACITY = 48;
const LIFETIME = 23;

/** One soft point batch for grit kicked up by a landing or dash. */
export class TrailDust {
  readonly points: THREE.Points;
  private readonly motes;
  private readonly positions = new THREE.BufferAttribute(new Float32Array(CAPACITY * 3), 3);
  private readonly tints = new THREE.BufferAttribute(new Float32Array(CAPACITY * 4), 4);
  private readonly frame: TrackFrame = { x: 0, y: 0, z: 0, rx: 0, rz: 0, tx: 0, tz: 0 };
  private next = 0;

  constructor(seed: number) {
    const rng = createRng(seed ^ 0x6f71);
    this.motes = Array.from({ length: CAPACITY }, () => ({
      born: -Infinity,
      x: 0,
      y: 0,
      z: 0,
      across: rng.next() - 0.5,
      back: 0.1 + 0.5 * rng.next(),
      rise: 0.25 + 0.26 * rng.next(),
    }));
    const size = 24;
    const pixels = new Uint8Array(size * size * 4).fill(255);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const u = (x + 0.5) / size - 0.5;
        const v = (y + 0.5) / size - 0.5;
        const r = Math.min(
          Math.hypot(u + 0.12, v) * 2.9,
          Math.hypot(u - 0.074, v + 0.1) * 2.8,
          Math.hypot(u - 0.06, v - 0.1) * 2.94,
        );
        pixels[(y * size + x) * 4 + 3] = 255 * Math.max(0, 1 - r * r) ** 1.9;
      }
    }
    const map = new THREE.DataTexture(pixels, size, size);
    map.magFilter = map.minFilter = THREE.LinearFilter;
    map.needsUpdate = true;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', this.positions.setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('color', this.tints.setUsage(THREE.DynamicDrawUsage));
    geometry.setDrawRange(0, 0);
    const material = new THREE.PointsMaterial({
      map,
      size: 0.68,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      color: 0xbda388,
    });
    this.points = new THREE.Points(geometry, material);
    this.points.frustumCulled = false;
    this.points.visible = false;
  }

  clear(): void {
    for (const mote of this.motes) mote.born = -Infinity;
    this.next = 0;
    this.points.visible = false;
  }

  emit(racer: Racer, track: TrackFrames, tick: number, count: number): void {
    const frame = track.frameAt(racer.s, this.frame);
    if (!racer.grounded || Math.abs(racer.y - frame.y) > 0.08) return;
    for (let i = 0; i < count; i++) {
      const mote = this.motes[this.next];
      if (!mote) return;
      this.next = (this.next + 1) % CAPACITY;
      const side = racer.d + mote.across * 1.1;
      mote.x = frame.x + frame.rx * side - frame.tx * (0.32 + mote.back);
      mote.z = frame.z + frame.rz * side - frame.tz * (0.32 + mote.back);
      mote.y = racer.y + 0.1;
      mote.born = tick;
    }
  }

  draw(tick: number): void {
    let count = 0;
    for (const mote of this.motes) {
      const t = (tick - mote.born) / LIFETIME;
      if (t < 0 || t >= 1) continue;
      this.positions.setXYZ(count, mote.x + t * mote.across, mote.y + t * mote.rise, mote.z);
      this.tints.setXYZW(count, 1, 0.96, 0.9, 0.46 * (1 - t) ** 1.5);
      count++;
    }
    this.points.geometry.setDrawRange(0, count);
    this.points.visible = count > 0;
    if (count > 0) this.positions.needsUpdate = this.tints.needsUpdate = true;
  }
}
