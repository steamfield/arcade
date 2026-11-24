import 'fake-indexeddb/auto';
import { configureLogging, EventLog, type LogEntry } from '@arcade/core';
import type { SaveResult, SaveStore } from '@arcade/save';
import { createSaveStore } from '@arcade/save';
import type { GameContext } from '@arcade/shell';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TOP_ROUTE } from '../../scenarios/kit.ts';
import { BRAMBLE_RUN } from '../logic/courses/bramble-run.ts';
import { DEFAULT_COURSE } from '../logic/courses/index.ts';
import type { Course } from '../logic/courses/types.ts';
import { hashWorld } from '../logic/hash.ts';
import { COUNTDOWN_TICKS, RACE_LIMIT_TICKS } from '../logic/race/standings.ts';
import { playerOf } from '../logic/racers.ts';
import { migrations, NEW_GAME, NO_BESTS, SAVE_VERSION, type SaveData, SaveSchema } from '../logic/save.ts';
import { courseFromLevel, giveItems } from '../logic/test-world.ts';
import type { TickInput, World } from '../logic/types.ts';
import { createClient, type OnlineClient } from '../net/client.ts';
import { IDLE_INPUT } from '../net/codec.ts';
import { createOnlineWorld } from '../net/race-world.ts';
import { createMemoryRoom, type MemoryRoom } from '../net/transport/memory.ts';
import { type Action, input } from './input.ts';
import type { OnlinePorts } from './online/flow.ts';
import { netSummary } from './online/net-summary.ts';
import { ART_LOAD_FAILED, type ArtNeed, type ArtPort, Runtime, type SceneKey } from './runtime.ts';
import { selectedOption } from './screens/menu.ts';

/** Title rows: Race, Friends, How to play, Level, Sound, Motion. Sound is four down. */
const SOUND_ROW = 4;
/** The title ignores fire for its first 20 ticks. */
const ARMED = 21;
/** The code every room in these tests has. */
const ROOM_CODE = 'ABCDEF';

let storeCount = 0;
const realStore = () =>
  createSaveStore<SaveData>({
    gameId: `runtime-${storeCount++}`,
    version: SAVE_VERSION,
    schema: SaveSchema,
    migrate: migrations,
  });

interface Harness {
  rt: Runtime;
  /** What `ctx.reportError` was called with, other than audio (there is no AudioContext under Node). */
  gameErrors: string[];
}

interface TitleHarness extends Harness {
  /** What `ctx.notice` showed, in order. */
  notices: string[];
  /** Brings up the scene the runtime last asked for, if it is still waiting (only with `deferScenes`). */
  showScene(): void;
}

/**
 * A runtime on its title screen, as the shell hands it over, over `saves`, opened at `search` and
 * offering `listedCourses` on course select. Each scene it asks for comes up at once, as Phaser's would,
 * or with `deferScenes` only when the test calls `showScene`, as between two of Phaser's frames. Its
 * art is always in unless the test passes an `art` port. With `boot` it starts on boot instead and
 * routes on from there, as the boot scene has it do.
 */
function titleRuntime(
  saves: SaveStore<SaveData>,
  {
    search = '',
    listedCourses,
    save = null,
    debug = false,
    online = roomPorts(createMemoryRoom()),
    deferScenes = false,
    art,
    boot = false,
  }: {
    search?: string;
    listedCourses?: readonly Course[];
    save?: SaveData | null;
    debug?: boolean;
    online?: OnlinePorts;
    deferScenes?: boolean;
    art?: ArtPort;
    boot?: boolean;
  } = {},
): TitleHarness {
  let asked: SceneKey | null = null;
  const showScene = () => {
    const scene = asked;
    asked = null;
    if (scene) rt.entered(scene);
  };
  const gameErrors: string[] = [];
  const notices: string[] = [];
  const ctx = {
    params: { seed: 1, scene: null, debug, testMode: true },
    reportError: (source: string) => {
      if (source !== 'audio') gameErrors.push(source);
    },
    notice: (text: string) => notices.push(text),
    registerAudioContext: () => {},
  } as unknown as GameContext;
  const rt: Runtime = new Runtime({
    ctx,
    saves,
    save,
    prefersReducedMotion: false,
    startScene: (scene) => {
      asked = scene;
      if (!deferScenes) showScene();
    },
    search,
    listedCourses,
    online,
    ...(art && { art }),
  });
  if (boot) {
    rt.boot();
    return { rt, gameErrors, notices, showScene };
  }
  rt.entered('title');
  rt.step.advance(ARMED);
  return { rt, gameErrors, notices, showScene };
}

/** Ports onto an in-memory room: every code connects to it, and a created room is always `ROOM_CODE`. */
function roomPorts(room: MemoryRoom): OnlinePorts {
  return {
    connect: () => room.connect(),
    createRoom: () => Promise.resolve({ ok: true, code: ROOM_CODE }),
    copyLink: () => Promise.resolve(true),
    seed: () => 7,
    kickAfterMs: null,
  };
}

/** Presses `action` for one tick, then lets a tick pass so the next press registers. */
function press(rt: Runtime, action: Action): void {
  input.inject(action, true);
  rt.step.advance(1);
  input.inject(action, false);
  rt.step.advance(1);
}

