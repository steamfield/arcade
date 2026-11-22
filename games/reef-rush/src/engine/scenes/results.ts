/**
 * The results screen, laid out to UI.md: the RESULTS heading, a podium with
 * the top three's portraits and medals, the standings revealed one row every
 * 20 ticks (place, character name, time or DNF; the player's row in sun with
 * its character's head beside it), then the NEW BEST or BEST NOT SAVED ribbon, and the Race again / Title
 * buttons. Motion is timed from the runtime's tick since this screen came up,
 * and holds still under reduced motion (rows still arrive in sequence).
 */
import Phaser from 'phaser';
import type { CharacterId, Racer, RacerId, World } from '../../logic/types.ts';
import { createLabel } from '../art/font.ts';
import { MedalFrame, type MedalFrameKey, PortraitFrame, UiTex } from '../art/ui/keys.ts';
import type { PanelStyle, UiToneName } from '../art/ui/palette.ts';
import { createPanel, type Panel } from '../art/ui/panel.ts';
import { MENU_OPTIONS } from '../menu.ts';
import type { RaceOutcome, Runtime } from '../runtime.ts';
import { type Backdrop, createBackdrop } from '../view/backdrop.ts';
import { createMenuView, type MenuView } from '../view/menu-view.ts';
import { formatRaceTime, ordinal, racerShortName, slideRemaining, TONE_CSS } from '../view/race-text.ts';

/** UI.md "Results" rects, in game px. */
const HEADING_CENTRE = { x: 160, y: 12 } as const;
interface Plinth {
  x: number;
  y: number;
  w: number;
  h: number;
  style: PanelStyle;
  medal: MedalFrameKey;
}
/** First, second and third place, in standings order. Portraits stand 17 px above each plinth's top. */
const PLINTHS: readonly Plinth[] = [
  { x: 140, y: 44, w: 40, h: 32, style: 'accent', medal: MedalFrame.first },
  { x: 96, y: 50, w: 40, h: 26, style: 'raised', medal: MedalFrame.second },
  { x: 184, y: 56, w: 40, h: 20, style: 'raised', medal: MedalFrame.third },
];
const PORTRAIT_RISE = 17;
const PORTRAIT_INSET_X = 12;
const MEDAL_INSET = { x: 14, y: 3 } as const;
const ROWS = { x: 120, y: 80, pitch: 10 } as const;
/** The player's 7x7 head on its row, clear of the d-pad zone (x < 108). */
const ROW_HEAD_X = 111;
const RIBBON = { x: 114, y: 120, w: 92, h: 15 } as const;
const MENU = { centreX: 160, top: 139, width: 76, pitch: 19 } as const;

/**
 * UI.md "Motion": a row every 20 ticks, sliding 8 px in from the left over 6; then the ribbon drops 2 px over
 * 10, from y 118 so it never covers the last row's outline (which ends at y 117).
 */
const ROW_EVERY_TICKS = 20;
const ROW_SLIDE = { px: 8, ticks: 6 } as const;
const RIBBON_DROP = { px: 2, ticks: 10 } as const;

/** Results scene. Reads the finished world and `Runtime.lastResult`; the runtime handles its menu input. */
export class ResultsScene extends Phaser.Scene {
  private readonly rt: Runtime;
  private menuView: MenuView | null = null;
  private standings: StandingsView | null = null;
  private ribbon: Ribbon | null = null;
  private backdrop: Backdrop | null = null;
  private enteredAt = 0;
  /** Ticks after entering at which the last standings row has slid into place. */
  private rowsSettleAt = 0;

  constructor(rt: Runtime) {
    super('results');
    this.rt = rt;
  }

  create(): void {
    const { world, lastResult, settings } = this.rt;
    if (!world || !lastResult) throw new Error('The results scene started before a race finished');
    this.backdrop = createBackdrop(this, world.level, { reducedMotion: settings.reducedMotion });
    createLabel(this, HEADING_CENTRE.x, HEADING_CENTRE.y, 'RESULTS', {
      size: 'display',
      tone: 'sun',
      outline: true,
      align: 'center',
    });
    const { standings } = lastResult.result;
    for (const [index, plinth] of PLINTHS.entries()) {
      const id = standings[index];
      if (id) addPlinth(this, racerIn(world, id).character, plinth);
    }
    this.standings = createStandings(this, world, standings);
    this.rowsSettleAt = (standings.length - 1) * ROW_EVERY_TICKS + ROW_SLIDE.ticks;
    this.ribbon = createRibbon(this);
    this.menuView = createMenuView(this, MENU, MENU_OPTIONS.results);
    this.enteredAt = this.rt.step.tick;
    this.rt.entered('results');
    this.update();
  }

  override update(): void {
    const { reducedMotion } = this.rt.settings;
    const tick = this.rt.step.tick;
    const age = tick - this.enteredAt;
    this.backdrop?.update(tick);
    this.standings?.sync(age, reducedMotion);
    // A save can fail after this screen is up, so the ribbon follows the outcome every frame.
    const note = this.rt.lastResult ? ribbonNote(this.rt.lastResult) : null;
    this.ribbon?.sync(note, age - this.rowsSettleAt, reducedMotion);
    this.menuView?.sync(this.rt.menu, tick, reducedMotion);
  }
}

