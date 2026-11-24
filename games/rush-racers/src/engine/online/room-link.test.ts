import { describe, expect, it } from 'vitest';
import { roomLink, roomLinkParam } from './room-link.ts';

describe('room links', () => {
  it.each([
    ['', { kind: 'none' }],
    ['?seed=3', { kind: 'none' }],
    ['?room=ABC234', { kind: 'room', code: 'ABC234' }],
    ['?room=abc234', { kind: 'room', code: 'ABC234' }],
    ['?room=ABC23', { kind: 'invalid', value: 'ABC23' }],
    ['?room=ABC2340', { kind: 'invalid', value: 'ABC2340' }],
    // 0, 1, I, L and O are left out of the alphabet, so a code never has them.
    ['?room=ABC0IL', { kind: 'invalid', value: 'ABC0IL' }],
  ])('reads %j as %j', (search, expected) => {
    expect(roomLinkParam(search)).toEqual(expected);
  });

  it('links to the same page with only the room in its query, and the link reads back as that room', () => {
    const link = roomLink('https://example.com/games/rush-racers/?course=run-test&seed=4#top', 'ABC234');

    expect(link).toBe('https://example.com/games/rush-racers/?room=ABC234');
    expect(roomLinkParam(new URL(link).search)).toEqual({ kind: 'room', code: 'ABC234' });
  });
});
