/**
 * Thornwood's second race track, "Bramble Stomp": G mixolydian in 4/4 at 138 BPM, a heavy-footed
 * march through the briars. The triangle stamps kicks on beats 1 and 3, the kit leans on toms,
 * and the two pulses call and answer each other.
 *
 * Form: intro (2 bars, bass and drums, outside the loop) | A (8) | A2 (8) | B (8) | C (8) |
 * breakdown (4) | turnaround (4), looping from the turnaround back to A. The loop is 40 bars,
 * about 70 seconds.
 *
 * Chords:
 * - intro: G | F
 * - A: G | F | G | F | G | F | C | D (I and the mixolydian bVII stomping, then IV and V)
 * - A2: G | F | G | F | C | C | D | D
 * - B: Em | C | G | D | Em | C | F | D (the relative minor, long notes)
 * - C: Dm | C | Dm | C | Dm | C | F | F (the mixolydian minor v against IV, the pulses trading)
 * - breakdown: G | F | G | F (the lead rests)
 * - turnaround: Eb | F | Eb | F (the borrowed bVI and bVII climbing back to G)
 *
 * The hook (A, bars 1-2) is "G4 B4 D5 F5 E5 D5 | C5 A4": a G7 arpeggio that lands on the
 * flat seventh, slips down a step, and leaves the rest of bar 2 for pulse 2's answer, which rises
 * and steps down in the call's own rhythm (A4 C5 D5 C5). A states the call in bars 1, 3 and 5, and
 * the third time the lead answers itself, climbing in the same rhythm (C5 D5 F5 A5 G5 F5) to the
 * high G of bar 7; A2 states the call in bars 1 and 3 and moves its rhythm up to C in bar 5.
 *
 * World motif: Hollow Chase opens with a rising arpeggio and a step down in an eighth, eighth,
 * eighth, quarter rhythm (D F A G). Here the triangle stamps exactly that, D2 F2 A2 G2, as the bass
 * riff under every Dm bar of C, and the same shape on C under the C bars. A2 ends on the Hollow
 * Chase hook's rocking third (F#5 A5 F#5 D5) as a cadence into B. The hook itself is a cousin of
 * Hollow Chase's opening (an arpeggio up, a step down), but it starts on the beat in 4/4, peaks on
 * the flat seventh and stomps where the jig skips.
 *
 * Voices:
 * - Pulse 1 leads at a bright 25% in A and A2, round 50% for the long notes of B and the
 *   turnaround, and a thin 12.5% for its calls in C. It rests through the breakdown, half of C and
 *   the back half of A's second and fourth bars.
 * - Pulse 2 answers the first two calls in A, holds long notes under the lead's climb in bars 5
 *   and 6, echoes the lead a dotted eighth later in A2, rolls short arpeggio bursts in the first
 *   half of B and in the breakdown, plays a counter-line in the second half of B that moves when
 *   the lead holds, trades whole bars with the lead in C (its last answer in the hook's rhythm),
 *   and climbs broken chords in the turnaround.
 * - The triangle drops its pitch for kicks on 1 and 3 and for toms in the breakdown, walks in
 *   quarters in B, stepping into every next root, and plays the world motif in C.
 * - Noise is tom-led: toms on the off-beats, snare on 3, open hats in A2 and B, crashes into A,
 *   A2 and the turnaround, a turn in the fourth bar of A, A2, B and C, and a fill at the end of
 *   every section.
 */
import { parseSong, type Song } from '../notation.ts';

