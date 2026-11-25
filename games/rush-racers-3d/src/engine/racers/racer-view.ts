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
/**
 * A vertex-colored standard material with a faint warm fresnel rim so the racer separates from
 * the background. `opacity < 1` makes the see-through variant used while invulnerable.
 */
function racerMaterial(roughness: number, opacity: number): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness,
    metalness: 0,
    transparent: opacity < 1,
    opacity,
  });
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <opaque_fragment>',
      `float rim = pow(1.0 - saturate(dot(normalize(normal), normalize(vViewPosition))), 3.0);
       outgoingLight += rim * 0.2 * vec3(1.0, 0.93, 0.82);
       #include <opaque_fragment>`,
    );
  };
  material.customProgramCacheKey = () => 'racer-rim';
  return material;
}

const FUR = racerMaterial(0.75, 1);
const FADING_FUR = racerMaterial(0.75, 0.58);
const GLOSS = racerMaterial(0.25, 1);
const FADING_GLOSS = racerMaterial(0.25, 0.58);

/** How far a racer is from standing still, and what its body is doing, as the pose wants it. */
interface Motion {
  /** Stride phase in radians. */
  phase: number;
  /** 0 when still or airborne, 1 at a full run. */
  weight: number;
  /** Forward speed as a fraction of top speed. */
  speed: number;
  /** Vertical speed as a -1..1 fraction of jump speed. */
  rise: number;
  /** Sideways steering as a -1..1 fraction of full steer. */
  steer: number;
  /** 1 on the tick of a hard landing, fading to 0. */
  landing: number;
}

const LANDING_DECAY = 0.84;
const LANDING_SQUASH = 0.22;
const STRETCH = 0.14;
const LEAN = 0.16;
const clamp1 = (value: number): number => THREE.MathUtils.clamp(value, -1, 1);

/** A posed runner and blob shadow with shared character geometry and fur materials. */
export class RacerView {
  readonly root = new THREE.Group();
  readonly character: CharacterId;
  private readonly runner = new THREE.Group();
  private readonly pose = new THREE.Group();
  private readonly motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  private readonly frame: TrackFrame = { x: 0, y: 0, z: 0, tx: 0, tz: 0, rx: 0, rz: 0 };
  private readonly body: THREE.Mesh;
  private readonly gloss: THREE.Mesh;
  private readonly legs: THREE.Mesh[] = [];
  private readonly legRest: number;
  private readonly tail?: THREE.Mesh;
  private readonly ears?: THREE.Mesh;
  private readonly shadow = new THREE.Mesh(
    SHADOW_GEOMETRY,
    new THREE.MeshBasicMaterial({ map: SHADOW_MAP, transparent: true, depthWrite: false }),
  );
  private stride = 0;
  private landing = 0;
  private wasGrounded = true;
  private lastRise = 0;

  constructor(character: CharacterId) {
    this.character = character;
    const { body, gloss, leg, limbs, tail, ears } = geometryFor(character);
    const { x, y, front, back } = limbs;
    this.legRest = y;
    for (const side of [-1, 1]) {
      for (const z of back === undefined ? [front] : [front, back]) {
        const foot = new THREE.Mesh(leg, FUR);
        foot.position.set(side * x, y, z);
        this.legs.push(foot);
      }
    }
    this.body = new THREE.Mesh(body, FUR);
    this.gloss = new THREE.Mesh(gloss, GLOSS);
    const meshes = [this.body, this.gloss, ...this.legs];
    if (tail) {
      this.tail = new THREE.Mesh(tail.geometry, FUR);
      this.tail.position.copy(tail.pivot);
      meshes.push(this.tail);
    }
    if (ears) {
      this.ears = new THREE.Mesh(ears.geometry, FUR);
      this.ears.position.copy(ears.pivot);
      meshes.push(this.ears);
    }
    for (const mesh of meshes) mesh.castShadow = true;
    this.pose.add(...meshes);
    this.runner.add(this.pose);

    this.shadow.rotation.order = 'YXZ';
    this.root.add(this.runner, this.shadow);
  }

