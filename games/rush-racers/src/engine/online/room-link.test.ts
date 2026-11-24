import { describe, expect, it } from 'vitest';
import { roomLink, roomLinkParam } from './room-link.ts';

describe('room links', () => {
  it.each([
    ['', { kind: 'none' }],
    ['?seed=3', { kind: 'none' }],
    ['?room=ABCD', { kind: 'room', code: 'ABCD' }],
    ['?room=abcd', { kind: 'room', code: 'ABCD' }],
    ['?room=ABC', { kind: 'invalid', value: 'ABC' }],
    ['?room=ABCDE', { kind: 'invalid', value: 'ABCDE' }],
    // Codes are letters only, without I, L and O, which read like 1 and 0.
    ['?room=AB2D', { kind: 'invalid', value: 'AB2D' }],
    ['?room=ABIL', { kind: 'invalid', value: 'ABIL' }],
  ])('reads %j as %j', (search, expected) => {
    expect(roomLinkParam(search)).toEqual(expected);
  });

  it('links to the same page with only the room in its query, and the link reads back as that room', () => {
    const link = roomLink('https://example.com/games/rush-racers/?course=run-test&seed=4#top', 'ABCD');

    expect(link).toBe('https://example.com/games/rush-racers/?room=ABCD');
    expect(roomLinkParam(new URL(link).search)).toEqual({ kind: 'room', code: 'ABCD' });
  });
});
