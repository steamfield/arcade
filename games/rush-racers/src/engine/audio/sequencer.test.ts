import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChannelVoice, NoteEvent, Song } from './notation.ts';
import { createSequencer, type Sequencer } from './sequencer.ts';
import { env, midiToHz, type Synth } from './synth.ts';

/** An AudioParam that accepts every automation call; the bus gains are not under test. */
function param(): AudioParam {
  return {
    value: 1,
    setValueAtTime() {},
    linearRampToValueAtTime() {},
    cancelScheduledValues() {},
  } as unknown as AudioParam;
}

/** A synth on a hand-advanced clock that records each tone as `{ pitch, at }`. */
function clockedSynth(): { synth: Synth; clock: { currentTime: number }; heard: { pitch: number; at: number }[] } {
  const clock = { state: 'running', currentTime: 0 };
  const heard: { pitch: number; at: number }[] = [];
  const bus = () => ({ gain: param(), connect() {}, disconnect() {} }) as unknown as GainNode;
  const synth: Synth = {
    context: clock as unknown as AudioContext,
    master: bus(),
    createBus: bus,
    tone(_out, spec) {
      const pitch = Math.round(69 + 12 * Math.log2(spec.frequency / 440));
      expect(spec.frequency).toBeCloseTo(midiToHz(pitch));
      heard.push({ pitch, at: Math.round(spec.at * 1000) / 1000 });
    },
    noise() {},
    drum() {},
    setMuted() {},
  };
  return { synth, clock, heard };
}

const VOICE: ChannelVoice = { envelope: env(0.01, 0.1, 0.6, 0.05), level: 0.5 };

/**
 * Two bars of 4/4 at 120 bpm (half a second a beat), looping from the start: pulse1 plays
 * MIDI 60 + beat on each beat, and section `A` starts bar 1, `B` bar 2.
 */
function twoBarLoop(): Song {
  const notes: NoteEvent[] = Array.from({ length: 8 }, (_, beat) => ({
    channel: 'pulse1',
    start: beat,
    length: 1,
    pitch: 60 + beat,
    velocity: 1,
  }));
  return {
    name: 'loop',
    title: 'loop',
    key: null,
    chords: [],
    bpm: 120,
    beatsPerBar: 4,
    lengthBeats: 8,
    loopStart: 0,
    sections: [
      { name: 'A', bar: 0 },
      { name: 'B', bar: 1 },
    ],
    voices: { pulse1: VOICE, pulse2: VOICE, triangle: VOICE, noise: VOICE },
    notes,
  };
}

let sequencer: Sequencer | null = null;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  sequencer?.dispose();
  sequencer = null;
  vi.useRealTimers();
});

/** Moves the clock and the 25 ms timer forward together until `until` seconds, collecting sections. */
function runUntil(clock: { currentTime: number }, until: number): string[] {
  const sections: string[] = [];
  while (clock.currentTime < until) {
    clock.currentTime = Math.round((clock.currentTime + 0.025) * 1000) / 1000;
    vi.advanceTimersByTime(25);
    sections.push(...(sequencer?.poll().sections ?? []));
  }
  return sections;
}

describe('the sequencer started part-way through a song', () => {
  it('schedules nothing before the start beat and still loops back to the loop point', () => {
    const { synth, clock, heard } = clockedSynth();
    sequencer = createSequencer(synth, (error) => {
      throw error;
    });
    sequencer.play(twoBarLoop(), 4);
    const sections = runUntil(clock, 2.5);

    expect(heard).toEqual([
      { pitch: 64, at: 0.05 },
      { pitch: 65, at: 0.55 },
      { pitch: 66, at: 1.05 },
      { pitch: 67, at: 1.55 },
      { pitch: 60, at: 2.05 },
      { pitch: 61, at: 2.55 },
    ]);
    expect(sections).toEqual(['A']);
  });

  it('plays from the top when no start beat is given', () => {
    const { synth, clock, heard } = clockedSynth();
    sequencer = createSequencer(synth, (error) => {
      throw error;
    });
    sequencer.play(twoBarLoop());
    const sections = runUntil(clock, 2.1);

    expect(heard.map((note) => note.pitch)).toEqual([60, 61, 62, 63, 64]);
    expect(sections).toEqual(['B']);
  });
});

/** Moves the clock and the 25 ms timer forward until `until` seconds; the time a poll first said `ended`, or null. */
function endedAt(clock: { currentTime: number }, until: number): number | null {
  while (clock.currentTime < until) {
    clock.currentTime = Math.round((clock.currentTime + 0.025) * 1000) / 1000;
    vi.advanceTimersByTime(25);
    if (sequencer?.poll().ended) return clock.currentTime;
  }
  return null;
}

describe('a one-shot song', () => {
  it('is not reported ended until a crash on its last beat has rung out', () => {
    const { synth, clock } = clockedSynth();
    sequencer = createSequencer(synth, (error) => {
      throw error;
    });
    const crash: NoteEvent = { channel: 'noise', start: 3, length: 1, pitch: 'crash', velocity: 1 };
    sequencer.play({ ...twoBarLoop(), lengthBeats: 4, loopStart: null, sections: [], notes: [crash] });

    // The crash starts at 1.55 s and sounds for its 0.6 s length plus its 0.1 s release.
    const ended = endedAt(clock, 4);
    expect(ended).not.toBeNull();
    expect(ended).toBeGreaterThanOrEqual(1.55 + 0.6 + 0.1);
  });
});
