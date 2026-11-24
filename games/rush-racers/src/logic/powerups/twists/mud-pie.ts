/**
 * Thornwood's Mud Pie: lobbed forward in an arc, it splats where it lands on the ground and leaves a
 * mud patch that slows runners crossing it for a few seconds.
 *
 * What a mud pie twist's fields mean: while it flies (`phase` FLYING), `x`, `y` are the centre of its
 * small box and `vx`, `vy` its velocity, and `ttl` holds the drying time it will have once it splats
 * (it is not counted down in the air; under gravity a pie always lands or falls out of the level).
 * Once it has splatted (`phase` SPLAT), `x` is the patch's centre, `y` the top of the surface it lies
 * on, `vx` and `vy` are 0, and `ttl` counts down the ticks until it dries. The run medium asks
 * `feetInMud` for each grounded runner, so a patch slows a runner the way a mud cell does.
 */
import { mayAttack } from '../../difficulty-level.ts';
import { squareAt } from '../../hazards/boxes.ts';
import { blocksBody, isLedge } from '../../level/query.ts';
import { moveBody, moveRulesFor } from '../../race/move.ts';
import { centreOf } from '../../racers.ts';
import { type Body, type Racer, TILE, type Twist, type Vec, type World } from '../../types.ts';
import type { TwistRules } from './index.ts';

/**
 * A mud pie's numbers: its box side (px), its throw (px/s forward along facing, on top of the
 * thrower's own speed, and up), gravity (px/s², run's own) and fastest fall (px/s, run's `maxFall`),
 * the splat's width (px, 3 tiles) and drying time (ticks, 5 s), and the band of tiles ahead in which
 * a rival looks for someone to hit.
 *
 * The band is what a throw can reach: on flat ground a pie is in the air about 0.55 s, so thrown at
 * full pace (100 px/s) it splats about 9.3 tiles on, its far edge 10.8. A full-pace target 6 tiles
 * ahead has run 3.5 more by then, leaving it over a tile of mud to cross, long enough to drop to mud
 * speed; one 7 tiles ahead would only clip the edge. Anyone nearer than 6 runs through more of it.
 */
export const MUD_PIE_TUNING = {
  size: TILE / 2,
  throwForward: 160,
  throwUp: 220,
  gravity: 800,
  maxFall: 320,
  splatWidth: 3 * TILE,
  dryTicks: 300,
  wantMinTiles: 3,
  wantMaxTiles: 6,
} as const;

/** `Twist.phase` for a mud pie still in the air. */
export const FLYING = 0;
/** `Twist.phase` for a mud pie that has splatted into a patch. */
export const SPLAT = 1;

/** How far, in px, a racer's feet may be from a tile's top and still count as standing on it. */
const GROUND_TOLERANCE = 0.5;

/** How the Mud Pie is thrown, plays out and is chosen by rivals. */
export const MUD_PIE: TwistRules = {
  fire: throwPie,
  advance: advancePie,
  rivalWants: pieHasUse,
};

/**
 * Lobs a pie from `racer`'s centre forward along its facing and up, carrying the thrower's own
 * speed, and emits `twist.launched`. The aim plays no part: it always goes the way the thrower faces.
 */
function throwPie(world: World, racer: Racer, _aim: Vec): void {
  const centre = centreOf(racer);
  world.twists.push({
    style: 'mudPie',
    owner: racer.id,
    x: centre.x,
    y: centre.y,
    vx: racer.body.vx + racer.facing * MUD_PIE_TUNING.throwForward,
    vy: -MUD_PIE_TUNING.throwUp,
    ttl: MUD_PIE_TUNING.dryTicks,
    phase: FLYING,
  });
  world.events.emit({ type: 'twist.launched', owner: racer.id, style: 'mudPie' });
}

/**
 * One tick of a mud pie: a flying one falls and moves, a splat dries.
 *
 * @returns false once it has ended (`twist.ended` emitted).
 */
function advancePie(world: World, twist: Twist, _racing: readonly Racer[], dt: number): boolean {
  return twist.phase === FLYING ? flyPie(world, twist, dt) : drySplat(world, twist);
}

/**
 * Moves a flying pie one tick under gravity through the tiles as a body does (`moveBody` under the
 * world's move rules), so walls turn it down, and ledges, rock and crates catch it from above. It
 * splats on the first surface it comes down onto (`twist.landed`) and ends once it falls below the level.
 *
 * @returns false once it has fallen out (`twist.ended` emitted).
 */
