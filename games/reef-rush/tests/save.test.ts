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

describe('save compatibility', () => {
  it('has a fixture for every save version up to the current one', () => {
    const versions = fixtures.map((f) => Number(/\d+/.exec(f)?.[0]));
    for (let v = 1; v <= SAVE_VERSION; v++) expect(versions).toContain(v);
  });

  it.each(fixtures)('%s still loads with the current code', async (file) => {
    const saves = await freshStore();
    const result = await saves.importJson('main', readFileSync(new URL(file, fixturesDir), 'utf8'));
    expect(result.kind).toBe('ok');
  });

  it('upgrades a v2 save to race as Rudy, keeping its best, races and settings', async () => {
    const saves = await freshStore();
    const result = await saves.importJson('main', readFileSync(new URL('save-v2.json', fixturesDir), 'utf8'));
    expect(result).toEqual({
      kind: 'ok',
      migratedFrom: 2,
      data: {
        best: { ticks: 2712, place: 2 },
        races: 3,
        settings: { muted: false, reducedMotion: null },
        character: 'rudy',
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
