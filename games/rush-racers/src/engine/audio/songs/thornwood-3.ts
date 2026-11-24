/**
 * "Moth Lantern Reel", a race track of the `thornwood` set: A dorian in 4/4 at 172 BPM. A placeholder until the track
 * is composed; `games/rush-racers/MUSIC.md` says what it should become.
 */
import { parseSong, type Song } from '../notation.ts';

const source = `
name: thornwood-3
title: Moth Lantern Reel
tempo: 172
time: 4/4
key: A dorian
loop: A

section: A
chords: Am | G
pulse1: A5/2 A5/2 | G5/2 G5/2
pulse2: A4/2 A4/2 | G4/2 G4/2
triangle: A2/2 A2/2 | G2/2 G2/2
noise: k/4 h/4 s/4 h/4 | k/4 h/4 s/4 h/4
`;

/** "Moth Lantern Reel", parsed. */
export const thornwoodThree: Song = parseSong(source);
