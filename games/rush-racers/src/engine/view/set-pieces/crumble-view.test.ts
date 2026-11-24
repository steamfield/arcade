import { describe, expect, it } from 'vitest';
import { CRUMBLE } from '../../../logic/setpieces/crumbles.ts';
import { TILE } from '../../../logic/types.ts';
import { syncCrumbleTile } from '../level-view.ts';
import { crumbleLook } from './crumble-view.ts';

describe('a crumble tile', () => {
  it('disappears and returns with the fallen set alone, including when first synced after falling', () => {
    const tile = { x: 2, pixelX: 2 * TILE, visible: true };
    const fallen = new Set([12]);
    syncCrumbleTile(tile, 12, fallen, 0);
    expect(tile.visible).toBe(false);

    syncCrumbleTile(tile, 12, new Set([11]), -1);
    expect(tile.visible).toBe(true);
    expect(tile.pixelX).toBe(2 * TILE - 1);

    syncCrumbleTile(tile, 12, new Set(), 0);
    expect(tile.pixelX).toBe(2 * TILE);
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
