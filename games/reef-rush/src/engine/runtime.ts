/**
 * The state the scenes share and the only place logic ticks. `Runtime` owns the
 * event log, the fixed step, the current scene, the race world, the save and
 * settings. Each tick it reads input, advances whichever screen is active, then
 * drains the tick's events once and hands them to audio and any listening view.
 * Scenes render from it and never change gameplay themselves.
 *
 * Screens: title, then course select (pick a course; skipped while only one course is listed),
 * then select (pick a character; kick races, burst goes back), then race and results. Race again
 * skips both selects and races the same course and pick. The title also opens How to Play, a few
 * pages the player turns with the move and action buttons.
 */
import { createLogger, EventLog, FixedStep, type Stamped } from '@arcade/core';
import type { SaveStore } from '@arcade/save';
import type { GameContext } from '@arcade/shell';
import { courseById, DEFAULT_COURSE, LISTED_COURSES } from '../logic/courses/index.ts';
import type { Course } from '../logic/courses/types.ts';
import type { GameEvent } from '../logic/events.ts';
import { playerOf } from '../logic/racers.ts';
import { isNewBest, recordRace } from '../logic/records.ts';
import { NEW_GAME, type SaveData } from '../logic/save.ts';
import {
  type CharacterId,
  DIFFICULTIES,
  type Difficulty,
  type RaceResult,
  type RacerId,
  type TickInput,
  type World,
} from '../logic/types.ts';
import { createWorld, stepWorld } from '../logic/world.ts';
import { withinHearing } from './audio/attack-sfx.ts';
import { type AudioPort, createAudio } from './audio/index.ts';
import { moveCharacter } from './character-select.ts';
import { applyStage, stageFor } from './debug-stage.ts';
import { type PagePress, turnPage } from './how-to-play.ts';
import { input } from './input.ts';
import { createMenu, MENU_OPTIONS, type Menu, type MenuOption, moveSelection, selectedOption } from './menu.ts';
import { raceProgress } from './race-progress.ts';
import { assertCourseAssets } from './themes/course-assets.ts';
import {
  type HintConfig,
  type HintMemory,
  type HintState,
  hintConfig,
  NO_HINTS,
  newHintMemory,
  updateHints,
} from './view/hints.ts';

/** Phaser scene keys, one per screen. */
export type SceneKey = 'boot' | 'title' | 'howToPlay' | 'course' | 'select' | 'race' | 'results';

/** Events the engine adds on top of the world's. */
export type EngineEvent =
  | { type: 'scene.started'; scene: SceneKey }
  | { type: 'menu.selected'; option: MenuOption }
  /** How to Play turned to another page; `page` is 1-based, as the summary shows it. */
  | { type: 'howToPlay.page'; page: number }
  | { type: 'save.written' }
  | { type: 'save.failed'; reason: string }
  /** The player changed a setting from the title menu; carries the settings now in force. */
  | { type: 'settings.changed'; muted: boolean; reducedMotion: boolean; difficulty: Difficulty }
  /** A sound actually started: once per SFX and once per song start or section change, never per note. */
  | { type: 'audio.played'; key: string; kind: 'sfx' | 'song' };

/** Everything that can appear in the runtime's event log. */
export type RuntimeEvent = GameEvent | EngineEvent;

