import { describe, expect, it } from 'vitest';
import { type NoteEvent, parseSong } from './notation.ts';

/** Wraps channel lines in the two required headers. */
function song(body: string, headers = 'name: test\ntempo: 120'): string {
  return `${headers}\n${body}`;
}

/** The notes on one channel as compact [pitch, start, length] rows. */
function rows(source: string, channel: NoteEvent['channel'] = 'pulse1') {
  return parseSong(source)
    .notes.filter((note) => note.channel === channel)
    .map((note) => [note.pitch, note.start, note.length]);
}

describe('parseSong', () => {
  it('reads headers, voices and every note length, in beats from the song start', () => {
    const parsed = parseSong(`
      // a comment line
      name: demo
      tempo: 140
      voice pulse1: duty=0.25 level=0.6 attack=0.01 decay=0.2 sustain=0.4 release=0.1
      pulse1: C4/1 | D4/2 E4/4 F#4/8 Bb4/16 C5/32 C5/32 // trailing comment
    `);

    expect(parsed).toMatchObject({ name: 'demo', bpm: 140, beatsPerBar: 4, lengthBeats: 8, loopStart: null });
    expect(parsed.voices.pulse1).toEqual({
      duty: 0.25,
      level: 0.6,
      envelope: { attack: 0.01, decay: 0.2, sustain: 0.4, release: 0.1 },
    });
    expect(parsed.voices.triangle.duty).toBeUndefined();
    expect(parsed.notes.map((note) => [note.pitch, note.start, note.length])).toEqual([
      [60, 0, 4],
      [62, 4, 2],
      [64, 6, 1],
      [66, 7, 0.5],
      [70, 7.5, 0.25],
      [72, 7.75, 0.125],
      [72, 7.875, 0.125],
    ]);
  });

  it('lengthens dotted notes by half and leaves gaps for rests', () => {
    expect(rows(song('pulse1: C5/4. D5/8 r/4 E5/8. r/16'))).toEqual([
      [72, 0, 1.5],
      [74, 1.5, 0.5],
      [76, 3, 0.75],
    ]);
  });

  it('merges tied notes into one event, across bar lines', () => {
    expect(rows(song('pulse1: C5/2 G5/2~ | G5/4~ G5/8 r/8 E5/2'))).toEqual([
      [72, 0, 2],
      [79, 2, 3.5],
      [76, 6, 2],
    ]);
  });

  it('expands repeats, nested and spanning bar lines', () => {
    expect(rows(song('triangle: [[C3/8 C4/8]x2 G2/4 r/4 |]x2'), 'triangle')).toEqual([
      [48, 0, 0.5],
      [60, 0.5, 0.5],
      [48, 1, 0.5],
      [60, 1.5, 0.5],
      [43, 2, 1],
      [48, 4, 0.5],
      [60, 4.5, 0.5],
      [48, 5, 0.5],
      [60, 5.5, 0.5],
      [43, 6, 1],
    ]);
  });

  it('plays drums on noise and keeps slide, vibrato and velocity marks', () => {
    const parsed = parseSong(song('pulse1: A4/2>+5 A4/4v@0.5 A4/4@1\nnoise: k/4 s/4@0.8 h/4~ h/4'));

    expect(parsed.notes.filter((note) => note.channel === 'pulse1')).toEqual([
      { channel: 'pulse1', start: 0, length: 2, pitch: 69, velocity: 1, slideTo: 5 },
      { channel: 'pulse1', start: 2, length: 1, pitch: 69, velocity: 0.5, vibrato: true },
      { channel: 'pulse1', start: 3, length: 1, pitch: 69, velocity: 1 },
    ]);
    expect(rows(song('noise: k/4 s/4@0.8 h/4~ h/4'), 'noise')).toEqual([
      ['kick', 0, 1],
      ['snare', 1, 1],
      ['hat', 2, 2],
    ]);
  });

  it('counts bars in quarter-note beats for other time signatures', () => {
    const parsed = parseSong(song('pulse1: E5/4. D5/8 C5/4 | D5/2.', 'name: waltz\ntempo: 90\ntime: 3/4'));
    expect(parsed).toMatchObject({ beatsPerBar: 3, lengthBeats: 6 });
    expect(parseSong(song('pulse1: C5/4. C5/4. | C5/2.', 'name: jig\ntempo: 90\ntime: 6/8')).beatsPerBar).toBe(3);
  });

  it('starts sections where every channel lines up, rests silent channels and loops at a section', () => {
    const parsed = parseSong(`
      name: sections
      tempo: 120
      loop: verse
      section: intro
      triangle: C3/1 | G2/1
      section: verse
      pulse1: E5/1
      pulse1: G5/1
      triangle: [C3/2]x2 | [G2/2]x2
    `);

    expect(parsed.sections).toEqual([
      { name: 'intro', bar: 0 },
      { name: 'verse', bar: 2 },
    ]);
    expect(parsed).toMatchObject({ lengthBeats: 16, loopStart: 8 });
    expect(rows(`name: s\ntempo: 1\nsection: a\ntriangle: C3/1\nsection: b\npulse1: E5/1`)).toEqual([[76, 4, 4]]);
  });

  it.each([
    [
      'a bar that comes up short',
      'pulse1: C5/4 D5/4 E5/4 | F5/1',
      'pulse1 bar 1 (line 3), token "|": bar holds 3 beats',
    ],
    [
      'a bar at the end of a line that comes up short',
      'pulse1: C5/1 | C5/2',
      'pulse1 bar 2 (line 3), token "C5/2": bar holds 2',
    ],
    [
      'a note that runs past the bar line',
      'pulse2: C5/2. C5/2',
      'pulse2 bar 1 (line 3), token "C5/2": runs past the bar line',
    ],
    ['an empty bar', 'pulse1: C5/1 | | C5/1', 'pulse1 bar 2 (line 3), token "|": bar holds 0 beats'],
    ['an unknown division', 'pulse1: C5/1 | C5/3', 'pulse1 bar 2 (line 3), token "C5/3": unknown division /3'],
    ['a malformed token', 'triangle: C3/4 H3/4', 'triangle bar 1 (line 3), token "H3/4": expected a note'],
    ['an unknown modifier', 'pulse1: C5/1q', 'token "C5/1q": unknown modifier "q"'],
    ['a pitch on the noise channel', 'noise: k/4 C5/4', 'noise bar 1 (line 3), token "C5/4": noise plays drums'],
    ['a drum on a pitched channel', 'pulse1: k/1', 'token "k/1": pulse1 plays pitches'],
    ['vibrato on a drum', 'noise: s/1v', 'token "s/1v": drums take only'],
    ['a modifier on a rest', 'pulse1: r/1~', 'token "r/1~": rests take no modifiers'],
    [
      'a tie onto another pitch',
      'pulse1: C5/2~ D5/2',
      'token "D5/2": the tie from "C5/2~" must continue on the same pitch',
    ],
    ['a tie into a rest', 'pulse1: C5/2~ r/2', 'token "r/2": the tie from "C5/2~"'],
    ['a tie off the end of the song', 'pulse1: C5/1~', 'pulse1 bar 1 (line 3), token "C5/1~": tie runs past the end'],
    ['an unclosed repeat', 'pulse1: [C5/4 C5/4', 'token "[": repeat is never closed'],
    ['a repeat closed without a count', 'pulse1: [C5/2]', 'token "]": close a repeat with "]xN"'],
    ['a stray repeat close', 'pulse1: C5/1]x2', 'token "]x2": this "]xN" has no opening "["'],
  ])('rejects %s, naming the channel, bar and token', (_case, body, message) => {
    expect(() => parseSong(song(body))).toThrow(message);
  });

  it.each([
    [
      'channels of different lengths in a section',
      'section: a\npulse1: C5/1 | C5/1\ntriangle: C3/1',
      'has 1 bars but pulse1 has 2 in section "a"',
    ],
    [
      'a loop at a missing section',
      'loop: chorus\nsection: verse\npulse1: C5/1',
      'loop names section "chorus", which doesn\'t exist (sections: verse)',
    ],
    ['a duplicate section', 'section: a\npulse1: C5/1\nsection: a', 'section "a" is declared twice'],
    ['a duty on the triangle', 'voice triangle: duty=0.5', 'only pulse channels have a duty'],
    ['an unsupported duty', 'voice pulse1: duty=0.3', 'duty must be 0.125, 0.25, 0.5 or 0.75'],
    ['an unknown directive', 'tempoo: 120', 'unknown directive "tempoo"'],
    [
      'a time signature after notes',
      'pulse1: C5/1\ntime: 3/4',
      'the time signature must come before the first note line',
    ],
    ['a song with no notes', '', 'song "test" has no bars'],
  ])('rejects %s', (_case, body, message) => {
    expect(() => parseSong(song(body))).toThrow(message);
  });

  it('requires a name and a tempo', () => {
    expect(() => parseSong('tempo: 120\npulse1: C5/1')).toThrow('song is missing "name: <text>"');
    expect(() => parseSong('name: x\npulse1: C5/1')).toThrow('song "x" is missing "tempo: <bpm>"');
  });
});
