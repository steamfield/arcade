import 'fake-indexeddb/auto';
import { createSaveStore } from '@arcade/save';
import { checkSaveFixtures } from '@arcade/testing';
import { describe, expect, it } from 'vitest';
import { migrations, SAVE_VERSION, SaveSchema } from '../src/logic/save.ts';

const fixturesDir = new URL('./fixtures/', import.meta.url);
let store = 0;
const freshStore = () =>
  createSaveStore({ gameId: `fixture-${store++}`, version: SAVE_VERSION, schema: SaveSchema, migrate: migrations });

describe('save compatibility', () => {
  it('has a fixture for every save version, and each loads migrated to the current one', async () => {
    const report = await checkSaveFixtures({ dir: fixturesDir, currentVersion: SAVE_VERSION, openStore: freshStore });
    expect(report).toEqual({ missingVersions: [], failures: [] });
  });
});
