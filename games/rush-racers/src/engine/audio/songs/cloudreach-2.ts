/**
 * Cloudreach's second race track, "Thermal": Bb major in 4/4 at 152 BPM, soaring long notes over
 * fast arpeggios, riding the bVI-bVII-I lift (Gb, Ab, Bb) like a glider catching rising air.
 *
 * Form: intro (4 bars) | A (8) | A' (8) | B (8) | C (8) | breakdown (4) | turnaround (4), looping
 * from the turnaround back to A: 40 bars, about 63 s.
 *
 * Chords:
 * - intro: Gb | Ab | Gb | Ab (the lift, waiting to land on Bb)
 * - A: Bb | F | Gm | Eb | Bb | F | Gb | Ab
 * - A': Bb | F | Gm | Eb | Bb | F | Eb | F (a plain ending up to the peak F6)
 * - B: Gm | Eb | Bb | F | Gm | Eb | Cm | F (the relative minor, long notes)
 * - C: Gb | Ab | Bb | Bb | Gb | Ab | Bb | Bb (two lifts in a row)
 * - breakdown: Gm | Eb | Gm | F
 * - turnaround: Cm | F | Gb | Ab, ending on the bVII so the loop lifts back into A
 *
 * The hook (A, bars 1-2) is "F5. Bb5. D6 | C6 (held), A5": a syncopated 3+3+2 climb up the tonic
 * triad to a long C, a breath, and a pickup into the answer, which sequences the same push from G5
 * to a long Eb6. A' repeats it with the echo behind and peaks on F6; the turnaround pushes the
 * same rhythm four times (down Cm, up F, down Gb) and rises on Ab into the next lift.
 *
 * Voices:
 * - pulse 1 (25% lead) plays the hook; B rounds it to 50% for held notes answered by a dotted
 *   flutter (dotted quarter, eighth, two quarters), and C goes back to 25%.
 * - pulse 2 (50%) plays off-beat stabs and arpeggio bursts under the long notes in A, echoes the
 *   lead an eighth late in A', plays a counter-line in B and the breakdown, and strums arpeggio
 *   chords in the hook's 3+3+2 rhythm under C and the turnaround.
 * - the triangle bounces root-octave eighths (root-fifth in A', a half-time figure in B, a pedal in
 *   the breakdown), with pitch-dropped kicks on the downbeats of the lift bars.
 * - the drums drive straight eighths, a 3+3+2 kick in B and toms in the breakdown, with a crash or
 *   open hat at each section start and a fill at the end of every section.
 *
 * The world motif: Updraft's launch (up a fourth, a step and a fourth, three eighths and a long
 * note) is pulse 2's counter-line in B (D4 G4 A4 D5, Bb3 Eb4 F4 Bb4, C4 F4 G4 C5) and its solo in
 * the breakdown.
 */
import { parseSong, type Song } from '../notation.ts';

