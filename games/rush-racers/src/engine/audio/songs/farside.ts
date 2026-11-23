/**
 * Farside's race song, "Far Light": E lydian in 4/4 at 88 BPM, a slow float over the asteroid
 * belt. The raised fourth (A#) is the mode's colour: the lead leans on it over the II chord, which
 * never resolves the way a dominant would, so the song hangs in the air.
 *
 * Form: intro (2 bars, pulse, bass and drums) | A (8) | B (8) | turnaround (2), looping from the
 * turnaround back to A.
 *
 * Chords:
 * - intro: E | F#
 * - A: E | F# | G#m | F# | E | F# | C#m | B (I and the lydian II, a lift to iii, then down to V)
 * - B: C#m | G#m | F# | B | C#m | D#m | E | F# (the minor chords, lead lower and still longer)
 * - turnaround: E | F# (I to II, which floats back into A instead of pulling)
 *
 * The lead is held whole and dotted-half notes with vibrato, high in A and lower in B. Pulse 2 is
 * the steady pulse: a quiet eighth-note arpeggio on the chord tones under the lead. The triangle
 * holds root and fifth in half notes (whole notes in B), and the drums keep a soft kick on 1 and
 * snare on 3 (half-time in B) with a fill at the end of every section.
 */
import { parseSong, type Song } from '../notation.ts';

/** Farside's race song in the game's notation. */
export const farsideSource = `
name: farside
tempo: 88
time: 4/4
loop: A

voice pulse1: duty=0.5 level=0.42 attack=0.04 decay=0.2 sustain=0.75 release=0.3
voice pulse2: duty=0.125 level=0.18 attack=0.005 decay=0.08 sustain=0.35 release=0.05
voice triangle: level=0.6 attack=0.01 decay=0.1 sustain=0.9 release=0.1
voice noise: level=0.22 attack=0.001 decay=0.08 sustain=0 release=0.03

section: intro
pulse2: [E4/8@0.8 B4/8@0.5 G#4/8@0.5 B4/8@0.5]x2 | [F#4/8@0.8 C#5/8@0.5 A#4/8@0.5 C#5/8@0.5]x2
triangle: E2/2 B2/2 | F#2/2 C#3/2
noise: k/4 h/8@0.3 h/8@0.2 r/4 h/8@0.3 h/8@0.2 | k/4 h/8@0.3 h/8@0.2 s/16@0.3 s/16@0.4 s/16@0.5 s/16@0.6 s/4@0.7

section: A
// a held fifth, the lydian A# over F#, a climb to D#6
pulse1: B5/2.v G#5/4 | A#5/1v | B5/4 D#6/2.v | C#6/2 A#5/2v
// again from B5, up to E6, then a long fall to the dominant
pulse1: B5/2.v E6/4 | F#5/1v | G#5/4 C#6/4 E6/2v | D#6/2. F#5/4
pulse2: [E4/8@0.8 B4/8@0.5 G#4/8@0.5 B4/8@0.5]x2 | [F#4/8@0.8 C#5/8@0.5 A#4/8@0.5 C#5/8@0.5]x2 | [G#4/8@0.8 D#5/8@0.5 B4/8@0.5 D#5/8@0.5]x2 | [F#4/8@0.8 C#5/8@0.5 A#4/8@0.5 C#5/8@0.5]x2
pulse2: [E4/8@0.8 B4/8@0.5 G#4/8@0.5 B4/8@0.5]x2 | [F#4/8@0.8 C#5/8@0.5 A#4/8@0.5 C#5/8@0.5]x2 | [C#4/8@0.8 G#4/8@0.5 E4/8@0.5 G#4/8@0.5]x2 | [B3/8@0.8 F#4/8@0.5 D#4/8@0.5 F#4/8@0.5]x2
triangle: E2/2 B2/2 | F#2/2 C#3/2 | G#2/2 D#3/2 | F#2/2 C#3/2
triangle: E2/2 B2/2 | F#2/2 C#3/2 | C#2/2 G#2/2 | B1/2 F#2/2
noise: [k/4 h/8@0.3 h/8@0.2 s/4@0.4 h/8@0.3 h/8@0.2 |]x7 k/4 s/8@0.4 s/8@0.4 s/16@0.4 s/16@0.5 s/16@0.6 s/16@0.7 s/4@0.8

section: B
// lower and longer: whole notes under the minor chords
pulse1: E5/1v | D#5/2. B4/4 | C#5/1v | D#5/2 F#5/2v
pulse1: G#5/1v | F#5/2. D#5/4 | G#5/2. E5/4 | F#5/1v
// the pulse drops below the lead so the lead stays on top
pulse2: [C#4/8@0.8 G#3/8@0.5 E4/8@0.5 G#3/8@0.5]x2 | [G#3/8@0.8 D#4/8@0.5 B3/8@0.5 D#4/8@0.5]x2 | [F#3/8@0.8 C#4/8@0.5 A#3/8@0.5 C#4/8@0.5]x2 | [B3/8@0.8 F#3/8@0.5 D#4/8@0.5 F#3/8@0.5]x2
pulse2: [C#4/8@0.8 G#3/8@0.5 E4/8@0.5 G#3/8@0.5]x2 | [D#4/8@0.8 A#3/8@0.5 F#3/8@0.5 A#3/8@0.5]x2 | [E4/8@0.8 B3/8@0.5 G#3/8@0.5 B3/8@0.5]x2 | [F#3/8@0.8 C#4/8@0.5 A#3/8@0.5 C#4/8@0.5]x2
triangle: C#2/1 | G#1/1 | F#2/1 | B1/1
triangle: C#2/1 | D#2/1 | E2/1 | F#2/1
noise: [k/2 s/2@0.3 |]x7 k/4 s/8@0.4 s/8@0.4 s/16@0.4 s/16@0.5 s/16@0.6 s/16@0.7 s/4@0.8

section: turnaround
pulse1: B5/1v | A#5/2. C#6/4
pulse2: [E4/8@0.8 B4/8@0.5 G#4/8@0.5 B4/8@0.5]x2 | [F#4/8@0.8 C#5/8@0.5 A#4/8@0.5 C#5/8@0.5]x2
triangle: E2/2 B2/2 | F#2/2 C#3/2
noise: k/4 h/8@0.3 h/8@0.2 s/4@0.4 h/8@0.3 h/8@0.2 | k/4 s/16@0.4 s/16@0.5 s/16@0.6 s/16@0.7 s/8@0.6 s/8@0.7 s/4@0.8
`;

/** Farside's race song, parsed. */
export const farside: Song = parseSong(farsideSource);