  /** Restarts the stride cycle when this view is reused for a new race. */
  resetPose(): void {
    this.stride = 0;
    this.landing = 0;
    this.wasGrounded = true;
    this.lastRise = 0;
  }

  /** Poses a dedicated select-screen model on the pedestal, breathing and swishing as it turns. */
  preview(x: number, y: number, z: number, turn: number): void {
    this.runner.position.set(x, y, z);
    this.runner.rotation.y = this.motion.matches ? 0.45 : turn;
    this.shadow.position.set(x, y + 0.012, z);
    this.shadow.material.opacity = 0.45;
    this.pose.rotation.z = 0;
    this.pose.position.y = 0;
    this.applyMotion(
      { phase: turn * 3, weight: 0, speed: 0, rise: 0, steer: 0, landing: 0 },
      0.025 * Math.sin(turn * 4),
    );
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
    const steer = clamp1(racer.vd / RUN.steerSpeed);
    this.pose.rotation.z = -0.24 * steer;
    const speed = Math.hypot(racer.vs, racer.vd);
    const weight = racer.grounded ? Math.min(1, speed / 4) : 0;
    this.stride += speed * TICK_DT * 2.3;
    const rise = clamp1(racer.vy / RUN.jumpSpeed);
    if (racer.grounded && !this.wasGrounded) this.landing = Math.min(1, Math.max(0.3, -this.lastRise));
    this.landing *= LANDING_DECAY;
    this.wasGrounded = racer.grounded;
    this.lastRise = rise;
    this.pose.position.y = this.motion.matches ? 0 : 0.12 * weight * Math.abs(Math.sin(this.stride));
    const fade = racer.invulnTicks > 0 && (this.motion.matches || racer.invulnTicks % 24 >= 12);
    this.applyMotion(
      { phase: this.stride, weight, speed: Math.min(1, speed / RUN.runSpeed), rise, steer, landing: this.landing },
      0,
      fade,
    );
    this.syncShadow(racer, course, y, heading);
  }

  /**
   * Poses legs, tail, ears, lean and squash from `motion`. Everything is a pure function of logic
   * state and the tick-driven stride phase, never of wall-clock time. `breath` is an extra
   * body scale used while idle.
   */
  private applyMotion(motion: Motion, breath: number, fade = false): void {
    const calm = this.motion.matches;
    const { phase, weight, speed, rise, steer, landing } = motion;
    const swing = 0.8 * weight * Math.sin(phase);
    const squash = calm ? 0 : STRETCH * Math.abs(rise) - LANDING_SQUASH * landing + breath;
    this.pose.scale.set(1 / Math.sqrt(1 + squash), 1 + squash, 1 / Math.sqrt(1 + squash));
    this.pose.rotation.x = -LEAN * speed + 0.14 * rise + (calm ? 0 : 0.04 * weight * Math.cos(phase * 2));
    const fur = fade ? FADING_FUR : FUR;
    this.body.material = fur;
    this.gloss.material = fade ? FADING_GLOSS : GLOSS;
    let i = 0;
    for (const leg of this.legs) {
      const diagonal = i === 0 || i === 3;
      leg.rotation.x = diagonal ? swing : -swing;
      const lift = Math.max(0, Math.cos(diagonal ? phase : phase + Math.PI));
      leg.position.y = this.legRest + (calm ? 0 : 0.07 * weight * lift);
      leg.material = fur;
      i++;
    }
    if (this.tail) {
      this.tail.material = fur;
      this.tail.rotation.x = calm ? 0 : 0.12 * weight * Math.sin(phase * 2 + 1) - 0.25 * rise;
      this.tail.rotation.y = calm ? 0 : 0.35 * Math.sin(phase + 1.2) * (0.35 + weight) - 0.45 * steer;
    }
    if (this.ears) {
      this.ears.material = fur;
      const flick = 0.12 * weight * Math.sin(phase * 2 - 0.8);
      this.ears.rotation.x = calm ? 0 : 0.35 * speed + 0.3 * rise + flick - 0.3 * landing;
    }
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
    this.shadow.material.opacity = 0.5 / (1 + rise * 0.65);
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
