import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { listGames } from './games.ts';

const VALID = {
  id: 'ok-game',
  slug: 'ok-game',
  title: 'Ok',
  pitch: 'A pitch.',
  genre: 'puzzle',
  engine: 'phaser',
  inputs: ['keyboard'],
  orientation: 'landscape',
  status: 'draft',
};

let root: string;

function addFolder(parent: string, name: string, files: Record<string, string>): void {
  const dir = join(root, parent, name);
  mkdirSync(dir, { recursive: true });
  for (const [file, text] of Object.entries(files)) writeFileSync(join(dir, file), text);
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'list-games-'));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe('listGames', () => {
  it('lists games and templates with their package names', () => {
    addFolder('games', 'ok-game', { 'game.json': JSON.stringify(VALID), 'package.json': '{"name":"game-ok"}' });
    addFolder('templates', 'tpl', {
      'game.json': JSON.stringify({ ...VALID, id: 'tpl', slug: 'tpl', status: 'template' }),
      'package.json': '{"name":"template-tpl"}',
    });
    expect(listGames(root).map((g) => [g.slug, g.kind, g.pkg])).toEqual([
      ['ok-game', 'game', 'game-ok'],
      ['tpl', 'template', 'template-tpl'],
    ]);
  });

  it('skips with a warning a folder that has a broken game.json and no package.json', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    addFolder('games', 'ok-game', { 'game.json': JSON.stringify(VALID), 'package.json': '{"name":"game-ok"}' });
    addFolder('games', 'leftover', { 'game.json': '{ broken' });
    expect(listGames(root).map((g) => g.slug)).toEqual(['ok-game']);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('games/leftover'));
  });
});
