/**
 * Who a Homing Squid chases: the nearest unfinished racer ahead of its owner within lock range, or
 * a Mimic decoy when one is at least as near. A pure read of the world; `squids.ts` acts on it.
 */
import { mayAttack } from '../difficulty-level.ts';
import { selectedItem } from '../powerups/inventory.ts';
import { MIMIC, SQUID } from '../powerups/tuning.ts';
import { progressAt } from '../race/flowfield.ts';
import { activeRacers, centreOf } from '../racers.ts';
import { type Decoy, type Racer, type RacerId, type SquidTarget, TILE, type Vec, type World } from '../types.ts';

/** Squared distance between two points in world px. */
const squaredDistance = (a: Vec, b: Vec): number => {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
};

/**
 * How far a squid reaches to lock `racer`, in px: SQUID.lockTiles, times MIMIC.lockRangeMul for a
 * racer with a Mimic selected.
 */
export function lockRangePx(racer: Racer): number {
  return SQUID.lockTiles * TILE * (selectedItem(racer)?.kind === 'mimic' ? MIMIC.lockRangeMul : 1);
}

/** The decoy `owner` swam out, or undefined when none is in the water. */
export function decoyOf(world: World, owner: RacerId): Decoy | undefined {
  return world.decoys.find((decoy) => decoy.owner === owner);
}

/**
 * The target a squid of `owner` at `from` should chase, or null when nothing is in reach.
 *
 * Racers qualify when unfinished, not the owner or `exclude`, ahead of the owner by progress (lower
 * is ahead), within their `lockRangePx` of `from` and not the player when `mayAttack` refuses the owner; the nearest wins, an equal distance going to
 * the earlier racer in RACER_IDS order. A decoy of another owner qualifies the same way (within
 * SQUID.lockTiles) and is preferred when it is as near as the best racer, or nearer, or there is no racer.
 *
 * @param exclude A racer the squid must not lock again, because its kick made the squid miss.
 */
export function pickSquidTarget(world: World, owner: RacerId, from: Vec, exclude: RacerId | null): SquidTarget | null {
  const ownerRacer = world.racers.find((racer) => racer.id === owner);
  if (!ownerRacer) return null;
  let bestRacer: Racer | null = null;
  let bestSquared = Number.POSITIVE_INFINITY;
  for (const racer of activeRacers(world)) {
    if (racer.id === owner || racer.id === exclude || !(racer.progress < ownerRacer.progress)) continue;
    if (!mayAttack(world, owner, racer.id)) continue;
    const squared = squaredDistance(centreOf(racer), from);
    // Strictly nearer only, so equal distances go to the earlier racer in RACER_IDS order.
    const lockRange = lockRangePx(racer);
    if (squared > lockRange * lockRange || squared >= bestSquared) continue;
    bestRacer = racer;
    bestSquared = squared;
  }
  const decoy = nearestDecoyAhead(world, ownerRacer, from);
  if (decoy && decoy.squared <= bestSquared) return { kind: 'decoy', owner: decoy.owner };
  return bestRacer ? { kind: 'racer', id: bestRacer.id } : null;
}

/** The nearest other-owned decoy ahead of `owner` and within SQUID.lockTiles of `from`, with its squared distance. */
function nearestDecoyAhead(world: World, owner: Racer, from: Vec): { owner: RacerId; squared: number } | null {
  const reachPx = SQUID.lockTiles * TILE;
  const reach = reachPx * reachPx;
  let best: { owner: RacerId; squared: number } | null = null;
  for (const decoy of world.decoys) {
    if (decoy.owner === owner.id) continue;
    const squared = squaredDistance(decoy, from);
    const ahead = progressAt(world.progress, { x: decoy.x, y: decoy.y, w: 0, h: 0 }) < owner.progress;
    if (!ahead || squared > reach || (best && squared >= best.squared)) continue;
    best = { owner: decoy.owner, squared };
  }
  return best;
}
