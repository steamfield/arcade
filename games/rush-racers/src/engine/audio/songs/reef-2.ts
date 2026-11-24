/**
 * "Tidepool Hop", track 2 of the Reef set: C major with lydian touches (the major II, D, over
 * the tonic), 6/8, 132 BPM to the quarter note, so the dotted quarter swings at 88. Lilting and
 * playful: a round 50% lead, rolling arpeggios and light drums.
 *
 * Form: intro (2 bars) | A (8) | A' (8) | B (8) | C (8) | breakdown (4) | B' (8) |
 * turnaround (4), looping from the turnaround back to A. The loop is 48 bars, about 65 s.
 *
 * Chords:
 * - intro: C | G7
 * - A: C | Am | F | G | C | Am | D | G (hook, answer, hook, a lydian D on the way home)
 * - A': C | Am | F | G | C | Am | F | G (a higher answer and a climb to C6)
 * - B: Am | Em | F | C | Dm | Bb | F | G (the relative minor and a borrowed bVII)
 * - C: C | D | C | D | Am | D | F | G (the lydian I-II rock)
 * - breakdown: F | G | F | E (the lead rests; E is the dominant of the A minor that follows)
 * - B': Am | Em | F | C | Dm | Bb | F | C
 * - turnaround: Dm | Bb | D | G, a ii-bVII-V/V-V climb back to C
 *
 * The hook (A, bars 1-2) is "E~ D C E G | A~~ (rest) G E": a long-short 6/8 bounce down to the
 * tonic and up to the peak A, a breath, then a pickup back down.
 *
 * Voices: the lead is a 50% pulse, a 25% one in B for the long notes and a thin 12.5% one in C.
 * Pulse 2 rolls slow eighth-note arpeggios in A, echoes the lead half a bar later in A' and B',
 * carries the world motif in B (moving where the lead holds), and plays short arpeggio bursts in C
 * and the breakdown.
 * The triangle bounces root, fifth and octave, with pitch-drop kicks in A', B' and the breakdown.
 * Drums are light: hats on the off-eighths, half-time in B, open hats in C and toms in the breakdown.
 *
 * World motif: the Reef hook's opening "B A B D" (down a step, back, up a minor third, in three
 * eighths and a quarter) becomes pulse 2's counter-line through B ("A G A C", "E D E G") and the
 * bass of the turnaround's first bar ("D C D F").
 */
import { parseSong, type Song } from '../notation.ts';

