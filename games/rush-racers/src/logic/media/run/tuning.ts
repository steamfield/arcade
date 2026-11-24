/**
 * Run's numbers and rules as data: the tuning its physics reads, what running on land does in the
 * generic rules that push racers around, and how those rules read a dash. Values are shared by the
 * player and rivals; profiles, power-ups and abilities scale them through MoveModifiers.
 */
import type { KickRules, MediumEffects, MediumTuning } from '../types.ts';

/**
 * Run tuning in pixels and seconds. `force` is ground acceleration toward the held direction
 * (px/s²), `drag` ground friction with nothing held (px/s²), `maxSpeed` the hard cap on horizontal
 * speed that neither running nor the dash ever passes (px/s), `kick` the speed a dash sets along
 * facing (px/s). In `extra`: `runSpeed`, top running speed before forceMul and mud (px/s);
 * `gravity` (px/s²); `cutGravityMul`, gravity's multiplier while rising with Up released (the short
 * hop); `maxFall` (px/s); `airAccel` and `airFriction` (px/s²); `jumpSpeed` (px/s, a held jump rises
 * about 3.3 tiles); `coyoteTicks` and `bufferTicks`; `respawnTicks`, how long a fallen racer is out;
 * `respawnInvulnTicks`; `windSpeed` (px/s), how much a left or right gust adds to the speed a runner
 * settles at; `draftForce` (px/s²), how hard an updraft or downdraft pushes; `mudSpeedMul`, running
 * speed's multiplier in mud; `dashDrag` (px/s²), how fast a dash's speed over running pace
 * (before mud and gusts) glides back to it while the runner steers the same way, on the ground or
 * in the air; mud, a dropped gust or a hit still slow it at full friction. At 120
 * a dash carries about 0.8 s and gains about 40 px, near a swim kick's worth over cruise (0.4 s of
 * running against its 0.5 s of cruise), where full ground `drag` ended it in a tenth of a second;
 * the Bramble Run bars were tuned at this value.
 */
export const RUN_TUNING = {
  base: { forceMul: 1, kickMul: 1, kickCooldownTicks: 36, dragMul: 1 },
  force: 700,
  drag: 900,
  maxSpeed: 240,
  kick: 200,
  extra: {
    runSpeed: 100,
    gravity: 800,
    cutGravityMul: 3.5,
    maxFall: 320,
    airAccel: 450,
    airFriction: 120,
    jumpSpeed: 290,
    coyoteTicks: 6,
    bufferTicks: 6,
    respawnTicks: 60,
    respawnInvulnTicks: 60,
    windSpeed: 60,
    draftForce: 1000,
    mudSpeedMul: 0.6,
    dashDrag: 120,
  },
} as const satisfies MediumTuning;

/** Upward speed after stomping an enemy, px/s: about two thirds of a full jump. */
const RUN_STOMP_BOUNCE = 220;

/**
 * Gravity keeps vertical speed through a dash or knockback; trapped racers and loose power-ups fall
 * (px/s); enemies can be stomped; crates are solid and open from below; pits are open; ledges allowed.
 * The Easy assist slides only the horizontal stick, so it never presses Up for a jump.
 */
export const RUN_EFFECTS: MediumEffects = {
  dashAxes: 'horizontal',
  trappedDrift: 30,
  looseDrift: 40,
  stompBounce: RUN_STOMP_BOUNCE,
  solidClams: true,
  pitBelow: true,
  allowsLedges: true,
  assistAxes: 'horizontal',
  gravityWells: false,
  bounceSpeed: null,
};

/** No kick counter works on land, and Gil's ability is a higher jump (`jumpMulFor`), not a spring kick. */
export const RUN_KICK_RULES: KickRules = {
  dodgesSquid: false,
  shakesLatch: false,
  countersUndertow: false,
  springKick: () => false,
};
