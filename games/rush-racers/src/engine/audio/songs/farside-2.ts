/**
 * Farside's second race track, "Slingshot": B dorian in 4/4 at 118 BPM, a whip round a planet.
 * A steady octave-pulsing bass, a thin 12.5% lead with long echo tails, and slides where the
 * line swings out.
 *
 * Form: intro (2 bars, outside the loop) | A (8) | A' (8) | B (8) | C (8) | breakdown (4) |
 * turnaround (2). The loop is 38 bars, about 77 seconds, from A.
 *
 * Chords:
 * - intro: Bm6 | F#
 * - A: Bm6 | A | G | F# | Bm6 | A | E | F# (the minor sixth and the major IV are the dorian
 *   colour; G is borrowed bVI)
 * - A': Bm6 | A | G | F# | Bm6 | A | G | A (the cell climbs to the song's one E6, then falls and
 *   settles on bVII)
 * - B: D | E | D | E | G | A | Em | F#
 * - C: D | A | E | E | D | A | G | F# (the pulses trade phrases on a new 3+3+2 rhythm, the
 *   lead whipping down and up on slides)
 * - breakdown: Bm6 | Bm6 | G | G
 * - turnaround: A | F# (bVII to V, the bass walking down F# E C# into B)
 *
 * The hook is A's first two bars: B4 F#5, B5 held across the beat, G#5 F#5 | C#6 A5 held. Its
 * first bar is a syncopated cell (eighth, eighth, rest, a note tied over beat two, then two
 * eighths) that comes back a minor third higher as D5 A5 D6 B5 A5 over G.
 *
 * Voices: the lead is a thin 12.5% pulse in A and A', a round 50% in B where its notes grow long,
 * and 25% in C. Pulse 2 echoes the lead three sixteenths later in A, plays a counter-line and
 * arpeggio bursts under it in A', in B alternates the world's motif with a stepwise line that
 * falls while the lead holds and climbs back, and in C answers the lead's calls. The triangle
 * bounces in octave eighths with a pitch-dropped kick on each bar (two in A'), turning down
 * E2 C#2 A#1 at A's half and climbing A#1 C#2 E2 at its end; it walks in quarters in B, kicks on
 * the 3+3+2 of the lead's cell in C (root, root, octave, root, root, octave, then the fifth), and
 * leaves gaps in the breakdown, where the lead rests. The drums drive a straight backbeat with a
 * doubled kick and closed hats in A, turn on a snare and open-hat pickup at its half, switch to
 * open hats on every off-beat in A' with a tom turn at its half, go half time in B with a tom
 * pickup in its fourth bar, and use toms in C, with a fill at the end of every section. Event
 * Horizon runs only 8 BPM faster, so the feel is kept apart there: half time and a galloping bass
 * against Slingshot's straight bounce.
 *
 * The world's motif: Far Light's opening cell, a held note that falls a minor third and steps up
 * a tone (dotted half, quarter, whole), is pulse 2's counter-line in B, as A4 F#4 G#4 over D and E
 * and again as D5 B4 C#5 over G and A.
 */
import { parseSong, type Song } from '../notation.ts';

