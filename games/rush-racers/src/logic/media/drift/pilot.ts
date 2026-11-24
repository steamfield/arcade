/**
 * Drift's rival pilot (`Medium.steer`). It steers by velocity: from the aim along the way (the smash
 * field while it can break ice, the ram field always for a rival that rams ice), a bounded wobble
 * and a bend round any hazard in the way (`ai/avoid.ts`), it works out the velocity it wants and
 * the stick that gets it there (`thrust-plan.ts`), so one rule brakes, corrects sideways drift,
 * turns, and flies with or against the pull of gravity wells.
 *
 * When flying on would meet a drifting asteroid it slows, stopping if it must, so the asteroid passes
 * ahead of it (`asteroid-wait.ts`); that wait never counts toward being stuck.
 *
 * It dashes when its dash is ready, it has a charge to spend (keeping one back for a latch as swim
 * does), the skill roll passes, it is moving within about 37 degrees of its aim and the way runs
 * straight for DASH_STRAIGHT_TILES. Below STUCK_SPEED for STUCK_TICKS racing ticks, or on
 * `forceRecover`, it pushes sideways to its aim for RECOVER_TICKS; a stunned or trapped rival
 * resets the count. In a dark zone it can't see in it wobbles twice as far and reacts half as often.
 *
 * It reads only the draws it is handed, never the rng.
 */
import { breaksCoralOnContact, racerSeesInDark } from '../../abilities.ts';
import { avoidHazards } from '../../ai/avoid.ts';
import { playerHasLanternLight } from '../../difficulty-level.ts';
import { inDark } from '../../level/query.ts';
import { cos, length, sin } from '../../num.ts';
import { canDash, dashCharges } from '../../powerups/dash-meter.ts';
import { holds } from '../../powerups/inventory.ts';
import { CORAL_BREAKERS } from '../../powerups/tuning.ts';
import type { MoveModifiers, Racer, Vec, World } from '../../types.ts';
import type { AiDraws, Steering } from '../types.ts';
import { asteroidPace } from './asteroid-wait.ts';
import { wayRunsStraight } from './lookahead.ts';
import { brakeStick, stickToward, unitOr, wantedVelocity } from './thrust-plan.ts';
import { type DriftRoute, driftRouteAim } from './way.ts';
import { type DriftPilot, driftPilot } from './way-data.ts';

/** How much looser a rival steers in a dark zone it can't see in: wobble bound and reaction time multipliers. */
const DARK_STEERING = { wobbleMul: 2, reactionMul: 2 } as const;
/** Tiles down the field a rival aims at. */
const LOOKAHEAD_TILES = 3;
/** Largest change in wobble per tick, as a fraction of the profile's wobble bound. */
const WOBBLE_STEP = 0.15;
/** Dash only when moving within about 37 degrees of the aim. */
const DASH_ALIGNMENT = 0.8;
/** Tiles the way must run straight ahead for a dash. */
const DASH_STRAIGHT_TILES = 6;
/** Dash charges a rival keeps back for shaking off a latch. */
const DASH_RESERVE = 1;
/** Places behind the leader past which a rival stops keeping a reserve and dashes everything. */
const RESERVE_WAIVED_BEHIND = 2;
/** Below this speed in px/s a racing rival counts as stuck. */
const STUCK_SPEED = 8;
const STUCK_TICKS = 30;
const RECOVER_TICKS = 20;

/** A drift rival's pilot memory at the start line. */
export function createDriftPilot(): DriftPilot {
  return {
    kind: 'drift',
    aim: { x: 0, y: 0 },
    replanIn: 0,
    wobble: 0,
    stuckTicks: 0,
    recoverTicks: 0,
    recoverDir: { x: 0, y: 0 },
  };
}

/**
 * A drift rival's steering this tick. Mutates only its pilot memory. `forceRecover` starts a stuck
 * recovery now unless one is already running.
 *
 * @throws {Error} When `racer.ai` is null (a human drives it), or its memory or the world's nav isn't
 *   drift's, or the world's tuning lacks one of drift's extras.
 */
export function steerDrifter(
  world: World,
  racer: Racer,
  mods: MoveModifiers,
  draws: AiDraws,
  forceRecover: boolean,
): Steering {
  const ai = racer.ai;
  if (!ai) throw new Error(`drift.steer needs AI memory, but racer '${racer.id}' has none (a human drives it)`);
  const memory = driftPilot(ai.pilot);
  const blind = inDark(world.level, racer.body) && !racerSeesInDark(racer) && !playerHasLanternLight(world, racer);
  const route = routeFor(racer);
  replanAim(world, racer, memory, route, blind ? DARK_STEERING.reactionMul : 1);
  stepWobble(memory, racer.profile.wobble * (blind ? DARK_STEERING.wobbleMul : 1), draws.wobble);
  const wobbled = wobbledAim(memory);
  const aim = avoidHazards(world, racer, wobbled);
  // avoidHazards hands back the same object when nothing is in the way.
  const swerving = aim !== wobbled;
  const wanted = wantedVelocity(world, racer, aim, mods, route);
  const pace = asteroidPace(world, racer, wanted);
  // Holding back for an asteroid is slow on purpose, like a stun, so it restarts the stuck count
  // instead of ending in a sideways shove along the asteroid's track.
  if (pace < 1) memory.stuckTicks = 0;
  const recovery =
    pace === 1 && canRecover(world, racer, memory) ? recoveryMove(racer, memory, draws.side, forceRecover) : null;
  if (recovery) return { move: recovery, kick: false, kickHeld: false, aim, recovering: true };
  if (pace < 1) return slowedSteering(world, racer, wanted, pace, aim, mods);
  // A swerving rival holds its dash, which would carry it on toward the hazard.
  const kick = !swerving && wantsDash(world, racer, aim, draws.kick);
  // A dash fires along the stick, so on its tick the stick points where it wants to go.
  const move = kick ? unitOr(wanted, aim) : stickToward(world, racer, wanted, aim, mods);
  return { move, kick, kickHeld: kick, aim, recovering: false };
}

