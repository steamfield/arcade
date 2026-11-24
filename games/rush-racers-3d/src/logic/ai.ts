/**
 * How a rival drives: one tick's `TickInput` from what a player could see, which is the course's
 * features ahead and the other racers' track positions. Noise comes from `world.rngState` only.
 */
import { createRng, TICK_DT } from '@arcade/core';
import { RIVAL_PROFILES } from './characters.ts';
import { groundY, surfaceAt } from './course.ts';
import { gridD } from './grid.ts';
import { canBeHit, isImmobilized } from './items/hits.ts';
import { heldSlot } from './items/inventory.ts';
import { NO_INPUT } from './racer.ts';
import { ITEMS, RIVAL, RUN } from './tuning.ts';
import type { ItemKind, Racer, Span, TickInput, World } from './types.ts';

type Obstacle = Span & { kind: 'pit' | 'mud' | 'log'; height: number };

const LANE_COST = { pit: 36, log: 16, mud: 10 };
const LANE_MARGIN = RUN.radius + 0.15;

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function covers({ d0, d1 }: Span, d: number, margin = 0): boolean {
  return d0 - margin < d && d < d1 + margin;
}

/**
 * The input `racer` (a rival) gives this tick. May advance `world.rngState` for its noise, and
 * changes nothing else.
 */
export function rivalInput(world: World, racer: Racer): TickInput {
  if (racer.state !== 'racing') return NO_INPUT;
  const { course } = world;
  const profile = RIVAL_PROFILES[racer.character];
  const rng = createRng(world.rngState);
  const wobble = (2 * rng.next() - 1) * profile.steerWobble;
  const jitter = rng.int(0, profile.jumpJitterTicks) * TICK_DT;
  world.rngState = rng.state();

  const obstacles: Obstacle[] = [];
  let dashClear = true;
  for (const feature of course.features) {
    if (feature.kind === 'crate' || feature.kind === 'gust') continue;
    const s0 = feature.kind === 'log' ? feature.s : feature.s0;
    const s1 = feature.kind === 'log' ? feature.s + RUN.logDepth : feature.s1;
    if (s1 <= racer.s) continue;
    if (feature.kind !== 'mud' && s0 - racer.s <= RIVAL.dashClearance) dashClear = false;
    if (s0 - racer.s <= RIVAL.lookAhead) {
      obstacles.push({
        kind: feature.kind,
        s0,
        s1,
        d0: feature.d0,
        d1: feature.d1,
        height: feature.kind === 'log' ? feature.height : 0,
      });
    }
  }

  const edge = Math.max(0, course.halfWidth - RUN.radius);
  const preferred = clamp(gridD(course, racer.id) + profile.lineBias, -edge, edge);
  const target = chooseLine(world, racer, obstacles, preferred, edge);
  const { push } = surfaceAt(course, racer.s, racer.d);
  const steer = clamp(((target - racer.d) * 3 - racer.vd * 0.35 - push) / RUN.steerSpeed + wobble, -1, 1);
  const jump = racer.grounded && obstacles.some((obstacle) => shouldJump(world, racer, obstacle, jitter));
  const item = itemInput(world, racer, dashClear);
  const usingBoots = racer.bootsTicks > 0 || (item.firePressed && racer.slots[racer.selected]?.kind === 'boots');

  return {
    ...NO_INPUT,
    ...item,
    forward: true,
    steer,
    jumpPressed: jump,
    jumpHeld: true,
    dashPressed:
      dashClear &&
      !usingBoots &&
      racer.grounded &&
      racer.dashCharges > 0 &&
      racer.vs >= RUN.runSpeed * profile.dashAtSpeed &&
      racer.vs <= RUN.runSpeed * (1 + RIVAL.catchUp),
  };
}

function itemInput(world: World, racer: Racer, dashClear: boolean): Partial<TickInput> {
  if (racer.itemCooldown > 1 || isImmobilized(racer)) return NO_INPUT;
  const selected = racer.slots[racer.selected];
  if (selected && shouldFire(world, racer, selected.kind, dashClear)) return { firePressed: true };

  const next = heldSlot(racer, 1);
  const prev = heldSlot(racer, -1);
  const nextItem = racer.slots[next];
  const prevItem = racer.slots[prev];
  if (next !== racer.selected && nextItem && shouldFire(world, racer, nextItem.kind, dashClear)) {
    return { nextPressed: true };
  }
  if (prev !== racer.selected && prev !== next && prevItem && shouldFire(world, racer, prevItem.kind, dashClear)) {
    return { prevPressed: true };
  }
  return NO_INPUT;
}

