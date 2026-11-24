/**
 * Draws course select, laid out to UI.md "Course select": the PICK A COURSE heading, one framed row
 * per listed course (its name, and the player's best there on the level in force, right-aligned;
 * the row under the cursor in a gold frame with its name in sun), and a footer showing fire picks
 * and burst goes back (as the A and B buttons on touch screens). The layout is plain functions with
 * no Phaser in them, so a test can hold every rect to the screen and the touch zones; the runtime
 * moves the cursor and this view only shows it.
 */
import type Phaser from 'phaser';
import { createLabel, type Label } from '../art/font.ts';
import { IconFrame, UiTex } from '../art/ui/keys.ts';
import { createPanel, type Panel } from '../art/ui/panel.ts';
import { TONE_CSS } from './race-text.ts';
import type { Rect } from './threat-math.ts';

/** Where the heading is centred. */
export const COURSE_HEADING = { x: 160, y: 12 } as const;
/**
 * Course rows: single-line readouts (15 tall) from (110, 28), 2 px apart. 188 wide puts the right
 * edge on the select card's (x 297); five rows end at y 111, above the A/B zone (y 118).
 */
const ROWS = { x: 110, y: 28, w: 188, h: 15, gap: 2 } as const;
/** Text sits inside the 3 px frame with 1 px of padding, its top 4 px down. */
const ROW_TEXT_INSET = 4;
/** The best time, right-aligned, takes the 7 characters of "9:59.99"; the name keeps 6 px clear of it. */
const BEST_WIDTH = 41;
const NAME_TO_BEST_GAP = 6;
/** The widest a course name may draw, in px, so it never runs into the best time. */
export const COURSE_NAME_WIDTH = ROWS.w - 2 * ROW_TEXT_INSET - BEST_WIDTH - NAME_TO_BEST_GAP;
/** As many rows as fit above the A/B zone. */
export const MAX_COURSE_ROWS = 5;
/** The footer, as on the select screen: an inset readout at the bottom of the safe column. */
export const COURSE_FOOTER: Rect = { x: 114, y: 159, w: 92, h: 15 };
const FOOTER_ICON = { y: 162, size: 9 } as const;
const FOOTER_TEXT_Y = 163;
const FOOTER_PICK_X = 122;
const FOOTER_BACK_X = 164;
/** Icon to its word; on touch a 5 px button letter stands centred in the 9 px icon's place. */
const FOOTER_WORD_DX = 11;
const FOOTER_LETTER_DX = 2;
/** The text face's glyph height and width, for the footer words' rects. */
const TEXT_HEIGHT = 7;
const TEXT_PITCH = 6;

/** One course row: its frame, where its name starts, and where its best time ends (right-aligned). */
interface CourseRowLayout {
  panel: Rect;
  name: { x: number; y: number };
  bestRight: { x: number; y: number };
}

/** One footer control: the icon or button letter, and its word. */
interface FooterItem {
  glyph: Rect;
  word: { x: number; y: number; text: string };
}

/**
 * The rows for `count` courses, top to bottom.
 *
 * @throws {Error} When more courses are listed than fit above the A/B zone, naming both counts.
 */
export function courseRows(count: number): CourseRowLayout[] {
  if (count > MAX_COURSE_ROWS) {
    throw new Error(`Course select fits ${MAX_COURSE_ROWS} courses, but ${count} are listed; it needs a second page`);
  }
  return Array.from({ length: count }, (_, index) => {
    const y = ROWS.y + index * (ROWS.h + ROWS.gap);
    return {
      panel: { x: ROWS.x, y, w: ROWS.w, h: ROWS.h },
      name: { x: ROWS.x + ROW_TEXT_INSET, y: y + ROW_TEXT_INSET },
      bestRight: { x: ROWS.x + ROWS.w - ROW_TEXT_INSET, y: y + ROW_TEXT_INSET },
    };
  });
}

/** The footer's two controls: fire PICK and dash BACK, as icons on a keyboard and as A and B on touch. */
export function courseFooterItems(touch: boolean): FooterItem[] {
  const item = (x: number, word: string): FooterItem => ({
    glyph: touch
      ? { x: x + FOOTER_LETTER_DX, y: FOOTER_TEXT_Y, w: TEXT_PITCH - 1, h: TEXT_HEIGHT }
      : { x, y: FOOTER_ICON.y, w: FOOTER_ICON.size, h: FOOTER_ICON.size },
    word: { x: x + FOOTER_WORD_DX, y: FOOTER_TEXT_Y, text: word },
  });
  return [item(FOOTER_PICK_X, 'PICK'), item(FOOTER_BACK_X, 'BACK')];
}

/** What a row shows: the course's name and its best line (a time, or a dash when there is none). */
export interface CourseRowText {
  name: string;
  best: string;
}

/** A drawn course select that follows the runtime's cursor. */
export interface CourseView {
  /** Puts the gold frame and sun name on row `cursor`. */
  sync(cursor: number): void;
}

/**
 * Adds the heading, a row per entry of `rows` and the footer to `scene`.
 *
 * @throws {Error} When more rows are given than fit (see `courseRows`).
 */
export function createCourseView(scene: Phaser.Scene, rows: readonly CourseRowText[], touch: boolean): CourseView {
  createLabel(scene, COURSE_HEADING.x, COURSE_HEADING.y, 'PICK A COURSE', {
    size: 'display',
    tone: 'sun',
    outline: true,
    align: 'center',
  });
  const drawn = courseRows(rows.length).map((layout, index) => addRow(scene, layout, rows[index]));
  addFooter(scene, touch);
  return {
    sync(cursor) {
      drawn.forEach((row, index) => {
        const selected = index === cursor;
        row.panel.setStyle(selected ? 'accent' : 'raised');
        row.name.setColor(TONE_CSS[selected ? 'sun' : 'foam']);
      });
    },
  };
}

function addRow(
  scene: Phaser.Scene,
  layout: CourseRowLayout,
  text: CourseRowText | undefined,
): { panel: Panel; name: Label } {
  const { panel, name, bestRight } = layout;
  const frame = createPanel(scene, panel.x, panel.y, panel.w, panel.h, 'raised');
  const label = createLabel(scene, name.x, name.y, text?.name ?? '');
  createLabel(scene, bestRight.x, bestRight.y, text?.best ?? '', { tone: 'dim', align: 'right' });
  return { panel: frame, name: label };
}

function addFooter(scene: Phaser.Scene, touch: boolean): void {
  createPanel(scene, COURSE_FOOTER.x, COURSE_FOOTER.y, COURSE_FOOTER.w, COURSE_FOOTER.h, 'inset');
  const [pick, back] = courseFooterItems(touch);
  for (const [item, icon, letter] of [
    [pick, IconFrame.fire, 'A'],
    [back, IconFrame.dash, 'B'],
  ] as const) {
    if (!item) continue;
    if (touch) createLabel(scene, item.glyph.x, item.glyph.y, letter, { tone: 'sun' });
    else scene.add.image(item.glyph.x, item.glyph.y, UiTex.icons, icon).setOrigin(0, 0);
    createLabel(scene, item.word.x, item.word.y, item.word.text, { tone: 'foam' });
  }
}
