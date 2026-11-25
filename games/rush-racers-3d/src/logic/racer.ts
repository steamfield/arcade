/**
 * One racer's movement for one tick: running, braking, steering, jumping, dashing, the dash meter,
 * the course's features (hills, pits, mud, gusts, logs), falling and respawning, and the finish
 * line. Emits the racer's own events except `racer.finished`, which `stepWorld` emits because only it
 * knows the standings. Knows nothing about other racers or the race phase.
 */
import type { EventSink } from '@arcade/core';
import { groundY, logAt, pitAt, surfaceAt } from './course.ts';
import type { GameEvent } from './events.ts';
import { resolveLogs, topOf } from './logs.ts';
import { bootsSpeedFloor, isImmobilized, onSplatMud } from './status.ts';
import { DASH, RUN } from './tuning.ts';
import type { Course, Racer, Splat, TickInput } from './types.ts';

/** Controls that do nothing, for racers with no input this tick. */
export const NO_INPUT: TickInput = {
  forward: false,
  brake: false,
  steer: 0,
  jumpPressed: false,
  jumpHeld: false,
  dashPressed: false,
  firePressed: false,
  nextPressed: false,
  prevPressed: false,
};

/**
 * What `stepRacer` needs besides the racer: the course, the events sink, race ticks so far (for
 * `finishTicks`), and `speedMul`, which scales this racer's top run speed (1 for the player).
 */
export interface RacerContext {
  course: Course;
  events: EventSink<GameEvent>;
  raceTicks: number;
  speedMul: number;
  /** Active Mud Pie patches to check alongside course mud. */
  splats: readonly Splat[];
}

/** Stops horizontal motion and cancels the dash and buffered jump. Gravity still acts. */
export function stopRacer(racer: Racer): void {
  racer.vs = 0;
  racer.vd = 0;
  racer.bufferTicks = 0;
}

/** Advances `racer` by one tick of `input` while the race is running. A finished racer is left alone. */
export function stepRacer(racer: Racer, input: TickInput, ctx: RacerContext, dt: number): void {
  if (racer.state === 'finished') return;
  rechargeDash(racer, ctx);
  if (racer.state === 'fallen') {
    if (--racer.outTicks === 0) respawn(racer, ctx);
    return;
  }

  racer.invulnTicks = Math.max(0, racer.invulnTicks - 1);
  // Items age after movement, so the last tick of stun or sap still blocks horizontal movement.
  if (isImmobilized(racer)) {
    stopRacer(racer);
    racer.coyoteTicks = Math.max(0, racer.coyoteTicks - 1);
    move(racer, ctx, 0, false, dt);
    return;
  }
  if (input.jumpPressed) racer.bufferTicks = RUN.bufferTicks;
  if (racer.bufferTicks > 0 && (racer.grounded || racer.coyoteTicks > 0)) jump(racer, ctx);
  racer.coyoteTicks = Math.max(0, racer.coyoteTicks - 1);

  const { course } = ctx;
  const surface = surfaceAt(course, racer.s, racer.d);
  const inMud = onMud(course, racer, ctx.splats, surface.kind);
  const top = RUN.runSpeed * ctx.speedMul;
  run(racer, input, ctx, top, inMud, dt);
  const steer = Math.max(-1, Math.min(1, input.steer)) * RUN.steerSpeed;
  const steerStep = RUN.steerAccel * dt;
  racer.vd += Math.max(-steerStep, Math.min(steerStep, steer - racer.vd));

  move(racer, ctx, surface.push, input.jumpHeld, dt);
  if (racer.state !== 'racing') return;
  const mudSpeed = top * RUN.mudSpeedMul;
  if (
    racer.vs > mudSpeed &&
    racer.vs <= top &&
    onMud(course, racer, ctx.splats, surfaceAt(course, racer.s, racer.d).kind)
  ) {
    racer.vs = mudSpeed;
  }
  if (racer.grounded && racer.bufferTicks > 0) jump(racer, ctx);
  if (!input.jumpPressed) racer.bufferTicks = Math.max(0, racer.bufferTicks - 1);
  if (racer.s >= course.finishS) {
    racer.state = 'finished';
    racer.finishTicks = ctx.raceTicks;
    racer.y = groundY(course, racer.s);
    racer.grounded = true;
    racer.vs = 0;
    racer.vd = 0;
    racer.vy = 0;
  }
}

function onMud(
  course: Course,
  racer: Racer,
  splats: readonly Splat[],
  surface: ReturnType<typeof surfaceAt>['kind'],
): boolean {
  return (
    isOnGround(racer, groundY(course, racer.s)) &&
    (surface === 'mud' || (surface === 'ground' && onSplatMud(splats, racer)))
  );
}

function rechargeDash(racer: Racer, ctx: RacerContext): void {
  if (racer.dashRecharge > 0 && --racer.dashRecharge === 0) {
    racer.dashCharges++;
    if (racer.dashCharges < DASH.charges) racer.dashRecharge = DASH.rechargeTicks;
    ctx.events.emit({ type: 'racer.dashRecharged', id: racer.id, charges: racer.dashCharges });
  }
}

