/**
 * The race's numbers, in meters, seconds and ticks (60 per second). Started from Rush Racers' run
 * tuning scaled to a 3D trail (one 2D tile of 16 px read as about 1 m).
 * Logic may use only + - * / and the exact Math members (sqrt, floor, ceil, round, min, max, abs,
 * sign) so a race computes the same on every JavaScript engine.
 */
export const RUN = {
  /** Top running speed, m/s. */
  runSpeed: 14,
  /** Forward acceleration while forward is held, m/s². */
  accel: 20,
  /** Forward slowdown with nothing held, m/s². */
  friction: 12,
  /** Forward slowdown while braking, m/s². */
  brake: 40,
  /** Top sideways speed from steering, m/s, and how fast it is reached, m/s². */
  steerSpeed: 7,
  steerAccel: 40,
  /** A racer's radius, m: how close its centre gets to a track edge. */
  radius: 0.5,
  /** Gravity, m/s², and its multiplier while rising with jump released (the short hop). */
  gravity: 30,
  cutGravityMul: 3,
  maxFall: 30,
  /** Upward speed a jump sets, m/s (a held jump rises about 2.4 m). */
  jumpSpeed: 12,
  coyoteTicks: 6,
  bufferTicks: 6,
  /** Running speed's multiplier in mud. */
  mudSpeedMul: 0.55,
  /** How deep a log is along `s`, m. */
  logDepth: 1,
  /** How far below the rim a falling racer counts as fallen, m. */
  fallDepth: 4,
  respawnTicks: 60,
  /** How far before a pit's start a fallen racer comes back, m. */
  respawnBackoff: 3,
  invulnTicks: 60,
} as const;

/** The dash meter, recharge timing and speed boost. */
export const DASH = {
  charges: 2,
  rechargeTicks: 90,
  /** Forward speed a dash sets at least, m/s, and how fast speed over run speed glides back, m/s². */
  speed: 24,
  drag: 10,
} as const;

/** Starting-grid spacing and the timing of the countdown and race end. */
export const RACE = {
  /** 3-2-1 at 60 ticks each, then GO. */
  countdownTicks: 180,
  /** The race ends here whether or not anyone finished: 4 minutes. */
  limitTicks: 4 * 60 * 60,
  /** Meters between racers on the start line, side by side across the track. */
  gridSpacing: 2.5,
  /** Ticks the race goes on after every rival has finished, for the player to finish too. */
  rivalsDoneGraceTicks: 600,
} as const;

/** How far rivals look ahead, when they use items and how they catch up. */
export const RIVAL = {
  /** Catch-up: a rival this many meters or more behind the player runs at 1 + catchUp, as far ahead at 1 - catchUp. */
  catchUpRange: 60,
  catchUp: 0.1,
  /** How far ahead along `s` a rival looks for pits, logs, mud and other racers, m. */
  lookAhead: 25,
  /** A rival dashes only with no pit or log within this many meters ahead, m. */
  dashClearance: 30,
  /** Distances at which rivals consider using an item, m. */
  pieRange: 20,
  sapRange: 25,
  throwMinRange: 5,
  burrRange: 3,
} as const;

/** Inventory capacity, crate timing and item effects. */
export const ITEMS = {
  /** Inventory places per racer. */
  slots: 3,
  /** Uses each kind comes with. */
  charges: { boots: 3, shield: 1, burr: 2, pie: 3 },
  /** Ticks a crate stays shut after it opens, for everyone. */
  crateShutTicks: 90,
  /** Ticks after firing before the same racer can fire again. */
  cooldownTicks: 20,
  /** Rocket Boots: forward speed a boost sets at least, m/s, and how long it lasts. */
  bootsSpeed: 22,
  bootsTicks: 40,
  /** Burr Ball: how long a racer stays puffed up. */
  burrTicks: 60,
  /** Mud Pie: throw speeds added to the thrower's, m/s, and the patch it leaves, m and ticks. */
  pieThrowSpeed: 10,
  pieThrowUp: 8,
  splatLength: 6,
  splatWidth: 4,
  splatTicks: 300,
  /** Sap glob: speed along `s`, m/s, how far it flies, m, and how long it traps. */
  sapSpeed: 30,
  sapRange: 40,
  sapTrapTicks: 60,
  /** A hit with nothing held stuns for this long. */
  stunTicks: 60,
} as const;

/** Crate placement above the trail and the reach required to open one. */
export const CRATE = {
  /** Height of a crate's centre above the ground, m. */
  height: 1.2,
  /** How close a racer's centre must come to a crate's centre to open it, m. */
  touchRadius: 1.2,
} as const;
