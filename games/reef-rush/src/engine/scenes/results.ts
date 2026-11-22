/**
 * The results screen, laid out to UI.md: the RESULTS heading, a podium with
 * the top three's portraits and medals, the standings revealed one row every
 * 20 ticks (place, name, time or DNF; the player's row in sun with the cursor
 * fin), then the NEW BEST or BEST NOT SAVED ribbon, and the Race again / Title
 * buttons. Motion is timed from the runtime's tick since this screen came up,
 * and holds still under reduced motion (rows still arrive in sequence).
 */
import Phaser from 'phaser';
import type { RacerId, World } from '../../logic/types.ts';
import { createLabel, type Label } from '../art/font.ts';
import { IconFrame, MedalFrame, type MedalFrameKey, UiTex } from '../art/ui/keys.ts';
import { cursorNudge } from '../art/ui/motion.ts';
import { type PanelStyle, toneCss, type UiToneName } from '../art/ui/palette.ts';
import { createPanel, type Panel } from '../art/ui/panel.ts';
import { MENU_OPTIONS } from '../menu.ts';
import type { RaceOutcome, Runtime } from '../runtime.ts';
import { type Backdrop, createBackdrop } from '../view/backdrop.ts';
import { createMenuView, type MenuView } from '../view/menu-view.ts';
import { createSlidingLabel, formatRaceTime, ordinal, racerName, slideRemaining } from '../view/race-text.ts';

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
const ROW_FIN_X = 109;
const RIBBON = { x: 114, y: 120, w: 92, h: 15 } as const;
const MENU = { centreX: 160, top: 139, width: 76, pitch: 19 } as const;

/** UI.md "Motion": a row every 20 ticks, sliding 8 px in from the left over 6; the ribbon drops 4 px over 10 after. */
const ROW_EVERY_TICKS = 20;
const ROW_SLIDE = { px: 8, ticks: 6 } as const;
const RIBBON_DROP = { px: 4, ticks: 10 } as const;

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
      if (id) addPlinth(this, id, plinth);
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
    this.standings?.sync(age, tick, reducedMotion);
    // A save can fail after this screen is up, so the ribbon follows the outcome every frame.
    const note = this.rt.lastResult ? ribbonNote(this.rt.lastResult) : null;
    this.ribbon?.sync(note, age - this.rowsSettleAt, reducedMotion);
    this.menuView?.sync(this.rt.menu, tick, reducedMotion);
  }
}

/** A podium place: its plinth, the racer's portrait standing on it, and the medal on its face. */
function addPlinth(scene: Phaser.Scene, id: RacerId, plinth: Plinth): void {
  createPanel(scene, plinth.x, plinth.y, plinth.w, plinth.h, plinth.style);
  scene.add.image(plinth.x + PORTRAIT_INSET_X, plinth.y - PORTRAIT_RISE, UiTex.portraits, id).setOrigin(0, 0);
  scene.add.image(plinth.x + MEDAL_INSET.x, plinth.y + MEDAL_INSET.y, UiTex.medals, plinth.medal).setOrigin(0, 0);
}

/** The standings rows, revealed in order. */
interface StandingsView {
  /** `age` is ticks since the screen came up; `tick` drives the fin's nudge. */
  sync(age: number, tick: number, reducedMotion: boolean): void;
}

function createStandings(scene: Phaser.Scene, world: World, standings: readonly RacerId[]): StandingsView {
  const rows = standings.map((id, index) => {
    const y = ROWS.y + index * ROWS.pitch;
    const label = createSlidingLabel(scene, ROWS.x, y, { outline: true });
    const tone: UiToneName = id === 'player' ? 'sun' : 'foam';
    return { y, label, tone, text: rowText(world, id, index + 1), isPlayer: id === 'player' };
  });
  const fin = scene.add.image(ROW_FIN_X, 0, UiTex.icons, IconFrame.cursorFin).setOrigin(0, 0).setVisible(false);
  return {
    sync(age, tick, reducedMotion) {
      rows.forEach((row, index) => {
        const rowAge = age - index * ROW_EVERY_TICKS;
        const shown = rowAge >= 0;
        const dx = -slideRemaining(rowAge, ROW_SLIDE.px, ROW_SLIDE.ticks, reducedMotion);
        row.label.show(shown ? row.text : '', row.tone, dx);
        if (!row.isPlayer) return;
        // The fin doesn't slide with its row: starting 8 px left it would sit in the d-pad zone.
        fin.setVisible(shown).setPosition(ROW_FIN_X + cursorNudge(tick, reducedMotion), row.y - 1);
      });
    },
  };
}

/** One standings row, e.g. "4TH  SQUIB 0:24.46", or "DNF" for a racer that never finished. */
function rowText(world: World, id: RacerId, place: number): string {
  const finish = world.racers.find((racer) => racer.id === id)?.finished;
  const time = finish ? formatRaceTime(finish.tick) : 'DNF';
  return `${ordinal(place).toUpperCase().padEnd(5)}${racerName(id).toUpperCase().padEnd(6)}${time.padStart(7)}`;
}

/** What the ribbon says, if anything. A failed save wins: the best shown would be gone on reload. */
function ribbonNote(outcome: RaceOutcome): { text: string; tone: UiToneName } | null {
  if (outcome.saveFailed) return { text: 'BEST NOT SAVED', tone: 'coral' };
  return outcome.newBest ? { text: 'NEW BEST', tone: 'sun' } : null;
}

/** The gold ribbon under the standings. */
interface Ribbon {
  /** `age` is ticks since the last row settled; the ribbon waits until then, then drops in. */
  sync(note: { text: string; tone: UiToneName } | null, age: number, reducedMotion: boolean): void;
}

/**
 * Panels and labels are placed when created, so the drop keeps one ribbon per offset (five at
 * most) and shows only the current one.
 */
function createRibbon(scene: Phaser.Scene): Ribbon {
  const byOffset = new Map<number, { panel: Panel; label: Label }>();
  const ribbonAt = (dy: number) => {
    let ribbon = byOffset.get(dy);
    if (!ribbon) {
      const { x, y, w, h } = RIBBON;
      const panel = createPanel(scene, x, y - dy, w, h, 'accent');
      const label = createLabel(scene, x + w / 2, y - dy + Math.floor(h / 2), '', { align: 'center' });
      ribbon = { panel, label };
      byOffset.set(dy, ribbon);
    }
    return ribbon;
  };
  return {
    sync(note, age, reducedMotion) {
      const dy = note && age >= 0 ? slideRemaining(age, RIBBON_DROP.px, RIBBON_DROP.ticks, reducedMotion) : null;
      for (const [offset, { panel, label }] of byOffset) {
        if (offset === dy) continue;
        panel.setVisible(false);
        label.setVisible(false);
      }
      if (dy === null || !note) return;
      const { panel, label } = ribbonAt(dy);
      panel.setVisible(true);
      label.setVisible(true).setColor(toneCss(note.tone)).setText(note.text);
    },
  };
}
