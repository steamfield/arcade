/**
 * Cloudreach's race song, "Updraft": F lydian in 4/4 at 132 BPM, a lifting chase over a steady
 * pulse. The raised fourth (B natural over F) keeps it airy and unresolved, like a climb that keeps
 * going.
 *
 * Form: intro (2 bars, bass, pulse and drums) | A (8) | B (8) | turnaround (4), looping from the
 * turnaround back to A.
 *
 * Chords:
 * - intro: F | G (the lydian lift, a major chord a step above the tonic)
 * - A: F | G | Am | C | F | G | Dm | C
 * - B: Dm | Bb | F | C | Dm | Bb | G | C (long soaring notes; Bb for warmth, E over Bb for air)
 * - turnaround: F | G | Bb | C, a run of eighths that ends on the dominant
 *
 * The hook (A, bars 1-2) is "C5 F5 G5 C6 B5 | B5. A5 G5 D5": a launch up a fourth, a step and a
 * fourth to a long high C that slips to the lydian B, then a glide down. It is stated in bars 1-2
 * and 5-6 of A, and sequenced a major third higher in bar 3. Pulse 2 is the steady pulse: a rolling
 * eighth-note arpeggio on the chord in every section. The triangle drives root-octave eighths (walking
 * quarters in B), and the drums keep a backbeat (half-time in B) with a fill at the end of every
 * section.
 */
import { parseSong, type Song } from '../notation.ts';

/** Cloudreach's race song in the game's notation. */
export const cloudreachSource = `
name: cloudreach
tempo: 132
time: 4/4
loop: A

voice pulse1: duty=0.5 level=0.48 attack=0.02 decay=0.15 sustain=0.7 release=0.12
voice pulse2: duty=0.125 level=0.24 attack=0.005 decay=0.06 sustain=0.4 release=0.04
voice triangle: level=0.65 attack=0.002 decay=0.05 sustain=0.9 release=0.03
voice noise: level=0.28 attack=0.001 decay=0.08 sustain=0 release=0.02

section: intro
pulse2: [F3/8 C4/8 A3/8 C4/8]x2 | [G3/8 D4/8 B3/8 D4/8]x2
triangle: [F2/8 F3/8]x4 | [G2/8 G3/8]x4
noise: [k/8 h/8@0.35]x4 | k/8 h/8@0.35 k/8 h/8@0.35 s/16 s/16 s/16 s/16 s/8 s/8

section: A
// hook, then the same launch a major third higher
pulse1: C5/8 F5/8 G5/8 C6/2 B5/8 | B5/4. A5/8 G5/4 D5/4 | E5/8 A5/8 B5/8 E6/2 D6/8 | C6/4. B5/8 G5/4 E5/4
// hook, then the highest launch and a glide onto the dominant
pulse1: C5/8 F5/8 G5/8 C6/2 B5/8 | B5/4. A5/8 G5/4 D5/4 | F5/8 A5/8 D6/8 F6/2 E6/8 | D6/4. C6/8 G5/2v
pulse2: [F3/8 C4/8 A3/8 C4/8]x2 | [G3/8 D4/8 B3/8 D4/8]x2 | [A3/8 E4/8 C4/8 E4/8]x2 | [C4/8 G4/8 E4/8 G4/8]x2
pulse2: [F3/8 C4/8 A3/8 C4/8]x2 | [G3/8 D4/8 B3/8 D4/8]x2 | [D4/8 A4/8 F4/8 A4/8]x2 | [C4/8 G4/8 E4/8 G4/8]x2
triangle: [F2/8 F3/8]x4 | [G2/8 G3/8]x4 | [A2/8 A3/8]x4 | [C3/8 C4/8]x4
triangle: [F2/8 F3/8]x4 | [G2/8 G3/8]x4 | [D3/8 D4/8]x4 | [C3/8 C4/8]x4
noise: [k/8 h/8@0.35 s/8@0.7 h/8@0.35 k/8 h/8@0.35 s/8@0.7 h/8@0.35 |]x7 k/8 h/8@0.35 s/8@0.7 h/8@0.35 s/16 s/16 s/16 s/16 s/8 s/8

section: B
// soaring long notes over the same rolling pulse
pulse1: A5/2. F5/4 | D6/2 C6/4 Bb5/4 | A5/2. C6/4 | G5/1v
pulse1: A5/2. D6/4 | F6/2 E6/4 D6/4 | D6/2 B5/4 G5/4 | C6/2.v r/4
pulse2: [D4/8 A4/8 F4/8 A4/8]x2 | [Bb3/8 F4/8 D4/8 F4/8]x2 | [F3/8 C4/8 A3/8 C4/8]x2 | [C4/8 G4/8 E4/8 G4/8]x2
pulse2: [D4/8 A4/8 F4/8 A4/8]x2 | [Bb3/8 F4/8 D4/8 F4/8]x2 | [G3/8 D4/8 B3/8 D4/8]x2 | [C4/8 G4/8 E4/8 G4/8]x2
// walking bass
triangle: D2/4 A2/4 D3/4 A2/4 | Bb2/4 F2/4 Bb2/4 D3/4 | F2/4 C3/4 F3/4 C3/4 | C3/4 G2/4 C3/4 E3/4
triangle: D2/4 A2/4 D3/4 A2/4 | Bb2/4 F2/4 Bb2/4 D3/4 | G2/4 D3/4 G3/4 B2/4 | C3/4 G2/4 C3/4 E3/4
// half-time
noise: [k/4 h/8@0.35 h/8@0.35 s/4 h/8@0.35 h/8@0.35 |]x7 k/4 h/8@0.35 h/8@0.35 s/16 s/16 s/16 s/16 s/8 s/8

section: turnaround
pulse1: C5/8 F5/8 A5/8 C6/8 A5/8 F5/8 G5/8 A5/8 | B5/8 G5/8 D5/8 G5/8 B5/8 D6/8 C6/8 B5/8 | Bb5/8 D6/8 F6/8 D6/8 Bb5/8 F5/8 D5/8 F5/8 | E5/8 G5/8 C6/8 E6/8 D6/4. G5/8
pulse2: [F3/8 C4/8 A3/8 C4/8]x2 | [G3/8 D4/8 B3/8 D4/8]x2 | [Bb3/8 F4/8 D4/8 F4/8]x2 | [C4/8 G4/8 E4/8 G4/8]x2
triangle: [F2/8 F3/8]x4 | [G2/8 G3/8]x4 | [Bb2/8 Bb3/8]x4 | [C3/8 C4/8]x4
noise: [k/8 h/8@0.35 s/8@0.7 h/8@0.35 k/8 h/8@0.35 s/8@0.7 h/8@0.35 |]x3 k/8 s/16 s/16 k/8 s/16 s/16 s/8 s/8 s/8 s/8
`;

/** Cloudreach's race song, parsed. */
export const cloudreach: Song = parseSong(cloudreachSource);
