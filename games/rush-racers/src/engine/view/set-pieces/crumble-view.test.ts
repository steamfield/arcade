import { EventLog } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import type { GameEvent } from '../../../logic/events.ts';
import { CRUMBLE } from '../../../logic/setpieces/crumbles.ts';
import { courseFromLevel, placeOnTile, racerOf, step } from '../../../logic/test-world.ts';
import { TILE } from '../../../logic/types.ts';
import { createWorld } from '../../../logic/world.ts';
import { createCrumbleTileSync } from '../level-view.ts';
import { crumbleLook } from './crumble-view.ts';

describe('the branch tiles', () => {
  it('hide on the first sync if the branch already fell, then return when it regrows', () => {
    const branch = { col: 5, row: 3, length: 2 };
    const course = courseFromLevel(
      {
        name: 'branch next to a ledge',
        crumbles: [branch],
        ascii: `
          ############
          #..........#
          #.........F#
          #....===..F#
          #.........F#
          #1234.....F#
          ############
        `,
      },
      'run',
    );
    const log = new EventLog<GameEvent>();
    const world = createWorld(course, log, { seed: 1 });
    world.race.phase = 'racing';
    const player = racerOf(world, 'player');
    const tiles = [5, 6, 7].map((x) => ({ x, pixelX: x * TILE, visible: true }));
    const layer = { getTileAt: (x: number, y: number) => (y === branch.row ? (tiles[x - branch.col] ?? null) : null) };
    const syncFallen = createCrumbleTileSync(layer, world.level, false);
    const visibility = () => tiles.map(({ visible }) => visible);
    const positions = () => tiles.map(({ pixelX }) => pixelX);

    placeOnTile(player, branch.col, branch.row - 1);
    step(world, log, CRUMBLE.shakeTicks + 12);
    expect(world.crumbles[0]?.phase).toBe('fallen');
    syncFallen(world);
    expect(visibility()).toEqual([false, false, true]);

    step(world, log, CRUMBLE.fallenTicks);
    expect(world.crumbles[0]?.phase).toBe('solid');
    syncFallen(world);
    expect(visibility()).toEqual([true, true, true]);
    expect(positions()).toEqual([5 * TILE, 6 * TILE, 7 * TILE]);

    placeOnTile(player, branch.col, branch.row - 1);
    step(world, log, 12);
    expect(world.crumbles[0]?.phase).toBe('shaking');
    syncFallen(world);
    expect([
      [5 * TILE - 1, 6 * TILE - 1, 7 * TILE],
      [5 * TILE + 1, 6 * TILE + 1, 7 * TILE],
    ]).toContainEqual(positions());
  });
});

describe('the branch animation', () => {
  it('jitters and sheds bark during the shake based on the remaining phase ticks', () => {
    const state = { phase: 'shaking', ticks: CRUMBLE.shakeTicks } as const;
    const looks = Array.from({ length: CRUMBLE.shakeTicks }, (_, age) =>
      crumbleLook({ ...state, ticks: state.ticks - age }, false),
    );
    expect(new Set(looks.map(({ offset }) => offset)).size).toBeGreaterThan(1);
    expect(looks[0]?.barkAge).toBe(0);
    expect(looks[39]?.barkAge).toBe(39);
  });

  it('shows a static warning with reduced motion', () => {
    const state = { phase: 'shaking', ticks: CRUMBLE.shakeTicks } as const;
    const first = crumbleLook(state, true);
    expect(first).toMatchObject({ offset: 0, barkAge: 0, warning: true });
    expect(crumbleLook({ ...state, ticks: 1 }, true)).toEqual(first);
  });

  it('sheds its last bark as it falls, and grows a short-lived sprout only after regrowth', () => {
    expect(crumbleLook({ phase: 'fallen', ticks: CRUMBLE.fallenTicks - 2 }, false).barkAge).not.toBeNull();
    expect(crumbleLook({ phase: 'fallen', ticks: CRUMBLE.fallenTicks - 30 }, false).barkAge).toBeNull();
    const sprout = (ticks: number, reducedMotion = false) =>
      crumbleLook({ phase: 'solid', ticks }, reducedMotion).sproutHeight;
    expect(sprout(CRUMBLE.sproutTicks)).toBe(2);
    expect(sprout(CRUMBLE.sproutTicks - 4)).toBeGreaterThan(sprout(CRUMBLE.sproutTicks));
    expect(sprout(0)).toBe(0);
    expect(sprout(CRUMBLE.sproutTicks, true)).toBe(sprout(1, true));
  });
});
