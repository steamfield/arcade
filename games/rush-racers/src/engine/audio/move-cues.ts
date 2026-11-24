/**
 * Which movement sound the local racer (the slot the screen follows) makes, and when. Two sources:
 * events (a runner's jump hops, a drifter's rebound clanks) and the world itself, read once a tick
 * (a runner on the ground at speed steps, a drifter whose velocity jumps is thrusting and burns).
 * Steps and burns are rate-limited by world tick so they stay a light pattern under the song. Other
 * racers' movement is never heard. Pure but for the timers and the last velocity it remembers.
 */
import { courseOf } from '../../logic/courses/index.ts';
import { bombPullOn } from '../../logic/powerups/twists/gravity-bomb.ts';
import type { Racer, RacerId, World } from '../../logic/types.ts';
import type { RuntimeEvent } from '../runtime.ts';
import { skinFor } from '../worlds/index.ts';
import type { MoveSfxKey } from './move-sfx.ts';

/** A footstep sounds no sooner than this many ticks after the last one. */
export const STEP_GAP_TICKS = 14;
/** A thruster burn sounds no sooner than this many ticks after the last one. */
export const BURN_GAP_TICKS = 10;
/** Slowest ground speed, px/s, that counts as running rather than standing or creeping. */
export const RUN_STEP_MIN_SPEED = 30;
/**
 * The velocity change per tick, px/s, that reads as thrust: drift's thrust adds about 4.1 a tick
 * (more with a speed boost, less in ink), while drag takes about 0.4 and a gravity well's pull, away
 * from a planet's surface, under 3. A gravity bomb's pull reaches the band, so a racer inside one
 * is never read as thrusting (`burnCue`).
 */
export const THRUST_DV_PER_TICK = { min: 3, max: 8 } as const;
/**
 * Ticks running the velocity must change at thrust's rate before a burn sounds. A bump, a dash or a
 * rebound changes it far more, but for a tick, and so never counts.
 */
export const THRUST_TICKS = 2;

/** Decides the local racer's movement sounds. */
export interface MoveCues {
  /** The sound `event` makes, or null when it makes none or is about another racer. */
  forEvent(event: RuntimeEvent): MoveSfxKey | null;
  /** The sound the local racer's motion in `world` makes this tick, or null. Reading the same tick twice sounds once. */
  forWorld(world: World): MoveSfxKey | null;
}

/** The local racer's velocity on a tick, kept to tell a thrust from a coast. */
interface VelocitySample {
  tick: number;
  vx: number;
  vy: number;
}

/**
 * Racer `id` in `world`.
 *
 * @throws {Error} When the world has no such racer, which means it was assembled without `createWorld`.
 */
function localIn(world: World, id: RacerId): Racer {
  const racer = world.racers.find((candidate) => candidate.id === id);
  if (!racer) throw new Error(`World has no local racer '${id}' to hear; build worlds with createWorld`);
  return racer;
}

/**
 * Builds the decider; each one keeps its own timers and forgets them when a new world (race) starts.
 *
 * @param localRacer The slot the screen follows, read per event and per tick.
 */
export function createMoveCues(localRacer: () => RacerId): MoveCues {
  let heardWorld: World | null = null;
  let lastTick = Number.NEGATIVE_INFINITY;
  let lastStep = Number.NEGATIVE_INFINITY;
  let lastBurn = Number.NEGATIVE_INFINITY;
  let lastVelocity: VelocitySample | null = null;
  /** Ticks running the local racer's velocity has changed at thrust's rate. */
  let thrustTicks = 0;

  const startHearing = (world: World) => {
    heardWorld = world;
    lastTick = lastStep = lastBurn = Number.NEGATIVE_INFINITY;
    lastVelocity = null;
    thrustTicks = 0;
  };

  const stepCue = (racer: Racer, tick: number): MoveSfxKey | null => {
    // A runner standing on a floor has a vertical speed of exactly 0; in the air gravity moves it every tick.
    const running = racer.body.vy === 0 && Math.abs(racer.body.vx) >= RUN_STEP_MIN_SPEED;
    if (!running || tick - lastStep < STEP_GAP_TICKS) return null;
    lastStep = tick;
    return 'step';
  };

  const burnCue = (world: World, racer: Racer, tick: number): MoveSfxKey | null => {
    const before = lastVelocity;
    lastVelocity = { tick, vx: racer.body.vx, vy: racer.body.vy };
    if (!before) return null;
    const bomb = bombPullOn(world, racer);
    if (bomb.x !== 0 || bomb.y !== 0) {
      thrustTicks = 0;
      return null;
    }
    const change = Math.hypot(racer.body.vx - before.vx, racer.body.vy - before.vy) / (tick - before.tick);
    thrustTicks = change >= THRUST_DV_PER_TICK.min && change <= THRUST_DV_PER_TICK.max ? thrustTicks + 1 : 0;
    if (thrustTicks < THRUST_TICKS || tick - lastBurn < BURN_GAP_TICKS) return null;
    lastBurn = tick;
    return 'burn';
  };

  return {
    forEvent(event) {
      if (event.type === 'racer.jumped' && event.id === localRacer()) return 'hop';
      if (event.type === 'racer.rebounded' && event.id === localRacer()) return 'clank';
      return null;
    },
    forWorld(world) {
      if (world !== heardWorld) startHearing(world);
      if (world.race.phase !== 'racing' || world.tick === lastTick) return null;
      lastTick = world.tick;
      const racer = localIn(world, localRacer());
      // A racer out of play is put back by hand, so its velocity jump on return is no thrust.
      if (racer.status.fallen > 0) {
        lastVelocity = null;
        thrustTicks = 0;
        return null;
      }
      const sound = skinFor(courseOf(world)).moveSound;
      if (sound === 'steps') return stepCue(racer, world.tick);
      if (sound === 'burns') return burnCue(world, racer, world.tick);
      return null;
    },
  };
}
