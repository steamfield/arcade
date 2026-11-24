/**
 * The state the scenes share and the only place logic ticks. `Runtime` owns the
 * event log, the fixed step, the current scene, the race world, the save and
 * settings. Each tick it reads input, advances whichever screen is active, then
 * drains the tick's events once and hands them to audio and any listening view.
 * Scenes render from it and never change gameplay themselves.
 *
 * Screens: title, then course select (pick a course; skipped while only one course is listed),
 * then select (pick a character; fire races, dash goes back), then race and results. Race again
 * skips both selects and races the same course and pick; Character on the results screen opens them again
 * (select only while one course is listed), with the cursor on the current pick. The title also opens How to Play, a few
 * pages the player turns with the move and action buttons. Dash on a select screen opened from results goes
 * back to results with Character selected, with the finished race still in hand; opened from the title it goes to the title.
 *
 * Online, friends and room screens hand each tick to the online flow (`online/flow.ts`), which says
 * where to go next. An online race is stepped by the flow's client, never by `stepRace` here, and
 * like a debug race it saves nothing; its results offer Race again (back to the room) and Title.
 *
 * A screen starts only once the art it draws is registered (`ArtPort`): the menu course's on the
 * title and course select, the picked course's on select and How to Play, the race's on race and
 * results, and every world's on Friends and in the room, since a guest races whatever the host
 * picks. Ticks wait while it loads; a failed load is reported and leaves the player on the screen
 * showing.
 */
import { createLogger, EventLog, FixedStep, type Stamped } from '@arcade/core';
import type { SaveStore } from '@arcade/save';
import type { GameContext } from '@arcade/shell';
import { courseById, courseOf, DEFAULT_COURSE, LISTED_COURSES } from '../logic/courses/index.ts';
import type { Course } from '../logic/courses/types.ts';
import type { GameEvent } from '../logic/events.ts';
import { isNewBest, recordRace } from '../logic/records.ts';
import { NEW_GAME, type SaveData } from '../logic/save.ts';
import {
  type CharacterId,
  DIFFICULTIES,
  type Difficulty,
  RACER_IDS,
  type RaceResult,
  type RacerId,
  type TickInput,
  type World,
} from '../logic/types.ts';
import { createWorld, stepRace } from '../logic/world.ts';
import { createOnlineWorld } from '../net/race-world.ts';
import { enemyWithinHearing } from './audio/adapter.ts';
import { withinHearing } from './audio/attack-sfx.ts';
import { type AudioPort, createAudio } from './audio/index.ts';
import { RACE_TRACKS, type SongName } from './audio/songs/index.ts';
import { createTrackRotation, type TrackRotation } from './audio/track-rotation.ts';
import { applyStage, stageFor } from './capture-stages.ts';
import { type Action, input } from './input.ts';
import { localOf, setLocalRacer } from './local-racer.ts';
import {
  createOnlineFlow,
  type FlowNext,
  type OnlineFlow,
  type OnlinePorts,
  type ResultsChoice,
} from './online/flow.ts';
import type { ScreenPress } from './online/friends-screen.ts';
import { onlineCourses } from './online/room-courses.ts';
import { roomLinkParam } from './online/room-link.ts';
import type { OnlineState } from './online/state.ts';
import { raceProgress } from './race-progress.ts';
import { moveCharacter } from './screens/character-select.ts';
import { type PagePress, turnPage } from './screens/how-to-play.ts';
import {
  createJukebox,
  hearJukebox,
  type Jukebox,
  type JukeboxPress,
  pressJukebox,
  soundtrackTracks,
} from './screens/jukebox.ts';
import { createMenu, MENU_OPTIONS, type Menu, type MenuOption, moveSelection, selectedOption } from './screens/menu.ts';
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
import { stormWithinReach } from './view/set-pieces/storm-reach.ts';
import { assertSkinAssets, skinFor } from './worlds/index.ts';

/** Phaser scene keys, one per screen. */
export type SceneKey =
  | 'boot'
  | 'title'
  | 'howToPlay'
  | 'course'
  | 'select'
  | 'race'
  | 'results'
  | 'friends'
  | 'room'
  | 'jukebox';

/** Events the engine adds on top of the world's. */
type EngineEvent =
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
type EventListener = (events: readonly Stamped<RuntimeEvent>[]) => void;

/** What a screen draws art for: these courses' worlds and themes, or every world and theme. */
export type ArtNeed = readonly Course[] | 'all';

