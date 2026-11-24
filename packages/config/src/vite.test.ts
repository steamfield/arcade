import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { configDefaults } from 'vitest/config';
import { defineGameConfig } from './vite.ts';

const MANIFEST = {
  id: 'demo',
  slug: 'demo',
  title: 'Demo',
  pitch: 'A demo.',
  genre: 'puzzle',
  engine: 'phaser',
  inputs: ['keyboard'],
  orientation: 'landscape',
  status: 'draft',
};

let parent: string;

/** Makes the game folder `demo` and returns the URL its vite.config.ts would have. */
function makeGame(): string {
  const dir = join(parent, 'demo');
  mkdirSync(dir);
  writeFileSync(join(dir, 'game.json'), JSON.stringify(MANIFEST));
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ dependencies: { phaser: '4.2.1' } }));
  return pathToFileURL(join(dir, 'vite.config.ts')).href;
}

beforeEach(() => {
  parent = mkdtempSync(join(tmpdir(), 'define-game-config-'));
});
afterEach(() => {
  rmSync(parent, { recursive: true, force: true });
});

describe('defineGameConfig', () => {
  it('passes unknown override keys through and still merges the known ones', () => {
    const config = defineGameConfig(makeGame(), {
      define: { __BUILD_ID__: '"abc"' },
      server: { port: 1234 },
    });
    expect(config.define).toEqual({ __BUILD_ID__: '"abc"' });
    expect(config.server).toMatchObject({ host: '127.0.0.1', port: 1234 });
    expect(config.base).toBe('/games/demo/');
    expect(config.optimizeDeps?.include).toEqual(['phaser']);
  });

  it('runs one project over the default test files without slowTests', () => {
    const config = defineGameConfig(makeGame(), { test: { testTimeout: 9_000 } });
    expect(config.test).toMatchObject({
      include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
      testTimeout: 9_000,
    });
    expect(config.test?.projects).toBeUndefined();
  });

  it('splits the slow files into their own project and keeps them out of unit', () => {
    const config = defineGameConfig(
      makeGame(),
      { test: { testTimeout: 20_000 } },
      { slowTests: { project: 'slow', include: ['src/bars/*.test.ts'], testTimeout: 5_000 } },
    );
    const projects = (config.test?.projects ?? []) as { test: Record<string, unknown> }[];
    expect(config.test?.include).toEqual([]);
    expect(projects.map((p) => p.test)).toEqual([
      {
        name: 'unit',
        include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
        exclude: [...configDefaults.exclude, 'src/bars/*.test.ts'],
      },
      { name: 'slow', include: ['src/bars/*.test.ts'], testTimeout: 5_000 },
    ]);
  });

  it("keeps the game's own include and exclude in the unit project", () => {
    const config = defineGameConfig(
      makeGame(),
      { test: { include: ['lib/**/*.test.ts'], exclude: ['lib/skip/**'] } },
      { slowTests: { project: 'slow', include: ['lib/bars/*.test.ts'] } },
    );
    const [unit] = (config.test?.projects ?? []) as { test: Record<string, unknown> }[];
    expect(unit?.test).toMatchObject({
      include: ['lib/**/*.test.ts'],
      exclude: [...configDefaults.exclude, 'lib/skip/**', 'lib/bars/*.test.ts'],
    });
  });

  it('refuses a game.json whose slug differs from the folder', () => {
    const url = makeGame();
    writeFileSync(join(parent, 'demo', 'game.json'), JSON.stringify({ ...MANIFEST, slug: 'other' }));
    expect(() => defineGameConfig(url)).toThrow('must match its folder name "demo"');
  });
});
