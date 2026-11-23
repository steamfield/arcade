/**
 * Clams: power-up boxes on the course. A racer with an empty slot opens a ready clam (by touching
 * it, or in a solid-crate medium only by hitting it from below), gets a place-weighted roll from the
 * `pickups` stream with the charges that kind comes with (`chargesFor`), a rival more rolls while it
 * has room (`CLAM.rivalRolls`), and the clam stays shut for a while.
 * A roll walks POWER_UP_KINDS in order over the cumulative weights of the kinds the
 * racer doesn't hold, so one draw maps to one kind.
 */
import type { Rng } from '@arcade/core';
import { clamBias } from '../difficulty-level.ts';
import { overlapsTile, tileIndex } from '../level/query.ts';
import { mediumOf } from '../media/index.ts';
import { chargesFor } from '../powerups/charges.ts';
import { gainItem, heldItems, inventoryFull } from '../powerups/inventory.ts';
import { CLAM } from '../powerups/tuning.ts';
import { hitbox } from '../racers.ts';
import {
  type Clam,
  type MoveContacts,
  POWER_UP_KINDS,
  type PowerUpKind,
  RACER_IDS,
  type Racer,
  type World,
} from '../types.ts';

const LAST_PLACE = RACER_IDS.length;

/**
 * How long a crate opened from below stays shut. Movement opens it before the pickups slot
 * (`openClams`) counts every shut clam down on the same tick, so it gets that tick back.
 */
const SHUT_TICKS_FROM_BELOW = CLAM.closedTicks + 1;

/**
 * The pickups slot for clams. Each call, a clam with `closedFor > 0` counts it down by one instead
 * of opening. In a medium whose clams aren't solid, a ready clam opens (`openClamFor`) for the first
 * racer in `racers` order whose hitbox overlaps its tile and who has an empty slot; a clam that only
 * full racers touch stays ready. So a racer parked on a clam opens it on one call and again
 * CLAM.closedTicks + 1 calls later. Solid crates never open on touch (see `openClamsFromBelow`).
 *
 * @throws {Error} When the world names a medium that is neither shipped nor registered.
 */
export function openClams(world: World, racers: readonly Racer[]): void {
  const opensOnTouch = !mediumOf(world).effects.solidClams;
  world.clams.forEach((clam, index) => {
    if (clam.closedFor > 0) {
      clam.closedFor -= 1;
      return;
    }
    if (!opensOnTouch) return;
    const opener = racers.find(
      (racer) => !inventoryFull(racer) && overlapsTile(hitbox(racer), clam.tile.x, clam.tile.y),
    );
    if (opener) openClamFor(world, clam, index, opener, CLAM.closedTicks);
  });
}

/**
 * Opens each ready clam whose tile is in `contacts.ceilingTiles` for `racer` (`openClamFor`), as a
 * head bump from below does in a solid-crate medium (`MediumEffects.solidClams`). A racer with a
 * full inventory leaves the crate shut. Does nothing in a medium whose clams aren't solid. A crate
 * opened here is ready again on the same tick as a clam opened by touch on this tick.
 *
 * @throws {Error} When the world names a medium that is neither shipped nor registered.
 */
export function openClamsFromBelow(world: World, racer: Racer, contacts: MoveContacts): void {
  if (contacts.ceilingTiles.length === 0 || !mediumOf(world).effects.solidClams) return;
  world.clams.forEach((clam, index) => {
    if (clam.closedFor > 0 || inventoryFull(racer)) return;
    if (contacts.ceilingTiles.includes(tileIndex(world.level, clam.tile.x, clam.tile.y))) {
      openClamFor(world, clam, index, racer, SHUT_TICKS_FROM_BELOW);
    }
  });
}

