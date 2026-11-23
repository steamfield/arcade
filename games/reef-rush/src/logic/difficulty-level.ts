/**
 * Difficulty levels: one table of every knob that makes the race easier or harder, and the few
 * small functions the systems call to read it. A world carries its level (`world.difficulty`);
 * 'hard' is the tuning the per-character difficulty tests were built on, so the other two only
 * soften it. Rivals race by their own profiles at every level: the knobs scale them, never
 * replace them, so a race on Easy still looks like a race.
 */
import { statusDurationMul } from './abilities.ts';
import { courseOf } from './courses/index.ts';
import type { Difficulty, PowerUpKind, Racer, RacerId, World } from './types.ts';

/**
 * Bounds of the rival catch-up multiplier on swim force, and its slope per tile of gap to the player.
 * `lagTiles` moves the point where a rival swims at its own pace: 0 is level with the player, a
 * positive value that many tiles behind it, so rivals hover behind a player who holds a pace.
 */
export interface CatchUpBounds {
  lagTiles: number;
  perTile: number;
  min: number;
  max: number;
}

/**
 * The way-finding help for a player who holds toward the finish and steers only after hitting a wall
 * (see `guide.ts`). Off means the world tracks nothing and the player's input is never touched.
 */
export interface GuideTuning {
  enabled: boolean;
  /** Ticks without progress (while pushing) before the steering assist starts to slide the player along the wall. */
  assistGraceTicks: number;
  /** Ticks of pushing the assist stays on for once it engaged, so it carries the player along the whole wall. */
  assistHoldTicks: number;
  /** The most the guide direction adds to the stick, as a fraction of a full stick. */
  assistBlend: number;
  /** Ticks without progress before the engine shows the guide arrow. */
  showTicks: number;
}

/** Everything a difficulty level changes. */
export interface DifficultyTuning {
  /** Multiplies every rival's swim force, on top of its profile and catch-up. */
  rivalForceMul: number;
  /** Rival catch-up bounds: the rubber band that holds a rival back when it leads and speeds it when it trails. */
  rivalCatchUp: CatchUpBounds;
  /** Multiplies every rival's `itemAggression` (how often it spends a ready item on a use). */
  rivalItemAggressionMul: number;
  /** Ticks after the GO before catch-up applies, so all four racers leave the line together. */
  rivalCatchUpDelayTicks: number;
  /**
   * False keeps rivals' power-ups off the player. They pick no target for a squid, ink, bubble or
   * flash among racers that includes the player, fire an Undertow only while the player is behind
   * them (an Undertow pulls everyone ahead), and what they do land is ignored: `applyHit` refuses
   * a hit caused by a rival's item, ink does not slow the player and a rival's riptide lane does
   * not push it. The player's own attacks and hazards (urchins, jellies) are unaffected.
   */
  rivalsAttackPlayer: boolean;
  /** Multiplies the player's stun, bubble trap and squid latch ticks, on top of the character's own multiplier. */
  playerStatusMul: number;
  /** Multiplies the player's invulnerability after any hit, so a child isn't stunned again at once. */
  playerInvulnerableMul: number;
  /** Ticks before contact within which a kick makes a squid miss (SQUID.dodgeTicks on Hard). */
  squidDodgeTicks: number;
  /** A swim-force boost for the player trailing the leader: `perTile` per tile beyond `startTiles`, at most `maxBoost`. */
  playerCatchUp: { startTiles: number; perTile: number; maxBoost: number };
  /** Multiplies the player's clam roll weight of these kinds (those not listed stay 1), so Easy hands over helpful power-ups. */
  playerClamWeightMul: Partial<Record<PowerUpKind, number>>;
  /** The Easy way-finding guide and steering assist. */
  guide: GuideTuning;
}

/** The guide off: Normal and Hard leave the player's input and the screen alone. */
const NO_GUIDE: GuideTuning = { enabled: false, assistGraceTicks: 0, assistHoldTicks: 0, assistBlend: 0, showTicks: 0 };

