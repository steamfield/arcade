/**
 * The notation's types: the public song contract the sequencer consumes (re-exported from
 * `../notation.ts`), plus the source positions every parser stage uses for errors. A leaf
 * module, so the stages and `notation.ts` import it without a cycle.
 */

/** The four voices, like classic handheld hardware. */
export type Channel = 'pulse1' | 'pulse2' | 'triangle' | 'noise';

/** Pulse-wave duty cycle as a fraction of the period. */
export type Duty = 0.125 | 0.25 | 0.5 | 0.75;

/** A volume shape for each note: times in seconds, levels 0..1. */
export interface Envelope {
  attack: number;
  decay: number;
  sustain: number;
  release: number;
}

/** One note or drum hit. Times are in beats from the song start; rests produce no event. */
export interface NoteEvent {
  channel: Channel;
  /** Start in beats. */
  start: number;
  /** Length in beats. */
  length: number;
  /** MIDI note number for pitched channels; for noise, the drum: 'kick' | 'snare' | 'hat'. */
  pitch: number | 'kick' | 'snare' | 'hat';
  /** 0..1 relative to the channel's level. */
  velocity: number;
  /** Semitones to slide to over the note, if any. */
  slideTo?: number;
  vibrato?: boolean;
}

/** Per-channel voice settings for a song. */
export interface ChannelVoice {
  duty?: Duty;
  envelope: Envelope;
  /** 0..1 mix level. */
  level: number;
}

/** A parsed song, ready to schedule. */
export interface Song {
  name: string;
  /** Beats per minute at tempo scale 1. */
  bpm: number;
  /** Beats per bar (time signature numerator over a quarter-note beat). */
  beatsPerBar: number;
  /** Total length in beats. */
  lengthBeats: number;
  /** Beat the song jumps back to when it loops, or null for one-shot jingles. */
  loopStart: number | null;
  /** Bar numbers (0-based) where a named section starts, for `audio.played` section events. */
  sections: { name: string; bar: number }[];
  voices: Record<Channel, ChannelVoice>;
  notes: NoteEvent[];
}

/** Where in the source a token sits, so every error can point at it. */
export interface Place {
  channel: Channel;
  /** 0-based bar; messages show it 1-based. */
  bar: number;
  line: number;
  token: string;
}

/** A source line, for errors in header lines that have no channel or bar. */
export interface Line {
  number: number;
  text: string;
}
