/**
 * Power-up and pickup numbers every phase 3 module agrees on: stack size, burst
 * cooldown, each burst's effect, combos, passives, clams, pearls and loose
 * power-ups. Data only. Durations are ticks (1/60 s), speeds px/s, sizes px.
 */
import type { ComboName, PowerUpKind } from '../types.ts';

/** Most power-ups a racer holds; gaining a fourth drops the oldest. */
export const STACK_MAX = 3;

/** Ticks between bursts, shared by every held power-up. */
export const BURST_COOLDOWN_TICKS = 150;

/**
 * Jet Fins burst: velocity held at `speed` along the input (or facing) for `ticks` ticks,
 * counting the firing tick, ignoring drag.
 */
export const DASH = { ticks: 24, speed: 200 } as const;

/** Bubble Shield burst: a bubble fired along the input (or facing) that traps the first other racer it touches. */
export const BUBBLE = {
  speed: 150,
  ttlTicks: 90,
  /** Side of the bubble's square hitbox, centred on it. */
  size: 10,
  trapTicks: 60,
  /** seekerBubble: turns toward the nearest racer ahead within this many tiles... */
  seekRangeTiles: 8,
  /** ...by at most this many radians per tick (4 degrees). */
  seekTurnPerTick: (4 * Math.PI) / 180,
} as const;

/** Puffer burst: a larger hitbox centred on the body that breaks coral and hits racers it touches. */
export const INFLATE = { ticks: 60, size: 20 } as const;

/** Ink Sac burst: a cloud behind the racer that slows every other racer inside it. */
export const INK = {
  /** 32 px across. */
  radius: 16,
  /** Cloud centre sits this far behind the racer's centre, opposite its facing. */
  behind: 20,
  ttlTicks: 240,
  /** Slow applied to a racer inside, refreshed every tick it stays inside. */
  slowTicks: 90,
  /** inkBomb: 48 px across and centred on the racer. */
  bombRadius: 24,
  /** inkTrail: one cloud every this many ticks of the dash, starting on the firing tick. */
  trailEveryTicks: 8,
} as const;

/** Glow Lantern burst: stuns other racers and jellies whose centres are within range of the racer's centre. */
export const FLASH = { rangeTiles: 4, stunTicks: 45 } as const;

/** Combos in priority order: with three held, the first pair listed that is held is the reported combo. */
export const COMBO_PAIRS: readonly { name: ComboName; kinds: readonly [PowerUpKind, PowerUpKind] }[] = [
  { name: 'cannonball', kinds: ['jetFin', 'puffer'] },
  { name: 'inkTrail', kinds: ['jetFin', 'inkSac'] },
  { name: 'seekerBubble', kinds: ['bubbleShield', 'glowLantern'] },
  { name: 'inkBomb', kinds: ['puffer', 'inkSac'] },
  { name: 'comet', kinds: ['jetFin', 'glowLantern'] },
];

/** Passive effects of held power-ups and statuses on swimming and bumping. */
export const PASSIVE = {
  jetForceMul: 1.15,
  jetKickCooldownTicks: 22,
  /** Pearl boost. */
  boostForceMul: 1.2,
  /** Inside another racer's ink. */
  slowedForceMul: 0.5,
  inflatedForceMul: 0.8,
  /** A Puffer holder bumps like a racer of this many times its mass. */
  pufferMassMul: 2,
  /** A Glow Lantern holder collects pearls whose tile centre is within this many tiles of its centre. */
  lanternPearlTiles: 3,
} as const;

/**
 * Clam roll weights for 1st and 4th place; 2nd and 3rd interpolate linearly between them
 * (2nd is one third of the way from 1st to 4th). Held kinds are excluded from a roll.
 */
export const CLAM = {
  closedTicks: 240,
  firstWeights: { bubbleShield: 3, glowLantern: 3, inkSac: 2, puffer: 1, jetFin: 1 },
  lastWeights: { jetFin: 3, puffer: 3, inkSac: 2, bubbleShield: 1, glowLantern: 1 },
} as const satisfies {
  closedTicks: number;
  firstWeights: Record<PowerUpKind, number>;
  lastWeights: Record<PowerUpKind, number>;
};

/** Pearls: a small boost for whoever touches one first. */
export const PEARL = { boostTicks: 30 } as const;

/** A power-up knocked off by a hit, floating at the racer's centre. */
export const LOOSE = {
  grabDelayTicks: 30,
  ttlTicks: 600,
  /** Upward drift, px/s. */
  riseSpeed: 10,
  /** Side of its square pickup box, centred on it. */
  size: 10,
} as const;
