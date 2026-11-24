import { describe, expect, it } from 'vitest';
import { createTrackRotation, type TrackTable } from './track-rotation.ts';

/** Three tracks in one set and two in another, so wraps and separate counts show. */
const TRACKS: TrackTable = {
  race: ['race', 'title', 'results'],
  thornwood: ['thornwood', 'win'],
  cloudreach: ['cloudreach'],
  farside: ['farside'],
};

/** The tracks `count` races on `set` play, in order. */
function picks(rotation: ReturnType<typeof createTrackRotation>, set: keyof TrackTable, count: number): string[] {
  return Array.from({ length: count }, () => rotation.next(set));
}

describe('the race track rotation', () => {
  it('plays a three-track set in order and wraps back to the first', () => {
    const rotation = createTrackRotation({ startAt: 0, pinned: null, tracks: TRACKS });
    expect(picks(rotation, 'race', 4)).toEqual(['race', 'title', 'results', 'race']);
  });

  it('counts each set on its own', () => {
    const rotation = createTrackRotation({ startAt: 0, pinned: null, tracks: TRACKS });
    const order = ['race', 'thornwood', 'race', 'thornwood', 'thornwood'] as const;
    expect(order.map((set) => rotation.next(set))).toEqual(['race', 'thornwood', 'title', 'win', 'thornwood']);
  });

  it('opens each set on the track the start offset names', () => {
    const rotation = createTrackRotation({ startAt: 4, pinned: null, tracks: TRACKS });
    expect(picks(rotation, 'race', 3)).toEqual(['title', 'results', 'race']);
    expect(picks(rotation, 'thornwood', 2)).toEqual(['thornwood', 'win']);
  });

  it('always plays a pinned track, wrapping a pin past the end of the set', () => {
    const rotation = createTrackRotation({ startAt: 1, pinned: 4, tracks: TRACKS });
    expect(picks(rotation, 'race', 3)).toEqual(['title', 'title', 'title']);
    expect(picks(rotation, 'thornwood', 2)).toEqual(['thornwood', 'thornwood']);
  });

  it('counts a negative pin back from the end of the set', () => {
    const rotation = createTrackRotation({ startAt: 0, pinned: -1, tracks: TRACKS });
    expect(picks(rotation, 'race', 2)).toEqual(['results', 'results']);
  });

  it('rounds a fractional start offset down', () => {
    const rotation = createTrackRotation({ startAt: 1.7, pinned: null, tracks: TRACKS });
    expect(picks(rotation, 'race', 3)).toEqual(['title', 'results', 'race']);
  });

  it('counts a negative start offset back from the end of the set', () => {
    const rotation = createTrackRotation({ startAt: -4, pinned: null, tracks: TRACKS });
    expect(picks(rotation, 'race', 3)).toEqual(['results', 'race', 'title']);
  });

  it('rejects a set with no tracks, naming it', () => {
    const rotation = createTrackRotation({ startAt: 0, pinned: null, tracks: { ...TRACKS, farside: [] } });
    expect(() => rotation.next('farside')).toThrow('Race track set "farside" has no tracks; give it at least one.');
  });

  it('rotates the game’s own race tracks when no table is given', () => {
    const rotation = createTrackRotation({ startAt: 0, pinned: null });
    expect(picks(rotation, 'cloudreach', 2)).toEqual(['cloudreach', 'cloudreach']);
  });
});