function toggleSound({ rt }: Harness): void {
  for (let row = 0; row < SOUND_ROW; row++) press(rt, 'down');
  press(rt, 'fire');
}

/** Lets every queued save write run to its end. */
async function settled(rt: Runtime): Promise<void> {
  await vi.waitFor(() => expect(rt.saving).toBe(false));
}

let logged: LogEntry[] = [];
beforeEach(() => {
  logged = [];
  configureLogging((entry) => logged.push(entry));
});
afterEach(() => {
  configureLogging(() => {});
  vi.restoreAllMocks();
});

describe('a save that cannot be written', () => {
  it('reaches the player as save.failed, not as a game error, whether the store reports or throws', async () => {
    for (const failure of [
      () => Promise.resolve<SaveResult>({ ok: false, reason: 'disk full' }),
      () => Promise.reject(new Error('IndexedDB is gone')),
    ]) {
      const store = await realStore();
      const { rt, gameErrors } = titleRuntime({ ...store, save: failure } as SaveStore<SaveData>);
      toggleSound({ rt, gameErrors });
      await settled(rt);

      expect(rt.events.all().filter((e) => e.type === 'save.failed')).toHaveLength(1);
      expect(rt.events.all().filter((e) => e.type === 'save.written')).toHaveLength(0);
      expect(gameErrors).toEqual([]);
      // The change still holds for the session.
      expect(rt.settings.muted).toBe(true);
    }
  });

  it('warns once, naming what was being saved', async () => {
    const store = await realStore();
    const { rt, gameErrors } = titleRuntime({
      ...store,
      save: () => Promise.reject(new Error('IndexedDB is gone')),
    } as SaveStore<SaveData>);
    toggleSound({ rt, gameErrors });
    await settled(rt);

    expect(logged).toEqual([
      { level: 'warn', namespace: 'rush-racers', message: 'Settings not saved: IndexedDB is gone' },
    ]);
  });
});

describe('overlapping save writes', () => {
  it('runs them one at a time, keeps the runtime busy until the last lands, and leaves the latest choice in force', async () => {
    const store = await realStore();
    const written: SaveData[] = [];
    const releases: (() => void)[] = [];
    const slow: SaveStore<SaveData> = {
      ...store,
      save: (_slot, data) =>
        new Promise<SaveResult>((resolve) => {
          written.push(data);
          releases.push(() => resolve({ ok: true }));
        }),
    };
    const { rt, gameErrors } = titleRuntime(slow);

    toggleSound({ rt, gameErrors }); // sound off
    press(rt, 'fire'); // sound back on, while the first write is still out
    expect(rt.settings.muted).toBe(false);
    expect(rt.saving).toBe(true);
    await vi.waitFor(() => expect(written).toHaveLength(1));
    // The second write waits for the first, so a slow older write can never land after a newer one.
    expect(written.map((data) => data.settings.muted)).toEqual([true]);

    releases[0]?.();
    await vi.waitFor(() => expect(written).toHaveLength(2));
    // The first write finished, and it must not put its older choice back over the newer one.
    expect(rt.save?.settings.muted).toBe(false);
    expect(rt.saving).toBe(true);

    releases[1]?.();
    await settled(rt);
    expect(rt.save?.settings.muted).toBe(false);
    expect(written.map((data) => data.settings.muted)).toEqual([true, false]);
    expect(gameErrors).toEqual([]);
  });
});

describe('loading a save fixture', () => {
  it('applies its settings as a change from the title would', async () => {
    const store = await realStore();
    const { rt } = titleRuntime(store);
    const muted: SaveData = { ...NEW_GAME, settings: { ...NEW_GAME.settings, muted: true } };
    const setMuted = vi.spyOn(rt.audio, 'setMuted');

    rt.loadSave(muted);

    expect(rt.settings.muted).toBe(true);
    expect(setMuted).toHaveBeenCalledWith(true);
  });
});

describe('the course a session races', () => {
  it('falls back to the default course with one warning naming an unknown ?course=', async () => {
    const { rt } = titleRuntime(await realStore(), { search: '?course=nope' });

    expect(rt.course).toBe(DEFAULT_COURSE);
    expect(logged).toEqual([
      {
        level: 'warn',
        namespace: 'rush-racers',
        message: 'unknown course in ?course=, racing the default',
        data: { course: 'nope', default: DEFAULT_COURSE.id },
      },
    ]);
  });

  it('races an unlisted ?course= course, but shows no NEW BEST and saves neither a best nor the course', async () => {
    const course = courseFromLevel({
      name: 'sprint',
      ascii: `
        ###########
        #1.......F#
        #2.......F#
        #3.......F#
        #4.......F#
        ###########
      `,
    });
    const { rt, gameErrors } = titleRuntime(await realStore(), { search: `?course=${course.id}` });
    rt.startRace();
    input.inject('right', true);
    for (let tick = 0; tick < 1200 && !rt.lastResult; tick++) rt.step.advance(1);
    input.inject('right', false);
    await settled(rt);

    expect(rt.world?.course).toBe(course.id);
    expect(rt.lastResult).toMatchObject({ result: { playerPlace: expect.any(Number) }, newBest: false });
    expect(rt.lastResult?.result.playerTicks).not.toBeNull();
    expect(rt.save).toMatchObject({ races: 1, bests: {}, lastCourse: null });
    // The title still draws the default course behind it: an unlisted course is never the last course.
    expect(rt.menuCourse).toBe(DEFAULT_COURSE);
    expect(gameErrors).toEqual([]);
  });
});

