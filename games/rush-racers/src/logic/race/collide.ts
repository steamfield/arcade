/**
 * Moving bodies through the tile grid without entering solid tiles, reporting what they ran into,
 * the rules a world's medium moves bodies by, and pushing apart racers that overlap.
 */
import type { EventSink } from '@arcade/core';
import type { GameEvent } from '../events.ts';
import { blocksBody, bodyTiles, isLedge, overlapsTile, tileIndex } from '../level/query.ts';
import { mediumOf } from '../media/index.ts';
import { isDowned } from '../status.ts';
import {
  type Body,
  type Level,
  type MoveContacts,
  type MoveRules,
  RACER_IDS,
  type Racer,
  TILE,
  type World,
} from '../types.ts';

/**
 * Longest distance a body moves between collision checks. It is under one tile, so a body's
 * leading edge can't skip past a solid tile within one sub-step.
 */
const MAX_STEP = TILE / 2;

/** Most sub-steps in one call, which bounds the work an absurdly long `dt` can cause. */
const MAX_SUBSTEPS = 64;

/**
 * How far, in px, a body's bottom may sit below a ledge's top and still count as above it. Landing
 * puts a body flush by arithmetic that can leave it a rounding error low.
 */
const LEDGE_TOLERANCE = 1e-6;

/** The rules of a medium with no platformer seams: a solid bottom edge, no extra solid tiles. */
export const NO_MOVE_RULES: MoveRules = { pitBelow: false, solidTiles: new Set() };

/** One `moveBody` call's grid and rules, and what the body has run into so far this tick. */
interface TileMove {
  level: Level;
  broken: ReadonlySet<number>;
  rules: MoveRules;
  /** The body's bottom edge before this tick's move; a ledge holds it only from at or above its top. */
  bottomAtStart: number;
  contacts: MoveContacts;
}

/**
 * Integrates a body's position by its velocity for one tick, resolving X then Y against tiles that
 * block it (`blocksBody` under `rules`, and ledges from above) and zeroing the blocked velocity
 * component. Sub-steps fast movement so a body never tunnels through a tile. A body that starts
 * inside a blocking tile (a bump can push one into a wall) is first moved out along its shallower
 * overlap; a ledge never pushes a body out.
 *
 * @param dt Tick length in seconds. A tick needing more than MAX_SUBSTEPS sub-steps moves the
 *   body at most MAX_SUBSTEPS * MAX_STEP pixels, less than its velocity asks for.
 * @returns What the body ran into this tick; all clear for a body that doesn't move.
 */
export function moveBody(
  body: Body,
  level: Level,
  broken: ReadonlySet<number>,
  dt: number,
  rules: MoveRules = NO_MOVE_RULES,
): MoveContacts {
  const contacts = noContacts();
  pushOutOfSolids(body, level, broken, rules);
  const speed = Math.sqrt(body.vx * body.vx + body.vy * body.vy);
  if (speed === 0) return contacts;

  const move: TileMove = { level, broken, rules, bottomAtStart: body.y + body.h, contacts };
  const steps = Math.min(MAX_SUBSTEPS, Math.max(1, Math.ceil((speed * dt) / MAX_STEP)));
  const stepDt = Math.min(dt / steps, MAX_STEP / speed);
  for (let step = 0; step < steps; step++) {
    body.x += body.vx * stepDt;
    resolveX(body, move);
    body.y += body.vy * stepDt;
    resolveY(body, move);
  }
  return contacts;
}

function noContacts(): MoveContacts {
  return { floor: false, ceiling: false, wallLeft: false, wallRight: false, ceilingTiles: [] };
}

/**
 * Moves a body out of each blocking tile it overlaps, along the axis it overlaps that tile least.
 * The X and Y resolvers assume the body starts the tick outside every blocking tile; without this, a
 * body pushed into a wall would snap to a row boundary on its next vertical move and stick.
 */
function pushOutOfSolids(body: Body, level: Level, broken: ReadonlySet<number>, rules: MoveRules): void {
  const tiles = bodyTiles(body);
  for (let ty = tiles.top; ty <= tiles.bottom; ty++) {
    for (let tx = tiles.left; tx <= tiles.right; tx++) {
      if (blocksBody(level, broken, rules, tx, ty) && overlapsTile(body, tx, ty)) pushOutOfTile(body, tx, ty);
    }
  }
}

/** Moves a body out of one tile toward whichever side its centre is on. */
function pushOutOfTile(body: Body, tx: number, ty: number): void {
  const overlapX = overlapLength(body.x, body.w, tx * TILE, TILE);
  const overlapY = overlapLength(body.y, body.h, ty * TILE, TILE);
  if (overlapX <= overlapY) {
    body.x += body.x + body.w / 2 < (tx + 0.5) * TILE ? -overlapX : overlapX;
  } else {
    body.y += body.y + body.h / 2 < (ty + 0.5) * TILE ? -overlapY : overlapY;
  }
}

