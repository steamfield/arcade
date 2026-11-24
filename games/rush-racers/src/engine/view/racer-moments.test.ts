import { describe, expect, it } from 'vitest';
import { createRacerMoments, PLACE_FLASH_TICKS } from './racer-moments.ts';

// Events carry the runtime's step count, which runs through the title and menus, so it is far
// ahead of the race's world tick. The moments must time themselves from the world tick.
const STEP_TICK = 5000;

describe('createRacerMoments', () => {
  it('flashes the player white for a few ticks after gaining a place, then stops', () => {
    const moments = createRacerMoments('player', 3);
    moments.onEvents([{ type: 'player.place', id: 'player', place: 2, tick: STEP_TICK, seq: 0 }], 100);

    expect(moments.look(100, false).flashing).toBe(true);
    expect(moments.look(100 + PLACE_FLASH_TICKS - 1, false).flashing).toBe(true);
    expect(moments.look(100 + PLACE_FLASH_TICKS, false).flashing).toBe(false);
    expect(moments.look(2000, false).flashing).toBe(false);
  });

  it('does not flash on losing a place, for a rival, or under reduced motion', () => {
    const lost = createRacerMoments('player', 2);
    lost.onEvents([{ type: 'player.place', id: 'player', place: 3, tick: STEP_TICK, seq: 0 }], 100);
    expect(lost.look(100, false).flashing).toBe(false);

    const rival = createRacerMoments('tess', 3);
    rival.onEvents([{ type: 'player.place', id: 'player', place: 2, tick: STEP_TICK, seq: 0 }], 100);
    expect(rival.look(100, false).flashing).toBe(false);

    const calm = createRacerMoments('player', 3);
    calm.onEvents([{ type: 'player.place', id: 'player', place: 2, tick: STEP_TICK, seq: 0 }], 100);
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

describe('a flap', () => {
  it("gives the racer a short wing-stroke squash that settles back to rest, and none under reduced motion or for another racer's flap", () => {
    const moments = createRacerMoments('tess', 2);
    moments.onEvents([{ type: 'racer.flapped', id: 'tess', tick: STEP_TICK, seq: 0 }], 100);
    const other = createRacerMoments('tess', 2);
    other.onEvents([{ type: 'racer.flapped', id: 'player', tick: STEP_TICK, seq: 0 }], 100);
    const shapeAt = (tick: number) => moments.look(tick, false).stretch;

    expect(shapeAt(100)).not.toBe(0);
    expect(shapeAt(130)).toBe(0);
    expect(moments.look(100, true).stretch).toBe(0);
    expect(other.look(100, false).stretch).toBe(0);
  });
});

describe('a bounce', () => {
  it('squashes the racer along the axis the wall stopped it on, settles back, and a later kick takes the look over', () => {
    const moments = createRacerMoments('player', 1);
    moments.onEvents([{ type: 'racer.rebounded', id: 'player', speed: 120, axis: 'x', tick: STEP_TICK, seq: 0 }], 100);
    const floor = createRacerMoments('player', 1);
    floor.onEvents([{ type: 'racer.rebounded', id: 'player', speed: 120, axis: 'y', tick: STEP_TICK, seq: 0 }], 100);

    expect(moments.look(100, false).stretch).toBeLessThan(0);
    expect(moments.look(100, false).axis).toBe('x');
    expect(floor.look(100, false).axis).toBe('y');
    expect(moments.look(130, false)).toEqual({ stretch: 0, axis: null, flashing: false });

    moments.onEvents([{ type: 'racer.kicked', id: 'player', tick: STEP_TICK, seq: 1 }], 102);
    expect(moments.look(102, false).axis).toBeNull();
    expect(moments.look(102, false).stretch).not.toBe(0);
  });

  it('wins over a kick fired on the same tick, since a dash into a wall bounces after it fires', () => {
    const moments = createRacerMoments('player', 1);
    moments.onEvents(
      [
        { type: 'racer.kicked', id: 'player', tick: STEP_TICK, seq: 0 },
        { type: 'racer.rebounded', id: 'player', speed: 120, axis: 'x', tick: STEP_TICK, seq: 1 },
      ],
      100,
    );

    expect(moments.look(100, false)).toMatchObject({ axis: 'x' });
    expect(moments.look(100, false).stretch).toBeLessThan(0);
  });

  it("does nothing under reduced motion or for another racer's bounce", () => {
    const moments = createRacerMoments('tess', 2);
    moments.onEvents([{ type: 'racer.rebounded', id: 'tess', speed: 120, axis: 'x', tick: STEP_TICK, seq: 0 }], 100);
    const other = createRacerMoments('tess', 2);
    other.onEvents([{ type: 'racer.rebounded', id: 'player', speed: 120, axis: 'x', tick: STEP_TICK, seq: 0 }], 100);

    expect(moments.look(100, true)).toEqual({ stretch: 0, axis: null, flashing: false });
    expect(other.look(100, false).stretch).toBe(0);
  });
});

describe('a jump and a landing', () => {
  it('stretches a jumping racer tall, squats it on landing, and settles back to rest', () => {
    const moments = createRacerMoments('player', 1);
    moments.onEvents([{ type: 'racer.jumped', id: 'player', tick: STEP_TICK, seq: 0 }], 100);

    expect(moments.look(100, false)).toMatchObject({ axis: 'y' });
    expect(moments.look(100, false).stretch).toBeGreaterThan(0);

    moments.onLanded(130);
    expect(moments.look(130, false)).toMatchObject({ axis: 'y' });
    expect(moments.look(130, false).stretch).toBeLessThan(0);
    expect(moments.look(160, false)).toEqual({ stretch: 0, axis: null, flashing: false });
  });

  it("does nothing under reduced motion or for another racer's jump", () => {
    const moments = createRacerMoments('tess', 2);
    moments.onEvents([{ type: 'racer.jumped', id: 'tess', tick: STEP_TICK, seq: 0 }], 100);
    moments.onLanded(120);
    const other = createRacerMoments('tess', 2);
    other.onEvents([{ type: 'racer.jumped', id: 'player', tick: STEP_TICK, seq: 0 }], 100);

    expect(moments.look(100, true)).toEqual({ stretch: 0, axis: null, flashing: false });
    expect(moments.look(120, true)).toEqual({ stretch: 0, axis: null, flashing: false });
    expect(other.look(100, false).stretch).toBe(0);
  });
});
