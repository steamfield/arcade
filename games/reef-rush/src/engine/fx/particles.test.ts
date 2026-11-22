import { describe, expect, it } from 'vitest';
import { createParticleField, particleAlpha } from './particles.ts';

describe('particle field', () => {
  it('moves a rising bubble up, fades it over the end of its life and retires it', () => {
    const field = createParticleField(4);
    const bubble = field.spawn(10, 50, 20, 'fx', 'bubble');
    bubble.ay = -0.1;
    bubble.alpha = 0.8;

    const seen: { y: number; alpha: number }[] = [];
    for (let tick = 0; tick < 19; tick++) {
      field.step();
      seen.push({ y: bubble.y, alpha: particleAlpha(bubble) });
    }

    expect(bubble.live).toBe(true);
    expect(seen.every((now, index) => index === 0 || now.y < (seen[index - 1]?.y ?? 0))).toBe(true);
    expect(seen[0]?.alpha).toBeCloseTo(0.8);
    expect(seen.at(-1)?.alpha).toBeLessThan(0.2);
    field.step();
    expect(bubble.live).toBe(false);
  });

  it('reuses the oldest slot when a burst outruns the pool instead of growing', () => {
    const field = createParticleField(3);
    const first = field.spawn(0, 0, 60, 'fx', 'spark');
    field.spawn(1, 0, 60, 'fx', 'spark');
    field.spawn(2, 0, 60, 'fx', 'spark');

    const fourth = field.spawn(3, 0, 60, 'fx', 'sparkle');

    expect(field.particles).toHaveLength(3);
    expect(fourth).toBe(first);
    expect(field.particles.map(({ x, frame, live }) => ({ x, frame, live }))).toEqual([
      { x: 3, frame: 'sparkle', live: true },
      { x: 1, frame: 'spark', live: true },
      { x: 2, frame: 'spark', live: true },
    ]);
  });

  it('starts a reused slot fresh, with nothing left over from the particle before it', () => {
    const field = createParticleField(1);
    const old = field.spawn(0, 0, 10, 'fx', 'chip');
    Object.assign(old, { vx: 5, vy: -3, ay: 1, drag: 0.5, tint: 0x123456, wobble: 2, flipX: true });
    field.step();

    const fresh = field.spawn(7, 8, 30, 'fx', 'bubble');

    expect(fresh).toMatchObject({ x: 7, y: 8, vx: 0, vy: 0, ay: 0, drag: 1, age: 0, life: 30, tint: 0xffffff });
    expect(fresh).toMatchObject({ wobble: 0, flipX: false, live: true });
  });
});