/** Registers the art screens draw. The game backs it with `worlds/load.ts`; tests pass their own. */
export interface ArtPort {
  /** Whether everything `need` names is registered already. */
  ready(need: ArtNeed): boolean;
  /**
   * Registers everything `need` names.
   *
   * @throws {Error} Rejects naming the world or theme whose art failed to load.
   */
  load(need: ArtNeed): Promise<void>;
}

/** Art that is always in, for runtimes with no textures to build. */
const ART_ALWAYS_READY: ArtPort = { ready: () => true, load: () => Promise.resolve() };

/** What the player reads when a world's or theme's art fails to load. */
export const ART_LOAD_FAILED = "Couldn't load the course art. Reload the page to try again.";

/** What the runtime needs from the outside: the shell context, saves, the OS motion setting and a scene switcher. */
interface RuntimeOptions {
  ctx: GameContext;
  saves: SaveStore<SaveData>;
  /** The loaded save, or null when there is none or it could not be read. */
  save: SaveData | null;
  /** The OS prefers-reduced-motion answer, read once at boot. */
  prefersReducedMotion: boolean;
  /** Stops the running scenes and starts `scene`. Phaser does the switch; the runtime only asks for it. */
  startScene(scene: SceneKey): void;
  /** The page's query string (`location.search`), read for `?course=`, `?stage=` and `?local=`. Empty when there is none. */
  search?: string;
  /** The courses course select offers, in menu order. Defaults to `LISTED_COURSES`; tests pass their own. */
  listedCourses?: readonly Course[];
  /** The network, clipboard and seed the online screens use; tests pass a memory room. */
  online: OnlinePorts;
  /** Loads the art each screen draws. Defaults to art that is always in. */
  art?: ArtPort;
}

/** The one save slot Rush Racers uses. */
export const SAVE_SLOT = 'main';

/** Ticks between `race.finished` and the results screen, so the finish can be seen. */
const RESULTS_DELAY_TICKS = 90;
/** Ticks a menu ignores fire after its screen appears, so a fire still being mashed from the race can't pick an option unseen. */
const MENU_ARM_TICKS = 20;

const MENUS: Partial<Record<SceneKey, readonly MenuOption[]>> = MENU_OPTIONS;

const log = createLogger('rush-racers');

/** Events the runtime log holds before the oldest drop. */
const RUNTIME_EVENT_CAPACITY = 5000;

/** Shared engine state. Logic changes only inside the FixedStep callback. */
export class Runtime {
  /**
   * Room for a whole idle race between drains: a test that waits out the race limit in one step
   * hears every eel's warning (17 of them, one each 2.5 s) before it reads the log again.
   */
  readonly events = new EventLog<RuntimeEvent>(RUNTIME_EVENT_CAPACITY);
  readonly step = new FixedStep((dt) => this.tick(dt));
  scene: SceneKey = 'boot';
  /** True between asking for a scene and that scene's create(), art loading included; ticks wait while it is set. */
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
  /** The courses course select offers, in menu order. */
  readonly listedCourses: readonly Course[];
  /** Course select only shows when there is a choice to make; while it is skipped, screens don't name the course either. */
  readonly courseSelectShown: boolean;
  /** The course select cursor, an index into `listedCourses`; put on the current course each time the screen opens. */
  courseCursor = 0;
  readonly audio: AudioPort;
  /** True when the current race is a debug race, staged for a capture (`?stage=`) or followed from another slot (`?local=`); its result is never saved. */
  debugRace = false;
  /** The page How to Play shows, 0-based; back to the first page each time the screen opens. */
  howToPage = 0;
  /** The logic tick the current How to Play page came up on, so its animation starts from its first moment however many frames were drawn. */
  howToSince = 0;
  /** The in-race hints showing now, refreshed each racing tick; none outside a race. */
  hints: HintState = NO_HINTS;
  /** Friends, the room and its races: the online flow, which the friends, room and online race screens tick. */
  readonly flow: OnlineFlow;
  /** The sound test's list, cursor and playing song; set each time the jukebox screen opens. */
  jukebox: Jukebox | null = null;
  /** The track the race in hand plays, picked from its course's set as the race starts; null before the first race. */
  raceTrack: SongName | null = null;
  /** True while the race in hand is an online one: the flow's client steps it, and it is never saved. */
  onlineRace = false;
  /** The slot this peer races in during an online race; null otherwise. */
  private onlineLocal: RacerId | null = null;
  /** Save writes asked for and not yet settled. */
  private writesPending = 0;
  /** Where the write queue ends: each write starts once the one before it has settled. */
  private writeQueue: Promise<void> = Promise.resolve();
  /** Counts write requests, so a write can tell whether a newer one was asked for after it. */
  private writesRequested = 0;
  /** The local racer's progress-field distance at the start line, for the race progress fraction. */
  private startProgress = 0;
  private hintMemory: HintMemory = newHintMemory();
  /** The menu option to put the cursor on when the next menu screen opens, or null for the first. */
  private returnTo: MenuOption | null = null;
  private hintConfig: HintConfig = { enabled: false, easy: false };