/**
 * Opens a ready clam for `opener`: `rollClam(world.rngs.pickups, opener.place, held kinds, bias)`,
 * `clam.opened {id, index, kind}`, then `gainItem` with `chargesFor(kind, opener.place)`, and
 * `closedFor = shutTicks`. A rival opener rolls again while it has an empty slot, up to
 * CLAM.rivalRolls rolls in all; a later roll draws from the same stream and shows only as its
 * `powerup.gained`, so `clam.opened` names the first.
 *
 * @param shutTicks What `closedFor` starts at: how many `openClams` countdowns it waits before it is ready.
 */
function openClamFor(world: World, clam: Clam, index: number, opener: Racer, shutTicks: number): void {
  const first = rollFor(world, opener);
  world.events.emit({ type: 'clam.opened', id: opener.id, index, kind: first });
  gainItem(world, opener, first, chargesFor(first, opener.place));
  const rolls = opener.id === 'player' ? 1 : CLAM.rivalRolls;
  for (let roll = 1; roll < rolls && !inventoryFull(opener); roll++) {
    const kind = rollFor(world, opener);
    gainItem(world, opener, kind, chargesFor(kind, opener.place));
  }
  clam.closedFor = shutTicks;
}

/** One clam roll for `racer` from the pickups stream, leaving out the kinds it holds. */
function rollFor(world: World, racer: Racer): PowerUpKind {
  const held = heldItems(racer).map((item) => item.kind);
  return rollClam(world.rngs.pickups, racer.place, held, clamBias(world, racer));
}

/**
 * Roll weights for a racer in `place` (1..4): CLAM.firstWeights at 1st, CLAM.lastWeights at 4th,
 * linear in between, except Undertow, which is 0 ahead of CLAM.undertowMinPlace.
 *
 * @throws {RangeError} When `place` is not an integer from 1 to 4.
 */
export function clamWeights(place: number): Record<PowerUpKind, number> {
  if (!Number.isInteger(place) || place < 1 || place > LAST_PLACE) {
    throw new RangeError(`Clam roll for place ${place}: places run 1 to ${LAST_PLACE}`);
  }
  const t = (place - 1) / (LAST_PLACE - 1);
  const weights = POWER_UP_KINDS.map((kind): [PowerUpKind, number] => {
    if (kind === 'undertow' && place < CLAM.undertowMinPlace) return [kind, 0];
    const first = CLAM.firstWeights[kind];
    return [kind, first + (CLAM.lastWeights[kind] - first) * t];
  });
  return Object.fromEntries(weights) as Record<PowerUpKind, number>;
}

/**
 * Picks a power-up the racer doesn't hold, weighted by `clamWeights(place)` times `bias` per kind
 * (the difficulty level's `playerClamWeightMul` for the player; none by default), with one draw from `rng`.
 * Kinds with weight 0 never roll. A racer holds at most 4 kinds and at least seven have weight, so there is always something to roll.
 *
 * @throws {Error} When `held` already covers every rollable kind, which a valid inventory never does.
 */
export function rollClam(
  rng: Rng,
  place: number,
  held: readonly PowerUpKind[],
  bias: Partial<Record<PowerUpKind, number>> = {},
): PowerUpKind {
  const weights = clamWeights(place);
  for (const kind of POWER_UP_KINDS) weights[kind] *= bias[kind] ?? 1;
  const candidates = POWER_UP_KINDS.filter((kind) => !held.includes(kind));
  // A weight-0 kind never rolls, so the float-rounding fallback below must land on a kind that can.
  const last = candidates.filter((kind) => weights[kind] > 0).at(-1);
  if (last === undefined) {
    throw new Error(`Clam roll for place ${place} with no rollable kind left (held: ${held.join(', ')})`);
  }
  const total = candidates.reduce((sum, kind) => sum + weights[kind], 0);
  let left = rng.next() * total;
  for (const kind of candidates) {
    left -= weights[kind];
    if (left < 0) return kind;
  }
  // Float rounding can leave a sliver past the last weight; it belongs to the last kind.
  return last;
}
