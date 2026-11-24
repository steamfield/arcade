import { describe, expect, it } from 'vitest';
import { planFromChanges, slowShards } from './affected.ts';
import type { GameInfo } from './games.ts';

const game = (slug: string, kind: GameInfo['kind'] = 'game'): GameInfo =>
  ({ slug, dir: `/repo/games/${slug}`, pkg: `game-${slug}`, kind }) as GameInfo;
const GAMES = [game('phaser-2d', 'template'), game('rush-racers'), game('three-3d', 'template')];
const slugs = (plan: { games: GameInfo[] }) => plan.games.map((g) => g.slug);

describe('which games a change needs tested', () => {
  it('tests only the game whose own files changed', () => {
    const plan = planFromChanges(['games/rush-racers/src/logic/world.ts'], ['game-rush-racers'], GAMES);
    expect(plan).toMatchObject({ all: false, packages: ['game-rush-racers'] });
    expect(slugs(plan)).toEqual(['rush-racers']);
  });

  it('tests every game that depends on a changed shared package', () => {
    const plan = planFromChanges(
      ['packages/core/src/rng.ts'],
      ['@arcade/core', 'game-phaser-2d', 'game-rush-racers', 'game-three-3d'],
      GAMES,
    );
    expect(plan.all).toBe(false);
    expect(slugs(plan)).toEqual(['phaser-2d', 'rush-racers', 'three-3d']);
  });

  it('tests no game when only docs changed', () => {
    const plan = planFromChanges(['docs/architecture.md', 'AGENTS.md'], [], GAMES);
    expect(plan).toMatchObject({ all: false, packages: [] });
    expect(slugs(plan)).toEqual([]);
  });

  it.each([
    '.github/workflows/ci.yml',
    'tools/arcade/src/smoke.ts',
    'apps/site/src/index.ts',
    'package.json',
    'pnpm-workspace.yaml',
    'turbo.json',
    '.nvmrc',
    'wrangler.jsonc',
  ])('tests everything when %s changed', (file) => {
    const plan = planFromChanges(['games/rush-racers/DESIGN.md', file], ['game-rush-racers'], GAMES);
    expect(plan).toMatchObject({ all: true, reason: `${file} changed` });
    expect(slugs(plan)).toEqual(['phaser-2d', 'rush-racers', 'three-3d']);
  });

  it("treats a game's own package.json as that game's change, not a global one", () => {
    const plan = planFromChanges(['games/rush-racers/package.json'], ['game-rush-racers'], GAMES);
    expect(plan.all).toBe(false);
    expect(slugs(plan)).toEqual(['rush-racers']);
  });
});

describe('slow suites as CI matrix entries', () => {
  it('gives one entry per shard for each game that declares a slow suite', () => {
    const suites: Record<string, { script: string; shards: number }> = {
      'rush-racers': { script: 'test:difficulty', shards: 2 },
    };
    expect(slowShards(GAMES, (g) => suites[g.slug])).toEqual([
      { game: 'rush-racers', pkg: 'game-rush-racers', script: 'test:difficulty', shard: 1, shards: 2 },
      { game: 'rush-racers', pkg: 'game-rush-racers', script: 'test:difficulty', shard: 2, shards: 2 },
    ]);
  });
});
