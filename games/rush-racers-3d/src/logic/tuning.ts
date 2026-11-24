/**
 * The race's numbers, in meters, seconds and ticks (60 per second). Started from Rush Racers' run
 * tuning scaled to a 3D trail (one 2D tile of 16 px read as about 1 m); lane a may tune them.
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

export const DASH = {
  charges: 2,
  rechargeTicks: 90,
  /** Forward speed a dash sets at least, m/s, and how fast speed over run speed glides back, m/s². */
  speed: 24,
  drag: 10,
  /** Ticks a dash's burst counts as dashing (for bonks and pushes in later phases). */
  burstTicks: 12,
} as const;

export const RACE = {
  /** 3-2-1 at 60 ticks each, then GO. */
  countdownTicks: 180,
  /** The race ends here whether or not anyone finished: 4 minutes. */
  limitTicks: 4 * 60 * 60,
  /** Meters between racers on the start line, side by side across the track. */
  gridSpacing: 2.5,
} as const;
