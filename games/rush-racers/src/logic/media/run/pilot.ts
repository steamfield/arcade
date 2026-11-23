/**
 * Run's rival pilot: it follows the best link out of the stand tile it is on. It runs toward a walk
 * or a drop, starts a jump at the link's take-off with Up held for the link's hold ticks, steers in
 * the air toward the tile it means to land on (or back from a pit its speed would carry it into),
 * lets go of Up before it lands, and plans again from where it stands. It dashes on flat ground,
 * hops over a slower racer it would otherwise push into, and a loose (high-wobble) profile now and
 * then lets go of the stick on flat ground. When the generic backstop sends `forceRecover`, it
 * backs off from the finish, then jumps toward it.
 */
import { TICK_DT } from '@arcade/core';
import { isLedge, isSolid } from '../../level/query.ts';
import { canDash } from '../../powerups/dash-meter.ts';
import { isDowned } from '../../status.ts';
import { type MoveModifiers, type Racer, TILE, type Vec, type World } from '../../types.ts';
import { effectiveTuning } from '../index.ts';
import type { AiDraws, Steering } from '../types.ts';
import { runMotion } from './data.ts';
import { sampleRunEnvironment } from './env.ts';
import { type AirRules, type Flying, feetOnRow, landingX } from './landing.ts';
import { HOP_HOLD_TICKS } from './nav.ts';
import { runExtra } from './physics.ts';
import { runAimFrom } from './way.ts';
import { type RunLink, type RunNav, type RunPilot, runNav, runPilot } from './way-data.ts';

/** Ticks a forced recovery lasts: it backs off first, then jumps for its last RECOVER_JUMP_TICKS. */
const RECOVER_TICKS = 30;
/** Ticks at the end of a recovery spent jumping toward the finish with Up held. */
const RECOVER_JUMP_TICKS = 18;
/** How far short of a link's take-off point, px, a runner may start the jump. */
const TAKEOFF_SLACK_PX = 2;
/** In the air, a runner within this many px of the middle of its landing tile stops steering. */
const LANDING_DEADBAND_PX = 3;
/** Tiles of flat, open ground ahead a rival wants before it dashes. */
const DASH_CLEAR_TILES = 3;
/** How much faster, px/s, a runner must be closing on a racer ahead before it hops it rather than following. */
const HOP_CLOSING_SPEED = 15;
/** How close ahead, px between the two racers' facing edges, a racer has to be before a runner hops it. */
const HOP_REACH_PX = 10;
/**
 * Chance per tick, per unit of profile wobble, that a runner on flat ground lets go of the stick:
 * loose steering on land, where a direction is all the stick sets. The novice's 0.5 lets go on 30 %
 * of those ticks; the expert's 0.04 on about 2 %.
 */
const HESITATE_PER_WOBBLE = 0.6;
/**
 * The most often a runner lets go of the stick, per tick. Past about 44 % ground friction (900)
 * outweighs running acceleration (700) and a runner could never get back up to pace, so the
 * toddler's wobble of 1 is held here: loose, not stopped.
 */
const HESITATE_MAX = 0.35;
/** Walk links after the current one that must follow before a runner may hesitate: room to get back up to speed. */
const HESITATE_CLEAR_LINKS = 2;

/** The tile column under a runner's centre and the row its feet are in. */
interface Footing {
  col: number;
  row: number;
}

/** A run rival's pilot memory at the start line. */
export function createRunPilot(): RunPilot {
  return {
    kind: 'run',
    holdUpTicks: 0,
    upHeld: false,
    inFlight: false,
    planTile: null,
    landingTile: null,
    recoverTicks: 0,
    recoverDir: 1,
  };
}

/**
 * A run rival's steering this tick. Mutates only its pilot memory.
 *
 * @throws {Error} When `racer.ai` is null (a human drives it), or its memory, motion or the world's nav isn't run's.
 */
