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
      crumbleLook({ ...state, ticks: state.ticks - age }, 200 + age, false),
    );
    expect(new Set(looks.map(({ offset }) => offset)).size).toBeGreaterThan(1);
    expect(looks[0]?.barkAge).toBe(0);
    expect(looks[39]?.barkAge).toBe(39);
    expect(crumbleLook({ ...state, ticks: state.ticks - 15 }, 315, false)).toEqual(looks[15]);
  });

  it('shows a static warning with reduced motion', () => {
    const state = { phase: 'shaking', ticks: CRUMBLE.shakeTicks } as const;
    const first = crumbleLook(state, 200, true);
    expect(first).toMatchObject({ offset: 0, barkAge: 0, warning: true });
    expect(crumbleLook({ ...state, ticks: 1 }, 239, true)).toEqual(first);
  });

  it('sheds its last bark as it falls, and grows a short-lived sprout only after regrowth', () => {
    expect(crumbleLook({ phase: 'fallen', ticks: CRUMBLE.fallenTicks - 2 }, 202, false).barkAge).not.toBeNull();
    expect(crumbleLook({ phase: 'fallen', ticks: CRUMBLE.fallenTicks - 30 }, 230, false).barkAge).toBeNull();
    expect(crumbleLook({ phase: 'solid', ticks: 0 }, 2, false).sproutHeight).toBe(0);
    const regrown = { phase: 'solid', ticks: 500 } as const;
    expect(crumbleLook(regrown, 502, false).sproutHeight).toBeGreaterThan(0);
    expect(crumbleLook(regrown, 510, false).sproutHeight).toBeGreaterThan(
      crumbleLook(regrown, 502, false).sproutHeight,
    );
    expect(crumbleLook(regrown, 530, false).sproutHeight).toBe(0);
    expect(crumbleLook(regrown, 502, true).sproutHeight).toBe(crumbleLook(regrown, 510, true).sproutHeight);
  });
});
