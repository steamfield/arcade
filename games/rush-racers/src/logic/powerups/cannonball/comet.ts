/**
 * Farside's Comet: fired along its owner's aim, it flies straight but every gravity well bends it, breaking ice and hitting the first racer it touches (cause 'comet').
 *
 * A comet in `world.shots` uses `x`, `y` (its centre), `vx`, `vy` and `ttl`; `target` stays null
 * and `phase` 0. Each tick it gains `COMET_TUNING.pullMul` times the wells' pull at its centre
 * (`pullAt`), moves, and then ends (`shot.ended` where it stopped) on the first of: a black hole's
 * horizon holds it, it touches ice (which breaks, every ice tile it touches) or other solid tiles,
 * it touches a racer other than its owner that the owner may attack (who is hit), or its time runs out.
 */
import { mayAttack } from '../../difficulty-level.ts';
import { overlaps, squareAt } from '../../hazards/boxes.ts';
import { applyHit } from '../../hazards/hits.ts';
import { bodyTiles, cellAt, isSolid } from '../../level/query.ts';
import { holeAt, pullAt } from '../../level/wells.ts';
import { mediumOf } from '../../media/index.ts';
import { length } from '../../num.ts';
import { breakCoral } from '../../race/coral.ts';
import { activeRacers, centreOf, hitbox } from '../../racers.ts';
import { type Box, type Racer, type Shot, TILE, type Vec, type World } from '../../types.ts';
import type { CannonballShotRules } from './index.ts';

/** The Comet's numbers. */
export const COMET_TUNING = {
  /** Launch speed along the aim, px/s. */
  speed: 230,
  /** A comet feels this many times the wells' raw pull (`pullAt`), so the bend shows; racers feel the medium's `wellPull` times it, lower on Easy. */
  pullMul: 2,
  /** Ticks before it burns out on its own: 3 s. */
  ttlTicks: 180,
  /** Half the side of the box it touches tiles and racers with, px. */
  radius: 4,
  /** A rival fires at a racer it may attack within this many tiles... */
  rivalRangeTiles: 10,
  /** ...and within 30 degrees of its aim: cos(30°), written out so no engine trig runs. */
  rivalAimConeCos: 0.8660254037844386,
  /** A rival fires at ice within this many steps ahead (`Medium.coralAhead`). */
  rivalIceSteps: 3,
} as const;

/** How the comet style fires, flies and is chosen by rivals. */
export const COMET: CannonballShotRules = {
  fire(world: World, racer: Racer, aim: Vec): void {
    const centre = centreOf(racer);
    world.shots.push({
      style: 'comet',
      owner: racer.id,
      x: centre.x,
      y: centre.y,
      vx: aim.x * COMET_TUNING.speed,
      vy: aim.y * COMET_TUNING.speed,
      ttl: COMET_TUNING.ttlTicks,
      target: null,
      phase: 0,
    });
    world.events.emit({ type: 'shot.launched', owner: racer.id, style: 'comet', target: null });
  },
  advance(world: World, shot: Shot, racing: readonly Racer[], dt: number): boolean {
    fly(world, shot, dt);
    if (stopsComet(world, shot, racing)) {
      world.events.emit({ type: 'shot.ended', owner: shot.owner, style: 'comet', x: shot.x, y: shot.y });
      return false;
    }
    return true;
  },
  breaksCoral: true,
  rivalWants(world: World, racer: Racer, aim: Vec): boolean {
    const ice = mediumOf(world).coralAhead(world, tileOf(centreOf(racer)), COMET_TUNING.rivalIceSteps);
    return ice || activeRacers(world).some((other) => isCometTarget(world, racer, aim, other));
  },
};

/** Bends the comet's velocity by the wells, moves it, and spends one tick of its time. */
function fly(world: World, shot: Shot, dt: number): void {
  const pull = pullAt(world.level, { x: shot.x, y: shot.y });
  shot.vx += pull.x * COMET_TUNING.pullMul * dt;
  shot.vy += pull.y * COMET_TUNING.pullMul * dt;
  shot.x += shot.vx * dt;
  shot.y += shot.vy * dt;
  shot.ttl -= 1;
}

/** True when the comet ends this tick, after doing what ends it (breaking ice, hitting a racer). */
function stopsComet(world: World, shot: Shot, racing: readonly Racer[]): boolean {
  if (holeAt(world.level, { x: shot.x, y: shot.y })) return true;
  if (strikesTiles(world, shot)) return true;
  if (strikesRacer(world, shot, racing)) return true;
  return shot.ttl <= 0;
}

/**
 * True when the comet's box touches a solid tile. Every unbroken ice tile it touches breaks, for its
 * owner, so a comet that meets a two-tile gate on the seam between them opens both.
 */
function strikesTiles(world: World, shot: Shot): boolean {
  const tiles = bodyTiles(cometBox(shot));
  let struck = false;
  for (let ty = tiles.top; ty <= tiles.bottom; ty++) {
    for (let tx = tiles.left; tx <= tiles.right; tx++) {
      if (!isSolid(world.level, world.broken, tx, ty)) continue;
      struck = true;
      if (cellAt(world.level, tx, ty) === 'coral') breakCoral(world, tx, ty, shot.owner);
    }
  }
  return struck;
}

/**
 * Hits the first racer in `racing` (other than the owner, in play, and one the owner may attack)
 * whose hitbox the comet touches, and says whether there was one. A rival's comet on Easy passes
 * through a human, who isn't a racer it may attack.
 */
function strikesRacer(world: World, shot: Shot, racing: readonly Racer[]): boolean {
  const box = cometBox(shot);
  const struck = racing.find(
    (racer) =>
      racer.id !== shot.owner &&
      racer.status.fallen === 0 &&
      mayAttack(world, shot.owner, racer.id) &&
      overlaps(box, hitbox(racer)),
  );
  if (!struck) return false;
  applyHit(world, struck, 'comet', shot.owner, { x: shot.x, y: shot.y });
  return true;
}

/** True when `other` is worth a comet from `racer`: in play, attackable, in range and inside the aim cone. */
function isCometTarget(world: World, racer: Racer, aim: Vec, other: Racer): boolean {
  if (other.id === racer.id || other.status.fallen > 0 || !mayAttack(world, racer.id, other.id)) return false;
  const from = centreOf(racer);
  const to = centreOf(other);
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = length(dx, dy);
  const aimLength = length(aim.x, aim.y);
  if (distance === 0 || aimLength === 0 || distance > COMET_TUNING.rivalRangeTiles * TILE) return false;
  return (dx * aim.x + dy * aim.y) / (distance * aimLength) >= COMET_TUNING.rivalAimConeCos;
}

function cometBox(shot: Shot): Box {
  return squareAt({ x: shot.x, y: shot.y }, COMET_TUNING.radius * 2);
}

function tileOf(point: Vec): Vec {
  return { x: Math.floor(point.x / TILE), y: Math.floor(point.y / TILE) };
}
