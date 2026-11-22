import 'fake-indexeddb/auto';
import { readdirSync, readFileSync } from 'node:fs';
import { createSaveStore } from '@arcade/save';
import { describe, expect, it } from 'vitest';
import { migrations, SAVE_VERSION, SaveSchema } from '../src/logic/save.ts';

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
});
