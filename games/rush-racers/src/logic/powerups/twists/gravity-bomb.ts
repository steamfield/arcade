/**
 * Farside's Gas Bomb as a gravity bomb: dropped behind its owner, it pulls the racers chasing it in toward itself for a few seconds.
 *
 * A gravity bomb in `world.twists` sits still at `x`, `y` (its centre) with `vx`, `vy` 0 and `phase`
 * 0; `ttl` counts its ticks down and it ends (`twist.ended` where it sat) when they run out, or at
 * once if it was dropped outside the level. While it is in play, `bombPullOn` says how it pulls a
 * racer; drift's environment adds that to the wells' pull, so the bomb does nothing in other media.
 */
import { mayAttack } from '../../difficulty-level.ts';
import { length } from '../../num.ts';
import { activeRacers, centreOf } from '../../racers.ts';
import { type Racer, TILE, type Twist, type Vec, type World } from '../../types.ts';
import type { TwistRules } from './index.ts';

/** The gravity bomb's numbers. */
export const GRAVITY_BOMB_TUNING = {
  /** Dropped this many tiles behind its owner's centre, against its facing. */
  dropBehindTiles: 1,
  /** Ticks it pulls for before it ends: 4 s. */
  ttlTicks: 240,
  /** How far its pull reaches, in tiles. */
  reachTiles: 5,
  /** Its pull at its centre, px/s², before drift's `wellPull`: 1.5x Slingshot Alley's planets (160). */
  pull: 240,
  /** A rival drops one on a racer it may attack within this many tiles behind it (Ink Sac's rule). */
  rivalBehindTiles: 4,
} as const;

/** How the gravity bomb is dropped, counts down and is chosen by rivals. */
export const GRAVITY_BOMB: TwistRules = {
  fire(world: World, racer: Racer): void {
    const centre = centreOf(racer);
    world.twists.push({
      style: 'gravityBomb',
      owner: racer.id,
      x: centre.x - racer.facing * GRAVITY_BOMB_TUNING.dropBehindTiles * TILE,
      y: centre.y,
      vx: 0,
      vy: 0,
      ttl: GRAVITY_BOMB_TUNING.ttlTicks,
      phase: 0,
    });
    world.events.emit({ type: 'twist.launched', owner: racer.id, style: 'gravityBomb' });
  },
  advance(world: World, twist: Twist): boolean {
    twist.ttl -= 1;
    if (twist.ttl > 0 && insideLevel(world, twist)) return true;
    world.events.emit({ type: 'twist.ended', owner: twist.owner, style: twist.style, x: twist.x, y: twist.y });
    return false;
  },
  rivalWants(world: World, racer: Racer): boolean {
    return activeRacers(world).some((other) => isChaserInRange(world, racer, other));
  },
};

/**
 * The pull of every gravity bomb in play on `racer`, px/s², toward each bomb's centre: `pull * (1 - d / reach)`
 * at distance `d` between their centres inside the reach, nothing at the centre or from the reach out. A bomb
 * never pulls its owner, nor a racer its owner may not attack (`mayAttack`). Unscaled: the medium applies its
 * own multiplier, as it does to the wells' `pullAt`.
 */
export function bombPullOn(world: World, racer: Racer): Vec {
  const total = { x: 0, y: 0 };
  const point = centreOf(racer);
  const reach = GRAVITY_BOMB_TUNING.reachTiles * TILE;
  for (const bomb of world.twists) {
    if (bomb.style !== 'gravityBomb' || !pulls(world, bomb, racer)) continue;
    const dx = bomb.x - point.x;
    const dy = bomb.y - point.y;
    const distance = length(dx, dy);
    if (distance === 0 || distance >= reach) continue;
    const strength = GRAVITY_BOMB_TUNING.pull * (1 - distance / reach);
    total.x += (dx / distance) * strength;
    total.y += (dy / distance) * strength;
  }
  return total;
}

/** True when `bomb` may pull `racer`: anyone but its owner, and no human slot a rival's bomb may not attack. */
function pulls(world: World, bomb: Twist, racer: Racer): boolean {
  return bomb.owner !== racer.id && mayAttack(world, bomb.owner, racer.id);
}

/** True when the bomb's centre is on the level's map. */
function insideLevel(world: World, twist: Twist): boolean {
  const { width, height } = world.level;
  return twist.x >= 0 && twist.x < width * TILE && twist.y >= 0 && twist.y < height * TILE;
}

/** True when `other` is a racer `racer` may attack, behind it (higher progress) and within the rival range. */
function isChaserInRange(world: World, racer: Racer, other: Racer): boolean {
  if (other.id === racer.id || other.progress <= racer.progress) return false;
  if (!mayAttack(world, racer.id, other.id)) return false;
  const from = centreOf(racer);
  const to = centreOf(other);
  return length(to.x - from.x, to.y - from.y) <= GRAVITY_BOMB_TUNING.rivalBehindTiles * TILE;
}
