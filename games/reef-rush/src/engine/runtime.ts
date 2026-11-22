/**
 * The state the scenes share and the only place logic ticks. `Runtime` owns the
 * event log, the fixed step, the current scene, the race world, the save and
 * settings. Each tick it reads input, advances whichever screen is active, then
 * drains the tick's events once and hands them to audio and any listening view.
 * Scenes render from it and never change gameplay themselves.
 */
import { createLogger, EventLog, FixedStep, type Stamped } from '@arcade/core';
import type { SaveStore } from '@arcade/save';
import type { GameContext } from '@arcade/shell';
import type { GameEvent } from '../logic/events.ts';
import { OCEAN_LEVEL } from '../logic/level/levels.ts';
import { parseLevel } from '../logic/level/parse.ts';
import { isNewBest, recordResult } from '../logic/records.ts';
import { NEW_GAME, type SaveData } from '../logic/save.ts';
import type { RaceResult, TickInput, World } from '../logic/types.ts';
import { createWorld, stepWorld } from '../logic/world.ts';
import { type AudioPort, createAudio } from './audio/index.ts';
import { input } from './input.ts';
import { createMenu, MENU_OPTIONS, type Menu, type MenuOption, moveSelection, selectedOption } from './menu.ts';

export type SceneKey = 'boot' | 'title' | 'race' | 'results';

/** Events the engine adds on top of the world's. */
export type EngineEvent =
  | { type: 'scene.started'; scene: SceneKey }
  | { type: 'menu.selected'; option: MenuOption }
  | { type: 'save.written' }
  | { type: 'save.failed'; reason: string };

/** Everything that can appear in the runtime's event log. */
export type RuntimeEvent = GameEvent | EngineEvent;

/** Player settings with `reducedMotion` resolved from the save, or from the OS when the save leaves it null. */
export interface Settings {
  muted: boolean;
  reducedMotion: boolean;
}

/** How the last race went, for the results screen. */
export interface RaceOutcome {
  result: RaceResult;
  newBest: boolean;
  /** True once a `save.failed` for this race's write has been drained. */
  saveFailed: boolean;
}

/** Receives each tick's drained events. Views use it for event-driven visuals such as broken coral. */
export type EventListener = (events: readonly Stamped<RuntimeEvent>[]) => void;

export interface RuntimeOptions {
  ctx: GameContext;
  saves: SaveStore<SaveData>;
  /** The loaded save, or null when there is none or it could not be read. */
  save: SaveData | null;
  /** The OS prefers-reduced-motion answer, read once at boot. */
  prefersReducedMotion: boolean;
  /** Stops the running scenes and starts `scene`. Phaser does the switch; the runtime only asks for it. */
  startScene(scene: SceneKey): void;
}

export const SAVE_SLOT = 'main';

/** Ticks between `race.finished` and the results screen, so the finish can be seen. */
const RESULTS_DELAY_TICKS = 90;

const MENUS: Partial<Record<SceneKey, readonly MenuOption[]>> = MENU_OPTIONS;

const log = createLogger('reef-rush');

/** Shared engine state. Logic changes only inside the FixedStep callback. */
export class Runtime {
  readonly events = new EventLog<RuntimeEvent>();
  readonly step = new FixedStep((dt) => this.tick(dt));
  scene: SceneKey = 'boot';
  /** True between asking for a scene and that scene's create(); ticks wait while it is set. */
  loading = true;
  world: World | null = null;
  save: SaveData | null;
  lastResult: RaceOutcome | null = null;
  /** The active screen's menu, or null on screens without one. */
  menu: Menu | null = null;
  readonly audio: AudioPort;
  readonly ctx: GameContext;

  private readonly saves: SaveStore<SaveData>;
  private readonly prefersReducedMotion: boolean;
  private readonly startScene: (scene: SceneKey) => void;
  private readonly listeners = new Set<EventListener>();
  private cursor = 0;
  /** Ticks left before the results screen, or null when no race has finished. */
  private resultsIn: number | null = null;

  constructor(options: RuntimeOptions) {
    this.ctx = options.ctx;
    this.saves = options.saves;
    this.save = options.save;
    this.prefersReducedMotion = options.prefersReducedMotion;
    this.startScene = options.startScene;
    this.audio = createAudio(options.ctx, this.settings);
  }

