import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { checkSaveFixtures, type FixtureStore } from './save-fixtures.ts';

const CURRENT_VERSION = 3;
const folders: string[] = [];

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
const envelope = (version: number) => JSON.stringify({ version, savedAt: '2026-01-01T00:00:00.000Z', data: {} });

/**
 * A store that imports the way `@arcade/save` does for a game at CURRENT_VERSION with a migration
 * from every older version except those in `noMigrationFrom`.
 */
function storeOpener(noMigrationFrom: number[] = []): () => Promise<FixtureStore> {
  return async () => ({
    importJson: async (_slot, json) => {
      const { version } = JSON.parse(json) as { version: number };
      if (version > CURRENT_VERSION) return { kind: 'newer-than-code', version };
      if (noMigrationFrom.includes(version)) return { kind: 'unreadable', error: `No migration from v${version}` };
      return version < CURRENT_VERSION ? { kind: 'ok', data: {}, migratedFrom: version } : { kind: 'ok', data: {} };
    },
  });
}

const allVersions = {
  'save-v1.json': envelope(1),
  'save-v2.json': envelope(2),
  'save-v3.json': envelope(3),
};

describe('checkSaveFixtures', () => {
  it('reports nothing when every version has a fixture that loads', async () => {
    const dir = fixturesFolder({ ...allVersions, 'README.md': 'notes', 'save-v2.json.bak': envelope(2) });
    const report = await checkSaveFixtures({ dir, currentVersion: CURRENT_VERSION, openStore: storeOpener() });
    expect(report).toEqual({ missingVersions: [], failures: [] });
  });

  it('names the versions with no committed fixture', async () => {
    const dir = fixturesFolder({ 'save-v3.json': envelope(3) });
    const report = await checkSaveFixtures({ dir, currentVersion: CURRENT_VERSION, openStore: storeOpener() });
    expect(report).toEqual({ missingVersions: [1, 2], failures: [] });
  });

  it('names a fixture the current code can no longer load, with what it got', async () => {
    const dir = fixturesFolder(allVersions);
    const report = await checkSaveFixtures({ dir, currentVersion: CURRENT_VERSION, openStore: storeOpener([1]) });
    expect(report).toEqual({
      missingVersions: [],
      failures: [
        {
          file: 'save-v1.json',
          problem: 'expected ok, migrated from v1, got {"kind":"unreadable","error":"No migration from v1"}',
        },
      ],
    });
  });

  it('flags a fixture whose contents are a different version than its name says', async () => {
    const dir = fixturesFolder({ ...allVersions, 'save-v2.json': envelope(3) });
    const report = await checkSaveFixtures({ dir, currentVersion: CURRENT_VERSION, openStore: storeOpener() });
    expect(report).toEqual({
      missingVersions: [],
      failures: [{ file: 'save-v2.json', problem: 'expected ok, migrated from v2, got {"kind":"ok","data":{}}' }],
    });
  });

  it('flags a fixture newer than the code', async () => {
    const dir = fixturesFolder({ ...allVersions, 'save-v4.json': envelope(4) });
    const report = await checkSaveFixtures({ dir, currentVersion: CURRENT_VERSION, openStore: storeOpener() });
    expect(report).toEqual({
      missingVersions: [],
      failures: [
        { file: 'save-v4.json', problem: 'expected ok, not migrated, got {"kind":"newer-than-code","version":4}' },
      ],
    });
  });
});
