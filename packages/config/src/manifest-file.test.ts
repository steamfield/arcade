import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readManifest, readManifestsIn } from './manifest-file.ts';

const VALID = {
  id: 'game-a',
  slug: 'game-a',
  title: 'Game A',
  pitch: 'A pitch.',
  genre: 'puzzle',
  engine: 'phaser',
  inputs: ['keyboard'],
  orientation: 'landscape',
  status: 'draft',
};

let parent: string;

/** Makes `parent/<folder>`, with a game.json holding `manifest` unless it is left out. */
function addGame(folder: string, manifest?: unknown): string {
  const dir = join(parent, folder);
  mkdirSync(dir);
  if (manifest !== undefined) writeFileSync(join(dir, 'game.json'), JSON.stringify(manifest));
  return dir;
}

beforeEach(() => {
  parent = mkdtempSync(join(tmpdir(), 'manifest-file-'));
});
afterEach(() => {
  rmSync(parent, { recursive: true, force: true });
});

describe('readManifest', () => {
  it('parses the game.json in a folder', () => {
    expect(readManifest(addGame('game-a', VALID)).title).toBe('Game A');
  });

  it('names the file when the manifest fails the schema', () => {
    const dir = addGame('game-a', { ...VALID, status: 'finished' });
    expect(() => readManifest(dir)).toThrow(join(dir, 'game.json'));
  });

  it('names the file and keeps the parse error as the cause when the JSON is broken', () => {
    const dir = addGame('game-a');
    writeFileSync(join(dir, 'game.json'), '{ "id": ');
    expect(() => readManifest(dir)).toThrow(`${join(dir, 'game.json')} is not valid JSON`);
    try {
      readManifest(dir);
    } catch (error) {
      expect((error as Error).cause).toBeInstanceOf(SyntaxError);
    }
  });

  it('fails when the folder has no game.json', () => {
    expect(() => readManifest(addGame('game-a'))).toThrow('game.json');
  });
});

describe('readManifestsIn', () => {
  it('lists folders with a game.json in name order and skips the others', () => {
    addGame('b-game', { ...VALID, id: 'b-game', slug: 'b-game' });
    addGame('not-a-game');
    addGame('a-game', { ...VALID, id: 'a-game', slug: 'a-game' });
    expect(readManifestsIn(parent).map((entry) => entry.manifest.slug)).toEqual(['a-game', 'b-game']);
  });

  it('gives an empty list when the parent folder does not exist', () => {
    expect(readManifestsIn(join(parent, 'missing'))).toEqual([]);
  });

  it('fails with the manifest path when one game.json is invalid', () => {
    const dir = addGame('bad', { ...VALID, slug: 'Bad Slug' });
    expect(() => readManifestsIn(parent)).toThrow(join(dir, 'game.json'));
  });
});