  /** How far the local racer is through the current race, 0 to 1; 0 with no race. */
  get raceFraction(): number {
    return this.world ? raceProgress(this.world, this.startProgress) : 0;
  }
  readonly ctx: GameContext;

  private readonly saves: SaveStore<SaveData>;
  private readonly prefersReducedMotion: boolean;
  private readonly startScene: (scene: SceneKey) => void;
  private readonly search: string;
  /** The `?stage=` every local race is staged with, resolved once at launch so an unknown name warns once. */
  private readonly stage: ReturnType<typeof stageFor>;
  /** The slot an accepted `?local=` asks this screen to follow, or null when it names none or `?debug=1` is missing. */
  readonly localSlot: RacerId | null;
  private readonly listeners = new Set<EventListener>();
  private cursor = 0;
  /** Which screen opened the select screens, so dash goes back there. Set each time the results or title menu opens them. */
  private selectOpenedFrom: 'title' | 'results' = 'title';
  /**
   * The course in force when the select screens opened. Course select's pick takes effect at once (the
   * select screen draws the picked course's world), so backing out of the selects puts this one back.
   */
  private courseBeforeSelects: Course;
  /** Ticks left before the results screen, or null when no race has finished. */
  private resultsIn: number | null = null;
  /** Ticks left before the current menu or the select screen accepts fire. */
  private menuArmIn = 0;
  /** Set by a tick that sent the player into an online race: that tick's events go out on the race scene's first tick instead. */
  private holdEvents = false;
  private readonly art: ArtPort;
  /** Picks each race's track from its course's set, starting at the save's race count at boot. */
  private readonly rotation: TrackRotation;
  /** Counts art waits, so a load that finishes after a newer request was made does nothing. */
  private artRequests = 0;
  /** Asks again for the art boot failed to load; null unless boot's load failed. */
  private bootRetry: (() => void) | null = null;

  constructor(options: RuntimeOptions) {
    this.ctx = options.ctx;
    this.saves = options.saves;
    this.save = options.save;
    this.prefersReducedMotion = options.prefersReducedMotion;
    this.startScene = options.startScene;
    this.art = options.art ?? ART_ALWAYS_READY;
    this.search = options.search ?? '';
    this.stage = stageFor(options.ctx.params, this.search);
    this.localSlot = options.ctx.params.debug ? localSlotFor(this.search) : null;
    this.listedCourses = options.listedCourses ?? LISTED_COURSES;
    this.courseSelectShown = this.listedCourses.length > 1;
    this.selectedCharacter = this.savedCharacter;
    this.course = startingCourse(this.search, options.save?.lastCourse ?? null);
    this.courseBeforeSelects = this.course;
    assertCourseAssets(this.course);
    assertSkinAssets(skinFor(this.course));
    this.audio = createAudio(
      options.ctx,
      this.settings,
      this.events,
      {
        audibleFromLocal: (id) => this.audibleFromLocal(id),
        enemyAudible: (index) => (this.world ? enemyWithinHearing(this.world, index) : true),
        stormAudible: (zone, reachPx) => (this.world ? stormWithinReach(this.world, zone, reachPx) : true),
        localRacer: () => this.localRacer,
        raceWorld: () => this.world,
      },
      () => this.trackOfRace(),
    );
    this.rotation = createTrackRotation({ startAt: options.save?.races ?? 0, pinned: pinnedTrackFor(this.search) });
    this.flow = createOnlineFlow({
      ...options.online,
      createRace: (start) => createOnlineWorld(start, this.events),
      courses: onlineCourses(this.listedCourses, this.course),
      lobby: () => ({
        character: this.savedCharacter,
        course: this.course.id,
        difficulty: this.settings.difficulty,
      }),
      warn: (message) => log.warn(message),
    });
  }