const source = `
name: thornwood-2
title: Bramble Stomp
tempo: 138
time: 4/4
key: G mixolydian
loop: A

voice pulse1: duty=0.25 level=0.5 attack=0.005 decay=0.12 sustain=0.6 release=0.06
voice pulse2: duty=0.5 level=0.32 attack=0.005 decay=0.1 sustain=0.4 release=0.05 arp=2
voice triangle: level=0.65 attack=0.002 decay=0.05 sustain=0.9 release=0.03
voice noise: level=0.3 attack=0.001 decay=0.08 sustain=0 release=0.02

section: intro
chords: G | F
triangle: G1/8! G2/8 G2/8 D2/8 G1/8! G2/8 D2/8 G2/8 | F1/8! F2/8 F2/8 C2/8 F1/8! F2/8 C2/8 F2/8
noise: k/8 r/8 t/8@0.5 r/8 s/4 t/8@0.5 t/8@0.4 | k/8 r/8 t/8@0.5 r/8 s/16 s/16 s/16 s/16 t/8 t/8

section: A
chords: G | F | G | F | G | F | C | D
// the call, then a breath for pulse 2's answer; the third call keeps climbing to the high G
pulse1: G4/8 B4/8 D5/8 F5/4 E5/8 D5/4 | C5/4 A4/8 r/8 r/2
pulse1: G4/8 B4/8 D5/8 F5/4 E5/8 D5/4 | C5/8 D5/8 C5/8 A4/4. r/4
pulse1: G4/8 B4/8 D5/8 F5/4 E5/8 D5/4 | C5/8 D5/8 F5/8 A5/4 G5/8 F5/4
pulse1: G5/4. E5/8 C5/4 E5/4 | F#5/4 E5/8 D5/8 r/2
// pulse 2 answers the call in its own rhythm and shape, then holds low under the climb
pulse2: r/1 | r/4 r/8 A4/8 C5/8 D5/8 C5/4 | r/1 | r/2. C5/8 A4/8
pulse2: B3/2 D4/2 | A3/2 C4/2 | E4/2 G4/4 C5/4 | r/2 D4/8 F#4/8 A4/8 C5/8
triangle: [G1/8! G2/8 G2/8 D2/8 G1/8! G2/8 D2/8 G2/8 | F1/8! F2/8 F2/8 C2/8 F1/8! F2/8 C2/8 F2/8 |]x3
triangle: C2/8! C3/8 C3/8 G2/8 C2/8! C3/8 G2/8 C3/8 | D2/8! D3/8 D3/8 A2/8 D2/8! D3/8 A2/8 F#2/8
noise: c/8 h/8@0.3 t/8@0.5 h/8@0.3 s/4 t/8@0.5 t/8@0.4 | [k/8 h/8@0.3 t/8@0.5 h/8@0.3 s/4 t/8@0.5 t/8@0.4 |]x2
noise: k/8 h/8@0.3 t/8@0.5 h/8@0.3 s/8 s/8@0.5 t/8 t/8 | [k/8 h/8@0.3 t/8@0.5 h/8@0.3 s/4 t/8@0.5 t/8@0.4 |]x3
noise: k/8 h/8@0.3 t/8 t/8 s/16 s/16 s/16 s/16 s/8 s/8

section: A2
chords: G | F | G | F | C | C | D | D
// the lead takes the answers itself while pulse 2 echoes it
pulse1: G4/8 B4/8 D5/8 F5/4 E5/8 D5/4 | C5/4 A4/4 A4/8 C5/8 F5/4
pulse1: G4/8 B4/8 D5/8 F5/4 E5/8 D5/4 | C5/8 D5/8 C5/8 A4/8 r/8 C5/8 F5/4
pulse1: C5/8 E5/8 G5/8 A5/4 G5/8 E5/4 | E5/8 D5/8 C5/8 G4/4. r/4
pulse1: F#5/4. E5/8 D5/4 A4/4 | F#5/8 A5/8 F#5/8 D5/4. r/4
duty pulse2: 0.25
echo pulse2: pulse1 delay=0.75 level=0.45
triangle: [G1/8! G2/8 G3/8 G2/8 G1/8! G2/8 D3/8 G2/8 | F1/8! F2/8 F3/8 F2/8 F1/8! F2/8 C3/8 F2/8 |]x2
triangle: C2/8! C3/8 G2/8 C3/8 C2/8! C3/8 E3/8 C3/8 | C2/8! C3/8 G2/8 C3/8 C2/8! E2/8 F2/8 F#2/8
triangle: D2/8! D3/8 A2/8 D3/8 D2/8! D3/8 F#2/8 A2/8 | D2/8! D3/8 A2/8 D3/8 D2/8! A2/8 B2/8 C3/8
noise: c/8 h/8@0.3 t/8@0.5 o/8@0.3 s/8 h/8@0.3 t/8@0.5 h/8@0.3 | [k/8 h/8@0.3 t/8@0.5 o/8@0.3 s/8 h/8@0.3 t/8@0.5 h/8@0.3 |]x2
noise: k/8 h/8@0.3 t/8@0.5 o/8@0.3 s/8 t/8@0.5 s/16 s/16 t/8 | [k/8 h/8@0.3 t/8@0.5 o/8@0.3 s/8 h/8@0.3 t/8@0.5 h/8@0.3 |]x3
noise: k/8 t/8 t/8 t/8 s/16 s/16 s/16 s/16 s/8 s/8

section: B
chords: Em | C | G | D | Em | C | F | D
duty pulse1: 0.5
duty pulse2: voice
// long, short, long over the relative minor; the peak B5 comes in bar 5
pulse1: G5/4. E5/8 B4/2 | C5/4. D5/8 E5/2 | D5/4. C5/8 B4/2 | A4/2 r/2
pulse1: G5/4. A5/8 B5/2 | G5/4. E5/8 C5/2 | A5/4. G5/8 F5/4 C5/4 | F#5/2 r/2
pulse2: E4:037/4 r/8 E4:037/8 r/4 E4:037/8 r/8 | C4:047/4 r/8 C4:047/8 r/4 C4:047/8 r/8
pulse2: G3:047/4 r/8 G3:047/8 r/4 G3:047/8 r/8 | D4:047/4 r/4 F#4/8 A4/8 C5/8 A4/8
// then a counter-line that moves when the lead holds and holds when it moves
pulse2: E4/2 B3/8 D4/8 E4/8 G4/8 | G4/2 E4/8 D4/8 C4/8 E4/8
pulse2: F4/2 A4/2 | D4/4 F#4/4 A4/8 C5/8 D5/8 C5/8
// the bass walks in quarters, stepping into every next root
triangle: E2/4 B2/4 E3/4 D3/4 | C3/4 G2/4 E2/4 F2/4 | G2/4 D3/4 B2/4 C3/4 | D3/4 C3/4 A2/4 F#2/4
triangle: E2/4 G2/4 B2/4 D3/4 | C3/4 E3/4 G2/4 E2/4 | F2/4 A2/4 C3/4 E3/4 | D3/4 C3/4 A2/4 E2/4
noise: [k/4 h/8@0.3 h/8@0.3 s/4 o/4@0.3 |]x3 k/4 h/8@0.3 k/8 s/4 t/8 t/8 | [k/4 h/8@0.3 h/8@0.3 s/4 o/4@0.3 |]x3
noise: k/4 s/16 s/16 s/16 s/16 s/8 s/8 s/16 s/16 s/16 s/16

section: C
chords: Dm | C | Dm | C | Dm | C | F | F
duty pulse1: 0.125
duty pulse2: 0.5
// the pulses trade whole bars over the world motif in the bass
pulse1: A5/4 G5/8 F5/8 D5/4 r/4 | r/1 | F5/4 A5/8 F5/8 D5/4 r/4 | r/1
pulse1: F5/4 D5/8 F5/8 A5/4 r/4 | r/1 | C5/4 F5/4 A5/2 | A5/4 G5/4 F5/4 r/4
pulse2: r/1 | E5/4 D5/8 C5/8 G4/4 r/4 | r/1 | G4/8 C5/8 E5/8 G5/8 E5/4 r/4
pulse2: r/1 | C5/8 E5/8 G5/8 A5/4 G5/8 E5/4 | A4/2 C5/2 | F4/4 r/4 A4/4 r/4
triangle: D2/8 F2/8 A2/8 G2/4 r/8 D2/4 | C2/8 E2/8 G2/8 F2/4 r/8 C2/4
triangle: D2/8 F2/8 A2/8 G2/4 r/8 D2/4 | C2/8 E2/8 G2/8 F2/4 r/8 C2/4
triangle: D2/8 F2/8 A2/8 G2/4 r/8 D2/4 | C2/8 E2/8 G2/8 F2/4 r/8 C2/4
triangle: F2/8 A2/8 C3/8 A2/4 r/8 F2/4 | F2/4 C2/4 D2/4 E2/8 F2/8
noise: [k/8 t/8@0.5 t/8@0.4 h/8@0.3 s/8 t/8@0.5 t/8@0.4 h/8@0.3 |]x3 k/8 t/8@0.5 t/8@0.4 h/8@0.3 s/8 s/8@0.5 t/8 t/8
noise: [k/8 t/8@0.5 t/8@0.4 h/8@0.3 s/8 t/8@0.5 t/8@0.4 h/8@0.3 |]x3 k/8 t/8 t/8 t/8 s/16 s/16 s/16 s/16 s/8 s/8

section: breakdown
chords: G | F | G | F
duty pulse2: 0.25
// the lead rests; triangle kicks and toms under short four-note arpeggio bursts
pulse2: G3:047c/8 r/8 r/4 G3:047c/8 r/8 r/4 | F3:047c/8 r/8 r/4 F3:047c/8 r/8 r/4
pulse2: G3:047c/8 r/8 G3:047c/8 r/8 r/4 G3:047c/8 r/8 | F3:047c/8 r/8 F3:047c/8 r/8 F3:047c/8 F3:047c/8 F3:047c/8 F3:047c/8
triangle: G1/8! r/8 G2/4 G3/8! r/8 G2/4 | F1/8! r/8 F2/4 F3/8! r/8 F2/4
triangle: G1/8! r/8 G2/4 G3/8! r/8 G2/4 | F1/8! F2/8 C3/8! F2/8 A3/8! F2/8 C4/8! F2/8
noise: [k/4 t/8@0.5 t/8@0.4 s/4 t/8@0.5 t/8@0.4 |]x3 t/8 t/8 t/8 t/8 s/16 s/16 s/16 s/16 s/8 s/8

section: turnaround
chords: Eb | F | Eb | F
duty pulse1: 0.5
duty pulse2: voice
// the borrowed bVI and bVII climb back to G
pulse1: G5/4. F5/8 Eb5/2 | F5/4. G5/8 A5/2 | Bb5/4. G5/8 Eb5/4 G5/4 | A5/4 F5/4 C5/4 r/4
pulse2: Eb4/4 G4/4 Bb4/4 G4/4 | F4/4 A4/4 C5/4 A4/4 | Eb4/8 G4/8 Bb4/8 G4/8 Eb4/8 G4/8 Bb4/8 G4/8 | F4/8 A4/8 C5/8 A4/8 r/2
triangle: Eb2/4 Eb3/4 Eb2/4 Bb2/4 | F2/4 F3/4 F2/4 C3/4 | Eb2/8 Eb3/8 Eb2/8 Eb3/8 Eb2/8 Eb3/8 Bb2/8 Eb3/8 | F2/4 F3/4 F2/8 A2/8 C3/8 E3/8
noise: c/8 h/8@0.3 s/8@0.5 h/8@0.3 k/8 h/8@0.3 s/8@0.6 h/8@0.3 | k/8 h/8@0.3 s/8@0.6 h/8@0.3 k/8 s/8@0.7 s/8@0.7 h/8@0.3
noise: k/8 s/8@0.6 k/8 s/8@0.7 k/8 s/8@0.8 k/8 s/8@0.8 | [s/16@0.6 s/16@0.8]x4 t/8 t/8 t/8 t/8
`;

/** "Bramble Stomp", Thornwood's second race track, parsed. */
export const thornwoodTwo: Song = parseSong(source);
