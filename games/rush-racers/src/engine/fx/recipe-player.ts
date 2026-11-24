/**
 * Spawns a recipe's particles (`recipe-types.ts`) at a point. Each pattern says where a particle
 * starts and how fast it leaves; each motion maps to the theme's particle physics. Under reduced
 * motion every part keeps its shape and place but spawns half as many particles, standing still
 * where they would have been a few ticks in, as the older bursts do. Randomness comes from the
 * cosmetic rng passed in, so captures repeat.
 */
import type { Rng } from '@arcade/core';
import type { ParticleMotion, Theme } from '../themes/types.ts';
import type { Particle, ParticleField } from './particles.ts';
import type { Motion, Recipe, RecipePart } from './recipe-types.ts';
import { FX_TEXTURE } from './textures.ts';

/** Plays recipes into the race's two particle fields. */
export interface RecipePlayer {
  /**
   * Spawns `recipe` around (`x`, `y`) px. (`dirX`, `dirY`) is a unit vector for the way the moment
   * points (a racer's heading), which streaks trail behind; other patterns ignore it.
   */
  play(recipe: Recipe, x: number, y: number, dirX: number, dirY: number): void;
}

/** Sparks, flames and streaks: quick to slow, weightless, the same in every medium. */
const COAST: ParticleMotion = { drag: 0.86, ay: 0, wobble: 0 };
/** What a coasting, drifting or splashing part does under reduced motion: stay put. */
const STILL: ParticleMotion = { drag: 0.8, ay: 0, wobble: 0 };
/** Under reduced motion a particle stands where it would have flown in this many ticks. */
const STILL_REACH_TICKS = 4;
/** Ticks added at random to each particle's life, so a burst thins out rather than vanishing at once. */
const LIFE_SPREAD = 4;
/** A ring's particles sit this far (radians) off even spacing, so rings don't look stamped. */
const RING_JITTER = 0.3;
/** Px a streak's particles sit to either side of its line. */
const STREAK_WIDTH = 1.5;

/** Where one particle starts relative to the point, and its velocity, px and px per tick. */
interface Launch {
  dx: number;
  dy: number;
  vx: number;
  vy: number;
  /** Multiplies the part's life. */
  lifeScale: number;
}

/**
 * Builds a player that spawns into `back` (behind the racers) and `front` (above them), moving
 * particles by `theme`'s physics.
 */
export function createRecipePlayer(
  back: ParticleField,
  front: ParticleField,
  rng: Rng,
  theme: Pick<Theme, 'particles'>,
  reducedMotion: boolean,
): RecipePlayer {
  const motions = motionsFor(theme, reducedMotion);
  const launch: Launch = { dx: 0, dy: 0, vx: 0, vy: 0, lifeScale: 1 };

  const playPart = (part: RecipePart, x: number, y: number, dirX: number, dirY: number) => {
    const field = part.layer === 'back' ? back : front;
    const count = reducedMotion ? Math.ceil(part.count / 2) : part.count;
    const slot: Slot = { index: 0, count, turn: rng.next() * Math.PI * 2, dirX, dirY };
    for (let index = 0; index < count; index++) {
      slot.index = index;
      aim(launch, part, slot, rng);
      if (reducedMotion) holdStill(launch);
      const life = Math.round(part.life * launch.lifeScale) + rng.int(0, LIFE_SPREAD);
      const particle = field.spawn(x + launch.dx, y + launch.dy, life, FX_TEXTURE, part.look.frame);
      particle.vx = launch.vx;
      particle.vy = launch.vy;
      particle.flipX = dirX < 0;
      applyLook(particle, part, motions[part.motion], rng);
    }
  };

  return {
    play(recipe, x, y, dirX, dirY) {
      for (const part of recipe) playPart(part, x, y, dirX, dirY);
    },
  };
}

/** Each motion's physics in `theme`, or its still form under reduced motion. */
function motionsFor({ particles }: Pick<Theme, 'particles'>, reducedMotion: boolean): Record<Motion, ParticleMotion> {
  if (reducedMotion)
    return { rise: particles.riseStill, fall: particles.fallStill, drift: STILL, splash: STILL, coast: STILL };
  return { rise: particles.rise, fall: particles.fall, drift: particles.drift, splash: particles.splash, coast: COAST };
}

/** Which particle of how many is being launched, and which way the moment points. */
interface Slot {
  index: number;
  count: number;
  /** A random starting angle shared by the whole part, radians. */
  turn: number;
  dirX: number;
  dirY: number;
}

/** Fills `out` with where particle `slot.index` of `part` starts and how it leaves, by its pattern. */
function aim(out: Launch, part: RecipePart, slot: Slot, rng: Rng): void {
  out.lifeScale = 1;
  const evenAngle = slot.turn + (slot.index / slot.count) * Math.PI * 2;
  switch (part.pattern) {
    case 'ring':
      radial(out, evenAngle + spread(rng, RING_JITTER), part.radius, part.speed);
      return;
    case 'inward':
      radial(out, evenAngle, part.radius, -part.speed);
      return;
    case 'scatter':
      radial(out, rng.next() * Math.PI * 2, part.radius * rng.next(), part.speed * (0.4 + 0.6 * rng.next()));
      return;
    case 'streak':
      streakLaunch(out, part, slot, rng);
      return;
    case 'twinkle':
      out.dx = spread(rng, part.radius);
      out.dy = spread(rng, part.radius);
      out.vx = 0;
      out.vy = -part.speed;
      out.lifeScale = 0.5 + rng.next();
      return;
    case 'kickup': {
      const side = slot.index % 2 === 0 ? 1 : -1;
      out.dx = side * part.radius;
      out.dy = 0;
      out.vx = side * part.speed * (0.6 + 0.4 * rng.next());
      out.vy = -part.speed * 0.6 * rng.next();
      return;
    }
  }
}

/** A random offset in [-amount, amount). */
function spread(rng: Rng, amount: number): number {
  return (rng.next() * 2 - 1) * amount;
}

/** A streak particle: spaced along the line behind the heading, a little to either side, moving back along it. */
function streakLaunch(out: Launch, part: RecipePart, slot: Slot, rng: Rng): void {
  const behind = ((slot.index + rng.next()) / slot.count) * part.radius;
  const across = spread(rng, STREAK_WIDTH);
  const pace = part.speed * (0.7 + 0.3 * rng.next());
  out.dx = -slot.dirX * behind - slot.dirY * across;
  out.dy = -slot.dirY * behind + slot.dirX * across;
  out.vx = -slot.dirX * pace;
  out.vy = -slot.dirY * pace;
}

/** Starts a particle `radius` px from the point at `angle` and sends it along that line at `speed`. */
function radial(out: Launch, angle: number, radius: number, speed: number): void {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  out.dx = cos * radius;
  out.dy = sin * radius;
  out.vx = cos * speed;
  out.vy = sin * speed;
}

/** Moves a launch to where it would be a few ticks in and stops it there. */
function holdStill(out: Launch): void {
  out.dx += out.vx * STILL_REACH_TICKS;
  out.dy += out.vy * STILL_REACH_TICKS;
  out.vx = 0;
  out.vy = 0;
}

function applyLook(particle: Particle, part: RecipePart, motion: ParticleMotion, rng: Rng): void {
  particle.tint = part.look.tint;
  particle.alpha = part.look.alpha;
  particle.drag = motion.drag;
  particle.ay = motion.ay;
  particle.wobble = motion.wobble;
  particle.phase = rng.int(0, 31);
}
