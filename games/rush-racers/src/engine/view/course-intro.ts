/**
 * The course intro card: while the countdown runs, the course's name in its world's accent colour,
 * with the world's name and a one-line tagline for how the world is raced under it, so each race
 * opens by saying where it is. It appears with the first number and is gone at GO, with no motion.
 *
 * The card is right-aligned on the view's 6 px margin from y 50, which keeps it clear of the HUD
 * rows and back link above, the countdown numeral and level banner centred on the view
 * (`countdownRects` in `race-text.ts`), the A/B buttons below y 118 and an online race's waiting
 * line on the bottom margin. Racer tags are drawn in the world and can pass under it.
 */
import type Phaser from 'phaser';
import type { Course, ShippedMediumId, ThemeId } from '../../logic/courses/types.ts';
import type { RacePhase, World } from '../../logic/types.ts';
import { mediumIdOf, worldOf } from '../../logic/worlds/index.ts';
import { createLabel, type LabelSize } from '../art/font.ts';
import { DISPLAY_FACE, measureText, TEXT_FACE } from '../art/ui/typeface.ts';
import { CanopyLight } from '../themes/forest/palettes.ts';
import { WaterLight } from '../themes/ocean/palettes.ts';
import { SkyTerrainPalette } from '../themes/sky/palettes.ts';
import { StarLight } from '../themes/space/palettes.ts';
import { Layer } from './layers.ts';
import type { Rect } from './screen-layout.ts';

/**
 * Each theme's accent for the card's course name: a light colour already in that theme's palette,
 * so it reads against the theme's own backdrop with the ink outline round it.
 */
export const INTRO_ACCENT: Readonly<Record<ThemeId, number>> = {
  ocean: WaterLight.caustic,
  forest: CanopyLight.dapple,
  sky: SkyTerrainPalette.bounceCloud[3],
  space: StarLight.ray,
};

/** How each shipped medium is raced, in the fewest words a child can read. */
const MEDIUM_TAGLINES: Readonly<Record<ShippedMediumId, string>> = {
  swim: 'SWIM',
  run: 'RUN AND JUMP',
  flight: 'FLAP AND SOAR',
  drift: 'DRIFT ON THRUSTERS',
};

/** The card's three lines, upper case. */
export interface IntroText {
  name: string;
  world: string;
  /** Empty for a medium registered by tests, which has no tagline. */
  tagline: string;
}

/**
 * The card's text for `course`: e.g. SUNLIT SHALLOWS, REEF, SWIM.
 *
 * @throws {Error} When the course names an unknown world.
 */
export function courseIntroText(course: Course): IntroText {
  const medium = mediumIdOf(course);
  return {
    name: course.name.toUpperCase(),
    world: worldOf(course).name.toUpperCase(),
    tagline: Object.hasOwn(MEDIUM_TAGLINES, medium) ? MEDIUM_TAGLINES[medium as ShippedMediumId] : '',
  };
}

/** Whether the card shows in a race in `phase`: from the countdown's first number until GO. */
export function isIntroUp(phase: RacePhase): boolean {
  return phase === 'countdown';
}

/** Gap from the view's right edge to the card's right edge, the screen's outer margin. */
const MARGIN = 6;
/** Each line's face and the y of its top, in screen px. */
const LINES = [
  { key: 'name', size: 'display', top: 50 },
  { key: 'world', size: 'text', top: 65 },
  { key: 'tagline', size: 'text', top: 74 },
] as const satisfies readonly { key: keyof IntroText; size: LabelSize; top: number }[];
/** The outline round off-panel text is one px wide. */
const OUTLINE_PX = 1;

/** One line of the card as drawn: its text, face, right edge and top, and the rect it covers with its outline. */
export interface IntroLine {
  text: string;
  size: 'display' | 'text';
  right: number;
  top: number;
  rect: Rect;
}

/** Where each line of `text` draws on a view `viewWidth` px wide, name first. */
export function introLines(text: IntroText, viewWidth: number): IntroLine[] {
  const right = viewWidth - MARGIN;
  return LINES.map(({ key, size, top }) => {
    const { width, height } = measureText(size === 'display' ? DISPLAY_FACE : TEXT_FACE, text[key]);
    const rect = {
      x: right - width - OUTLINE_PX,
      y: top - OUTLINE_PX,
      w: width + 2 * OUTLINE_PX,
      h: height + 2 * OUTLINE_PX,
    };
    return { text: text[key], size, right, top, rect };
  });
}

/** The intro card, redrawn each frame. */
export interface CourseIntro {
  sync(world: World): void;
}

/**
 * Adds the intro card for `course` to `scene`, pinned to the screen on the banner layer.
 *
 * @throws {Error} When the course names an unknown world.
 */
export function createCourseIntro(scene: Phaser.Scene, course: Course, viewWidth: number): CourseIntro {
  const accent = `#${INTRO_ACCENT[course.theme].toString(16).padStart(6, '0')}`;
  const labels = introLines(courseIntroText(course), viewWidth).map((line, index) => {
    const label = createLabel(scene, line.right, line.top, line.text, {
      size: line.size,
      outline: true,
      align: 'right',
      fixed: true,
      depth: Layer.banner,
    });
    // The course name carries the world's colour; the smaller lines stay in foam.
    if (index === 0) label.setColor(accent);
    return label;
  });
  let shown = true;
  return {
    sync(world) {
      const up = isIntroUp(world.race.phase);
      if (up === shown) return;
      shown = up;
      for (const label of labels) label.setVisible(up);
    },
  };
}