export function steerRunner(
  world: World,
  racer: Racer,
  mods: MoveModifiers,
  draws: AiDraws,
  forceRecover: boolean,
): Steering {
  const ai = racer.ai;
  if (!ai) throw new Error(`run.steer needs AI memory, but racer '${racer.id}' has none (a human drives it)`);
  const memory = runPilot(ai.pilot);
  const grounded = runMotion(racer.motion).grounded;
  if (grounded && memory.inFlight) startOver(memory);
  memory.inFlight = !grounded;

  const aim = runAimFrom(world, racer.body, 1);
  const heading = aim.x === 0 ? racer.facing : aim.x < 0 ? -1 : 1;
  if (forceRecover && memory.recoverTicks === 0) {
    memory.recoverTicks = RECOVER_TICKS;
    memory.recoverDir = heading;
    memory.holdUpTicks = 0;
  }
  if (memory.recoverTicks > 0) {
    return { move: recoveryMove(memory, grounded), kick: false, kickHeld: false, aim, recovering: true };
  }

  const nav = runNav(world.nav);
  const stand = grounded ? followedStand(nav, racer, memory) : null;
  const link = stand === null ? null : (nav.best[stand] ?? null);
  if (grounded) memory.landingTile = link?.to ?? null;
  if (stand !== null && link?.kind === 'jump' && canPress(memory) && atTakeOff(nav, racer, stand, link)) {
    memory.holdUpTicks = link.holdTicks;
  } else if (link?.kind === 'walk' && canPress(memory) && wantsHop(world, nav, racer, link.dir)) {
    memory.holdUpTicks = HOP_HOLD_TICKS;
    memory.landingTile = null;
  }
  const up = memory.holdUpTicks > 0;
  if (up) memory.holdUpTicks--;
  memory.upHeld = up;
  const hesitates = grounded && !up && link !== null && hesitatesOn(nav, link, racer, draws.wobble);
  const x = hesitates ? 0 : grounded ? (link?.dir ?? heading) : airSteer(world, nav, racer, memory, mods, heading);
  const kick = grounded && !up && link?.kind === 'walk' && wantsDash(world, racer, link.dir, draws.kick);
  return { move: { x, y: up ? -1 : 0 }, kick, kickHeld: kick, aim, recovering: false };
}

/**
 * One tick of a forced recovery: away from the finish first, then toward it with Up held. The jump
 * waits for the runner to stand, so a recovery that starts in the air doesn't spend its press where
 * no jump can fire.
 */
function recoveryMove(memory: RunPilot, grounded: boolean): Vec {
  const jumpPhase = memory.recoverTicks <= RECOVER_JUMP_TICKS;
  if (jumpPhase && !memory.upHeld && !grounded) return { x: memory.recoverDir, y: 0 };
  memory.recoverTicks--;
  memory.upHeld = jumpPhase;
  return jumpPhase ? { x: memory.recoverDir, y: -1 } : { x: -memory.recoverDir, y: 0 };
}

/** Where a runner stands, in tiles. */
function footingOf(racer: Racer): Footing {
  const { body } = racer;
  return { col: Math.floor((body.x + body.w / 2) / TILE), row: Math.floor((body.y + body.h - 1) / TILE) };
}

/** Forgets the plan and any Up still to hold: the runner has landed and plans again from where it stands. */
function startOver(memory: RunPilot): void {
  memory.holdUpTicks = 0;
  memory.planTile = null;
}

/** True when a new jump can start: no Up left to hold, and Up was let go of last tick. */
function canPress(memory: RunPilot): boolean {
  return memory.holdUpTicks === 0 && !memory.upHeld;
}

/**
 * The stand tile whose best link a grounded runner follows. On a stand tile that is the tile itself;
 * once the runner's middle is past an edge the plan it made on the tile it left stays, so a runner
 * running off the edge still takes the jump or drop planned there. With no plan (it just landed on a
 * corner), the stand tile its tile reads.
 */
function followedStand(nav: RunNav, racer: Racer, memory: RunPilot): number | null {
  const { col, row } = footingOf(racer);
  const tile = row * nav.width + col;
  const anchor = nav.anchor[tile] ?? -1;
  if (anchor === tile) memory.planTile = tile;
  else if (memory.planTile === null && anchor >= 0) memory.planTile = anchor;
  return memory.planTile;
}

