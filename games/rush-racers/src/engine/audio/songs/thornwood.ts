/**
 * Thornwood's race song, "Hollow Chase": D dorian in 6/8 at 156 BPM, a bouncy jig that runs
 * through the trees. A beat is a quarter note, so a bar is three beats of two eighths each.
 *
 * Form: intro (2 bars, bass and drums) | A (8) | B (8) | turnaround (4), looping from the
 * turnaround back to A.
 *
 * Chords:
 * - intro: Dm | A
 * - A: Dm | C | G | Dm | Dm | C | G | A (i, bVII, IV, i, then the dominant pulls back)
 * - B: Bb | F | C | Dm | Bb | F | Gm | A (the borrowed flat sixth, lead in long notes)
 * - turnaround: Dm | Gm | A | A (a run of eighths that ends on the dominant)
 *
 * The hook (A, bars 1-2) is "D5 F5 A5 G5 F5 | E5 G5 E5 C5.": a rising arpeggio and a falling step,
 * then a rocking third that lands on the bar's last beat. It is stated in bars 1-2 and 5-6 of A.
 * Pulse 2 plays a lilting off-beat figure on the chord tones (an arpeggio in B), the triangle
 * bounces root, octave and fifth, and the drums keep kick on 1 and snare on 4 (half-time in B)
 * with a fill at the end of every section.
 */
import { parseSong, type Song } from '../notation.ts';

/** Thornwood's race song in the game's notation. */
const thornwoodSource = `
name: thornwood
tempo: 156
time: 6/8
loop: A

voice pulse1: duty=0.5 level=0.5 attack=0.005 decay=0.1 sustain=0.6 release=0.06
voice pulse2: duty=0.25 level=0.28 attack=0.005 decay=0.08 sustain=0.45 release=0.04
voice triangle: level=0.7 attack=0.002 decay=0.05 sustain=0.9 release=0.03
voice noise: level=0.32 attack=0.001 decay=0.08 sustain=0 release=0.02

section: intro
triangle: [D2/8 D3/8 A2/8]x2 | [A2/8 A3/8 E3/8]x2
noise: k/8 h/8@0.4 h/8@0.4 s/8 h/8@0.4 h/8@0.4 | k/8 h/8@0.4 h/8@0.4 s/16 s/16 s/16 s/16 s/8

section: A
// hook, answer, a leap to the high G, a rocking cadence
pulse1: D5/8 F5/8 A5/8 G5/4 F5/8 | E5/8 G5/8 E5/8 C5/4. | D5/8 G5/8 B5/8 A5/4 G5/8 | F5/4.v D5/4.
// hook again, then a climb to the dominant
pulse1: D5/8 F5/8 A5/8 G5/4 F5/8 | E5/8 G5/8 E5/8 C5/4. | B4/8 D5/8 G5/8 B5/4 A5/8 | C#5/8 E5/8 A5/8 G5/4 E5/8
pulse2: [r/8 F4/8 A4/8]x2 | [r/8 E4/8 G4/8]x2 | [r/8 D4/8 B4/8]x2 | [r/8 F4/8 A4/8]x2
pulse2: [r/8 F4/8 A4/8]x2 | [r/8 E4/8 G4/8]x2 | [r/8 D4/8 B4/8]x2 | [r/8 C#4/8 E4/8]x2
triangle: [D2/8 D3/8 A2/8]x2 | [C3/8 C2/8 G2/8]x2 | [G2/8 G3/8 D3/8]x2 | [D2/8 D3/8 A2/8]x2
triangle: [D2/8 D3/8 A2/8]x2 | [C3/8 C2/8 G2/8]x2 | [G2/8 G3/8 D3/8]x2 | [A2/8 A3/8 E3/8]x2
noise: [k/8 h/8@0.4 h/8@0.4 s/8 h/8@0.4 h/8@0.4 |]x7 k/8 h/8@0.4 h/8@0.4 s/16 s/16 s/16 s/16 s/8

section: B
// long notes, lower than A; the arpeggio moves underneath
pulse1: D5/4. Bb4/4. | C5/4. A4/4. | G4/4. C5/4. | D5/2 r/4
pulse1: D5/4. F5/4. | A5/4. F5/4. | G5/8 F5/8 D5/8 Bb4/4 D5/8 | C#5/8 D5/8 E5/8 A5/4.
pulse2: [Bb3/8 D4/8 F4/8]x2 | [A3/8 C4/8 F4/8]x2 | [G3/8 C4/8 E4/8]x2 | [A3/8 D4/8 F4/8]x2
pulse2: [Bb3/8 D4/8 F4/8]x2 | [A3/8 C4/8 F4/8]x2 | [G3/8 Bb3/8 D4/8]x2 | [A3/8 C#4/8 E4/8]x2
// half-time bass
triangle: Bb2/4. F3/4. | F2/4. C3/4. | C3/4. G2/4. | D3/4. A2/4.
triangle: Bb2/4. F3/4. | F2/4. C3/4. | G2/4. D3/4. | A2/4. E3/4.
noise: [k/4. h/8@0.3 h/8@0.3 s/8 |]x7 k/4. s/16 s/16 s/16 s/16 s/8

section: turnaround
pulse1: D5/8 E5/8 F5/8 G5/8 A5/8 F5/8 | G5/8 F5/8 D5/8 Bb4/8 D5/8 G5/8 | A5/8 G5/8 E5/8 C#5/8 E5/8 A5/8 | E5/8 F5/8 E5/8 C#5/4 E5/8
pulse2: [r/8 F4/8 A4/8]x2 | [r/8 Bb3/8 D4/8]x2 | [r/8 C#4/8 E4/8]x2 | [r/8 C#4/8 E4/8]x2
triangle: [D2/8 D3/8 A2/8]x2 | [G2/8 G3/8 D3/8]x2 | [A2/8 A3/8 E3/8]x2 | [A2/8 A3/8 E3/8]x2
noise: [k/8 h/8@0.4 h/8@0.4 s/8 h/8@0.4 h/8@0.4 |]x3 k/8 s/16 s/16 k/8 s/16 s/16 s/8 s/8
`;

/** Thornwood's race song, parsed. */
export const thornwood: Song = parseSong(thornwoodSource);
