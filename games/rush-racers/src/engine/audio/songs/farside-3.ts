/**
 * Farside's third race track, "Event Horizon": F# minor in 4/4 at 126 BPM, the uneasy one, racing
 * past a black hole. Suspended fourths that hang instead of resolving, an F# pedal under the
 * bridge, whole-tone runs over a bVI7, and only one true dominant, at the very end of the loop.
 *
 * Form: intro (2 bars, outside the loop) | A (8) | A' (8) | B (8) | C (8) | breakdown (4) |
 * turnaround (4). The loop is 40 bars, about 76 seconds, from A.
 *
 * Chords:
 * - intro: F#sus4 | F#m
 * - A: F#m | D | Bm | C#sus4 | F#m | D | E | C#sus4 (i, bVI, iv and a V that keeps its fourth)
 * - A': F#m | D | Bm | C#sus4 | F#m | D | A | C# (the major V at last, which B dodges)
 * - B: D | E | Bm | C#sus4 | D7 | E | D7 | C# (a deceptive start on bVI; the D7 bars carry
 *   whole-tone runs, D E F# G# A# C, up and then down)
 * - C: F#m | F#sus4 | F#m | F#sus4 | D | E | D | E (an F# pedal under the pulses trading
 *   phrases, then bVI and bVII with the hook's rhythm back in the lead)
 * - breakdown: F#sus4 | F#m | F#sus4 | F#m
 * - turnaround: D | C# | D | C# (bVI to V, the one cadence that lands, back into A)
 *
 * The hook is A's first two bars: C#5 F#5 B5 A5, E5 | F#5 held. Two rising fourths reach for the
 * suspended B5, which sinks a step to A5; a rest, a pickup, and a held note that answers it. The
 * held answers climb across A (F#5, G#5, A5) before the phrase drops to C#5.
 *
 * Voices: the lead is a 25% pulse in A and A', a thin 12.5% in B, where it holds long notes and
 * runs the whole-tone scale, and a round 50% in C, where its long notes slide down a semitone.
 * Pulse 2 pulses eighths on the chord tones under the lead in A, plays suspended arpeggio bursts in
 * A' and the breakdown, echoes the lead three sixteenths later in B, and trades phrases with the
 * lead over the pedal in C before holding long notes under it. The triangle pulses root, fifth and octave with a pitch-dropped kick
 * on each bar, holds half notes in B, sits on the F# pedal in C and drops out to sparse kicks in
 * the breakdown. The drums keep kick and snare with hats in A, add sixteenth hats, open hats and a
 * crash in A', go half time with toms in B, thin to a kick and open hats in C, turn to toms in the
 * breakdown and build a snare roll in the turnaround, with a fill at the end of every section.
 *
 * The world's motif: Far Light's opening cell, a held note that falls a minor third and steps up
 * a tone (dotted half, quarter, whole), is the bass of the turnaround, D2 B1 C#2, twice.
 */
import { parseSong, type Song } from '../notation.ts';

