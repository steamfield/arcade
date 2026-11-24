/**
 * "Riptide", track 3 of the Reef set and its fast one: E minor, 4/4, 160 BPM. An octave bass
 * that never lets up, a bVI-bVII-i drive and a major-key release in B.
 *
 * Form: intro (2 bars) | A (8) | A' (8) | B (8) | C (8) | breakdown (4) | A'' (8) |
 * turnaround (4), looping from the turnaround back to A. The loop is 48 bars, 72 s.
 *
 * Chords:
 * - intro: Em | C D
 * - A: Em | C | D | Em | Em | C | Am | B7 (call, falling answer, call, a harmonic-minor B7 home)
 * - A': Em | C | D | Em | C | D | Em | D (the second half climbs over bVI-bVII and lands on D)
 * - B: G | D | Em | C | G | D | C | D (the release into the relative major: held notes in a
 *   rising sequence that peaks on A5)
 * - C: C | D | Em | Em | C | D | B | B (bVI-bVII-i; the pulses trade)
 * - breakdown: Em | C | Am | B (drums and bass, then arpeggio chords)
 * - A'': as A, with a new climb in the last two bars
 * - turnaround: C | D | B7 | B7, bVI-bVII-V falling into A
 *
 * The hook (A, bars 1-2) is "E E-E G B~ A G F# | G E (rest) B D E": a stuttered tonic, a leap
 * to the peak B held across beat 3, a run down, then a pickup back into the next call. The
 * answer keeps the call's rhythm and falls from A5 instead of rising.
 *
 * Voices: the lead is a 25% pulse, a round 50% one for the B release and a thin 12.5% one in C.
 * Pulse 2 chugs in a 3-3-2 rhythm in A, its short third hit stepping so the chug carries a line,
 * echoes the lead an off-beat later in A', plays arpeggio bursts in B and the breakdown, states
 * the world motif in C (on a 25% duty, with the lead's answers played softer so the two trade as
 * equals) and in the turnaround, and harmonises the hook in A'' with a slow counter-line under
 * its first answer. In C the lead answers the motif upside down (up a step, back, down a third:
 * "G A G E", "A B A F#", "B C B G"), climbing bar by bar to D6. In the turnaround the lead climbs
 * a step per bar in the hook's stuttered rhythm ("G G G A C", "A A A B D"). The triangle bounces
 * in octaves (with pitch-drop kicks in A' and the breakdown, and a walk through C's second E
 * minor bar), walks in B and gallops in sixteenths in A''. Drums: a crash opening A, A', C and
 * A'', open hats in A' and C, a half-time B, toms in the breakdown, sixteenth hats in A''.
 *
 * World motif: the Reef hook's opening "B A B D" (down a step, back, up a minor third, in three
 * eighths and a quarter) is the bass's pickup in bar 4 of A and A' ("E D E G"), the pulse 2 riff
 * that opens every bar of C ("E D E G", "F# E F# A", and once at the hook's own pitch, "B A B D")
 * with the lead answering it, and the first two bars of pulse 2 in the turnaround.
 */
import { parseSong, type Song } from '../notation.ts';

