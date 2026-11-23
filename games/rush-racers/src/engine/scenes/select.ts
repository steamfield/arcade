/**
 * The select screen, laid out to UI.md "Select": the eight characters in a
 * 4x2 grid of framed cells (portrait and short name; the cell under the
 * cursor in a gold frame with its name in sun), a card for that character
 * (its portrait at 2x, full name, ability and a one-line blurb), the picked
 * racer swimming in place under the card, and a footer showing fire races and
 * dash goes back (as the A and B buttons on touch screens). Everything sits
 * clear of the back link, d-pad and A/B zones. The backdrop is the last listed course raced
 * (Sunlit Shallows until then), as on the title. Racer art and names come from the world cast of
 * the course the race will run on.
 *
 * The runtime moves the cursor and starts the race; this scene only draws
 * `rt.selectedCharacter`. Motion is timed from the runtime tick and reads
 * `rt.settings.reducedMotion` live, so a Motion change made on the title is
 * already in force: the card's text drops into place on each move and the preview
 * strokes, and under reduced motion both hold still.
 */
import Phaser from 'phaser';
import { levelOf } from '../../logic/courses/index.ts';
import type { Course } from '../../logic/courses/types.ts';
import { CHARACTER_IDS, type CharacterId } from '../../logic/types.ts';
import { createLabel, type Label } from '../art/font.ts';
import { Frame } from '../art/keys.ts';
import { IconFrame, UiTex } from '../art/ui/keys.ts';
import { createPanel, type Panel } from '../art/ui/panel.ts';
import { centreOnStage } from '../centre-on-stage.ts';
import { abilityTextFor, SELECT_COLUMNS } from '../character-select.ts';
import type { Runtime } from '../runtime.ts';
import { themeFor } from '../themes/index.ts';
import { isTouchScreen } from '../touch.ts';
import { type Backdrop, createBackdrop } from '../view/backdrop.ts';
import { racerName, racerShortName, slideRemaining, TONE_CSS } from '../view/race-text.ts';
import { skinFor } from '../worlds/index.ts';

/** UI.md "Select" rects, in game px. */
const HEADING = { x: 160, y: 12 } as const;
/** Cells from (22, 28); the top-right cell starts under the back link, the bottom row ends above the d-pad. */
const GRID = { x: 22, y: 28, cellW: 66, cellH: 22, colGap: 4, rowGap: 2 } as const;
/** Inside a cell: the 16x16 portrait just inside the 3 px frame, the name beside it, centred on the cell's height. */
const CELL_PORTRAIT = { dx: 3, dy: 3 } as const;
const CELL_NAME = { dx: 22, dy: 8 } as const;
/** Right of the d-pad zone, right edge on the grid's, and ending at y 117, above the A/B buttons. */
const CARD = { x: 110, y: 78, w: 188, h: 40 } as const;
const CARD_PORTRAIT = { x: 114, y: 82, scale: 2 } as const;
/** The text column right of the portrait; its width is CARD_TEXT_WIDTH. */
const CARD_TEXT_X = 150;
const CARD_NAME_Y = 83;
const CARD_ABILITY_Y = 98;
const CARD_BLURB_Y = 107;
/** The picked racer at 2x (32x24), centred in the safe column between the card and the footer. */
const PREVIEW = { x: 160, y: 140, scale: 2 } as const;
/** An inset readout at the bottom of the safe column: fire icon RACE, dash icon BACK; A RACE, B BACK on touch. */
const FOOTER = { x: 114, y: 159, w: 92, h: 15 } as const;
const FOOTER_ICON_Y = 162;
const FOOTER_TEXT_Y = 163;
const FOOTER_KICK_X = 122;
const FOOTER_BURST_X = 164;
/** Icon to its word. */
const FOOTER_WORD_DX = 11;
/** On touch a 5 px button letter stands in the 9 px icon's place, centred in it. */
const FOOTER_LETTER_DX = 2;

/** UI.md "Motion": on each move the card's text drops 2 px into place over 6 ticks, staying inside the frame. */
const CARD_DROP = { px: 2, ticks: 6 } as const;
/** The preview swaps swim strokes this often, like the title's swimmers. */
const STROKE_TICKS = 8;

/** One grid cell: its frame and name, restyled when the cursor arrives or leaves. */
interface Cell {
  character: CharacterId;
  panel: Panel;
  name: Label;
}

/** The card for the character under the cursor. */
interface Card {
  portrait: Phaser.GameObjects.Image;
  name: Label;
  ability: Label;
  blurb: Label;
}

/** Select scene. The runtime reads input for it each tick. */
export class SelectScene extends Phaser.Scene {
  private readonly rt: Runtime;
  private backdrop: Backdrop | null = null;
  private cells: Cell[] = [];
  private card: Card | null = null;
  private preview: Phaser.GameObjects.Image | null = null;
  /** The character the card last showed, and the tick it changed to it. */
  private shown: { character: CharacterId; since: number } | null = null;

  constructor(rt: Runtime) {
    super('select');
    this.rt = rt;
  }

  /** The course the race will run on, whose world cast and look the screen shows. */
  private get course(): Course {
    return this.rt.course;
  }