/** Player settings with `reducedMotion` resolved from the save, or from the OS when the save leaves it null. */
export interface Settings {
  muted: boolean;
  reducedMotion: boolean;
  /** How hard the rivals race; each new race builds its world with it. */
  difficulty: Difficulty;
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

/** What the runtime needs from the outside: the shell context, saves, the OS motion setting and a scene switcher. */
export interface RuntimeOptions {
  ctx: GameContext;
  saves: SaveStore<SaveData>;
  /** The loaded save, or null when there is none or it could not be read. */
  save: SaveData | null;
  /** The OS prefers-reduced-motion answer, read once at boot. */
  prefersReducedMotion: boolean;
  /** Stops the running scenes and starts `scene`. Phaser does the switch; the runtime only asks for it. */
  startScene(scene: SceneKey): void;
  /** The page's query string (`location.search`), read for `?course=` and `?stage=`. Empty when there is none. */
  search?: string;
}

/** The one save slot Reef Rush uses. */
export const SAVE_SLOT = 'main';

/** Ticks between `race.finished` and the results screen, so the finish can be seen. */
const RESULTS_DELAY_TICKS = 90;
/** Ticks a menu ignores kick after its screen appears, so a kick still being mashed from the race can't pick an option unseen. */
const MENU_ARM_TICKS = 20;

const MENUS: Partial<Record<SceneKey, readonly MenuOption[]>> = MENU_OPTIONS;

/** Course select only shows when there is a choice to make; while it is skipped, screens don't name the course either. */
export const COURSE_SELECT_SHOWN = LISTED_COURSES.length > 1;

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
  /**
   * The character under the select screen's cursor, and who the next race is run as. Starts at the
   * saved pick, and goes back to it each time the select screen opens.
   */
  selectedCharacter: CharacterId;
  /** The course the next race runs on: `?course=`, else the save's last listed course, else the default. Race again keeps it. */
  course: Course;
  /** The course select cursor, an index into `LISTED_COURSES`; put on the current course each time the screen opens. */
  courseCursor = 0;
  readonly audio: AudioPort;
  /** True when the current race was staged for a capture (`?stage=`); its result is never saved. */
  staged = false;
  /** The page How to Play shows, 0-based; back to the first page each time the screen opens. */
  howToPage = 0;
  /** The logic tick the current How to Play page came up on, so its animation starts from its first moment however many frames were drawn. */
  howToSince = 0;
  /** The in-race hints showing now, refreshed each racing tick; none outside a race. */
  hints: HintState = NO_HINTS;
  /** Save writes asked for and not yet settled. */
  private writesPending = 0;
  /** Where the write queue ends: each write starts once the one before it has settled. */
  private writeQueue: Promise<void> = Promise.resolve();
  /** Counts write requests, so a write can tell whether a newer one was asked for after it. */
  private writesRequested = 0;
  /** The player's progress-field distance at the start line, for the race progress fraction. */
  private startProgress = 0;
  private hintMemory: HintMemory = newHintMemory();
  /** The menu option to put the cursor on when the next menu screen opens, or null for the first. */
  private returnTo: MenuOption | null = null;
  private hintConfig: HintConfig = { enabled: false, easy: false };

  /** How far the player is through the current race, 0 to 1; 0 with no race. */
  get raceFraction(): number {
    return this.world ? raceProgress(this.world, this.startProgress) : 0;
  }
  readonly ctx: GameContext;

  private readonly saves: SaveStore<SaveData>;
  private readonly prefersReducedMotion: boolean;
  private readonly startScene: (scene: SceneKey) => void;
  private readonly search: string;
  private readonly listeners = new Set<EventListener>();
  private cursor = 0;
  /** Ticks left before the results screen, or null when no race has finished. */
  private resultsIn: number | null = null;
  /** Ticks left before the current menu or the select screen accepts kick. */
  private menuArmIn = 0;

  constructor(options: RuntimeOptions) {
    this.ctx = options.ctx;
    this.saves = options.saves;
    this.save = options.save;
    this.prefersReducedMotion = options.prefersReducedMotion;
    this.startScene = options.startScene;
    this.search = options.search ?? '';
    this.selectedCharacter = this.savedCharacter;
    this.course = startingCourse(this.search, options.save?.lastCourse ?? null);
    assertCourseAssets(this.course);
    this.audio = createAudio(
      options.ctx,
      this.settings,
      this.events,
      (id) => this.audibleFromPlayer(id),
      () => this.course.song,
    );
  }

  /** True while any save write is queued or running. The test harness waits on it through idle(). */
  get saving(): boolean {
    return this.writesPending > 0;
  }

