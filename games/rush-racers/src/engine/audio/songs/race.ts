/**
 * "Reef Rush", track 1 of the Reef set and the game's main theme: G major, 4/4, 144 BPM, a bright
 * swimming bounce.
 *
 * Form: intro (2 bars, drums and bass) | A (8) | A' (8) | B (8) | C (8) | breakdown (4) |
 * turnaround (4), looping from the turnaround back to A. The loop is 40 bars, about 67 s.
 *
 * Chords:
 * - intro: G | D
 * - A: G | Bm | C | D | G | Bm | Am D | G (hook, answer, hook, rising resolve)
 * - A': as A, with a higher answer, a counter-line under it and a climb to B5 at the end
 * - B: Em | C | Am | B | Em | C | F | D (relative minor, a major B and a borrowed F for colour)
 * - C: C | D | Bm | Em | Am | D7 | F | D (the pulses trade phrases; F is the borrowed bVII)
 * - breakdown: Cmaj7 | Am7 | Cmaj7 | D (the lead rests)
 * - turnaround: G | Em | A | D7, ending on the dominant so the loop pulls back to A
 *
 * The hook (A, bars 1-2) is "B A B D~ C B | F#. E D B": a syncopated cell (three eighths, a
 * held note on the off-beat of 2) answered by a leap up a fifth to F#.
 *
 * Voices: the lead is a 25% pulse, rounded to 50% for B. Pulse 2 plays off-beat stabs in A; in
 * A' a counter-line that holds under the hook's moving eighths and steps where the lead holds,
 * joining it in thirds only for the climb of the last two bars; in B a counter-line that holds
 * under the lead's first half and answers in the half note it holds, with the eighth-note
 * arpeggio saved for the F and D bars; the answers to the lead's calls in C (the call keeps the
 * hook's rhythm, the answer the rhythm of its second bar; the calls are played softer so the two
 * voices trade as equals, and climb to C6 over the F); short arpeggio chords in a 3-3-2 rhythm in
 * the breakdown that quicken in its last bar; and in the turnaround long notes rising against
 * the lead (B C D, E D B, C# D E) before D7 arpeggio bursts. The triangle bounces in octaves in A,
 * walks in B, bounces root and fifth in C, and kicks with pitch drops in the breakdown. Drums: a
 * crash opens A, A' and C, open hats and sixteenth hats lift A', A and A' fill at bar 4 as well as
 * at their ends, B is half-time, toms carry the breakdown, the turnaround adds kicks and snares
 * bar by bar into a roll, and every section ends with a snare fill.
 */
import { parseSong, type Song } from '../notation.ts';

