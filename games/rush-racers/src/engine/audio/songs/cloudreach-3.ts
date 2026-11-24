/**
 * Cloudreach's third race track, "Stormfront": D minor in 4/4 at 164 BPM, the thunderhead at the
 * top of the climb. Urgent repeated notes, a harmonic-minor dominant (A major, with its C sharp),
 * crashes and tom thunder, and a calm eye in the middle before the storm closes again.
 *
 * Form: intro (4 bars) | A (8) | A' (8) | B (8) | eye (8) | breakdown (4) | turnaround (8),
 * looping from the turnaround back to A: 44 bars, about 64 s.
 *
 * Chords:
 * - intro: Dm | Dm | Bb | A
 * - A: Dm | Bb | C | A | Dm | Bb | Gm | A
 * - A': Dm | Bb | C | A | Dm | Bb | Gm A | Dm (the dominant inside bar 7, resolving up to a high F)
 * - B: Gm | Dm | Bb | A | Gm | Dm | E | A (E, the dominant of A, for a brighter push)
 * - eye: F | Dm | Bb | C | F | Dm | Bb | A (the relative major, half-time and quiet)
 * - breakdown: Dm | Dm | Bb | A (thunder: toms, crashes, lightning arpeggios)
 * - turnaround: Gm | A | Bb | A | Gm | A | Bb | A, the dominant every other bar: a falling line,
 *   then the hook's hammer climbing to F6 and an A major arpeggio falling into A
 *
 * The hook (A, bars 1-2) is "A5 A5 (rest) A5 D6 C6 A5 | Bb5. A5 F5 (rest)": three hammered
 * repeated notes, a leap up a fourth to the peak D, a fall back, and a breath. Bar 3 sequences it a
 * step down from G5, bar 5 restates it, and its rhythm drives bar 7, A' and the turnaround. A'
 * answers it upside down, hammering a high E6 and falling to E5 before climbing the A chord. The
 * eye sings it in slow motion, the hammer in quarter notes over F.
 *
 * Voices:
 * - pulse 1 (25% lead) plays the hook; B thins it to 12.5% for the tense long notes (its high F6
 *   softer, with vibrato), the eye rounds it to 50% and softer, and the turnaround goes back to 25%.
 * - pulse 2 (12.5%) chugs off-beat chord tones under A's first four bars, then plays a counter-line
 *   that holds while the hammer moves (D5 C5 A4 F4 down the Dm bar); it echoes the lead a dotted
 *   eighth late in A', bursts arpeggios under B's first four bars and moves under the lead's held
 *   notes in its second four, rolls slow eighths in the eye, flashes lightning arpeggios in the
 *   intro and breakdown, and trembles in sixteenths through the turnaround.
 * - the triangle pumps root-octave eighths with pitch-dropped kicks, toms in the breakdown, and
 *   carries the world motif in the eye.
 * - the drums drive a two-step with a crash at each section start, go half-time in B (a snare
 *   pickup at bar 4, then an open hat, a kick on 2-and and a tom on 4), drop to
 *   kick and hats in the eye, and turn to tom thunder in the breakdown; every section ends in a fill.
 *
 * The world motif: Updraft's launch (up a fourth, a step and a fourth, three eighths and a long
 * note) is the bass line of the eye, from the root of each chord (F2 Bb2 C3 F3, C2 F2 G2 C3,
 * D2 G2 A2 D3, A1 D2 E2 A2; the Bb bars spell the plain triad instead).
 */
import { parseSong, type Song } from '../notation.ts';

