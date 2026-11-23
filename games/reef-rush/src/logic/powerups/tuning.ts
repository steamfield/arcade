/**
 * Power-up and pickup numbers every item module agrees on: slot count, use
 * cooldown, each item's effect, passives, clams, pearls and loose power-ups.
 * Charges per kind are in `charges.ts`. Data only. Durations are ticks (1/60 s),
 * speeds px/s, sizes px.
 */
import type { PowerUpKind } from '../types.ts';

/** Item slots a racer has (Nib's ability adds one, `stackMaxFor`). */
export const STACK_MAX = 3;

/** Ticks after an item use before the next one, shared by every slot. */
export const USE_COOLDOWN_TICKS = 20;

/**
 * Jet Fins boost: velocity held at `speed` along the input (or facing) for `ticks` ticks, counting
 * the firing tick, ignoring drag. The firing tick sets velocity after the body has moved, so the
 * dash moves the body on `ticks - 1` ticks.
 */
export const DASH = { ticks: 24, speed: 200 } as const;

/**
 * Cannonball: a dash like Jet Fins' but longer and faster, inflated and invulnerable for its whole
 * length, so it breaks coral and hits the racers it touches and nothing ends it early.
 */
export const CANNONBALL = { ticks: 75, speed: DASH.speed * 1.25 } as const;

/**
 * The kinds that break coral when fired (they inflate): rivals fire them first when coral is just
 * ahead, and steer through coral while holding one.
 */
export const CORAL_BREAKERS: readonly PowerUpKind[] = ['puffer', 'cannonball'];

/** Bubble Shield use: a bubble fired along the input (or facing) that traps the first other racer it touches. */
export const BUBBLE = {
  speed: 150,
  ttlTicks: 90,
  /** Side of the bubble's square hitbox, centred on it. */
  size: 10,
  trapTicks: 60,
} as const;

/** Puffer use: a larger hitbox centred on the body that breaks coral and hits racers it touches. */
export const INFLATE = { ticks: 60, size: 20 } as const;

/** Ink Sac use: a cloud behind the racer that slows every other racer inside it. */
export const INK = {
  /** 32 px across. */
  radius: 16,
  /** Cloud centre sits this far behind the racer's centre, opposite its facing. */
  behind: 20,
  ttlTicks: 240,
  /** Slow applied to a racer inside, refreshed every tick it stays inside. */
  slowTicks: 90,
} as const;

/** Glow Lantern use: stuns other racers and jellies whose centres are within range of the racer's centre. */
export const FLASH = { rangeTiles: 4, stunTicks: 45 } as const;

/**
 * Homing Squid. It flies at `speed` px/s, turning at most `turnPerTick` radians a tick, and locks the
 * nearest unfinished racer ahead of its owner within `lockTiles` (a racer with a Mimic selected only from
 * `MIMIC.lockRangeMul` of that). It gives up after `ttlTicks`. A kick by its target in the last
 * `dodgeTicks` before contact (distance at squid speed) makes it miss. A latched racer swims at
 * `latchedForceMul` force for `latchedTicks`, drifting sideways by up to `driftAccel` px/s² on a
 * sine of period `driftPeriodTicks`; each kick takes `ticksPerKick` off.
 */
export const SQUID = {
  speed: 160,
  turnPerTick: (14 * Math.PI) / 180,
  ttlTicks: 360,
  lockTiles: 10,
  dodgeTicks: 12,
  latchedTicks: 90,
  latchedForceMul: 0.7,
  ticksPerKick: 30,
  driftAccel: 90,
  driftPeriodTicks: 60,
  /** A squid ignores ink clouds for this many ticks after launch. */
  inkGraceTicks: 10,
  /** Side of its square hitbox, centred on it. */
  size: 10,
} as const;

/**
 * Riptide: a lane `widthTiles` wide and up to `lengthTiles` long from the racer's centre along the
 * aim (snapped to the dominant axis), clipped at the first solid tile, lasting `ttlTicks`. Inside it
 * a racer feels `currentForceMul` times a plain current. A racer with a Riptide selected feels every current `currentMul`
 * harder.
 */
export const RIPTIDE = {
  currentMul: 1.5,
  widthTiles: 2,
  lengthTiles: 8,
  ttlTicks: 180,
  currentForceMul: 2,
} as const;

