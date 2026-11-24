/**
 * Thornwood's Boulder: fired, it rolls along the ground ahead of its owner under gravity, drops into
 * pits, breaks cracked stone and hits racers it runs into (cause 'boulder').
 *
 * What a boulder shot's fields mean: `x`, `y` are the centre of its one-tile box; `vx` is its rolling
 * speed along the thrower's facing, which never changes until it ends; `vy` its fall; `ttl` the ticks
 * it has left; `target` is always null and `phase` always 0. It moves through the tiles as a racer's
 * body does (`moveBody` under the world's move rules), so ledges hold it from above, crates stop it
 * and it falls out of the bottom of a pit.
 */
import { mayAttack } from '../../difficulty-level.ts';
import { overlaps, squareAt } from '../../hazards/boxes.ts';
import { applyHit } from '../../hazards/hits.ts';
import { blocksBody, bodyTiles, cellAt, isSolid, ledgeHolds } from '../../level/query.ts';
import { breakCoral } from '../../race/coral.ts';
import { moveBody, moveRulesFor } from '../../race/move.ts';
import { centreOf, hitbox } from '../../racers.ts';
import { isDowned, isInvulnerable } from '../../status.ts';
import {
  type Body,
  type Box,
  type Racer,
  type Shot,
  type ShotEndReason,
  TILE,
  type Vec,
  type World,
} from '../../types.ts';
import type { CannonballShotRules } from './index.ts';

/**
 * A boulder's numbers: its box side (px), rolling speed (px/s), gravity (px/s², run's own) and
 * fastest fall (px/s, run's `maxFall`), how long it rolls before it ends on its own (ticks, 4 s), and
 * how many tiles ahead a rival looks for something to roll it at.
 */
export const BOULDER_TUNING = {
  size: TILE,
  rollSpeed: 180,
  gravity: 800,
  maxFall: 320,
  ttlTicks: 240,
  wantTiles: 8,
} as const;

/** How the boulder style fires, flies and is chosen by rivals. */
export const BOULDER: CannonballShotRules = {
  fire: throwBoulder,
  advance: rollBoulder,
  breaksCoral: true,
  rivalWants: boulderHasUse,
};

/**
 * Drops a boulder just ahead of `racer` along its facing, its bottom level with the racer's feet,
 * rolling away at `rollSpeed`, and emits `shot.launched`. The aim plays no part: it always rolls
 * the way the thrower faces.
 */
function throwBoulder(world: World, racer: Racer, _aim: Vec): void {
  const { size, rollSpeed, ttlTicks } = BOULDER_TUNING;
  const { body, facing } = racer;
  world.shots.push({
    style: 'boulder',
    owner: racer.id,
    x: body.x + body.w / 2 + facing * (body.w / 2 + size / 2),
    y: body.y + body.h - size / 2,
    vx: facing * rollSpeed,
    vy: 0,
    ttl: ttlTicks,
    target: null,
    phase: 0,
  });
  world.events.emit({ type: 'shot.launched', owner: racer.id, style: 'boulder', target: null });
}

/**
 * One tick of a rolling boulder. In order: one tick off its ttl; one that starts inside something
 * solid (thrown against a wall) smashes into it; otherwise gravity pulls it and it moves. Then it
 * ends on the first racer but its owner it lands a hit on (`applyHit`, so an invulnerable racer, or
 * a human an Easy rival may not attack, lets it roll on through), on a wall it rolls into along the
 * ground (breaking any cracked stone there), once it falls below the level, or when its ttl runs out.
 *
 * @returns false once it has ended (`shot.ended` emitted where it stopped).
 */
function rollBoulder(world: World, shot: Shot, racing: readonly Racer[], dt: number): boolean {
  shot.ttl -= 1;
  const body = bodyOf(shot);
  if (insideSolid(world, body)) return smash(world, shot);
  shot.vy = Math.min(BOULDER_TUNING.maxFall, shot.vy + BOULDER_TUNING.gravity * dt);
  body.vy = shot.vy;
  const contacts = moveBody(body, world.level, world.broken, dt, moveRulesFor(world));
  shot.x = body.x + body.w / 2;
  shot.y = body.y + body.h / 2;
  shot.vy = body.vy;
  if (hitsRacer(world, shot, racing)) return end(world, shot, 'hit');
  // In the air it slides down a wall it meets, so one thrown into a pit falls out of the level.
  if (contacts.floor && (contacts.wallLeft || contacts.wallRight)) return smash(world, shot);
  if (body.y >= world.level.height * TILE || shot.ttl <= 0) return end(world, shot, 'expired');
  return true;
}

