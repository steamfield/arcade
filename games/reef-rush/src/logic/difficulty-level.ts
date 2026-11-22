/**
 * Difficulty levels: one table of every knob that makes the race easier or harder, and the few
 * small functions the systems call to read it. A world carries its level (`world.difficulty`);
 * 'hard' is the tuning the per-character difficulty tests were built on, so the other two only
 * soften it. Rivals race by their own profiles at every level: the knobs scale them, never
 * replace them, so a race on Easy still looks like a race.
 */
import { statusDurationMul } from './abilities.ts';
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

/** Everything a difficulty level changes. */
export interface DifficultyTuning {
  /** Multiplies every rival's swim force, on top of its profile and catch-up. */
  rivalForceMul: number;
  /** Rival catch-up bounds: the rubber band that holds a rival back when it leads and speeds it when it trails. */
  rivalCatchUp: CatchUpBounds;
  /** Multiplies every rival's `itemAggression` (how often it spends a ready burst on a use). */
  rivalItemAggressionMul: number;
  /**
   * False keeps rivals' power-ups off the player: they pick no target for a squid, ink, bubble or
   * flash among racers that includes the player, and fire an Undertow only while the player is
   * behind them (an Undertow pulls everyone ahead). The player's own attacks are unaffected.
   */
  rivalsAttackPlayer: boolean;
  /** Multiplies the player's stun, bubble trap and squid latch ticks, on top of the character's own multiplier. */
  playerStatusMul: number;
  /** A swim-force boost for the player trailing the leader: `perTile` per tile beyond `startTiles`, at most `maxBoost`. */
  playerCatchUp: { startTiles: number; perTile: number; maxBoost: number };
  /** Multiplies the player's clam roll weight of these kinds (those not listed stay 1), so Easy hands over helpful power-ups. */
  playerClamWeightMul: Partial<Record<PowerUpKind, number>>;
}

/** The knob table. Hard is exactly the tuning before difficulty levels existed. */
export const DIFFICULTY: Record<Difficulty, DifficultyTuning> = {
  hard: {
    rivalForceMul: 1,
    rivalCatchUp: { lagTiles: 0, perTile: 0.05, min: 0.6, max: 1.25 },
    rivalItemAggressionMul: 1,
    rivalsAttackPlayer: true,
    playerStatusMul: 1,
    playerCatchUp: { startTiles: 6, perTile: 0, maxBoost: 0 },
    playerClamWeightMul: {},
  },
  normal: {
    rivalForceMul: 0.95,
    rivalCatchUp: { lagTiles: 10, perTile: 0.05, min: 0.6, max: 1.25 },
    rivalItemAggressionMul: 0.7,
    rivalsAttackPlayer: true,
    playerStatusMul: 0.75,
    playerCatchUp: { startTiles: 5, perTile: 0.02, maxBoost: 0.2 },
    playerClamWeightMul: {},
  },
  easy: {
    rivalForceMul: 0.9,
    rivalCatchUp: { lagTiles: 16, perTile: 0.12, min: 0.1, max: 1.3 },
    rivalItemAggressionMul: 0.4,
    rivalsAttackPlayer: false,
    playerStatusMul: 0.5,
    playerCatchUp: { startTiles: 3, perTile: 0.05, maxBoost: 0.6 },
    playerClamWeightMul: { jetFin: 3, bubbleShield: 2 },
  },
};

/** The tuning of the world's level. */
export function tuningOf(world: World): DifficultyTuning {
  return DIFFICULTY[world.difficulty];
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
