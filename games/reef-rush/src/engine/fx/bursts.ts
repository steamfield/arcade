/**
 * The particle recipes behind every race effect: what spawns, how many, how fast and for how
 * long. Each recipe has a reduced-motion form that keeps its information: the same shapes in
 * the same place, fewer of them, standing still or drifting slowly, and fading out instead of
 * flying. Cosmetic randomness comes from the rng passed in, so captures repeat.
 */
import type { Rng } from '@arcade/core';
import type { PowerUpKind } from '../../logic/types.ts';
import { Frame, Tex } from '../art/keys.ts';
import { POWER_UP_TEX } from '../view/powerup-view.ts';
import type { Particle, ParticleField } from './particles.ts';
import { FX_TEXTURE, FxFrame } from './textures.ts';

/** Spawns each effect's particles at a world position in px. */
export interface Bursts {
  /**
   * Bubbles pushed out behind a kick, opposite the racer's velocity (`vx`, `vy` in px/s) just
   * after it; a racer that isn't moving pushes them out behind its `facing`.
   */
  kickPuff(x: number, y: number, vx: number, vy: number, facing: 1 | -1): void;
  /** One bubble shed while swimming. */
  trailBubble(x: number, y: number): void;
  /** A coral tile breaking into chunks that sink, drawn behind the racers so a smashing racer stays readable. */
  coralDebris(x: number, y: number): void;
  /** Sparks where a racer was hit. */
  hitSparks(x: number, y: number): void;
  /** Sparkles where a pearl was taken. */
  pearlSparkle(x: number, y: number): void;
  /** The power-up's icon popping up out of a clam or a loose grab, with a ring of sparkles. */
  pickupPop(x: number, y: number, kind: PowerUpKind): void;
  /** A puff of ink where a cloud was released. */
  inkPuff(x: number, y: number): void;
  /** A bubble bursting into droplets. */
  bubblePop(x: number, y: number): void;
  /** A big rush of bubbles when the player crosses the finish. */
  finishBurst(x: number, y: number): void;
  /** Sparkles rising past the player when it gains a place. */
  placeUp(x: number, y: number): void;
}

/** How a group of particles moves and looks, fixed per recipe so spawning allocates nothing. */
interface Style {
  drag: number;
  ay: number;
  tint: number;
  alpha: number;
  wobble: number;
}

const BUBBLE: Style = { drag: 0.92, ay: -0.025, tint: 0xffffff, alpha: 0.85, wobble: 1 };
const BUBBLE_STILL: Style = { drag: 0.9, ay: -0.008, tint: 0xffffff, alpha: 0.85, wobble: 0 };
const DEBRIS: Style = { drag: 0.95, ay: 0.06, tint: 0xffffff, alpha: 1, wobble: 0 };
const DEBRIS_STILL: Style = { drag: 0.9, ay: 0.01, tint: 0xffffff, alpha: 1, wobble: 0 };
const SPARK: Style = { drag: 0.84, ay: 0, tint: 0xffffff, alpha: 1, wobble: 0 };
const SPARKLE: Style = { drag: 0.88, ay: 0, tint: 0xfff0a0, alpha: 1, wobble: 0 };
const ICON: Style = { drag: 0.9, ay: 0, tint: 0xffffff, alpha: 1, wobble: 0 };
const INK: Style = { drag: 0.88, ay: 0, tint: 0x7a64b0, alpha: 0.9, wobble: 0 };
const DROPLET: Style = { drag: 0.85, ay: -0.01, tint: 0xffffff, alpha: 0.9, wobble: 0 };

/** A ring of particles: set off outward at `speed`, or (speed 0) placed on a circle of `radius` and left still. */
interface RingShape {
  count: number;
  radius: number;
  speed: number;
  life: number;
  frame: string;
  style: Style;
}

const DEBRIS_BUBBLES: RingShape = {
  count: 3,
  radius: 3,
  speed: 0.5,
  life: 30,
  frame: FxFrame.bubbleSmall,
  style: BUBBLE,
};
const HIT_SPARKS: RingShape = { count: 6, radius: 3, speed: 1.8, life: 12, frame: FxFrame.spark, style: SPARK };
const HIT_SPARKS_STILL: RingShape = { count: 4, radius: 8, speed: 0, life: 16, frame: FxFrame.spark, style: SPARK };
const PEARL: RingShape = { count: 5, radius: 2, speed: 1, life: 16, frame: FxFrame.sparkle, style: SPARKLE };
const PEARL_STILL: RingShape = { count: 3, radius: 5, speed: 0, life: 18, frame: FxFrame.sparkle, style: SPARKLE };
const PICKUP: RingShape = { count: 6, radius: 4, speed: 1.1, life: 14, frame: FxFrame.sparkle, style: SPARKLE };
const INK_PUFF: RingShape = { count: 8, radius: 3, speed: 1.1, life: 22, frame: FxFrame.chip, style: INK };
const INK_PUFF_STILL: RingShape = { count: 4, radius: 6, speed: 0, life: 22, frame: FxFrame.chip, style: INK };
const POP: RingShape = { count: 6, radius: 3, speed: 1.3, life: 14, frame: FxFrame.bubbleSmall, style: DROPLET };
const POP_STILL: RingShape = { count: 4, radius: 5, speed: 0, life: 16, frame: FxFrame.bubbleSmall, style: DROPLET };

/** How far behind a kicking racer's centre its puff starts, px. */
const KICK_PUFF_BEHIND = 8;
/** How far above a racer's centre a popped power-up icon starts, px. */
const ICON_RISE_FROM = 12;

