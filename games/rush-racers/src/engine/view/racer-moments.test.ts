import { describe, expect, it } from 'vitest';
import { createRacerMoments, PLACE_FLASH_TICKS } from './racer-moments.ts';

// Events carry the runtime's step count, which runs through the title and menus, so it is far
// ahead of the race's world tick. The moments must time themselves from the world tick.
const STEP_TICK = 5000;

describe('createRacerMoments', () => {
  it('flashes the player white for a few ticks after gaining a place, then stops', () => {
    const moments = createRacerMoments('player', 3);
    moments.onEvents([{ type: 'player.place', place: 2, tick: STEP_TICK, seq: 0 }], 100);

    expect(moments.look(100, false).flashing).toBe(true);
    expect(moments.look(100 + PLACE_FLASH_TICKS - 1, false).flashing).toBe(true);
    expect(moments.look(100 + PLACE_FLASH_TICKS, false).flashing).toBe(false);
    expect(moments.look(2000, false).flashing).toBe(false);
  });

  it('does not flash on losing a place, for a rival, or under reduced motion', () => {
    const lost = createRacerMoments('player', 2);
    lost.onEvents([{ type: 'player.place', place: 3, tick: STEP_TICK, seq: 0 }], 100);
    expect(lost.look(100, false).flashing).toBe(false);

    const rival = createRacerMoments('tess', 3);
    rival.onEvents([{ type: 'player.place', place: 2, tick: STEP_TICK, seq: 0 }], 100);
    expect(rival.look(100, false).flashing).toBe(false);

    const calm = createRacerMoments('player', 3);
    calm.onEvents([{ type: 'player.place', place: 2, tick: STEP_TICK, seq: 0 }], 100);
    expect(calm.look(100, true).flashing).toBe(false);
  });

  it('squashes then stretches after a kick and settles back to rest', () => {
    const moments = createRacerMoments('player', 1);
    moments.onEvents([{ type: 'racer.kicked', id: 'player', tick: STEP_TICK, seq: 0 }], 100);

    expect(moments.look(100, false).stretch).toBeLessThan(0);
    expect(moments.look(105, false).stretch).toBeGreaterThan(0);
    expect(moments.look(120, false).stretch).toBe(0);
    expect(moments.look(105, true).stretch).toBe(0);
  });
});
