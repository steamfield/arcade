/**
 * Thornwood's third race track, "Moth Lantern Reel": A dorian in 4/4 at 172 BPM, a quick reel of
 * running eighths with sixteenth-note cuts, over a bass that bounces on drone fifths.
 *
 * Form: intro (2 bars, bass and drums, outside the loop) | A (8) | A2 (8) | B (8) | B2 (8) | C (8) |
 * breakdown (4) | turnaround (4), looping from the turnaround back to A. Like a fiddle reel it plays
 * each strain twice, changed the second time. The loop is 48 bars, about 67 seconds.
 *
 * Chords:
 * - intro: Am | G
 * - A: Am | G | Am | D | Am | G | D | Am (the dorian major IV is the colour)
 * - A2: Am | G | Am | D | Am | G | D | Am
 * - B: C | G | Am | Em | C | G | D | D (the high strain in long notes)
 * - B2: F | G | Am | Am | F | G | E | E (the borrowed bVI and bVII, then a major V)
 * - C: Am | Am | D | D | Am | Am | G | G (the pulses trade bars over a drone)
 * - breakdown: Am | Am | G | G (the lead rests)
 * - turnaround: F | G | E | E (bVI, bVII and V back to Am)
 *
 * The hook (A, bars 1-2) is "A4 E5 E5 E5 C5 A5 G5 E5 | D5 G5 B4 D5 G4": a leap to E with a
 * sixteenth-note cut on it, a jump to the high A, then a fall through G major that leaves a beat
 * to breathe. A and A2 state the first bar in bars 1 and 5, and in bar 3 with its tail turned up
 * to B5.
 *
 * B2 is the high strain again as a reel with a tune of its own: a falling run with a cut and its
 * rising answer, a fall home to A, then a four-note cell with a cut on its second beat
 * (C5 F5 F5 F5) that climbs in sequence over bVI and bVII to the high B and falls onto the
 * major V.
 *
 * World motif: Hollow Chase opens with a rising arpeggio and a step down in an eighth, eighth,
 * eighth, quarter rhythm (D F A G). In B pulse 2 plays that cell as its counter-line under the
 * lead's long notes, exactly (A3 C4 E4 D4, E4 G4 B4 A4) on the minor chords and in the same
 * rhythm on the major ones.
 *
 * Voices:
 * - Pulse 1 leads at a bright 25% in the A strains, round 50% for the long notes of B and the
 *   turnaround, back to 25% for the running B2, and a thin 12.5% for its calls in C. It rests
 *   through the breakdown and every other bar of C.
 * - Pulse 2 chucks off-beat chord tones in the first half of A and holds half notes under the
 *   running lead in the second, echoes the lead a dotted eighth later in A2, plays the world motif
 *   in B, fires short arpeggio bursts in B2 and the breakdown, answers the lead in C in the call's
 *   rhythm with its contour turned over, and runs broken chords in the turnaround.
 * - The triangle bounces root and fifth (in quarters in A, stepping into the next root at the end
 *   of most bars; eighths elsewhere), holds drones in C, and drops its pitch for kicks on the
 *   downbeats of A2, C and the breakdown.
 * - Noise plays a reel kit with snare on 2 and 4, open hats in A2 and B2, toms in C and the
 *   breakdown, crashes into A, B and the turnaround, a turn in the fourth bar of A and B, and a
 *   fill at the end of every section.
 */
import { parseSong, type Song } from '../notation.ts';

