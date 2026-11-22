/**
 * Plays one `Song` at a time on the synth with lookahead scheduling: a 25 ms
 * timer schedules every note due in the next 100 ms on the AudioContext clock,
 * so timing is sample-accurate however late the timer fires. Loops jump back
 * to the song's loop point without a gap, the tempo can lift mid-song, and a
 * new song crossfades over the old one. Audio clock only: gameplay never reads it.
 */
import type { NoteEvent, Song } from './notation.ts';
import { midiToHz, type Synth } from './synth.ts';

/** What changed since the last poll, reported on the game's tick rather than the timer's. */
export interface SequencerNews {
  /** Names of song sections that started playing, in order. */
  sections: string[];
  /** True once a one-shot song has finished sounding. */
  ended: boolean;
}

/** The music player. */
export interface Sequencer {
  /** The playing song's name, or null when silent. */
  readonly playing: string | null;
  /** Starts `song` now, crossfading out whatever was playing. */
  play(song: Song): void;
  /** Fades the current song out. */
  stop(): void;
  /** Speeds the current song up or down (1.0..1.15) from the next unscheduled note, without restarting. */
  setTempoScale(scale: number): void;
  /** Sections reached and whether a one-shot ended, since the last call. */
  poll(): SequencerNews;
  dispose(): void;
}

/** The standard lookahead pattern: wake every 25 ms, schedule 100 ms ahead. */
const TIMER_MS = 25;
const SCHEDULE_AHEAD = 0.1;
const CROSSFADE = 0.1;
/** First note lands this far after play(), so it is never scheduled in the past. */
const START_DELAY = 0.05;
/** A faded-out song keeps its bus this long, covering the notes already scheduled into it. */
const RETIRE_AFTER_MS = (CROSSFADE + SCHEDULE_AHEAD) * 1000 + 100;
const MIN_TEMPO_SCALE = 1;
const MAX_TEMPO_SCALE = 1.15;

/** A note or a section mark at a beat of the song, in playing order. */
interface Cue {
  beat: number;
  note?: NoteEvent;
  section?: string;
}

/** One song in flight: where its schedule is, and how beats map to context time. */
interface Playback {
  song: Song;
  cues: Cue[];
  bus: GainNode;
  next: number;
  /** Timeline beat at which the current pass of the song began (grows by a loop's length each loop). */
  passStart: number;
  /** Beat-to-time anchor: `anchorBeat` (timeline beats) sounds at `anchorTime`. */
  anchorBeat: number;
  anchorTime: number;
  secondsPerBeat: number;
  /** Section marks scheduled but not yet heard. */
  marks: { name: string; time: number }[];
  /** Context time a one-shot song stops sounding, once its last note is scheduled. */
  endTime: number | null;
}

/**
 * Creates the sequencer. `onError` receives scheduling failures (WebAudio refusing a node);
 * the failing song is stopped so a broken note can't report itself every 25 ms.
 */
export function createSequencer(synth: Synth, onError: (error: unknown) => void): Sequencer {
  const context = synth.context;
  let current: Playback | null = null;

  const pump = () => {
    if (!current) return;
    try {
      schedule(synth, current, context.currentTime + SCHEDULE_AHEAD);
    } catch (error) {
      onError(new Error(`Song "${current.song.name}" stopped: a note could not be scheduled`, { cause: error }));
      fadeOut(current);
      current = null;
    }
  };
  const timer = setInterval(pump, TIMER_MS);

  const fadeOut = (playback: Playback) => {
    const now = context.currentTime;
    playback.bus.gain.cancelScheduledValues(now);
    playback.bus.gain.setValueAtTime(playback.bus.gain.value, now);
    playback.bus.gain.linearRampToValueAtTime(0, now + CROSSFADE);
    setTimeout(() => playback.bus.disconnect(), RETIRE_AFTER_MS);
  };

  return {
    get playing() {
      return current?.song.name ?? null;
    },
    play(song) {
      if (current) fadeOut(current);
      current = startPlayback(synth, song);
      pump();
    },
    stop() {
      if (current) fadeOut(current);
      current = null;
    },
    setTempoScale(scale) {
      if (!current) return;
      const clamped = Math.min(MAX_TEMPO_SCALE, Math.max(MIN_TEMPO_SCALE, scale));
      retime(current, 60 / (current.song.bpm * clamped));
    },
    poll() {
      if (!current) return { sections: [], ended: false };
      const now = context.currentTime;
      const heard = current.marks.filter((mark) => mark.time <= now);
      current.marks = current.marks.filter((mark) => mark.time > now);
      const ended = current.endTime !== null && now >= current.endTime;
      if (ended) current = null;
      return { sections: heard.map((mark) => mark.name), ended };
    },
    dispose() {
      clearInterval(timer);
      if (current) fadeOut(current);
      current = null;
    },
  };
}