describe('a ?debug=1&local= race', () => {
  /** Hard, with a best on the default course at the race limit, which any finish beats. */
  const slowBest: SaveData = {
    ...NEW_GAME,
    settings: { ...NEW_GAME.settings, difficulty: 'hard' },
    bests: { [DEFAULT_COURSE.id]: { ...NO_BESTS, hard: { ticks: RACE_LIMIT_TICKS, place: 4 } } },
  };

  /** Starts a race from the title and swims `TOP_ROUTE` (recorded on seed 1, Hard) until the results are in. */
  async function raceTopRoute(options: { search?: string; debug?: boolean }) {
    const store = await realStore();
    const { rt, gameErrors } = titleRuntime(store, { ...options, save: slowBest });
    rt.startRace();
    for (const step of TOP_ROUTE) {
      for (const action of step.actions) input.inject(action, true);
      for (let tick = 0; tick < step.ticks && !rt.lastResult; tick++) rt.step.advance(1);
      for (const action of step.actions) input.inject(action, false);
    }
    await settled(rt);
    return { rt, gameErrors };
  }

  it('finishes faster than the saved best, yet shows no NEW BEST and saves nothing', async () => {
    const { rt, gameErrors } = await raceTopRoute({ search: '?local=player', debug: true });

    expect(rt.localSlot).toBe('player');
    expect(rt.lastResult?.result.playerTicks).toBeLessThan(RACE_LIMIT_TICKS);
    expect(rt.lastResult).toMatchObject({ newBest: false, saveFailed: false });
    expect(rt.save).toEqual(slowBest);
    expect(rt.events.all().filter((e) => e.type === 'save.written' || e.type === 'save.failed')).toEqual([]);
    expect(gameErrors).toEqual([]);
  });
});

describe('the title', () => {
  it('opens Friends from its second button', async () => {
    const { rt } = titleRuntime(await realStore());

    press(rt, 'down');
    press(rt, 'fire');

    expect([rt.scene, rt.online.friends.mode, rt.online.notice]).toEqual(['friends', 'menu', null]);
  });

  it('changes nothing when the tab hides offline', async () => {
    const { rt } = titleRuntime(await realStore());

    rt.hide();
    rt.show();

    expect([rt.scene, rt.loading, rt.flow.client, rt.online.notice]).toEqual(['title', false, null, null]);
  });

  it('leaves an offline race running untouched when the tab hides and shows', async () => {
    const { rt } = titleRuntime(await realStore(), { listedCourses: [DEFAULT_COURSE] });
    press(rt, 'fire');
    rt.step.advance(ARMED);
    press(rt, 'fire');
    rt.step.advance(5);
    await settled(rt);
    const saves = () => rt.events.all().filter((event) => event.type.startsWith('save.')).length;
    const savesBefore = saves();
    const world = rt.world;
    const tick = world?.tick;

    rt.hide();
    rt.show();
    await settled(rt);

    expect([rt.scene, rt.world === world, rt.world?.tick, rt.loading, rt.online.notice]).toEqual([
      'race',
      true,
      tick,
      false,
      null,
    ]);
    expect(saves()).toBe(savesBefore);
  });
});

describe('course select', () => {
  const threeCourses = () => ['Reef', 'Sunlit', 'Kelp'].map((name) => courseFromLevel({ name, ascii: '#1234F#' }));
  /** On course select, opened from the title's Race button, its arming ticks not yet spent. */
  async function onCourseSelect(listedCourses: readonly Course[]) {
    const { rt } = titleRuntime(await realStore(), { listedCourses });
    press(rt, 'fire');
    return rt;
  }

  it('opens from Race on the first row and ignores fire during its arming ticks', async () => {
    const rt = await onCourseSelect(threeCourses());
    expect([rt.scene, rt.courseCursor]).toEqual(['course', 0]);
    press(rt, 'fire');
    expect(rt.scene).toBe('course');
  });

  it('wraps up from the first row to the last', async () => {
    const rt = await onCourseSelect(threeCourses());
    press(rt, 'up');
    expect(rt.courseCursor).toBe(2);
  });

  it('goes back to the title on B', async () => {
    const rt = await onCourseSelect(threeCourses());
    rt.step.advance(ARMED);
    press(rt, 'dash');
    expect(rt.scene).toBe('title');
  });

  it('races the course A picks, and B on select comes back with the cursor on it', async () => {
    const courses = threeCourses();
    const rt = await onCourseSelect(courses);
    rt.step.advance(ARMED);
    press(rt, 'down');
    press(rt, 'fire');
    expect([rt.scene, rt.course]).toEqual(['select', courses[1]]);
    rt.step.advance(ARMED);
    press(rt, 'dash');
    expect([rt.scene, rt.courseCursor]).toEqual(['course', 1]);
  });

  it('keeps the course in force when the player picks another and backs out to the title', async () => {
    const courses = [DEFAULT_COURSE, ...threeCourses()];
    const rt = await onCourseSelect(courses);
    rt.step.advance(ARMED);
    press(rt, 'down');
    press(rt, 'fire');
    expect([rt.scene, rt.course]).toEqual(['select', courses[1]]);
    rt.step.advance(ARMED);
    press(rt, 'dash');
    rt.step.advance(ARMED);
    press(rt, 'dash');
    expect([rt.scene, rt.course]).toEqual(['title', DEFAULT_COURSE]);
  });

  it('is skipped for an unlisted ?course=: Race goes straight to select on that course, and B there to the title', async () => {
    const { rt } = titleRuntime(await realStore(), { search: '?course=run-test', listedCourses: threeCourses() });
    press(rt, 'fire');
    expect([rt.scene, rt.course.id]).toEqual(['select', 'run-test']);
    rt.step.advance(ARMED);
    press(rt, 'dash');
    expect(rt.scene).toBe('title');
  });

  it('is skipped while one course is listed: Race goes straight to select, and B there to the title', async () => {
    const rt = await onCourseSelect([DEFAULT_COURSE]);
    expect(rt.scene).toBe('select');
    rt.step.advance(ARMED);
    press(rt, 'dash');
    expect(rt.scene).toBe('title');
  });
});

