/**
 * "Slingshot", a race track of the `farside` set: B dorian in 4/4 at 118 BPM. A placeholder until the track
 * is composed; `games/rush-racers/MUSIC.md` says what it should become.
 */
import { parseSong, type Song } from '../notation.ts';

const source = `
name: farside-2
title: Slingshot
tempo: 118
time: 4/4
key: B dorian
loop: A

section: A
chords: Bm | A
pulse1: B5/2 B5/2 | A5/2 A5/2
pulse2: B4/2 B4/2 | A4/2 A4/2
triangle: B2/2 B2/2 | A2/2 A2/2
noise: k/4 h/4 s/4 h/4 | k/4 h/4 s/4 h/4
`;

/** "Slingshot", parsed. */
export const farsideTwo: Song = parseSong(source);