  create(): void {
    centreOnStage(this);
    const rt = this.rt;
    // The picked course's look, not the menus', so its cast stands in its own world.
    this.backdrop = createBackdrop(this, levelOf(this.course), themeFor(this.course), {
      get reducedMotion() {
        return rt.settings.reducedMotion;
      },
    });
    createLabel(this, HEADING.x, HEADING.y, 'PICK A RACER', {
      size: 'display',
      tone: 'sun',
      outline: true,
      align: 'center',
    });
    this.cells = CHARACTER_IDS.map((character, index) => addCell(this, character, index, this.course));
    this.card = addCard(this, this.course, rt.selectedCharacter);
    this.preview = this.add
      .image(PREVIEW.x, PREVIEW.y, skinFor(this.course).cast.racers[this.rt.selectedCharacter], Frame.a)
      .setScale(PREVIEW.scale);
    addFooter(this);
    this.shown = null;
    rt.entered('select');
    this.update();
  }

  override update(): void {
    const tick = this.rt.step.tick;
    const { reducedMotion } = this.rt.settings;
    this.backdrop?.update(tick);
    const selected = this.rt.selectedCharacter;
    if (this.shown?.character !== selected) {
      // The screen opens on the saved pick without a slide; only a move drops the card text in.
      const since = this.shown ? tick : Number.NEGATIVE_INFINITY;
      this.shown = { character: selected, since };
      this.showCharacter(selected);
    }
    const drop = slideRemaining(tick - this.shown.since, CARD_DROP.px, CARD_DROP.ticks, reducedMotion);
    if (this.card) for (const line of [this.card.name, this.card.ability, this.card.blurb]) line.setOffset(0, -drop);
    const stroke = reducedMotion || Math.floor(tick / STROKE_TICKS) % 2 === 0 ? Frame.a : Frame.b;
    this.preview?.setFrame(stroke);
  }

  /** Restyles the cells for a new cursor position and fills the card and preview for `selected`. */
  private showCharacter(selected: CharacterId): void {
    for (const cell of this.cells) {
      const isSelected = cell.character === selected;
      cell.panel.setStyle(isSelected ? 'accent' : 'raised');
      cell.name.setColor(TONE_CSS[isSelected ? 'sun' : 'foam']);
    }
    const { cast } = skinFor(this.course);
    const ability = abilityTextFor(selected, cast);
    this.card?.portrait.setTexture(cast.portraits[selected].texture, cast.portraits[selected].frame);
    this.card?.name.setText(racerName(selected, this.course).toUpperCase());
    this.card?.ability.setText(ability.name);
    this.card?.blurb.setText(ability.blurb);
    this.preview?.setTexture(cast.racers[selected], Frame.a);
  }
}

/** A framed grid cell at `index` in reading order, with the character's portrait and short name. */
function addCell(scene: Phaser.Scene, character: CharacterId, index: number, course: Course): Cell {
  const portrait = skinFor(course).cast.portraits[character];
  const x = GRID.x + (index % SELECT_COLUMNS) * (GRID.cellW + GRID.colGap);
  const y = GRID.y + Math.floor(index / SELECT_COLUMNS) * (GRID.cellH + GRID.rowGap);
  const panel = createPanel(scene, x, y, GRID.cellW, GRID.cellH, 'raised');
  scene.add.image(x + CELL_PORTRAIT.dx, y + CELL_PORTRAIT.dy, portrait.texture, portrait.frame).setOrigin(0, 0);
  const name = createLabel(scene, x + CELL_NAME.dx, y + CELL_NAME.dy, racerShortName(character, course).toUpperCase());
  return { character, panel, name };
}

/** The raised card: a 2x portrait, then the full name in display sun, the ability in foam and its blurb in dim. */
function addCard(scene: Phaser.Scene, course: Course, selected: CharacterId): Card {
  const portrait = skinFor(course).cast.portraits[selected];
  createPanel(scene, CARD.x, CARD.y, CARD.w, CARD.h, 'raised');
  return {
    portrait: scene.add
      .image(CARD_PORTRAIT.x, CARD_PORTRAIT.y, portrait.texture, portrait.frame)
      .setOrigin(0, 0)
      .setScale(CARD_PORTRAIT.scale),
    name: createLabel(scene, CARD_TEXT_X, CARD_NAME_Y, '', { size: 'display', tone: 'sun' }),
    ability: createLabel(scene, CARD_TEXT_X, CARD_ABILITY_Y, '', { tone: 'foam' }),
    blurb: createLabel(scene, CARD_TEXT_X, CARD_BLURB_Y, '', { tone: 'dim' }),
  };
}

/**
 * The footer readout: the fire icon and RACE, the dash icon and BACK. On a touch screen it names
 * the on-screen buttons instead, A RACE and B BACK, with the letters in sun.
 */
function addFooter(scene: Phaser.Scene): void {
  createPanel(scene, FOOTER.x, FOOTER.y, FOOTER.w, FOOTER.h, 'inset');
  const touch = isTouchScreen();
  for (const [x, icon, letter, word] of [
    [FOOTER_KICK_X, IconFrame.fire, 'A', 'RACE'],
    [FOOTER_BURST_X, IconFrame.dash, 'B', 'BACK'],
  ] as const) {
    if (touch) createLabel(scene, x + FOOTER_LETTER_DX, FOOTER_TEXT_Y, letter, { tone: 'sun' });
    else scene.add.image(x, FOOTER_ICON_Y, UiTex.icons, icon).setOrigin(0, 0);
    createLabel(scene, x + FOOTER_WORD_DX, FOOTER_TEXT_Y, word, { tone: 'foam' });
  }
}
