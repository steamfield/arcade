/**
 * Thornwood's first race track, "Hollow Chase": D dorian in 6/8 at 156 BPM, a bouncy jig that
 * runs through the trees. A beat is a quarter note, so a bar is three beats of two eighths each.
 *
 * Form: intro (2 bars, bass and drums, outside the loop) | A (8) | A2 (8) | B (8) | C (8) |
 * breakdown (8) | A3 (8) | climb (4) | turnaround (4), looping from the turnaround back to A.
 * The loop is 56 bars, about 65 seconds.
 *
 * Chords:
 * - intro: Dm | A
 * - A: Dm | C | G | Dm | Dm | C | G | A (i, bVII, the dorian IV, i, then the dominant pulls back)
 * - A2: Dm | C | G | Dm | Dm | C | G | Dm (the same climb, landing on the tonic)
 * - B: Bb | F | C | Dm | Bb | F | Gm | A (the borrowed flat sixth, lead in long notes)
 * - C: F | C | Bb | F | Dm | C | Bb | A (a bridge leaning on F, the relative major)
 * - breakdown: Dm | Dm | C | C | Bb | Bb | A | A (the bass steps down to the dominant)
 * - A3: Dm | C | G | Dm | Dm | C | G | Dm
 * - climb: Bb | C | Bb | C (bVI and bVII rocking under a rising lead)
 * - turnaround: Dm | Gm | A | A (a run of eighths that ends on the dominant)
 *
 * The hook (A, bars 1-2) is "D5 F5 A5 G5 F5 | E5 G5 E5 C5": a rising arpeggio and a falling step,
 * then a rocking third that lands on the bar's last beat. A states it in bars 1-2 and 5-6, and A2
 * and A3 bring it back the same way.
 *
 * Voices:
 * - Pulse 1 leads: round 50% in A, A2, the climb and turnaround; 25% for the long notes of B and
 *   the hook's return in A3; a thin 12.5% for the bridge calls in C. It rests through the
 *   breakdown and every other two bars of C.
 * - Pulse 2 plays a lilting off-beat figure on the chord tones in A and the turnaround, echoes the
 *   lead a quarter later in A2, rolls broken chords in B, and answers the lead's calls in C (the
 *   last answer rocks a third like the hook's second bar). In the breakdown it fires short
 *   arpeggio bursts, then teases the hook's rhythm in broken chords up to the dominant; it bursts
 *   again in the climb and holds a counter-line under the lead in A3.
 * - The triangle bounces root, octave and fifth, half-time in B, walks root-first in C, and drops
 *   its pitch for a kick on the downbeats of A2, the breakdown and A3.
 * - Noise keeps kick on 1 and snare on 4 (half-time in B), goes tom-led in C and the breakdown,
 *   opens the hats in A2 and A3, crashes into A, A3 and the turnaround, and fills at the end of
 *   every section.
 */
import { parseSong, type Song } from '../notation.ts';

