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

/** The noise channel's kit: `k`, `s`, `h`, `o`, `c` and `t` in the notation. */
export type Drum = 'kick' | 'snare' | 'hat' | 'openHat' | 'crash' | 'tom';

/** One note or drum hit. Times are in beats from the song start; rests produce no event. */
export interface NoteEvent {
  channel: Channel;
  /** Start in beats. */
  start: number;
  /** Length in beats. */
  length: number;
  /** MIDI note number for pitched channels; for noise, the drum. */
  pitch: number | Drum;
  /** 0..1 relative to the channel's level. */
  velocity: number;
  /** Semitones to slide to over the note, if any. */
  slideTo?: number;
  vibrato?: boolean;
  /** Pulse duty for this note, when a `duty` directive overrides the voice's own. */
  duty?: Duty;
  /**
   * Arpeggio: semitone offsets from `pitch` the note steps through in order, repeating for its
   * length, one step every `ChannelVoice.arpFrames` sixtieths of a second. Two to six offsets.
   */
  arp?: readonly number[];
  /** True for a note an `echo` directive wrote: a delayed copy of the other pulse's note. */
  echo?: true;
  /** Triangle only: a pitch-dropped thump, a kick on a low note and a tom on a higher one. */
  drop?: boolean;
}

/** Per-channel voice settings for a song. */
export interface ChannelVoice {
  duty?: Duty;
  /** Detune of every tone of the voice in cents, -50..50; 0 when omitted. */
  detune?: number;
  /** Sixtieths of a second per arpeggio step: 1, 2 or 3; 2 when omitted. */
  arpFrames?: 1 | 2 | 3;
  envelope: Envelope;
  /** 0..1 mix level. */
  level: number;
}

/** One chord of a section's chord chart. The chart annotates a song for analysis; it never changes what plays. */
export interface ChordSpan {
  /** Start in beats from the song start. */
  start: number;
  /** Length in beats. */
  length: number;
  /** As written, e.g. `Dm` or `G7`. */
  symbol: string;
  /** The root's pitch class, 0 (C) to 11 (B). */
  root: number;
  /** The chord's pitch classes, root first. */
  tones: readonly number[];
}

/** A song's declared key, from its `key:` header. */
export interface SongKey {
  /** The tonic's pitch class, 0 (C) to 11 (B). */
  tonic: number;
  /** The mode as written, e.g. `dorian`. */
  mode: string;
  /** The mode's pitch classes, ascending from the tonic. */
  scale: readonly number[];
}

/** A parsed song, ready to schedule. */
export interface Song {
  name: string;
  /** The name shown to people, from the `title:` header; the same as `name` without one. */
  title: string;
  /** The declared key, or null when the song has no `key:` header. */
  key: SongKey | null;
  /** The chord chart in beat order; empty when no section has a `chords:` line. */
  chords: ChordSpan[];
  /** Beats per minute at tempo scale 1. */
  bpm: number;
  /** Beats per bar (time signature numerator over a quarter-note beat). */
  beatsPerBar: number;
  /** The time signature as written, e.g. `6/8`; `4/4` without a `time:` header. */
  meter: string;
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
