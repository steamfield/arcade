/**
 * Thornwood's Ink Sac is the Mud Pie: thrown on Run Test, it arcs onto the floor ahead of the
 * runner, leaves a mud patch the rivals behind run through, and the patch dries five seconds later.
 */
import { expect } from '@playwright/test';
import { hold, scenario, wait } from './kit.ts';

/** Run Test's floor top (row 9) in px, where the pie splats. */
const FLOOR_TOP_PX = 9 * 16;
/** Ticks a splat lasts before it dries (`MUD_PIE_TUNING.dryTicks`). */
const DRY_TICKS = 300;

/**
 * The `mud-pie` stage holds an Ink Sac at the player's start on Run Test (col 7), facing right.
 * After the countdown, throw once and stand still: the pie arcs about five tiles on and splats on
 * the floor before the cracked stone at col 15, the rivals starting behind run through the patch,
 * and it dries 300 ticks after it landed.
 */
export default scenario({
  description: 'the Mud Pie arcs onto the floor, leaves a mud patch and the patch dries',
  start: { scene: 'race', seed: 1, query: { course: 'run-test', stage: 'mud-pie' } },
  input: [wait(180), hold('fire', 1), wait(DRY_TICKS + 60)],
  expect({ events }) {
    expect(events.filter((e) => e.type === 'item.used' && e.id === 'player')).toMatchObject([{ kind: 'inkSac' }]);
    const pie = events.filter((e) => e.type.startsWith('twist.') && 'owner' in e && e.owner === 'player');
    expect(pie.map((e) => e.type)).toEqual(['twist.launched', 'twist.landed', 'twist.ended']);
    expect(pie[1]).toMatchObject({ style: 'mudPie', y: FLOOR_TOP_PX });
    expect((pie[2]?.tick ?? 0) - (pie[1]?.tick ?? 0)).toBe(DRY_TICKS);
  },
});