/**
 * Undertow: `ticks` of pull on every racer ahead of the user, `baseForce` px/s² plus `perTile` for each
 * tile of lead, at most `maxMul` times the base. A kick cuts that tick's pull and takes `kickCutTicks` off.
 */
export const UNDERTOW = { ticks: 90, baseForce: 120, perTile: 6, maxMul: 3, kickCutTicks: 20 } as const;

/**
 * Mimic: the decoy lives `ttlTicks` and swims `speed` px/s along the steer field; a squid fired at a
 * racer with a Mimic selected locks on only from `lockRangeMul` of the usual range.
 */
export const MIMIC = { ttlTicks: 300, lockRangeMul: 0.5, speed: 80, size: 12 } as const;

/** Passive effects of the selected item and of statuses on swimming and bumping. */
export const PASSIVE = {
  jetForceMul: 1.15,
  jetKickCooldownTicks: 22,
  /** Pearl boost. */
  boostForceMul: 1.2,
  /** Inside another racer's ink. */
  slowedForceMul: 0.5,
  inflatedForceMul: 0.8,
  /** A racer with a Puffer selected bumps like a racer of this many times its mass. */
  pufferMassMul: 2,
  /** A racer with a Glow Lantern selected collects pearls whose tile centre is within this many tiles of its centre. */
  lanternPearlTiles: 3,
} as const;

/**
 * Clam roll weights for 1st and 4th place; 2nd and 3rd interpolate linearly between them
 * (2nd is one third of the way from 1st to 4th). Held kinds are excluded from a roll. Leaders get
 * defence (shields, lanterns, decoys) and a rare Homing Squid; trailers get speed and the attacks,
 * the Squid most of all. Undertow is zero for
 * anyone ahead of `undertowMinPlace`, whatever the interpolation says (`clamWeights`).
 */
export const CLAM = {
  closedTicks: 90,
  /**
   * Rolls a rival gets from one clam while it has an empty slot (the player gets one). Rivals follow
   * the racing line, open about two clams a race and fire nearly all they get, so supply limits
   * their item use; two rolls lift every character's median as a Normal rival from about 4 to 6-9.5
   * uses a race (`difficulty/rival-items.ts`) without clams reopening sooner, which would let a racer
   * camp one, or moving clams. Three rolls overshot the 10-use ceiling (Nib 14, Rook 12).
   */
  rivalRolls: 2,
  /** Undertow only rolls for racers in this place or worse (3rd or 4th). */
  undertowMinPlace: 3,
  firstWeights: {
    bubbleShield: 3,
    glowLantern: 3,
    inkSac: 2,
    puffer: 1,
    jetFin: 1,
    homingSquid: 1,
    riptide: 0,
    undertow: 0,
    mimic: 3,
    cannonball: 0,
  },
  lastWeights: {
    jetFin: 3,
    puffer: 3,
    inkSac: 2,
    bubbleShield: 1,
    glowLantern: 1,
    homingSquid: 4,
    riptide: 2,
    undertow: 2,
    mimic: 0,
    cannonball: 2,
  },
} as const satisfies {
  closedTicks: number;
  rivalRolls: number;
  undertowMinPlace: number;
  firstWeights: Record<PowerUpKind, number>;
  lastWeights: Record<PowerUpKind, number>;
};

/**
 * Pearls work like coins. Each one collected (from the course or knocked loose) gives a short boost
 * and adds to the racer's count, which raises swim force by `speedPerPearl` per pearl up to `cap`
 * pearls. A landed hit knocks up to `dropOnHit` loose; they scatter at `scatterSpeed`, keep
 * `dragPerTick` of their speed each tick (so in open water they settle about 57 px, 3.5 tiles, out:
 * far enough that the knocked-back dropper doesn't swim straight back over them), and vanish after
 * `lifeTicks`. The racer that dropped them can't collect them for `ownGraceTicks`. A loose pearl is collected by touching its `size` square.
 */
export const PEARL = {
  boostTicks: 30,
  speedPerPearl: 0.01,
  cap: 10,
  dropOnHit: 3,
  ownGraceTicks: 30,
  lifeTicks: 600,
  scatterSpeed: 300,
  dragPerTick: 0.92,
  size: 8,
} as const;

/** A power-up knocked off by a hit, floating at the racer's centre. */
export const LOOSE = {
  grabDelayTicks: 30,
  ttlTicks: 600,
  /** Upward drift, px/s. */
  riseSpeed: 10,
  /** Side of its square pickup box, centred on it. */
  size: 10,
} as const;