  /** Settings from the save, with a null `reducedMotion` following the OS. */
  get settings(): Settings {
    const saved = (this.save ?? NEW_GAME).settings;
    return {
      muted: saved.muted,
      reducedMotion: saved.reducedMotion ?? this.prefersReducedMotion,
      difficulty: saved.difficulty,
    };
  }

  /** The course the title and select screens draw behind them: the save's last course when it is listed, else the default. */
  get menuCourse(): Course {
    return listedLastCourse(this.save?.lastCourse ?? null);
  }

  /** The character picked last, from the save; Rudy when there is none. */
  get savedCharacter(): CharacterId {
    return (this.save ?? NEW_GAME).character;
  }

  /** Feeds one game step's wall time to the fixed step. Does nothing in test mode, where the shell calls advance(). */
  frame(deltaMs: number): void {
    if (!this.ctx.params.testMode) this.step.frame(deltaMs / 1000);
  }

  /** Switches scenes. Ticks pause until the new scene calls `entered`. */
  goTo(scene: SceneKey): void {
    this.loading = true;
    this.menu = null;
    this.startScene(scene);
  }

  /**
   * Called from a scene's create() once it is ready to show. The title drops any finished race; the
   * select screen puts its cursor on the saved pick.
   */
  entered(scene: SceneKey): void {
    this.scene = scene;
    this.loading = false;
    if (scene === 'title') this.world = null;
    if (scene === 'select') this.selectedCharacter = this.savedCharacter;
    if (scene === 'course') this.courseCursor = Math.max(0, LISTED_COURSES.indexOf(this.course));
    if (scene === 'howToPlay') this.showHowToPlayPage(0);
    const options = MENUS[scene];
    this.menu = options ? createMenu(options) : null;
    if (this.menu && this.returnTo) {
      this.menu.selected = Math.max(0, this.menu.options.indexOf(this.returnTo));
      this.returnTo = null;
    }
    this.menuArmIn = MENU_ARM_TICKS;
    this.events.emit({ type: 'scene.started', scene });
  }

  /**
   * Builds a fresh world on the course with the player as `selectedCharacter` and starts the race
   * scene at the countdown. The seed moves on with every recorded race, so a rematch differs (rivals
   * included) while a test run still repeats.
   */
  startRace(): void {
    const seed = this.ctx.params.seed + (this.save?.races ?? 0);
    const { difficulty } = this.settings;
    this.world = createWorld(this.course, this.events, {
      seed,
      character: this.selectedCharacter,
      difficulty,
    });
    this.hintMemory = newHintMemory();
    this.hintConfig = hintConfig(this.save?.races ?? 0, difficulty);
    this.hints = NO_HINTS;
    const stage = stageFor(this.ctx.params, this.search);
    if (stage) applyStage(this.world, stage);
    this.staged = stage !== null;
    this.startProgress = playerOf(this.world).progress;
    this.lastResult = null;
    this.resultsIn = null;
    this.goTo('race');
  }

  /**
   * Queues a write of `data` to the save slot, emitting `save.written` or `save.failed`. Writes run
   * one at a time in the order asked for, so a slow older write can't land after a newer one. A
   * write that fails, whether the store reports it or throws, is warned about once (`what` names the
   * data) and becomes `save.failed`; the race carries on either way, so the promise never rejects.
   * A write that succeeds makes `data` the current save unless a newer write was asked for since.
   */
  persist(data: SaveData, what: string): Promise<void> {
    const request = ++this.writesRequested;
    this.writesPending++;
    const write = this.writeQueue.then(() => this.write(data, what, request));
    this.writeQueue = write;
    return write;
  }

  private async write(data: SaveData, what: string, request: number): Promise<void> {
    try {
      const outcome = await this.saves.save(SAVE_SLOT, data);
      if (outcome.ok) {
        if (request === this.writesRequested) this.save = data;
        this.events.emit({ type: 'save.written' });
      } else {
        this.failWrite(what, outcome.reason);
      }
    } catch (error) {
      this.failWrite(what, error instanceof Error ? error.message : String(error));
    } finally {
      this.writesPending--;
    }
  }