/** The racer in slot `id`. Standings only list the world's own racers, so a miss is a bug. */
function racerIn(world: World, id: RacerId): Racer {
  const racer = world.racers.find((candidate) => candidate.id === id);
  if (!racer) throw new Error(`Standings list '${id}', but the race has no such racer`);
  return racer;
}

/** A podium place: its plinth, the character's portrait standing on it, and the medal on its face. */
function addPlinth(scene: Phaser.Scene, character: CharacterId, plinth: Plinth): void {
  createPanel(scene, plinth.x, plinth.y, plinth.w, plinth.h, plinth.style);
  scene.add
    .image(plinth.x + PORTRAIT_INSET_X, plinth.y - PORTRAIT_RISE, UiTex.portraits, PortraitFrame[character])
    .setOrigin(0, 0);
  scene.add.image(plinth.x + MEDAL_INSET.x, plinth.y + MEDAL_INSET.y, UiTex.medals, plinth.medal).setOrigin(0, 0);
}

/** The standings rows, revealed in order. */
interface StandingsView {
  /** `age` is ticks since the screen came up. */
  sync(age: number, reducedMotion: boolean): void;
}

/**
 * One outlined label per row, in sun for the player and foam for rivals. The player's row also gets
 * its character's 7x7 head beside it once the row has settled. The head never moves, so the only cursor fin
 * on screen is the menu's.
 */
function createStandings(scene: Phaser.Scene, world: World, standings: readonly RacerId[]): StandingsView {
  const rows = standings.map((id, index) => {
    const racer = racerIn(world, id);
    const y = ROWS.y + index * ROWS.pitch;
    const label = createLabel(scene, ROWS.x, y, rowText(racer, index + 1), {
      tone: id === 'player' ? 'sun' : 'foam',
      outline: true,
    }).setVisible(false);
    const head =
      id === 'player'
        ? scene.add.image(ROW_HEAD_X, y, UiTex.heads, PortraitFrame[racer.character]).setOrigin(0, 0).setVisible(false)
        : null;
    return { label, head };
  });
  return {
    sync(age, reducedMotion) {
      for (let index = 0; index < rows.length; index++) {
        const row = rows[index];
        if (!row) continue;
        const rowAge = age - index * ROW_EVERY_TICKS;
        const shown = rowAge >= 0;
        const still = slideRemaining(rowAge, ROW_SLIDE.px, ROW_SLIDE.ticks, reducedMotion);
        row.label.setVisible(shown).setOffset(-still, 0);
        // The head waits for its row to settle, so the sliding text never runs over it.
        row.head?.setVisible(shown && still === 0);
      }
    },
  };
}

/**
 * One standings row, e.g. "4TH  BARON 0:24.46", or "DNF" for a racer that never finished. Names are
 * the short form, at most 6 letters, so every row keeps the UI.md width.
 */
function rowText(racer: Racer, place: number): string {
  const time = racer.finished ? formatRaceTime(racer.finished.tick) : 'DNF';
  const name = racerShortName(racer.character).toUpperCase();
  return `${ordinal(place).toUpperCase().padEnd(5)}${name.padEnd(6)}${time.padStart(7)}`;
}

/** What the ribbon can say. */
interface RibbonNote {
  text: string;
  tone: UiToneName;
}
const NOT_SAVED: RibbonNote = { text: 'BEST NOT SAVED', tone: 'coral' };
const NEW_BEST: RibbonNote = { text: 'NEW BEST', tone: 'sun' };

/** What the ribbon says, if anything. A failed save wins: the best shown would be gone on reload. */
function ribbonNote(outcome: RaceOutcome): RibbonNote | null {
  if (outcome.saveFailed) return NOT_SAVED;
  return outcome.newBest ? NEW_BEST : null;
}

/** The ribbon under the standings: an inset readout, so it never reads as a selected button. */
interface Ribbon {
  /** `age` is ticks since the last row settled; the ribbon waits until then, then drops in. */
  sync(note: RibbonNote | null, age: number, reducedMotion: boolean): void;
}

/**
 * One label that drops with `setOffset`. Kit panels are placed when created, so the drop keeps a
 * panel per offset it reaches (three at most) and shows only the current one.
 */
function createRibbon(scene: Phaser.Scene): Ribbon {
  const { x, y, w, h } = RIBBON;
  const panels = new Map<number, Panel>();
  const panelAt = (dy: number) => {
    let panel = panels.get(dy);
    if (!panel) {
      panel = createPanel(scene, x, y - dy, w, h, 'inset');
      panels.set(dy, panel);
    }
    return panel;
  };
  panelAt(0).setVisible(false);
  // Depth 1 keeps the text over panels made later in the drop.
  const label = createLabel(scene, x + w / 2, y + Math.floor(h / 2), '', { align: 'center', depth: 1 });
  return {
    sync(note, age, reducedMotion) {
      const dy = note && age >= 0 ? slideRemaining(age, RIBBON_DROP.px, RIBBON_DROP.ticks, reducedMotion) : null;
      for (const [offset, panel] of panels) panel.setVisible(offset === dy);
      label.setVisible(dy !== null);
      if (dy === null || !note) return;
      panelAt(dy).setVisible(true);
      label.setOffset(0, -dy).setColor(TONE_CSS[note.tone]).setText(note.text);
    },
  };
}