const source = `
name: reef-3
title: Riptide
tempo: 160
time: 4/4
key: E minor
loop: A

voice pulse1: duty=0.25 level=0.5 attack=0.003 decay=0.08 sustain=0.6 release=0.05
voice pulse2: duty=0.125 level=0.3 attack=0.003 decay=0.06 sustain=0.45 release=0.04
voice triangle: level=0.65 attack=0.002 decay=0.04 sustain=0.9 release=0.03
voice noise: level=0.3 attack=0.001 decay=0.06 sustain=0 release=0.02

section: intro
chords: Em | C D
pulse2: r/1 | C4:047/8 r/8 C4:047/8 r/8 D4:047/8 r/8 D4:047/16 D4:047/16 D4:047/8
triangle: [E2/8 E3/8]x4 | [C2/8 C3/8]x2 [D2/8 D3/8]x2
noise: [k/8 h/16@0.3 h/16@0.3 s/8 h/16@0.3 h/16@0.3]x2 | k/8 h/8@0.4 s/16 s/16 s/16 s/16 k/16 k/16 s/16 s/16 s/16 s/16 s/8

section: A
chords: Em | C | D | Em | Em | C | Am | B7
// call, falling answer
pulse1: E5/8 E5/16 E5/16 G5/8 B5/4 A5/8 G5/8 F#5/8 | G5/4 E5/4 r/8 B4/8 D5/8 E5/8
pulse1: A5/8 A5/16 A5/16 F#5/8 D5/4 E5/8 F#5/8 A5/8 | G5/4. F#5/8 E5/4 r/4
// call, harmonic-minor ending
pulse1: E5/8 E5/16 E5/16 G5/8 B5/4 A5/8 G5/8 F#5/8 | G5/4 E5/4 r/8 B4/8 D5/8 E5/8
pulse1: C6/8 C6/16 C6/16 B5/8 A5/4 G5/8 F#5/8 E5/8 | D#5/4 F#5/4 B5/4 r/4
// a 3-3-2 chug whose short third hit steps, so the chug carries a line of its own
pulse2: G4/8.@0.7 G4/8.@0.7 F#4/8@0.7 G4/8.@0.7 G4/8.@0.7 B4/8@0.7 | G4/8.@0.7 G4/8.@0.7 E4/8@0.7 E4/8.@0.7 E4/8.@0.7 D4/8@0.7
pulse2: F#4/8.@0.7 F#4/8.@0.7 E4/8@0.7 F#4/8.@0.7 F#4/8.@0.7 A4/8@0.7 | G4/8.@0.7 G4/8.@0.7 F#4/8@0.7 E4/8.@0.7 E4/8.@0.7 D4/8@0.7
pulse2: B4/8.@0.7 B4/8.@0.7 A4/8@0.7 G4/8.@0.7 G4/8.@0.7 F#4/8@0.7 | G4/8.@0.7 G4/8.@0.7 E4/8@0.7 E4/8.@0.7 E4/8.@0.7 G4/8@0.7
pulse2: A4/8.@0.7 A4/8.@0.7 B4/8@0.7 C5/8.@0.7 C5/8.@0.7 B4/8@0.7 | F#4/8.@0.7 F#4/8.@0.7 A4/8@0.7 B4/8.@0.7 B4/8.@0.7 A4/8@0.7
triangle: [E2/8 E3/8]x4 | [C2/8 C3/8]x4 | [D2/8 D3/8]x4 | E2/8 E3/8 E2/8 E3/8 D3/8 E3/8 G3/4
triangle: [E2/8 E3/8]x4 | [C2/8 C3/8]x4 | [A1/8 A2/8]x4 | B1/8 B2/8 B1/8 B2/8 A2/8 B2/8 C3/8 D#3/8
noise: c/8 h/8@0.4 s/8 h/8@0.4 k/8 h/8@0.4 s/8 h/8@0.4 | [k/8 h/8@0.4 s/8 h/8@0.4 k/8 h/8@0.4 s/8 h/8@0.4 |]x6
noise: k/8 h/8@0.4 s/8 h/8@0.4 s/16 s/16 s/16 s/16 s/16 s/16 s/8

section: A'
chords: Em | C | D | Em | C | D | Em | D
// call, falling answer, then the call climbs over bVI-bVII
pulse1: E5/8 E5/16 E5/16 G5/8 B5/4 A5/8 G5/8 F#5/8 | G5/4 E5/4 r/8 B4/8 D5/8 E5/8
pulse1: A5/8 A5/16 A5/16 F#5/8 D5/4 E5/8 F#5/8 A5/8 | G5/4. F#5/8 E5/4 r/4
pulse1: E5/8 E5/16 E5/16 G5/8 C6/4 B5/8 A5/8 G5/8 | A5/4 F#5/4 r/8 D5/8 E5/8 F#5/8
pulse1: G5/8 G5/16 G5/16 B5/8 C6/4 B5/8 A5/8 G5/8 | A5/4. F#5/8 D5/4 r/4
echo pulse2: pulse1 delay=0.75 level=0.8
triangle: E2/8! E3/8 [E2/8 E3/8]x3 | C2/8! C3/8 [C2/8 C3/8]x3 | D2/8! D3/8 [D2/8 D3/8]x3 | E2/8! E3/8 E2/8 E3/8 D3/8 E3/8 G3/4
triangle: C2/8! C3/8 [C2/8 C3/8]x3 | D2/8! D3/8 [D2/8 D3/8]x3 | E2/8! E3/8 [E2/8 E3/8]x3 | [D2/8 D3/8]x3 E2/8 F#2/8
noise: c/8 h/8@0.4 s/8 k/8 k/8 h/8@0.4 s/8 o/8@0.3 | [k/8 h/8@0.4 s/8 k/8 k/8 h/8@0.4 s/8 o/8@0.3 |]x6
noise: k/8 h/8@0.4 s/8 k/8 s/16 s/16 s/16 s/16 s/8 s/8

section: B
chords: G | D | Em | C | G | D | C | D
// the release: long notes on a round duty, arpeggio bursts under them
duty pulse1: 0.5
// a rising sequence of held notes, each tipped over by two eighths, peaking on A5
pulse1: D5/2. B4/8 D5/8 | F#5/2. E5/8 D5/8 | E5/2. D5/8 B4/8 | C5/2. r/4
pulse1: D5/2. B4/8 D5/8 | A5/2.v G5/8 F#5/8 | G5/2 E5/2 | F#5/1v
pulse2: G3:047/8 r/8 r/4 G3:047/8 r/8 r/4 | A3:059/8 r/8 r/4 A3:059/8 r/8 r/4 | G3:049/8 r/8 r/4 G3:049/8 r/8 r/4 | G3:059/8 r/8 r/4 G3:059/8 r/8 G3:059/8 r/8
pulse2: G3:047/8 r/8 r/4 G3:047/8 r/8 r/4 | A3:059/8 r/8 r/4 A3:059/8 r/8 r/4 | G3:059/8 r/8 r/4 G3:059/8 r/8 r/4 | A3:059/8 r/8 A3:059/8 r/8 A3:059/8 r/8 A3:059/8 r/8
triangle: G2/4 B2/4 D3/4 B2/4 | D2/4 F#2/4 A2/4 F#2/4 | E2/4 G2/4 B2/4 G2/4 | C3/4 E3/4 G3/4 E3/4
triangle: G2/4 B2/4 D3/4 B2/4 | D2/4 F#2/4 A2/4 F#2/4 | C3/4 G2/4 E2/4 G2/4 | D2/4 F#2/4 A2/4 B2/4
noise: [k/8 h/8@0.4 h/8@0.4 h/8@0.4 s/8 h/8@0.4 h/8@0.4 h/8@0.4 |]x7 k/8 h/8@0.4 h/8@0.4 h/8@0.4 s/16 s/16 s/16 s/16 s/8 s/8

section: C
chords: C | D | Em | Em | C | D | B | B
// pulse 2 states the world motif at the top of each bar (down a step, back, up a third); the thin
// lead answers with it upside down (up a step, back, down a third), climbing bar by bar
duty pulse1: 0.125
duty pulse2: 0.25
// the answers are played softer so the riff on the quieter pulse comes through
pulse1: r/2 r/8 G5/16@0.75 A5/16@0.75 G5/8@0.75 E5/8@0.75 | r/2 r/8 A5/16@0.75 B5/16@0.75 A5/8@0.75 F#5/8@0.75
pulse1: r/2 r/8 B5/16@0.75 C6/16@0.75 B5/8@0.75 G5/8@0.75 | r/2 G5/8@0.75 A5/8@0.75 B5/8@0.75 D6/8@0.75
pulse1: r/2 r/8 C6/16@0.8 D6/16@0.8 C6/8@0.8 G5/8@0.8 | r/2 r/8 D6/16@0.8 C6/16@0.8 A5/8@0.8 F#5/8@0.8 | B5/4. A5/8 F#5/4 D#5/4 | B5/2 r/8 F#5/8 G5/8 A5/8
pulse2: E4/8 D4/8 E4/8 G4/4 r/4. | F#4/8 E4/8 F#4/8 A4/4 r/4. | E4/8 D4/8 E4/8 G4/4 r/4. | B3/8 A3/8 B3/8 D4/4 r/4.
pulse2: E4/8 D4/8 E4/8 G4/4 r/4. | F#4/8 E4/8 F#4/8 A4/4 r/4. | F#4/8 E4/8 F#4/8 A4/4 r/4. | F#4/8 E4/8 F#4/8 A4/8 B4/4 r/4
// the octave bounce walks down and back up through the second E minor bar into C
triangle: [C2/8 C3/8]x4 | [D2/8 D3/8]x4 | [E2/8 E3/8]x4 | E2/8 E3/8 E2/8 D3/8 B2/8 G2/8 A2/8 B2/8
triangle: [C2/8 C3/8]x4 | [D2/8 D3/8]x4 | [B1/8 B2/8]x4 | [B1/8 B2/8]x3 C3/8 D#3/8
noise: c/8 o/8@0.3 s/8 h/8@0.4 k/8 k/8 s/8 o/8@0.3 | [k/8 o/8@0.3 s/8 h/8@0.4 k/8 k/8 s/8 o/8@0.3 |]x6
noise: k/8 o/8@0.3 s/8 k/8 s/16 s/16 s/16 s/16 s/16 s/16 s/16 s/16

section: breakdown
chords: Em | C | Am | B
// the lead rests: two bars of drums and kicked bass, then arpeggio chords build back in
duty pulse1: voice
duty pulse2: voice
pulse2: r/1 | r/1 | A3:037/8 r/8 A3:037/8 r/8 r/2 | B3:047/8 r/8 B3:047/8 r/8 B3:047/16 B3:047/16 B3:047/16 B3:047/16 B3:047/8 r/8
triangle: [E2/8! E3/8 E2/8 E3/8]x2 | [C2/8! C3/8 C2/8 C3/8]x2 | [A1/8! A2/8 A1/8 A2/8]x2 | [B1/8! B2/8 B1/8 B2/8]x2
noise: [k/8 r/8 t/8 t/8 k/8 r/8 t/16 t/16 t/8 |]x3 k/8 t/16 t/16 s/16 s/16 t/16 t/16 s/16 s/16 s/16 s/16 s/8 s/8

section: A''
chords: Em | C | D | Em | Em | C | Am | B7
// the hook harmonised from below over a galloping bass; the answer gets a slow counter-line instead
pulse1: E5/8 E5/16 E5/16 G5/8 B5/4 A5/8 G5/8 F#5/8 | G5/4 E5/4 r/8 B4/8 D5/8 E5/8
pulse1: A5/8 A5/16 A5/16 F#5/8 D5/4 E5/8 F#5/8 A5/8 | G5/4. F#5/8 E5/4 r/4
pulse1: E5/8 E5/16 E5/16 G5/8 B5/4 A5/8 G5/8 F#5/8 | G5/4 E5/4 r/8 B4/8 D5/8 E5/8
pulse1: A5/8 A5/16 A5/16 C6/8 B5/4 A5/8 G5/8 E5/8 | F#5/4 A5/4 B5/4. r/8
pulse2: B4/8 B4/16 B4/16 E5/8 G5/4 F#5/8 E5/8 D5/8 | E5/4 C5/4 r/8 G4/8 B4/8 C5/8
pulse2: F#4/2 A4/2 | B4/4. A4/8 G4/4 B4/4
pulse2: B4/8 B4/16 B4/16 E5/8 G5/4 F#5/8 E5/8 D5/8 | E5/4 C5/4 r/8 G4/8 B4/8 C5/8
pulse2: E5/8 E5/16 E5/16 E5/8 G5/4 F#5/8 E5/8 C5/8 | D#5/4 F#5/4 F#5/4. r/8
triangle: [E2/8 E3/16 E3/16]x4 | [C2/8 C3/16 C3/16]x4 | [D2/8 D3/16 D3/16]x4 | [E2/8 E3/16 E3/16]x4
triangle: [E2/8 E3/16 E3/16]x4 | [C2/8 C3/16 C3/16]x4 | [A1/8 A2/16 A2/16]x4 | B1/8 B2/16 B2/16 B1/8 B2/16 B2/16 B1/8 A2/8 B1/8 B2/8
noise: c/8 h/16@0.3 h/16@0.3 s/8 h/16@0.3 h/16@0.3 k/8 h/16@0.3 h/16@0.3 s/8 h/16@0.3 h/16@0.3 | [[k/8 h/16@0.3 h/16@0.3 s/8 h/16@0.3 h/16@0.3]x2 |]x6
noise: k/8 h/16@0.3 h/16@0.3 s/8 k/8 s/16 s/16 s/16 s/16 s/16 s/16 s/8

section: turnaround
chords: C | D | B7 | B7
// bVI-bVII-V: the lead climbs a step per bar in the hook's stuttered rhythm while pulse 2 restates the motif
pulse1: G5/8 G5/16 G5/16 A5/8 C6/4 B5/8 A5/8 G5/8 | A5/8 A5/16 A5/16 B5/8 D6/4 C6/8 B5/8 A5/8
pulse1: B5/4 A5/8 F#5/8 D#5/4 F#5/4 | B5/2. r/4
pulse2: E4/8 D4/8 E4/8 G4/4 r/4. | F#4/8 E4/8 F#4/8 A4/4 r/4. | D#4/4 F#4/4 A4/4 F#4/4 | B3/8 D#4/8 F#4/8 A4/8 B4/4 r/4
triangle: [C2/8 C3/8]x4 | [D2/8 D3/8]x4 | [B1/8 B2/8]x4 | B1/8 B2/8 B1/8 B2/8 A2/8 G2/8 F#2/8 D#2/8
noise: [k/8 h/8@0.4 s/8 h/8@0.4 k/8 k/8 s/8 h/8@0.4 |]x2 k/8 h/8@0.4 s/8 k/8 k/8 s/8 s/8 s/8 | k/8 s/16 s/16 k/8 s/16 s/16 s/16 s/16 s/16 s/16 t/8 t/8
`;

/** "Riptide", track 3 of the Reef set, parsed. */
export const reefThree: Song = parseSong(source);
