/**
 * Cloudreach's first race track, "Updraft": F lydian in 4/4 at 132 BPM, a lifting chase over a
 * steady pulse. The raised fourth (B natural over F, and the G major chord a step above the tonic)
 * keeps it airy and unresolved, like a climb that keeps going.
 *
 * Form: intro (2 bars, bass, pulse and drums) | A (8) | A' (8) | B (8) | C (8) | breakdown (4) |
 * turnaround (4), looping from the turnaround back to A: 40 bars, about 73 s.
 *
 * Chords:
 * - intro: F | G (the lydian lift)
 * - A: F | G | Am | C | F | G | Dm | C
 * - A': F | G | Am | C | F | G | Bb | C (a borrowed Bb climb for the new ending)
 * - B: Dm | Bb | F | C | Dm | Bb | G | C (long soaring notes; Bb for warmth, E over Bb for air)
 * - C: Dm | G | Dm | G | Bb | C | Bb | C (the pulses trade two-bar phrases)
 * - breakdown: F | Em | Dm | G (the bass steps down, the lead rests)
 * - turnaround: F | G | Bb | C, the launch climbing a step each bar, then a tumble onto the dominant
 *
 * The hook (A, bars 1-2) is "C5 F5 G5 C6 B5 | B5. A5 G5 D5": a launch up a fourth, a step and a
 * fourth to a long high C that slips to the lydian B, then a glide down. It is stated in bars 1-2
 * and 5-6 of A and A', its rhythm returns with new pitches in bars 3 and 7, and C launches the
 * same cell from D5 and, a fourth up, from F5. The turnaround fires the launch from C5, D5 and F5
 * in three rising bars to build back into A.
 *
 * Voices:
 * - pulse 1 (50% lead) plays the hook; B thins it to 25% for the long notes, and C goes back to 50%.
 * - pulse 2 (12.5%) is the steady pulse: rolling eighths in the intro and A (up the chord and back
 *   under the hook bars, a root-fifth-third rock under the answers), an echo of the lead a dotted
 *   eighth late in A', strummed arpeggio chords under B's first four bars and then a counter-line
 *   that moves while the lead holds, and in C a rounder 50% counter-line that answers the lead's
 *   calls. In the breakdown it falls through the hook's rhythm on the F, Em, Dm and G triads, each
 *   long note a shimmering arpeggio, and in the turnaround it climbs in slow half notes.
 * - the triangle drives root-octave eighths (walking quarters in B, a walk up to the leading tone
 *   E at the end of the turnaround), with pitch-dropped kicks under the downbeats of A', C and the
 *   breakdown.
 * - the drums keep a backbeat (half-time in B, with a push on 2-and in its second half, toms in the
 *   breakdown), a crash or open hat at each section start and a fill at the end of every section.
 */
import { parseSong, type Song } from '../notation.ts';