/**
 * Steering that slows a rival to `pace` of `wanted` for an asteroid, or holds it still at pace 0,
 * with no dash, which would carry it into the asteroid.
 */
function slowedSteering(
  world: World,
  racer: Racer,
  wanted: Vec,
  pace: number,
  aim: Vec,
  mods: MoveModifiers,
): Steering {
  const move =
    pace === 0
      ? brakeStick(world, racer, mods)
      : stickToward(world, racer, { x: wanted.x * pace, y: wanted.y * pace }, aim, mods);
  return { move, kick: false, kickHeld: false, aim, recovering: false };
}

/** Re-reads the way along `route`'s field every `reactionTicks` (times `reactionMul`). */
function replanAim(world: World, racer: Racer, memory: DriftPilot, route: DriftRoute, reactionMul: number): void {
  if (memory.replanIn <= 0) {
    memory.aim = driftRouteAim(world, racer.body, LOOKAHEAD_TILES, route);
    memory.replanIn = racer.profile.reactionTicks * reactionMul;
  }
  memory.replanIn--;
}

/**
 * The field `racer` follows now: the ram field for a rival that rams ice; the smash field for one
 * that is inflated, or holds an ice breaker with its item use ready; the steer field for every other.
 */
function routeFor(racer: Racer): DriftRoute {
  if (breaksCoralOnContact(racer)) return 'ram';
  const holdsBreaker = CORAL_BREAKERS.some((kind) => holds(racer, kind));
  return racer.status.inflated > 0 || (holdsBreaker && racer.useCooldown === 0) ? 'smash' : 'steer';
}

/** One step of the bounded random walk on the steering angle. */
function stepWobble(memory: DriftPilot, bound: number, draw: number): void {
  const step = (draw * 2 - 1) * bound * WOBBLE_STEP;
  memory.wobble = Math.max(-bound, Math.min(bound, memory.wobble + step));
}

function wobbledAim(memory: DriftPilot): Vec {
  const c = cos(memory.wobble);
  const s = sin(memory.wobble);
  return { x: memory.aim.x * c - memory.aim.y * s, y: memory.aim.x * s + memory.aim.y * c };
}

/**
 * Stuck recovery runs only while racing and free to fly. A stunned or trapped rival sits still
 * through no fault of its steering, so that time resets its stuck count instead.
 */
function canRecover(world: World, racer: Racer, memory: DriftPilot): boolean {
  if (world.race.phase !== 'racing') return false;
  if (racer.status.stunned > 0 || racer.status.trapped > 0) {
    memory.stuckTicks = 0;
    return false;
  }
  return true;
}

/**
 * The sideways push of a racer that has sat nearly still too long (or that `forceRecover` sends),
 * held for RECOVER_TICKS to slide off whatever it is pinned against; null while it isn't recovering.
 */
function recoveryMove(racer: Racer, memory: DriftPilot, sideDraw: number, forceRecover: boolean): Vec | null {
  if (memory.recoverTicks === 0) {
    const speed = length(racer.body.vx, racer.body.vy);
    memory.stuckTicks = speed < STUCK_SPEED ? memory.stuckTicks + 1 : 0;
    if (memory.stuckTicks < STUCK_TICKS && !forceRecover) return null;
    memory.stuckTicks = 0;
    memory.recoverTicks = RECOVER_TICKS;
    memory.recoverDir = sidewaysFrom(memory.aim, racer.facing, sideDraw < 0.5 ? 1 : -1);
  }
  memory.recoverTicks--;
  return { ...memory.recoverDir };
}

/** Perpendicular to the aim on the given side; to the facing when there is no aim yet. */
function sidewaysFrom(aim: Vec, facing: 1 | -1, side: 1 | -1): Vec {
  const forward = aim.x === 0 && aim.y === 0 ? { x: facing, y: 0 } : aim;
  return { x: -forward.y * side, y: forward.x * side };
}

/**
 * Whether it has a dash charge to spend now. It keeps DASH_RESERVE charges back for shaking off a
 * latch unless it is latched already or trails the leader by more than RESERVE_WAIVED_BEHIND places.
 */
function hasDashToSpend(racer: Racer): boolean {
  if (!canDash(racer)) return false;
  if (racer.status.latched > 0 || racer.place - 1 > RESERVE_WAIVED_BEHIND) return true;
  return dashCharges(racer) > DASH_RESERVE;
}

/** Dashes when ready, moving roughly along its aim, the way runs straight ahead and the skill roll passes. */
function wantsDash(world: World, racer: Racer, aim: Vec, roll: number): boolean {
  if (racer.kickCooldown > 0 || !hasDashToSpend(racer) || roll >= racer.profile.kickSkill) return false;
  const { vx, vy } = racer.body;
  const speed = length(vx, vy);
  if (speed === 0 || (aim.x * vx + aim.y * vy) / speed <= DASH_ALIGNMENT) return false;
  return wayRunsStraight(world, racer.body, aim, DASH_STRAIGHT_TILES);
}
