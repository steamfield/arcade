/**
 * When a computer racer fires an item, and which slot. `rivalIntent` asks every
 * tick with that tick's item draw (its fourth, taken holding or not); this module
 * only reads the world.
 *
 * Distances are between racer centres, in tiles. "Ahead" and "behind" compare
 * progress (lower is ahead). Rivals aim at any racer, so the field fights itself (except the player, where the difficulty level's `mayAttack` says no). The bubble's aim cone is ITEM_USE.aimConeCos either
 * side of the aim. Jet Fins (and a Cannonball with no coral to break) need the whole body to slide
 * 5 tiles along the aim.
 */
import { itemAggressionMul, mayAttack } from '../difficulty-level.ts';
import { pickSquidTarget } from '../hazards/squid-target.ts';
import { mediumOf } from '../media/index.ts';
import { length } from '../num.ts';
import { CLAM, FLASH } from '../powerups/tuning.ts';
import { activeRacers, centreOf, playerOf } from '../racers.ts';
import { type PowerUpKind, type Racer, TILE, type Vec, type World } from '../types.ts';
import { hasClearSweep, tileOf } from './steer.ts';

/** How near a use has to be before a rival spends an item on it. */
export const ITEM_USE = {
  /** Ink: a racer behind within this many tiles. */
  inkBehindTiles: 4,
  /** Bubble: a racer ahead within this many tiles... */
  bubbleAheadTiles: 6,
  /** ...and within 30 degrees of the aim: cos(30°), written out so no engine trig runs. */
  aimConeCos: 0.8660254037844386,
  /**
   * Lantern: a racer just ahead and this close, so a rival saves its flash for a pass instead of
   * firing it whenever anyone is in range.
   */
  lanternTiles: FLASH.rangeTiles / 2,
  /** Puffer and Cannonball: unbroken coral within this many steps ahead (`Medium.coralAhead`). */
  pufferCoralSteps: 3,
  /** Jet Fins (and Cannonball without coral): this many tiles of clear water straight along the aim. */
  jetClearTiles: 5,
  /** Riptide: this many tiles of clear water straight along the aim to lay the lane on... */
  riptideClearTiles: 6,
  /** ...and a racer this close behind, who would draft it (a lane nobody can use is not worth a charge). */
  riptideBehindTiles: 5,
  /** Undertow: a racer this many tiles further ahead makes it worth firing (from 3rd or 4th place only). */
  undertowLeadTiles: 8,
  /** Mimic: drop the decoy when a squid locked on this racer is within this many tiles. */
  mimicSquidTiles: 8,
  /**
   * A dash from behind is runaway speed, so firing Jet Fins, or a Cannonball with no coral ahead,
   * scales the chance by this. A Cannonball or Puffer with coral just ahead is worth firing at once:
   * a rival that waits at the gate for a use it almost never takes jams the corridor.
   */
  jetChanceMul: 0.02,
} as const;

/** The kinds that break coral when fired, and so come first when coral is just ahead. */
const CORAL_BREAKERS: readonly PowerUpKind[] = ['puffer', 'cannonball'];

/** The kinds that start a dash, so `fireItem` turns them down while one is running. */
const DASHERS: readonly PowerUpKind[] = ['jetFin', 'cannonball'];

/**
 * The slot the racer fires this tick, or null. Null when its item use is cooling down or nothing held
 * has a use. The slot is the first holding a Puffer or Cannonball when coral is just ahead
 * (`pufferHasCoral`), else the first held slot whose kind has a use. It fires only when `roll` is
 * under `profile.itemAggression` (times the difficulty level's multiplier), times
 * ITEM_USE.jetChanceMul when that slot is Jet Fins or a Cannonball and no coral is ahead.
 *
 * Uses: inkSac, a racer behind (higher progress) within 4 tiles; bubbleShield, a racer ahead within
 * 6 tiles inside the aim cone; glowLantern, a racer ahead within 2 tiles; puffer, unbroken coral
 * within 3 tiles ahead (`Medium.coralAhead`); jetFin, a clear straight path of 5 tiles along the aim;
 * cannonball, either of the last two; homingSquid, a target in lock range (`pickSquidTarget`);
 * riptide, 6 clear tiles along the aim with a racer within 5 tiles behind to draft it; undertow, in
 * 3rd or 4th with a racer 8 or more tiles ahead; mimic, a squid locked on it within 8 tiles.
 *
 * @param aim The unit aim the medium's steering chose this tick (`Steering.aim`).
 * @param roll The tick's item draw from the racer's rng, in [0, 1).
 */
export function chooseItemSlot(world: World, racer: Racer, aim: Vec, roll: number): number | null {
  if (racer.useCooldown > 0) return null;
  const coral = pufferHasCoral(world, racer);
  const breaker = coral ? slotHolding(racer, CORAL_BREAKERS) : -1;
  const slot = breaker >= 0 ? breaker : slotWithUse(world, racer, aim);
  const kind = racer.items[slot]?.kind;
  if (kind === undefined) return null;
  const aggression = racer.profile.itemAggression * itemAggressionMul(world, racer);
  const dashes = kind === 'jetFin' || (kind === 'cannonball' && !coral);
  return roll < aggression * (dashes ? ITEM_USE.jetChanceMul : 1) ? slot : null;
}

