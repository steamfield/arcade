import { TICK_DT } from '@arcade/core';
import * as THREE from 'three';
import { groundY } from '../../logic/course.ts';
import { RUN } from '../../logic/tuning.ts';
import type { CharacterId, Course, Racer, RacerId, World } from '../../logic/types.ts';
import type { TrackFrame, TrackFrames } from '../track/track-geometry.ts';
import { geometryFor } from './racer-geometry.ts';

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

const SHADOW_MAP = shadowTexture();
const SHADOW_GEOMETRY = new THREE.PlaneGeometry(2, 1.65).rotateX(-Math.PI / 2);
const FUR = new THREE.MeshLambertMaterial({ vertexColors: true });
const FADING_FUR = new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.58 });

/** A posed runner, casting a sun shadow, plus a soft contact blob with shared character geometry and fur materials. */
export class RacerView {
  readonly root = new THREE.Group();
  readonly character: CharacterId;
  private readonly runner = new THREE.Group();
  private readonly pose = new THREE.Group();
  private readonly motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  private readonly frame: TrackFrame = { x: 0, y: 0, z: 0, tx: 0, tz: 0, rx: 0, rz: 0 };
  private readonly body: THREE.Mesh;
  private readonly legs: THREE.Mesh[] = [];
  private readonly shadow = new THREE.Mesh(
    SHADOW_GEOMETRY,
    new THREE.MeshBasicMaterial({ map: SHADOW_MAP, transparent: true, depthWrite: false }),
  );
  private stride = 0;

  constructor(character: CharacterId) {
    this.character = character;
    const { body, leg, limbs } = geometryFor(character);
    const { x, y, front, back } = limbs;
    for (const side of [-1, 1]) {
      for (const z of back === undefined ? [front] : [front, back]) {
        const foot = new THREE.Mesh(leg, FUR);
        foot.castShadow = true;
        foot.position.set(side * x, y, z);
        this.legs.push(foot);
      }
    }
    this.body = new THREE.Mesh(body, FUR);
    this.body.castShadow = true;
    this.body.receiveShadow = true;
    this.pose.add(this.body, ...this.legs);
    this.runner.add(this.pose);

    this.shadow.rotation.order = 'YXZ';
    this.root.add(this.runner, this.shadow);
  }

  /** Restarts the stride cycle when this view is reused for a new race. */
  resetPose(): void {
    this.stride = 0;
  }

  /** Poses a dedicated select-screen model on the pedestal. */
  preview(x: number, y: number, z: number, turn: number): void {
    this.runner.position.set(x, y, z);
    this.runner.rotation.y = this.motion.matches ? 0.45 : turn;
    this.shadow.position.set(x, y + 0.012, z);
    this.shadow.material.opacity = 0.32;
  }

  /** Updates the visual pose and shadow from the racer's current logic state. */
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
    const fade = racer.invulnTicks > 0 && (this.motion.matches || racer.invulnTicks % 24 >= 12);
    const fur = fade ? FADING_FUR : FUR;
    this.body.material = fur;
    let i = 0;
    for (const leg of this.legs) {
      leg.rotation.x = i === 0 || i === 3 ? swing : -swing;
      leg.material = fur;
      i++;
    }
    this.syncShadow(racer, course, y, heading);
  }

  private syncShadow(racer: Racer, course: Course, y: number, heading: number): void {
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
    this.shadow.position.set(this.runner.position.x, y + 0.035, this.runner.position.z);
    this.shadow.rotation.set(Math.atan(groundY(course, racer.s + 1) - y), -heading, 0);
    this.shadow.material.opacity = 0.34 / (1 + rise * 0.65);
  }

  /** Removes this view and disposes its blob shadow material. */
  dispose(): void {
    this.root.removeFromParent();
    this.shadow.material.dispose();
  }
}

/** Owns the racer meshes attached to the race scene. */
export class RacerViews {
  private readonly views = new Map<RacerId, RacerView>();
  private readonly scene: THREE.Scene;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  /** Reuses matching views and resets their poses for a new race. */
  sync(racers: readonly Racer[]): void {
    for (const [id, view] of this.views) {
      if (racers.some((racer) => racer.id === id && racer.character === view.character)) {
        view.resetPose();
      } else {
        view.dispose();
        this.views.delete(id);
      }
    }
    for (const racer of racers) {
      if (this.views.has(racer.id)) continue;
      const view = new RacerView(racer.character);
      this.views.set(racer.id, view);
      this.scene.add(view.root);
    }
  }

  /** Poses the current racers once per tick. */
  tick(world: World, frames: TrackFrames, course: Course): void {
    for (const racer of world.racers) this.views.get(racer.id)?.tick(racer, frames, course);
  }

  /** Hides the racers while the menus are shown. */
  hide(): void {
    for (const view of this.views.values()) view.root.visible = false;
  }
}
