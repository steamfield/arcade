import 'fake-indexeddb/auto';
import { configureLogging, type LogEntry } from '@arcade/core';
import type { SaveResult, SaveStore } from '@arcade/save';
import { createSaveStore } from '@arcade/save';
import type { GameContext } from '@arcade/shell';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_COURSE } from '../logic/courses/index.ts';
import type { Course } from '../logic/courses/types.ts';
import { COUNTDOWN_TICKS, RACE_LIMIT_TICKS } from '../logic/race/standings.ts';
import { playerOf } from '../logic/racers.ts';
import { migrations, NEW_GAME, SAVE_VERSION, type SaveData, SaveSchema } from '../logic/save.ts';
import { courseFromLevel, giveItems } from '../logic/test-world.ts';
import { type Action, input } from './input.ts';
import { selectedOption } from './menu.ts';
import { Runtime } from './runtime.ts';

/** Title rows: Race, How to play, Level, Sound, Motion. Sound is three down. */
const SOUND_ROW = 3;
/** The title ignores fire for its first 20 ticks. */
const ARMED = 21;

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

/**
 * A runtime on its title screen, as the shell hands it over, over `saves`, opened at `search` and
 * offering `listedCourses` on course select. Each scene it asks for comes up at once, as Phaser's would.
 */
function titleRuntime(
  saves: SaveStore<SaveData>,
  { search = '', listedCourses }: { search?: string; listedCourses?: readonly Course[] } = {},
): Harness {
  const gameErrors: string[] = [];
  const ctx = {
    params: { seed: 1, scene: null, debug: false, testMode: true },
    reportError: (source: string) => {
      if (source !== 'audio') gameErrors.push(source);
    },
    notice: () => {},
    registerAudioContext: () => {},
  } as unknown as GameContext;
  const rt: Runtime = new Runtime({
    ctx,
    saves,
    save: null,
    prefersReducedMotion: false,
    startScene: (scene) => rt.entered(scene),
    search,
    listedCourses,
  });
  rt.entered('title');
  rt.step.advance(ARMED);
  return { rt, gameErrors };
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
