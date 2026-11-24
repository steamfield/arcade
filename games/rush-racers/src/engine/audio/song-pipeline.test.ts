import { describe, expect, it } from 'vitest';
import { formOf } from './analysis/form.ts';
import { bassRoots, chordFit } from './analysis/harmony.ts';
import { leadFacts } from './analysis/melody.ts';
import { peakLevel } from './analysis/mix.ts';
import { describeSong } from './analysis/report.ts';
import { parseSong } from './notation.ts';
import { playNote } from './play-note.ts';
import type { Synth } from './synth.ts';

type ToneSpec = Parameters<Synth['tone']>[1];

/** A four-bar song in 6/8 that uses every technique the notation offers. */
const source = `
name: soundcheck
title: Sound Check
tempo: 120
time: 6/8
key: D dorian
loop: A

voice pulse1: duty=0.25 level=0.5 attack=0.005 decay=0.1 sustain=0.6 release=0.05
voice pulse2: duty=0.5 level=0.3 detune=8 arp=2
voice triangle: level=0.7
voice noise: level=0.3

section: intro
chords: Dm | C
triangle: D2/8! D3/8 A2/8 D2/8! D3/8 A2/8 | C2/8! C3/8 G2/8 C2/8! C3/8 G2/8
noise: c/4. k/8 h/8 s/8 | k/8 h/8 h/8 s/8 t/8 o/8

section: A
chords: Dm | G
duty pulse1: 0.125
pulse1: D5/8 F5/8 A5/8 G5/4 r/8 | B4/8 D5/8 G5/8 r/4.
echo pulse2: pulse1 delay=0.5 level=0.5
triangle: D2/4. A2/4. | G2/4. D3/4.
noise: k/8 h/8 h/8 s/8 h/8 h/8 | k/8 h/8 h/8 s/8 h/8 h/8

section: B
chords: Dm | G
pulse1: F5/4.v D5/4. | G5/2 r/4
pulse2: D4:037/4. D4:037/4. | G3:047/4. G3:047/4.
triangle: D2/4. A2/4. | G2/4. D3/4.
noise: k/8 h/8 h/8 s/8 h/8 h/8 | k/8 h/8 h/8 s/8 h/8 h/8
`;

/** A synth that records what it is asked to play: only WebAudio itself is faked. */
function recordingSynth(): { synth: Synth; tones: ToneSpec[]; drums: string[] } {
  const tones: ToneSpec[] = [];
  const drums: string[] = [];
  const node = {} as GainNode;
  const synth: Synth = {
    context: { state: 'running', currentTime: 0 } as AudioContext,
    master: node,
    createBus: () => node,
    tone: (_out, spec) => tones.push(spec),
    noise() {},
    drum: (_out, drum) => drums.push(drum),
    setMuted() {},
  };
  return { synth, tones, drums };
}

describe('a song from notation to synth and analysis', () => {
  const song = parseSong(source);

  it('plays every technique the notation wrote', () => {
    const { synth, tones, drums } = recordingSynth();
    const secondsPerBeat = 60 / song.bpm;
    for (const note of song.notes)
      playNote(synth, synth.master, song, note, note.start * secondsPerBeat, secondsPerBeat);

    expect(new Set(drums)).toEqual(new Set(['crash', 'kick', 'hat', 'snare', 'tom', 'openHat']));
    expect(tones.filter((tone) => tone.glides).length, 'triangle drops').toBe(4);
    expect(tones.filter((tone) => tone.steps).length, 'arpeggios').toBe(4);
    expect(tones.filter((tone) => tone.duty === 0.125).length, 'lead notes after the duty change').toBe(10);
    expect(tones.filter((tone) => tone.detune === 8).length, 'detuned second pulse: 7 echoes and 4 arpeggios').toBe(11);
    expect(tones.filter((tone) => tone.vibrato).length).toBe(1);
  });

  it('measures the same song', () => {
    expect(song).toMatchObject({ title: 'Sound Check', meter: '6/8', beatsPerBar: 3 });
    expect(formOf(song)).toMatchObject({ introSeconds: 3, loopSeconds: 6, loopBars: 4 });
    expect(bassRoots(song)).toMatchObject({ bars: 6, rootOnDownbeat: 6 });
    expect(chordFit(song, 'pulse2').offenders).toEqual([]);
    expect(leadFacts(song).crossings).toEqual([]);
    expect(peakLevel(song).level).toBeGreaterThan(1);
    expect(describeSong(song)).toContain('6/8');
  });
});
