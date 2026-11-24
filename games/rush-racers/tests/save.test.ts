import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { createSaveStore } from '@arcade/save';
import { checkSaveFixtures } from '@arcade/testing';
import { describe, expect, it } from 'vitest';
import { migrations, NEW_GAME, SAVE_VERSION, type SaveData, SaveSchema } from '../src/logic/save.ts';

const fixturesDir = new URL('./fixtures/', import.meta.url);
let store = 0;
const freshStore = () =>
  createSaveStore({ gameId: `fixture-${store++}`, version: SAVE_VERSION, schema: SaveSchema, migrate: migrations });

const NO_BEST = { easy: null, normal: null, hard: null };
const NO_COURSE_RECORDS = { bests: {}, lastCourse: null };

/** Stops at v6 so the test can see Sunlit Shallows records before v7 drops them. */
function fixtureAtV6(from: number): unknown {
  let data: unknown = JSON.parse(readFileSync(new URL(`save-v${from}.json`, fixturesDir), 'utf8')).data;
  for (let version = from; version <= 5; version++) {
    const migrate = migrations[version];
    if (!migrate) throw new Error(`Missing migration from save v${version}`);
    data = migrate(data);
  }
  return data;
}

/** Imports a committed fixture into a fresh store, as a player's old save file would load. */
async function load(file: string) {
  const saves = await freshStore();
  return saves.importJson('main', readFileSync(new URL(file, fixturesDir), 'utf8'));
}

describe('save compatibility', () => {
  // Every fixture, including ones added later without their own assertions, must still load.
  it('has a fixture for every save version, and each loads migrated to the current one', async () => {
    const report = await checkSaveFixtures({ dir: fixturesDir, currentVersion: SAVE_VERSION, openStore: freshStore });
    expect(report).toEqual({ missingVersions: [], failures: [] });
  });

  it('upgrades a v1 save to a new game: nothing in the template save carries over', async () => {
    expect(await load('save-v1.json')).toEqual({
      kind: 'ok',
      migratedFrom: 1,
      data: { ...NEW_GAME, ...NO_COURSE_RECORDS },
    });
  });

  it("files a v2 save's best under Easy at v6 and loads the current save as Rudy on Easy", async () => {
    expect(fixtureAtV6(2)).toMatchObject({
      bests: { 'sunlit-shallows': { ...NO_BEST, easy: { ticks: 2712, place: 2 } } },
      lastCourse: null,
    });
    expect(await load('save-v2.json')).toEqual({
      kind: 'ok',
      migratedFrom: 2,
      data: {
        ...NO_COURSE_RECORDS,
        races: 3,
        settings: { muted: false, reducedMotion: null, difficulty: 'easy' },
        character: 'rudy',
      },
    });
  });

  it("files a v3 save's best under Easy at v6 and loads the current save on Easy", async () => {
    expect(fixtureAtV6(3)).toMatchObject({
      bests: { 'sunlit-shallows': { ...NO_BEST, easy: { ticks: 2712, place: 2 } } },
      lastCourse: null,
    });
    expect(await load('save-v3.json')).toEqual({
      kind: 'ok',
      migratedFrom: 3,
      data: {
        ...NO_COURSE_RECORDS,
        races: 3,
        settings: { muted: false, reducedMotion: null, difficulty: 'easy' },
        character: 'selene',
      },
    });
  });

  it("files a v4 save's best under its Normal difficulty at v6 and loads the current save on Normal", async () => {
    expect(fixtureAtV6(4)).toMatchObject({
      bests: { 'sunlit-shallows': { ...NO_BEST, normal: { ticks: 2712, place: 2 } } },
      lastCourse: null,
    });
    expect(await load('save-v4.json')).toEqual({
      kind: 'ok',
      migratedFrom: 4,
      data: {
        ...NO_COURSE_RECORDS,
        races: 3,
        settings: { muted: false, reducedMotion: null, difficulty: 'normal' },
        character: 'selene',
      },
    });
  });

  it("files a v5 save's bests under Sunlit Shallows, with no last course yet", () => {
    expect(fixtureAtV6(5)).toMatchObject({
      bests: { 'sunlit-shallows': { easy: { ticks: 3100, place: 3 }, normal: null, hard: { ticks: 2650, place: 1 } } },
      lastCourse: null,
    });
  });

  it('upgrades a v5 save to the current version, its Sunlit Shallows bests dropped by v7', async () => {
    expect(await load('save-v5.json')).toEqual({
      kind: 'ok',
      migratedFrom: 5,
      data: {
        ...NO_COURSE_RECORDS,
        races: 7,
        settings: { muted: true, reducedMotion: true, difficulty: 'hard' },
        character: 'baron',
      },
    });
  });

  it('drops bests for all four lengthened courses in v7 and keeps the rest of the save', () => {
    const record = { ...NO_BEST, normal: { ticks: 4000, place: 2 } };
    const unchanged: Omit<SaveData, 'bests'> = {
      lastCourse: 'bramble-run',
      races: 9,
      settings: { muted: true, reducedMotion: false, difficulty: 'hard' },
      character: 'selene',
    };
    const v6: SaveData = {
      ...unchanged,
      bests: {
        'sunlit-shallows': record,
        'bramble-run': record,
        'thunderhead-pass': record,
        'slingshot-alley': record,
        'retired-course': record,
      },
    };
    expect(migrations[6]?.(v6)).toEqual({ ...unchanged, bests: { 'retired-course': record } });
  });

  it('drops v6 bests on the lengthened courses, keeping bests for a course the game no longer has', async () => {
    expect(await load('save-v6.json')).toEqual({
      kind: 'ok',
      migratedFrom: 6,
      data: {
        bests: {
          'retired-course': { easy: null, normal: { ticks: 4000, place: 2 }, hard: null },
        },
        lastCourse: 'sunlit-shallows',
        races: 9,
        settings: { muted: false, reducedMotion: null, difficulty: 'normal' },
        character: 'selene',
      },
    });
  });

  it('keeps the picked character through a save and a load', async () => {
    const saves = await freshStore();
    const data: SaveData = { ...NEW_GAME, races: 2, character: 'baron' };
    expect(await saves.save('main', data)).toEqual({ ok: true });
    expect(await saves.load('main')).toEqual({ kind: 'ok', data });
  });
});
