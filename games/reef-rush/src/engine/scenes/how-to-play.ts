/**
 * The How to Play screen, laid out to UI.md "How to Play": a heading, one of four picture pages
 * (swim and dash, open clams, fire the item you pick, the attack power-ups), a row of page dots and a footer
 * naming the two controls that turn pages. Words are few and short; the pages are the game's own
 * sprites and control glyphs, animated from the runtime's tick (still under reduced motion).
 *
 * The runtime owns the page number and turns it on input; this scene only draws
 * `rt.howToPage`, restarting the page's animation each time it changes.
 */
import Phaser from 'phaser';
import { DEFAULT_COURSE, levelOf } from '../../logic/courses/index.ts';
import { createLabel, type Label } from '../art/font.ts';
import { UiColour, UiRamp } from '../art/ui/palette.ts';
import { createPanel } from '../art/ui/panel.ts';
import { measureText, TEXT_FACE } from '../art/ui/typeface.ts';
import type { Runtime } from '../runtime.ts';
import { themeFor } from '../themes/index.ts';
import { isTouchScreen } from '../touch.ts';
import { type Backdrop, createBackdrop } from '../view/backdrop.ts';
import { actionGlyphWidth, createActionGlyph } from '../view/control-glyphs.ts';
import { createPages, type Page } from '../view/how-to-play/index.ts';

/** UI.md "How to Play" rects, in game px. */
const HEADING = { x: 160, y: 12 } as const;
/** The page dots, centred on x 160, a dot each; the current page's is larger (7 px), so it isn't told by colour alone. */
const DOTS = { y: 142, size: 5, current: 7, pitch: 10 } as const;
/** The footer sits in the safe column, a key cap tall plus the frame. */
const FOOTER = { x: 108, y: 153, w: 120, h: 21 } as const;
const FOOTER_GLYPH_TOP = FOOTER.y + 3;
const FOOTER_WORD_TOP = FOOTER_GLYPH_TOP + 4;
/** Space between a glyph and its word, and between the two pairs. */
const FOOTER_GAP = 3;
const PAIR_GAP = 6;

/** How to Play scene. The runtime reads input for it each tick and keeps the page number. */
export class HowToPlayScene extends Phaser.Scene {
  private readonly rt: Runtime;
  private backdrop: Backdrop | null = null;
  private pages: Page[] = [];
  private heading: Label | null = null;
  private dots: Phaser.GameObjects.Rectangle[] = [];
  /** The page showing, or null before the first frame. */
  private shown: number | null = null;

  constructor(rt: Runtime) {
    super('howToPlay');
    this.rt = rt;
  }

  create(): void {
    const rt = this.rt;
    // How to Play shows swimming, so it stays on the ocean course whatever course is picked.
    this.backdrop = createBackdrop(this, levelOf(DEFAULT_COURSE), themeFor(DEFAULT_COURSE), {
      get reducedMotion() {
        return rt.settings.reducedMotion;
      },
    });
    const touch = isTouchScreen();
    this.heading = createLabel(this, HEADING.x, HEADING.y, '', {
      size: 'display',
      tone: 'sun',
      outline: true,
      align: 'center',
    });
    this.pages = createPages(this, rt.course.medium, touch, rt.savedCharacter);
    this.dots = this.pages.map((_, index) => addDot(this, index, this.pages.length));
    addFooter(this, touch);
    this.shown = null;
    rt.entered('howToPlay');
    this.update();
  }

  override update(): void {
    const tick = this.rt.step.tick;
    const { reducedMotion } = this.rt.settings;
    this.backdrop?.update(tick);
    const { howToPage: page, howToSince: since } = this.rt;
    if (this.shown !== page) this.showPage(page);
    this.pages[page]?.update(tick - since, reducedMotion);
  }

  /** Shows `page` and hides the one before it. */
  private showPage(page: number): void {
    if (this.shown !== null) this.pages[this.shown]?.setVisible(false);
    const next = this.pages[page];
    next?.setVisible(true);
    this.heading?.setText(next?.heading ?? '');
    for (const [index, dot] of this.dots.entries()) {
      const current = index === page;
      dot
        .setFillStyle(current ? UiColour.sun : UiRamp.dim)
        .setSize(current ? DOTS.current : DOTS.size, current ? DOTS.current : DOTS.size);
    }
    this.shown = page;
  }
}

/** One dot of the page row, left to right, centred on the screen. */
function addDot(scene: Phaser.Scene, index: number, count: number): Phaser.GameObjects.Rectangle {
  const first = HEADING.x - ((count - 1) * DOTS.pitch) / 2;
  return scene.add.rectangle(first + index * DOTS.pitch, DOTS.y, DOTS.size, DOTS.size, UiRamp.dim);
}

/** The footer: the fire control and NEXT, the dash control and BACK, laid out as one centred row. */
function addFooter(scene: Phaser.Scene, touch: boolean): void {
  createPanel(scene, FOOTER.x, FOOTER.y, FOOTER.w, FOOTER.h, 'inset');
  const pairs = [
    { action: 'fire', word: 'NEXT' },
    { action: 'dash', word: 'BACK' },
  ] as const;
  const widthOf = (pair: (typeof pairs)[number]) =>
    actionGlyphWidth(pair.action, touch) + FOOTER_GAP + measureText(TEXT_FACE, pair.word).width;
  const total = pairs.reduce((sum, pair) => sum + widthOf(pair), 0) + PAIR_GAP * (pairs.length - 1);
  let x = Math.round(FOOTER.x + (FOOTER.w - total) / 2);
  for (const pair of pairs) {
    const glyph = createActionGlyph(scene, pair.action, touch);
    glyph.setPosition(x, FOOTER_GLYPH_TOP);
    const wordX = x + glyph.width + FOOTER_GAP;
    createLabel(scene, wordX, FOOTER_WORD_TOP, pair.word, { tone: 'foam' });
    x += widthOf(pair) + PAIR_GAP;
  }
}
