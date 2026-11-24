import { describe, expect, it } from 'vitest';
import type { ChannelVoice, Drum, NoteEvent, Song } from './notation.ts';
import { playNote } from './play-note.ts';
import { env, midiToHz, type Synth } from './synth.ts';

type ToneSpec = Parameters<Synth['tone']>[1];

/** What the fake synth was asked to play. */
interface Heard {
  tones: ToneSpec[];
  drums: { drum: Drum; at: number; level: number }[];
}

/** A synth that records each note it is asked for: only WebAudio itself is faked. */
function recordingSynth(): { synth: Synth; heard: Heard } {
  const heard: Heard = { tones: [], drums: [] };
  const node = {} as GainNode;
  const synth: Synth = {
    context: { state: 'running', currentTime: 0 } as AudioContext,
    master: node,
    createBus: () => node,
    tone: (_out, spec) => heard.tones.push(spec),
    noise() {},
    drum: (_out, drum, at, level) => heard.drums.push({ drum, at, level }),
    setMuted() {},
  };
  return { synth, heard };
}

const VOICE: ChannelVoice = { envelope: env(0.01, 0.1, 0.6, 0.05), level: 0.5 };

/** A 120 bpm song whose voices are `VOICE` with `overrides` merged in per channel. */
function songWith(overrides: Partial<Record<keyof Song['voices'], Partial<ChannelVoice>>> = {}): Song {
  const voice = (channel: keyof Song['voices']) => ({ ...VOICE, ...overrides[channel] });
  return {
    name: 'test',
    title: 'test',
    key: null,
    chords: [],
    bpm: 120,
    beatsPerBar: 4,
    meter: '4/4',
    lengthBeats: 4,
    loopStart: 0,
    sections: [],
    voices: { pulse1: voice('pulse1'), pulse2: voice('pulse2'), triangle: voice('triangle'), noise: voice('noise') },
    notes: [],
  };
}

/** A full-velocity quarter-note-long event at beat 0, with `fields` merged in. */
function note(fields: Partial<NoteEvent>): NoteEvent {
  return { channel: 'pulse1', start: 0, length: 1, pitch: 60, velocity: 1, ...fields };
}

const HALF_BEAT_SECONDS = 0.5;

/** Plays one note at time 2 on a 0.5 s-per-beat song and returns what the synth heard. */
function play(song: Song, event: NoteEvent): Heard {
  const { synth, heard } = recordingSynth();
  playNote(synth, synth.master, song, event, 2, HALF_BEAT_SECONDS);
  return heard;
}

const round = (value: number) => Math.round(value * 1000) / 1000;

describe('playNote', () => {
  it("plays a note's duty over the voice's own", () => {
    const song = songWith({ pulse1: { duty: 0.25 } });
    expect(play(song, note({ duty: 0.75 })).tones.map((t) => t.duty)).toEqual([0.75]);
    expect(play(song, note({})).tones.map((t) => t.duty)).toEqual([0.25]);
  });

  it("detunes every tone of a detuned voice and leaves other voices' tones alone", () => {
    const song = songWith({ triangle: { detune: -12 } });
    expect(play(song, note({ channel: 'triangle', pitch: 40 })).tones[0]?.detune).toBe(-12);
    expect(play(song, note({ channel: 'triangle', pitch: 40, drop: true })).tones[0]?.detune).toBe(-12);
    expect(play(song, note({ pitch: 60, arp: [0, 4, 7] })).tones[0]?.detune).toBeUndefined();
  });

  it('steps an arpeggio through its offsets every two frames for the length of the note', () => {
    const [tone] = play(songWith(), note({ pitch: 60, length: 1, arp: [0, 4, 7] })).tones;
    const cycle = [60, 64, 67].map(midiToHz);
    const expected = Array.from({ length: 15 }, (_, i) => ({ frequency: cycle[i % 3], at: round(2 + i / 30) }));
    expect(tone?.frequency).toBe(midiToHz(60));
    expect(tone?.steps?.map((s) => ({ frequency: s.frequency, at: round(s.at) }))).toEqual(expected);
    expect(tone?.length).toBe(0.5);
  });

  it("paces an arpeggio by the voice's arpFrames, not the tempo", () => {
    const song = songWith({ pulse2: { arpFrames: 3 } });
    const [tone] = play(song, note({ channel: 'pulse2', length: 1, arp: [0, 12] })).tones;
    expect(tone?.steps?.map((s) => round(s.at - 2))).toEqual([0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45]);
  });

  it('drops a triangle thump from two octaves up to the pitch in 50 ms, then to an octave below', () => {
    const [tone] = play(
      songWith(),
      note({ channel: 'triangle', pitch: 36, length: 1, drop: true, velocity: 0.8 }),
    ).tones;
    expect(tone?.wave).toBe('triangle');
    expect(tone?.frequency).toBe(midiToHz(60));
    expect(tone?.glides?.map((g) => ({ frequency: round(g.frequency), at: round(g.at) }))).toEqual([
      { frequency: round(midiToHz(36)), at: 2.05 },
      { frequency: round(midiToHz(24)), at: 2.5 },
    ]);
    expect(tone?.level).toBe(0.4);
    expect(tone?.envelope.sustain).toBe(0);
    expect(round((tone?.envelope.attack ?? 0) + (tone?.envelope.decay ?? 0))).toBeLessThanOrEqual(0.121);
  });

  it('fades a drop shorter than its decay out by its own end', () => {
    const [tone] = play(songWith(), note({ channel: 'triangle', pitch: 36, length: 0.08, drop: true })).tones;
    expect(round(tone?.envelope.decay ?? 1)).toBeLessThanOrEqual(0.04);
    expect(tone?.glides?.map((g) => round(g.at))).toEqual([2.04]);
  });

  it('sends each drum to its kit entry at the voice level times velocity', () => {
    const drums: Drum[] = ['kick', 'snare', 'hat', 'openHat', 'crash', 'tom'];
    const heard = drums.flatMap(
      (drum) => play(songWith(), note({ channel: 'noise', pitch: drum, velocity: 0.5 })).drums,
    );
    expect(heard).toEqual(drums.map((drum) => ({ drum, at: 2, level: 0.25 })));
  });

  it('plays a slide to its target pitch and keeps vibrato', () => {
    const [tone] = play(songWith(), note({ pitch: 60, slideTo: -12, vibrato: true })).tones;
    expect(tone).toEqual({
      wave: 'pulse',
      duty: 0.5,
      frequency: midiToHz(60),
      at: 2,
      length: 0.5,
      envelope: VOICE.envelope,
      level: 0.5,
      slideTo: midiToHz(48),
      vibrato: true,
    });
  });
});
