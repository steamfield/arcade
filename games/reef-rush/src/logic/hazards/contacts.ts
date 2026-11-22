/**
 * Everything that hurts on touch, resolved against the racers in play: urchin
 * tiles, jellies, bubbles, inflated puffers, and Glow Lantern flashes. Every hit
 * goes through `applyHit`, so once one lands the racer's invulnerability makes
 * the rest of that tick's contacts pass over it (a bubble included: it flies on).
 */

import { BUBBLE, FLASH } from '../powerups/tuning.ts';
import { activeRacers, centreOf, hitbox } from '../racers.ts';
import { type Box, type Racer, TILE, type Vec, type World } from '../types.ts';
import { applyHit } from './hits.ts';
import { jellyCentre } from './jellies.ts';
import { JELLY } from './tuning.ts';

/**
 * The contacts slot of `stepWorld`, for each racer in `racers` order:
 * - an urchin tile its hitbox overlaps hits it (cause 'urchin', from the tile centre) unless inflated;
 * - a jelly that isn't stunned whose JELLY.size box overlaps its hitbox hits it (cause 'jelly');
 * - a bubble owned by another racer whose BUBBLE.size box overlaps its hitbox, unless it's
 *   invulnerable, pops (`bubble.popped {by: id}`, removed) and hits it (cause 'bubble', by the owner);
 * - an inflated other racer whose hitbox overlaps its hitbox hits it (cause 'puffer', by that racer).
 */
export function resolveContacts(world: World, racers: readonly Racer[]): void {
  for (const racer of racers) {
    const box = hitbox(racer);
    touchUrchins(world, racer, box);
    touchJellies(world, racer, box);
    touchBubbles(world, racer, box);
    touchPuffers(world, racer, box, racers);
  }
}

/**
 * A Glow Lantern flash from `racer`: emits `flash.fired {id}`, then hits every other racer in play
 * whose centre is within FLASH.rangeTiles tiles of the racer's centre (cause 'flash'), and sets
 * `stunned = FLASH.stunTicks` on every jelly whose centre is that close. Called by `burst.ts`.
 */
export function flashAround(world: World, racer: Racer): void {
  world.events.emit({ type: 'flash.fired', id: racer.id });
  const from = centreOf(racer);
  const inRange = (point: Vec) => Math.hypot(point.x - from.x, point.y - from.y) <= FLASH.rangeTiles * TILE;
  for (const other of activeRacers(world)) {
    if (other.id !== racer.id && inRange(centreOf(other))) applyHit(world, other, 'flash', racer.id, from);
  }
  for (const jelly of world.jellies) {
    if (inRange(jellyCentre(jelly))) jelly.stunned = FLASH.stunTicks;
  }
}

function touchUrchins(world: World, racer: Racer, box: Box): void {
  if (racer.status.inflated > 0) return;
  for (const tile of world.level.urchins) {
    const tileBox = { x: tile.x * TILE, y: tile.y * TILE, w: TILE, h: TILE };
    if (overlaps(box, tileBox)) applyHit(world, racer, 'urchin', null, centreOfBox(tileBox));
  }
}

function touchJellies(world: World, racer: Racer, box: Box): void {
  for (const jelly of world.jellies) {
    if (jelly.stunned > 0) continue;
    const centre = jellyCentre(jelly);
    if (overlaps(box, squareAt(centre, JELLY.size))) applyHit(world, racer, 'jelly', null, centre);
  }
}

function touchBubbles(world: World, racer: Racer, box: Box): void {
  if (racer.status.invulnerable > 0) return;
  const bubble = world.bubbles.find(
    (candidate) => candidate.owner !== racer.id && overlaps(box, squareAt(candidate, BUBBLE.size)),
  );
  if (!bubble) return;
  world.bubbles = world.bubbles.filter((candidate) => candidate !== bubble);
  world.events.emit({ type: 'bubble.popped', by: racer.id });
  applyHit(world, racer, 'bubble', bubble.owner, { x: bubble.x, y: bubble.y });
}

function touchPuffers(world: World, racer: Racer, box: Box, racers: readonly Racer[]): void {
  for (const puffer of racers) {
    if (puffer.id === racer.id || puffer.status.inflated === 0) continue;
    if (overlaps(box, hitbox(puffer))) applyHit(world, racer, 'puffer', puffer.id, centreOf(puffer));
  }
}

/** True when two boxes overlap by any positive area; touching edges don't count. */
function overlaps(a: Box, b: Box): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function squareAt(centre: Vec, size: number): Box {
  return { x: centre.x - size / 2, y: centre.y - size / 2, w: size, h: size };
}

function centreOfBox(box: Box): Vec {
  return { x: box.x + box.w / 2, y: box.y + box.h / 2 };
}
