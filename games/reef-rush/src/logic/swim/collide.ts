/**
 * Moving bodies through the tile grid without entering solid tiles, and
 * pushing apart racers that overlap.
 */
import type { EventSink } from '@arcade/core';
import type { GameEvent } from '../events.ts';
import { bodyTiles, isSolid } from '../level/query.ts';
import { type Body, type Level, RACER_IDS, type Racer, TILE } from '../types.ts';

/** Longest distance a body moves between collision checks. Shorter than the body, so no tile is skipped. */
const MAX_STEP = TILE / 2;

/**
 * Integrates a body's position by its velocity for one tick, resolving X then Y
 * against solid tiles and zeroing the blocked velocity component. Sub-steps fast
 * movement so a body never tunnels through a tile.
 *
 * @param dt Tick length in seconds.
 */
export function moveBody(body: Body, level: Level, broken: ReadonlySet<number>, dt: number): void {
  const distance = Math.hypot(body.vx, body.vy) * dt;
  const steps = Math.max(1, Math.ceil(distance / MAX_STEP));
  const stepDt = dt / steps;
  for (let step = 0; step < steps; step++) {
    body.x += body.vx * stepDt;
    resolveX(body, level, broken);
    body.y += body.vy * stepDt;
    resolveY(body, level, broken);
  }
}

/** Puts a body that moved into a solid column back flush against it. */
function resolveX(body: Body, level: Level, broken: ReadonlySet<number>): void {
  const tiles = bodyTiles(body);
  for (let ty = tiles.top; ty <= tiles.bottom; ty++) {
    if (body.vx > 0 && isSolid(level, broken, tiles.right, ty)) {
      body.x = tiles.right * TILE - body.w;
      body.vx = 0;
    } else if (body.vx < 0 && isSolid(level, broken, tiles.left, ty)) {
      body.x = (tiles.left + 1) * TILE;
      body.vx = 0;
    }
  }
}

/** Puts a body that moved into a solid row back flush against it. */
function resolveY(body: Body, level: Level, broken: ReadonlySet<number>): void {
  const tiles = bodyTiles(body);
  for (let tx = tiles.left; tx <= tiles.right; tx++) {
    if (body.vy > 0 && isSolid(level, broken, tx, tiles.bottom)) {
      body.y = tiles.bottom * TILE - body.h;
      body.vy = 0;
    } else if (body.vy < 0 && isSolid(level, broken, tx, tiles.top)) {
      body.y = (tiles.top + 1) * TILE;
      body.vy = 0;
    }
  }
}

/**
 * Pushes overlapping racers apart in one pass over pairs (i < j) in array order,
 * splitting the push by mass and exchanging half the relative velocity on that axis.
 * `contacts` holds "a|b" keys of touching pairs; `racer.bumped` fires only when a contact starts.
 */
export function separateRacers(racers: Racer[], contacts: Set<string>, events: EventSink<GameEvent>): void {
  for (let i = 0; i < racers.length; i++) {
    for (let j = i + 1; j < racers.length; j++) {
      const first = racers[i];
      const second = racers[j];
      if (first && second) separatePair(first, second, contacts, events);
    }
  }
}

/** Separates one pair and keeps its contact bookkeeping current. */
function separatePair(a: Racer, b: Racer, contacts: Set<string>, events: EventSink<GameEvent>): void {
  const key = contactKey(a, b);
  const penetration = {
    x: overlapLength(a.body.x, a.body.w, b.body.x, b.body.w),
    y: overlapLength(a.body.y, a.body.h, b.body.y, b.body.h),
  };
  if (penetration.x < 0 || penetration.y < 0) {
    contacts.delete(key);
    return;
  }
  // Last tick's push leaves a pair exactly touching. That keeps an existing contact alive, so
  // pressing into another racer doesn't re-announce a bump every other tick.
  if (penetration.x === 0 || penetration.y === 0) return;

  const axis = penetration.x <= penetration.y ? 'x' : 'y';
  pushApart(a, b, axis, penetration[axis]);
  shareClosingSpeed(a, b, axis);
  if (contacts.has(key)) return;
  contacts.add(key);
  const [first, second] = inRacerOrder(a, b);
  events.emit({ type: 'racer.bumped', a: first.id, b: second.id });
}

/** Length two spans share along one axis; zero when they touch, negative when there's a gap. */
function overlapLength(startA: number, sizeA: number, startB: number, sizeB: number): number {
  return Math.min(startA + sizeA, startB + sizeB) - Math.max(startA, startB);
}

type Axis = 'x' | 'y';

/** +1 when b's centre is further along the axis than a's, else -1 (ties push b forward). */
function directionFromAToB(a: Body, b: Body, axis: Axis): 1 | -1 {
  const size = axis === 'x' ? 'w' : 'h';
  return b[axis] + b[size] / 2 >= a[axis] + a[size] / 2 ? 1 : -1;
}

/** Moves the two bodies apart by `depth`, the lighter one further. */
function pushApart(a: Racer, b: Racer, axis: Axis, depth: number): void {
  const direction = directionFromAToB(a.body, b.body, axis);
  const totalMass = a.profile.mass + b.profile.mass;
  a.body[axis] -= direction * depth * (b.profile.mass / totalMass);
  b.body[axis] += direction * depth * (a.profile.mass / totalMass);
}

/**
 * While the pair is closing on the axis, takes away their closing speed: each loses a share
 * weighted by the other's mass fraction, so equal racers lose half each and the heavier one less.
 */
function shareClosingSpeed(a: Racer, b: Racer, axis: Axis): void {
  const velocity = axis === 'x' ? 'vx' : 'vy';
  const direction = directionFromAToB(a.body, b.body, axis);
  const closing = (a.body[velocity] - b.body[velocity]) * direction;
  if (closing <= 0) return;
  const totalMass = a.profile.mass + b.profile.mass;
  a.body[velocity] -= direction * closing * (b.profile.mass / totalMass);
  b.body[velocity] += direction * closing * (a.profile.mass / totalMass);
}

/** The pair ordered by RACER_IDS, so keys and events don't depend on array order. */
function inRacerOrder(a: Racer, b: Racer): [Racer, Racer] {
  return RACER_IDS.indexOf(a.id) <= RACER_IDS.indexOf(b.id) ? [a, b] : [b, a];
}

function contactKey(a: Racer, b: Racer): string {
  const [first, second] = inRacerOrder(a, b);
  return `${first.id}|${second.id}`;
}
