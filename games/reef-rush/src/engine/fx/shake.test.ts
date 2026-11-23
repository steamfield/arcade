import { describe, expect, it } from 'vitest';
import { createShake, SHAKE_MAX_PX } from './shake.ts';

/** Every offset (x and y) the shake gives over `ticks` ticks, stepping once per tick. */
function offsetsOver(shake: ReturnType<typeof createShake>, ticks: number): number[] {
  const offsets: number[] = [];
  for (let tick = 0; tick < ticks; tick++) {
    offsets.push(shake.offsetX(tick), shake.offsetY(tick));
    shake.step();
  }
  return offsets;
}

describe('screen shake', () => {
  it('stays still until something adds trauma', () => {
    expect(offsetsOver(createShake(), 30).every((offset) => offset === 0)).toBe(true);
  });

  it('jolts by whole pixels within the cap and settles within 20 ticks of a full knock', () => {
    const shake = createShake();
    shake.add(1);
    const jolt = offsetsOver(shake, 20);
    expect(jolt.some((offset) => offset !== 0)).toBe(true);
    expect(jolt.every((offset) => Number.isInteger(offset) && Math.abs(offset) <= SHAKE_MAX_PX)).toBe(true);
    expect(offsetsOver(shake, 10).every((offset) => offset === 0)).toBe(true);
  });

  it('shakes the same way at the same tick, so captures repeat', () => {
    const first = createShake();
    const second = createShake();
    first.add(0.8);
    second.add(0.8);
    expect(offsetsOver(first, 20)).toEqual(offsetsOver(second, 20));
  });

  it('keeps a light knock far subtler than a heavy one', () => {
    const light = createShake();
    const heavy = createShake();
    light.add(0.3);
    heavy.add(1);
    const largest = (offsets: number[]) => Math.max(...offsets.map(Math.abs));
    expect(largest(offsetsOver(light, 20))).toBeLessThanOrEqual(1);
    expect(largest(offsetsOver(heavy, 20))).toBeGreaterThanOrEqual(3);
  });
});