/** A fresh playback of `song` starting shortly after now, fading in over the crossfade. */
function startPlayback(synth: Synth, song: Song): Playback {
  const now = synth.context.currentTime;
  const bus = synth.createBus(0);
  bus.gain.setValueAtTime(0, now);
  bus.gain.linearRampToValueAtTime(1, now + CROSSFADE);
  return {
    song,
    cues: cuesOf(song),
    bus,
    next: 0,
    passStart: 0,
    anchorBeat: 0,
    anchorTime: now + START_DELAY,
    secondsPerBeat: 60 / song.bpm,
    marks: [],
    endTime: null,
  };
}

/** The song's notes and section marks in beat order; a section sorts before notes on its beat. */
function cuesOf(song: Song): Cue[] {
  const sections: Cue[] = song.sections.map((s) => ({ beat: s.bar * song.beatsPerBar, section: s.name }));
  const notes: Cue[] = song.notes.map((note) => ({ beat: note.start, note }));
  return [...sections, ...notes].sort((a, b) => a.beat - b.beat || (a.section ? -1 : b.section ? 1 : 0));
}

/** Schedules every cue that sounds before `horizon`, looping as needed. */
function schedule(synth: Synth, playback: Playback, horizon: number): void {
  const { song, cues } = playback;
  for (;;) {
    if (playback.next >= cues.length && !wrap(playback)) return;
    const cue = cues[playback.next];
    if (!cue) return;
    const time = timeOf(playback, playback.passStart + cue.beat);
    if (time > horizon) return;
    // The song's start is announced as a song start, so a section on its first beat isn't news.
    if (cue.section && !(playback.passStart === 0 && cue.beat === 0)) playback.marks.push({ name: cue.section, time });
    if (cue.note) playNote(synth, playback, cue.note, time);
    // Re-anchoring on each scheduled cue lets a tempo change apply from the next cue without moving this one.
    playback.anchorBeat = playback.passStart + cue.beat;
    playback.anchorTime = time;
    playback.next++;
    if (playback.next >= cues.length && song.loopStart === null) {
      playback.endTime = endTimeOf(playback);
    }
  }
}

/** Jumps a looping song's schedule back to its loop point. Returns false for one-shots or an empty loop. */
function wrap(playback: Playback): boolean {
  const { song, cues } = playback;
  if (song.loopStart === null) return false;
  const loopStart = song.loopStart;
  const first = cues.findIndex((cue) => cue.beat >= loopStart);
  if (first < 0 || song.lengthBeats <= loopStart) return false;
  // The loop point of the next pass sounds where this pass's end would have: on the beat after the last bar.
  playback.passStart += song.lengthBeats - loopStart;
  playback.next = first;
  return true;
}

/** Context time of a timeline beat under the playback's current tempo. */
function timeOf(playback: Playback, beat: number): number {
  return playback.anchorTime + (beat - playback.anchorBeat) * playback.secondsPerBeat;
}

/** Changes the tempo from the last scheduled cue on; earlier notes keep their times. */
function retime(playback: Playback, secondsPerBeat: number): void {
  playback.secondsPerBeat = secondsPerBeat;
  if (playback.endTime !== null) playback.endTime = endTimeOf(playback);
}

/** Plays one note event at `time` on its channel's voice. */
function playNote(synth: Synth, playback: Playback, note: NoteEvent, time: number): void {
  const voice = playback.song.voices[note.channel];
  const level = voice.level * note.velocity;
  if (typeof note.pitch !== 'number') {
    synth.drum(playback.bus, note.pitch, time, level);
    return;
  }
  const frequency = midiToHz(note.pitch);
  synth.tone(playback.bus, {
    wave: note.channel === 'triangle' ? 'triangle' : 'pulse',
    duty: voice.duty ?? 0.5,
    frequency,
    at: time,
    length: note.length * playback.secondsPerBeat,
    envelope: voice.envelope,
    level,
    ...(note.slideTo !== undefined && { slideTo: midiToHz(note.pitch + note.slideTo) }),
    ...(note.vibrato && { vibrato: true }),
  });
}

/** When a one-shot stops sounding: its last bar's end plus the longest release, so the last note rings out. */
function endTimeOf(playback: Playback): number {
  const { song } = playback;
  const release = Math.max(...Object.values(song.voices).map((voice) => voice.envelope.release));
  return timeOf(playback, playback.passStart + song.lengthBeats) + release;
}