const thornwoodSource = `
name: thornwood
title: Hollow Chase
tempo: 156
time: 6/8
key: D dorian
loop: A

voice pulse1: duty=0.5 level=0.5 attack=0.005 decay=0.1 sustain=0.6 release=0.06
voice pulse2: duty=0.25 level=0.28 attack=0.005 decay=0.08 sustain=0.45 release=0.04
voice triangle: level=0.7 attack=0.002 decay=0.05 sustain=0.9 release=0.03
voice noise: level=0.32 attack=0.001 decay=0.08 sustain=0 release=0.02

section: intro
chords: Dm | A
triangle: [D2/8 D3/8 A2/8]x2 | [A2/8 A3/8 E3/8]x2
noise: k/8 h/8@0.4 h/8@0.4 s/8 h/8@0.4 h/8@0.4 | k/8 h/8@0.4 h/8@0.4 s/16 s/16 s/16 s/16 s/8

section: A
chords: Dm | C | G | Dm | Dm | C | G | A
// hook, answer, a leap to the high G, a rocking cadence
pulse1: D5/8 F5/8 A5/8 G5/4 F5/8 | E5/8 G5/8 E5/8 C5/4. | D5/8 G5/8 B5/8 A5/4 G5/8 | F5/4.v D5/4.
// hook again, then a climb to the dominant
pulse1: D5/8 F5/8 A5/8 G5/4 F5/8 | E5/8 G5/8 E5/8 C5/4. | B4/8 D5/8 G5/8 B5/4 A5/8 | C#5/8 E5/8 A5/8 G5/4 E5/8
pulse2: [r/8 F4/8 A4/8]x2 | [r/8 E4/8 G4/8]x2 | [r/8 D4/8 B4/8]x2 | [r/8 F4/8 A4/8]x2
pulse2: [r/8 F4/8 A4/8]x2 | [r/8 E4/8 G4/8]x2 | [r/8 D4/8 B4/8]x2 | [r/8 C#4/8 E4/8]x2
triangle: [D2/8 D3/8 A2/8]x2 | [C3/8 C2/8 G2/8]x2 | [G2/8 G3/8 D3/8]x2 | [D2/8 D3/8 A2/8]x2
triangle: [D2/8 D3/8 A2/8]x2 | [C3/8 C2/8 G2/8]x2 | [G2/8 G3/8 D3/8]x2 | [A2/8 A3/8 E3/8]x2
noise: c/8 h/8@0.4 h/8@0.4 s/8 h/8@0.4 h/8@0.4 | [k/8 h/8@0.4 h/8@0.4 s/8 h/8@0.4 h/8@0.4 |]x6 k/8 h/8@0.4 h/8@0.4 s/16 s/16 s/16 s/16 s/8

section: A2
chords: Dm | C | G | Dm | Dm | C | G | Dm
// the hook with its echo; the answer rocks a third like bar 2, and the phrase lands home
pulse1: D5/8 F5/8 A5/8 G5/4 F5/8 | E5/8 G5/8 E5/8 C5/4. | D5/8 G5/8 B5/8 A5/4 G5/8 | F5/8 A5/8 F5/8 D5/4.
pulse1: D5/8 F5/8 A5/8 G5/4 F5/8 | E5/8 G5/8 E5/8 C5/4. | B4/8 D5/8 G5/8 B5/4 A5/8 | F5/8 E5/8 D5/8 A4/4 r/8
echo pulse2: pulse1 delay=1 level=0.5
triangle: D2/8! D3/8 A2/8 D2/8 D3/8 A2/8 | C2/8! C3/8 G2/8 C2/8 C3/8 G2/8 | G2/8! G3/8 D3/8 G2/8 G3/8 D3/8 | D2/8! D3/8 A2/8 D2/8 D3/8 A2/8
triangle: D2/8! D3/8 A2/8 D2/8 D3/8 A2/8 | C2/8! C3/8 G2/8 C2/8 C3/8 G2/8 | G2/8! G3/8 D3/8 G2/8 G3/8 D3/8 | D2/8! D3/8 A2/8 D3/8 C3/8 A2/8
noise: [k/8 h/8@0.4 o/8@0.3 s/8 h/8@0.4 k/8@0.6 |]x7 k/8 s/16 s/16 s/8 s/16 s/16 s/16 s/16 s/8

section: B
chords: Bb | F | C | Dm | Bb | F | Gm | A
duty pulse1: 0.25
// long notes, lower than A; the broken chords move underneath
pulse1: D5/4. Bb4/4. | C5/4. A4/4. | G4/4. C5/4. | D5/2 r/4
pulse1: D5/4. F5/4. | A5/4. F5/4. | G5/8 F5/8 D5/8 Bb4/4 D5/8 | C#5/8 D5/8 E5/8 A5/4.
pulse2: [Bb3/8 D4/8 F4/8]x2 | [A3/8 C4/8 F4/8]x2 | [G3/8 C4/8 E4/8]x2 | [A3/8 D4/8 F4/8]x2
pulse2: [Bb3/8 D4/8 F4/8]x2 | [A3/8 C4/8 F4/8]x2 | [G3/8 Bb3/8 D4/8]x2 | [A3/8 C#4/8 E4/8]x2
// half-time bass
triangle: Bb2/4. F3/4. | F2/4. C3/4. | C3/4. G2/4. | D3/4. A2/4.
triangle: Bb2/4. F3/4. | F2/4. C3/4. | G2/4. D3/4. | A2/4. E3/4.
noise: [k/4. h/8@0.3 h/8@0.3 s/8 |]x7 k/4. s/16 s/16 s/16 s/16 s/8

section: C
chords: F | C | Bb | F | Dm | C | Bb | A
duty pulse1: 0.125
duty pulse2: 0.5
// the lead calls for two bars, pulse 2 answers for two
pulse1: A5/4 G5/8 F5/4 C5/8 | G5/4 E5/8 C5/4. | r/2. | r/2.
pulse1: F5/4 E5/8 D5/4 A4/8 | E5/4 G5/8 C5/4. | r/2. | r/2.
pulse2: F4/4. A4/8 C5/8 A4/8 | E4/4. G4/8 E4/8 C4/8 | D5/4 C5/8 Bb4/4 F4/8 | A4/4 C5/8 F5/4.
pulse2: A4/4. F4/8 D4/8 F4/8 | G4/4. E4/8 G4/8 E4/8 | D5/4 F5/8 D5/4 Bb4/8 | C#5/8 E5/8 C#5/8 A4/4.
triangle: F2/4. F3/8 C3/8 F2/8 | C3/4. C2/8 G2/8 C3/8 | Bb2/4. F2/8 Bb2/8 F3/8 | F2/4. C3/8 F3/8 C3/8
triangle: D3/4. A2/8 D3/8 A2/8 | C3/4. G2/8 C3/8 G2/8 | Bb2/4. F2/8 Bb2/8 F2/8 | A2/4. E2/8 A2/8 C#3/8
noise: [k/8 t/8@0.5 t/8@0.4 s/8 h/8@0.3 t/8@0.5 |]x7 k/8 t/8 t/8 s/16 s/16 s/16 s/16 s/8

section: breakdown
chords: Dm | Dm | C | C | Bb | Bb | A | A
duty pulse2: 0.25
// the lead rests; short arpeggio bursts over kicks the triangle plays itself
pulse2: D4:037/8 r/8 D4:037/8 r/4 A3:058/8 | r/4. D4:037/8 r/8 D4:037/8 | C4:047/8 r/8 C4:047/8 r/4 G3:059/8 | r/4. C4:047/8 r/8 C4:047/8
// then pulse 2 teases the hook's rhythm in broken chords, rising to the dominant
pulse2: Bb3/8 D4/8 F4/8 D4/4 F4/8 | Bb3/8 D4/8 F4/8 Bb4/4. | A3/8 C#4/8 E4/8 C#4/4 E4/8 | A3/8 C#4/8 E4/8 A4/8 G4/8 E4/8
triangle: [D2/8! D3/8 D3/8 r/8 A2/8 D3/8 |]x2 [C2/8! C3/8 C3/8 r/8 G2/8 C3/8 |]x2
triangle: [Bb1/8! Bb2/8 Bb2/8 r/8 F2/8 Bb2/8 |]x2 A1/8! A2/8 A2/8 r/8 E2/8 A2/8 | A1/8! A2/8 E2/8 A2/8 C#3/8 E3/8
noise: [r/8 h/8@0.3 t/8@0.5 s/8@0.6 h/8@0.3 t/8@0.4 |]x7 t/8 t/8 t/8 s/16 s/16 s/16 s/16 s/8

section: A3
chords: Dm | C | G | Dm | Dm | C | G | Dm
duty pulse1: 0.25
// the hook comes home over a counter-line that moves when the lead holds
pulse1: D5/8 F5/8 A5/8 G5/4 F5/8 | E5/8 G5/8 E5/8 C5/4. | D5/8 G5/8 B5/8 A5/4 G5/8 | F5/4.v D5/4.
pulse1: D5/8 F5/8 A5/8 G5/4 F5/8 | E5/8 G5/8 E5/8 C5/4. | B4/8 D5/8 G5/8 B5/4 A5/8 | A5/8 F5/8 D5/8 r/4.
pulse2: A4/4. F4/4. | G4/4. E4/8 F4/8 G4/8 | B4/4. G4/4. | D4/8 F4/8 A4/8 D4/8 F4/8 A4/8
pulse2: A4/4. F4/4. | G4/4. E4/8 F4/8 G4/8 | G4/4. D4/4. | F4/4. A4/4.
triangle: D2/8! D3/8 D2/8 D3/8 A2/8 D3/8 | C2/8! C3/8 C2/8 C3/8 G2/8 C3/8 | G2/8! G2/8 G3/8 G2/8 D3/8 G2/8 | D2/8! D3/8 D2/8 D3/8 A2/8 D3/8
triangle: D2/8! D3/8 D2/8 D3/8 A2/8 D3/8 | C2/8! C3/8 C2/8 C3/8 G2/8 C3/8 | G2/8! G2/8 G3/8 G2/8 D3/8 G2/8 | D2/8! D3/8 A2/8 F2/8 G2/8 A2/8
noise: c/8 h/8@0.4 o/8@0.4 s/8 h/8@0.4 h/8@0.4 | [k/8 h/8@0.4 o/8@0.4 s/8 h/8@0.4 k/8@0.5 |]x6 k/8 h/8@0.4 s/16 s/16 s/8 s/16 s/16 s/8

section: climb
chords: Bb | C | Bb | C
duty pulse1: voice
duty pulse2: 0.25
// bVI and bVII rock under a rising lead; the snare builds to a roll
pulse1: D5/4. F5/4. | E5/4. G5/4. | F5/4. D5/8 F5/8 Bb5/8 | G5/4. E5/8 D5/8 C5/8
pulse2: Bb3:047/8 r/8 Bb3:047/8 r/8 Bb3:047/8 r/8 | C4:047/8 r/8 C4:047/8 r/8 C4:047/8 r/8
pulse2: Bb3:047/8 Bb3:047/8 r/8 Bb3:047/8 Bb3:047/8 r/8 | C4:047/8 C4:047/8 r/8 C4:047/8 C4:047/8 r/8
triangle: Bb2/8 Bb2/8 Bb2/8 Bb2/8 Bb2/8 Bb2/8 | C3/8 C3/8 C3/8 C3/8 C3/8 C3/8 | Bb2/8 Bb2/8 Bb2/8 Bb2/8 Bb2/8 Bb2/8 | C3/8 C3/8 C3/8 C3/8 C3/8 C3/8
noise: k/8 s/8@0.4 h/8@0.3 k/8 s/8@0.5 h/8@0.3 | k/8 s/8@0.5 h/8@0.3 k/8 s/8@0.6 h/8@0.3 | k/8 s/8@0.6 k/8 s/8@0.7 k/8 s/8@0.8 | [s/16@0.6 s/16@0.8]x4 s/8 s/8

section: turnaround
chords: Dm | Gm | A | A
duty pulse2: voice
pulse1: D5/8 E5/8 F5/8 G5/8 A5/8 F5/8 | G5/8 F5/8 D5/8 Bb4/8 D5/8 G5/8 | A5/8 G5/8 E5/8 C#5/8 E5/8 A5/8 | E5/8 F5/8 E5/8 C#5/4 E5/8
pulse2: [r/8 F4/8 A4/8]x2 | [r/8 Bb3/8 D4/8]x2 | [r/8 C#4/8 E4/8]x2 | [r/8 C#4/8 E4/8]x2
triangle: [D2/8 D3/8 A2/8]x2 | [G2/8 G3/8 D3/8]x2 | [A2/8 A3/8 E3/8]x2 | [A2/8 A3/8 E3/8]x2
noise: c/8 h/8@0.4 h/8@0.4 s/8 h/8@0.4 h/8@0.4 | [k/8 h/8@0.4 h/8@0.4 s/8 h/8@0.4 h/8@0.4 |]x2 k/8 s/16 s/16 k/8 s/16 s/16 s/8 s/8
`;

/** "Hollow Chase", Thornwood's first race track, parsed. */
export const thornwood: Song = parseSong(thornwoodSource);
