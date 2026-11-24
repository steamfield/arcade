/**
 * Farside's first race track, "Far Light": E lydian in 4/4 at 88 BPM, a slow float over the
 * asteroid belt. The raised fourth (A#) is the mode's colour: the lead leans on it over the II
 * chord, which never resolves the way a dominant would, so the song hangs in the air.
 *
 * Form: intro (2 bars, outside the loop) | A (8) | B (8) | lift (6) | breakdown (4) |
 * turnaround (2). The loop is the last five sections, 28 bars, about 76 seconds, from A.
 *
 * Chords:
 * - intro: E | F#
 * - A: E | F# | G#m | F# | E | F# | C#m | B (I and the lydian II, a lift to iii, then down to V)
 * - B: C#m | G#m | F# | B | C#m | D#m | E | F# (the minor chords, the lead lower, breathing at
 *   the end of each two-bar phrase)
 * - lift: G | A | Bm | A | C | D (the tune moved up a minor third, then bVI and bVII of E carry
 *   it home)
 * - breakdown: E | F# | E | F#
 * - turnaround: E | F# (I to II, which floats back into A instead of pulling)
 *
 * The hook is A's first two bars: B5 (dotted half) G#5 | A#5 (whole). Its cell, a held note that
 * falls a minor third, returns as E5 C#5 and F#5 D#5 in B and as D6 B5 at the top of the lift.
 *
 * Voices: the lead holds whole and dotted-half notes with vibrato, round 50% in A and the lift,
 * a brighter 25% in B where it sits lower. Pulse 2 is the steady pulse, a quiet eighth-note
 * arpeggio on the chord tones under the lead; in the lift it turns into a long echo of the lead,
 * and in the breakdown, where the lead rests, it plays short arpeggio bursts that climb an inversion and then the hook
 * cell an octave down, far away. The triangle holds root and fifth in half notes (whole notes in
 * B) and kicks with pitch drops under the breakdown. The drums keep a soft kick on 1 and snare on
 * 3, a crash at the top of A, B and the lift, open hats in the lift and the breakdown, and a fill
 * at the end of every section.
 */
import { parseSong, type Song } from '../notation.ts';

