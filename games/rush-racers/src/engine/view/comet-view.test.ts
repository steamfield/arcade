import { EventLog } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import type { GameEvent } from '../../logic/events.ts';
import { courseFromLevel } from '../../logic/test-world.ts';
import type { Shot } from '../../logic/types.ts';
import { createWorld } from '../../logic/world.ts';
import { cometMarks } from './comet-view.ts';

const ROOM = [
  '#'.repeat(30),
  ...Array.from({ length: 10 }, (_, row) => `#${'1234'[row] ?? '.'}${'.'.repeat(26)}F#`),
  '#'.repeat(30),
].join('\n');

const shot = (fields: Partial<Shot>): Shot => ({
  style: 'comet',
  owner: 'player',
  x: 200,
  y: 100,
  vx: 230,
  vy: 0,
  ttl: 100,
  target: null,
  phase: 0,
  ...fields,
});

function worldWith(shots: Shot[]) {
  const world = createWorld(courseFromLevel(ROOM), new EventLog<GameEvent>(100), { seed: 1 });
  world.shots = shots;
  return world;
}

describe('what the race screen draws for comets', () => {
  it('is nothing with no comet in flight, and leaves other shot styles to their own views', () => {
    expect(cometMarks(worldWith([]))).toEqual([]);
    expect(cometMarks(worldWith([shot({ style: 'meteor' }), shot({ style: 'boulder' })]))).toEqual([]);
  });

  it('heads each comet at its centre with a tail trailing straight back along its velocity, fading and shrinking', () => {
    const [mark] = cometMarks(worldWith([shot({ x: 200, y: 100, vx: 230, vy: 0 })]));
    const tail = mark?.tail ?? [];

    expect(mark?.head).toMatchObject({ x: 200, y: 100 });
    expect(tail.length).toBeGreaterThan(2);
    expect(tail.every((puff) => puff.y === 100 && puff.x < 200)).toBe(true);
    for (let i = 1; i < tail.length; i++) {
      expect(tail[i]?.x).toBeLessThan(tail[i - 1]?.x ?? 0);
      expect(tail[i]?.alpha).toBeLessThan(tail[i - 1]?.alpha ?? 0);
      expect(tail[i]?.radius).toBeLessThan(tail[i - 1]?.radius ?? 0);
    }
  });

  it('swings the tail round with the velocity, so a comet a well has turned upward trails below itself', () => {
    const [mark] = cometMarks(worldWith([shot({ x: 200, y: 100, vx: 0, vy: -200 })]));

    expect(mark?.tail.every((puff) => puff.x === 200 && puff.y > 100)).toBe(true);
  });
});