function shouldFire(world: World, racer: Racer, kind: ItemKind, dashClear: boolean): boolean {
  if (kind === 'boots') return dashClear && racer.bootsTicks <= 1;
  if (kind === 'burr' && racer.burrTicks > 1) return false;
  return world.racers.some((other) => {
    if (other === racer || other.state !== 'racing') return false;
    const ds = other.s - racer.s;
    const dd = other.d - racer.d;
    if (kind === 'burr') {
      const dy = other.y - racer.y;
      return canBeHit(other) && ds * ds + dd * dd + dy * dy <= RIVAL.burrRange * RIVAL.burrRange;
    }
    if (ds < RIVAL.throwMinRange) return false;
    if (kind === 'pie') {
      return ds <= RIVAL.pieRange && other.grounded && pieCanReach(world.course, racer, other, ds, dd);
    }
    const height = racer.y - groundY(world.course, racer.s);
    const otherHeight = other.y - groundY(world.course, other.s);
    const dy = otherHeight - height;
    const reachSq = RUN.radius * RUN.radius - dd * dd - dy * dy;
    const sapFlight = ITEMS.sapRange / ITEMS.sapSpeed;
    return (
      ds <= RIVAL.sapRange &&
      canBeHit(other) &&
      reachSq >= 0 &&
      ds <= (ITEMS.sapSpeed - other.vs) * sapFlight + Math.sqrt(reachSq)
    );
  });
}

/** Estimates a landing on level ground while the target keeps its current speed. */
function pieCanReach(course: World['course'], racer: Racer, target: Racer, ds: number, dd: number): boolean {
  const height = Math.max(0, racer.y + RUN.radius - groundY(course, racer.s));
  const lift = racer.vy + ITEMS.pieThrowUp;
  const flight = (lift + Math.sqrt(lift * lift + 2 * RUN.gravity * height)) / RUN.gravity;
  const gapAtLanding = ds + (target.vs - racer.vs - ITEMS.pieThrowSpeed) * flight;
  const sideAtLanding = dd + (target.vd - racer.vd) * flight;
  const halfLength = ITEMS.splatLength / 2;
  return (
    Math.abs(sideAtLanding) <= ITEMS.splatWidth / 2 &&
    gapAtLanding <= halfLength &&
    gapAtLanding + target.vs * ITEMS.splatTicks * TICK_DT >= -halfLength
  );
}

/** Try the usual line and the open sides of upcoming obstacles, favoring short lane changes. */
function chooseLine(world: World, racer: Racer, obstacles: Obstacle[], preferred: number, edge: number): number {
  const lines = [preferred, 0];
  for (const obstacle of obstacles) {
    // Give passing runners a choice of lines into a wide opening.
    for (const margin of [LANE_MARGIN, LANE_MARGIN + 2 * RUN.radius]) {
      if (obstacle.d0 - margin >= -edge) lines.push(obstacle.d0 - margin);
      if (obstacle.d1 + margin <= edge) lines.push(obstacle.d1 + margin);
    }
  }
  let target = preferred;
  let best = Infinity;
  for (const d of lines) {
    let cost = 0.6 * Math.abs(d - preferred) + 0.25 * Math.abs(d - racer.d);
    for (const obstacle of obstacles) {
      if (!covers(obstacle, d, LANE_MARGIN)) continue;
      const distance = Math.max(0, obstacle.s0 - racer.s);
      cost += LANE_COST[obstacle.kind] * (1 - distance / RIVAL.lookAhead);
    }
    for (const other of world.racers) {
      const gap = Math.abs(other.s - racer.s);
      if (other === racer || gap >= 5 || Math.abs(other.y - racer.y) >= 1) continue;
      cost += 2.5 * Math.max(0, 1.4 - Math.abs(other.d - d)) * (1 - gap / 5);
    }
    if (cost < best) {
      best = cost;
      target = d;
    }
  }
  return target;
}

function shouldJump({ course }: World, racer: Racer, obstacle: Obstacle, jitter: number): boolean {
  if (obstacle.kind === 'mud') return false;
  const distance = obstacle.s0 - racer.s;
  const speed = Math.max(racer.vs, 1);
  const projectedD = racer.d + racer.vd * clamp(distance / speed, 0, 0.25);
  if (!covers(obstacle, projectedD, 0.1)) return false;
  if (obstacle.kind === 'pit') return distance <= Math.max(0.35, speed * (0.08 - jitter));

  const height = groundY(course, obstacle.s0) + obstacle.height - racer.y;
  if (height <= 0) return false;
  const rise =
    (RUN.jumpSpeed - Math.sqrt(Math.max(0, RUN.jumpSpeed * RUN.jumpSpeed - 2 * RUN.gravity * height))) / RUN.gravity;
  return distance <= Math.max(0.35, speed * (rise + 0.09 - jitter));
}
