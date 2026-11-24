/**
 * Questions about a course in track space: how long it is, how high the ground is, what is under a
 * point, and whether its data is valid. Pure functions of the `Course`; no racer state.
 */
import { RUN } from './tuning.ts';
import type { Course, Feature, Span } from './types.ts';

/** A course whose data breaks a rule. The message names the course id and the bad feature's index. */
export class CourseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CourseError';
  }
}

/** What the ground is at a point: `none` over a pit, else `ground` or `mud`, plus any gust's sideways push (m/s). */
export interface Surface {
  kind: 'ground' | 'mud' | 'none';
  push: number;
}

/** The log a racer at `s` and `d` overlaps in track space, or null. */
export type LogFeature = Extract<Feature, { kind: 'log' }>;

/** The total length of `course.path`, meters. A turn's length is `radius * |angleDeg| * PI / 180`. */
export function courseLength(course: Course): number {
  let total = 0;
  for (const segment of course.path) {
    total +=
      segment.kind === 'straight' ? segment.length : (segment.radius * Math.abs(segment.angleDeg) * Math.PI) / 180;
  }
  return total;
}

/** Ground height at `s`, meters, linear between `course.hills`, flat beyond the first and last point. */
export function groundY(course: Course, s: number): number {
  const { hills } = course;
  const first = hills[0];
  if (!first) return 0;
  if (s <= first.s) return first.y;
  for (let i = 1; i < hills.length; i++) {
    const a = hills[i - 1] as { s: number; y: number };
    const b = hills[i] as { s: number; y: number };
    if (s <= b.s) return b.s === a.s ? b.y : a.y + ((b.y - a.y) * (s - a.s)) / (b.s - a.s);
  }
  return (hills[hills.length - 1] as { s: number; y: number }).y;
}

/** The surface at `s`, `d`. Spans include their low edges and exclude their high edges. */
export function surfaceAt(course: Course, s: number, d: number): Surface {
  let kind: Surface['kind'] = 'ground';
  let push = 0;
  for (const feature of course.features) {
    if (!('s0' in feature) || !contains(feature, s, d)) continue;
    if (feature.kind === 'gust') push += feature.push;
    else if (feature.kind === 'pit') kind = 'none';
    else if (kind === 'ground') kind = 'mud';
  }
  return { kind, push };
}

/** The pit whose span holds `s`, `d`, or null. */
export function pitAt(course: Course, s: number, d: number): (Span & { kind: 'pit' }) | null {
  for (const feature of course.features) {
    if (feature.kind === 'pit' && contains(feature, s, d)) return feature;
  }
  return null;
}

/** The log whose box holds `s`, `d` in track space (ignoring height), or null. */
export function logAt(course: Course, s: number, d: number): LogFeature | null {
  for (const feature of course.features) {
    if (feature.kind === 'log' && feature.s <= s && s < feature.s + RUN.logDepth && feature.d0 <= d && d < feature.d1) {
      return feature;
    }
  }
  return null;
}

function contains(span: Span, s: number, d: number): boolean {
  return span.s0 <= s && s < span.s1 && span.d0 <= d && d < span.d1;
}

/**
 * Every rule `course` breaks, one message per problem, empty when valid. Rules: features lie inside
 * `[startS, finishS]` and inside the track width; spans have `s0 < s1` and `d0 < d1`; no pit starts
 * within 20 m of `startS`; hills are sorted by `s`; `startS < finishS <= courseLength`;
 * turn radii exceed `halfWidth + 1` and logs do not overlap pits.
 */
export function validateCourse(course: Course): string[] {
  const { startS, finishS, halfWidth } = course;
  const problems: string[] = [];
  if (!(startS < finishS && finishS <= courseLength(course))) {
    problems.push('expected startS < finishS <= course length');
  }
  let previousS = -Infinity;
  for (const [index, hill] of course.hills.entries()) {
    if (!(hill.s >= previousS)) problems.push(`hill ${index} is out of order (hills must be sorted by s)`);
    previousS = hill.s;
  }
  for (const [index, segment] of course.path.entries()) {
    if (segment.kind === 'turn' && !(segment.radius > halfWidth + 1)) {
      problems.push(`segment ${index} radius must exceed halfWidth + 1`);
    }
  }
  for (const [index, feature] of course.features.entries()) {
    const s0 = 's0' in feature ? feature.s0 : feature.s;
    const s1 = 's1' in feature ? feature.s1 : s0 + (feature.kind === 'log' ? RUN.logDepth : 0);
    const d0 = feature.kind === 'crate' ? feature.d : feature.d0;
    const d1 = feature.kind === 'crate' ? feature.d : feature.d1;
    if (!(s0 >= startS && s1 <= finishS)) problems.push(`feature ${index} is outside the start and finish`);
    if (!(d0 >= -halfWidth && d1 <= halfWidth)) problems.push(`feature ${index} is outside the track width`);
    if ('s0' in feature && !(s0 < s1)) problems.push(`feature ${index} requires s0 < s1`);
    if (feature.kind !== 'crate' && !(d0 < d1)) problems.push(`feature ${index} requires d0 < d1`);
    if (feature.kind === 'pit' && s0 < startS + 20) problems.push(`feature ${index} is a pit within 20 m of the start`);
    if (feature.kind !== 'log') continue;
    for (const [pitIndex, pit] of course.features.entries()) {
      if (pit.kind === 'pit' && s0 < pit.s1 && s1 > pit.s0 && d0 < pit.d1 && d1 > pit.d0) {
        problems.push(`feature ${index} overlaps pit ${pitIndex}`);
      }
    }
  }
  return problems;
}

/**
 * Throws when `course` is invalid.
 *
 * @throws {CourseError} Listing every problem `validateCourse` found.
 */
export function assertCourse(course: Course): void {
  const problems = validateCourse(course);
  if (problems.length > 0) throw new CourseError(`course ${course.id} is invalid:\n${problems.join('\n')}`);
}
