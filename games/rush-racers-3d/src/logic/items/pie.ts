/** Mud Pie flight, ground impacts, and splat coverage. */
import { groundY, pitAt } from '../course.ts';
import { ITEMS, RUN } from '../tuning.ts';
import type { Racer, Shot, Splat, World } from '../types.ts';

type Pie = Extract<Shot, { kind: 'pie' }>;

/** Lobs a pie forward and up, adding the thrower's velocity. */
export function firePie(world: World, { id, s, d, y, vs, vd, vy }: Racer): void {
  world.shots.push({
    kind: 'pie',
    owner: id,
    s,
    d,
    y: y + RUN.radius,
    vs: vs + ITEMS.pieThrowSpeed,
    vd,
    vy: vy + ITEMS.pieThrowUp,
  });
}

/** Advances a pie and leaves a splat on solid ground. Returns whether it stays in flight. */
export function stepPie(world: World, shot: Pie, dt: number): boolean {
  const s = shot.s + shot.vs * dt;
  const d = shot.d + shot.vd * dt;
  shot.vy -= RUN.gravity * dt;
  const y = shot.y + shot.vy * dt;
  const endHeight = y - groundY(world.course, s);
  if (endHeight > 0) {
    shot.s = s;
    shot.d = d;
    shot.y = y;
    return true;
  }

  // Interpolate back to the rim crossing so the impact uses the patch of ground the pie touched.
  const startHeight = shot.y - groundY(world.course, shot.s);
  const fraction = startHeight > 0 ? startHeight / (startHeight - endHeight) : 0;
  const impactS = shot.s + (s - shot.s) * fraction;
  const impactD = shot.d + (d - shot.d) * fraction;
  if (!pitAt(world.course, impactS, impactD)) {
    world.splats.push({
      owner: shot.owner,
      s0: impactS - ITEMS.splatLength / 2,
      s1: impactS + ITEMS.splatLength / 2,
      d0: impactD - ITEMS.splatWidth / 2,
      d1: impactD + ITEMS.splatWidth / 2,
      ticksLeft: ITEMS.splatTicks,
    });
    world.events.emit({ type: 'pie.splatted', owner: shot.owner, s: impactS, d: impactD });
  }
  return false;
}

/** Whether another racer's splat covers this racer's track position. */
export function hasSplatMud(splats: readonly Splat[], { id, s, d }: Racer): boolean {
  return splats.some((patch) => patch.owner !== id && patch.s0 <= s && s < patch.s1 && patch.d0 <= d && d < patch.d1);
}
