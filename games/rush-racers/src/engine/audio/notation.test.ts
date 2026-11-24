import { describe, expect, it } from 'vitest';
import { expandEcho } from './notation/echo.ts';
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
      { channel: 'pulse1', start: 2, length: 1, pitch: 69, velocity: 0.5, vibrato: true, echo: true },
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
    [
      'a tie into a rest',
      'pulse1: C5/2~ r/2',
      'pulse1 bar 1 (line 3), token "r/2": a tie can\'t continue into a rest; tie into C5 or drop the "~"',
    ],
    [
      'a tie into a section where the channel is silent',
      'section: a\npulse1: C5/1~\ntriangle: C3/1\nsection: b\ntriangle: C3/1',
      'pulse1 bar 1 (line 4), token "C5/1~": a tie can\'t continue into a rest; pulse1 is silent in section "b"',
    ],
    ['a tie off the end of the song', 'pulse1: C5/1~', 'pulse1 bar 1 (line 3), token "C5/1~": tie runs past the end'],
    ['an unclosed repeat', 'pulse1: [C5/4 C5/4', 'token "[": repeat is never closed'],
    ['a repeat closed without a count', 'pulse1: [C5/2]', 'token "]": close a repeat with "]xN"'],
    ['a stray repeat close', 'pulse1: C5/1]x2', 'token "]x2": this "]xN" has no opening "["'],
    [
      'a stray repeat close later in the line',
      'pulse1: C5/1 | C5/1 | C5/1 | C5/1 ]x2',
      'pulse1 bar 4 (line 3), token "]x2": this "]xN" has no opening "["',
    ],
    [
      'an unclosed repeat after an expanded one',
      'pulse1: [C5/1 |]x3 [C5/1',
      'pulse1 bar 4 (line 3), token "[": repeat is never closed',
    ],
  ])('rejects %s, naming the channel, bar and token', (_case, body, message) => {
    expect(() => parseSong(song(body))).toThrow(message);
  });

  it.each([
    [
      'channels of different lengths in a section',
      'section: a\npulse1: C5/1 | C5/1\ntriangle: C3/1',
      'triangle bar 2 (line 5): section "a" has 1 bar on triangle but 2 on pulse1',
    ],
    [
      'channels of different lengths in a later section, counting only that section',
      'section: x\npulse1: C5/1 | C5/1\ntriangle: C3/1 | C3/1\nsection: y\npulse1: C5/1 | C5/1 | C5/1\npulse2: C5/1 | C5/1',
      'pulse2 bar 5 (line 8): section "y" has 2 bars on pulse2 but 3 on pulse1',
    ],
    ['a section with no bars before another', 'section: a\nsection: b\npulse1: C5/1', 'section "a" has no bars'],
    [
      'a loop at an empty last section',
      'loop: end\nsection: a\npulse1: C5/1\nsection: end',
      'section "end" has no bars',
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
    ['a directive named like an object property', 'constructor: hi', 'unknown directive "constructor"'],
    [
      'a time signature after notes',
      'pulse1: C5/1\ntime: 3/4',
      'the time signature must come before the first note or chord line',
    ],
    [
      'a time signature after a chord line',
      'chords: C | G\ntime: 6/8\npulse1: C5/2. | C5/2.',
      'line 4 "time: 6/8": the time signature must come before the first note or chord line',
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

describe('parseSong titles and keys', () => {
  it('reads a title, keeping a colon inside it whole', () => {
    const parsed = parseSong(song('pulse1: C5/1', 'name: chase\ntitle: Hollow Chase: Reprise\ntempo: 120'));
    expect(parsed.title).toBe('Hollow Chase: Reprise');
  });

  it('uses the name as the title when there is no title header', () => {
    expect(parseSong(song('pulse1: C5/1', 'name: chase\ntempo: 120')).title).toBe('chase');
  });

  it('rejects an empty title', () => {
    expect(() => parseSong(song('title:\npulse1: C5/1'))).toThrow('line 3 "title:": needs a value');
  });

  it('reads a key into its tonic, mode and scale ascending from the tonic', () => {
    expect(parseSong(song('key: D dorian\npulse1: C5/1')).key).toEqual({
      tonic: 2,
      mode: 'dorian',
      scale: [2, 4, 5, 7, 9, 11, 0],
    });
    expect(parseSong(song('key: Bb harmonic-minor\npulse1: C5/1')).key).toEqual({
      tonic: 10,
      mode: 'harmonic-minor',
      scale: [10, 0, 1, 3, 5, 6, 9],
    });
  });

  it('has no key without a key header', () => {
    expect(parseSong(song('pulse1: C5/1')).key).toBeNull();
  });

  it('rejects an unknown mode, naming the line and listing the modes', () => {
    expect(() => parseSong(song('key: D blues\npulse1: C5/1'))).toThrow(
      'line 3 "key: D blues": unknown mode "blues"; use major, minor, dorian, mixolydian, lydian, phrygian or harmonic-minor',
    );
  });

  it('rejects an unknown key tonic, naming the line and listing the modes', () => {
    expect(() => parseSong(song('key: H dorian\npulse1: C5/1'))).toThrow(
      'line 3 "key: H dorian": unknown tonic "H"; use a letter A to G with an optional # or b, then one of the modes major, minor, dorian, mixolydian, lydian, phrygian or harmonic-minor',
    );
  });

  it('rejects a mode named like an object property as an unknown mode', () => {
    expect(() => parseSong(song('key: C constructor\npulse1: C5/1'))).toThrow(
      'line 3 "key: C constructor": unknown mode "constructor"',
    );
  });
});

describe('parseSong chord charts', () => {
  it('gives each bar its chord as a span in beats from the song start, with root and tones', () => {
    const parsed = parseSong(song('section: intro\npulse1: C5/1\nsection: A\nchords: Dm | G7\npulse1: C5/1 | C5/1'));
    expect(parsed.chords).toEqual([
      { start: 4, length: 4, symbol: 'Dm', root: 2, tones: [2, 5, 9] },
      { start: 8, length: 4, symbol: 'G7', root: 7, tones: [7, 11, 2, 5] },
    ]);
  });

  it('reads every chord quality', () => {
    const parsed = parseSong(song('chords: C Cm C7 Cm7 Cmaj7 Cdim Csus2 Csus4 C5 C6 Cm6 F#\npulse1: C5/1'));
    expect(parsed.chords.map((chord) => [chord.symbol, chord.tones])).toEqual([
      ['C', [0, 4, 7]],
      ['Cm', [0, 3, 7]],
      ['C7', [0, 4, 7, 10]],
      ['Cm7', [0, 3, 7, 10]],
      ['Cmaj7', [0, 4, 7, 11]],
      ['Cdim', [0, 3, 6]],
      ['Csus2', [0, 2, 7]],
      ['Csus4', [0, 5, 7]],
      ['C5', [0, 7]],
      ['C6', [0, 4, 7, 9]],
      ['Cm6', [0, 3, 7, 9]],
      ['F#', [6, 10, 1]],
    ]);
  });

  it('splits a bar evenly between the symbols written in it', () => {
    const parsed = parseSong(song('chords: Am D | Bb\npulse1: C5/1 | C5/1'));
    expect(parsed.chords.map((chord) => [chord.symbol, chord.start, chord.length])).toEqual([
      ['Am', 0, 2],
      ['D', 2, 2],
      ['Bb', 4, 4],
    ]);
  });

  it('expands repeats in chord lines and joins several chord lines in a section', () => {
    const parsed = parseSong(song('section: A\nchords: [Dm | C |]x2\nchords: G\npulse1: [C5/1 |]x5'));
    expect(parsed.chords.map((chord) => [chord.symbol, chord.start])).toEqual([
      ['Dm', 0],
      ['C', 4],
      ['Dm', 8],
      ['C', 12],
      ['G', 16],
    ]);
  });

  it('adds no spans for a section without a chords line', () => {
    expect(parseSong(song('section: A\npulse1: C5/1\nsection: B\nchords: G\npulse1: C5/1')).chords).toEqual([
      { start: 4, length: 4, symbol: 'G', root: 7, tones: [7, 11, 2] },
    ]);
  });

  it('rejects a chord chart covering the wrong number of bars, naming the section and both counts', () => {
    expect(() => parseSong(song('section: A\nchords: Dm | C | G\npulse1: C5/1 | C5/1'))).toThrow(
      'section "A" has 2 bars but its chords: lines cover 3',
    );
  });

  it('rejects an unknown chord symbol, naming the line and the symbol', () => {
    expect(() => parseSong(song('chords: Dm Hm7\npulse1: C5/1'))).toThrow(
      'line 3 "chords: Dm Hm7": unknown chord "Hm7"',
    );
    expect(() => parseSong(song('chords: Cadd9\npulse1: C5/1'))).toThrow('unknown chord "Cadd9"');
  });

  it.each([['Cconstructor'], ['CtoString']])('rejects the chord %s, named like an object property', (symbol) => {
    expect(() => parseSong(song(`chords: ${symbol}\npulse1: C5/1`))).toThrow(
      `line 3 "chords: ${symbol}": unknown chord "${symbol}"`,
    );
  });
});

describe('parseSong arpeggios, drops and drums', () => {
  it('reads an arpeggio as hex semitone offsets on the note', () => {
    const parsed = parseSong(song('pulse1: C4:047/2 A3:07c/2@0.5\ntriangle: C3:0af/1'));
    expect(parsed.notes.filter((note) => note.channel === 'pulse1')).toEqual([
      { channel: 'pulse1', start: 0, length: 2, pitch: 60, velocity: 1, arp: [0, 4, 7] },
      { channel: 'pulse1', start: 2, length: 2, pitch: 57, velocity: 0.5, arp: [0, 7, 12] },
    ]);
    expect(parsed.notes.find((note) => note.channel === 'triangle')?.arp).toEqual([0, 10, 15]);
  });

  it.each([
    ['one offset', 'pulse1: C4:0/1', 'token "C4:0/1": an arpeggio needs 2 to 6 offsets'],
    ['seven offsets', 'pulse1: C4:0123456/1', 'token "C4:0123456/1": an arpeggio needs 2 to 6 offsets'],
    ['an arpeggio on noise', 'noise: k:04/1', 'noise bar 1 (line 3), token "k:04/1": only pitched notes'],
    ['an arpeggio with a slide', 'pulse1: C4:047/1>+2', 'token "C4:047/1>+2": an arpeggio can\'t slide'],
  ])('rejects %s', (_case, body, message) => {
    expect(() => parseSong(song(body))).toThrow(message);
  });

  it('marks a triangle note with ! as a pitch-dropped thump', () => {
    expect(parseSong(song('triangle: C2/4! r/4 G3/4!@0.8 C3/4')).notes).toEqual([
      { channel: 'triangle', start: 0, length: 1, pitch: 36, velocity: 1, drop: true },
      { channel: 'triangle', start: 2, length: 1, pitch: 55, velocity: 0.8, drop: true },
      { channel: 'triangle', start: 3, length: 1, pitch: 48, velocity: 1 },
    ]);
  });

  it.each([
    ['a drop on a pulse', 'pulse1: C4/1!', 'token "C4/1!": only triangle notes take "!"'],
    ['a drop with a tie', 'triangle: C2/2!~ C2/2', 'token "C2/2!~": a drop can\'t take a tie, vibrato or slide'],
    ['a drop with vibrato', 'triangle: C2/1v!', 'token "C2/1v!": a drop can\'t take a tie, vibrato or slide'],
    ['a drop with a slide', 'triangle: C2/1!>+3', 'token "C2/1!>+3": a drop can\'t take a tie, vibrato or slide'],
    ['a drop with an arpeggio', 'triangle: C2:07/1!', 'token "C2:07/1!": a drop can\'t take an arpeggio'],
  ])('rejects %s', (_case, body, message) => {
    expect(() => parseSong(song(body))).toThrow(message);
  });

  it('plays an open hat, crash and noise tom on noise', () => {
    expect(rows(song('noise: o/4 c/4 t/4 k/4'), 'noise')).toEqual([
      ['openHat', 0, 1],
      ['crash', 1, 1],
      ['tom', 2, 1],
      ['kick', 3, 1],
    ]);
  });

  it.each([['o'], ['c'], ['t']])('rejects the drum %s on a pitched channel', (drum) => {
    expect(() => parseSong(song(`pulse2: ${drum}/1`))).toThrow(`token "${drum}/1": pulse2 plays pitches`);
  });
});

describe('parseSong voice detune and arpeggio speed', () => {
  it('reads detune, negative included, and arpeggio frames', () => {
    const parsed = parseSong(song('voice pulse1: detune=-12 arp=1\nvoice triangle: detune=7.5 arp=3\npulse1: C5/1'));
    expect(parsed.voices.pulse1).toMatchObject({ detune: -12, arpFrames: 1 });
    expect(parsed.voices.triangle).toMatchObject({ detune: 7.5, arpFrames: 3 });
    expect(parsed.voices.pulse2.detune).toBeUndefined();
    expect(parsed.voices.pulse2.arpFrames).toBeUndefined();
  });

  it.each([
    ['detune below -50', 'voice pulse1: detune=-51', 'detune must be -50..50 cents, got -51'],
    ['detune above 50', 'voice pulse2: detune=50.5', 'detune must be -50..50 cents, got 50.5'],
    ['detune on noise', 'voice noise: detune=5', 'noise has no pitch to detune'],
    [
      'a detune that is not a number',
      'voice pulse1: detune=abc',
      '"detune=abc" needs a number of cents from -50 to 50',
    ],
    ['arp frames of 0', 'voice pulse1: arp=0', 'arp must be 1, 2 or 3 frames, got 0'],
    ['arp frames of 4', 'voice pulse1: arp=4', 'arp must be 1, 2 or 3 frames, got 4'],
    ['a negative level', 'voice pulse1: level=-0.5', '"level=-0.5" needs a non-negative number'],
  ])('rejects %s', (_case, body, message) => {
    expect(() => parseSong(song(body))).toThrow(message);
  });
});

describe('parseSong duty changes', () => {
  it('sets the duty of later notes across sections until "voice" returns to the voice duty', () => {
    const parsed = parseSong(
      song(
        'section: a\npulse1: C5/1\nduty pulse1: 0.125\npulse1: D5/1\nsection: b\npulse1: E5/1\nduty pulse1: voice\npulse1: F5/1\npulse2: [C4/1 |]x2',
      ),
    );
    const pulse1 = parsed.notes.filter((note) => note.channel === 'pulse1');
    expect(pulse1.map((note) => [note.pitch, note.duty])).toEqual([
      [72, undefined],
      [74, 0.125],
      [76, 0.125],
      [77, undefined],
    ]);
    expect(parsed.notes.filter((note) => note.channel === 'pulse2').map((note) => note.duty)).toEqual([
      undefined,
      undefined,
    ]);
  });

  it.each([
    [
      'an unknown duty value',
      'duty pulse1: 0.3',
      'line 3 "duty pulse1: 0.3": duty must be 0.125, 0.25, 0.5, 0.75 or voice',
    ],
    ['a duty on the triangle', 'duty triangle: 0.5', 'line 3 "duty triangle: 0.5": only pulse1 and pulse2 have a duty'],
    ['a duty on noise', 'duty noise: 0.5', 'line 3 "duty noise: 0.5": only pulse1 and pulse2 have a duty'],
  ])('rejects %s', (_case, body, message) => {
    expect(() => parseSong(song(`${body}\npulse1: C5/1`))).toThrow(message);
  });
});

describe('parseSong echo', () => {
  it('plays the source notes of the section later and quieter, keeping pitch, arp, vibrato and slide', () => {
    const parsed = parseSong(
      song(
        'section: a\npulse1: C5/1\nsection: b\necho pulse2: pulse1 delay=0.5 level=0.5\nduty pulse1: 0.25\npulse1: C5:047/4@0.8 r/4 D5/4v E5/4>+2',
      ),
    );
    expect(parsed.notes.filter((note) => note.channel === 'pulse2')).toEqual([
      { channel: 'pulse2', start: 4.5, length: 1, pitch: 72, velocity: 0.4, arp: [0, 4, 7], echo: true },
      { channel: 'pulse2', start: 6.5, length: 1, pitch: 74, velocity: 0.5, vibrato: true },
      { channel: 'pulse2', start: 7.5, length: 0.5, pitch: 76, velocity: 0.5, slideTo: 2, echo: true },
    ]);
  });

  it('cuts each echoed note where the next echoed note starts', () => {
    const source: NoteEvent[] = [
      { channel: 'pulse1', start: 0, length: 3, pitch: 72, velocity: 1 },
      { channel: 'pulse1', start: 1, length: 1, pitch: 74, velocity: 1 },
    ];
    expect(expandEcho(source, { channel: 'pulse2', delay: 1, level: 0.5, sectionEnd: 8 })).toEqual([
      { channel: 'pulse2', start: 1, length: 1, pitch: 72, velocity: 0.5, echo: true },
      { channel: 'pulse2', start: 2, length: 1, pitch: 74, velocity: 0.5, echo: true },
    ]);
  });

  it('cuts echoes at the section end and drops notes that would start at or past it', () => {
    const source = song(
      'section: a\necho pulse1: pulse2 delay=2 level=0.5\npulse2: C5/2. D5/4\nsection: b\npulse2: E5/1',
    );
    expect(rows(source, 'pulse1')).toEqual([[72, 2, 2]]);
  });

  it('works whichever order the echo and the source lines come in', () => {
    const before = song('echo pulse2: pulse1 delay=1 level=0.5\npulse1: C5/2 D5/2');
    const after = song('pulse1: C5/2 D5/2\necho pulse2: pulse1 delay=1 level=0.5');
    expect(parseSong(after).notes).toEqual(parseSong(before).notes);
    expect(rows(after, 'pulse2')).toEqual([
      [72, 1, 2],
      [74, 3, 1],
    ]);
  });

  it.each([
    [
      'an echoing channel that also has lines',
      'section: a\necho pulse2: pulse1 delay=1 level=0.5\npulse1: C5/1\npulse2: C4/1',
      'line 4 "echo pulse2: pulse1 delay=1 level=0.5": pulse2 has its own lines in section "a"',
    ],
    ['a delay of 0', 'echo pulse2: pulse1 delay=0 level=0.5', 'delay must be above 0 and at most 4 beats, got 0'],
    [
      'a delay above 4',
      'echo pulse2: pulse1 delay=4.5 level=0.5',
      'delay must be above 0 and at most 4 beats, got 4.5',
    ],
    ['a level of 0', 'echo pulse2: pulse1 delay=1 level=0', 'level must be above 0 and at most 1, got 0'],
    ['a level above 1', 'echo pulse2: pulse1 delay=1 level=1.2', 'level must be above 0 and at most 1, got 1.2'],
    [
      'an echo of its own channel',
      'echo pulse2: pulse2 delay=1 level=0.5',
      'line 3 "echo pulse2: pulse2 delay=1 level=0.5": pulse2 can\'t echo itself; name the other pulse',
    ],
  ])('rejects %s', (_case, body, message) => {
    expect(() => parseSong(song(`${body}\npulse1: C5/1`))).toThrow(message);
  });
});

describe('parseSong source whitespace', () => {
  it('parses CRLF line endings, tabs between tokens and trailing spaces the same as a clean source', () => {
    const clean = [
      'name: ws',
      'title: Whitespace',
      'tempo: 120',
      'key: D dorian',
      'voice pulse1: duty=0.25 detune=-5',
      'section: a',
      'chords: Dm | C',
      'pulse1: C5/2 D5/2 | E5/1',
      'echo pulse2: pulse1 delay=0.5 level=0.5',
      'duty pulse1: 0.125',
      'triangle: [C3/4!]x4 | C3/1',
    ];
    const messy = clean.map((line) => `${line.replace(': ', ':\t').replaceAll(' ', ' \t')}  \t`).join('\r\n');
    expect(parseSong(messy)).toEqual(parseSong(clean.join('\n')));
  });
});
