/**
 * The state the engine shares and the only place logic ticks. `Runtime` owns the event log, the
 * world, the fixed step and the save queue, and has no three.js, Rapier or DOM in it, so Vitest
 * drives it directly. The engine supplies three hooks: where input comes from, whether it is ready
 * to tick (physics loaded), and what to do after each tick (step physics, move the camera).
 */
import { createLogger, createRng, EventLog, FixedStep, hashState } from '@arcade/core';
import type { SaveStore } from '@arcade/save';
import type { GameEvent } from '../logic/events.ts';
import type { SaveData } from '../logic/save.ts';
import { createWorld, stepWorld, summarize, type TickInput, toSave, type World } from '../logic/world.ts';
import { applyStage, type StageName } from './debug-stage.ts';

const SAVE_SLOT = 'main';
const NEW_GAME_SEED_MAX = 1_000_000;
const log = createLogger('three-3d');

/** Events the engine adds to the logic's own. */
export type EngineEvent =
  | { type: 'physics.ready' }
  | { type: 'save.written' }
  | { type: 'save.failed'; reason: string };

/** What a `Runtime` needs from the engine around it. */
export interface RuntimeOptions {
  saves: SaveStore<SaveData>;
  /** Seed for a new game's orb layout (`?seed=`). A saved game keeps its own. */
  seed: number;
  /** Shows the player a message that doesn't stop the game. */
  notice: (message: string) => void;
  /** Reports a failure that isn't an exception the shell would catch. */
  reportError: (kind: string, error: unknown) => void;
  /** Read once per logic tick. */
  readInput: () => TickInput;
  /** True when ticks may run. The engine returns false while physics is loading. */
  isReady: () => boolean;
  /** Called after every logic tick with the world, to step engine-side physics and the camera. */
  afterTick: (world: World) => void;
  /** A capture stage to put the world in. A staged world is never saved. */
  stage: StageName | null;
}

/** The game's state and clock. Create one with {@link Runtime.start}. */
export class Runtime {
  readonly events = new EventLog<GameEvent | EngineEvent>();
  world: World;
  private readonly options: RuntimeOptions;
  private readonly step: FixedStep;
  private staged: boolean;
  /** The last queued save write. New writes chain onto it so they never overlap. */
  private writes: Promise<void> = Promise.resolve();

  private constructor(options: RuntimeOptions, save: SaveData) {
    this.options = options;
    this.world = createWorld(this.events, save);
    this.staged = options.stage !== null;
    if (options.stage) applyStage(this.world, options.stage);
    this.step = new FixedStep((dt) => this.tickOnce(dt));
  }

  /** Loads the saved game, or starts a new one, and builds the runtime around it. */
  static async start(options: RuntimeOptions): Promise<Runtime> {
    const loaded = await options.saves.load(SAVE_SLOT);
    if (loaded.kind === 'unreadable' || loaded.kind === 'newer-than-code') {
      options.notice('Your saved progress could not be loaded, so it will not be overwritten.');
    } else if (options.saves.status === 'memory-only') {
      options.notice('Progress will not be saved in this browser mode.');
    }
    const save =
      loaded.kind === 'ok' ? loaded.data : { seed: createRng(options.seed).int(1, NEW_GAME_SEED_MAX), collected: [] };
    return new Runtime(options, save);
  }

  /** Runs the logic ticks that `seconds` of real time are worth, or none while the engine isn't ready. */
  frame(seconds: number): void {
    if (!this.options.isReady()) return;
    this.step.frame(seconds);
  }

  /** Runs up to `ticks` logic ticks, stopping early while the engine isn't ready. Returns how many ran. */
  advance(ticks: number): number {
    let ran = 0;
    while (ran < ticks && this.options.isReady()) {
      this.step.advance(1);
      ran++;
    }
    return ran;
  }

  /**
   * Replaces the world with one built from an imported save. The result is saveable again.
   *
   * @throws {Error} When the save store rejects the save.
   */
  async loadSave(save: unknown): Promise<void> {
    const result = await this.options.saves.importJson(SAVE_SLOT, JSON.stringify(save));
    if (result.kind !== 'ok') throw new Error(`Fixture rejected by save store: ${JSON.stringify(result)}`);
    this.world = createWorld(this.events, result.data);
    this.staged = false;
  }

  /** Queues a write of the current world; resolves once it is written or has failed. A staged world is not written. */
  persist(): Promise<void> {
    if (this.staged) return this.writes;
    const data = toSave(this.world);
    this.writes = this.writes.then(() => this.write(data));
    return this.writes;
  }

  /** A small stable view of the world for the CLI summary. */
  summary() {
    return { ...summarize(this.world), save: this.options.saves.status };
  }

  /** One number for the whole logic state, equal across runs and browsers that played the same ticks. */
  worldHash(): number {
    return hashState(this.world, { skipKeys: new Set(['events']) });
  }

  private tickOnce(dt: number): void {
    this.events.tick = this.step.tick;
    const collectedBefore = this.world.collected.size;
    stepWorld(this.world, this.options.readInput(), dt);
    this.options.afterTick(this.world);
    if (this.world.collected.size !== collectedBefore) void this.persist();
  }

  private async write(data: SaveData): Promise<void> {
    try {
      const result = await this.options.saves.save(SAVE_SLOT, data);
      if (result.ok) {
        this.events.emit({ type: 'save.written' });
        return;
      }
      log.warn(`save failed: ${result.reason}`);
      this.events.emit({ type: 'save.failed', reason: result.reason });
    } catch (error) {
      this.options.reportError('save', error);
    }
  }
}