/** The knob table. Hard is exactly the tuning before difficulty levels existed. */
export const DIFFICULTY: Record<Difficulty, DifficultyTuning> = {
  hard: {
    rivalForceMul: 1,
    rivalCatchUp: { lagTiles: 0, perTile: 0.05, min: 0.6, max: 1.25 },
    rivalCatchUpDelayTicks: 0,
    rivalItemAggressionMul: 1,
    rivalsAttackPlayer: true,
    playerStatusMul: 1,
    playerInvulnerableMul: 1,
    squidDodgeTicks: 12,
    playerCatchUp: { startTiles: 6, perTile: 0, maxBoost: 0 },
    playerClamWeightMul: {},
    guide: NO_GUIDE,
  },
  normal: {
    rivalForceMul: 0.95,
    rivalCatchUp: { lagTiles: 2, perTile: 0.05, min: 0.6, max: 1.25 },
    rivalCatchUpDelayTicks: 0,
    rivalItemAggressionMul: 0.7,
    rivalsAttackPlayer: true,
    playerStatusMul: 0.75,
    playerInvulnerableMul: 1,
    squidDodgeTicks: 18,
    playerCatchUp: { startTiles: 5, perTile: 0.02, maxBoost: 0.2 },
    playerClamWeightMul: {},
    guide: NO_GUIDE,
  },
  easy: {
    rivalForceMul: 0.85,
    rivalCatchUp: { lagTiles: 44, perTile: 0.12, min: 0.6, max: 1.6 },
    rivalCatchUpDelayTicks: 240,
    rivalItemAggressionMul: 0.4,
    rivalsAttackPlayer: false,
    playerStatusMul: 0.5,
    playerInvulnerableMul: 3,
    squidDodgeTicks: 24,
    playerCatchUp: { startTiles: 3, perTile: 0.05, maxBoost: 0.6 },
    playerClamWeightMul: { jetFin: 3, bubbleShield: 2 },
    guide: { enabled: true, assistGraceTicks: 30, assistHoldTicks: 90, assistBlend: 1, showTicks: 90 },
  },
};

/** The tuning of the world's level. */
export function tuningOf(world: World): DifficultyTuning {
  return DIFFICULTY[world.difficulty];
}

/**
 * The rivals' catch-up bounds for the world's course and level: the level's own bounds, with any
 * per-level override the course makes (`Course.catchUp`) merged in field by field. Levels store
 * absolute bounds, so an override for one level leaves the others exactly as the table has them.
 *
 * @throws {Error} When the world holds a course id that is neither shipped nor registered.
 */
export function rivalCatchUpFor(world: World): CatchUpBounds {
  const table = tuningOf(world).rivalCatchUp;
  const override = courseOf(world).catchUp?.[world.difficulty];
  if (!override) return table;
  return {
    lagTiles: override.lagTiles ?? table.lagTiles,
    perTile: override.perTile ?? table.perTile,
    min: override.min ?? table.min,
    max: override.max ?? table.max,
  };
}

/**
 * A stun, trap or latch length for `racer`, in ticks: `baseTicks` times the character's own
 * multiplier, and for the player times the level's `playerStatusMul`, rounded to whole ticks.
 */
export function statusTicks(
  world: World,
  racer: Racer,
  baseTicks: number,
  status: 'stunned' | 'trapped' | 'latched',
): number {
  const level = racer.id === 'player' ? tuningOf(world).playerStatusMul : 1;
  return Math.round(baseTicks * statusDurationMul(racer, status) * level);
}

/**
 * The swim-force multiplier a trailing player gets: 1 until it is more than `startTiles` behind the
 * leader (lowest progress among the other racers), then `perTile` per extra tile up to `maxBoost`.
 * Exactly 1 while any progress is still unknown.
 */
export function playerCatchUpMul(player: Racer, others: readonly Racer[], tuning: DifficultyTuning): number {
  const { startTiles, perTile, maxBoost } = tuning.playerCatchUp;
  const leader = Math.min(...others.filter((racer) => racer.id !== player.id).map((racer) => racer.progress));
  if (!Number.isFinite(leader) || !Number.isFinite(player.progress)) return 1;
  const behind = player.progress - leader - startTiles;
  return 1 + Math.max(0, Math.min(maxBoost, behind * perTile));
}

/** Whether `attacker` may pick `target` for a hostile power-up: only a rival aiming at the player can be refused. */
export function mayAttack(world: World, attacker: RacerId, target: RacerId): boolean {
  return attacker === 'player' || target !== 'player' || tuningOf(world).rivalsAttackPlayer;
}

/** The factor on a rival's item aggression: the level's for a rival, 1 for the player's own bot. */
export function itemAggressionMul(world: World, racer: Racer): number {
  return racer.id === 'player' ? 1 : tuningOf(world).rivalItemAggressionMul;
}

/** The clam roll weight multipliers for `racer`: the level's for the player, none for a rival. */
export function clamBias(world: World, racer: Racer): Partial<Record<PowerUpKind, number>> {
  return racer.id === 'player' ? tuningOf(world).playerClamWeightMul : {};
}

/** Ticks of invulnerability after a hit on `racer`: `baseTicks`, times the level's multiplier for the player. */
export function invulnerableTicks(world: World, racer: Racer, baseTicks: number): number {
  return Math.round(baseTicks * (racer.id === 'player' ? tuningOf(world).playerInvulnerableMul : 1));
}

/** Ticks before contact within which a kick dodges a squid on this world's level (the engine's KICK! prompt reads it too). */
export function dodgeTicks(world: World): number {
  return tuningOf(world).squidDodgeTicks;
}
