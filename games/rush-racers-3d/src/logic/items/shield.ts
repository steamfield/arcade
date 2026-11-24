/** Sap Shield's fired glob, its flight, and traps on contact. */
import { ITEMS, RUN } from '../tuning.ts';
import type { Racer, Shot, World } from '../types.ts';
import { canBeHit, stopRacer } from './hits.ts';

type Sap = Extract<Shot, { kind: 'sap' }>;

/** Throws a sap glob straight forward from the racer's centre. */
export function fireShield(world: World, { id, s, d, y }: Racer): void {
  world.shots.push({ kind: 'sap', owner: id, s, d, y: y + RUN.radius, vs: ITEMS.sapSpeed, travelled: 0 });
}

/** Advances the glob and traps the first eligible racer it touches. Returns whether it stays in flight. */
export function stepSap(world: World, shot: Sap, dt: number): boolean {
  const travel = Math.min(shot.vs * dt, ITEMS.sapRange - shot.travelled);
  const endS = shot.s + travel;
  let target: Racer | undefined;
  let firstContact = Infinity;
  for (const racer of world.racers) {
    if (racer.id === shot.owner || !canBeHit(racer)) continue;
    const dd = shot.d - racer.d;
    const dy = shot.y - (racer.y + RUN.radius);
    const reachSq = RUN.radius * RUN.radius - dd * dd - dy * dy;
    if (reachSq < 0) continue;
    const reach = Math.sqrt(reachSq);
    const contact = Math.max(shot.s, racer.s - reach);
    if (racer.s + reach < shot.s || contact > endS || contact >= firstContact) continue;
    firstContact = contact;
    target = racer;
  }

  if (target) {
    target.trappedTicks = ITEMS.sapTrapTicks;
    stopRacer(target);
    world.events.emit({ type: 'racer.trapped', id: target.id, by: shot.owner });
    return false;
  }
  shot.s = endS;
  shot.travelled += travel;
  return shot.travelled < ITEMS.sapRange;
}