/** Cloudreach's third race track in the game's notation. */
const source = `
name: cloudreach-3
title: Stormfront
tempo: 164
time: 4/4
key: D minor
loop: A

voice pulse1: duty=0.25 level=0.5 attack=0.005 decay=0.12 sustain=0.65 release=0.08
voice pulse2: duty=0.125 level=0.3 attack=0.002 decay=0.06 sustain=0.35 release=0.04 detune=-6
voice triangle: level=0.65 attack=0.002 decay=0.05 sustain=0.9 release=0.03
voice noise: level=0.32 attack=0.001 decay=0.08 sustain=0 release=0.02

section: intro
chords: Dm | Dm | Bb | A
pulse2: D4:037c/8 r/8 r/4 r/2 | r/2 D4:037c/8 r/8 r/4 | Bb3:047c/8 r/8 r/4 r/2 | [A3:047c/8 r/8]x4
triangle: [D2/8! D2/8 D3/8 D2/8]x2 | [D2/8! D2/8 D3/8 D2/8]x2 | [Bb1/8! Bb1/8 Bb2/8 Bb1/8]x2 | [A1/8! A1/8 A2/8 A1/8]x2
noise: c/4 t/8@0.6 t/8@0.5 k/4 t/8@0.6 t/8@0.5 | [k/8 h/8@0.3 h/8@0.3 h/8@0.3]x2 | [k/8 h/8@0.35 s/8@0.75 h/8@0.35]x2
noise: k/8 s/8@0.7 s/8@0.7 k/8 s/16 s/16 s/16 s/16 s/16 s/16 s/16 s/16

section: A
chords: Dm | Bb | C | A | Dm | Bb | Gm | A
// hook, then the same hammer a step down and an answer on the dominant
pulse1: A5/8 A5/8 r/8 A5/8 D6/4 C6/8 A5/8 | Bb5/4. A5/8 F5/4 r/4 | G5/8 G5/8 r/8 G5/8 C6/4 Bb5/8 G5/8 | A5/4. G5/8 E5/4 C#5/4
// hook, then a climb on Gm and the dominant reaching up to E6
pulse1: A5/8 A5/8 r/8 A5/8 D6/4 C6/8 A5/8 | Bb5/4. A5/8 F5/4 r/4 | Bb5/8 Bb5/8 r/8 Bb5/8 D6/4 C6/8 Bb5/8 | A5/4. C#6/8 E6/4 A5/4
pulse2: [r/8 F4/8 A4/8 F4/8]x2 | [r/8 F4/8 Bb4/8 F4/8]x2 | [r/8 E4/8 G4/8 E4/8]x2 | [r/8 C#4/8 E4/8 A4/8]x2
// the restated hook gets a counter-line instead: it holds while the hammer moves and steps down D, C, A, F
pulse2: D5/4. C5/8 A4/4 F4/4 | D5/2. Bb4/8 F4/8 | G4/4. A4/8 Bb4/4 D5/4 | C#5/2 E5/4 A4/4
triangle: D2/8! D3/8 [D2/8 D3/8]x3 | Bb1/8! Bb2/8 [Bb1/8 Bb2/8]x3 | C2/8! C3/8 [C2/8 C3/8]x3 | A1/8! A2/8 [A1/8 A2/8]x3
triangle: D2/8! D3/8 [D2/8 D3/8]x3 | Bb1/8! Bb2/8 [Bb1/8 Bb2/8]x3 | G1/8! G2/8 [G1/8 G2/8]x3 | A1/8! A2/8 A1/8 A2/8 A1/8 A2/8 C#3/8 E3/8
noise: c/8 h/8@0.35 s/8@0.75 h/8@0.35 k/8 k/8 s/8@0.75 h/8@0.35
noise: [k/8 h/8@0.35 s/8@0.75 h/8@0.35 k/8 k/8 s/8@0.75 h/8@0.35 |]x6 k/8 h/8@0.35 s/8@0.75 k/8 s/16 s/16 s/16 s/16 s/8 s/8

section: A2
chords: Dm | Bb | C | A | Dm | Bb | Gm A | Dm
// the hook with a dotted-eighth echo like rolling thunder; the answer turns it upside down (the
// hammer on a high E falling to E5, then a climb up the A chord), and the end reaches the high F
pulse1: A5/8 A5/8 r/8 A5/8 D6/4 C6/8 A5/8 | Bb5/4. A5/8 F5/4 r/4 | E6/8 E6/8 r/8 E6/8 C6/4 G5/8 E5/8 | A5/4. C#6/8 E6/4 r/4
pulse1: A5/8 A5/8 r/8 A5/8 D6/4 C6/8 A5/8 | Bb5/4. A5/8 F5/4 r/4 | Bb5/8 Bb5/8 r/8 Bb5/8 C#6/4 E6/8 A5/8 | D6/4. E6/8 F6/4 r/4
echo pulse2: pulse1 delay=0.75 level=0.55
triangle: [D2/8! D3/8 D2/8 D3/8]x2 | [Bb1/8! Bb2/8 Bb1/8 Bb2/8]x2 | [C2/8! C3/8 C2/8 C3/8]x2 | [A1/8! A2/8 A1/8 A2/8]x2
triangle: [D2/8! D3/8 D2/8 D3/8]x2 | [Bb1/8! Bb2/8 Bb1/8 Bb2/8]x2 | G1/8! G2/8 G1/8 G2/8 A1/8! A2/8 A1/8 A2/8 | D2/8! D3/8 D2/8 D3/8 D2/8 D3/8 F2/8 G2/8
noise: o/8@0.6 h/8@0.35 s/8@0.75 k/8 k/8 h/8@0.35 s/8@0.75 h/8@0.35
noise: [k/8 h/8@0.35 s/8@0.75 k/8 k/8 h/8@0.35 s/8@0.75 o/8@0.4 |]x6 k/8 k/8 s/8@0.75 k/8 s/16 s/16 s/16 s/16 s/8 s/8

section: B
chords: Gm | Dm | Bb | A | Gm | Dm | E | A
duty pulse1: 0.125
// long thin notes over arpeggio bursts, half-time drums
pulse1: D6/2 Bb5/4 G5/4 | A5/2. r/4 | F5/2 Bb5/4 D6/4 | C#6/2. r/4
pulse1: G5/2 Bb5/4 D6/4 | F6/2.v@0.8 E6/8 D6/8 | E6/2 B5/4 G#5/4 | A5/2. r/4
pulse2: G3:037/4 r/8 G3:037/8 r/2 | D4:037/4 r/8 D4:037/8 r/2 | Bb3:047/4 r/8 Bb3:047/8 r/2 | A3:047/4 r/8 A3:047/8 r/2
// then a counter-line that moves under the lead's held notes
pulse2: Bb4/8 A4/8 G4/4 D5/2 | A4/8 D5/8 F5/4 E5/4 D5/4 | G#4/8 B4/8 E5/4 B4/4 G#4/4 | A3:047/4 r/8 A3:047/8 r/4 C#4/8 E4/8
triangle: G2/8! G2/4. D3/4 G2/4 | D2/8! D2/4. A2/4 D2/4 | Bb2/8! Bb2/4. F2/4 Bb2/4 | A2/8! A2/4. E2/4 A2/4
triangle: G2/8! G2/4. D3/4 G2/4 | D2/8! D2/4. A2/4 D2/4 | E2/8! E2/4. B2/4 E2/4 | A2/8! A2/4. E2/4 A2/4
noise: c/8 h/8@0.3 h/8@0.3 h/8@0.3 s/4@0.8 h/8@0.3 k/8
noise: [k/8 h/8@0.3 h/8@0.3 h/8@0.3 s/4@0.8 h/8@0.3 k/8 |]x2 k/8 h/8@0.3 h/8@0.3 h/8@0.3 s/4@0.8 s/16@0.6 s/16@0.7 k/8
noise: o/8@0.5 h/8@0.3 h/8@0.3 h/8@0.3 s/4@0.8 h/8@0.3 k/8 | [k/8 h/8@0.3 h/8@0.3 k/8 s/4@0.8 t/8@0.5 k/8 |]x2 k/8 h/8@0.3 h/8@0.3 k/8 s/16 s/16 s/16 s/16 s/8 s/8

section: eye
chords: F | Dm | Bb | C | F | Dm | Bb | A
duty pulse1: 0.5
// the calm eye: the hook's hammer slowed to quarters, round and soft, slow arpeggios, and Updraft's launch walking in the bass
pulse1: A5/4@0.8 A5/4@0.8 r/4 A5/4@0.8 | D6/2.@0.8 C6/8@0.8 A5/8@0.8 | Bb5/1v@0.8 | C6/2@0.8 G5/2@0.8
pulse1: A5/4@0.8 A5/4@0.8 r/4 C6/4@0.8 | F6/2.@0.8 E6/8@0.8 D6/8@0.8 | D6/2@0.8 F5/2@0.8 | E5/2.v@0.8 r/4
pulse2: [F4/8@0.8 A4/8@0.8 C5/8@0.8 A4/8@0.8]x2 | [D4/8@0.8 F4/8@0.8 A4/8@0.8 F4/8@0.8]x2 | [D4/8@0.8 F4/8@0.8 Bb4/8@0.8 F4/8@0.8]x2 | [E4/8@0.8 G4/8@0.8 C5/8@0.8 G4/8@0.8]x2
pulse2: [F4/8@0.8 A4/8@0.8 C5/8@0.8 A4/8@0.8]x2 | [D4/8@0.8 F4/8@0.8 A4/8@0.8 F4/8@0.8]x2 | [D4/8@0.8 F4/8@0.8 Bb4/8@0.8 F4/8@0.8]x2 | [C#4/8@0.8 E4/8@0.8 A4/8@0.8 E4/8@0.8]x2
triangle: F2/8 Bb2/8 C3/8 F3/2 C3/8 | D2/8 G2/8 A2/8 D3/2 A2/8 | Bb1/8 D2/8 F2/8 Bb2/2 F2/8 | C2/8 F2/8 G2/8 C3/2 G2/8
triangle: F2/8 Bb2/8 C3/8 F3/2 C3/8 | D2/8 G2/8 A2/8 D3/2 A2/8 | Bb1/8 D2/8 F2/8 Bb2/2 F2/8 | A1/8 D2/8 E2/8 A2/2 E2/8
noise: o/4@0.4 h/4@0.3 k/4@0.7 h/4@0.3
noise: [k/4@0.7 h/4@0.3 o/4@0.3 h/4@0.3 |]x6 k/4@0.7 t/8@0.5 t/8@0.5 t/8@0.6 t/8@0.6 s/16 s/16 s/16 s/16

section: breakdown
chords: Dm | Dm | Bb | A
// the lead rests; thunder on the toms and lightning on pulse 2
pulse2: D4:037c/8 r/8 r/4 r/8 D4:037c/8 r/4 | D4:037c/8 r/8 r/4 r/8 D4:037c/8 r/4
pulse2: Bb3:047c/8 r/8 r/4 r/8 Bb3:047c/8 r/4 | [A3:047c/8 r/8]x3 A3:047c/4
triangle: D2/4 D3/8! D3/8! D2/4 D3/8! A2/8! | D2/4 D3/8! D3/8! D2/4 D3/8! A2/8!
triangle: Bb1/4 Bb2/8! Bb2/8! Bb1/4 F2/8! Bb2/8! | A1/4 A2/8! A2/8! A1/8 C#2/8 E2/8 A2/8
noise: c/4 t/8@0.7 t/8@0.6 k/4 t/8@0.6 t/8@0.5 | k/4 t/8@0.7 t/8@0.6 k/8 k/8 t/8@0.6 t/8@0.5
noise: c/4 t/8@0.7 t/8@0.6 k/4 t/8@0.6 t/8@0.5 | k/8 t/8@0.7 t/8@0.6 t/8@0.5 s/16 s/16 s/16 s/16 s/16 s/16 s/16 s/16

section: turnaround
chords: Gm | A | Bb | A | Gm | A | Bb | A
duty pulse1: voice
// a falling line leaning on the dominant, then the hook's hammer climbing Gm and Bb
pulse1: D6/4. C6/8 Bb5/4 G5/4 | A5/4. Bb5/8 C#6/2 | D6/4. C6/8 Bb5/4 F5/4 | E5/4. A5/8 C#6/4 r/4
pulse1: D6/8 D6/8 r/8 D6/8 G5/4 Bb5/8 D6/8 | C#6/4. E6/8 A5/4 r/4 | D6/8 D6/8 r/8 D6/8 F6/4 D6/8 Bb5/8 | A5/8 C#6/8 E6/8 C#6/8 A5/8 E5/8 C#5/8 E5/8
pulse2: [G3/16 Bb3/16 D4/16 Bb3/16]x4 | [A3/16 C#4/16 E4/16 C#4/16]x4 | [Bb3/16 D4/16 F4/16 D4/16]x4 | [A3/16 C#4/16 E4/16 C#4/16]x4
pulse2: [G3/16 Bb3/16 D4/16 Bb3/16]x4 | [A3/16 C#4/16 E4/16 C#4/16]x4 | [Bb3/16 D4/16 F4/16 D4/16]x4 | A3:047c/2 r/2
triangle: G1/8! G2/8 [G1/8 G2/8]x3 | A1/8! A2/8 [A1/8 A2/8]x3 | Bb1/8! Bb2/8 [Bb1/8 Bb2/8]x3 | A1/8! A2/8 [A1/8 A2/8]x3
triangle: G1/8! G2/8 [G1/8 G2/8]x3 | A1/8! A2/8 [A1/8 A2/8]x3 | Bb1/8! Bb2/8 [Bb1/8 Bb2/8]x3 | A1/8! A2/8 A1/8 A2/8 A1/8 C#2/8 E2/8 A2/8
noise: c/8 h/8@0.35 s/8@0.75 h/8@0.35 k/8 k/8 s/8@0.75 h/8@0.35
noise: [k/8 h/8@0.35 s/8@0.75 h/8@0.35 k/8 k/8 s/8@0.75 h/8@0.35 |]x5
noise: [k/8 h/16@0.3 h/16@0.3 s/8@0.75 h/16@0.3 h/16@0.3]x2 | k/8 s/16 s/16 s/8 s/16 s/16 s/16 s/16 s/16 s/16 s/8 s/8
`;

/** "Stormfront", Cloudreach's third race track, parsed. */
export const cloudreachThree: Song = parseSong(source);
