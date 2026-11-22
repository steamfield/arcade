/**
 * The results screen: final standings with each racer's name and time (or
 * DNF), the player's row highlighted, a note for a new best or a failed save,
 * and the "Race again" / "Title" menu.
 */
import Phaser from 'phaser';
import type { RacerId, World } from '../../logic/types.ts';
import { createLabel, type Label } from '../art/font.ts';
import { MENU_OPTIONS } from '../menu.ts';
import type { RaceOutcome, Runtime } from '../runtime.ts';
import { createMenuView, type MenuView } from '../view/menu-view.ts';
import { formatRaceTime, ordinal, racerName } from '../view/race-text.ts';

const ROWS_TOP = 42;
const ROW_HEIGHT = 13;
const PLAYER_COLOUR = '#ffd23f';
const RIVAL_COLOUR = '#cfe9ff';

/** Results scene. Reads the finished world and `Runtime.lastResult`; the runtime handles its menu input. */
export class ResultsScene extends Phaser.Scene {
  private readonly rt: Runtime;
  private menuView: MenuView | null = null;
  private saveNote: Label | null = null;

  constructor(rt: Runtime) {
    super('results');
    this.rt = rt;
  }

  create(): void {
    const { world, lastResult } = this.rt;
    if (!world || !lastResult) throw new Error('The results scene started before a race finished');
    const { width } = this.cameras.main;
    this.cameras.main.setBackgroundColor('#0b3d6b');
    createLabel(this, width / 2, 20, 'RESULTS', { size: 'large', color: '#ffd23f', align: 'center' });
    for (const [index, id] of lastResult.result.standings.entries()) this.addRow(world, id, index);
    this.saveNote = createLabel(this, width / 2, 104, noteText(lastResult), { size: 'medium', align: 'center' });
    this.menuView = createMenuView(this, width / 2, 130, MENU_OPTIONS.results);
    this.rt.entered('results');
  }

  override update(): void {
    this.menuView?.sync(this.rt.menu);
    // A save can fail after this screen is up, so the note follows the outcome every frame.
    if (this.rt.lastResult) this.saveNote?.setText(noteText(this.rt.lastResult));
  }

  private addRow(world: World, id: RacerId, index: number): void {
    const finish = world.racers.find((racer) => racer.id === id)?.finished;
    const time = finish ? formatRaceTime(finish.tick) : 'DNF';
    const isPlayer = id === 'player';
    const text = `${isPlayer ? '>' : ' '} ${ordinal(index + 1).padEnd(4)} ${racerName(id).padEnd(6)} ${time.padStart(8)}`;
    createLabel(this, 90, ROWS_TOP + index * ROW_HEIGHT, text, {
      size: 'medium',
      color: isPlayer ? PLAYER_COLOUR : RIVAL_COLOUR,
    });
  }
}

function noteText(outcome: RaceOutcome): string {
  if (outcome.saveFailed) return 'Best time not saved';
  return outcome.newBest ? 'New best!' : '';
}
