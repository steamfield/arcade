import { TICK_DT } from '@arcade/core';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { groundY } from '../logic/course.ts';
import { RUN } from '../logic/tuning.ts';
import type { CharacterId, Course, Racer } from '../logic/types.ts';
import type { TrackFrame, TrackFrames } from './track-geometry.ts';

// Okabe–Ito colors, with dark slate in place of black for visibility against the trail.
const FUR: Record<CharacterId, number> = {
  grit: 0x0072b2,
  skip: 0xe69f00,
  blaze: 0xd55e00,
  shade: 0x55546d,
  cheeks: 0xcc79a7,
  duke: 0x009e73,
  dusk: 0x56b4e9,
  fang: 0xf0e442,
};

function tint(geometry: THREE.BufferGeometry, tint: THREE.Color): void {
  const colors = new Float32Array(geometry.getAttribute('position').count * 3);
  for (let i = 0; i < colors.length; i += 3) tint.toArray(colors, i);
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}

function shadowTexture(): THREE.DataTexture {
  const size = 32;
  const pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const radius = Math.hypot((x + 0.5) / size - 0.5, (y + 0.5) / size - 0.5) * 2;
      pixels[(y * size + x) * 4 + 3] = Math.round(220 * Math.max(0, 1 - radius * radius) ** 2);
    }
  }
  const texture = new THREE.DataTexture(pixels, size, size);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

/** One view owns the runner and its blob shadow, so a restart can dispose them together. */
export class RacerView {
  readonly root = new THREE.Group();
  private readonly runner = new THREE.Group();
  private readonly pose = new THREE.Group();
  private readonly material = new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true });
  private readonly motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  private readonly frame: TrackFrame = { x: 0, y: 0, z: 0, tx: 0, tz: 0, rx: 0, rz: 0 };
  private readonly body: THREE.BufferGeometry;
  private readonly leg: THREE.BufferGeometry;
  private readonly legs: THREE.Mesh[];
  private readonly shadow: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  private readonly shadowMap = shadowTexture();
  private stride = 0;

  constructor(character: CharacterId) {
    const fur = new THREE.Color(FUR[character]);
    const bib = new THREE.Color(0xffe2af);
    const dark = new THREE.Color(0x332627);
    const sphere = new THREE.SphereGeometry(1, 14, 9);
    const pieces: THREE.BufferGeometry[] = [];
    const part = (color: THREE.Color, x: number, y: number, z: number, sx: number, sy: number, sz: number) => {
      const geometry = sphere.clone().scale(sx, sy, sz).translate(x, y, z);
      tint(geometry, color);
      pieces.push(geometry);
    };
    part(fur, 0, 0.86, 0, 0.51, 0.6, 0.4); // Body
    part(bib, 0, 0.89, -0.31, 0.33, 0.43, 0.16);
    part(fur, 0, 1.43, -0.14, 0.48, 0.4, 0.42); // Head
    part(bib, 0, 1.32, -0.49, 0.27, 0.18, 0.18);
    part(dark, 0, 1.39, -0.64, 0.1, 0.075, 0.065);
    part(bib, 0, 0.73, 0.43, 0.26, 0.23, 0.27); // Tail
    for (const side of [-1, 1]) {
      part(fur, side * 0.34, 1.78, -0.13, 0.22, 0.27, 0.17);
      part(bib, side * 0.35, 1.81, -0.24, 0.135, 0.17, 0.088);
      part(dark, side * 0.27, 1.51, -0.48, 0.065, 0.085, 0.05);
    }
    this.body = mergeGeometries(pieces);
    for (const piece of pieces) piece.dispose();
    this.leg = sphere.scale(0.17, 0.3, 0.19).translate(0, -0.22, -0.05);
    tint(this.leg, fur.clone().multiplyScalar(0.78));
    this.legs = [];
    for (const side of [-1, 1]) {
      for (const z of [-0.23, 0.25]) {
        const leg = new THREE.Mesh(this.leg, this.material);
        leg.position.set(side * 0.29, 0.53, z);
        this.legs.push(leg);
      }
    }
    this.pose.add(new THREE.Mesh(this.body, this.material), ...this.legs);
    this.runner.add(this.pose);

    this.shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(2.0, 1.65).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: this.shadowMap, transparent: true, depthWrite: false }),
    );
    this.shadow.rotation.order = 'YXZ';
    this.root.add(this.runner, this.shadow);
  }

  tick(racer: Racer, track: TrackFrames, course: Course): void {
    this.root.visible = racer.state !== 'fallen';
    if (!this.root.visible) return;

    const { x, y, z, tx, tz, rx, rz } = track.frameAt(racer.s, this.frame);
    const worldX = x + racer.d * rx;
    const worldZ = z + racer.d * rz;
    const heading = Math.atan2(tx, -tz);
    this.runner.position.set(worldX, racer.y, worldZ);
    this.runner.rotation.y = -heading - Math.atan2(racer.vd, racer.vs);
    this.pose.rotation.z = -0.24 * THREE.MathUtils.clamp(racer.vd / RUN.steerSpeed, -1, 1);
    const speed = Math.hypot(racer.vs, racer.vd);
    const weight = racer.grounded ? Math.min(1, speed / 4) : 0;
    this.stride += speed * TICK_DT * 2.3;
    const stride = Math.sin(this.stride);
    this.pose.position.y = this.motion.matches ? 0 : 0.12 * weight * Math.abs(stride);
    const swing = 0.7 * weight * stride;
    let i = 0;
    for (const leg of this.legs) {
      leg.rotation.x = i === 0 || i === 3 ? swing : -swing;
      i++;
    }
    this.material.opacity = racer.invulnTicks > 0 ? 0.58 : 1;

    // Skip the blob when its footprint crosses a pit edge or the racer is standing on a log.
    this.shadow.visible = !(racer.grounded && racer.y > y + 0.05);
    for (const feature of course.features) {
      if (
        feature.kind === 'pit' &&
        racer.s + 0.85 > feature.s0 &&
        racer.s - 0.85 < feature.s1 &&
        racer.d + 1 > feature.d0 &&
        racer.d - 1 < feature.d1
      ) {
        this.shadow.visible = false;
        break;
      }
    }
    const rise = Math.max(0, racer.y - y);
    this.shadow.position.set(worldX, y + 0.035, worldZ);
    this.shadow.rotation.set(Math.atan(groundY(course, racer.s + 1) - y), -heading, 0);
    this.shadow.material.opacity = 0.5 / (1 + rise * 0.65);
  }

  dispose(): void {
    this.root.removeFromParent();
    this.body.dispose();
    this.leg.dispose();
    this.material.dispose();
    this.shadow.geometry.dispose();
    this.shadow.material.dispose();
    this.shadowMap.dispose();
  }
}