/** The first slot holding one of `kinds` that can fire now, or -1. */
function slotHolding(racer: Racer, kinds: readonly PowerUpKind[]): number {
  return racer.items.findIndex((item) => item !== null && kinds.includes(item.kind) && firesNow(racer, item.kind));
}

/** The first held slot whose kind can fire now and has a use this tick, or -1. */
function slotWithUse(world: World, racer: Racer, aim: Vec): number {
  return racer.items.findIndex(
    (item) => item !== null && firesNow(racer, item.kind) && hasUse(world, racer, aim, item.kind),
  );
}

/** False for a dash item while a dash is running, which `fireItem` would turn down. */
function firesNow(racer: Racer, kind: PowerUpKind): boolean {
  return !(DASHERS.includes(kind) && racer.status.dashing > 0);
}

function hasUse(world: World, racer: Racer, aim: Vec, kind: PowerUpKind): boolean {
  switch (kind) {
    case 'inkSac':
      return othersNear(world, racer, ITEM_USE.inkBehindTiles).some((other) => other.progress > racer.progress);
    case 'bubbleShield':
      return othersNear(world, racer, ITEM_USE.bubbleAheadTiles).some(
        (other) => other.progress < racer.progress && inAimCone(racer, aim, other),
      );
    case 'glowLantern':
      return othersNear(world, racer, ITEM_USE.lanternTiles).some((other) => other.progress < racer.progress);
    case 'puffer':
      return pufferHasCoral(world, racer);
    case 'jetFin':
      return clearAhead(world, racer, aim, ITEM_USE.jetClearTiles);
    case 'cannonball':
      return pufferHasCoral(world, racer) || clearAhead(world, racer, aim, ITEM_USE.jetClearTiles);
    case 'homingSquid':
      return pickSquidTarget(world, racer.id, centreOf(racer), null) !== null;
    case 'riptide':
      return (
        clearAhead(world, racer, aim, ITEM_USE.riptideClearTiles) &&
        othersNear(world, racer, ITEM_USE.riptideBehindTiles).some((other) => other.progress > racer.progress)
      );
    case 'undertow':
      return (
        racer.place >= CLAM.undertowMinPlace &&
        undertowSparesPlayer(world, racer) &&
        activeRacers(world).some((other) => other.progress <= racer.progress - ITEM_USE.undertowLeadTiles)
      );
    case 'mimic':
      return world.squids.some(
        (squid) =>
          squid.target?.kind === 'racer' &&
          squid.target.id === racer.id &&
          withinTiles(centreOf(racer), squid, ITEM_USE.mimicSquidTiles),
      );
  }
}

/**
 * Whether an Undertow from `racer` would leave the player alone where the level forbids rivals to
 * attack it: it pulls everyone ahead of the user, so the player must not be ahead.
 */
function undertowSparesPlayer(world: World, racer: Racer): boolean {
  return mayAttack(world, racer.id, 'player') || playerOf(world).progress >= racer.progress;
}

/** Other racers in play (the player left out where rivals may not attack it) with centres within `tiles` of this one's centre. */
function othersNear(world: World, racer: Racer, tiles: number): Racer[] {
  return activeRacers(world).filter(
    (other) =>
      other.id !== racer.id &&
      mayAttack(world, racer.id, other.id) &&
      withinTiles(centreOf(racer), centreOf(other), tiles),
  );
}

function withinTiles(from: Vec, to: Vec, tiles: number): boolean {
  const reach = tiles * TILE;
  return (to.x - from.x) ** 2 + (to.y - from.y) ** 2 <= reach * reach;
}

function inAimCone(racer: Racer, aim: Vec, other: Racer): boolean {
  const from = centreOf(racer);
  const to = centreOf(other);
  const lengths = length(to.x - from.x, to.y - from.y) * length(aim.x, aim.y);
  if (lengths === 0) return false;
  return ((to.x - from.x) * aim.x + (to.y - from.y) * aim.y) / lengths >= ITEM_USE.aimConeCos;
}

/** True when a Puffer or Cannonball would open coral just ahead of the racer, as the medium judges it. */
function pufferHasCoral(world: World, racer: Racer): boolean {
  return mediumOf(world).coralAhead(world, tileOf(centreOf(racer)), ITEM_USE.pufferCoralSteps);
}

function clearAhead(world: World, racer: Racer, aim: Vec, tiles: number): boolean {
  if (aim.x === 0 && aim.y === 0) return false;
  const centre = centreOf(racer);
  const reach = tiles * TILE;
  const to = { x: centre.x + aim.x * reach, y: centre.y + aim.y * reach };
  return hasClearSweep(world.level, world.broken, racer.body, to);
}
