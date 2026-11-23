/**
 * Mimic decoys: look-alikes that swim on along the steer field at MIMIC.speed. A racer has at most
 * one; a new one replaces it.
 *
 * Each tick (`advanceDecoys`) a decoy ages and pops (`decoy.popped {by: null}`) when its ttl runs out
 * or it crosses the finish line; otherwise it steers and moves like a swimmer. Anything that hits it
 * pops it (`popDecoy`): a racer other than its owner touching it, a bubble of another owner (which
 * pops too), a squid (in `hazards/squids.ts`), or a flash (in `hazards/contacts.ts`). A bubbled decoy
 * (the bubbleDecoy combo) traps the racer whose attack hit it.
 */
import { steerDirection } from '../ai/steer.ts';
import { overlaps, squareAt } from '../hazards/boxes.ts';
import { applyHit } from '../hazards/hits.ts';
import { activeRacers, hitbox } from '../racers.ts';
import { moveBody } from '../swim/collide.ts';
import { type Body, type Decoy, RACER_SIZE, type Racer, type RacerId, TILE, type World } from '../types.ts';
import { BUBBLE, MIMIC } from './tuning.ts';

/** Tiles down the steer field a decoy aims at. */
const LOOKAHEAD_TILES = 3;

/**
 * Puts a decoy of `owner` in the water at its centre, swimming on at MIMIC.speed along the steer
 * field; the owner's previous decoy, if any, pops (`decoy.popped {by: null}`). Emits `decoy.spawned`.
 *
 * @param bubbled The bubbleDecoy combo: whatever hits the decoy is trapped.
 */
export function spawnDecoy(world: World, owner: Racer, bubbled: boolean): void {
  for (const old of world.decoys.filter((decoy) => decoy.owner === owner.id)) popDecoy(world, old, null);
  const { x, y, w, h } = owner.body;
  world.decoys.push({
    x: x + w / 2,
    y: y + h / 2,
    vx: 0,
    vy: 0,
    ttl: MIMIC.ttlTicks,
    owner: owner.id,
    ...(bubbled ? { bubbled } : {}),
  });
  world.events.emit({ type: 'decoy.spawned', owner: owner.id });
}

/**
 * Removes `decoy` and emits `decoy.popped {owner, by}`. When it is bubbled and `by` names a racer
 * still in play, that racer is trapped by a bubble hit (`applyHit`, cause 'bubble', owned by the decoy's owner).
 *
 * @param by The racer whose attack or touch popped it, or null when it simply ran out.
 */
export function popDecoy(world: World, decoy: Decoy, by: RacerId | null): void {
  world.decoys = world.decoys.filter((candidate) => candidate !== decoy);
  const victim = decoy.bubbled && by !== null ? activeRacers(world).find((racer) => racer.id === by) : undefined;
  const trapped = victim && applyHit(world, victim, 'bubble', decoy.owner, decoy) && victim.status.trapped > 0;
  world.events.emit({ type: 'decoy.popped', owner: decoy.owner, by, trapped: trapped && victim ? victim.id : null });
}

/**
 * The decoys slot of `stepWorld`: ages, steers and moves every decoy, then pops those that ran out of
 * time or crossed the finish, and those a racer or a bubble touches.
 *
 * @param dt Tick length in seconds.
 */
export function advanceDecoys(world: World, dt: number): void {
  for (const decoy of [...world.decoys]) {
    decoy.ttl -= 1;
    if (decoy.ttl <= 0) {
      popDecoy(world, decoy, null);
      continue;
    }
    swimOn(world, decoy, dt);
    if (decoy.x >= world.level.finishX * TILE) popDecoy(world, decoy, null);
    else touch(world, decoy);
  }
}

/** One tick of swimming straight down the steer field, stopped by walls like any body. */
function swimOn(world: World, decoy: Decoy, dt: number): void {
  const body: Body = {
    x: decoy.x - RACER_SIZE.width / 2,
    y: decoy.y - RACER_SIZE.height / 2,
    w: RACER_SIZE.width,
    h: RACER_SIZE.height,
    vx: 0,
    vy: 0,
  };
  const aim = steerDirection(world.fields.steer, world.fields, world.level, world.broken, body, LOOKAHEAD_TILES);
  body.vx = aim.x * MIMIC.speed;
  body.vy = aim.y * MIMIC.speed;
  moveBody(body, world.level, world.broken, dt);
  decoy.x = body.x + body.w / 2;
  decoy.y = body.y + body.h / 2;
  decoy.vx = body.vx;
  decoy.vy = body.vy;
}

/** Pops the decoy when another owner's racer or bubble overlaps it: the first racer, else the first bubble. */
function touch(world: World, decoy: Decoy): void {
  const box = squareAt(decoy, MIMIC.size);
  const racer = activeRacers(world).find(
    (candidate) => candidate.id !== decoy.owner && overlaps(box, hitbox(candidate)),
  );
  if (racer) {
    popDecoy(world, decoy, racer.id);
    return;
  }
  const bubble = world.bubbles.find(
    (candidate) => candidate.owner !== decoy.owner && overlaps(box, squareAt(candidate, BUBBLE.size)),
  );
  if (!bubble) return;
  world.bubbles = world.bubbles.filter((candidate) => candidate !== bubble);
  world.events.emit({ type: 'bubble.popped', by: null });
  popDecoy(world, decoy, bubble.owner);
}
