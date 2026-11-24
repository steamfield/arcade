/**
 * The state the engine shares and the only place logic ticks. `Runtime` owns the event log, the
 * world, the fixed step, the scene flow (title, select, race, results), the select cursor, the
 * saved character and bests, and the save queue. It has no three.js or DOM in it, so Vitest drives
 * it directly. The engine supplies where input comes from and what to do after each tick.
 */
import { createLogger, EventLog, FixedStep, type Logger } from '@arcade/core';
import type { SaveStore } from '@arcade/save';
import type { GameEvent } from '../logic/events.ts';
import { hashWorld } from '../logic/hash.ts';
import { NEW_SAVE, type SaveData } from '../logic/save.ts';
import type { CharacterId, Course, TickInput, World } from '../logic/types.ts';
import { createWorld, stepWorld, summarize, withBest } from '../logic/world.ts';
import { applyStage, type StageName } from './capture-stages.ts';

const SAVE_SLOT = 'main';

/** Events the engine adds to the logic's own. */
export type EngineEvent =
  | { type: 'best.new'; course: string; ticks: number }
  | { type: 'race.restarted' }
  | { type: 'save.written' }
  | { type: 'save.failed'; reason: string };

/** Which screen is up. */
export type Scene = 'title' | 'select' | 'race' | 'results';

/** Fresh presses that move around the menus. `back` is the dash button. */
export interface MenuInput {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  back: boolean;
}

/** One tick's input: the racer's controls, a fresh press of the confirm button (fire), and menu presses for screens. */
export interface FrameInput {
  race: TickInput;
  confirmPressed: boolean;
  menu: MenuInput;
}

/** Ticks after `race.ended` before results accept confirm, so a button held across the line doesn't skip them. */
export const RESULTS_CONFIRM_DELAY_TICKS = 30;

/** What a `Runtime` needs from the engine around it. */
export interface RuntimeOptions {
  /** The game's manifest id, the namespace its log lines carry. */
  gameId: string;
  saves: SaveStore<SaveData>;
  course: Course;
  /** Seed for each race's world (`?seed=`). */
  seed: number;
  /** Character to race as when the launch asks for one (`?character=`), else the save's. */
  character: CharacterId | null;
  /** Shows the player a message that doesn't stop the game. */
  notice: (message: string) => void;
  /** Read once per logic tick. */
  readInput: () => FrameInput;
  /** Called after every logic tick with the world, to move the camera and views. */
  afterTick: (world: World) => void;
  /** A capture stage to put each race's world in. A staged session never writes a save. */
  stage: StageName | null;
  /** The screen the session opens on: `race` for `?scene=race` or any stage, else `title`. */
  startScene: 'title' | 'race';
}

/** The game's state and clock. Create one with {@link Runtime.start}. */
export class Runtime {
  readonly events = new EventLog<GameEvent | EngineEvent>();
  world!: World;
  scene: Scene = 'race';
  /** The character races use: the save's (or `?character=`) until the player picks one on select. */
  character!: CharacterId;
  /** On `select`, the highlighted card's index in `CHARACTER_IDS` (a 4x2 grid, row by row). */
  cursor = 0;
  /** Best finish per course id, race ticks: the save's, updated as races finish. */
  bests: SaveData['bests'] = {};
  /** True when the loaded save was unreadable or newer than this code: it is never overwritten. */
  protected saveBlocked = false;
  protected readonly options: RuntimeOptions;
  protected readonly log: Logger;
  protected readonly step: FixedStep;
  private resultsTick = 0;
  private writes: Promise<void> = Promise.resolve();
  private writesPending = 0;

  protected constructor(options: RuntimeOptions) {
    this.options = options;
    this.log = createLogger(options.gameId);
    this.step = new FixedStep((dt) => this.tickOnce(dt));
  }

