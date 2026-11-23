/**
 * Moving bodies through the tile grid without entering the tiles that block them, reporting what
 * they ran into (`MoveContacts`), and the rules a world's medium moves bodies by (`moveRulesFor`):
 * extra solid tiles, an open floor below the last row, and ledges that hold only from above.
 */
import { blocksBody, bodyTiles, isLedge, overlapsTile, tileIndex } from '../level/query.ts';
import { mediumOf } from '../media/index.ts';
import { type Body, type Level, type MoveContacts, type MoveRules, TILE, type World } from '../types.ts';

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
  rules: MoveRules,
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
 * the bottom edge is open (`pitBelow`), and every clam's tile, ready or shut, when the medium's
 * clams are solid crates. A medium with neither gets NO_MOVE_RULES.
 *
 * @throws {Error} When the world names a medium that is neither shipped nor registered.
 */
export function moveRulesFor(world: World): MoveRules {
  const { pitBelow, solidClams } = mediumOf(world).effects;
  if (!pitBelow && !solidClams) return NO_MOVE_RULES;
  const solidTiles = new Set<number>();
  if (solidClams) {
    for (const clam of world.clams) solidTiles.add(tileIndex(world.level, clam.tile.x, clam.tile.y));
  }
  return { pitBelow, solidTiles };
}

/** Length two spans share along one axis; zero when they touch, negative when there's a gap. */
function overlapLength(startA: number, sizeA: number, startB: number, sizeB: number): number {
  return Math.min(startA + sizeA, startB + sizeB) - Math.max(startA, startB);
}