  /** The course the race in hand runs on: an online race's may be the host's pick rather than this player's `course`. */
  get raceCourse(): Course {
    return this.onlineRace && this.world ? courseOf(this.world) : this.course;
  }

  /** What the friends and room screens draw. */
  get online(): OnlineState {
    return this.flow.state;
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

  /**
   * Whether Race and Character pass through course select: while it is shown, unless the course in
   * force is an unlisted one it doesn't offer (a debug or test `?course=`), which keeps its course.
   */
  private get courseSelectOpens(): boolean {
    return this.courseSelectShown && (this.course.listed || this.listedCourses.includes(this.course));
  }

  /** The slot this screen follows: this peer's slot in an online race, the `?local=` slot in that debug race, else 'player'. */
  get localRacer(): RacerId {
    return this.onlineLocal ?? this.localSlot ?? 'player';
  }

  /** The results menu's options: an online race's go back to the room instead of offering Character. */
  get resultsOptions(): readonly MenuOption[] {
    return this.onlineRace ? MENU_OPTIONS.onlineResults : MENU_OPTIONS.results;
  }

  /** The character picked last, from the save; Rudy when there is none. */
  get savedCharacter(): CharacterId {
    return (this.save ?? NEW_GAME).character;
  }

  /** Feeds one game step's wall time to the fixed step. Does nothing in test mode, where the shell calls advance(). */
  frame(deltaMs: number): void {
    if (!this.ctx.params.testMode) this.step.frame(deltaMs / 1000);
  }

  /** Switches scenes once the art `scene` draws is in. Ticks pause until the new scene calls `entered`. */
  goTo(scene: SceneKey): void {
    this.loading = true;
    this.whenArtReady(this.artFor(scene), () => {
      this.menu = null;
      this.startScene(scene);
    });
  }

  /**
   * Leaves boot once the art of the courses the first screens draw is in (the session's course and
   * the menu course behind the title, which differ with `?course=`): straight into a race with
   * `?scene=race` (or the older `?scene=play`), into the room a `?room=` link names, to Friends with
   * `?scene=friends`, to the sound test with `?scene=jukebox`, else to the title. When that art fails
   * to load, the next press tries again.
   */
  boot(): void {
    this.whenArtReady([this.course, this.menuCourse], () => {
      const scene = this.ctx.params.scene;
      if (RACE_SCENE_PARAMS.includes(scene)) this.startRace();
      else if (!this.openRoomLink()) this.goTo(scene === 'friends' || scene === 'jukebox' ? scene : 'title');
    });
  }

  /**
   * Runs `then` once the art `need` names is registered: at once when it already is, else after it
   * loads, with `loading` set meanwhile. Only the latest request runs. A failed load is reported as
   * an 'art' error and shown as `ART_LOAD_FAILED`, `then` never runs, and ticks carry on on the
   * screen showing, where the player's next pick (on boot, any press) asks again.
   */
  private whenArtReady(need: ArtNeed, then: () => void): void {
    const request = ++this.artRequests;
    if (this.art.ready(need)) {
      then();
      return;
    }
    this.loading = true;
    void this.art.load(need).then(
      () => {
        if (request === this.artRequests) then();
      },
      (error: unknown) => {
        if (request !== this.artRequests) return;
        this.bootRetry = this.scene === 'boot' ? () => this.whenArtReady(need, then) : null;
        this.failArt(error);
      },
    );
  }

  /**
   * The art `scene` draws: see the module comment. Friends needs every world's too, so nobody joins
   * or creates a room (and shows the host they are ready) before a race on any course can be drawn.
   */
  private artFor(scene: SceneKey): ArtNeed {
    if (scene === 'room' || scene === 'friends') return 'all';
    if (scene === 'race' || scene === 'results') return [this.raceCourse];
    if (scene === 'select' || scene === 'howToPlay') return [this.course];
    return [this.menuCourse];
  }

  private failArt(error: unknown): void {
    this.loading = false;
    this.ctx.reportError('art', error, { fatal: false });
    this.ctx.notice(ART_LOAD_FAILED);
  }

  /** On boot after its art failed to load, any press asks for that art again. */
  private tickBoot(): void {
    if (!this.bootRetry || !TITLE_PRESSES.some((action) => input.justPressed(action))) return;
    const retry = this.bootRetry;
    this.bootRetry = null;
    retry();
  }

  /**
   * Called from a scene's create() once it is ready to show. The title drops any finished race; the
   * select screen puts its cursor on the saved pick.
   */
  entered(scene: SceneKey): void {
    // The same screen built again after a resize (no goTo in between) keeps its cursor, page and menu.
    if (scene === this.scene && !this.loading) return;
    this.scene = scene;
    this.loading = false;
    if (scene === 'title' || scene === 'friends' || scene === 'room') this.dropRace();
    if (scene === 'friends') this.flow.openFriends();
    if (scene === 'select') this.selectedCharacter = this.savedCharacter;
    if (scene === 'course') this.courseCursor = Math.max(0, this.listedCourses.indexOf(this.course));
    if (scene === 'howToPlay') this.showHowToPlayPage(0);
    if (scene === 'jukebox') this.jukebox = createJukebox(soundtrackTracks());
    const options = scene === 'results' ? this.resultsOptions : MENUS[scene];
    this.menu = options ? createMenu(options) : null;
    if (this.menu && this.returnTo) {
      this.menu.selected = Math.max(0, this.menu.options.indexOf(this.returnTo));
      this.returnTo = null;
    }
    this.menuArmIn = MENU_ARM_TICKS;
    this.events.emit({ type: 'scene.started', scene });
  }

  /**
   * Builds a fresh world on the course with the local slot as `selectedCharacter` and starts the race
   * scene at the countdown. The seed moves on with every recorded race, so a rematch differs (rivals
   * included) while a test run still repeats. A `?local=` race makes its slot the only human one,
   * follows it, and runs Easy as Normal (Easy's guide is for slot 1 alone).
   */
  startRace(): void {
    const seed = this.ctx.params.seed + (this.save?.races ?? 0);
    const difficulty = this.raceDifficulty();
    this.world = createWorld(this.course, this.events, {
      seed,
      difficulty,
      // The picked character goes to the slot this person races in; a default race keeps `character`.
      ...(this.localSlot
        ? { humans: [this.localSlot], characters: { [this.localSlot]: this.selectedCharacter } }
        : { character: this.selectedCharacter }),
    });
    this.onlineRace = false;
    this.onlineLocal = null;
    setLocalRacer(this.world, this.localRacer);
    if (this.stage) applyStage(this.world, this.stage);
    this.debugRace = this.stage !== null || this.localSlot !== null;
    this.beginRace(this.world);
  }

  /**
   * Races `world`, which the online client built from the host's start and alone steps, following
   * slot `local`. Like a debug race it is never saved.
   */
  private adoptOnlineRace(world: World, local: RacerId): void {
    this.world = world;
    this.onlineRace = true;
    this.onlineLocal = local;
    this.debugRace = false;
    setLocalRacer(world, local);
    this.beginRace(world);
  }

  /**
   * Resets the per-race state for `world`, whose local racer is set, picks the race's track and shows
   * the race from its countdown.
   */
  private beginRace(world: World): void {
    this.raceTrack = this.rotation.next(this.raceCourse.song);
    this.hintMemory = newHintMemory();
    this.hintConfig = hintConfig(this.save?.races ?? 0, world.difficulty);
    this.hints = NO_HINTS;
    this.startProgress = localOf(world).progress;
    this.lastResult = null;
    this.resultsIn = null;
    this.goTo('race');
  }

  /** Lets go of the race in hand, offline or online, as the title and the online screens do. */
  private dropRace(): void {
    this.world = null;
    this.onlineRace = false;
    this.onlineLocal = null;
  }

  /**
   * Boots into the room a `?room=` link names, connecting once every world's art is in, so the host
   * never sees this player ready before a race on any course can be drawn. Returns false, changing
   * nothing, when there is no `?room=`; an invalid one is warned about and ignored the same way.
   */
  openRoomLink(): boolean {
    // Without a room code openLink joins nothing; it only warns about an invalid one.
    if (roomLinkParam(this.search).kind !== 'room') return this.flow.openLink(this.search);
    this.whenArtReady('all', () => {
      this.flow.openLink(this.search);
      this.goTo('room');
    });
    return true;
  }

  /**
   * The tab was hidden (the shell's `onHide`, between ticks, with the loop already stopped). An
   * online race still running is left for the title with a notice; in the room or after an online
   * race the room hears this player is away. Offline it changes nothing.
   */
  hide(): void {
    this.follow(this.flow.hide());
  }

  /** The tab shows again (the shell's `resume`): a player away in the room or on online results is ready again. */
  show(): void {
    this.flow.show();
  }

  /** True while the online flow waits on the outside (creating a room, copying its link); the game is not idle meanwhile. */
  get onlineBusy(): boolean {
    return this.flow.busy;
  }

  /** The saved difficulty, except that a `?local=` race for a slot other than 'player' runs Easy as Normal, with a warning. */
  private raceDifficulty(): Difficulty {
    const { difficulty } = this.settings;
    if (difficulty !== 'easy' || this.localRacer === 'player') return difficulty;
    log.warn(`?local=${this.localRacer} races on Normal: Easy is single-player in slot 1`);
    return 'normal';
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

  /** Whether racer `id` is within about a screen of the local racer, whom the camera follows. */
  private audibleFromLocal(id: RacerId): boolean {
    return this.world ? withinHearing(this.world, id) : true;
  }

  private tick(dt: number): void {
    if (this.loading) return;
    this.events.tick = this.step.tick;
    input.update();
    if (this.scene === 'friends') this.follow(this.flow.friends(this.readScreenPress(), input.takeText()));
    else if (this.scene === 'room') this.follow(this.flow.room(this.readScreenPress(), dt * 1000));
    else if (this.scene === 'results' && this.onlineRace && this.menu) this.tickOnlineResults(this.menu, dt);
    else if (this.menu) this.tickMenu(this.menu);
    else if (this.scene === 'course') this.tickCourse();
    else if (this.scene === 'select') this.tickSelect();
    else if (this.scene === 'howToPlay') this.tickHowToPlay();
    else if (this.scene === 'jukebox' && this.jukebox) this.tickJukebox(this.jukebox);
    else if (this.scene === 'race') this.tickRace(dt);
    else if (this.scene === 'boot') this.tickBoot();
    if (this.holdEvents) this.holdEvents = false;
    else this.dispatchEvents();
    // The code cells take typing, so letter keys that are also bindings (WASD, Z, X) type there instead.
    input.setTextEntry(this.scene === 'friends' && this.flow.state.friends.mode === 'code');
  }

  /**
   * Does what the online flow asked for: another screen, or an online race in the client's world.
   * Going to the title leaves online play, so the flow lets go of its room. A race the client
   * already stepped gets that step's per-step work here, and the tick's events wait for the race
   * scene, so its countdown is never heard over the screen it replaces.
   */
  private follow(next: FlowNext): void {
    if (next.kind === 'room') this.goTo('room');
    else if (next.kind === 'title') {
      this.flow.release();
      this.goTo('title');
    } else if (next.kind === 'race') {
      this.adoptOnlineRace(next.world, next.local);
      if (next.stepped > 0) this.afterRaceStep(next.world);
      this.holdEvents = true;
    }
  }

  /**
   * This tick's press on the friends or room screen, if any. Fire and dash wait out the arming
   * ticks, as on the menus, so a press still being mashed from the screen before can't act unseen.
   */
  private readScreenPress(): ScreenPress | null {
    const armed = this.menuArmIn === 0;
    if (!armed) this.menuArmIn--;
    for (const press of SCREEN_PRESSES) {
      if (!input.justPressed(press)) continue;
      if (armed || (press !== 'fire' && press !== 'dash')) return press;
    }
    return null;
  }

  /** The online results menu: the cursor moves as on any menu, and the flow ticks every tick so the room keeps being heard. */
  private tickOnlineResults(menu: Menu, dt: number): void {
    if (input.justPressed('down')) moveSelection(menu, 1);
    if (input.justPressed('up')) moveSelection(menu, -1);
    let choice: ResultsChoice = null;
    if (this.menuArmIn > 0) this.menuArmIn--;
    else if (input.justPressed('fire')) {
      const option = selectedOption(menu);
      this.events.emit({ type: 'menu.selected', option });
      choice = option === 'Title' ? 'title' : 'again';
    }
    this.follow(this.flow.results(choice, dt * 1000));
  }

  private tickMenu(menu: Menu): void {
    // A notice from online play stays on the title until the player does anything there.
    if (this.scene === 'title' && TITLE_PRESSES.some((action) => input.justPressed(action))) this.flow.dismissNotice();
    if (input.justPressed('down')) moveSelection(menu, 1);
    if (input.justPressed('up')) moveSelection(menu, -1);
    if (this.menuArmIn > 0) {
      this.menuArmIn--;
      return;
    }
    if (!input.justPressed('fire')) return;
    const option = selectedOption(menu);
    this.events.emit({ type: 'menu.selected', option });
    if (option === 'Sound') this.changeSettings({ muted: !this.settings.muted });
    else if (option === 'Motion') this.changeSettings({ reducedMotion: !this.settings.reducedMotion });
    else if (option === 'Difficulty') this.changeSettings({ difficulty: nextDifficulty(this.settings.difficulty) });
    else if (option === 'How to play') this.goTo('howToPlay');
    else if (option === 'Friends') this.goTo('friends');
    else if (option === 'Title') this.goTo('title');
    else if (option === 'Race' || option === 'Character') {
      this.selectOpenedFrom = option === 'Character' ? 'results' : 'title';
      this.courseBeforeSelects = this.course;
      this.goTo(this.courseSelectOpens ? 'course' : 'select');
    } else this.startRace();
  }

  /** Moves the course cursor up and down, wrapping; after the arming ticks fire picks the course and dash goes back. */
  private tickCourse(): void {
    const count = this.listedCourses.length;
    if (input.justPressed('down')) this.courseCursor = (this.courseCursor + 1) % count;
    if (input.justPressed('up')) this.courseCursor = (this.courseCursor + count - 1) % count;
    if (this.menuArmIn > 0) {
      this.menuArmIn--;
      return;
    }
    if (input.justPressed('dash')) this.leaveSelects();
    else if (input.justPressed('fire')) {
      this.course = this.listedCourses[this.courseCursor] ?? this.course;
      this.goTo('select');
    }
  }

  /** Moves the select cursor on the d-pad; after the arming ticks fire races as the pick and dash goes back. */
  private tickSelect(): void {
    if (input.justPressed('left')) this.selectedCharacter = moveCharacter(this.selectedCharacter, -1, 0);
    if (input.justPressed('right')) this.selectedCharacter = moveCharacter(this.selectedCharacter, 1, 0);
    if (input.justPressed('up')) this.selectedCharacter = moveCharacter(this.selectedCharacter, 0, -1);
    if (input.justPressed('down')) this.selectedCharacter = moveCharacter(this.selectedCharacter, 0, 1);
    if (this.menuArmIn > 0) {
      this.menuArmIn--;
      return;
    }
    if (input.justPressed('dash')) {
      if (this.courseSelectOpens) this.goTo('course');
      else this.leaveSelects();
    } else if (input.justPressed('fire')) this.pickCharacter();
  }

  /**
   * Backs out of the first select screen to where it was opened from: results (on Character) or the
   * title, with the course in force before the selects opened, so a course browsed and backed out of
   * is never raced or shown.
   */
  private leaveSelects(): void {
    this.course = this.courseBeforeSelects;
    if (this.selectOpenedFrom === 'results') {
      this.returnTo = 'Character';
      this.goTo('results');
    } else this.goTo('title');
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

  /**
   * The track the race in hand plays.
   *
   * @throws {Error} When no race has picked one, which means a race started without `beginRace`.
   */
  private trackOfRace(): SongName {
    if (this.raceTrack === null)
      throw new Error('A race started before its track was picked; start races through beginRace()');
    return this.raceTrack;
  }

  /** Hands the sound test this tick's press and does what it asks: audition a song, stop, or leave for the title. */
  private tickJukebox(jukebox: Jukebox): void {
    const outcome = pressJukebox(jukebox, readJukeboxPress(), this.step.tick);
    if (outcome.kind === 'play') this.audio.audition(outcome.song, outcome.section);
    else if (outcome.kind === 'stop') this.audio.audition(null);
    else if (outcome.kind === 'leave') this.goTo('title');
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
    if (this.onlineRace) {
      const { stepped, next } = this.flow.race(readPlayerInput(), dt * 1000);
      if (next.kind !== 'stay') {
        this.follow(next);
        return;
      }
      if (stepped > 0) this.afterRaceStep(world);
    } else {
      stepRace(world, { [this.localRacer]: readPlayerInput() }, dt);
      this.afterRaceStep(world);
    }
    // Counted every tick, stepped or not: an online world stops stepping once its race has ended.
    if (this.resultsIn === null) return;
    this.resultsIn--;
    if (this.resultsIn <= 0) this.goTo('results');
  }

  /** What follows each step of the race world: the hints and the music's sense of how far along the race is. */
  private afterRaceStep(world: World): void {
    this.hints = updateHints(this.hintMemory, world, this.hintConfig);
    this.audio.onRaceProgress(this.raceFraction);
  }

  private dispatchEvents(): void {
    const { events, cursor } = this.events.drain(this.cursor);
    this.cursor = cursor;
    for (const event of events) this.react(event);
    this.audio.onEvents(events);
    for (const listener of this.listeners) listener(events);
  }

  private react(event: Stamped<RuntimeEvent>): void {
    if (event.type === 'race.finished') this.finishRace(event);
    else if (event.type === 'save.failed' && this.lastResult)
      this.lastResult = { ...this.lastResult, saveFailed: true };
    else if (event.type === 'audio.played' && event.kind === 'song' && this.jukebox)
      hearJukebox(this.jukebox, event.key, event.tick);
  }

  private finishRace({ standings }: RaceResult): void {
    const local = this.world ? localOf(this.world) : null;
    const result: RaceResult = {
      standings,
      playerPlace: standings.indexOf(this.localRacer) + 1,
      playerTicks: local?.finished?.tick ?? null,
    };
    const before = this.save ?? NEW_GAME;
    const difficulty = this.world?.difficulty ?? this.settings.difficulty;
    const courseId = this.world?.course ?? this.course.id;
    // A debug or online race saves nothing, so it never sets a best.
    const unsaved = this.debugRace || this.onlineRace;
    const newBest = !unsaved && isNewBest(before, courseId, difficulty, result);
    this.lastResult = { result, newBest, saveFailed: false };
    this.resultsIn = RESULTS_DELAY_TICKS;
    if (unsaved) return;
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

/**
 * The slot `?local=` names, or null without one. An unknown slot is warned about once and ignored,
 * so the race runs as slot 1.
 */
function localSlotFor(search: string): RacerId | null {
  const asked = new URLSearchParams(search).get('local');
  if (asked === null) return null;
  const slot = RACER_IDS.find((id) => id === asked);
  if (slot) return slot;
  log.warn(`unknown slot in ?local=${asked}, racing as slot 1 (slots: ${RACER_IDS.join(', ')})`);
  return null;
}

/**
 * The 0-based track `?track=` pins every race to (1-based in the URL), or null without one. A value
 * that is not a positive whole number is warned about once and ignored, so tracks rotate.
 */
function pinnedTrackFor(search: string): number | null {
  const asked = new URLSearchParams(search).get('track');
  if (asked === null) return null;
  if (/^\d+$/.test(asked) && Number(asked) > 0) return Number(asked) - 1;
  log.warn(`?track=${asked} is not a track number (1, 2, 3 and so on), so race tracks rotate`);
  return null;
}

/** The next difficulty in the cycle EASY, NORMAL, HARD, then back to EASY. */
function nextDifficulty(current: Difficulty): Difficulty {
  const index = DIFFICULTIES.indexOf(current);
  return DIFFICULTIES[(index + 1) % DIFFICULTIES.length] ?? current;
}

/** `?scene=` values that skip the title. */
const RACE_SCENE_PARAMS: readonly (string | null)[] = ['race', 'play'];

/** The presses the friends and room screens take, in the order one is picked when several land on one tick. */
const SCREEN_PRESSES: readonly ScreenPress[] = ['up', 'down', 'left', 'right', 'fire', 'dash'];

/** Every button a player can press on the title, any of which clears an online notice there. */
const TITLE_PRESSES: readonly Action[] = [...SCREEN_PRESSES, 'prev', 'next'];

/** The sound test button pressed this tick, if any. */
function readJukeboxPress(): JukeboxPress | null {
  return SCREEN_PRESSES.find((press) => input.justPressed(press)) ?? null;
}

/** The page button pressed this tick, if any. */
function readPagePress(): PagePress | null {
  for (const press of ['fire', 'dash', 'right', 'left'] as const) {
    if (input.justPressed(press)) return press;
  }
  return null;
}

/**
 * The keyboard and touch input this tick as plain data for `stepRace`, for the local racer: fire uses the selected item, dash
 * kicks, and prev and next cycle the selection (cancelling out when both are pressed).
 */
function readPlayerInput(): TickInput {
  const move = input.vector('move');
  return {
    move: { x: move.x, y: move.y },
    kick: input.justPressed('dash'),
    kickHeld: input.isDown('dash'),
    use: input.justPressed('fire'),
    cycle: cycleStep(input.justPressed('prev'), input.justPressed('next')),
  };
}

/** The selection step for this tick's prev and next presses. */
function cycleStep(prev: boolean, next: boolean): TickInput['cycle'] {
  if (prev === next) return 0;
  return next ? 1 : -1;
}