  /**
   * Loads the save (or starts fresh), notices the player when it can't be loaded or kept, and builds
   * the first race's world in countdown. An unreadable or newer save is never overwritten.
   */
  static async start(options: RuntimeOptions): Promise<Runtime> {
    const runtime = new Runtime(options);
    const loaded = await options.saves.load(SAVE_SLOT);
    if (loaded.kind === 'unreadable' || loaded.kind === 'newer-than-code') {
      options.notice('Your saved progress could not be loaded, so it will not be overwritten.');
      runtime.saveBlocked = true;
    } else if (options.saves.status === 'memory-only') {
      options.notice('Progress will not be saved in this browser mode.');
    }
    const save = loaded.kind === 'ok' ? loaded.data : NEW_SAVE;
    runtime.character = options.character ?? save.character;
    runtime.bests = { ...save.bests };
    runtime.newRace();
    runtime.scene = options.startScene;
    return runtime;
  }

  /** Replaces the world with a fresh one in countdown, staged when the session is. */
  protected newRace(): void {
    this.world = createWorld(this.events, {
      course: this.options.course,
      seed: this.options.seed,
      character: this.character,
      rivals: false,
    });
    if (this.options.stage) applyStage(this.world, this.options.stage);
    this.scene = 'race';
  }

  /** Runs the logic ticks that `seconds` of real time are worth. */
  frame(seconds: number): void {
    this.step.frame(seconds);
  }

  /** Runs `ticks` logic ticks. Returns how many ran. */
  advance(ticks: number): number {
    this.step.advance(ticks);
    return ticks;
  }

  /** True while a save write is queued or running. The engine's `idle()` includes it. */
  get saving(): boolean {
    return this.writesPending > 0;
  }

  /** Resolves when every write queued so far has finished. */
  settled(): Promise<void> {
    return this.writes;
  }

  /** A small stable view of the world for the CLI summary. */
  summary() {
    return { ...summarize(this.world), scene: this.scene, save: this.options.saves.status };
  }

  /** One number for the whole logic state, equal across runs and browsers that played the same ticks. */
  worldHash(): number {
    return hashWorld(this.world);
  }

  protected tickOnce(dt: number): void {
    const tick = this.step.tick;
    this.events.tick = tick;
    const frame = this.options.readInput();
    switch (this.scene) {
      case 'title':
      case 'select':
        // Phase 2 lane a: title goes to select on confirm; select moves the cursor, saves and races.
        break;
      case 'race':
        stepWorld(this.world, { player: frame.race }, dt);
        if (this.world.phase === 'finished') this.showResults(tick);
        break;
      case 'results':
        if (frame.confirmPressed && tick - this.resultsTick >= RESULTS_CONFIRM_DELAY_TICKS) {
          this.newRace();
          this.events.emit({ type: 'race.restarted' });
        }
        break;
      default:
        this.scene satisfies never;
    }
    this.options.afterTick(this.world);
  }

  private showResults(tick: number): void {
    this.scene = 'results';
    this.resultsTick = tick;
    if (this.options.stage !== null) return;

    const bests = withBest(this.world, this.bests);
    if (bests !== this.bests) {
      this.bests = bests;
      const course = this.world.course.id;
      const ticks = bests[course];
      if (ticks !== undefined) this.events.emit({ type: 'best.new', course, ticks });
    }
    if (!this.saveBlocked) this.persist();
  }

  private persist(): void {
    const data = { character: this.character, bests: { ...this.bests } };
    this.writesPending++;
    this.writes = this.writes.then(() => this.write(data));
  }

  private async write(data: SaveData): Promise<void> {
    try {
      const result = await this.options.saves.save(SAVE_SLOT, data);
      if (result.ok) this.events.emit({ type: 'save.written' });
      else this.failWrite(result.reason);
    } catch (error) {
      this.failWrite(error instanceof Error ? error.message : String(error));
    } finally {
      this.writesPending--;
    }
  }

  private failWrite(reason: string): void {
    this.log.warn(`race progress not saved: ${reason}`);
    this.events.emit({ type: 'save.failed', reason });
  }
}