const source = `
name: reef-2
title: Tidepool Hop
tempo: 132
time: 6/8
key: C major
loop: A

voice pulse1: duty=0.5 level=0.5 attack=0.01 decay=0.12 sustain=0.65 release=0.1
voice pulse2: duty=0.25 level=0.3 attack=0.005 decay=0.1 sustain=0.4 release=0.06
voice triangle: level=0.65 attack=0.002 decay=0.05 sustain=0.9 release=0.04
voice noise: level=0.3 attack=0.001 decay=0.06 sustain=0 release=0.02

section: intro
chords: C | G7
pulse2: C4/8@0.8 E4/8@0.8 G4/8@0.8 E4/8@0.8 G4/8@0.8 E4/8@0.8 | G3/8@0.8 B3/8@0.8 D4/8@0.8 B3/8@0.8 D4/8@0.8 F4/8@0.8
triangle: C2/4 G2/8 C3/4 G2/8 | G2/4 D3/8 G3/4 D3/8
noise: k/8 h/8@0.3 h/8@0.3 s/8 h/8@0.3 h/8@0.3 | k/8 h/8@0.3 s/16 s/16 s/8 s/16 s/16 s/8

section: A
chords: C | Am | F | G | C | Am | D | G
// hook, answer
pulse1: E5/4 D5/8 C5/8 E5/8 G5/8 | A5/4. r/8 G5/8 E5/8 | F5/4 E5/8 D5/8 C5/8 A4/8 | B4/4. r/8 A4/8 B4/8
// hook, the lydian way home
pulse1: E5/4 D5/8 C5/8 E5/8 G5/8 | A5/4. r/8 G5/8 E5/8 | F#5/4 E5/8 D5/8 E5/8 F#5/8 | G5/4. r/4.
// slow rolling arpeggios
pulse2: C4/8@0.8 E4/8@0.8 G4/8@0.8 E4/8@0.8 G4/8@0.8 E4/8@0.8 | A3/8@0.8 C4/8@0.8 E4/8@0.8 C4/8@0.8 E4/8@0.8 C4/8@0.8
pulse2: F3/8@0.8 A3/8@0.8 C4/8@0.8 A3/8@0.8 C4/8@0.8 A3/8@0.8 | G3/8@0.8 B3/8@0.8 D4/8@0.8 B3/8@0.8 D4/8@0.8 B3/8@0.8
pulse2: C4/8@0.8 E4/8@0.8 G4/8@0.8 E4/8@0.8 G4/8@0.8 E4/8@0.8 | A3/8@0.8 C4/8@0.8 E4/8@0.8 C4/8@0.8 E4/8@0.8 C4/8@0.8
pulse2: F#3/8@0.8 A3/8@0.8 D4/8@0.8 A3/8@0.8 D4/8@0.8 A3/8@0.8 | G3/8@0.8 B3/8@0.8 D4/8@0.8 B3/8@0.8 D4/8@0.8 F4/8@0.8
triangle: C2/4 G2/8 C3/4 G2/8 | A1/4 E2/8 A2/4 E2/8 | F2/4 C3/8 F3/4 C3/8 | G2/4 D3/8 G3/4 D3/8
triangle: C2/4 G2/8 C3/4 G2/8 | A1/4 E2/8 A2/4 E2/8 | D2/4 A2/8 D3/4 A2/8 | G2/4 D3/8 G2/8 A2/8 B2/8
noise: [k/8 h/8@0.3 h/8@0.3 s/8 h/8@0.3 h/8@0.3 |]x7 k/8 h/8@0.3 s/16 s/16 s/8 s/16 s/16 s/8

section: A'
chords: C | Am | F | G | C | Am | F | G
// hook, higher answer
pulse1: E5/4 D5/8 C5/8 E5/8 G5/8 | A5/4. r/8 G5/8 E5/8 | A5/4 G5/8 F5/8 E5/8 C5/8 | D5/4. r/8 B4/8 D5/8
// hook, climb to C6 and down
pulse1: E5/4 D5/8 C5/8 E5/8 G5/8 | A5/4. r/8 B5/8 C6/8 | C6/4 A5/8 F5/4. | G5/4. r/8 F5/8 D5/8
echo pulse2: pulse1 delay=1.5 level=0.8
triangle: C2/16! C2/8. G2/8 C3/4 G2/8 | A1/16! A1/8. E2/8 A2/4 E2/8 | F2/16! F2/8. C3/8 F3/4 C3/8 | G2/16! G2/8. D3/8 G3/4 D3/8
triangle: C2/16! C2/8. G2/8 C3/4 G2/8 | A1/16! A1/8. E2/8 A2/4 E2/8 | F2/16! F2/8. C3/8 F3/4 C3/8 | G2/4 D3/8 G2/8 F2/8 E2/8
noise: c/8 h/8@0.3 h/8@0.3 s/8 h/8@0.3 k/8 | [k/8 h/8@0.3 h/8@0.3 s/8 h/8@0.3 k/8 |]x6 k/8 s/16 s/16 s/8 s/16 s/16 s/8 s/8

section: B
chords: Am | Em | F | C | Dm | Bb | F | G
// long notes on a 25% duty; pulse 2 carries the world motif under them
duty pulse1: 0.25
pulse1: E5/4. C5/4. | B4/2.v | C5/4. A4/8 C5/8 F5/8 | E5/2.
pulse1: D5/4. F5/4. | D5/2.v | C5/4. A4/4. | B4/4. r/4.
// the motif moves where the lead holds, and holds where the lead moves
pulse2: C4/2. | E4/8 D4/8 E4/8 G4/4 r/8 | A3/2. | E4/8 D4/8 E4/8 G4/4 r/8
pulse2: A3/2. | D4/8 C4/8 D4/8 F4/4 r/8 | C4/4. A3/4. | B3/8 A3/8 B3/8 D4/4 r/8
triangle: A2/4. E2/4. | E2/4. B2/4. | F2/4. C3/4. | C3/4. G2/4.
triangle: D3/4. A2/4. | Bb2/4. F2/4. | F2/4. C3/4. | G2/4. D3/4.
noise: [k/4 h/8@0.25 s/4 h/8@0.25 |]x7 k/4 h/8@0.25 s/16 s/16 s/16 s/16 s/8

section: C
chords: C | D | C | D | Am | D | F | G
// the lydian rock: a thin, high lead over arpeggio bursts, off-beat stabs and an eighth-note bounce
duty pulse1: 0.125
pulse1: E5/4 G5/8 C6/4. | A5/4 F#5/8 D5/4. | E5/4 G5/8 C6/8 B5/8 G5/8 | F#5/4. r/4.
pulse1: C6/4 B5/8 A5/8 E5/8 C5/8 | D5/4 F#5/8 A5/4 F#5/8 | A5/4. C6/4. | B5/4 r/8 G5/8 F5/8 D5/8
pulse2: C4:047/4 r/8 G4/8 r/4 | D4:047/4 r/8 A4/8 r/4 | C4:047/4 r/8 G4/8 r/4 | D4:047/4 r/8 F#4/8 r/4
pulse2: A3:037/4 r/8 E4/8 r/4 | D4:047/4 r/8 A4/8 r/4 | F4:047/4 r/8 C5/8 r/4 | G3:047/4 r/8 D4/8 r/4
triangle: C2/8 C3/8 G2/8 C3/8 G2/8 C3/8 | D2/8 D3/8 A2/8 D3/8 A2/8 D3/8 | C2/8 C3/8 G2/8 C3/8 G2/8 C3/8 | D2/8 D3/8 A2/8 D3/8 A2/8 D3/8
triangle: A1/8 A2/8 E2/8 A2/8 E2/8 A2/8 | D2/8 D3/8 A2/8 D3/8 A2/8 D3/8 | F2/8 F3/8 C3/8 F3/8 C3/8 F3/8 | G2/8 G3/8 D3/8 G3/8 F3/8 D3/8
noise: c/8 h/8@0.3 o/8@0.25 s/8 h/8@0.3 o/8@0.25 | [k/8 h/8@0.3 o/8@0.25 s/8 h/8@0.3 o/8@0.25 |]x6 k/8 s/16 s/16 s/16 s/16 s/8 s/16 s/16 s/8

section: breakdown
chords: F | G | F | E
// the lead rests; arpeggio chords climb and fall over kicked bass and toms
duty pulse1: voice
pulse2: F4:047/8 r/8 A4:038/8 r/8 C5:059/8 r/8 | G4:047/8 r/8 B4:038/8 r/8 D5:059/8 r/8
pulse2: C5:059/8 r/8 A4:038/8 r/8 F4:047/8 r/8 | E4:047/8 r/8 G#4:038/8 r/8 B4:059/8 r/8
triangle: F2/8! F2/4 C3/4. | G2/8! G2/4 D3/4. | F2/8! F2/4 C3/4. | E2/8! E2/4 B2/8 G#2/8 B2/8
noise: [k/8 t/8 r/8 t/8 h/8@0.25 t/8 |]x3 k/8 t/16 t/16 s/16 s/16 s/16 s/16 t/16 t/16 s/8

section: B'
chords: Am | Em | F | C | Dm | Bb | F | C
// B's long notes on the round duty, with an echo in place of the counter-line
pulse1: E5/4. C5/4. | B4/2.v | C5/4. A4/8 C5/8 F5/8 | E5/2.
pulse1: D5/4. F5/4. | D5/2.v | C5/4. F5/4. | E5/4. r/4.
echo pulse2: pulse1 delay=1.5 level=0.7
triangle: A2/16! A2/8. E2/8 A2/4 E2/8 | E2/16! E2/8. B2/8 E3/4 B2/8 | F2/16! F2/8. C3/8 F3/4 C3/8 | C3/16! C3/8. G2/8 C3/4 G2/8
triangle: D3/16! D3/8. A2/8 D3/4 A2/8 | Bb2/16! Bb2/8. F2/8 Bb2/4 F2/8 | F2/16! F2/8. C3/8 F3/4 C3/8 | C3/4 G2/8 E2/8 D2/8 C2/8
noise: c/8 h/8@0.3 k/8 s/8 h/8@0.3 k/8 | [k/8 h/8@0.3 k/8 s/8 h/8@0.3 o/8@0.25 |]x6 k/8 s/16 s/16 s/8 s/16 s/16 s/16 s/16 s/8

section: turnaround
chords: Dm | Bb | D | G
// the bass states the world motif, then climbs through the lydian D to G
pulse1: F5/4 E5/8 D5/8 F5/8 A5/8 | F5/4 D5/8 Bb4/4 D5/8 | F#5/4 E5/8 F#5/8 A5/8 F#5/8 | G5/4. F5/8 D5/8 B4/8
pulse2: A4/4. F4/4. | D4/4. F4/4. | A4/4. F#4/4. | B4/4. G4/4.
triangle: D3/8 C3/8 D3/8 F3/4 D3/8 | Bb2/4. F2/4. | D3/4. A2/4. | G2/8 G2/8 A2/8 B2/8 D3/8 F3/8
noise: [k/8 h/8@0.3 h/8@0.3 s/8 h/8@0.3 k/8 |]x3 k/16 k/16 s/16 s/16 s/16 s/16 s/16 s/16 c/4
`;

/** "Tidepool Hop", track 2 of the Reef set, parsed. */
export const reefTwo: Song = parseSong(source);