/** True when the runner has run up to where its jump link takes off, or past it: the middle of the stand tile, or its far edge for a jump over a gap. */
function atTakeOff(nav: RunNav, racer: Racer, stand: number, link: RunLink): boolean {
  const toEdge = link.takeOffAtEdge ? (link.dir * TILE) / 2 : 0;
  const takeOffX = ((stand % nav.width) + 0.5) * TILE + toEdge;
  const centreX = racer.body.x + racer.body.w / 2;
  return (centreX - takeOffX) * link.dir >= -TAKEOFF_SLACK_PX;
}

/**
 * Horizontal stick in the air. With no landing planned, toward the finish. Otherwise it judges each
 * stick by where holding it the rest of the flight brings it down on the landing's row (`landingX`:
 * the physics' own steps, with the wind and drafts along the way). Links are planned at
 * `plannedSpeed`, so a runner that took off faster, out of a dash, a tailwind or at a quicker pace,
 * flies past the tile it meant to land on. In order, it:
 *
 * - flies on when that comes down on ground past the tile;
 * - else steers toward the tile's middle (stopping over it) when that comes down on ground, or
 *   short of the tile, where no other stick reaches further;
 * - else, carried past the tile toward a pit or a wall, lets go or steers back, whichever comes
 *   down on ground, or failing both whichever comes down nearest the tile.
 *
 * A stick judged this way still comes down where it was judged to a tick later, since holding it
 * is what the physics then does, so the choice doesn't flip back and forth.
 */
function airSteer(
  world: World,
  nav: RunNav,
  racer: Racer,
  memory: RunPilot,
  mods: MoveModifiers,
  heading: -1 | 1,
): number {
  const { landingTile } = memory;
  if (landingTile === null) return heading;
  const { body } = racer;
  const landingCentre = ((landingTile % nav.width) + 0.5) * TILE;
  const offset = landingCentre - (body.x + body.w / 2);
  const towardMiddle = Math.abs(offset) <= LANDING_DEADBAND_PX ? 0 : Math.sign(offset);
  const row = Math.floor(landingTile / nav.width);
  const flying = flyingOf(racer, memory, mods);
  const rules = airRulesFor(world, racer);
  const comesDownAt = (stick: number) => landingX(flying, stick, feetOnRow(row), rules);
  const onGround = (x: number | null) => x !== null && standsOver(nav, x, body.w, row);
  const flyOn = Math.sign(body.vx);
  const flownOn = flyOn === 0 ? null : comesDownAt(flyOn);
  if (flownOn !== null && onGround(flownOn) && Math.sign(flownOn - landingCentre) === flyOn) return flyOn;
  const preferred = towardMiddle === flyOn ? flownOn : comesDownAt(towardMiddle);
  if (preferred === null || onGround(preferred)) return towardMiddle;
  const past = Math.sign(preferred - landingCentre);
  if (past === 0 || past !== flyOn) return towardMiddle;
  let nearest = towardMiddle;
  let nearestMiss = Math.abs(preferred - landingCentre);
  for (const stick of [0, -past]) {
    if (stick === towardMiddle) continue;
    const at = comesDownAt(stick);
    if (at === null) continue;
    if (onGround(at)) return stick;
    const miss = Math.abs(at - landingCentre);
    if (miss < nearestMiss) [nearest, nearestMiss] = [stick, miss];
  }
  return nearest;
}

/** How `racer` is flying this tick, for `landingX`. */
function flyingOf(racer: Racer, memory: RunPilot, mods: MoveModifiers): Flying {
  const motion = runMotion(racer.motion);
  const holdTicks = memory.upHeld ? memory.holdUpTicks + 1 : 0;
  return { body: racer.body, dashGlide: motion.dashGlide, jumping: motion.jumping, holdTicks, mods };
}

/**
 * The rules `racer`'s flight follows in `world`: the course's run tuning, and the surroundings
 * sampled as the medium samples the racer (wind cells, a Tailwind lane, mud) at each predicted spot.
 */
function airRulesFor(world: World, racer: Racer): AirRules {
  const tuning = effectiveTuning(world);
  const ghost: Racer = { ...racer };
  return {
    tuning,
    extra: runExtra(tuning),
    envAt: (body) => {
      ghost.body = body;
      return sampleRunEnvironment(world, ghost);
    },
  };
}