function flyPie(world: World, twist: Twist, dt: number): boolean {
  twist.vy = Math.min(MUD_PIE_TUNING.maxFall, twist.vy + MUD_PIE_TUNING.gravity * dt);
  const body: Body = { ...squareAt(twist, MUD_PIE_TUNING.size), vx: twist.vx, vy: twist.vy };
  const contacts = moveBody(body, world.level, world.broken, dt, moveRulesFor(world));
  twist.x = body.x + body.w / 2;
  twist.y = body.y + body.h / 2;
  twist.vx = body.vx;
  twist.vy = body.vy;
  if (contacts.floor) return splat(world, twist, body.y + body.h);
  if (body.y >= world.level.height * TILE) return end(world, twist);
  return true;
}

/** Turns a pie that came down onto a surface whose top is at `surfaceY` into a patch there; emits `twist.landed`. */
function splat(world: World, twist: Twist, surfaceY: number): true {
  twist.phase = SPLAT;
  twist.y = surfaceY;
  twist.vx = 0;
  twist.vy = 0;
  world.events.emit({ type: 'twist.landed', owner: twist.owner, style: 'mudPie', x: twist.x, y: twist.y });
  return true;
}

/**
 * One tick off a patch's drying time.
 *
 * @returns false once it has dried (`twist.ended` emitted).
 */
function drySplat(world: World, twist: Twist): boolean {
  twist.ttl -= 1;
  return twist.ttl > 0 || end(world, twist);
}

/** Emits `twist.ended` where the pie is; returns false, for `advance` to drop it. */
function end(world: World, twist: Twist): false {
  world.events.emit({ type: 'twist.ended', owner: twist.owner, style: 'mudPie', x: twist.x, y: twist.y });
  return false;
}

/**
 * True when `racer`'s feet are in a mud patch it is slowed by: on the patch's surface with its centre
 * over the patch's width, in a patch someone else threw and whose thrower may attack it (an Easy
 * rival's mud never slows a human). Whether the racer stands rather than jumps is the caller's to
 * know: the run medium asks only for a grounded runner.
 */
export function feetInMud(world: World, racer: Racer): boolean {
  return world.twists.some(
    (twist) =>
      twist.style === 'mudPie' &&
      twist.phase === SPLAT &&
      twist.owner !== racer.id &&
      onPatch(racer, twist) &&
      mayAttack(world, twist.owner, racer.id),
  );
}

/** True when the racer's feet are on the patch's surface and its centre is within the patch's width. */
function onPatch(racer: Racer, patch: Twist): boolean {
  const surfaceRow = Math.floor(patch.y / TILE);
  return feetRow(racer) === surfaceRow - 1 && Math.abs(centreOf(racer).x - patch.x) <= MUD_PIE_TUNING.splatWidth / 2;
}

/**
 * Whether a rival holding the Mud Pie should throw it now: some unfinished racer it may attack, not
 * fallen out of the level, stands on the ground between `wantMinTiles` and `wantMaxTiles` tiles
 * ahead along its facing. A stunned racer is still worth slowing once it gets up.
 */
function pieHasUse(world: World, racer: Racer, _aim: Vec): boolean {
  const from = centreOf(racer).x;
  const { wantMinTiles, wantMaxTiles } = MUD_PIE_TUNING;
  return world.racers.some((other) => {
    if (other === racer || other.finished || other.status.fallen > 0) return false;
    if (!mayAttack(world, racer.id, other.id)) return false;
    const ahead = (centreOf(other).x - from) * racer.facing;
    return ahead >= wantMinTiles * TILE && ahead <= wantMaxTiles * TILE && standsOnGround(world, other);
  });
}

/**
 * True when the racer's feet rest on the top of the tile under its centre and that tile holds a
 * runner up: one that stops a body under the world's move rules (rock, stone, a crate) or a ledge.
 * Read from the tiles, since a runner's own grounded flag is the run medium's to keep.
 */
function standsOnGround(world: World, racer: Racer): boolean {
  const bottom = racer.body.y + racer.body.h;
  const below = feetRow(racer) + 1;
  if (Math.abs(bottom - below * TILE) > GROUND_TOLERANCE) return false;
  const col = Math.floor(centreOf(racer).x / TILE);
  const { level, broken } = world;
  return blocksBody(level, broken, moveRulesFor(world), col, below) || isLedge(level, col, below);
}

/** The tile row a racer's feet are in. */
function feetRow(racer: Racer): number {
  return Math.floor((racer.body.y + racer.body.h - 1) / TILE);
}