/** The boulder's box as a moving body, at its centre with its velocity. */
function bodyOf(shot: Shot): Body {
  const box = squareAt(shot, BOULDER_TUNING.size);
  return { ...box, vx: shot.vx, vy: shot.vy };
}

/** True when `box` overlaps a tile that stops a body under the world's move rules. */
function insideSolid(world: World, box: Box): boolean {
  const rules = moveRulesFor(world);
  const { left, right, top, bottom } = bodyTiles(box);
  for (let ty = top; ty <= bottom; ty++) {
    for (let tx = left; tx <= right; tx++) if (blocksBody(world.level, world.broken, rules, tx, ty)) return true;
  }
  return false;
}

/**
 * True when the boulder landed a hit on a racer but its owner whose hitbox it overlaps. The first
 * such racer in `racing` takes it; one the hit doesn't land on (`applyHit` returns null) is passed through.
 */
function hitsRacer(world: World, shot: Shot, racing: readonly Racer[]): boolean {
  const box = squareAt(shot, BOULDER_TUNING.size);
  return racing.some(
    (racer) =>
      racer.id !== shot.owner &&
      overlaps(box, hitbox(racer)) &&
      applyHit(world, racer, 'boulder', shot.owner, { x: shot.x, y: shot.y }) !== null,
  );
}

/** Ends the boulder against whatever stopped it, breaking every cracked stone tile it touches a pixel further along its roll. */
function smash(world: World, shot: Shot): boolean {
  const ahead = squareAt({ x: shot.x + Math.sign(shot.vx), y: shot.y }, BOULDER_TUNING.size);
  const { left, right, top, bottom } = bodyTiles(ahead);
  for (let ty = top; ty <= bottom; ty++) {
    for (let tx = left; tx <= right; tx++) breakCoral(world, tx, ty, shot.owner);
  }
  return end(world, shot, 'landed');
}

/** Emits `shot.ended` where the boulder stopped, and why; returns false, for `advance` to drop it. */
function end(world: World, shot: Shot, reason: ShotEndReason): false {
  world.events.emit({ type: 'shot.ended', owner: shot.owner, style: 'boulder', reason, x: shot.x, y: shot.y });
  return false;
}

/**
 * Whether a rival holding the Boulder should roll it now: along its facing, within `wantTiles` tiles
 * of open ground on its own row, lies cracked stone, or a racer it may attack that a hit would land
 * on (not downed, invulnerable or finished), standing on that row.
 */
function boulderHasUse(world: World, racer: Racer, _aim: Vec): boolean {
  const path = rollPath(world, racer);
  if (path.coralAhead) return true;
  return world.racers.some((other) => {
    if (other === racer || other.finished || isDowned(other) || isInvulnerable(other)) return false;
    if (!mayAttack(world, racer.id, other.id) || feetRow(other) !== path.row) return false;
    return path.cols.includes(Math.floor(centreOf(other).x / TILE));
  });
}

/** The columns ahead a boulder thrown now would roll through on the racer's row, and whether cracked stone ends them. */
interface RollPath {
  row: number;
  cols: number[];
  coralAhead: boolean;
}

/**
 * Walks the racer's row along its facing for up to `wantTiles` tiles from the tile under its centre:
 * each open tile with ground under it (rock, stone, a mushroom or a ledge) joins the path, cracked
 * stone ends it with `coralAhead`, and anything else solid, or a drop, ends it.
 */
function rollPath(world: World, racer: Racer): RollPath {
  const { level, broken } = world;
  const rules = moveRulesFor(world);
  const row = feetRow(racer);
  const start = Math.floor(centreOf(racer).x / TILE);
  const cols: number[] = [];
  for (let step = 1; step <= BOULDER_TUNING.wantTiles; step++) {
    const col = start + racer.facing * step;
    // Coral that is still solid hasn't broken yet.
    if (isSolid(level, broken, col, row)) return { row, cols, coralAhead: cellAt(level, col, row) === 'coral' };
    if (!isSolid(level, broken, col, row + 1) && !ledgeHolds(level, rules, col, row + 1)) break;
    cols.push(col);
  }
  return { row, cols, coralAhead: false };
}

/** The tile row a racer's feet are in. */
function feetRow(racer: Racer): number {
  return Math.floor((racer.body.y + racer.body.h - 1) / TILE);
}