/** Puts a body that moved into a blocking column back flush against it, noting the wall. */
function resolveX(body: Body, move: TileMove): void {
  const { level, broken, rules, contacts } = move;
  const tiles = bodyTiles(body);
  for (let ty = tiles.top; ty <= tiles.bottom; ty++) {
    if (body.vx > 0 && blocksBody(level, broken, rules, tiles.right, ty)) {
      body.x = tiles.right * TILE - body.w;
      body.vx = 0;
      contacts.wallRight = true;
    } else if (body.vx < 0 && blocksBody(level, broken, rules, tiles.left, ty)) {
      body.x = (tiles.left + 1) * TILE;
      body.vx = 0;
      contacts.wallLeft = true;
    }
  }
}

/** Puts a body that moved into a blocking row back flush against it: a landing or a head bump. */
function resolveY(body: Body, move: TileMove): void {
  if (body.vy > 0) landOnFloor(body, move);
  else if (body.vy < 0) bumpCeiling(body, move);
}

/** Stops a falling body on the row under it when any tile it spans there holds it. */
function landOnFloor(body: Body, move: TileMove): void {
  const tiles = bodyTiles(body);
  for (let tx = tiles.left; tx <= tiles.right; tx++) {
    if (!holdsFromAbove(move, tx, tiles.bottom)) continue;
    body.y = tiles.bottom * TILE - body.h;
    body.vy = 0;
    move.contacts.floor = true;
    return;
  }
}

/** Whether the tile stops a body coming down onto it: anything blocking, or a ledge it was above. */
function holdsFromAbove(move: TileMove, tx: number, ty: number): boolean {
  if (blocksBody(move.level, move.broken, move.rules, tx, ty)) return true;
  return isLedge(move.level, tx, ty) && move.bottomAtStart <= ty * TILE + LEDGE_TOLERANCE;
}

/** Stops a rising body under the row over it, listing every blocking tile its head spans there. */
function bumpCeiling(body: Body, move: TileMove): void {
  const { level, broken, rules, contacts } = move;
  const tiles = bodyTiles(body);
  const hit: number[] = [];
  for (let tx = tiles.left; tx <= tiles.right; tx++) {
    if (blocksBody(level, broken, rules, tx, tiles.top)) hit.push(tileIndex(level, tx, tiles.top));
  }
  if (hit.length === 0) return;
  body.y = (tiles.top + 1) * TILE;
  body.vy = 0;
  contacts.ceiling = true;
  contacts.ceilingTiles = [...contacts.ceilingTiles, ...hit];
}

/**
 * What `moveBody` treats as solid beyond the level's tiles for `world`'s medium right now: whether
 * the bottom edge is open (`pitBelow`), and the tiles of ready clams when the medium's clams are
 * solid crates. A medium with neither gets NO_MOVE_RULES.
 *
 * @throws {Error} When the world names a medium that is neither shipped nor registered.
 */
export function moveRulesFor(world: World): MoveRules {
  const { pitBelow, solidClams } = mediumOf(world).effects;
  if (!pitBelow && !solidClams) return NO_MOVE_RULES;
  const solidTiles = new Set<number>();
  if (solidClams) {
    for (const clam of world.clams) {
      if (clam.closedFor === 0) solidTiles.add(tileIndex(world.level, clam.tile.x, clam.tile.y));
    }
  }
  return { pitBelow, solidTiles };
}

/**
 * Pushes overlapping racers apart in one pass over pairs (i < j) in array order,
 * splitting the push by mass and exchanging half the relative velocity on that axis.
 * `contacts` holds "a|b" keys of touching pairs; `racer.bumped` fires only when a contact starts.
 * A pair with a downed racer (`isDowned`: stunned, trapped or latched) passes through: no push, no
 * bump, and its key is cleared, so touching again after recovery is a new bump. While such a pair
 * overlaps, `contacts` holds its ghost key ("~a|b"), and the pair keeps passing through after the
 * racer recovers until the two separate, which drops the ghost key.
 *
 * @param massOf The mass each racer bumps with; its profile's unless held power-ups change it.
 * @param onBump Called with the pair in RACER_IDS order when a contact starts, after `racer.bumped`
 *   and after the pair has been pushed apart, but with the velocities they bumped with: the closing
 *   speed they share is worked out before the call and added after it.
 * @param pushAxis 'shallowest' pushes each pair apart along the axis they overlap least; 'x' always
 *   pushes sideways, so a racer dropping onto another keeps falling (a medium's 'horizontal' collision).
 */
export function separateRacers(
  racers: Racer[],
  contacts: Set<string>,
  events: EventSink<GameEvent>,
  massOf: MassOf = (racer) => racer.profile.mass,
  onBump: OnBump = () => {},
  pushAxis: PushAxis = 'shallowest',
): void {
  for (let i = 0; i < racers.length; i++) {
    for (let j = i + 1; j < racers.length; j++) {
      const first = racers[i];
      const second = racers[j];
      if (first && second) separatePair(first, second, { contacts, events, massOf, onBump, pushAxis });
    }
  }
}

/**
 * Whether `a` and `b` pass through each other this tick rather than touch: either is downed
 * (`isDowned`), or `contacts` still holds the pair's ghost key because they overlapped while one was
 * down and haven't come apart since. Anything resolved between racers (bumps, puffer hits) skips such a pair.
 */
