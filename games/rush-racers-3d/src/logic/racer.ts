/**
 * One racer's movement for one tick: running, braking, steering, jumping, dashing, the dash meter,
 * the course's features (hills, pits, mud, gusts, logs), falling and respawning, and the finish
 * line. Emits the racer's own events. Knows nothing about other racers or the race phase.
 */
import type { EventSink } from '@arcade/core';
import { groundY, type LogFeature, logAt, pitAt, surfaceAt } from './course.ts';
import type { GameEvent } from './events.ts';
import { DASH, RUN } from './tuning.ts';
import type { Course, Racer, TickInput } from './types.ts';

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

/** What `stepRacer` needs besides the racer: the course, the events sink, and race ticks so far (for `finishTicks`). */
export interface RacerContext {
  course: Course;
  events: EventSink<GameEvent>;
  raceTicks: number;
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
  if (input.jumpPressed) racer.bufferTicks = RUN.bufferTicks;
  if (racer.bufferTicks > 0 && (racer.grounded || racer.coyoteTicks > 0)) jump(racer, ctx);
  racer.coyoteTicks = Math.max(0, racer.coyoteTicks - 1);

  const { course } = ctx;
  const surface = surfaceAt(course, racer.s, racer.d);
  const inMud = surface.kind === 'mud' && isOnGround(racer, groundY(course, racer.s));
  run(racer, input, ctx, inMud, dt);
  const steer = Math.max(-1, Math.min(1, input.steer)) * RUN.steerSpeed;
  const steerStep = RUN.steerAccel * dt;
  racer.vd += Math.max(-steerStep, Math.min(steerStep, steer - racer.vd));

  move(racer, ctx, surface.push, input.jumpHeld, dt);
  if (racer.state !== 'racing') return;
  const mudSpeed = RUN.runSpeed * RUN.mudSpeedMul;
  if (
    racer.vs > mudSpeed &&
    racer.vs <= RUN.runSpeed &&
    isOnGround(racer, groundY(course, racer.s)) &&
    surfaceAt(course, racer.s, racer.d).kind === 'mud'
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
    ctx.events.emit({ type: 'racer.finished', id: racer.id, ticks: ctx.raceTicks });
  }
}

function rechargeDash(racer: Racer, ctx: RacerContext): void {
  if (racer.dashRecharge > 0 && --racer.dashRecharge === 0) {
    racer.dashCharges++;
    if (racer.dashCharges < DASH.charges) racer.dashRecharge = DASH.rechargeTicks;
    ctx.events.emit({ type: 'racer.dashRecharged', id: racer.id, charges: racer.dashCharges });
  }
}

function run(racer: Racer, input: TickInput, ctx: RacerContext, mud: boolean, dt: number): void {
  racer.dashTicks = Math.max(0, racer.dashTicks - 1);
  if (input.dashPressed && racer.dashCharges > 0) {
    racer.dashCharges--;
    if (racer.dashRecharge === 0) racer.dashRecharge = DASH.rechargeTicks;
    racer.dashTicks = DASH.burstTicks;
    racer.vs = Math.max(racer.vs, DASH.speed);
    ctx.events.emit({ type: 'racer.dashed', id: racer.id, charges: racer.dashCharges });
    return;
  }
  if (input.brake) racer.vs = Math.max(0, racer.vs - RUN.brake * dt);
  else if (racer.vs > RUN.runSpeed) racer.vs = Math.max(RUN.runSpeed, racer.vs - DASH.drag * dt);
  else if (!input.forward) racer.vs = Math.max(0, racer.vs - RUN.friction * dt);
  else racer.vs = Math.min(RUN.runSpeed * (mud ? RUN.mudSpeedMul : 1), racer.vs + RUN.accel * dt);
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

function resolveLogs(
  racer: Racer,
  { course, events }: RacerContext,
  s: number,
  d: number,
  y: number,
  followsGround: boolean,
): { s: number; d: number } {
  let from: Pick<Racer, 's' | 'd' | 'y'> = racer;
  // Each contact blocks one axis. Check for a second contact along the face of the first log.
  for (let contacts = 0; contacts < 2; contacts++) {
    const hit = logHit(from, course, s, d, y, followsGround);
    if (!hit) break;
    const contactS = hit.front ? hit.log.s : from.s + (s - from.s) * hit.time;
    const contactD = hit.front ? from.d + (d - from.d) * hit.time : hit.side;
    if (hit.front) {
      s = contactS;
      racer.vs = 0;
    } else {
      d = contactD;
      racer.vd = 0;
    }
    if (hit.time > 0) events.emit({ type: 'racer.bumped', id: racer.id, s: contactS });
    from = { s: contactS, d: contactD, y: from.y + (y - from.y) * hit.time };
  }
  return { s, d };
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

function topOf(course: Course, log: LogFeature): number {
  return groundY(course, log.s) + log.height;
}

type LogHit = { log: LogFeature; front: boolean; side: number; time: number };

/** The first log face crossed while the racer's feet are below its top. */
function logHit(
  racer: Pick<Racer, 's' | 'd' | 'y'>,
  course: Course,
  s: number,
  d: number,
  y: number,
  followsGround: boolean,
): LogHit | undefined {
  const ds = s - racer.s;
  const dd = d - racer.d;
  let hit: LogHit | undefined;
  for (const log of course.features) {
    if (log.kind !== 'log' || s < log.s || racer.s >= log.s + RUN.logDepth) continue;
    const frontTime = ds > 0 ? (log.s - racer.s) / ds : -Infinity;
    const side = dd > 0 ? log.d0 : log.d1;
    const sideTime = dd !== 0 ? (side - racer.d) / dd : -Infinity;
    const time = Math.max(frontTime, sideTime);
    if (time < 0 || time > 1 || (hit && hit.time <= time)) continue;
    const contactS = racer.s + ds * time;
    const contactD = racer.d + dd * time;
    const front = frontTime >= sideTime;
    if (front && (contactD < log.d0 || contactD >= log.d1)) continue;
    if (!front && (contactS <= log.s || contactS >= log.s + RUN.logDepth)) continue;
    const height = followsGround ? groundY(course, contactS) : racer.y + (y - racer.y) * time;
    if (height < topOf(course, log)) hit = { log, front, side, time };
  }
  return hit;
}

function fall(racer: Racer, ctx: RacerContext): void {
  racer.state = 'fallen';
  racer.outTicks = RUN.respawnTicks;
  racer.dashTicks = 0;
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
