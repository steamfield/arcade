/**
 * The course intro card: what it says for each listed course, when it shows, that it stays out of
 * the countdown, the HUD, the touch zones and the online waiting line on every view shape, and that
 * each theme's accent reads off that theme's backdrop.
 */
import { describe, expect, it } from 'vitest';
import { LISTED_COURSES } from '../../logic/courses/index.ts';
import { DISPLAY_SHADE, TEXT_SHADOW } from '../art/ui/palette.ts';
import { HUD_ROWS_BOTTOM } from '../online/race-hud.ts';
import { THEMES } from '../themes/index.ts';
import { courseIntroText, INTRO_ACCENT, introLines, isIntroUp } from './course-intro.ts';
import { countdownRects } from './race-text.ts';
import { type Rect, screenLayout } from './screen-layout.ts';

/** The base view, a phone in landscape and a tall desktop window (UI.md "Grid and padding"). */
const VIEWS = [
  { width: 320, height: 180 },
  { width: 420, height: 180 },
  { width: 320, height: 200 },
] as const;
/** The top of the online waiting line at its tallest (two lines), measured from the bottom edge. */
const WAITING_LINE_FROM_BOTTOM = 22;

const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

describe('the course intro card', () => {
  it('names each listed course, its world and how the world is raced', () => {
    expect(LISTED_COURSES.map(courseIntroText)).toEqual([
      { name: 'SUNLIT SHALLOWS', world: 'REEF', tagline: 'SWIM' },
      { name: 'BRAMBLE RUN', world: 'THORNWOOD', tagline: 'RUN AND JUMP' },
      { name: 'THUNDERHEAD PASS', world: 'CLOUDREACH', tagline: 'FLAP AND SOAR' },
      { name: 'SLINGSHOT ALLEY', world: 'FARSIDE', tagline: 'DRIFT ON THRUSTERS' },
    ]);
  });

  it('shows through the countdown and is gone from GO on', () => {
    expect([isIntroUp('countdown'), isIntroUp('racing'), isIntroUp('finished')]).toEqual([true, false, false]);
  });

  describe.each(VIEWS)('on a $width x $height view', (view) => {
    const layout = screenLayout(view);
    const waitingLine: Rect = { x: 0, y: view.height - WAITING_LINE_FROM_BOTTOM, w: view.width, h: 22 };
    const rects = LISTED_COURSES.flatMap((course) =>
      introLines(courseIntroText(course), view.width).map((line) => [line.text, line.rect] as const),
    );

    it.each(rects)('keeps %s clear of the countdown numeral and level banner', (_, rect) => {
      for (const countdown of countdownRects(layout.centreX)) expect(overlaps(rect, countdown)).toBe(false);
    });

    it.each(rects)('keeps %s under the HUD rows, inside the margin and out of every touch zone', (_, rect) => {
      expect(rect.y).toBeGreaterThanOrEqual(HUD_ROWS_BOTTOM);
      expect(rect.x + rect.w).toBeLessThanOrEqual(view.width - 5);
      for (const zone of layout.touchZones) expect(overlaps(rect, zone)).toBe(false);
    });

    it.each(rects)('keeps %s above the online waiting line', (_, rect) => {
      expect(overlaps(rect, waitingLine)).toBe(false);
    });
  });

  it.each(Object.entries(THEMES))(
    'draws the %s course name in an accent that separates from its bands',
    (id, theme) => {
      const accent = INTRO_ACCENT[id as keyof typeof INTRO_ACCENT];
      for (const { name, colour } of theme.contrastBands) {
        // Display text is large text (3:1); where the band is too light for the glyph, the ink outline carries it.
        const separated = contrast(multiply(accent, DISPLAY_SHADE), colour) >= 3 || contrast(TEXT_SHADOW, colour) >= 3;
        expect(separated, name).toBe(true);
      }
    },
  );
});

/** WCAG relative luminance of a 0xrrggbb colour. */
function luminance(colour: number): number {
  const [r = 0, g = 0, b = 0] = [16, 8, 0].map((shift) => {
    const channel = ((colour >> shift) & 0xff) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two colours. */
function contrast(a: number, b: number): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05);
}

/** A colour seen through a grey multiply, as the display face's shaded lower rows draw a tint. */
function multiply(colour: number, grey: number): number {
  return [16, 8, 0].reduce(
    (sum, shift) => sum | (Math.round((((colour >> shift) & 0xff) * ((grey >> shift) & 0xff)) / 255) << shift),
    0,
  );
}