  private failWrite(what: string, reason: string): void {
    log.warn(`${what} not saved: ${reason}`);
    this.events.emit({ type: 'save.failed', reason });
  }

  /** Makes `data` the current save, as when a fixture is loaded: its sound setting applies at once, as a change from the title does. */
  loadSave(data: SaveData): void {
    this.save = data;
    this.audio.setMuted(this.settings.muted);
  }

  /** Calls `listener` with every later tick's drained events. Returns the function that stops it. */
  listen(listener: EventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Whether racer `id` is within about a screen of the player, whom the camera follows. */
  private audibleFromPlayer(id: RacerId): boolean {
    return this.world ? withinHearing(this.world, id) : true;
  }

  private tick(dt: number): void {
    if (this.loading) return;
    this.events.tick = this.step.tick;
    input.update();
    if (this.menu) this.tickMenu(this.menu);
    else if (this.scene === 'course') this.tickCourse();
    else if (this.scene === 'select') this.tickSelect();
    else if (this.scene === 'howToPlay') this.tickHowToPlay();
    else if (this.scene === 'race') this.tickRace(dt);
    this.dispatchEvents();
  }

  private tickMenu(menu: Menu): void {
    if (input.justPressed('down')) moveSelection(menu, 1);
    if (input.justPressed('up')) moveSelection(menu, -1);
    if (this.menuArmIn > 0) {
      this.menuArmIn--;
      return;
    }
    if (!input.justPressed('kick')) return;
    const option = selectedOption(menu);
    this.events.emit({ type: 'menu.selected', option });
    if (option === 'Sound') this.changeSettings({ muted: !this.settings.muted });
    else if (option === 'Motion') this.changeSettings({ reducedMotion: !this.settings.reducedMotion });
    else if (option === 'Difficulty') this.changeSettings({ difficulty: nextDifficulty(this.settings.difficulty) });
    else if (option === 'How to play') this.goTo('howToPlay');
    else if (option === 'Title') this.goTo('title');
    else if (option === 'Race') this.goTo(COURSE_SELECT_SHOWN ? 'course' : 'select');
    else this.startRace();
  }

  /** Moves the course cursor up and down, wrapping; after the arming ticks kick picks the course and burst goes back. */
  private tickCourse(): void {
    const count = LISTED_COURSES.length;
    if (input.justPressed('down')) this.courseCursor = (this.courseCursor + 1) % count;
    if (input.justPressed('up')) this.courseCursor = (this.courseCursor + count - 1) % count;
    if (this.menuArmIn > 0) {
      this.menuArmIn--;
      return;
    }
    if (input.justPressed('burst')) this.goTo('title');
    else if (input.justPressed('kick')) {
      this.course = LISTED_COURSES[this.courseCursor] ?? this.course;
      this.goTo('select');
    }
  }

  /** Moves the select cursor on the d-pad; after the arming ticks kick races as the pick and burst goes back. */
  private tickSelect(): void {
    if (input.justPressed('left')) this.selectedCharacter = moveCharacter(this.selectedCharacter, -1, 0);
    if (input.justPressed('right')) this.selectedCharacter = moveCharacter(this.selectedCharacter, 1, 0);
    if (input.justPressed('up')) this.selectedCharacter = moveCharacter(this.selectedCharacter, 0, -1);
    if (input.justPressed('down')) this.selectedCharacter = moveCharacter(this.selectedCharacter, 0, 1);
    if (this.menuArmIn > 0) {
      this.menuArmIn--;
      return;
    }
    if (input.justPressed('burst')) this.goTo(COURSE_SELECT_SHOWN ? 'course' : 'title');
    else if (input.justPressed('kick')) this.pickCharacter();
  }

  /**
   * A and right turn to the next page, B and left to the previous. Left and right stop at the ends;
   * only B on the first page and A on the last leave, back to the title with How to play selected.
   */
  private tickHowToPlay(): void {
    if (this.menuArmIn > 0) {
      this.menuArmIn--;
      return;
    }
    const press = readPagePress();
    if (!press) return;
    const outcome = turnPage(this.howToPage, press);
    if (outcome.kind === 'leave') {
      this.returnTo = 'How to play';
      this.goTo('title');
    } else if (outcome.page !== this.howToPage) {
      this.showHowToPlayPage(outcome.page);
      this.events.emit({ type: 'howToPlay.page', page: outcome.page + 1 });
    }
  }

  private showHowToPlayPage(page: number): void {
    this.howToPage = page;
    this.howToSince = this.step.tick;
  }

  /**
   * Saves the select cursor as the player's pick and starts the race. Like a settings change, the
   * pick holds for this session even when the write fails.
   */
  private pickCharacter(): void {
    const data: SaveData = { ...(this.save ?? NEW_GAME), character: this.selectedCharacter };
    this.save = data;
    void this.persist(data, 'Character pick');
    this.startRace();
  }

  /**
   * Applies a settings change at once and saves it. The change holds for this session even when
   * the write fails (`save.failed` says so); it just won't survive a reload.
   */
  private changeSettings(patch: Partial<Settings>): void {
    const before = this.save ?? NEW_GAME;
    const data: SaveData = { ...before, settings: { ...before.settings, ...patch } };
    this.save = data;
    const { muted, reducedMotion, difficulty } = this.settings;
    this.audio.setMuted(muted);
    this.events.emit({ type: 'settings.changed', muted, reducedMotion, difficulty });
    void this.persist(data, 'Settings');
  }

  private tickRace(dt: number): void {
    const world = this.world;
    if (!world) throw new Error('The race scene is ticking without a world; start races with startRace()');
    stepWorld(world, readPlayerInput(), dt);
    this.hints = updateHints(this.hintMemory, world, this.hintConfig);
    this.audio.onRaceProgress(this.raceFraction);
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
    const difficulty = this.world?.difficulty ?? this.settings.difficulty;
    const courseId = this.world?.course ?? this.course.id;
    this.lastResult = { result, newBest: isNewBest(before, courseId, difficulty, result), saveFailed: false };
    this.resultsIn = RESULTS_DELAY_TICKS;
    if (this.staged) return;
    void this.persist(recordRace(before, courseId, difficulty, result), 'Race result');
  }
}

/**
 * The course a session starts on: the one `?course=` names (listed or not), else the save's last
 * course when it is still listed, else the default. An unknown `?course=` is warned about once and
 * ignored.
 */
function startingCourse(search: string, lastCourse: string | null): Course {
  const asked = new URLSearchParams(search).get('course');
  if (asked !== null) {
    const course = courseById(asked);
    if (course) return course;
    log.warn('unknown course in ?course=, racing the default', { course: asked, default: DEFAULT_COURSE.id });
  }
  return listedLastCourse(lastCourse);
}

/** The save's last course when it names a listed course, else the default. */
function listedLastCourse(lastCourse: string | null): Course {
  const last = lastCourse === null ? null : courseById(lastCourse);
  return last?.listed ? last : DEFAULT_COURSE;
}

/** The next difficulty in the cycle EASY, NORMAL, HARD, then back to EASY. */
function nextDifficulty(current: Difficulty): Difficulty {
  const index = DIFFICULTIES.indexOf(current);
  return DIFFICULTIES[(index + 1) % DIFFICULTIES.length] ?? current;
}

/** The page button pressed this tick, if any. */
function readPagePress(): PagePress | null {
  for (const press of ['kick', 'burst', 'right', 'left'] as const) {
    if (input.justPressed(press)) return press;
  }
  return null;
}

/** The player's input this tick as plain data for `stepWorld`. */
function readPlayerInput(): TickInput {
  const move = input.vector('move');
  return {
    move: { x: move.x, y: move.y },
    kick: input.justPressed('kick'),
    kickHeld: input.isDown('kick'),
    burst: input.justPressed('burst'),
  };
}