const farsideSource = `
name: farside
title: Far Light
tempo: 88
time: 4/4
key: E lydian
loop: A

voice pulse1: duty=0.5 level=0.42 attack=0.04 decay=0.2 sustain=0.75 release=0.3
voice pulse2: duty=0.125 level=0.18 attack=0.005 decay=0.08 sustain=0.35 release=0.05
voice triangle: level=0.6 attack=0.01 decay=0.1 sustain=0.9 release=0.1
voice noise: level=0.22 attack=0.001 decay=0.08 sustain=0 release=0.03

section: intro
chords: E | F#
pulse2: [E4/8@0.8 B4/8@0.5 G#4/8@0.5 B4/8@0.5]x2 | [F#4/8@0.8 C#5/8@0.5 A#4/8@0.5 C#5/8@0.5]x2
triangle: E2/2 B2/2 | F#2/2 C#3/2
noise: k/4 h/8@0.3 h/8@0.2 r/4 h/8@0.3 h/8@0.2 | k/4 h/8@0.3 h/8@0.2 s/16@0.3 s/16@0.4 s/16@0.5 s/16@0.6 s/4@0.7

section: A
chords: E | F# | G#m | F# | E | F# | C#m | B
// a held fifth, the lydian A# over F#, a climb to D#6
pulse1: B5/2.v G#5/4 | A#5/1v | B5/4 D#6/2.v | C#6/2 A#5/2v
// again from B5, up to E6, then a long fall to the dominant
pulse1: B5/2.v E6/4 | F#5/1v | G#5/4 C#6/4 E6/2v | D#6/2. F#5/4
pulse2: [E4/8@0.8 B4/8@0.5 G#4/8@0.5 B4/8@0.5]x2 | [F#4/8@0.8 C#5/8@0.5 A#4/8@0.5 C#5/8@0.5]x2 | [G#4/8@0.8 D#5/8@0.5 B4/8@0.5 D#5/8@0.5]x2 | [F#4/8@0.8 C#5/8@0.5 A#4/8@0.5 C#5/8@0.5]x2
pulse2: [E4/8@0.8 B4/8@0.5 G#4/8@0.5 B4/8@0.5]x2 | [F#4/8@0.8 C#5/8@0.5 A#4/8@0.5 C#5/8@0.5]x2 | [C#4/8@0.8 G#4/8@0.5 E4/8@0.5 G#4/8@0.5]x2 | [B3/8@0.8 F#4/8@0.5 D#4/8@0.5 F#4/8@0.5]x2
triangle: E2/2 B2/2 | F#2/2 C#3/2 | G#2/2 D#3/2 | F#2/2 C#3/2
triangle: E2/2 B2/2 | F#2/2 C#3/2 | C#2/2 G#2/2 | B1/2 F#2/2
noise: c/4@0.5 h/8@0.3 h/8@0.2 s/4@0.4 h/8@0.3 h/8@0.2 | [k/4 h/8@0.3 h/8@0.2 s/4@0.4 h/8@0.3 h/8@0.2 |]x6 k/4 s/8@0.4 s/8@0.4 s/16@0.4 s/16@0.5 s/16@0.6 s/16@0.7 s/4@0.8

section: B
chords: C#m | G#m | F# | B | C#m | D#m | E | F#
// lower, on a brighter duty: the hook's falling third under the minor chords, with a breath
// at the end of each two-bar phrase
duty pulse1: 0.25
pulse1: E5/2.v C#5/4 | D#5/2 B4/4 r/4 | C#5/1v | D#5/2 F#5/4 r/4
pulse1: G#5/2.v E5/4 | F#5/2. D#5/4 | G#5/2 B5/4 G#5/4 | F#5/2.v r/4
// the pulse drops below the lead so the lead stays on top
pulse2: [C#4/8@0.8 G#3/8@0.5 E4/8@0.5 G#3/8@0.5]x2 | [G#3/8@0.8 D#4/8@0.5 B3/8@0.5 D#4/8@0.5]x2 | [F#3/8@0.8 C#4/8@0.5 A#3/8@0.5 C#4/8@0.5]x2 | [B3/8@0.8 F#3/8@0.5 D#4/8@0.5 F#3/8@0.5]x2
pulse2: [C#4/8@0.8 G#3/8@0.5 E4/8@0.5 G#3/8@0.5]x2 | [D#4/8@0.8 A#3/8@0.5 F#3/8@0.5 A#3/8@0.5]x2 | [E4/8@0.8 B3/8@0.5 G#3/8@0.5 B3/8@0.5]x2 | [F#3/8@0.8 C#4/8@0.5 A#3/8@0.5 C#4/8@0.5]x2
triangle: C#2/1 | G#1/1 | F#2/1 | B1/1
triangle: C#2/1 | D#2/1 | E2/1 | F#2/1
noise: c/2@0.4 s/2@0.3 | [k/2 s/2@0.3 |]x6 k/4 s/8@0.4 s/8@0.4 s/16@0.4 s/16@0.5 s/16@0.6 s/16@0.7 s/4@0.8

section: lift
chords: G | A | Bm | A | C | D
// the hook's shape a minor third up, then bVI and bVII fall back towards E
duty pulse1: voice
pulse1: D6/2.v B5/4 | C#6/2.v r/4 | B5/4 D6/2.v | E6/2 C#6/2v
pulse1: E6/2.v C6/4 | D6/2 A5/4 F#5/4
// a long echo tail on the thin pulse instead of the arpeggio
echo pulse2: pulse1 delay=0.75 level=0.45
triangle: G1/2 D2/2 | A1/2 E2/2 | B1/2 F#2/2 | A1/2 E2/2 | C2/2 G2/2 | D2/4 F#2/4 A2/4 B1/4
noise: c/4@0.5 h/8@0.2 o/8@0.25 s/4@0.4 h/8@0.2 h/8@0.15 | [k/4 h/8@0.2 o/8@0.25 s/4@0.4 h/8@0.2 h/8@0.15 |]x4 k/4 s/8@0.4 s/8@0.4 s/16@0.4 s/16@0.5 s/16@0.6 s/16@0.7 s/4@0.8

section: breakdown
chords: E | F# | E | F#
// the lead rests: arpeggio bursts, then the hook cell an octave down, far away
pulse2: E4:047/8@0.9 r/8 r/4 B4:059/8@0.7 r/8 r/4 | F#4:047/8@0.9 r/8 r/4 C#5:059/8@0.7 r/8 r/4
pulse2: B4/2.v G#4/4 | A#4/1v
// triangle kicks with pitch drops under a sparse kit
triangle: E2/8! E2/8~ E2/2. | F#2/8! F#2/8~ F#2/2. | E2/8! E2/8~ E2/4 E2/8! E2/8~ E2/4 | F#2/8! F#2/8~ F#2/4 F#2/8! F#2/8 C#3/4
noise: o/4@0.3 r/2 h/8@0.15 h/8@0.1 | r/4 h/8@0.15 r/8 r/4 h/8@0.15 h/8@0.1 | o/4@0.3 r/2 h/8@0.15 h/8@0.1 | r/4 h/8@0.15 r/8 s/16@0.3 s/16@0.4 s/16@0.5 s/16@0.6 s/4@0.7

section: turnaround
chords: E | F#
pulse1: B5/1v | A#5/2. C#6/4
pulse2: [E4/8@0.8 B4/8@0.5 G#4/8@0.5 B4/8@0.5]x2 | [F#4/8@0.8 C#5/8@0.5 A#4/8@0.5 C#5/8@0.5]x2
triangle: E2/2 B2/2 | F#2/2 C#3/2
noise: k/4 h/8@0.3 h/8@0.2 s/4@0.4 h/8@0.3 h/8@0.2 | k/4 s/16@0.4 s/16@0.5 s/16@0.6 s/16@0.7 s/8@0.6 s/8@0.7 s/4@0.8
`;

/** "Far Light", Farside's first race track, parsed. */
export const farside: Song = parseSong(farsideSource);