describe('art a screen needs', () => {
  /**
   * Art for the courses in `loaded` is in; any other load waits until the test calls `finish` or
   * `fail`, as a chunk still on the wire does. `asked` lists each load: course ids, or 'all'.
   */
  function heldArt(loaded: readonly Course[]) {
    const have = new Set(loaded.map((course) => course.id));
    const asked: string[] = [];
    let held: { need: ArtNeed; resolve(): void; reject(error: Error): void } | null = null;
    const port: ArtPort = {
      ready: (need) => (need === 'all' ? have.has('all') : need.every(({ id }) => have.has(id) || have.has('all'))),
      load: (need) =>
        new Promise((resolve, reject) => {
          asked.push(need === 'all' ? 'all' : need.map(({ id }) => id).join(','));
          held = { need, resolve, reject };
        }),
    };
    const settle = () => {
      const load = held;
      if (!load) throw new Error('No art load is waiting');
      held = null;
      return load;
    };
    return {
      port,
      asked,
      finish() {
        const { need, resolve } = settle();
        for (const id of need === 'all' ? ['all'] : need.map((course) => course.id)) have.add(id);
        resolve();
      },
      fail: () => settle().reject(new Error("Couldn't load the art for world 'thornwood': 404")),
    };
  }

  /** On course select with Bramble Run picked and its art still loading. */
  async function pickedBrambleRun() {
    const art = heldArt([DEFAULT_COURSE]);
    const harness = titleRuntime(await realStore(), { listedCourses: [DEFAULT_COURSE, BRAMBLE_RUN], art: art.port });
    press(harness.rt, 'fire');
    harness.rt.step.advance(ARMED);
    press(harness.rt, 'down');
    press(harness.rt, 'fire');
    return { ...harness, art };
  }

  it("holds course select, ticking nothing, until the picked course's art is in, then opens select", async () => {
    const { rt, art, gameErrors } = await pickedBrambleRun();
    expect(art.asked).toEqual(['bramble-run']);
    expect([rt.scene, rt.loading, rt.courseCursor]).toEqual(['course', true, 1]);

    const logged = rt.events.all().length;
    rt.step.advance(ARMED);
    expect([rt.scene, rt.courseCursor, rt.events.all().length]).toEqual(['course', 1, logged]);

    art.finish();
    await vi.waitFor(() => expect([rt.scene, rt.loading, rt.course]).toEqual(['select', false, BRAMBLE_RUN]));
    expect(gameErrors).toEqual([]);
  });

  it('reports a failed load, tells the player to reload, and tries again on the next pick', async () => {
    const { rt, art, gameErrors, notices } = await pickedBrambleRun();

    art.fail();
    await vi.waitFor(() => expect(gameErrors).toEqual(['art']));
    expect(notices).toEqual([ART_LOAD_FAILED]);
    expect([rt.scene, rt.loading]).toEqual(['course', false]);

    rt.step.advance(1);
    press(rt, 'fire');
    art.finish();
    await vi.waitFor(() => expect(rt.scene).toBe('select'));
    expect(art.asked).toEqual(['bramble-run', 'bramble-run']);
  });

  /** A host waiting in a memory room; each round ticks it, then `rt`, then delivers. */
  function hostedRoom() {
    const room = createMemoryRoom();
    const host = createClient({
      connection: room.connect(),
      lobby: { character: 'gil', course: 'run-test', difficulty: 'normal' },
      createRace: (start) => createOnlineWorld(start, new EventLog(10_000)),
      kickAfterMs: null,
      warn: (message) => {
        throw new Error(`the host warned: ${message}`);
      },
    });
    const rounds = (rt: Runtime, count: number) => {
      for (let done = 0; done < count; done++) {
        host.tick(IDLE_INPUT, 16);
        rt.step.advance(1);
        room.deliver();
      }
    };
    return { room, host, rounds };
  }

  it("keeps a room link's guest out of the room, so the host can't start, until every world's art is in", async () => {
    const { room, host, rounds } = hostedRoom();
    const art = heldArt([DEFAULT_COURSE]);
    const { rt, gameErrors } = titleRuntime(await realStore(), {
      search: `?room=${ROOM_CODE}`,
      online: roomPorts(room),
      art: art.port,
    });

    expect(rt.openRoomLink()).toBe(true);
    rounds(rt, 60);
    expect([art.asked, rt.scene, rt.flow.client, host.view.lobby.canStart]).toEqual([['all'], 'title', null, false]);

    art.finish();
    await vi.waitFor(() => expect(rt.scene).toBe('room'));
    rounds(rt, 60);
    expect(host.view.lobby.canStart).toBe(true);
    expect(gameErrors).toEqual([]);
  });

  it("opens Friends, where rooms are joined and created, only once every world's art is in", async () => {
    const art = heldArt([DEFAULT_COURSE]);
    const { rt } = titleRuntime(await realStore(), { art: art.port });

    press(rt, 'down');
    press(rt, 'fire');
    expect([art.asked, rt.scene, rt.loading]).toEqual([['all'], 'title', true]);

    art.finish();
    await vi.waitFor(() => expect([rt.scene, rt.loading]).toEqual(['friends', false]));
    // Lets the input see fire released, which it couldn't while the art loaded, so later tests start clean.
    rt.step.advance(1);
  });

  it("never joins a room link's room when every world's art fails to load", async () => {
    const { room, host, rounds } = hostedRoom();
    const art = heldArt([DEFAULT_COURSE]);
    const { rt, gameErrors, notices } = titleRuntime(await realStore(), {
      search: `?room=${ROOM_CODE}`,
      online: roomPorts(room),
      art: art.port,
    });
    rt.openRoomLink();

    art.fail();
    await vi.waitFor(() => expect(gameErrors).toEqual(['art']));
    rounds(rt, 60);

    expect([notices, rt.scene, rt.flow.client, host.view.lobby.canStart]).toEqual([
      [ART_LOAD_FAILED],
      'title',
      null,
      false,
    ]);
  });

  it('asks again for boot’s art on the next press after it fails to load, then opens the title', async () => {
    const art = heldArt([]);
    const { rt, gameErrors, notices } = titleRuntime(await realStore(), { art: art.port, boot: true });
    expect([art.asked, rt.scene, rt.loading]).toEqual([['sunlit-shallows,sunlit-shallows'], 'boot', true]);

    art.fail();
    await vi.waitFor(() => expect(gameErrors).toEqual(['art']));
    expect([notices, rt.scene, rt.loading]).toEqual([[ART_LOAD_FAILED], 'boot', false]);
    rt.step.advance(ARMED);
    expect(art.asked).toHaveLength(1);

    press(rt, 'fire');
    expect(art.asked).toHaveLength(2);
    art.finish();
    await vi.waitFor(() => expect([rt.scene, rt.loading]).toEqual(['title', false]));
    // Lets the input see fire released, which it couldn't while the art loaded, so later tests start clean.
    rt.step.advance(1);
  });

  it("loads every world's art before a room link's room opens, so no race starts before it is in", async () => {
    const art = heldArt([DEFAULT_COURSE]);
    const { rt, gameErrors } = titleRuntime(await realStore(), { search: `?room=${ROOM_CODE}`, art: art.port });

    expect(rt.openRoomLink()).toBe(true);
    rt.step.advance(10);
    expect([art.asked, rt.scene, rt.loading]).toEqual([['all'], 'title', true]);

    art.finish();
    await vi.waitFor(() => expect([rt.scene, rt.loading]).toEqual(['room', false]));
    expect(gameErrors).toEqual([]);
  });
});