/** The race theme in the game's notation. */
const raceSource = `
name: race
title: Reef Rush
tempo: 144
time: 4/4
key: G major
loop: A

voice pulse1: duty=0.25 level=0.55 attack=0.005 decay=0.1 sustain=0.6 release=0.06
voice pulse2: duty=0.125 level=0.3 attack=0.005 decay=0.08 sustain=0.45 release=0.04
voice triangle: level=0.7 attack=0.002 decay=0.05 sustain=0.9 release=0.03
voice noise: level=0.35 attack=0.001 decay=0.08 sustain=0 release=0.02

section: intro
chords: G | D
triangle: [G2/8 G3/8]x4 | [D3/8 D2/8]x3 E2/8 F#2/8
noise: k/8 h/8@0.4 s/8 h/8@0.4 k/8 k/8 s/8 h/8@0.4 | k/8 h/8@0.4 s/8 h/8@0.4 s/16 s/16 s/16 s/16 s/8 s/8

section: A
chords: G | Bm | C | D | G | Bm | Am D | G
// hook, answer
pulse1: B4/8 A4/8 B4/8 D5/4 C5/8 B4/4 | F#5/4.v E5/8 D5/4 B4/4 | E5/8 D5/8 E5/8 G5/4 A5/8 G5/4 | F#5/4. E5/8 D5/4 A4/4
// hook, rising resolve
pulse1: B4/8 A4/8 B4/8 D5/4 C5/8 B4/4 | F#5/4.v E5/8 D5/4 B4/4 | A4/8 B4/8 C5/8 D5/4 E5/8 F#5/4 | G5/4. D5/8 G5/4 r/4
pulse2: [r/8 B3/8 r/8 D4/8]x2 | [r/8 D4/8 r/8 F#4/8]x2 | [r/8 E4/8 r/8 G4/8]x2 | [r/8 F#4/8 r/8 A4/8]x2
pulse2: [r/8 B3/8 r/8 D4/8]x2 | [r/8 D4/8 r/8 F#4/8]x2 | r/8 C4/8 r/8 E4/8 r/8 F#4/8 r/8 A4/8 | [r/8 B3/8 r/8 D4/8]x2
triangle: [G2/8 G3/8]x3 G2/8 A2/8 | [B2/8 B3/8]x3 B2/8 D3/8 | [C3/8 C4/8]x3 C3/8 C#3/8 | [D3/8 D4/8]x3 D3/8 F#2/8
triangle: [G2/8 G3/8]x3 G2/8 A2/8 | [B2/8 B3/8]x4 | A2/8 A3/8 A2/8 A3/8 D3/8 D4/8 D3/8 F#2/8 | [G2/8 G3/8]x3 D3/8 F#2/8
noise: c/8 h/8@0.4 s/8 h/8@0.4 k/8 k/8 s/8 h/8@0.4 | [k/8 h/8@0.4 s/8 h/8@0.4 k/8 k/8 s/8 h/8@0.4 |]x2
noise: k/8 h/8@0.4 s/8 h/8@0.4 k/8 k/8 s/16 s/16 s/8 | [k/8 h/8@0.4 s/8 h/8@0.4 k/8 k/8 s/8 h/8@0.4 |]x3
noise: k/8 h/8@0.4 s/8 h/8@0.4 s/16 s/16 s/16 s/16 s/8 s/8

section: A'
chords: G | Bm | C | D | G | Bm | Am D | G
// hook, higher answer
pulse1: B4/8 A4/8 B4/8 D5/4 C5/8 B4/4 | F#5/4.v E5/8 D5/4 B4/4 | E5/8 D5/8 E5/8 G5/4 A5/8 G5/4 | F#5/4. G5/8 A5/4 F#5/4
// hook, climb to the high ending
pulse1: B4/8 A4/8 B4/8 D5/4 C5/8 B4/4 | F#5/4.v E5/8 D5/4 B4/4 | C5/8 D5/8 E5/8 F#5/4 G5/8 A5/4 | B5/4. A5/8 G5/2
// a counter-line that holds while the hook moves and steps where it holds, then thirds for the climb
pulse2: D4/2. B3/8 C4/8 | D4/2. F#4/8 E4/8 | E4/2. C4/8 E4/8 | F#4/2 E4/4 C4/4
pulse2: B3/2. G3/8 A3/8 | B3/2. C4/8 D4/8 | A4/8 B4/8 C5/8 D5/4 E5/8 F#5/4 | G5/4. F#5/8 D5/2
triangle: [G2/8 G3/8]x3 G2/8 A2/8 | [B2/8 B3/8]x3 B2/8 D3/8 | [C3/8 C4/8]x3 C3/8 C#3/8 | [D3/8 D4/8]x3 D3/8 F#2/8
triangle: [G2/8 G3/8]x3 G2/8 A2/8 | [B2/8 B3/8]x4 | A2/8 A3/8 A2/8 A3/8 D3/8 D4/8 D3/8 F#2/8 | [G2/8 G3/8]x3 G2/8 F#2/8
noise: c/8 h/16@0.3 h/16@0.3 s/8 o/8@0.3 k/8 k/8 s/8 h/8@0.4 | [k/8 h/16@0.3 h/16@0.3 s/8 o/8@0.3 k/8 k/8 s/8 h/8@0.4 |]x2
noise: k/8 h/16@0.3 h/16@0.3 s/8 o/8@0.3 k/8 s/16 s/16 k/8 s/16 s/16 | [k/8 h/16@0.3 h/16@0.3 s/8 o/8@0.3 k/8 k/8 s/8 h/8@0.4 |]x3
noise: k/8 h/8@0.4 s/16 s/16 k/8 s/16 s/16 s/16 s/16 s/8 s/8

section: B
chords: Em | C | Am | B | Em | C | F | D
// lower register (G4-F#5), long notes on a rounder duty; the arpeggio sits under it
duty pulse1: 0.5
pulse1: G4/4. A4/8 B4/2 | C5/4. B4/8 G4/2 | A4/4. B4/8 C5/4 E5/4 | D#5/2v B4/2
pulse1: G4/4. A4/8 B4/2 | C5/4. D5/8 E5/2 | A4/4. C5/8 F5/2 | F#5/2.v r/4
// pulse 2 holds under the lead's moving first half and answers in the half note it holds
pulse2: B3/2 E4/8 D4/8 B3/4 | E4/2 C4/8 D4/8 E4/4 | E4/4. D4/8 C4/2 | B3/2 F#4/8 E4/8 D#4/4
pulse2: E4/2 G4/8 F#4/8 E4/4 | C4/2 D4/8 E4/8 G4/4 | [A3/8 C4/8 F4/8 C4/8]x2 | [A3/8 D4/8 F#4/8 D4/8]x2
// walking bass
triangle: E2/4 B2/4 E3/4 D3/4 | C3/4 G2/4 C3/4 B2/4 | A2/4 C3/4 E3/4 A#2/4 | B2/4 D#3/4 F#3/4 D#2/4
triangle: E2/4 B2/4 E3/4 D3/4 | C3/4 G2/4 C3/4 E2/4 | F2/4 A2/4 C3/4 C#3/4 | D3/4 A2/4 D3/4 F#2/4
// half-time
noise: [k/4 h/8@0.4 h/8@0.4 s/4 h/8@0.4 k/8 |]x7 k/4 h/8@0.4 h/8@0.4 s/16 s/16 s/16 s/16 s/8 s/8

section: C
chords: C | D | Bm | Em | Am | D7 | F | D
// the lead calls in the hook's rhythm, pulse 2 answers in the rhythm of the hook's second bar
duty pulse1: voice
duty pulse2: 0.25
pulse1: E5/8@0.75 D5/8@0.75 E5/8@0.75 G5/4@0.75 E5/8@0.75 C5/4@0.75 | r/1
pulse1: F#5/8@0.75 E5/8@0.75 F#5/8@0.75 B5/4@0.75 A5/8@0.75 F#5/4@0.75 | r/1
pulse1: E5/8@0.75 D5/8@0.75 E5/8@0.75 A5/4@0.75 G5/8@0.75 E5/4@0.75 | r/1
pulse1: A5/8@0.8 G5/8@0.8 A5/8@0.8 C6/4@0.8 A5/8@0.8 F5/4@0.8 | F#5/4. E5/8 D5/4 r/4
pulse2: r/1 | A4/4.v G4/8 F#4/4 D4/4 | r/1 | B4/4.v A4/8 G4/4 E4/4
pulse2: r/1 | C5/4.v B4/8 A4/4 F#4/4 | r/1 | A4/4. G4/8 F#4/4 r/4
// root and fifth bounce
triangle: [C2/8 G2/8 C3/8 G2/8]x2 | [D2/8 A2/8 D3/8 A2/8]x2 | [B1/8 F#2/8 B2/8 F#2/8]x2 | [E2/8 B2/8 E3/8 B2/8]x2
triangle: [A1/8 E2/8 A2/8 E2/8]x2 | [D2/8 A2/8 D3/8 A2/8]x2 | [F2/8 C3/8 F3/8 C3/8]x2 | D2/8 A2/8 D3/8 C3/8 B2/8 A2/8 G2/8 B2/8
noise: c/8 h/8@0.4 s/8 o/8@0.3 k/8 h/8@0.4 s/8 h/8@0.4 | [k/8 h/8@0.4 s/8 o/8@0.3 k/8 h/8@0.4 s/8 h/8@0.4 |]x6
noise: k/8 h/8@0.4 s/8 k/8 s/16 s/16 s/16 s/16 s/8 s/16 s/16

section: breakdown
chords: Cmaj7 | Am7 | Cmaj7 | D
// the lead rests; short arpeggio chords in a 3-3-2 rhythm over kicked bass and toms
duty pulse2: 0.5
pulse2: C4:047b/8. C4:047b/8. C4:047b/8 r/2 | A3:037a/8. A3:037a/8. A3:037a/8 r/2
pulse2: E4:0378/8. E4:0378/8. E4:0378/8 r/2 | D4:047/8. D4:047/8. F#4:036/8 A4:039/8 C5:026/4 r/8
triangle: C2/16! C2/8. G2/4 C3/4 G2/4 | A1/16! A1/8. E2/4 A2/4 E2/4 | C2/16! C2/8. G2/4 C3/4 E3/4
triangle: D2/16! D2/8. A2/4 D3/8 C3/8 B2/8 A2/8
noise: [k/8 h/16@0.3 h/16@0.3 t/8 h/8@0.3 k/8 t/16 t/16 s/8 h/8@0.3 |]x3 k/8 t/16 t/16 s/16 s/16 t/16 t/16 s/16 s/16 s/16 s/16 s/8 s/8

section: turnaround
chords: G | Em | A | D7
duty pulse2: voice
pulse1: D5/8 E5/8 D5/8 B4/4 D5/8 G5/4 | E5/8 F#5/8 E5/8 B4/4 E5/8 G5/4 | E5/8 F#5/8 E5/8 C#5/4 E5/8 A5/4 | F#5/4 E5/4 D5/4 C5/4
pulse2: B3/2 C4/4 D4/4 | E4/2 D4/4 B3/4 | C#4/2 D4/4 E4/4
pulse2: D4:047a/8 r/8 D4:047a/8 r/8 D4:047a/16 D4:047a/16 D4:047a/16 D4:047a/16 D4:047a/8 r/8
triangle: [G2/8 G3/8]x4 | [E2/8 E3/8]x4 | [A2/8 A3/8]x4 | D3/8 D4/8 D3/8 D4/8 C3/8 B2/8 A2/8 F#2/8
noise: k/8 h/8@0.4 s/8 h/8@0.4 k/8 k/8 s/8 h/8@0.4 | k/8 h/8@0.4 s/8 k/8 k/8 h/8@0.4 s/8 s/8
noise: k/8 s/8 k/8 s/8 k/8 s/8 s/16 s/16 s/8 | k/8 s/16 s/16 k/8 s/16 s/16 s/8 s/8 s/8 s/8
`;

/** "Reef Rush", the race theme and track 1 of the Reef set, parsed. */
export const race: Song = parseSong(raceSource);