function run(racer: Racer, input: TickInput, ctx: RacerContext, top: number, mud: boolean, dt: number): void {
  if (input.dashPressed && racer.dashCharges > 0) {
    racer.dashCharges--;
    if (racer.dashRecharge === 0) racer.dashRecharge = DASH.rechargeTicks;
    racer.vs = Math.max(racer.vs, DASH.speed, bootsSpeedFloor(racer));
    ctx.events.emit({ type: 'racer.dashed', id: racer.id, charges: racer.dashCharges });
    return;
  }
  if (input.brake) racer.vs = Math.max(0, racer.vs - RUN.brake * dt);
  else if (racer.vs > top) racer.vs = Math.max(top, racer.vs - DASH.drag * dt);
  else if (!input.forward) racer.vs = Math.max(0, racer.vs - RUN.friction * dt);
  else racer.vs = Math.min(top * (mud ? RUN.mudSpeedMul : 1), racer.vs + RUN.accel * dt);
  racer.vs = Math.max(racer.vs, bootsSpeedFloor(racer));
}

function jump(racer: Racer, ctx: RacerContext): void {
  racer.vy = RUN.jumpSpeed;
  racer.grounded = false;
  racer.coyoteTicks = 0;
  racer.bufferTicks = 0;
  ctx.events.emit({ type: 'racer.jumped', id: racer.id });
}

function move(racer: Racer, ctx: RacerContext, push: number, jumpHeld: boolean, dt: number): void {
  const { course } = ctx;
  const ground = groundY(course, racer.s);
  const gravity = RUN.gravity * (racer.vy > 0 && !jumpHeld ? RUN.cutGravityMul : 1);
  const vy = Math.max(-RUN.maxFall, racer.vy - gravity * dt);
  const y = racer.y + vy * dt;
  const edge = Math.max(0, course.halfWidth - RUN.radius);
  const rawD = racer.d + (racer.vd + push) * dt;
  const targetD = Math.max(-edge, Math.min(edge, rawD));
  const targetS = Math.min(course.finishS, racer.s + racer.vs * dt);
  const blocked = resolveLogs(racer, ctx, targetS, targetD, y, isOnGround(racer, ground));
  if (Math.abs(blocked.d) === edge && blocked.d * racer.vd >= 0) racer.vd = 0;

  const { s, d, pit, support, grounded, onLog } = resolveSupport(racer, course, blocked, y, ground);
  racer.s = s;
  racer.d = d;
  racer.y = grounded ? support : y;
  racer.vy = grounded ? 0 : vy;
  if (grounded && !racer.grounded) ctx.events.emit({ type: 'racer.landed', id: racer.id });
  if (!grounded && racer.grounded) racer.coyoteTicks = RUN.coyoteTicks;
  racer.grounded = grounded;

  updateSafeSpot(racer, course, onLog);
  if (pit && y <= support - RUN.fallDepth) fall(racer, ctx);
}

function isOnGround(racer: Racer, ground: number): boolean {
  return racer.grounded && racer.y === ground;
}

function resolveSupport(
  racer: Racer,
  course: Course,
  { s, d }: { s: number; d: number },
  y: number,
  ground: number,
): { s: number; d: number; pit: ReturnType<typeof pitAt>; support: number; grounded: boolean; onLog: boolean } {
  const nextGround = groundY(course, s);
  const fromPit = pitAt(course, racer.s, racer.d);
  const pit = pitAt(course, s, d);
  // The pit wall holds a racer below the rim in the gap until they fall or jump high enough.
  if (fromPit && !pit && Math.max(racer.y, y) < nextGround) {
    return { s: racer.s, d: racer.d, pit: fromPit, support: ground, grounded: false, onLog: false };
  }
  if (pit) return { s, d, pit, support: nextGround, grounded: false, onLog: false };
  const log = logAt(course, s, d);
  const logTop = log ? topOf(course, log) : -Infinity;
  const onLog = logTop > nextGround && racer.y >= logTop;
  const support = onLog ? logTop : nextGround;
  const aboveSupport = racer.y >= (onLog || fromPit ? support : ground);
  const grounded = (isOnGround(racer, ground) && !onLog) || (aboveSupport && y <= support);
  return { s, d, pit, support, grounded, onLog };
}

function updateSafeSpot(racer: Racer, course: Course, onLog: boolean): void {
  const { s, d, grounded } = racer;
  if (
    grounded &&
    !onLog &&
    !course.features.some(
      (feature) =>
        feature.kind === 'pit' &&
        feature.s0 <= s + RUN.respawnBackoff &&
        s < feature.s1 &&
        feature.d0 <= d &&
        d < feature.d1,
    )
  ) {
    racer.safeS = s;
    racer.safeD = d;
  }
}

function fall(racer: Racer, ctx: RacerContext): void {
  racer.state = 'fallen';
  racer.outTicks = RUN.respawnTicks;
  racer.coyoteTicks = 0;
  racer.bufferTicks = 0;
  racer.vs = 0;
  racer.vd = 0;
  racer.vy = 0;
  ctx.events.emit({ type: 'racer.fell', id: racer.id, s: racer.s });
}

function respawn(racer: Racer, ctx: RacerContext): void {
  racer.state = 'racing';
  racer.s = racer.safeS;
  racer.d = racer.safeD;
  racer.y = groundY(ctx.course, racer.s);
  racer.grounded = true;
  racer.invulnTicks = RUN.invulnTicks;
  ctx.events.emit({ type: 'racer.respawned', id: racer.id, s: racer.s, d: racer.d });
}
