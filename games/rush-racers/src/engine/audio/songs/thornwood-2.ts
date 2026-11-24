/**
 * "Bramble Stomp", a race track of the `thornwood` set: G mixolydian in 4/4 at 138 BPM. A placeholder until the track
 * is composed; `games/rush-racers/MUSIC.md` says what it should become.
 */
import { parseSong, type Song } from '../notation.ts';

const source = `
name: thornwood-2
title: Bramble Stomp
tempo: 138
time: 4/4
key: G mixolydian
loop: A

section: A
chords: G | F
pulse1: G5/2 G5/2 | F5/2 F5/2
pulse2: G4/2 G4/2 | F4/2 F4/2
triangle: G2/2 G2/2 | F2/2 F2/2
noise: k/4 h/4 s/4 h/4 | k/4 h/4 s/4 h/4
`;

/** "Bramble Stomp", parsed. */
export const thornwoodTwo: Song = parseSong(source);