const source = `
name: farside-2
title: Slingshot
tempo: 118
time: 4/4
key: B dorian
loop: A

voice pulse1: duty=0.125 level=0.5 attack=0.005 decay=0.15 sustain=0.7 release=0.15
voice pulse2: duty=0.25 level=0.32 attack=0.005 decay=0.1 sustain=0.5 release=0.1
voice triangle: level=0.65 attack=0.005 decay=0.05 sustain=0.9 release=0.03
voice noise: level=0.3 attack=0.001 decay=0.06 sustain=0 release=0.02

section: intro
chords: Bm6 | F#
pulse2: B3:0379/8@0.8 r/8 r/4 B3:0379/8@0.5 r/8 r/4 | F#3:047/8@0.8 r/8 r/4 F#3:047/8@0.5 r/8 r/4
triangle: [B1/8 B2/8]x4 | [F#1/8 F#2/8]x4
noise: k/8 h/8@0.3 h/8@0.3 h/8@0.3 k/8 h/8@0.3 h/8@0.3 h/8@0.3 | k/8 h/8@0.3 s/8@0.5 s/8@0.5 s/16@0.4 s/16@0.5 s/16@0.6 s/16@0.7 s/4@0.8

section: A
chords: Bm6 | A | G | F# | Bm6 | A | E | F#
// call: the cell, then a held answer; again a fourth lower over bVI, landing on V
pulse1: B4/8 F#5/8 r/8 B5/8~ B5/4 G#5/8 F#5/8 | C#6/4. A5/8~ A5/4 r/4 | D5/8 A5/8 r/8 D6/8~ D6/4 B5/8 A5/8 | C#6/4. A#5/8~ A#5/4 r/4
// the call again, then over the dorian IV
pulse1: B4/8 F#5/8 r/8 B5/8~ B5/4 G#5/8 F#5/8 | C#6/4. A5/8~ A5/4 r/4 | B4/8 E5/8 r/8 G#5/8~ G#5/4 B5/8 G#5/8 | A#5/4. F#5/8~ F#5/4 r/4
// a long echo tail on the second pulse
echo pulse2: pulse1 delay=0.75 level=0.45
// the octave bounce turns down E2 C#2 A#1 C#2 into B at the half, and climbs A#1 C#2 E2 at the end
triangle: B1/8! B2/8 [B1/8 B2/8]x3 | A1/8! A2/8 [A1/8 A2/8]x3 | G1/8! G2/8 [G1/8 G2/8]x3 | F#1/8! F#2/8 F#1/8 F#2/8 E2/8 C#2/8 A#1/8 C#2/8
triangle: B1/8! B2/8 [B1/8 B2/8]x3 | A1/8! A2/8 [A1/8 A2/8]x3 | E2/8! E3/8 [E2/8 E3/8]x3 | F#1/8! F#2/8 F#1/8 F#2/8 F#1/8 A#1/8 C#2/8 E2/8
noise: [k/8 h/8@0.3 s/8@0.6 h/8@0.3 k/8 k/8 s/8@0.6 h/8@0.3 |]x3 k/8 h/8@0.3 s/8@0.6 h/8@0.3 k/8 k/8 s/16@0.5 s/16@0.6 o/8@0.4 | [k/8 h/8@0.3 s/8@0.6 h/8@0.3 k/8 k/8 s/8@0.6 h/8@0.3 |]x3 k/8 h/8@0.3 s/8@0.6 h/8@0.3 s/16@0.4 s/16@0.5 s/16@0.6 s/16@0.7 s/8@0.8 o/8@0.4

section: A'
chords: Bm6 | A | G | F# | Bm6 | A | G | A
pulse1: B4/8 F#5/8 r/8 B5/8~ B5/4 G#5/8 F#5/8 | C#6/4. A5/8~ A5/4 r/4 | D5/8 A5/8 r/8 D6/8~ D6/4 B5/8 A5/8 | C#6/4. A#5/8~ A#5/4 r/4
// the cell climbs a fourth to the song's one E6, then falls from it and settles on bVII
pulse1: F#5/8 B5/8 r/8 D6/8~ D6/4 B5/8 G#5/8 | E6/4. C#6/8~ C#6/4 r/4 | D6/4. B5/8~ B5/4 G5/4 | A5/2. r/4
// a counter-line under the lead, moving while it holds, then arpeggio bursts
pulse2: D4/2 F#4/4 G#4/4 | A4/2. E4/4 | B4/2 G4/4 D4/4 | A#4/2. C#4/4
pulse2: B3:0379/8@0.8 r/8 r/4 B3:0379/8@0.5 r/8 r/4 | A3:047/8@0.8 r/8 r/4 A3:047/8@0.5 r/8 r/4 | G4/2 B4/4 D5/4 | C#5/2 A4/4 E4/4
triangle: B1/8! B2/8 B1/8 B2/8 B1/8! B2/8 B1/8 B2/8 | A1/8! A2/8 A1/8 A2/8 A1/8! A2/8 A1/8 A2/8 | G1/8! G2/8 G1/8 G2/8 G1/8! G2/8 G1/8 G2/8 | F#1/8! F#2/8 F#1/8 F#2/8 F#1/8! F#2/8 F#1/8 F#2/8
triangle: B1/8! B2/8 B1/8 B2/8 B1/8! B2/8 B1/8 B2/8 | A1/8! A2/8 A1/8 A2/8 A1/8! A2/8 A1/8 A2/8 | G1/8! G2/8 G1/8 G2/8 G1/8! G2/8 G1/8 G2/8 | A1/8! A2/8 A1/8 A2/8 A1/8! A2/8 A1/8 A2/8
// open hats on every off-beat lift the repeat, with a tom turn at the half
noise: c/8@0.6 o/8@0.25 s/8@0.6 o/8@0.25 k/8 o/8@0.25 s/8@0.6 o/8@0.25 | [k/8 o/8@0.25 s/8@0.6 o/8@0.25 k/8 o/8@0.25 s/8@0.6 o/8@0.25 |]x2 k/8 o/8@0.25 s/8@0.6 o/8@0.25 k/8 t/8@0.5 t/8@0.55 t/8@0.6 | [k/8 o/8@0.25 s/8@0.6 o/8@0.25 k/8 o/8@0.25 s/8@0.6 o/8@0.25 |]x3 k/8 h/8@0.3 s/8@0.6 h/8@0.3 t/16@0.5 t/16@0.5 t/16@0.6 t/16@0.6 s/8@0.7 s/8@0.8

section: B
chords: D | E | D | E | G | A | Em | F#
// a rounder duty and long notes; the lead swings down a minor third at the end
duty pulse1: 0.5
pulse1: F#5/1v | G#5/2. B5/4 | A5/1v | G#5/2. E5/4
pulse1: B5/1v | C#6/2. A5/4 | B5/2 G5/4 E5/4 | C#6/2>-3 r/4 F#5/4
// the world's motif on the counter-line: a held note, down a minor third, up a tone
// and in between, a line that steps down while the lead holds and climbs back
pulse2: A4/2. F#4/4 | G#4/1 | F#4/4. E4/8 D4/4 C#4/4 | B3/4 C#4/8 D4/8 E4/4 G#4/4
pulse2: D5/2. B4/4 | C#5/1 | G4/4. F#4/8 E4/4 B3/4 | A#3/4 C#4/8 E4/8 F#4/4 C#4/4
// a walking bass in quarters
triangle: D2/4 A1/4 D2/4 F#2/4 | E2/4 B1/4 E2/4 G#2/4 | D2/4 A1/4 B1/4 C#2/4 | E2/4 B1/4 E2/4 F#2/4
triangle: G2/4 D2/4 B1/4 G1/4 | A1/4 E2/4 A2/4 F#2/4 | E2/4 G2/4 B1/4 G1/4 | F#1/4 A#1/4 C#2/4 E2/4
noise: c/4@0.5 h/8@0.25 h/8@0.2 s/4@0.6 h/8@0.25 h/8@0.2 | [k/4 h/8@0.25 h/8@0.2 s/4@0.6 h/8@0.25 h/8@0.2 |]x2 k/4 h/8@0.25 k/8 s/4@0.6 t/8@0.4 t/8@0.45 | [k/4 h/8@0.25 h/8@0.2 s/4@0.6 h/8@0.25 h/8@0.2 |]x3 k/4 h/8@0.25 s/8@0.5 s/16@0.4 s/16@0.5 s/16@0.6 s/16@0.7 s/4@0.8

section: C
chords: D | A | E | E | D | A | G | F#
// a new 3+3+2 cell: the lead calls and whips down a slide, pulse 2 answers, then both climb
duty pulse1: 0.25
pulse1: F#5/4. A5/4. D6/4 | C#6/2.>-4 r/4 | r/1 | r/1
pulse1: A5/4. F#5/4. D5/4 | E5/2.>+5 r/4 | B5/2 D6/2 | C#6/2. A#5/4
pulse2: D4:047/8@0.6 r/8 r/4 r/2 | A3:047/8@0.6 r/8 r/4 r/2 | G#4/4. B4/4. E5/4 | B4/2.>-3 r/4
pulse2: D4:047/8@0.6 r/8 r/4 r/2 | A3:047/8@0.6 r/8 r/4 r/2 | G4/4 B4/4 D5/4 B4/4 | F#4/4 A#4/4 C#5/4 F#5/4
// the bass kicks on the 3+3+2 of the lead's cell: root, octave, then the fifth
triangle: D2/8! D2/8 D3/8 D2/8! D2/8 D3/8 A1/8 A2/8 | A1/8! A1/8 A2/8 A1/8! A1/8 A2/8 E2/8 E3/8 | E2/8! E2/8 E3/8 E2/8! E2/8 E3/8 B1/8 B2/8 | E2/8! E2/8 E3/8 E2/8! E2/8 E3/8 B1/8 C#2/8
triangle: D2/8! D2/8 D3/8 D2/8! D2/8 D3/8 A1/8 A2/8 | A1/8! A1/8 A2/8 A1/8! A1/8 A2/8 E2/8 E3/8 | G1/8! G1/8 G2/8 G1/8! G1/8 G2/8 D2/8 D3/8 | F#1/8! F#1/8 F#2/8 F#1/8! A#1/8 C#2/8 E2/8 A#1/8
noise: c/8@0.6 h/8@0.3 t/8@0.5 h/8@0.3 k/8 h/8@0.3 s/8@0.6 h/8@0.3 | [k/8 h/8@0.3 t/8@0.5 h/8@0.3 k/8 h/8@0.3 s/8@0.6 h/8@0.3 |]x6 k/8 t/8@0.5 t/8@0.5 t/8@0.6 s/16@0.5 s/16@0.6 s/16@0.7 s/16@0.8 s/4@0.8

section: breakdown
chords: Bm6 | Bm6 | G | G
// the lead rests: arpeggio bursts over a gapped bass and hats
pulse2: B3:0379/8@0.8 r/8 r/4 F#4:0258/8@0.6 r/8 r/4 | B3:0379/8@0.6 r/8 r/4 F#4:0258/8@0.4 r/8 r/4
pulse2: G3:047/8@0.8 r/8 r/4 D4:059/8@0.6 r/8 r/4 | G3:047/8@0.6 r/8 r/4 D4:059/8@0.4 r/8 D4:059/8@0.6 r/8
triangle: [B1/8! r/8 B2/8 r/8 B1/8 r/8 B2/8 r/8 |]x2 G1/8! r/8 G2/8 r/8 G1/8 r/8 G2/8 r/8 | G1/8! r/8 G2/8 r/8 G1/8 G2/8 G1/8 G2/8
noise: o/8@0.35 h/8@0.15 h/8@0.25 h/8@0.15 h/8@0.3 h/8@0.15 h/8@0.25 h/8@0.15 | [h/8@0.3 h/8@0.15 h/8@0.25 h/8@0.15]x2 | o/8@0.35 h/8@0.15 h/8@0.25 h/8@0.15 h/8@0.3 h/8@0.15 h/8@0.25 h/8@0.15 | k/8 h/8@0.2 s/8@0.4 h/8@0.2 s/16@0.4 s/16@0.5 s/16@0.6 s/16@0.7 s/4@0.8

section: turnaround
chords: A | F#
pulse1: E5/8 A5/8 r/8 C#6/8~ C#6/4 B5/8 A5/8 | A#5/2 C#6/4 r/4
pulse2: A3:047/8@0.7 r/8 r/4 A3:047/8@0.5 r/8 r/4 | F#3:047/8@0.7 r/8 r/4 F#3:047/8@0.5 r/8 r/4
triangle: A1/8! A2/8 [A1/8 A2/8]x3 | F#1/8! F#2/8 F#1/8 F#2/8 E2/8 E1/8 C#2/8 C#1/8
noise: k/8 h/8@0.3 s/8@0.6 h/8@0.3 k/8 s/8@0.5 s/8@0.6 s/8@0.7 | [s/16@0.35 s/16@0.45]x4 [s/16@0.55 s/16@0.65]x2 s/8@0.7 s/8@0.8
`;

/** "Slingshot", Farside's second race track, parsed. */
export const farsideTwo: Song = parseSong(source);