/**
 * Builds the recipes. `back` draws behind the racers (trails, kick puffs and coral debris, which
 * would otherwise bury a racer smashing a gate), `front` above them (everything else that marks
 * an event).
 */
export function createBursts(back: ParticleField, front: ParticleField, rng: Rng, reducedMotion: boolean): Bursts {
  const jitter = (spread: number) => (rng.next() * 2 - 1) * spread;

  const ring = (field: ParticleField, x: number, y: number, shape: RingShape) => {
    const turn = rng.next() * Math.PI * 2;
    for (let index = 0; index < shape.count; index++) {
      const angle = turn + (index / shape.count) * Math.PI * 2 + jitter(0.3);
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const life = shape.life + rng.int(0, 4);
      const particle = field.spawn(x + cos * shape.radius, y + sin * shape.radius, life, FX_TEXTURE, shape.frame);
      particle.vx = cos * shape.speed;
      particle.vy = sin * shape.speed;
      applyStyle(particle, shape.style, rng);
    }
  };

  return {
    kickPuff(x, y, vx, vy, facing) {
      const speed = Math.hypot(vx, vy);
      // Unit direction of travel; the puff goes the other way.
      const dirX = speed > 0 ? vx / speed : facing;
      const dirY = speed > 0 ? vy / speed : 0;
      const count = reducedMotion ? 2 : 4;
      for (let index = 0; index < count; index++) {
        const frame = index % 2 === 0 ? FxFrame.bubble : FxFrame.bubbleSmall;
        const across = jitter(3);
        const px = x - dirX * KICK_PUFF_BEHIND - dirY * across;
        const py = y - dirY * KICK_PUFF_BEHIND + dirX * across;
        const particle = back.spawn(px, py, 26 + rng.int(0, 8), FX_TEXTURE, frame);
        const push = reducedMotion ? 0 : 0.6 + rng.next() * 0.8;
        const spread = reducedMotion ? 0 : jitter(0.4);
        particle.vx = -dirX * push - dirY * spread;
        particle.vy = -dirY * push + dirX * spread;
        applyStyle(particle, reducedMotion ? BUBBLE_STILL : BUBBLE, rng);
      }
    },
    trailBubble(x, y) {
      const particle = back.spawn(x, y + jitter(2), 34 + rng.int(0, 12), FX_TEXTURE, FxFrame.bubbleSmall);
      applyStyle(particle, reducedMotion ? BUBBLE_STILL : BUBBLE, rng);
      particle.alpha = 0.6;
    },
    coralDebris(x, y) {
      const count = reducedMotion ? 3 : 4;
      for (let index = 0; index < count; index++) {
        const particle = back.spawn(x + jitter(5), y + jitter(5), 36 + rng.int(0, 10), Tex.coralDebris, Frame.a);
        particle.vx = reducedMotion ? 0 : jitter(1.4);
        particle.vy = reducedMotion ? 0 : -0.4 - rng.next() * 1.2;
        particle.flipX = rng.next() < 0.5;
        applyStyle(particle, reducedMotion ? DEBRIS_STILL : DEBRIS, rng);
      }
      if (!reducedMotion) ring(back, x, y, DEBRIS_BUBBLES);
    },
    hitSparks(x, y) {
      ring(front, x, y, reducedMotion ? HIT_SPARKS_STILL : HIT_SPARKS);
    },
    pearlSparkle(x, y) {
      ring(front, x, y, reducedMotion ? PEARL_STILL : PEARL);
    },
    pickupPop(x, y, kind) {
      const icon = front.spawn(x, y - ICON_RISE_FROM, 34, POWER_UP_TEX[kind], Frame.a);
      icon.vy = reducedMotion ? 0 : -0.9;
      applyStyle(icon, ICON, rng);
      if (!reducedMotion) ring(front, x, y - ICON_RISE_FROM, PICKUP);
    },
    inkPuff(x, y) {
      ring(front, x, y, reducedMotion ? INK_PUFF_STILL : INK_PUFF);
    },
    bubblePop(x, y) {
      ring(front, x, y, reducedMotion ? POP_STILL : POP);
    },
    finishBurst(x, y) {
      const count = reducedMotion ? 8 : 22;
      for (let index = 0; index < count; index++) {
        const frame = index % 3 === 0 ? FxFrame.bubbleSmall : FxFrame.bubble;
        const particle = front.spawn(x + jitter(8), y + jitter(6), 50 + rng.int(0, 24), FX_TEXTURE, frame);
        particle.vx = reducedMotion ? 0 : jitter(1.6);
        particle.vy = reducedMotion ? -0.3 : -0.6 - rng.next() * 1.6;
        applyStyle(particle, reducedMotion ? BUBBLE_STILL : BUBBLE, rng);
      }
    },
    placeUp(x, y) {
      const count = reducedMotion ? 3 : 5;
      for (let index = 0; index < count; index++) {
        const offset = (index - (count - 1) / 2) * 5;
        const particle = front.spawn(x + offset, y + (reducedMotion ? -12 : 6), 28, FX_TEXTURE, FxFrame.sparkle);
        particle.vy = reducedMotion ? 0 : -1.1 - (index % 2) * 0.4;
        applyStyle(particle, SPARKLE, rng);
      }
    },
  };
}

function applyStyle(particle: Particle, style: Style, rng: Rng): void {
  particle.drag = style.drag;
  particle.ay = style.ay;
  particle.tint = style.tint;
  particle.alpha = style.alpha;
  particle.wobble = style.wobble;
  particle.phase = rng.int(0, 31);
}