export function passesThrough(contacts: ReadonlySet<string>, a: Racer, b: Racer): boolean {
  return isDowned(a) || isDowned(b) || contacts.has(ghostKey(contactKey(a, b)));
}

type MassOf = (racer: Racer) => number;
type OnBump = (a: Racer, b: Racer) => void;

/** Which way overlapping racers are pushed apart: along their shallower overlap, or only sideways. */
export type PushAxis = 'shallowest' | 'x';

/** What separating a pair reads and reports to, shared by every pair in one pass. */
interface Separation {
  contacts: Set<string>;
  events: EventSink<GameEvent>;
  massOf: MassOf;
  onBump: OnBump;
  pushAxis: PushAxis;
}

/** Separates one pair and keeps its contact bookkeeping current. */
function separatePair(a: Racer, b: Racer, { contacts, events, massOf, onBump, pushAxis }: Separation): void {
  const key = contactKey(a, b);
  const ghost = ghostKey(key);
  const penetration = {
    x: overlapLength(a.body.x, a.body.w, b.body.x, b.body.w),
    y: overlapLength(a.body.y, a.body.h, b.body.y, b.body.h),
  };
  const overlapping = penetration.x > 0 && penetration.y > 0;
  // A pair that overlapped while one was down keeps passing through after it recovers, until the two
  // come apart; shoving them out at once would jump a racer (maybe into rock) and bump for nothing.
  if (passesThrough(contacts, a, b)) {
    contacts.delete(key);
    if (overlapping) contacts.add(ghost);
    else contacts.delete(ghost);
    return;
  }
  if (penetration.x < 0 || penetration.y < 0) {
    contacts.delete(key);
    return;
  }
  // Last tick's push leaves a pair exactly touching. That keeps an existing contact alive, so
  // pressing into another racer doesn't re-announce a bump every other tick.
  if (penetration.x === 0 || penetration.y === 0) return;

  const axis = pushAxis === 'x' || penetration.x <= penetration.y ? 'x' : 'y';
  const masses = { a: massOf(a), b: massOf(b) };
  pushApart(a, b, masses, axis, penetration[axis]);
  const shared = closingSpeedShares(a, b, masses, axis);
  if (!contacts.has(key)) {
    contacts.add(key);
    const [first, second] = inRacerOrder(a, b);
    events.emit({ type: 'racer.bumped', a: first.id, b: second.id });
    onBump(first, second);
  }
  const velocity = axis === 'x' ? 'vx' : 'vy';
  a.body[velocity] += shared.a;
  b.body[velocity] += shared.b;
}

/** Length two spans share along one axis; zero when they touch, negative when there's a gap. */
function overlapLength(startA: number, sizeA: number, startB: number, sizeB: number): number {
  return Math.min(startA + sizeA, startB + sizeB) - Math.max(startA, startB);
}

type Axis = 'x' | 'y';

/** The bump masses of a pair being separated. */
interface Masses {
  a: number;
  b: number;
}

/** +1 when b's centre is further along the axis than a's, else -1 (ties push b forward). */
function directionFromAToB(a: Body, b: Body, axis: Axis): 1 | -1 {
  const size = axis === 'x' ? 'w' : 'h';
  return b[axis] + b[size] / 2 >= a[axis] + a[size] / 2 ? 1 : -1;
}

/** Moves the two bodies apart by `depth`, the lighter one further. */
function pushApart(a: Racer, b: Racer, masses: Masses, axis: Axis, depth: number): void {
  const direction = directionFromAToB(a.body, b.body, axis);
  const totalMass = masses.a + masses.b;
  a.body[axis] -= direction * depth * (masses.b / totalMass);
  b.body[axis] += direction * depth * (masses.a / totalMass);
}

/**
 * The velocity changes along the axis that take away the pair's closing speed while it closes:
 * each loses a share weighted by the other's mass fraction, so equal racers lose half each and the
 * heavier one less. Zero for both when they aren't closing.
 */
function closingSpeedShares(a: Racer, b: Racer, masses: Masses, axis: Axis): { a: number; b: number } {
  const velocity = axis === 'x' ? 'vx' : 'vy';
  const direction = directionFromAToB(a.body, b.body, axis);
  const closing = (a.body[velocity] - b.body[velocity]) * direction;
  if (closing <= 0) return { a: 0, b: 0 };
  const totalMass = masses.a + masses.b;
  return { a: -direction * closing * (masses.b / totalMass), b: direction * closing * (masses.a / totalMass) };
}

/** The pair ordered by RACER_IDS, so keys and events don't depend on array order. */
function inRacerOrder(a: Racer, b: Racer): [Racer, Racer] {
  return RACER_IDS.indexOf(a.id) <= RACER_IDS.indexOf(b.id) ? [a, b] : [b, a];
}

function contactKey(a: Racer, b: Racer): string {
  const [first, second] = inRacerOrder(a, b);
  return `${first.id}|${second.id}`;
}

/** The key marking a pair that overlapped while one of them was down and hasn't come apart since. */
function ghostKey(key: string): string {
  return `~${key}`;
}