const source = `
name: farside-3
title: Event Horizon
tempo: 126
time: 4/4
key: F# minor
loop: A

voice pulse1: duty=0.25 level=0.48 attack=0.005 decay=0.12 sustain=0.7 release=0.12
voice pulse2: duty=0.5 level=0.3 attack=0.005 decay=0.1 sustain=0.45 release=0.08 detune=6
voice triangle: level=0.65 attack=0.005 decay=0.05 sustain=0.9 release=0.03
voice noise: level=0.3 attack=0.001 decay=0.06 sustain=0 release=0.02

section: intro
chords: F#sus4 | F#m
pulse2: [F#4/8@0.6 B4/8@0.4 C#5/8@0.4 B4/8@0.4]x2 | [F#4/8@0.6 A4/8@0.4 C#5/8@0.4 A4/8@0.4]x2
triangle: F#2/8! [F#2/8]x7 | F#2/8! [F#2/8]x7
noise: [h/8@0.3 h/8@0.2]x4 | k/8 h/8@0.3 s/8@0.5 h/8@0.3 s/16@0.4 s/16@0.5 s/16@0.6 s/16@0.7 s/4@0.8

section: A
chords: F#m | D | Bm | C#sus4 | F#m | D | E | C#sus4
// call: two fourths up to the suspended B5, which sinks to A5; the held answers climb
pulse1: C#5/8 F#5/8 B5/4 A5/4 r/8 E5/8 | F#5/2. r/4 | B4/8 D5/8 F#5/4 B5/4 r/8 A5/8 | G#5/2. r/4
pulse1: C#5/8 F#5/8 B5/4 A5/4 r/8 E5/8 | A5/2. r/4 | E5/8 G#5/8 B5/4 G#5/4 r/8 E5/8 | C#5/2. r/4
pulse2: [C#4/8@0.7 F#4/8@0.45 A4/8@0.5 F#4/8@0.45]x2 | [D4/8@0.7 F#4/8@0.45 A4/8@0.5 F#4/8@0.45]x2 | [D4/8@0.7 F#4/8@0.45 B4/8@0.5 F#4/8@0.45]x2 | [C#4/8@0.7 F#4/8@0.45 G#4/8@0.5 F#4/8@0.45]x2
pulse2: [C#4/8@0.7 F#4/8@0.45 A4/8@0.5 F#4/8@0.45]x2 | [D4/8@0.7 F#4/8@0.45 A4/8@0.5 F#4/8@0.45]x2 | [E4/8@0.7 G#4/8@0.45 B4/8@0.5 G#4/8@0.45]x2 | [C#4/8@0.7 F#4/8@0.45 G#4/8@0.5 F#4/8@0.45]x2
triangle: F#2/8! F#2/8 C#3/8 F#2/8 F#3/8 F#2/8 C#3/8 F#2/8 | D2/8! D2/8 A2/8 D2/8 D3/8 D2/8 A2/8 D2/8 | B1/8! B1/8 F#2/8 B1/8 B2/8 B1/8 F#2/8 B1/8 | C#2/8! C#2/8 G#2/8 C#2/8 C#3/8 C#2/8 G#2/8 C#2/8
triangle: F#2/8! F#2/8 C#3/8 F#2/8 F#3/8 F#2/8 C#3/8 F#2/8 | D2/8! D2/8 A2/8 D2/8 D3/8 D2/8 A2/8 D2/8 | E2/8! E2/8 B2/8 E2/8 E3/8 E2/8 B2/8 E2/8 | C#2/8! C#2/8 G#2/8 C#2/8 C#3/8 C#2/8 G#2/8 C#2/8
noise: c/8@0.6 h/8@0.3 s/8@0.6 h/8@0.3 k/8 h/8@0.3 s/8@0.6 h/8@0.3 | [k/8 h/8@0.3 s/8@0.6 h/8@0.3 k/8 h/8@0.3 s/8@0.6 h/8@0.3 |]x6 k/8 h/8@0.3 s/8@0.6 h/8@0.3 s/16@0.4 s/16@0.5 s/16@0.6 s/16@0.7 s/8@0.8 s/8@0.8

section: A'
chords: F#m | D | Bm | C#sus4 | F#m | D | A | C#
pulse1: C#5/8 F#5/8 B5/4 A5/4 r/8 E5/8 | F#5/2. r/4 | B4/8 D5/8 F#5/4 B5/4 r/8 A5/8 | G#5/2. r/4
// a new ending: the cell reaches C#6 over bIII, then the major V, E# and all
pulse1: C#5/8 F#5/8 B5/4 A5/4 r/8 E5/8 | A5/2. r/4 | E5/8 A5/8 C#6/4 A5/4 r/8 E5/8 | G#5/4 F5/4 C#5/2
// suspended arpeggio bursts in place of the pulsing eighths
pulse2: F#4:037/8@0.7 r/8 r/4 C#4:058/8@0.5 r/8 r/4 | D4:047/8@0.7 r/8 r/4 A3:059/8@0.5 r/8 r/4 | B3:037/8@0.7 r/8 r/4 F#4:058/8@0.5 r/8 r/4 | C#4:057/8@0.7 r/8 r/4 C#4:057/8@0.5 r/8 r/4
pulse2: F#4:037/8@0.7 r/8 r/4 C#4:058/8@0.5 r/8 r/4 | D4:047/8@0.7 r/8 r/4 A3:059/8@0.5 r/8 r/4 | A3:047/8@0.7 r/8 r/4 E4:059/8@0.5 r/8 r/4 | C#4:047/8@0.7 r/8 r/4 G#3:059/8@0.5 r/8 r/4
triangle: F#2/8! F#2/8 C#3/8 F#3/8 F#2/8! F#2/8 C#3/8 F#3/8 | D2/8! D2/8 A2/8 D3/8 D2/8! D2/8 A2/8 D3/8 | B1/8! B1/8 F#2/8 B2/8 B1/8! B1/8 F#2/8 B2/8 | C#2/8! C#2/8 G#2/8 C#3/8 C#2/8! C#2/8 G#2/8 C#3/8
triangle: F#2/8! F#2/8 C#3/8 F#3/8 F#2/8! F#2/8 C#3/8 F#3/8 | D2/8! D2/8 A2/8 D3/8 D2/8! D2/8 A2/8 D3/8 | A1/8! A1/8 E2/8 A2/8 A1/8! A1/8 E2/8 A2/8 | C#2/8! C#2/8 G#2/8 C#3/8 C#2/8! C#2/8 G#2/8 C#3/8
noise: c/8@0.6 h/16@0.3 h/16@0.2 s/8@0.6 h/8@0.3 k/8 h/8@0.3 s/8@0.6 o/8@0.35 | [k/8 h/16@0.3 h/16@0.2 s/8@0.6 h/8@0.3 k/8 h/8@0.3 s/8@0.6 o/8@0.35 |]x6 k/8 h/8@0.3 s/8@0.6 h/8@0.3 t/16@0.5 t/16@0.5 t/16@0.6 t/16@0.6 s/8@0.7 s/8@0.8

section: B
chords: D | E | Bm | C#sus4 | D7 | E | D7 | C#
// thin and long, then whole-tone runs over the bVI7, up and back down
duty pulse1: 0.125
pulse1: A5/1v | G#5/2. B5/4 | F#5/2. D5/4 | F#5/1v
pulse1: r/4 D5/8 E5/8 F#5/8 G#5/8 A#5/8 C6/8 | B5/1v | r/4 C6/8 A#5/8 G#5/8 F#5/8 E5/8 D5/8 | C#5/2. r/4
// the runs trail off in a long echo
echo pulse2: pulse1 delay=0.75 level=0.5
triangle: D2/2 A1/2 | E2/2 B1/2 | B1/2 F#2/2 | C#2/2 G#1/2 | D2/2 C2/2 | E2/2 B1/2 | D2/2 C2/2 | C#2/2 G#1/2
noise: c/4@0.5 h/8@0.25 h/8@0.2 s/4@0.6 t/8@0.3 h/8@0.2 | [k/4 h/8@0.25 h/8@0.2 s/4@0.6 t/8@0.3 h/8@0.2 |]x6 k/4 t/8@0.4 t/8@0.5 s/16@0.4 s/16@0.5 s/16@0.6 s/16@0.7 s/4@0.8

section: C
chords: F#m | F#sus4 | F#m | F#sus4 | D | E | D | E
// over the pedal the lead calls and slides down, pulse 2 answers
duty pulse1: 0.5
pulse1: C#5/8 F#5/8 A5/4 C#6/2>-1 | r/1 | C#5/8 A5/8 C#6/4 A5/2>-1 | r/1
// then the roles swap: the lead takes the cell over bVI and bVII while pulse 2 holds
pulse1: D5/8 F#5/8 A5/4 F#5/4 r/8 D5/8 | E5/8 G#5/8 B5/4 G#5/4 r/8 B5/8 | F#5/8 A5/8 B5/4 A5/4 r/8 F#5/8 | G#5/2. r/4
pulse2: F#3:037/8@0.6 r/8 r/4 r/2 | B4/8 F#4/8 C#4/4 r/4 B3/4 | F#3:037/8@0.6 r/8 r/4 r/2 | C#5/8 B4/8 F#4/4 r/4 C#4/4
pulse2: A4/1 | B4/1 | A4/1 | B4/2 G#4/2
triangle: [F#2/8! [F#2/8]x7 |]x4 D2/8! [D2/8]x7 | E2/8! [E2/8]x7 | D2/8! [D2/8]x7 | E2/8! E2/8 E2/8 E2/8 G#2/8 E2/8 D2/8 E2/8
noise: c/8@0.5 h/8@0.2 o/8@0.3 h/8@0.2 r/8 h/8@0.2 s/8@0.5 h/8@0.2 | [k/8 h/8@0.2 o/8@0.3 h/8@0.2 r/8 h/8@0.2 s/8@0.5 h/8@0.2 |]x6 k/8 h/8@0.2 s/8@0.5 h/8@0.2 s/16@0.4 s/16@0.5 s/16@0.6 s/16@0.7 s/4@0.8

section: breakdown
chords: F#sus4 | F#m | F#sus4 | F#m
// the lead rests: suspended bursts, sparse triangle kicks and toms
pulse2: F#4:057/8@0.7 r/8 r/4 F#4:057/8@0.4 r/8 r/4 | F#4:037/8@0.7 r/8 r/4 F#4:037/8@0.4 r/8 r/4
pulse2: F#4:057/8@0.6 r/8 r/4 F#4:057/8@0.35 r/8 r/4 | F#4:037/8@0.6 r/8 r/4 F#4:037/8@0.5 r/8 F#4:037/8@0.4 r/8
triangle: [F#2/8! r/8 F#2/4 r/4 F#2/8! F#2/8 |]x3 F#2/8! r/8 F#2/4 F#2/8! F#2/8 F#2/8! F#2/8
noise: t/8@0.4 r/8 h/8@0.2 r/8 t/8@0.3 h/8@0.2 r/8 h/8@0.2 | [t/8@0.4 r/8 h/8@0.2 r/8 t/8@0.3 h/8@0.2 r/8 h/8@0.2 |]x2 t/8@0.4 h/8@0.2 t/8@0.4 h/8@0.2 t/16@0.4 t/16@0.5 t/16@0.6 t/16@0.7 s/4@0.8

section: turnaround
chords: D | C# | D | C#
// the bass carries Far Light's cell; the lead builds onto the dominant
duty pulse1: voice
pulse1: r/2 D5/8 F#5/8 A5/4 | G#5/1v | r/2 F#5/8 A5/8 B5/4 | C#6/4 G#5/4 F5/4 G#5/8 r/8
pulse2: D4:047/8@0.7 r/8 r/4 D4:047/8@0.5 r/8 r/4 | C#4:047/8@0.7 r/8 r/4 C#4:047/8@0.5 r/8 r/4
pulse2: [D4:047/8@0.6 r/8]x4 | [C#4:047/16@0.6 r/16]x4 [C#4:047/16@0.8 r/16]x4
triangle: D2/2. B1/4 | C#2/1 | D2/2. B1/4 | C#2/2 C#2/4 G#1/4
noise: k/4 h/8@0.3 h/8@0.2 s/4@0.6 h/8@0.3 h/8@0.2 | k/8 h/8@0.3 s/8@0.6 h/8@0.3 k/8 h/8@0.3 s/8@0.6 s/8@0.5 | k/8 s/8@0.4 h/8@0.3 s/8@0.5 k/8 s/8@0.5 s/8@0.6 s/8@0.6 | [s/16@0.4 s/16@0.5]x2 [s/16@0.6 s/16@0.7]x2 t/8@0.6 t/8@0.6 t/8@0.7 t/8@0.8
`;

/** "Event Horizon", Farside's third race track, parsed. */
export const farsideThree: Song = parseSong(source);
