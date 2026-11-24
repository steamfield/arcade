/**
 * "Riptide", a race track of the `race` set: E minor in 4/4 at 160 BPM. A placeholder until the track
 * is composed; `games/rush-racers/MUSIC.md` says what it should become.
 */
import { parseSong, type Song } from '../notation.ts';

const source = `
name: reef-3
title: Riptide
tempo: 160
time: 4/4
key: E minor
loop: A

section: A
chords: Em | D
pulse1: E5/2 E5/2 | D5/2 D5/2
pulse2: E4/2 E4/2 | D4/2 D4/2
triangle: E2/2 E2/2 | D2/2 D2/2
noise: k/4 h/4 s/4 h/4 | k/4 h/4 s/4 h/4
`;

/** "Riptide", parsed. */
export const reefThree: Song = parseSong(source);
