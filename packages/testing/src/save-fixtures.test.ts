import 'fake-indexeddb/auto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createSaveStore, type SaveStoreOptions } from '@arcade/save';
import { afterEach, describe, expect, it } from 'vitest';
import { checkSaveFixtures, type FixtureStore } from './save-fixtures.ts';

/** A small game's save: v1 held coins, v2 added a name, v3 (current) added a level. */
interface SaveV3 {
  coins: number;
  name: string;
  level: number;
}

const CURRENT_VERSION = 3;

type Migrations = NonNullable<SaveStoreOptions<SaveV3>['migrate']>;

const MIGRATIONS: Migrations = {
  1: (data) => ({ ...(data as object), name: 'Player' }),
  2: (data) => ({ ...(data as object), level: 1 }),
};

/** Validates the v3 shape, in the safeParse form `@arcade/save` takes. */
const SCHEMA: SaveStoreOptions<SaveV3>['schema'] = {
  safeParse(data) {
    const save = data as Partial<SaveV3> | null;
    const valid = typeof save?.coins === 'number' && typeof save.name === 'string' && typeof save.level === 'number';
    return valid
      ? { success: true, data: save as SaveV3 }
      : { success: false, error: { message: `not a v3 save: ${JSON.stringify(data)}` } };
  },
};

const folders: string[] = [];
let storeCount = 0;

afterEach(() => {
  for (const dir of folders.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** A fixtures folder holding `files` (name to contents), as a `file:` URL ending in a slash. */
function fixturesFolder(files: Record<string, string>): URL {
  const dir = mkdtempSync(join(tmpdir(), 'arcade-save-fixtures-'));
  folders.push(dir);
  for (const [name, contents] of Object.entries(files)) writeFileSync(join(dir, name), contents);
  return pathToFileURL(`${dir}/`);
}

/** A save file as `@arcade/save` exports it. */
const envelope = (version: number, data: object) =>
  JSON.stringify({ version, savedAt: '2026-01-01T00:00:00.000Z', data });

/** Fresh real stores for the game, each in its own database, with `migrate` as its migrations. */
function storeOpener(migrate: Migrations = MIGRATIONS): () => Promise<FixtureStore> {
  return () =>
    createSaveStore({ gameId: `fixtures-${storeCount++}`, version: CURRENT_VERSION, schema: SCHEMA, migrate });
}

const allVersions = {
  'save-v1.json': envelope(1, { coins: 4 }),
  'save-v2.json': envelope(2, { coins: 4, name: 'Pat' }),
  'save-v3.json': envelope(3, { coins: 4, name: 'Pat', level: 2 }),
};

describe('checkSaveFixtures', () => {
  it('reports nothing when every version has a fixture that loads', async () => {
    const dir = fixturesFolder({ ...allVersions, 'README.md': 'notes', 'save-v2.json.bak': 'not json' });
    const report = await checkSaveFixtures({ dir, currentVersion: CURRENT_VERSION, openStore: storeOpener() });
    expect(report).toEqual({ missingVersions: [], failures: [] });
  });

  it('names the versions with no committed fixture', async () => {
    const dir = fixturesFolder({ 'save-v3.json': allVersions['save-v3.json'] });
    const report = await checkSaveFixtures({ dir, currentVersion: CURRENT_VERSION, openStore: storeOpener() });
    expect(report).toEqual({ missingVersions: [1, 2], failures: [] });
  });

  it('names a fixture the current code can no longer migrate, with what it got', async () => {
    const dir = fixturesFolder(allVersions);
    const report = await checkSaveFixtures({
      dir,
      currentVersion: CURRENT_VERSION,
      openStore: storeOpener({ 2: (data) => ({ ...(data as object), level: 1 }) }),
    });
    expect(report).toEqual({
      missingVersions: [],
      failures: [
        {
          file: 'save-v1.json',
          problem: 'expected ok, migrated from v1, got {"kind":"unreadable","error":"No migration from v1 to v2"}',
        },
      ],
    });
  });

  it('names a fixture that migrates but fails the current schema', async () => {
    const dir = fixturesFolder({ ...allVersions, 'save-v2.json': envelope(2, { coins: 'four', name: 'Pat' }) });
    const report = await checkSaveFixtures({ dir, currentVersion: CURRENT_VERSION, openStore: storeOpener() });
    expect(report).toEqual({
      missingVersions: [],
      failures: [
        {
          file: 'save-v2.json',
          problem:
            'expected ok, migrated from v2, got {"kind":"unreadable","error":"Save failed validation: not a v3 save: {\\"coins\\":\\"four\\",\\"name\\":\\"Pat\\",\\"level\\":1}"}',
        },
      ],
    });
  });

  it('flags a fixture whose contents are a different version than its name says', async () => {
    const dir = fixturesFolder({ ...allVersions, 'save-v2.json': allVersions['save-v3.json'] });
    const report = await checkSaveFixtures({ dir, currentVersion: CURRENT_VERSION, openStore: storeOpener() });
    expect(report).toEqual({
      missingVersions: [],
      failures: [
        {
          file: 'save-v2.json',
          problem: 'expected ok, migrated from v2, got {"kind":"ok","data":{"coins":4,"name":"Pat","level":2}}',
        },
      ],
    });
  });

  it('flags a fixture newer than the code', async () => {
    const dir = fixturesFolder({ ...allVersions, 'save-v4.json': envelope(4, {}) });
    const report = await checkSaveFixtures({ dir, currentVersion: CURRENT_VERSION, openStore: storeOpener() });
    expect(report).toEqual({
      missingVersions: [],
      failures: [
        { file: 'save-v4.json', problem: 'expected ok, not migrated, got {"kind":"newer-than-code","version":4}' },
      ],
    });
  });
});
