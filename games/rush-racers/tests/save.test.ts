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
/**
 * What a pre-v6 save's bests become: v5 files them under Sunlit Shallows, the one course there was,
 * and v7 drops them again because it lengthened that course, so none reach the current version.
 * `best` is what v5 filed, checked step by step in the v5 test.
 */
const onSunlit = (_best: typeof NO_BEST | Record<string, unknown>) => ({ bests: {}, lastCourse: null });

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
      data: { ...NEW_GAME, ...onSunlit(NO_BEST) },
    });
  });

  it("upgrades a v2 save to race as Rudy on Easy, keeping its best (now Easy's), races and settings", async () => {
    expect(await load('save-v2.json')).toEqual({
      kind: 'ok',
      migratedFrom: 2,
      data: {
        ...onSunlit({ ...NO_BEST, easy: { ticks: 2712, place: 2 } }),
        races: 3,
        settings: { muted: false, reducedMotion: null, difficulty: 'easy' },
        character: 'rudy',
      },
    });
  });

  it('upgrades a v3 save to the easy difficulty, keeping everything else', async () => {
    expect(await load('save-v3.json')).toEqual({
      kind: 'ok',
      migratedFrom: 3,
      data: {
        ...onSunlit({ ...NO_BEST, easy: { ticks: 2712, place: 2 } }),
        races: 3,
        settings: { muted: false, reducedMotion: null, difficulty: 'easy' },
        character: 'selene',
      },
    });
  });

  it('upgrades a v4 save by filing its one best under the level the save was on', async () => {
    expect(await load('save-v4.json')).toEqual({
      kind: 'ok',
      migratedFrom: 4,
      data: {
        ...onSunlit({ ...NO_BEST, normal: { ticks: 2712, place: 2 } }),
        races: 3,
        settings: { muted: false, reducedMotion: null, difficulty: 'normal' },
        character: 'selene',
      },
    });
  });

  it("files a v5 save's bests under Sunlit Shallows, with no last course yet", () => {
    const v5 = JSON.parse(readFileSync(new URL('save-v5.json', fixturesDir), 'utf8')).data;
    expect(migrations[5]?.(v5)).toMatchObject({
      bests: { 'sunlit-shallows': { easy: { ticks: 3100, place: 3 }, normal: null, hard: { ticks: 2650, place: 1 } } },
      lastCourse: null,
    });
  });

  it('upgrades a v5 save to the current version, its Sunlit Shallows bests dropped by v7', async () => {
    expect(await load('save-v5.json')).toEqual({
      kind: 'ok',
      migratedFrom: 5,
      data: {
        ...onSunlit({ easy: { ticks: 3100, place: 3 }, normal: null, hard: { ticks: 2650, place: 1 } }),
        races: 7,
        settings: { muted: true, reducedMotion: true, difficulty: 'hard' },
        character: 'baron',
      },
    });
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
