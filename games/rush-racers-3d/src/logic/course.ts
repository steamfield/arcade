/**
 * Questions about a course in track space: how long it is, how high the ground is, what is under a
 * point, and whether its data is valid. Pure functions of the `Course`; no racer state.
 */
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

/** The surface at `s`, `d`. */
export function surfaceAt(course: Course, s: number, d: number): Surface {
  void course;
  void s;
  void d;
  throw new Error('not implemented');
}

/** The pit whose span holds `s`, `d`, or null. */
export function pitAt(course: Course, s: number, d: number): (Span & { kind: 'pit' }) | null {
  void course;
  void s;
  void d;
  throw new Error('not implemented');
}

/** The log whose box holds `s`, `d` in track space (ignoring height), or null. */
export function logAt(course: Course, s: number, d: number): LogFeature | null {
  void course;
  void s;
  void d;
  throw new Error('not implemented');
}

/**
 * Every rule `course` breaks, one message per problem, empty when valid. Rules: features lie inside
 * `[startS, finishS]` and inside the track width; spans have `s0 < s1` and `d0 < d1`; no pit starts
 * within 20 m of `startS`; hills are sorted by `s`; `startS < finishS <= courseLength`.
 */
export function validateCourse(course: Course): string[] {
  // Lane 1/a implements the rules above; until then every course passes.
  void course;
  return [];
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