describe('changing character from the results screen', () => {
  /**
   * Picks Gil on the first select screen (right once from Rudy), races an idle player to a DNF and waits
   * out the results menu's arming ticks. `listedCourses` with more than one course adds a course select first.
   */
  function onResults(rt: Runtime, { courseSelect = false } = {}): void {
    press(rt, 'fire');
    if (courseSelect) {
      rt.step.advance(ARMED);
      press(rt, 'fire');
    }
    rt.step.advance(ARMED);
    press(rt, 'right');
    press(rt, 'fire');
    rt.step.advance(COUNTDOWN_TICKS + RACE_LIMIT_TICKS + 90 + ARMED);
  }
  const playerCharacter = (rt: Runtime) => rt.world && playerOf(rt.world).character;
  const twoCourses = () => ['Reef', 'Sunlit'].map((name) => courseFromLevel({ name, ascii: '#1234F#' }));

  it('offers Race again, Character and Title', async () => {
    const { rt } = titleRuntime(await realStore(), { listedCourses: [DEFAULT_COURSE] });
    onResults(rt);
    expect([rt.scene, rt.menu?.options]).toEqual(['results', ['Race again', 'Character', 'Title']]);
  });

  it('opens select on the current pick, and the next race runs as the pick moved to', async () => {
    const { rt } = titleRuntime(await realStore(), { listedCourses: [DEFAULT_COURSE] });
    onResults(rt);
    expect(playerCharacter(rt)).toBe('gil');
    press(rt, 'down');
    press(rt, 'fire');
    expect([rt.scene, rt.selectedCharacter]).toEqual(['select', 'gil']);
    rt.step.advance(ARMED);
    press(rt, 'right');
    press(rt, 'fire');
    expect([rt.scene, playerCharacter(rt)]).toEqual(['race', 'streak']);
  });

  it('opens course select first while it is shown, then select', async () => {
    const { rt } = titleRuntime(await realStore(), { listedCourses: twoCourses() });
    onResults(rt, { courseSelect: true });
    expect(rt.scene).toBe('results');
    press(rt, 'down');
    press(rt, 'fire');
    expect(rt.scene).toBe('course');
    rt.step.advance(ARMED);
    press(rt, 'fire');
    expect(rt.scene).toBe('select');
  });

  it('goes back to results on B from select, keeping the finished race and Character selected', async () => {
    const { rt } = titleRuntime(await realStore(), { listedCourses: [DEFAULT_COURSE] });
    onResults(rt);
    press(rt, 'down');
    press(rt, 'fire');
    rt.step.advance(ARMED);
    press(rt, 'dash');
    expect([rt.scene, rt.lastResult === null, rt.world === null]).toEqual(['results', false, false]);
    expect(rt.menu && selectedOption(rt.menu)).toBe('Character');
  });

  it('races the finished course again after another is picked on course select and backed out of', async () => {
    const courses = twoCourses();
    const { rt } = titleRuntime(await realStore(), { listedCourses: courses });
    onResults(rt, { courseSelect: true });
    expect(rt.world?.course).toBe(courses[0]?.id);
    press(rt, 'down');
    press(rt, 'fire');
    rt.step.advance(ARMED);
    press(rt, 'down');
    press(rt, 'fire');
    expect([rt.scene, rt.course]).toEqual(['select', courses[1]]);
    rt.step.advance(ARMED);
    press(rt, 'dash');
    rt.step.advance(ARMED);
    press(rt, 'dash');
    expect(rt.scene).toBe('results');
    rt.step.advance(ARMED);
    press(rt, 'up');
    press(rt, 'fire');
    expect([rt.scene, rt.world?.course]).toEqual(['race', courses[0]?.id]);
  });

  it('goes back to results on B from select and again from course select', async () => {
    const { rt } = titleRuntime(await realStore(), { listedCourses: twoCourses() });
    onResults(rt, { courseSelect: true });
    press(rt, 'down');
    press(rt, 'fire');
    rt.step.advance(ARMED);
    press(rt, 'fire');
    rt.step.advance(ARMED);
    press(rt, 'dash');
    expect(rt.scene).toBe('course');
    rt.step.advance(ARMED);
    press(rt, 'dash');
    expect(rt.scene).toBe('results');
  });
});