/** Cloudreach's second race track in the game's notation. */
const source = `
name: cloudreach-2
title: Thermal
tempo: 152
time: 4/4
key: Bb major
loop: A

voice pulse1: duty=0.25 level=0.5 attack=0.01 decay=0.2 sustain=0.75 release=0.15
voice pulse2: duty=0.5 level=0.3 attack=0.002 decay=0.08 sustain=0.35 release=0.05 arp=2
voice triangle: level=0.65 attack=0.002 decay=0.05 sustain=0.9 release=0.03
voice noise: level=0.3 attack=0.001 decay=0.08 sustain=0 release=0.02

section: intro
chords: Gb | Ab | Gb | Ab
pulse2: Gb3/8 Db4/8 Bb3/8 Db4/8 Gb4/8 Db4/8 Bb3/8 Db4/8 | Ab3/8 Eb4/8 C4/8 Eb4/8 Ab4/8 Eb4/8 C4/8 Eb4/8
pulse2: Gb3/8 Db4/8 Bb3/8 Db4/8 Gb4/8 Db4/8 Bb3/8 Db4/8 | Ab3/8 Eb4/8 C4/8 Eb4/8 Ab4/8 Eb4/8 C4/8 Eb4/8
triangle: [Gb2/8 Gb3/8]x4 | [Ab2/8 Ab3/8]x4 | [Gb2/8 Gb3/8]x4 | Ab2/8 Ab3/8 Ab2/8 Ab3/8 C3/8 Eb3/8 Ab3/8 A3/8
noise: k/4 r/4 k/4 r/4 | k/4 h/8@0.35 h/8@0.35 k/4 h/8@0.35 h/8@0.35 | [k/8 h/8@0.35 s/8@0.75 h/8@0.35]x2
noise: k/8 s/8@0.7 s/8@0.7 k/8 s/16 s/16 s/16 s/16 s/8 s/8

section: A
chords: Bb | F | Gm | Eb | Bb | F | Gb | Ab
// hook, then the same push from G5 to the long Eb
pulse1: F5/4. Bb5/4. D6/4 | C6/2.v r/8 A5/8 | G5/4. Bb5/4. D6/4 | Eb6/2 r/8 D6/8 C6/8 Bb5/8
// hook, a fall home, then the push up the Gb and Ab triads
pulse1: F5/4. Bb5/4. D6/4 | C6/2 A5/4 F5/4 | Gb5/4. Bb5/4. Db6/4 | Ab5/8 C6/8 Eb6/2.v
pulse2: r/8 D4/8 r/8 F4/8 r/8 D4/8 r/8 F4/8 | F4:047c/2. r/4 | r/8 Bb3/8 r/8 D4/8 r/8 Bb3/8 r/8 D4/8 | Eb4:047c/2 r/4 G4/8 Bb4/8
pulse2: r/8 D4/8 r/8 F4/8 r/8 D4/8 r/8 F4/8 | F4:047c/2 r/2 | r/8 Db4/8 r/8 Gb4/8 r/8 Db4/8 r/8 Gb4/8 | Ab3:047c/2. r/4
triangle: [Bb2/8 Bb3/8]x4 | [F2/8 F3/8]x4 | [G2/8 G3/8]x4 | [Eb2/8 Eb3/8]x4
triangle: [Bb2/8 Bb3/8]x4 | [F2/8 F3/8]x4 | Gb2/8! Gb3/8 [Gb2/8 Gb3/8]x3 | Ab2/8! Ab3/8 [Ab2/8 Ab3/8]x3
noise: c/8 h/8@0.35 s/8@0.75 h/8@0.35 k/8 h/8@0.35 s/8@0.75 h/8@0.35
noise: [k/8 h/8@0.35 s/8@0.75 h/8@0.35 k/8 h/8@0.35 s/8@0.75 h/8@0.35 |]x6 k/8 h/8@0.35 s/8@0.75 k/8 s/16 s/16 s/16 s/16 s/8 s/8

section: A2
chords: Bb | F | Gm | Eb | Bb | F | Eb | F
// the hook with an eighth-note echo filling every push, climbing to the peak F6
pulse1: F5/4. Bb5/4. D6/4 | C6/2.v r/8 A5/8 | G5/4. Bb5/4. D6/4 | Eb6/2 r/8 D6/8 C6/8 Bb5/8
pulse1: F5/4. Bb5/4. D6/4 | C6/2 A5/4 F5/4 | G5/4. Bb5/4. Eb6/4 | F6/2.v r/4
echo pulse2: pulse1 delay=0.5 level=0.55
triangle: [Bb2/8 F3/8 Bb3/8 F3/8]x2 | [F2/8 C3/8 F3/8 C3/8]x2 | [G2/8 D3/8 G3/8 D3/8]x2 | [Eb2/8 Bb2/8 Eb3/8 Bb2/8]x2
triangle: [Bb2/8 F3/8 Bb3/8 F3/8]x2 | [F2/8 C3/8 F3/8 C3/8]x2 | Eb2/8! Eb3/8 [Eb2/8 Eb3/8]x3 | F2/8! F3/8 F2/8 F3/8 F2/8 F3/8 A2/8 A3/8
noise: o/8@0.6 h/8@0.35 s/8@0.75 h/8@0.35 k/8 k/8 s/8@0.75 h/8@0.35
noise: [k/8 h/8@0.35 s/8@0.75 h/8@0.35 k/8 k/8 s/8@0.75 h/16@0.3 h/16@0.3 |]x6 k/8 s/8@0.7 s/8@0.7 k/8 s/16 s/16 s/16 s/16 s/8 s/8

section: B
chords: Gm | Eb | Bb | F | Gm | Eb | Cm | F
duty pulse1: 0.5
// round notes held over pulse 2's launch, answered by a fluttering dotted figure
pulse1: D6/2. Bb5/4 | G5/4. Bb5/8 Eb6/4 D6/4 | F5/2. Bb5/4 | A5/4. Bb5/8 C6/4 A5/4
pulse1: Bb5/2. D6/4 | Eb6/4. D6/8 Bb5/4 G5/4 | C6/2. Eb6/4 | C6/4. A5/8 F5/4 r/4
pulse2: r/4 D4/8 G4/8 A4/8 D5/4. | Eb4:047/2 r/2 | r/4 Bb3/8 Eb4/8 F4/8 Bb4/4. | F4:047/2 r/2
pulse2: r/4 D4/8 G4/8 A4/8 D5/4. | Eb4:047/2 r/2 | r/4 C4/8 F4/8 G4/8 C5/4. | F4:047c/2 r/8 A4/8 C5/8 Eb5/8
triangle: G2/4. G2/8 D3/4 G3/4 | Eb2/4. Eb2/8 Bb2/4 Eb3/4 | Bb2/4. Bb2/8 F3/4 Bb3/4 | F2/4. F2/8 C3/4 F3/4
triangle: G2/4. G2/8 D3/4 G3/4 | Eb2/4. Eb2/8 Bb2/4 Eb3/4 | C3/4. C3/8 G3/4 C4/4 | F2/4. F2/8 C3/4 F3/4
// a 3+3+2 kick under the long notes
noise: c/8 h/8@0.3 h/8@0.3 k/8 s/8@0.7 h/8@0.3 k/8 h/8@0.3
noise: [k/8 h/8@0.3 h/8@0.3 k/8 s/8@0.7 h/8@0.3 k/8 h/8@0.3 |]x6 k/8 h/8@0.3 h/8@0.3 k/8 s/16 s/16 s/16 s/16 s/8 s/8

section: C
chords: Gb | Ab | Bb | Bb | Gb | Ab | Bb | Bb
duty pulse1: voice
// two lifts: long notes over arpeggio chords strummed in the hook's rhythm
pulse1: Db6/2. Bb5/4 | C6/2. Eb6/4 | D6/1v | r/2 F5/8 Bb5/8 C6/8 D6/8
pulse1: Db6/2. Bb5/4 | Eb6/2. C6/4 | F6/1v | D6/2 r/2
pulse2: Bb3:038/4. Bb3:038/4. Bb3:038/4 | C4:038/4. C4:038/4. C4:038/4 | D4:038/4. D4:038/4. D4:038/4 | Bb3:047c/2 r/2
pulse2: Bb3:038/4. Bb3:038/4. Bb3:038/4 | C4:038/4. C4:038/4. C4:038/4 | D4:038/4. D4:038/4. D4:038/4 | Bb3:047c/2 F4/8 D4/8 Bb3/8 F3/8
triangle: Gb2/8! Gb3/8 [Gb2/8 Gb3/8]x3 | Ab2/8! Ab3/8 [Ab2/8 Ab3/8]x3 | Bb2/8! Bb3/8 [Bb2/8 Bb3/8]x3 | [Bb2/8 Bb3/8]x4
triangle: Gb2/8! Gb3/8 [Gb2/8 Gb3/8]x3 | Ab2/8! Ab3/8 [Ab2/8 Ab3/8]x3 | Bb2/8! Bb3/8 [Bb2/8 Bb3/8]x3 | Bb2/8 Bb3/8 Bb2/8 Bb3/8 Bb2/8 A2/8 G2/8 F2/8
noise: c/8 h/8@0.35 s/8@0.75 h/8@0.35 k/8 h/8@0.35 s/8@0.75 h/8@0.35 | [k/8 h/8@0.35 s/8@0.75 h/8@0.35]x2
noise: [k/8 h/8@0.35 s/8@0.75 h/8@0.35]x2 | [k/8 h/8@0.35 s/8@0.75 h/8@0.35]x2
noise: c/8 h/8@0.35 s/8@0.75 h/8@0.35 k/8 h/8@0.35 s/8@0.75 h/8@0.35 | [k/8 h/8@0.35 s/8@0.75 h/8@0.35]x2
noise: [k/8 h/8@0.35 s/8@0.75 h/8@0.35]x2 | k/8 t/8@0.7 t/8@0.6 k/8 s/16 s/16 s/16 s/16 s/8 s/8

section: breakdown
chords: Gm | Eb | Gm | F
// the lead rests; pulse 2 sings Updraft's launch alone over a pedal and toms
pulse2: D4/8 G4/8 A4/8 D5/2 r/8 | Bb3/8 Eb4/8 F4/8 Bb4/2 r/8 | G4/8 C5/8 D5/8 G5/2 r/8 | F4:047c/2 F4:047c/4 r/4
triangle: G2/2 r/4 G2/8! G2/8 | Eb2/2 r/4 Eb2/8! Eb2/8 | G2/2 r/4 G2/8! G2/8 | F2/4 F2/8 F2/8 G2/4 A2/4
noise: [k/4 t/8@0.6 t/8@0.5 r/4 t/8@0.5 h/8@0.3 |]x3 k/8 t/8@0.7 t/8@0.6 t/8@0.5 s/16 s/16 s/16 s/16 s/8 s/8

section: turnaround
chords: Cm | F | Gb | Ab
// the hook's push four times: down Cm, up F, down Gb, then up Ab into the lift
pulse1: C6/4. G5/4. Eb5/4 | F5/4. A5/4. C6/4 | Db6/4. Bb5/4. Gb5/4 | Ab5/8 C6/8 Eb6/2.v
pulse2: [C4/8 G4/8 Eb4/8 G4/8]x2 | [F3/8 C4/8 A3/8 C4/8]x2 | Bb3:038/4. Bb3:038/4. Bb3:038/4 | C4:038/4. C4:038/4. C4:038/4
triangle: [C3/8 C4/8]x4 | [F2/8 F3/8]x4 | Gb2/8! Gb3/8 [Gb2/8 Gb3/8]x3 | Ab2/8! Ab3/8 Ab2/8 Ab3/8 Ab2/8 Ab3/8 A2/8 A3/8
noise: o/8@0.6 h/8@0.35 s/8@0.75 h/8@0.35 k/8 h/8@0.35 s/8@0.75 h/8@0.35 | [k/8 h/8@0.35 s/8@0.75 h/8@0.35]x2
noise: [k/8 h/16@0.3 h/16@0.3 s/8@0.75 h/16@0.3 h/16@0.3]x2 | k/8 s/16 s/16 k/8 s/16 s/16 s/8 s/8 s/16 s/16 s/16 s/16
`;

/** "Thermal", Cloudreach's second race track, parsed. */
export const cloudreachTwo: Song = parseSong(source);
