/**
 * The trail shed behind every moving racer, one particle per stretch of distance covered, so a
 * racer at full speed leaves a dense trail, a cruising one a sparse trail and a drifting one none.
 * Distance is counted from logic velocity once per tick, so the trail repeats in captures. How a
 * trail particle looks comes from the theme; a theme without a trail gets no counters at all.
 */
import { TICK_HZ } from '@arcade/core';
import type { World } from '../../logic/types.ts';
import type { Theme, TrailLook } from '../themes/types.ts';
import type { Bursts } from './bursts.ts';

/** Per-racer distance counters that turn movement into trail particles. */
export interface Trail {
  /** Counts one tick of movement for every racer still racing and sheds the particles it earned. */
  step(world: World, bursts: Bursts): void;
}

/** Below this speed (px/s) a racer is drifting and leaves no trail. */
const MIN_SPEED = 30;
/** Pixels covered per trail particle; reduced motion sheds half as many. */
const SPACING_PX = 14;
const REDUCED_SPACING_PX = 28;
/** The trail leaves from behind the racer's centre, px. */
const TAIL_OFFSET = 7;

/**
 * The trail for a race drawn in `theme`, with counters for up to `racerCount` racers in
 * `world.racers` order; null when the theme has no trail.
 */
export function trailFor(theme: Pick<Theme, 'trail'>, racerCount: number, reducedMotion: boolean): Trail | null {
  return theme.trail ? createTrail(racerCount, theme.trail, reducedMotion) : null;
}

/** Creates counters for up to `racerCount` racers, in `world.racers` order, shedding particles drawn as `look`. */
export function createTrail(racerCount: number, look: TrailLook, reducedMotion: boolean): Trail {
  const travelled = new Float64Array(racerCount);
  const spacing = reducedMotion ? REDUCED_SPACING_PX : SPACING_PX;

  return {
    step(world, bursts) {
      for (let index = 0; index < world.racers.length && index < racerCount; index++) {
        const racer = world.racers[index];
        if (!racer || racer.finished || racer.status.trapped > 0) continue;
        const { body } = racer;
        const speed = Math.hypot(body.vx, body.vy);
        if (speed < MIN_SPEED) continue;
        const covered = (travelled[index] ?? 0) + speed / TICK_HZ;
        if (covered < spacing) {
          travelled[index] = covered;
          continue;
        }
        travelled[index] = covered - spacing;
        bursts.trailBubble(body.x + body.w / 2 - racer.facing * TAIL_OFFSET, body.y + body.h / 2, look);
      }
    },
  };
}
