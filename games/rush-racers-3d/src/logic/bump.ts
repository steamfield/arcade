/** Racers bumping into each other: run once per tick after every racer has moved. */
import { groundY, logAt, pitAt } from './course.ts';
import { RUN } from './tuning.ts';
import type { Course, Racer, World } from './types.ts';

const WIDTH = 2 * RUN.radius;
const VELOCITY_TRANSFER = 0.65;
const EPSILON = 0.0000001;

interface LateralBounds {
  min: number;
  max: number;
}

interface Pair {
  a: Racer;
  b: Racer;
  left: Racer;
  right: Racer;
  bumped: boolean;
}

/**
 * Pushes apart in `d` any two racing racers that overlap, swapping part of their `vd`, and emits
 * `racer.bumped` with `by` for each. Fallen and finished racers never bump.
 *
 * @param startD The pre-move `d` by racer slot, used to preserve side order when racers cross.
 * A `null` entry marks a racer that wasn't racing before movement. Omitted positions use the current `d`.
 */
export function bumpRacers(world: World, startD?: readonly (number | null)[]): void {
  const pairs: Pair[] = [];
  for (const [i, a] of world.racers.entries()) {
    if (a.state !== 'racing') continue;
    for (let j = i + 1; j < world.racers.length; j++) {
      const b = world.racers[j];
      if (b?.state !== 'racing' || Math.abs(b.s - a.s) >= WIDTH || Math.abs(b.y - a.y) >= 1) continue;
      const aStart = startD?.[i] ?? a.d;
      const bStart = startD?.[j] ?? b.d;
      const aIsLeft = aStart === bStart ? a.d <= b.d : aStart < bStart;
      pairs.push({ a, b, left: aIsLeft ? a : b, right: aIsLeft ? b : a, bumped: false });
    }
  }
  if (!pairs.some(({ left, right }) => right.d - left.d < WIDTH - EPSILON)) return;

  const bounds = new Map<Racer, LateralBounds>();
  for (const racer of world.racers) bounds.set(racer, lateralBounds(world.course, racer));

  // A correction in a crowd can reopen an earlier contact. Revisit positions without repeating
  // the impulse or events, and stop if the group is separated or pinned by the course.
  for (let pass = 0; pass < 32; pass++) {
    let moved = false;
    for (const pair of pairs) {
      const { a, b, left, right } = pair;
      const overlap = WIDTH - (right.d - left.d);
      if (overlap <= EPSILON) continue;
      const min = bounds.get(left)?.min ?? left.d;
      const max = bounds.get(right)?.max ?? right.d;
      let leftD = Math.max(min, left.d - overlap / 2);
      const rightD = Math.min(max, Math.max(right.d + overlap / 2, leftD + WIDTH));
      leftD = Math.max(min, rightD - WIDTH);
      moved ||= Math.abs(left.d - leftD) > EPSILON || Math.abs(right.d - rightD) > EPSILON;
      left.d = leftD;
      right.d = rightD;
      if (pair.bumped) continue;
      pair.bumped = true;
      const transfer = Math.max(0, left.vd - right.vd) * VELOCITY_TRANSFER;
      left.vd -= transfer;
      right.vd += transfer;
      world.events.emit({ type: 'racer.bumped', id: a.id, s: a.s, by: b.id });
      world.events.emit({ type: 'racer.bumped', id: b.id, s: b.s, by: a.id });
    }
    if (!moved) break;
  }

  for (const racer of world.racers) {
    if (racer.state === 'racing' && racer.grounded && !hasSupport(world.course, racer)) {
      racer.grounded = false;
      racer.coyoteTicks = RUN.coyoteTicks;
    }
  }
}

function lateralBounds(course: Course, { s, d, y }: Racer): LateralBounds {
  const edge = Math.max(0, course.halfWidth - RUN.radius);
  let min = -edge;
  let max = edge;
  const pit = pitAt(course, s, d);
  if (pit && y < groundY(course, s)) {
    min = Math.max(min, pit.d0);
    max = Math.min(max, pit.d1 - EPSILON);
  }
  for (const log of course.features) {
    if (log.kind !== 'log' || s <= log.s || s >= log.s + RUN.logDepth || y >= groundY(course, log.s) + log.height) {
      continue;
    }
    if (d < log.d0) max = Math.min(max, log.d0 - EPSILON);
    if (d >= log.d1) min = Math.max(min, log.d1);
  }
  return { min: Math.min(min, d), max: Math.max(max, d) };
}

function hasSupport(course: Course, { s, d, y }: Racer): boolean {
  if (pitAt(course, s, d)) return false;
  const log = logAt(course, s, d);
  return y <= groundY(course, s) || (log !== null && y <= groundY(course, log.s) + log.height);
}