const source = `
name: thornwood-3
title: Moth Lantern Reel
tempo: 172
time: 4/4
key: A dorian
loop: A

voice pulse1: duty=0.25 level=0.5 attack=0.004 decay=0.08 sustain=0.6 release=0.04
voice pulse2: duty=0.5 level=0.28 attack=0.004 decay=0.07 sustain=0.4 release=0.04 arp=2
voice triangle: level=0.6 attack=0.002 decay=0.05 sustain=0.9 release=0.03
voice noise: level=0.3 attack=0.001 decay=0.07 sustain=0 release=0.02

section: intro
chords: Am | G
triangle: A2/8 E3/8 A2/8 E3/8 A2/8 E3/8 A2/8 E3/8 | G2/8 D3/8 G2/8 D3/8 G2/8 D3/8 G2/8 D3/8
noise: k/8 h/8@0.3 s/8 h/8@0.3 k/8 h/8@0.3 s/8 h/8@0.3 | k/8 h/8@0.3 s/8 h/8@0.3 s/16 s/16 s/16 s/16 s/8 s/8

section: A
chords: Am | G | Am | D | Am | G | D | Am
// the hook and its fall through G, then a turn up to the dorian D
pulse1: A4/8 E5/8 E5/16 E5/16 C5/8 A5/4 G5/8 E5/8 | D5/8 G5/8 B4/8 D5/8 G4/4 r/4
pulse1: A4/8 E5/8 E5/16 E5/16 C5/8 A5/4 B5/8 A5/8 | F#5/8 E5/8 D5/8 A4/8 F#5/4 r/4
// the hook again, a run down through G, and home
pulse1: A4/8 E5/8 E5/16 E5/16 C5/8 A5/4 G5/8 E5/8 | B4/8 D5/8 G5/8 D5/8 B4/8 G4/8 B4/8 D5/8
pulse1: A5/8 F#5/8 D5/8 F#5/8 A5/8 F#5/8 E5/8 C5/8 | A4/4 E5/8 C5/8 A4/4 r/4
pulse2: [r/8 C4/8 r/8 E4/8]x2 | [r/8 B3/8 r/8 D4/8]x2 | [r/8 C4/8 r/8 E4/8]x2 | r/8 F#3/8 r/8 A3/8 D4:047/8 r/8 D4:047/8 r/8
// then long notes under the running lead, moving only when it holds its high A
pulse2: C4/2 E4/2 | B3/2 D4/2 | F#4/2 D4/2 | r/8 C4/8 r/8 E4/8 r/8 C4/8 A3:037c/8 r/8
// the bass bounces on fifths and steps into each next root at the end of a bar
triangle: A2/4 E3/4 A2/4 E3/4 | G2/4 D3/4 B2/4 G2/4 | A2/4 E3/4 A2/4 C3/4 | D3/4 A2/4 F#2/4 G2/4
triangle: A2/4 E3/4 A2/4 E3/4 | G2/4 D3/4 B2/4 C3/4 | D3/4 A2/4 C3/4 B2/4 | A2/4 E3/4 A2/8 G2/8 E2/8 G2/8
noise: c/8 h/8@0.3 s/8 h/8@0.3 k/8 h/8@0.3 s/8 h/8@0.3 | [k/8 h/8@0.3 s/8 h/8@0.3 k/8 h/8@0.3 s/8 h/8@0.3 |]x2
noise: k/8 h/8@0.3 s/8 h/8@0.3 k/8 s/8@0.5 s/8 h/8@0.3 | [k/8 h/8@0.3 s/8 h/8@0.3 k/8 h/8@0.3 s/8 h/8@0.3 |]x3
noise: k/8 h/8@0.3 s/8 h/8@0.3 s/16 s/16 s/16 s/16 s/8 s/8

section: A2
chords: Am | G | Am | D | Am | G | D | Am
// the A strain again with cuts in the answers and an echo behind it
pulse1: A4/8 E5/8 E5/16 E5/16 C5/8 A5/4 G5/8 E5/8 | D5/8 G5/8 B4/8 D5/8 G4/8 A4/16 B4/16 D5/4
pulse1: A4/8 E5/8 E5/16 E5/16 C5/8 A5/4 B5/8 A5/8 | F#5/8 E5/8 D5/8 A4/8 F#5/8 G5/16 F#5/16 E5/8 D5/8
pulse1: A4/8 E5/8 E5/16 E5/16 C5/8 A5/4 G5/8 E5/8 | B4/8 D5/8 G5/8 D5/8 B4/8 G4/8 B4/8 D5/8
pulse1: A5/8 F#5/8 D5/8 F#5/8 A5/8 B5/8 A5/8 F#5/8 | E5/8 C5/8 A4/8 B4/8 C5/4 r/4
duty pulse2: 0.25
echo pulse2: pulse1 delay=0.75 level=0.4
triangle: A1/8! A2/8 E3/8 A2/8 E3/8 A2/8 E3/8 A2/8 | G1/8! G2/8 D3/8 G2/8 D3/8 G2/8 D3/8 G2/8
triangle: A1/8! A2/8 E3/8 A2/8 E3/8 A2/8 E3/8 A2/8 | D2/8! D3/8 A2/8 D3/8 A2/8 D3/8 A2/8 D3/8
triangle: A1/8! A2/8 E3/8 A2/8 E3/8 A2/8 E3/8 A2/8 | G1/8! G2/8 D3/8 G2/8 D3/8 G2/8 D3/8 G2/8
triangle: D2/8! D3/8 A2/8 D3/8 A2/8 D3/8 A2/8 D3/8 | A1/8! A2/8 E3/8 A2/8 G2/8 A2/8 B2/8 C3/8
noise: [k/8 h/8@0.3 s/8 o/8@0.3 k/8 h/8@0.3 s/8 h/8@0.3 |]x7 k/8 h/8@0.3 s/8 k/8 s/16 s/16 s/16 s/16 s/8 s/8

section: B
chords: C | G | Am | Em | C | G | D | D
duty pulse1: 0.5
duty pulse2: voice
// the high strain sings in long notes while pulse 2 runs the world motif underneath
pulse1: E5/2 G5/4. E5/8 | D5/2 B4/4 r/4 | C5/4. B4/8 A4/2 | B4/2 r/2
pulse1: G5/2 E5/4. G5/8 | B5/4. A5/8 G5/2 | A5/2 F#5/4 D5/4 | F#5/2 r/2
pulse2: G3/8 C4/8 E4/8 D4/4 r/8 G4/8 E4/8 | G3/8 B3/8 D4/8 C4/4 r/8 D4/8 B3/8
pulse2: A3/8 C4/8 E4/8 D4/4 r/8 E4/8 C4/8 | E4/8 G4/8 B4/8 A4/4 r/8 B4/8 G4/8
pulse2: G3/8 C4/8 E4/8 D4/4 r/8 G4/8 E4/8 | G3/8 B3/8 D4/8 C4/4 r/8 D4/8 B3/8
pulse2: D4/8 F#4/8 A4/8 G4/4 r/8 A4/8 F#4/8 | D4/8 F#4/8 A4/8 G4/4 r/8 F#4/8 E4/8
triangle: C3/8 G2/8 C3/8 G2/8 C3/8 G2/8 C3/8 G2/8 | G2/8 D3/8 G2/8 D3/8 G2/8 D3/8 G2/8 D3/8
triangle: A2/8 E3/8 A2/8 E3/8 A2/8 E3/8 A2/8 E3/8 | E2/8 B2/8 E2/8 B2/8 E2/8 B2/8 E2/8 B2/8
triangle: C3/8 G2/8 C3/8 G2/8 C3/8 G2/8 C3/8 G2/8 | G2/8 D3/8 G2/8 D3/8 G2/8 D3/8 G2/8 D3/8
triangle: D3/8 A2/8 D3/8 A2/8 D3/8 A2/8 D3/8 A2/8 | D3/8 A2/8 D3/8 A2/8 D3/8 C3/8 B2/8 A2/8
noise: c/4 h/8@0.3 h/8@0.3 s/4 h/8@0.3 h/8@0.3 | [k/4 h/8@0.3 h/8@0.3 s/4 h/8@0.3 h/8@0.3 |]x2
noise: k/4 h/8@0.3 k/8 s/4 s/8@0.5 t/8 | [k/4 h/8@0.3 h/8@0.3 s/4 h/8@0.3 h/8@0.3 |]x3
noise: k/4 h/8@0.3 k/8 s/16 s/16 s/16 s/16 s/8 s/8

section: B2
chords: F | G | Am | Am | F | G | E | E
duty pulse1: 0.25
duty pulse2: 0.25
// the high strain again as a reel through bVI and bVII to the major V: a falling run and its
// rising answer, then a cell with a cut on its second beat climbs in sequence to the high B
pulse1: A5/8 F5/16 G5/16 A5/8 C5/8 F5/8 E5/8 D5/8 C5/8 | B4/8 C5/8 D5/8 G5/8 B5/4 A5/8 G5/8
pulse1: C5/8 B4/8 A4/8 B4/8 C5/8 E5/8 A5/8 E5/8 | E5/8 D5/8 C5/8 B4/8 A4/4 r/4
pulse1: C5/8 F5/8 F5/16 F5/16 G5/8 A5/8 G5/8 F5/8 E5/8 | D5/8 G5/8 G5/16 G5/16 A5/8 B5/4 A5/8 G5/8
pulse1: G#5/8 F#5/8 E5/8 D5/8 B4/8 D5/8 E5/8 G#5/8 | B5/4 G#5/8 E5/8 B4/4 r/4
pulse2: F4:047c/8 r/8 r/4 F4:047c/8 r/8 r/4 | G3:047c/8 r/8 r/4 G3:047c/8 r/8 r/4
pulse2: A3:037c/8 r/8 r/4 A3:037c/8 r/8 r/4 | A3:037c/8 r/8 A3:037c/8 r/8 E4/8 C4/8 A3/8 C4/8
pulse2: F3:047c/8 r/8 r/4 F3:047c/8 r/8 r/4 | G3:047c/8 r/8 r/4 G3:047c/8 r/8 r/4
pulse2: E3:047c/8 r/8 r/4 E3:047c/8 r/8 r/4 | E3:047c/8 r/8 E3:047c/8 r/8 G#3/8 B3/8 E4/8 G#3/8
triangle: F2/8 C3/8 F2/8 C3/8 F2/8 C3/8 F2/8 C3/8 | G2/8 D3/8 G2/8 D3/8 G2/8 D3/8 G2/8 D3/8
triangle: A2/8 E3/8 A2/8 E3/8 A2/8 E3/8 A2/8 E3/8 | A2/8 E3/8 A2/8 E3/8 A2/8 G2/8 F#2/8 E2/8
triangle: F2/8 C3/8 F2/8 C3/8 F2/8 C3/8 F2/8 C3/8 | G2/8 D3/8 G2/8 D3/8 G2/8 D3/8 G2/8 D3/8
triangle: E2/8 B2/8 E2/8 B2/8 E2/8 B2/8 E2/8 B2/8 | E2/8 B2/8 E2/8 B2/8 E2/8 F#2/8 G#2/8 B2/8
noise: [k/8 h/8@0.3 s/8 o/8@0.3 k/8 k/8 s/8 o/8@0.3 |]x7 k/8 k/8 s/8 k/8 s/16 s/16 s/16 s/16 s/8 s/8

section: C
chords: Am | Am | D | D | Am | Am | G | G
duty pulse1: 0.125
duty pulse2: 0.5
// the pulses trade bars over a drone, then play the last two together
pulse1: E5/8 A5/8 B5/8 A5/8 E5/8 C5/8 A4/4 | r/1 | F#5/8 A5/8 B5/8 A5/8 F#5/8 D5/8 A4/4 | r/1
pulse1: C5/8 E5/8 A5/8 B5/8 A5/4 E5/4 | r/1 | D5/8 G5/8 B5/8 G5/8 D5/8 B4/8 G4/4 | B4/4 D5/4 G5/4 r/4
// each answer keeps the call's rhythm and turns its contour over: the call rises, the answer falls
pulse2: r/1 | A4/8 G4/8 E4/8 G4/8 A4/8 C5/8 E5/4 | r/1 | A4/8 F#4/8 E4/8 F#4/8 A4/8 B4/8 D5/4
pulse2: r/1 | E5/8 C5/8 B4/8 A4/8 E4/4 A4/4 | B3/2 D4/2 | G3/2 B3/2
triangle: A1/8! A2/4. E2/2 | A2/2 E2/2 | D2/8! D3/4. A2/2 | D3/2 A2/2
triangle: A1/8! A2/4. E2/2 | A2/2 E2/2 | G1/8! G2/4. D2/2 | G2/2 D2/4 E2/4
noise: [k/8 h/8@0.3 t/8@0.5 h/8@0.3 k/8 t/8@0.5 s/8 h/8@0.3 |]x7 k/8 t/8 t/8 t/8 s/16 s/16 s/16 s/16 s/8 s/8

section: breakdown
chords: Am | Am | G | G
duty pulse2: 0.25
// the lead rests; arpeggio bursts over the triangle's drone and kicks
pulse2: A3:037/8 r/8 A3:037/8 r/8 r/2 | r/4 A3:037/8 r/8 A3:037/8 r/8 A3:037/8 r/8
pulse2: G3:047/8 r/8 G3:047/8 r/8 r/2 | r/4 G3:047/8 G3:047/8 G3:047/8 G3:047/8 G3:047/8 G3:047/8
triangle: [A1/8! A2/8 E2/8 A2/8 A1/8! A2/8 E2/8 A2/8 |]x2 G1/8! G2/8 D2/8 G2/8 G1/8! G2/8 D2/8 G2/8 | G1/8! G2/8 D3/8! G2/8 G3/8! G2/8 B3/8! G2/8
noise: [k/8 r/8 t/8@0.5 r/8 s/8 t/8@0.4 t/8@0.4 r/8 |]x3 t/8 t/8 t/8 t/8 s/16 s/16 s/16 s/16 s/8 s/8

section: turnaround
chords: F | G | E | E
duty pulse1: 0.5
duty pulse2: voice
// bVI, bVII and the major V, then a run down into the hook
pulse1: A5/4 C5/8 F5/8 A5/4 F5/8 C5/8 | B5/4 D5/8 G5/8 B5/4 G5/8 D5/8 | G#5/4 B4/8 E5/8 G#5/4 B5/4
pulse1: B5/8 A5/8 G#5/8 F#5/8 E5/8 D5/8 C5/8 B4/8
pulse2: F3/8 A3/8 C4/8 A3/8 F3/8 A3/8 C4/8 A3/8 | G3/8 B3/8 D4/8 B3/8 G3/8 B3/8 D4/8 B3/8
pulse2: E3/8 G#3/8 B3/8 G#3/8 E3/8 G#3/8 B3/8 G#3/8 | E4:047/4 r/4 E4:047/8 r/8 r/4
triangle: F2/8 C3/8 F2/8 C3/8 F2/8 C3/8 F2/8 C3/8 | G2/8 D3/8 G2/8 D3/8 G2/8 D3/8 G2/8 D3/8
triangle: E2/8 B2/8 E2/8 B2/8 E2/8 B2/8 E2/8 B2/8 | E2/8 B2/8 E2/8 B2/8 E2/8! B2/8! G#2/8! E2/8!
noise: c/8 h/8@0.3 s/8 h/8@0.3 k/8 h/8@0.3 s/8 h/8@0.3 | k/8 h/8@0.3 s/8 h/8@0.3 k/8 h/8@0.3 s/8 s/8@0.5
noise: k/8 s/8@0.5 k/8 s/8@0.6 k/8 s/8@0.7 k/8 s/8@0.8 | [s/16@0.6 s/16@0.8]x4 t/8 t/8 t/8 t/8
`;

/** "Moth Lantern Reel", Thornwood's third race track, parsed. */
export const thornwoodThree: Song = parseSong(source);