describe('race controls', () => {
  /** A runtime racing on the default course, past the countdown, the player holding three items. */
  async function racing() {
    const { rt } = titleRuntime(await realStore(), { listedCourses: [DEFAULT_COURSE] });
    press(rt, 'fire');
    rt.step.advance(ARMED);
    press(rt, 'fire');
    rt.step.advance(COUNTDOWN_TICKS);
    const world = rt.world;
    if (!world) throw new Error('the race never started');
    giveItems(playerOf(world), ['inkSac', 'puffer', 'mimic']);
    return rt;
  }
  const itemEvents = (rt: Runtime) =>
    rt.events
      .all()
      .filter((event) => event.type === 'item.selected' || event.type === 'item.used')
      .map(({ tick: _tick, seq: _seq, ...event }) => event);

  it('cycles the selection with next and prev, and fires the selected item with fire', async () => {
    const rt = await racing();

    press(rt, 'next');
    press(rt, 'next');
    press(rt, 'prev');
    press(rt, 'fire');

    expect(itemEvents(rt)).toEqual([
      { type: 'item.selected', id: 'player', slot: 1, kind: 'puffer' },
      { type: 'item.selected', id: 'player', slot: 2, kind: 'mimic' },
      { type: 'item.selected', id: 'player', slot: 1, kind: 'puffer' },
      { type: 'item.used', id: 'player', kind: 'puffer', slot: 1, chargesLeft: 1 },
    ]);
  });

  it('kicks on dash without firing an item', async () => {
    const rt = await racing();

    press(rt, 'dash');

    expect(rt.events.all().filter((event) => event.type === 'racer.kicked')).toHaveLength(1);
    expect(itemEvents(rt)).toEqual([]);
  });
});

