/**
 * "Event Horizon", a race track of the `farside` set: F# minor in 4/4 at 126 BPM. A placeholder until the track
 * is composed; `games/rush-racers/MUSIC.md` says what it should become.
 */
import { parseSong, type Song } from '../notation.ts';

const source = `
name: farside-3
title: Event Horizon
tempo: 126
time: 4/4
key: F# minor
loop: A

section: A
chords: F#m | E
pulse1: F#5/2 F#5/2 | E5/2 E5/2
pulse2: F#4/2 F#4/2 | E4/2 E4/2
triangle: F#2/2 F#2/2 | E2/2 E2/2
noise: k/4 h/4 s/4 h/4 | k/4 h/4 s/4 h/4
`;

/** "Event Horizon", parsed. */
export const farsideThree: Song = parseSong(source);