/** True when a box `width` px wide with its middle at x `middle` has stand tiles of row `row` under both edges. */
function standsOver(nav: RunNav, middle: number, width: number, row: number): boolean {
  return [middle - width / 2, middle + width / 2 - 1].every((x) => {
    const col = Math.floor(x / TILE);
    const tile = row * nav.width + col;
    return col >= 0 && col < nav.width && nav.anchor[tile] === tile;
  });
}

/**
 * Loose steering on land: true when the wobble roll lets go of the stick this tick, only while
 * `link` and the next HESITATE_CLEAR_LINKS links after it are walks, so a hesitation never costs
 * the run-up a planned jump needs.
 */
function hesitatesOn(nav: RunNav, link: RunLink, racer: Racer, roll: number): boolean {
  if (roll >= Math.min(HESITATE_MAX, racer.profile.wobble * HESITATE_PER_WOBBLE)) return false;
  let next: RunLink | null = link;
  for (let links = 0; links <= HESITATE_CLEAR_LINKS; links++) {
    if (next?.kind !== 'walk') return false;
    next = nav.best[next.to] ?? null;
  }
  return true;
}

/** Rock, coral or a ledge: something a runner can stand on. */
function isGround(world: World, col: number, row: number): boolean {
  return isSolid(world.level, world.broken, col, row) || isLedge(world.level, col, row);
}

/** Dashes when the dash is ready, it is already running toward `dir`, the ground ahead is flat, and the skill roll passes. */
function wantsDash(world: World, racer: Racer, dir: -1 | 1, roll: number): boolean {
  if (racer.kickCooldown > 0 || !canDash(racer)) return false;
  if (Math.sign(racer.body.vx) !== dir) return false;
  const at = footingOf(racer);
  for (let tiles = 1; tiles <= DASH_CLEAR_TILES; tiles++) {
    const col = at.col + dir * tiles;
    if (isSolid(world.level, world.broken, col, at.row) || !isGround(world, col, at.row + 1)) return false;
  }
  return roll < racer.profile.kickSkill;
}

/**
 * True when a slower racer on its feet is just ahead along `dir` and the ground is flat with open
 * air above out to where the hop comes down at the runner's speed (`nav.hopAirTicks`), its far
 * edge included: running on would only push into it (racers block each other sideways), so the
 * runner hops over, passing through it on the way down. Sized from speed because a runner in its
 * own dash hops nearly twice as far, and can't steer out of a pit once airborne.
 */
function wantsHop(world: World, nav: RunNav, racer: Racer, dir: -1 | 1): boolean {
  if (!blockedByRacer(world, racer, dir)) return false;
  const at = footingOf(racer);
  const { body } = racer;
  const reach = Math.abs(body.vx) * nav.hopAirTicks * TICK_DT + body.w / 2;
  const landingCol = Math.floor((body.x + body.w / 2 + dir * reach) / TILE);
  for (let tiles = 0; tiles <= Math.abs(landingCol - at.col); tiles++) {
    const col = at.col + dir * tiles;
    if (tiles > 0 && !isGround(world, col, at.row + 1)) return false;
    for (let up = 0; up <= 2; up++) if (isSolid(world.level, world.broken, col, at.row - up)) return false;
  }
  return true;
}

/**
 * True when another racer still racing is within HOP_REACH_PX ahead of `racer` along `dir`, at its
 * height, and at least HOP_CLOSING_SPEED slower along `dir`. Downed racers don't count: they pass through.
 */
function blockedByRacer(world: World, racer: Racer, dir: -1 | 1): boolean {
  const { body } = racer;
  return world.racers.some((other) => {
    if (other === racer || other.finished || isDowned(other)) return false;
    const gap = dir === 1 ? other.body.x - (body.x + body.w) : body.x - (other.body.x + other.body.w);
    const level = Math.abs(other.body.y - body.y) < body.h / 2;
    return (
      level && gap > -body.w / 2 && gap <= HOP_REACH_PX && other.body.vx * dir <= body.vx * dir - HOP_CLOSING_SPEED
    );
  });
}
