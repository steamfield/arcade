/**
 * "Stormfront", a race track of the `cloudreach` set: D minor in 4/4 at 164 BPM. A placeholder until the track
 * is composed; `games/rush-racers/MUSIC.md` says what it should become.
 */
import { parseSong, type Song } from '../notation.ts';

const source = `
name: cloudreach-3
title: Stormfront
tempo: 164
time: 4/4
key: D minor
loop: A

section: A
chords: Dm | C
pulse1: D5/2 D5/2 | C5/2 C5/2
pulse2: D4/2 D4/2 | C4/2 C4/2
triangle: D2/2 D2/2 | C2/2 C2/2
noise: k/4 h/4 s/4 h/4 | k/4 h/4 s/4 h/4
`;

/** "Stormfront", parsed. */
export const cloudreachThree: Song = parseSong(source);
