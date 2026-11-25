/** Crate pickups, shared reopen timing, and place-weighted item rolls. */
import { createRng, type Rng } from '@arcade/core';
import { groundY } from '../course.ts';
import { placeOf } from '../standings.ts';
import { CRATE, ITEMS, RUN } from '../tuning.ts';
import type { Racer, World } from '../types.ts';
import { giveItem } from './inventory.ts';
import type { ItemKind } from './types.ts';

const ODDS = [
  { boots: 18, shield: 32, burr: 12 },
  { boots: 24, shield: 27, burr: 19 },
  { boots: 32, shield: 22, burr: 25 },
  { boots: 42, shield: 13, burr: 32 },
] as const;

type Point = Pick<Racer, 's' | 'd' | 'y'>;
const TOUCH_SQ = CRATE.touchRadius * CRATE.touchRadius;

/** The item a crate gives a racer in `place` (1-based), weighted so leaders get defence and trailers get speed. */
export function rollItem(rng: Rng, place: number): ItemKind {
  const { boots, shield, burr } = ODDS[place - 1] ?? ODDS[0];
  const roll = rng.int(1, 100);
  if (roll <= boots) return 'boots';
  if (roll <= boots + shield) return 'shield';
  if (roll <= boots + shield + burr) return 'burr';
  return 'pie';
}

/** Ages crate timers and checks each racer's path for a new contact. A null pose has no path. */
export function stepCrates(world: World, from: readonly (Point | null)[]): void {
  let crateIndex = 0;
  for (const feature of world.course.features) {
    if (feature.kind !== 'crate') continue;
    const index = crateIndex++;
    const crate = world.crates[index];
    if (!crate) continue;
    if (crate.shutTicks > 0) crate.shutTicks--;

    // Racer poses use feet height. Lower the contact point to compare both centres.
    const centre = { s: feature.s, d: feature.d, y: groundY(world.course, feature.s) + CRATE.height - RUN.radius };
    for (const [slotIndex, racer] of world.racers.entries()) {
      const start = racer.state === 'racing' ? from[slotIndex] : null;
      const prior = crate.touching.indexOf(racer.id);
      const stillTouching = !!start && distanceSq(centre, racer) <= TOUCH_SQ;
      const triedThisPass = !!start && prior >= 0 && distanceSq(centre, start) <= TOUCH_SQ;
      if (prior >= 0 && (!stillTouching || !triedThisPass)) crate.touching.splice(prior, 1);
      if (!start || crate.shutTicks > 0 || triedThisPass) continue;
      const slot = racer.items.slots.indexOf(null);
      if (slot < 0) continue;
      if (!stillTouching && !touchesBetween(start, racer, centre)) continue;

      const rng = createRng(world.rngState);
      const kind = rollItem(rng, placeOf(world, racer.id));
      world.rngState = rng.state();
      if (stillTouching) crate.touching.push(racer.id);
      if (racer.items.slots.some((item) => item?.kind === kind)) continue;

      crate.shutTicks = ITEMS.crateShutTicks;
      giveItem(world, racer, slot, kind);
      world.events.emit({ type: 'crate.opened', id: racer.id, crate: index, kind, slot });
    }
  }
}

function distanceSq(a: Point, b: Point): number {
  const ds = a.s - b.s;
  const dd = a.d - b.d;
  const dy = a.y - b.y;
  return ds * ds + dd * dd + dy * dy;
}

function touchesBetween(from: Point, to: Point, centre: Point): boolean {
  const ds = to.s - from.s;
  const dd = to.d - from.d;
  const dy = to.y - from.y;
  const lengthSq = ds * ds + dd * dd + dy * dy;
  if (lengthSq === 0) return false;
  const along = ((centre.s - from.s) * ds + (centre.d - from.d) * dd + (centre.y - from.y) * dy) / lengthSq;
  const t = Math.max(0, Math.min(1, along));
  return distanceSq(centre, { s: from.s + ds * t, d: from.d + dd * t, y: from.y + dy * t }) <= TOUCH_SQ;
}
