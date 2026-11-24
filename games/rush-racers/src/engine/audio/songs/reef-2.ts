/**
 * "Tidepool Hop", a race track of the `race` set: C major in 6/8 at 132 BPM. A placeholder until the track
 * is composed; `games/rush-racers/MUSIC.md` says what it should become.
 */
import { parseSong, type Song } from '../notation.ts';

const source = `
name: reef-2
title: Tidepool Hop
tempo: 132
time: 6/8
key: C major
loop: A

section: A
chords: C | G
pulse1: C5/4. C5/4. | G5/4. G5/4.
pulse2: C4/4. C4/4. | G4/4. G4/4.
triangle: C2/4. C2/4. | G2/4. G2/4.
noise: k/4. s/4. | k/4. s/4.
`;

/** "Tidepool Hop", parsed. */
export const reefTwo: Song = parseSong(source);
