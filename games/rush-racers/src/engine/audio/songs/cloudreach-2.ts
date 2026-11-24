/**
 * "Thermal", a race track of the `cloudreach` set: Bb major in 4/4 at 152 BPM. A placeholder until the track
 * is composed; `games/rush-racers/MUSIC.md` says what it should become.
 */
import { parseSong, type Song } from '../notation.ts';

const source = `
name: cloudreach-2
title: Thermal
tempo: 152
time: 4/4
key: Bb major
loop: A

section: A
chords: Bb | F
pulse1: Bb5/2 Bb5/2 | F5/2 F5/2
pulse2: Bb4/2 Bb4/2 | F4/2 F4/2
triangle: Bb2/2 Bb2/2 | F2/2 F2/2
noise: k/4 h/4 s/4 h/4 | k/4 h/4 s/4 h/4
`;

/** "Thermal", parsed. */
export const cloudreachTwo: Song = parseSong(source);
