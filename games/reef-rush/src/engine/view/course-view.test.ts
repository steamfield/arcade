import { describe, expect, it } from 'vitest';
import { courseFromLevel } from '../../logic/test-world.ts';
import { DISPLAY_FACE, measureText, TEXT_FACE } from '../art/ui/typeface.ts';
import {
  COURSE_FOOTER,
  COURSE_HEADING,
  COURSE_NAME_WIDTH,
  courseFooterItems,
  courseRows,
  MAX_COURSE_ROWS,
} from './course-view.ts';
import { formatRaceTime } from './race-text.ts';
import { type Rect, TOUCH_ZONES } from './threat-math.ts';

/** Three courses with names from short to as long as course select must fit. */
const COURSES = ['Reef', 'Sunlit Shallows', 'Moonlit Kelp Forest'].map((name) =>
  courseFromLevel({ name, ascii: '#1234F#' }),
);
/** The widest best time a row shows: a race at the 9:59.99 edge of the clock. */
const WIDEST_BEST = formatRaceTime(599.99 * 60);
const SCREEN: Rect = { x: 6, y: 6, w: 308, h: 168 };

const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const inside = (inner: Rect, outer: Rect) =>
  inner.x >= outer.x &&
  inner.y >= outer.y &&
  inner.x + inner.w <= outer.x + outer.w &&
  inner.y + inner.h <= outer.y + outer.h;

describe.each([
  ['desktop', false],
  ['phone', true],
])('course select with three courses on %s', (_, touch) => {
  const rows = courseRows(COURSES.length);
  const footer = courseFooterItems(touch);
  const textRect = (at: { x: number; y: number }, text: string): Rect => {
    const size = measureText(TEXT_FACE, text);
    return { x: at.x, y: at.y, w: size.width, h: size.height };
  };

  it('keeps every row and the footer on screen, clear of the back link, d-pad and A/B buttons', () => {
    for (const rect of [...rows.map((row) => row.panel), COURSE_FOOTER, ...footer.map((item) => item.glyph)]) {
      expect(inside(rect, SCREEN), JSON.stringify(rect)).toBe(true);
      for (const zone of TOUCH_ZONES)
        expect(overlaps(rect, zone), `${JSON.stringify(rect)} in a touch zone`).toBe(false);
    }
  });

  it('stacks the rows under the heading without overlapping each other or the footer', () => {
    const headingBottom = COURSE_HEADING.y + Math.ceil(measureText(DISPLAY_FACE, 'PICK A COURSE').height / 2) + 1;
    expect(rows[0]?.panel.y).toBeGreaterThan(headingBottom);
    const panels = [...rows.map((row) => row.panel), COURSE_FOOTER];
    for (const [index, panel] of panels.entries()) {
      for (const other of panels.slice(index + 1)) expect(overlaps(panel, other)).toBe(false);
    }
  });

  it.each(COURSES.map((course, index) => [course.name, index] as const))(
    'fits %s and the widest best time on its row without touching',
    (name, index) => {
      const row = rows[index];
      if (!row) throw new Error(`no row ${index}`);
      const nameWidth = measureText(TEXT_FACE, name).width;
      const bestLeft = row.bestRight.x - measureText(TEXT_FACE, WIDEST_BEST).width;
      expect(nameWidth).toBeLessThanOrEqual(COURSE_NAME_WIDTH);
      expect(row.name.x + COURSE_NAME_WIDTH).toBeLessThan(bestLeft);
      expect(row.bestRight.x).toBeLessThanOrEqual(row.panel.x + row.panel.w - 4);
    },
  );

  it('puts each footer control and its word inside the footer, the words clear of the next control', () => {
    for (const [index, item] of footer.entries()) {
      const word = textRect(item.word, item.word.text);
      expect(inside(item.glyph, COURSE_FOOTER)).toBe(true);
      expect(inside(word, COURSE_FOOTER)).toBe(true);
      const next = footer[index + 1];
      if (next) expect(word.x + word.w).toBeLessThan(next.glyph.x);
    }
  });
});

describe('course select capacity', () => {
  it('refuses more courses than fit above the A/B buttons, so a sixth course is noticed', () => {
    expect(courseRows(MAX_COURSE_ROWS)).toHaveLength(MAX_COURSE_ROWS);
    expect(() => courseRows(MAX_COURSE_ROWS + 1)).toThrow(`fits ${MAX_COURSE_ROWS} courses, but 6 are listed`);
  });
});
