import 'fake-indexeddb/auto';
import { readdirSync, readFileSync } from 'node:fs';
import { createSaveStore } from '@arcade/save';
import { describe, expect, it } from 'vitest';
import { migrations, NEW_GAME, SAVE_VERSION, type SaveData, SaveSchema } from '../src/logic/save.ts';

const fixturesDir = new URL('./fixtures/', import.meta.url);
const fixtures = readdirSync(fixturesDir).filter((f) => /^save-v\d+\.json$/.test(f));
let store = 0;
const freshStore = () =>
  createSaveStore({ gameId: `fixture-${store++}`, version: SAVE_VERSION, schema: SaveSchema, migrate: migrations });

const NO_BEST = { easy: null, normal: null, hard: null };
/** A pre-v6 save's bests, which were all set on the one course there was. */
const onSunlit = (best: typeof NO_BEST | Record<string, unknown>) => ({
  bests: { 'sunlit-shallows': best },
  lastCourse: null,
});

/** Imports a committed fixture into a fresh store, as a player's old save file would load. */
async function load(file: string) {
  const saves = await freshStore();
  return saves.importJson('main', readFileSync(new URL(file, fixturesDir), 'utf8'));
}

describe('save compatibility', () => {
  it('has a fixture for every save version up to the current one', () => {
    const versions = fixtures.map((f) => Number(/\d+/.exec(f)?.[0]));
    for (let v = 1; v <= SAVE_VERSION; v++) expect(versions).toContain(v);
  });

  // Every fixture, including ones added later without their own assertions, must still load.
  it.each(fixtures)('%s still loads with the current code', async (file) => {
    expect((await load(file)).kind).toBe('ok');
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

  it('upgrades a v5 save by filing its bests under Sunlit Shallows, with no last course yet', async () => {
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

  it('loads a v6 save as it is, keeping bests for a course the game no longer has', async () => {
    expect(await load('save-v6.json')).toEqual({
      kind: 'ok',
      data: {
        bests: {
          'sunlit-shallows': { easy: { ticks: 3100, place: 3 }, normal: null, hard: { ticks: 2650, place: 1 } },
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