  /** Settings from the save, with a null `reducedMotion` following the OS. */
  get settings(): Settings {
    const saved = (this.save ?? NEW_GAME).settings;
    return { muted: saved.muted, reducedMotion: saved.reducedMotion ?? this.prefersReducedMotion };
  }

  /** Feeds a rendered frame's wall time to the fixed step. Does nothing in test mode, where the shell calls advance(). */
  frame(deltaMs: number): void {
    if (!this.ctx.params.testMode) this.step.frame(deltaMs / 1000);
  }

  /** Switches scenes. Ticks pause until the new scene calls `entered`. */
  goTo(scene: SceneKey): void {
    this.loading = true;
    this.menu = null;
    this.startScene(scene);
  }

  /** Called from a scene's create() once it is ready to show. */
  entered(scene: SceneKey): void {
    this.scene = scene;
    this.loading = false;
    const options = MENUS[scene];
    this.menu = options ? createMenu(options) : null;
    this.events.emit({ type: 'scene.started', scene });
  }

  /** Builds a fresh world on the course and starts the race scene at the countdown. */
  startRace(): void {
    this.world = createWorld(parseLevel(OCEAN_LEVEL), this.events, { seed: this.ctx.params.seed });
    this.lastResult = null;
    this.resultsIn = null;
    this.goTo('race');
  }

  /** Writes `data` to the save slot, emitting `save.written` or `save.failed`. The race carries on either way. */
  async persist(data: SaveData): Promise<void> {
    const outcome = await this.saves.save(SAVE_SLOT, data);
    if (outcome.ok) {
      this.save = data;
      this.events.emit({ type: 'save.written' });
      return;
    }
    log.warn(`Best time not saved: ${outcome.reason}`);
    this.events.emit({ type: 'save.failed', reason: outcome.reason });
  }

  /** Calls `listener` with every later tick's drained events. Returns the function that stops it. */
  listen(listener: EventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private tick(dt: number): void {
    if (this.loading) return;
    this.events.tick = this.step.tick;
    input.update();
    if (this.menu) this.tickMenu(this.menu);
    else if (this.scene === 'race') this.tickRace(dt);
    this.dispatchEvents();
  }

  private tickMenu(menu: Menu): void {
    if (input.justPressed('down')) moveSelection(menu, 1);
    if (input.justPressed('up')) moveSelection(menu, -1);
    if (!input.justPressed('kick')) return;
    const option = selectedOption(menu);
    this.events.emit({ type: 'menu.selected', option });
    if (option === 'Title') this.goTo('title');
    else this.startRace();
  }

  private tickRace(dt: number): void {
    const world = this.world;
    if (!world) throw new Error('The race scene is ticking without a world; start races with startRace()');
    stepWorld(world, readPlayerInput(), dt);
    if (this.resultsIn === null) return;
    this.resultsIn--;
    if (this.resultsIn <= 0) this.goTo('results');
  }

  private dispatchEvents(): void {
    const { events, cursor } = this.events.drain(this.cursor);
    this.cursor = cursor;
    for (const event of events) this.react(event);
    this.audio.onEvents(events);
    for (const listener of this.listeners) listener(events);
  }

  private react(event: RuntimeEvent): void {
    if (event.type === 'race.finished') this.finishRace(event);
    else if (event.type === 'save.failed' && this.lastResult)
      this.lastResult = { ...this.lastResult, saveFailed: true };
  }

  private finishRace({ standings, playerPlace, playerTicks }: RaceResult): void {
    const result: RaceResult = { standings, playerPlace, playerTicks };
    const before = this.save ?? NEW_GAME;
    this.lastResult = { result, newBest: isNewBest(before, result), saveFailed: false };
    this.resultsIn = RESULTS_DELAY_TICKS;
    this.persist(recordResult(before, result)).catch((error: unknown) => this.ctx.reportError('save', error));
  }
}

/** The player's input this tick as plain data for `stepWorld`. */
function readPlayerInput(): TickInput {
  const move = input.vector('move');
  return { move: { x: move.x, y: move.y }, kick: input.justPressed('kick'), burst: input.justPressed('burst') };
}