/** Cloudreach's first race track in the game's notation. */
const cloudreachSource = `
name: cloudreach
title: Updraft
tempo: 132
time: 4/4
key: F lydian
loop: A

voice pulse1: duty=0.5 level=0.48 attack=0.02 decay=0.15 sustain=0.7 release=0.12
voice pulse2: duty=0.125 level=0.28 attack=0.005 decay=0.06 sustain=0.4 release=0.04 detune=8
voice triangle: level=0.65 attack=0.002 decay=0.05 sustain=0.9 release=0.03
voice noise: level=0.28 attack=0.001 decay=0.08 sustain=0 release=0.02

section: intro
chords: F | G
pulse2: [F3/8 C4/8 A3/8 C4/8]x2 | [G3/8 D4/8 B3/8 D4/8]x2
triangle: [F2/8 F3/8]x4 | [G2/8 G3/8]x4
noise: [k/8 h/8@0.35]x4 | k/8 h/8@0.35 k/8 h/8@0.35 s/16 s/16 s/16 s/16 s/8 s/8

section: A
chords: F | G | Am | C | F | G | Dm | C
// hook, then the same launch a major third higher
pulse1: C5/8 F5/8 G5/8 C6/2 B5/8 | B5/4. A5/8 G5/4 D5/4 | E5/8 A5/8 B5/8 E6/2 D6/8 | C6/4. B5/8 G5/4 E5/4
// hook, then the highest launch and a glide onto the dominant
pulse1: C5/8 F5/8 G5/8 C6/2 B5/8 | B5/4. A5/8 G5/4 D5/4 | F5/8 A5/8 D6/8 F6/2 E6/8 | D6/4. C6/8 G5/2v
// under the hook bars the pulse rolls up the chord and back; under the answers it rocks root-fifth-third
pulse2: F3/8 C4/8 F4/8 A4/8 C5/8 A4/8 F4/8 C4/8 | G3/8 D4/8 G4/8 B4/8 D5/8 B4/8 G4/8 D4/8 | [A3/8 E4/8 C4/8 E4/8]x2 | [C4/8 G4/8 E4/8 G4/8]x2
pulse2: F3/8 C4/8 F4/8 A4/8 C5/8 A4/8 F4/8 C4/8 | G3/8 D4/8 G4/8 B4/8 D5/8 B4/8 G4/8 D4/8 | [D4/8 A4/8 F4/8 A4/8]x2 | [C4/8 G4/8 E4/8 G4/8]x2
triangle: [F2/8 F3/8]x4 | [G2/8 G3/8]x4 | [A2/8 A3/8]x4 | [C3/8 C4/8]x4
triangle: [F2/8 F3/8]x4 | [G2/8 G3/8]x4 | [D3/8 D4/8]x4 | [C3/8 C4/8]x4
noise: c/8 h/8@0.35 s/8@0.7 h/8@0.35 k/8 h/8@0.35 s/8@0.7 h/8@0.35
noise: [k/8 h/8@0.35 s/8@0.7 h/8@0.35 k/8 h/8@0.35 s/8@0.7 h/8@0.35 |]x6 k/8 h/8@0.35 s/8@0.7 h/8@0.35 s/16 s/16 s/16 s/16 s/8 s/8

section: A2
chords: F | G | Am | C | F | G | Bb | C
// the hook again with the echo behind it; bar 4 rises instead of falling
pulse1: C5/8 F5/8 G5/8 C6/2 B5/8 | B5/4. A5/8 G5/4 D5/4 | E5/8 A5/8 B5/8 E6/2 D6/8 | C6/4. D6/8 E6/8 r/8 G5/8 E5/8
// the hook, then a borrowed Bb climb and a breath before B
pulse1: C5/8 F5/8 G5/8 C6/2 B5/8 | B5/4. A5/8 G5/4 D5/4 | D5/8 F5/8 Bb5/8 D6/2 C6/8 | C6/4. G5/8 E5/4 r/4
echo pulse2: pulse1 delay=0.75 level=0.6
triangle: F2/8! F3/8 [F2/8 F3/8]x3 | G2/8! G3/8 [G2/8 G3/8]x3 | A2/8! A3/8 [A2/8 A3/8]x3 | C3/8! C4/8 [C3/8 C4/8]x3
triangle: F2/8! F3/8 [F2/8 F3/8]x3 | G2/8! G3/8 [G2/8 G3/8]x3 | Bb2/8! Bb3/8 [Bb2/8 Bb3/8]x3 | C3/8! C4/8 C3/8 C4/8 C3/8 D3/8 E3/8 C3/8
noise: o/8@0.6 h/8@0.35 s/8@0.7 h/8@0.35 k/8 k/8 s/8@0.7 h/8@0.35
noise: [k/8 h/8@0.35 s/8@0.7 h/8@0.35 k/8 k/8 s/8@0.7 o/8@0.4 |]x6 k/8 k/8 s/8@0.7 k/8 s/16 s/16 s/16 s/16 s/8 s/8

section: B
chords: Dm | Bb | F | C | Dm | Bb | G | C
duty pulse1: 0.25
// soaring long notes over strummed arpeggio chords
pulse1: A5/2. F5/4 | D6/2 C6/4 Bb5/4 | A5/2. C6/4 | G5/1v
pulse1: A5/2. D6/4 | F6/2 E6/4 D6/4 | D6/2 B5/4 G5/4 | C6/2.v r/4
pulse2: D4:037/8. D4:037/8. D4:037/8 r/2 | Bb3:047/8. Bb3:047/8. Bb3:047/8 r/2 | C4:059/8. C4:059/8. C4:059/8 r/2 | C4:047/8. C4:047/8. C4:047/8 r/2
// the second half trades the strums for a counter-line that moves while the lead holds
pulse2: D4/4 F4/4 A4/4 C5/4 | Bb4/8 C5/8 D5/4 F5/2 | G4/8 A4/8 B4/4 D5/4 B4/4 | E4/4 G4/4 C5/4 B4/8 G4/8
// walking bass
triangle: D2/4 A2/4 D3/4 A2/4 | Bb2/4 F2/4 Bb2/4 D3/4 | F2/4 C3/4 F3/4 C3/4 | C3/4 G2/4 C3/4 E3/4
triangle: D2/4 A2/4 D3/4 A2/4 | Bb2/4 F2/4 Bb2/4 D3/4 | G2/4 D3/4 G3/4 B2/4 | C3/4 G2/4 C3/4 E3/4
// half-time; a snare pickup ends the first phrase, an open hat and a push on 2-and drive the second
noise: c/4 h/8@0.35 h/8@0.35 s/4 h/8@0.35 h/8@0.35
noise: [k/4 h/8@0.35 h/8@0.35 s/4 h/8@0.35 h/8@0.35 |]x2 k/4 h/8@0.35 h/8@0.35 s/4 s/16@0.6 s/16@0.7 h/8@0.35
noise: o/4@0.5 h/8@0.35 k/8 s/4 h/8@0.35 h/8@0.35 | [k/4 h/8@0.35 k/8 s/4 h/8@0.35 h/8@0.35 |]x2 k/4 h/8@0.35 h/8@0.35 s/16 s/16 s/16 s/16 s/8 s/8

section: C
chords: Dm | G | Dm | G | Bb | C | Bb | C
duty pulse1: voice
duty pulse2: 0.5
// the lead calls with the hook's rhythm, pulse 2 answers while it rests, rounder at 50%
pulse1: D5/8 G5/8 A5/8 D6/2 C6/8 | B5/4. A5/8 G5/4 D5/4 | r/1 | r/1
pulse1: F5/8 Bb5/8 C6/8 F6/2 E6/8 | E6/4. D6/8 C6/4 G5/4 | r/1 | r/1
pulse2: r/2 F4/8 A4/8 D5/8 r/8 | B4/4. r/8 r/4 D4/8 G4/8 | A4/8 D5/8 E5/8 A5/2 G5/8 | G5/4. D5/8 B4/2
pulse2: r/2 Bb4/8 D5/8 F5/4 | E5/4. r/8 r/4 C5/8 E5/8 | Bb4/8 D5/8 F5/8 Bb5/2 A5/8 | G5/4. E5/8 C5/4 r/4
triangle: D2/8! D3/8 [D2/8 D3/8]x3 | G2/8! G3/8 [G2/8 G3/8]x3 | D2/8! D3/8 [D2/8 D3/8]x3 | G2/8! G3/8 [G2/8 G3/8]x3
triangle: Bb2/8! Bb3/8 [Bb2/8 Bb3/8]x3 | C3/8! C4/8 [C3/8 C4/8]x3 | Bb2/8! Bb3/8 [Bb2/8 Bb3/8]x3 | C3/8! C4/8 C3/8 C4/8 C3/8 B2/8 A2/8 G2/8
noise: c/8 h/8@0.35 s/8@0.7 k/8 k/8 h/8@0.35 s/8@0.7 h/8@0.35
noise: [k/8 h/8@0.35 s/8@0.7 k/8 k/8 h/8@0.35 s/8@0.7 h/8@0.35 |]x6 k/8 t/8@0.7 t/8@0.7 k/8 s/16 s/16 s/16 s/16 s/8 s/8

section: breakdown
chords: F | Em | Dm | G
duty pulse2: voice
// the lead rests; pulse 2 falls through the hook's rhythm in triads, each long note a shimmering arpeggio
pulse2: A4/8 C5/8 F5/8 F4:047c/2 r/8 | G4/8 B4/8 E5/8 E4:037c/2 r/8
pulse2: F4/8 A4/8 D5/8 D4:037c/2 r/8 | G4/8 B4/8 D5/8 G4:047c/4 B4/8 D5/8 G5/8
triangle: F2/8! F2/8 r/4 F2/8! F2/8 F3/4 | E2/8! E2/8 r/4 E2/8! E2/8 E3/4 | D2/8! D2/8 r/4 D2/8! D2/8 D3/4
triangle: G2/8! G2/8 B2/8 D3/8 G3/8 D3/8 B2/8 G2/8
noise: [k/4 h/8@0.3 t/8@0.6 r/8 h/8@0.3 t/8@0.6 t/8@0.5 |]x3 k/8 t/8@0.7 t/8@0.6 t/8@0.5 s/16 s/16 s/16 s/16 s/8 s/8

section: turnaround
chords: F | G | Bb | C
// the launch three times, a step higher each bar (C, D, F), then a tumble down onto the dominant
pulse1: C5/8 F5/8 G5/8 C6/4. r/8 A5/8 | D5/8 G5/8 A5/8 D6/4. r/8 B5/8 | F5/8 Bb5/8 C6/8 F6/4. r/8 D6/8 | C6/16 D6/16 E6/8 D6/8 C6/8 G5/4 E5/8 G5/8
// a slow line climbing in thirds under the launches
pulse2: A4/2 C5/2 | B4/2 D5/2 | D5/2 F5/2 | E5/4. D5/8 C5/4 B4/4
triangle: [F2/8 F3/8]x4 | [G2/8 G3/8]x4 | [Bb2/8 Bb3/8]x4 | C3/8! C4/8 C3/8 C4/8 C3/8 D3/8 E3/8 E2/8
noise: o/8@0.6 h/8@0.35 s/8@0.7 h/8@0.35 k/8 h/8@0.35 s/8@0.7 h/8@0.35
noise: [k/8 h/8@0.35 s/8@0.7 h/8@0.35 k/8 h/8@0.35 s/8@0.7 h/8@0.35 |]x2 k/8 s/16 s/16 k/8 s/16 s/16 s/8 s/8 s/8 s/8
`;

/** Cloudreach's first race track, "Updraft", parsed. */
export const cloudreach: Song = parseSong(cloudreachSource);