describe('an online race', () => {
  /** Logic ticks a test may run before a condition counts as stuck. */
  const TICK_LIMIT = 6000;
  /** Ticks from a race's end to its results screen. */
  const RESULTS_DELAY = 90;
  /** Ticks an offline race on a four-tile course may take, with right held, before it counts as stuck. */
  const OFFLINE_RACE_LIMIT = COUNTDOWN_TICKS + 600 + RESULTS_DELAY;
  /** Run right, jumping on a cycle, as the client tests' racers do; the runtime's own racer stays idle. */
  const runAndJump = (tick: number): TickInput => {
    const jumping = tick % 40 < 25;
    return { ...IDLE_INPUT, move: jumping ? { x: Math.SQRT1_2, y: -Math.SQRT1_2 } : { x: 1, y: 0 } };
  };
  const hashOf = (world: World | null | undefined) => (world ? hashWorld(world) : null);
  const savesOf = (rt: Runtime) => rt.events.all().filter((event) => event.type.startsWith('save.'));
  const scenesStarted = (rt: Runtime) =>
    rt.events.all().flatMap((event) => (event.type === 'scene.started' ? [event.scene] : []));

  /**
   * A runtime that opened a `?room=` link, as boot does, to a room whose host is a bare client on
   * Run Test. Scenes come up between ticks, as Phaser's do. Each round ticks the host, then the
   * runtime, then brings up any scene the runtime asked for, then the room delivers. `listedCourses`
   * are the courses an offline race may run on.
   */
  async function joinedRoom(listedCourses: readonly Course[] = [DEFAULT_COURSE]) {
    const room = createMemoryRoom();
    const host = createClient({
      connection: room.connect(),
      lobby: { character: 'gil', course: 'run-test', difficulty: 'normal' },
      createRace: (start) => createOnlineWorld(start, new EventLog(10_000)),
      kickAfterMs: null,
      warn: (message) => {
        throw new Error(`the host warned: ${message}`);
      },
    });
    const { rt, gameErrors, showScene } = titleRuntime(await realStore(), {
      search: `?room=${ROOM_CODE}`,
      listedCourses,
      online: roomPorts(room),
      deferScenes: true,
    });
    expect(rt.openRoomLink()).toBe(true);
    showScene();
    const round = () => {
      host.tick(runAndJump(host.view.race?.targetTick ?? 0), 16);
      rt.step.advance(1);
      showScene();
      room.deliver();
    };
    const rounds = (count: number) => {
      for (let done = 0; done < count; done++) round();
    };
    const until = (done: () => boolean) => {
      for (let ticks = 0; ticks < TICK_LIMIT && !done(); ticks++) round();
      if (!done()) throw new Error(`not reached within ${TICK_LIMIT} ticks`);
    };
    /** Presses `action` for one round, then lets one pass so the next press registers. */
    const pressOnline = (action: Action) => {
      input.inject(action, true);
      round();
      input.inject(action, false);
      round();
    };
    until(() => host.view.lobby.canStart);
    return { rt, host, room, rounds, until, pressOnline, showScene, gameErrors };
  }

  it('races the world the client built, in the slot the start gave, and saves nothing', async () => {
    const { rt, host, until, gameErrors } = await joinedRoom();
    expect(rt.scene).toBe('room');

    host.start(9);
    until(() => rt.scene === 'race');
    expect(rt.world).toBe((rt.flow.client as OnlineClient).world);
    expect(rt.localRacer).toBe('tess');
    expect(rt.world?.humans).toEqual(['player', 'tess']);

    until(() => rt.scene === 'results');
    expect(hashOf(rt.world)).toBe(hashOf(host.world));
    expect(rt.world?.race.result?.standings).toEqual(host.world?.race.result?.standings);
    expect(rt.lastResult).toMatchObject({ newBest: false, saveFailed: false });
    expect(rt.menu?.options).toEqual(['Race again', 'Title']);
    // A write would be queued by now; let any run to its end before looking for it.
    expect(rt.saving).toBe(false);
    await settled(rt);
    expect(savesOf(rt)).toEqual([]);
    expect(rt.save).toBeNull();
    expect(gameErrors).toEqual([]);
  });

  it('keeps the first step’s countdown beep for the race scene, which opens on the world’s next step', async () => {
    const { rt, host, until } = await joinedRoom();
    const heard: { scene: SceneKey; worldTick: number | null }[] = [];
    rt.listen((events) => {
      if (events.some((event) => event.type === 'race.countdown'))
        heard.push({ scene: rt.scene, worldTick: rt.world?.tick ?? null });
    });

    host.start(9);
    until(() => heard.length > 0);

    expect(heard).toEqual([{ scene: 'race', worldTick: 2 }]);
  });

  it('goes back to the room on Race again, and into the next race the host starts', async () => {
    const { rt, host, rounds, until, pressOnline } = await joinedRoom();
    host.start(9);
    until(() => rt.scene === 'results');
    const firstWorld = rt.world;
    rounds(ARMED);
    pressOnline('fire');
    expect(rt.scene).toBe('room');
    expect(rt.world).toBeNull();

    host.returnToLobby();
    until(() => host.view.lobby.canStart);
    host.start(10);
    until(() => rt.scene === 'race');
    expect(rt.world).not.toBe(firstWorld);
    expect(rt.world).toBe(rt.flow.client?.world);
  });

  it('takes a player still on results into the next race the host starts', async () => {
    const { rt, host, until } = await joinedRoom();
    host.start(9);
    until(() => rt.scene === 'results');
    const firstWorld = rt.world;
    host.returnToLobby();
    until(() => host.view.lobby.canStart);

    host.start(10);
    until(() => rt.scene === 'race');
    expect(rt.world).not.toBe(firstWorld);
    expect(rt.localRacer).toBe('tess');
  });

  it('takes a player whose race has ended, before its results show, into the next race', async () => {
    const { rt, host, rounds, until } = await joinedRoom();
    host.start(9);
    until(() => rt.lastResult !== null);
    expect(rt.scene).toBe('race');
    const firstWorld = rt.world;

    host.returnToLobby();
    until(() => host.view.lobby.canStart);
    host.start(10);
    until(() => rt.world !== firstWorld);
    expect([rt.scene, rt.lastResult]).toEqual(['race', null]);

    rounds(RESULTS_DELAY + 1);
    expect(rt.scene).toBe('race');
    expect(scenesStarted(rt)).not.toContain('results');
  });

  it('leaves the room for the title on Title, letting go of it', async () => {
    const { rt, host, rounds, until, pressOnline } = await joinedRoom();
    host.start(9);
    until(() => rt.scene === 'results');
    rounds(ARMED);
    pressOnline('down');
    pressOnline('fire');

    expect([rt.scene, rt.world, rt.flow.client, rt.online.notice]).toEqual(['title', null, null, null]);
    until(() => host.view.lobby.peers.length === 1);
  });

  it('races offline after Title from online results: as slot 1, with the offline results, saved', async () => {
    // Four-tile courses, so the offline race is over in a few hundred ticks with right held. Two of
    // them, so course select shows and the race runs on the first rather than the default course.
    const short = ['Short', 'Shorter'].map((name) => courseFromLevel({ name, ascii: '#1234F#' }));
    const { rt, host, rounds, until, pressOnline, showScene } = await joinedRoom(short);
    host.start(9);
    until(() => rt.scene === 'results');
    rounds(ARMED);
    pressOnline('down');
    pressOnline('fire');
    rounds(ARMED);
    pressOnline('fire');
    rounds(ARMED);
    expect(rt.scene).toBe('course');
    pressOnline('fire');
    rounds(ARMED);
    pressOnline('fire');

    expect([rt.scene, rt.onlineRace, rt.localRacer]).toEqual(['race', false, 'player']);
    // The summary's `net` is this; null leaves it out.
    expect(netSummary(rt.flow)).toBeNull();
    input.inject('right', true);
    for (let ticks = 0; ticks < OFFLINE_RACE_LIMIT && rt.scene !== 'results'; ticks++) {
      rt.step.advance(1);
      showScene();
    }
    input.inject('right', false);
    expect(rt.scene).toBe('results');
    expect(rt.menu?.options).toEqual(['Race again', 'Character', 'Title']);
    await settled(rt);
    expect(rt.save?.races).toBe(1);
  });

  it.each([
    ['mid-race', (rt: Runtime) => rt.scene === 'race' && rt.world?.race.phase === 'racing'],
    ['on results', (rt: Runtime) => rt.scene === 'results'],
  ])('goes to the title with the reason when the room closes the connection %s', async (_when, reached) => {
    const { rt, host, room, until, gameErrors } = await joinedRoom();
    const you = rt.flow.client?.view.lobby.you ?? 0;
    host.start(9);
    until(() => reached(rt));

    room.drop(you, 'kicked');
    until(() => rt.scene === 'title');

    expect([rt.world, rt.localRacer, rt.flow.client]).toEqual([null, 'player', null]);
    expect(rt.online.notice).toBe('You were dropped from the race');
    expect(gameErrors).toEqual([]);
  });

  it('goes back to the room, out of the race, when it goes out of sync', async () => {
    const { rt, host, until } = await joinedRoom();
    host.start(9);
    until(() => (rt.flow.client?.view.race?.simTick ?? 0) >= 70);
    const racer = rt.world?.racers.find((each) => each.id === 'tess');
    if (!racer) throw new Error('no tess racer in the guest world');
    racer.body.x += 1;

    until(() => rt.scene === 'room');

    expect([rt.world, rt.onlineRace, rt.localRacer, rt.online.notice]).toEqual([
      null,
      false,
      'player',
      'The race went out of sync',
    ]);
    expect(rt.flow.client?.view).toMatchObject({ status: 'lobby', race: null });
  });

  it('leaves a running race for the title when the tab hides, and the notice stays until a press there', async () => {
    const { rt, host, rounds, until, pressOnline, showScene } = await joinedRoom();
    host.start(9);
    until(() => rt.world?.race.phase === 'racing');

    rt.hide();
    showScene();
    expect([rt.scene, rt.world, rt.flow.client, rt.online.notice]).toEqual(['title', null, null, 'You left the race']);
    until(() => host.view.lobby.peers.length === 1);

    rounds(ARMED);
    expect(rt.online.notice).toBe('You left the race');
    pressOnline('left');
    expect(rt.online.notice).toBeNull();
  });

  it('ignores a ?room= that is not a room code, with one warning', async () => {
    const { rt } = titleRuntime(await realStore(), { search: '?room=nope' });

    expect(rt.openRoomLink()).toBe(false);
    expect(rt.scene).toBe('title');
    expect(rt.flow.client).toBeNull();
    expect(logged.filter((entry) => entry.level === 'warn').map((entry) => entry.message)).toEqual([
      '?room=nope is not a room code, so no room was joined',
    ]);
  });
});
