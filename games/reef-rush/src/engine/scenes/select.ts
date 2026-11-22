/**
 * The select screen: the eight characters in a 4x2 grid of framed cells
 * (portrait and short name), the one under the cursor in a gold frame, and an
 * inset card naming the selection and its ability. The runtime moves the
 * cursor and starts the race; this scene only draws `rt.selectedCharacter`.
 *
 * Layout (game px, clear of the back link, d-pad and A/B zones in UI.md):
 * heading centred on x 160 at y 12; cells 62x22, 4 px apart, from (30, 28)
 * so the bottom row ends at y 75, above the d-pad zone; the card at
 * (110, 82, 200, 34), right of the d-pad zone and above the A/B buttons.
 */
import Phaser from 'phaser';
import { CHARACTERS } from '../../logic/characters.ts';
import { OCEAN_LEVEL } from '../../logic/level/levels.ts';
import { parseLevel } from '../../logic/level/parse.ts';
import { type AbilityId, CHARACTER_IDS, type CharacterId } from '../../logic/types.ts';
import { createLabel, type Label } from '../art/font.ts';
import { PortraitFrame, UiTex } from '../art/ui/keys.ts';
import { createPanel, type Panel } from '../art/ui/panel.ts';
import { SELECT_COLUMNS } from '../character-select.ts';
import type { Runtime } from '../runtime.ts';
import { type Backdrop, createBackdrop } from '../view/backdrop.ts';
import { racerName, racerShortName, TONE_CSS } from '../view/race-text.ts';

const HEADING = { x: 160, y: 12 } as const;
const GRID = { x: 30, y: 28, cellW: 62, cellH: 22, gap: 4 } as const;
/** Inside a cell: the 16x16 portrait just inside the 3 px frame, the name beside it, centred on the cell's height. */
const CELL_PORTRAIT = { dx: 3, dy: 3 } as const;
const CELL_NAME = { dx: 21, dy: 8 } as const;
const CARD = { x: 110, y: 82, w: 200, h: 34 } as const;
const CARD_TEXT_X = 116;
const CARD_LINES_Y = [86, 96, 105] as const;

/** What each ability is called on screen, and one line on what it does (at most 31 characters, the card's width). */
const ABILITY_TEXT: Record<AbilityId, { name: string; blurb: string }> = {
  shakeItOff: { name: 'SHAKE IT OFF', blurb: 'STUNS AND TRAPS WEAR OFF FAST' },
  springKick: { name: 'SPRING KICK', blurb: 'KICKS PUSH HARDER UPWARD' },
  windUp: { name: 'WIND-UP', blurb: 'TOP SPEED BUILDS ON STRAIGHTS' },
  ambush: { name: 'AMBUSH', blurb: 'BUMPS FROM BEHIND STEAL SPEED' },
  deepPockets: { name: 'DEEP POCKETS', blurb: 'HOLDS 4 POWER-UPS, NOT 3' },
  bulldozer: { name: 'BULLDOZER', blurb: 'RAMS CORAL, SHRUGS OFF BUMPS' },
  moonlight: { name: 'MOONLIGHT', blurb: 'SEES IN THE DARK, JELLY-PROOF' },
  frenzy: { name: 'FRENZY', blurb: 'SPEEDS UP WHEN RIVALS GET HIT' },
};

/** One grid cell: its frame and name, restyled when the cursor arrives or leaves. */
interface Cell {
  character: CharacterId;
  panel: Panel;
  name: Label;
}

/** Select scene. The runtime reads input for it each tick. */
export class SelectScene extends Phaser.Scene {
  private readonly rt: Runtime;
  private backdrop: Backdrop | null = null;
  private cells: Cell[] = [];
  private card: Label[] = [];

  constructor(rt: Runtime) {
    super('select');
    this.rt = rt;
  }

  create(): void {
    const rt = this.rt;
    // Read every update, so a Motion change made on the title is already in force here.
    this.backdrop = createBackdrop(this, parseLevel(OCEAN_LEVEL), {
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
    this.cells = CHARACTER_IDS.map((character, index) => addCell(this, character, index));
    createPanel(this, CARD.x, CARD.y, CARD.w, CARD.h, 'inset');
    this.card = CARD_LINES_Y.map((y) => createLabel(this, CARD_TEXT_X, y, ''));
    rt.entered('select');
    this.update();
  }

  override update(): void {
    this.backdrop?.update(this.rt.step.tick);
    const selected = this.rt.selectedCharacter;
    for (const cell of this.cells) {
      const isSelected = cell.character === selected;
      cell.panel.setStyle(isSelected ? 'accent' : 'raised');
      cell.name.setColor(TONE_CSS[isSelected ? 'sun' : 'foam']);
    }
    const ability = ABILITY_TEXT[CHARACTERS[selected].ability];
    const [name, abilityName, blurb] = this.card;
    name?.setText(racerName(selected).toUpperCase()).setColor(TONE_CSS.sun);
    abilityName?.setText(ability.name).setColor(TONE_CSS.foam);
    blurb?.setText(ability.blurb).setColor(TONE_CSS.dim);
  }
}

/** A framed grid cell at `index` in reading order, with the character's portrait and short name. */
function addCell(scene: Phaser.Scene, character: CharacterId, index: number): Cell {
  const x = GRID.x + (index % SELECT_COLUMNS) * (GRID.cellW + GRID.gap);
  const y = GRID.y + Math.floor(index / SELECT_COLUMNS) * (GRID.cellH + GRID.gap);
  const panel = createPanel(scene, x, y, GRID.cellW, GRID.cellH, 'raised');
  scene.add
    .image(x + CELL_PORTRAIT.dx, y + CELL_PORTRAIT.dy, UiTex.portraits, PortraitFrame[character])
    .setOrigin(0, 0);
  const name = createLabel(scene, x + CELL_NAME.dx, y + CELL_NAME.dy, racerShortName(character).toUpperCase());
  return { character, panel, name };
}
