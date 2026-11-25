/**
 * Questions about a course in track space: how long it is, how high the ground is, what is under a
 * point, and whether its data is valid. Pure functions of the `Course`; no racer state.
 */
import { RUN } from './tuning.ts';
import { type Course, type Feature, type Span, THEME_IDS } from './types.ts';

/** A course whose data breaks a rule. The message names the course id and each problem. */
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
 * turn radii exceed `halfWidth + 1`; logs do not overlap pits; the theme is registered.
 */
export function validateCourse(course: Course): string[] {
  const { startS, finishS, halfWidth } = course;
  const length = courseLength(course);
  const problems: string[] = [];
  if (!THEME_IDS.includes(course.theme)) {
    problems.push(`course ${course.id} has unknown theme ${course.theme}`);
  }
  if (!(startS < finishS && finishS <= length)) {
    problems.push(`startS ${startS}, finishS ${finishS} must satisfy startS < finishS <= course length ${length}`);
  }
  let previousS = -Infinity;
  for (const [index, hill] of course.hills.entries()) {
    if (!(hill.s >= previousS)) {
      problems.push(
        index === 0
          ? `hill ${index} has invalid s ${hill.s}`
          : `hill ${index} at s ${hill.s} comes before hill ${index - 1} at s ${previousS}`,
      );
    }
    previousS = hill.s;
  }
  const minTurnRadius = halfWidth + 1;
  for (const [index, segment] of course.path.entries()) {
    if (segment.kind === 'turn' && !(segment.radius > minTurnRadius)) {
      problems.push(`segment ${index} radius ${segment.radius} must exceed halfWidth + 1 = ${minTurnRadius}`);
    }
  }
  const minPitStart = startS + 20;
  for (const [index, feature] of course.features.entries()) {
    const label = `feature ${index} (${feature.kind})`;
    const s0 = 's0' in feature ? feature.s0 : feature.s;
    const s1 = 's1' in feature ? feature.s1 : s0 + (feature.kind === 'log' ? RUN.logDepth : 0);
    const d0 = feature.kind === 'crate' ? feature.d : feature.d0;
    const d1 = feature.kind === 'crate' ? feature.d : feature.d1;
    if (!(s0 >= startS && s1 <= finishS)) {
      const position = feature.kind === 'crate' ? `is at s ${s0}` : `spans s ${s0}-${s1}`;
      problems.push(`${label} ${position}, outside [${startS}, ${finishS}]`);
    }
    if (!(d0 >= -halfWidth && d1 <= halfWidth)) {
      const position = feature.kind === 'crate' ? `is at d ${d0}` : `spans d ${d0} to ${d1}`;
      problems.push(`${label} ${position}, outside track width [${-halfWidth}, ${halfWidth}]`);
    }
    if ('s0' in feature && !(s0 < s1)) problems.push(`${label} has s0 ${s0}, s1 ${s1} and must satisfy s0 < s1`);
    if (feature.kind !== 'crate' && !(d0 < d1)) {
      problems.push(`${label} has d0 ${d0}, d1 ${d1} and must satisfy d0 < d1`);
    }
    if (feature.kind === 'pit' && s0 < minPitStart) {
      problems.push(`${label} starts at s ${s0}, less than 20 m after startS ${startS} (minimum s ${minPitStart})`);
    }
    if (feature.kind !== 'log') continue;
    for (const [pitIndex, pit] of course.features.entries()) {
      if (pit.kind === 'pit' && s0 < pit.s1 && s1 > pit.s0 && d0 < pit.d1 && d1 > pit.d0) {
        problems.push(
          `${label} at s ${s0}-${s1}, d ${d0} to ${d1} overlaps feature ${pitIndex} (pit) at s ${pit.s0}-${pit.s1}, d ${pit.d0} to ${pit.d1}`,
        );
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
