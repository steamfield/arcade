/**
 * Turns the game's drained events into sound: an effect per player-facing
 * event, and the music each screen wants (title theme, race theme from GO with
 * a tempo lift on the final stretch, a win or lose jingle into the results
 * loop). Every sound that actually starts is announced once as `audio.played`,
 * on the game's tick, so tests can hear the game. Nothing plays or is announced
 * while the AudioContext is not running (before the first gesture).
 */
import type { EventSink, Rng, Stamped } from '@arcade/core';
import type { RuntimeEvent } from '../runtime.ts';
import type { AudioPort } from './index.ts';
import type { Channel, NoteEvent, Song } from './notation.ts';
import type { Sequencer } from './sequencer.ts';
import { playSfx, type SfxKey } from './sfx.ts';
import { env, type Synth } from './synth.ts';

/** Every piece of music the game plays. */
export type SongName = 'title' | 'race' | 'win' | 'lose' | 'results';

/** What the adapter drives. */
export interface AdapterOptions {
  synth: Synth;
  sequencer: Sequencer;
  /** The gain stage effects play into. */
  sfxBus: AudioNode;
  /** The runtime's log, where `audio.played` goes. */
  events: EventSink<RuntimeEvent>;
  /** Cosmetic randomness for effect pitch; never shared with gameplay. */
  rng: Rng;
  /** Receives effects that WebAudio refused to schedule. */
  onError(error: unknown): void;
}

/** Final-stretch tempo, as a multiple of the race theme's own. */
const LIFT_TEMPO = 1.1;
/** Player progress (0..1) at which the final stretch starts. */
const LIFT_AT = 0.75;
/** Random pitch spread for effects: ±5%. */
const PITCH_SPREAD = 0.05;
/** Musical cues that must stay in tune with each other, so they skip the random pitch. */
const STEADY: ReadonlySet<SfxKey> = new Set(['countdown', 'go']);

/**
 * The song for `name`. The single place songs are chosen: until the soundtrack lands this
 * returns the placeholder test song (looping for themes, cut short and one-shot for jingles).
 */
export function songFor(name: SongName): Song {
  if (name === 'win' || name === 'lose') return { ...asJingle(PLACEHOLDER_SONG), name };
  return { ...PLACEHOLDER_SONG, name };
}

/** Builds the event-to-sound half of the `AudioPort`. */
export function createAdapter(options: AdapterOptions): Pick<AudioPort, 'onEvents' | 'onRaceProgress'> {
  const { synth, sequencer, events } = options;
  const running = () => synth.context.state === 'running';
  /** The music the current screen wants, or null for silence. */
  let wanted: SongName | null = null;
  /** The music actually started, which lags `wanted` while the context is suspended. */
  let started: SongName | null = null;
  let lifted = false;
  /**
   * The player's last announced place. Null until the race's first announcement, which only
   * replaces the grid order at GO, so it sets the baseline silently instead of sounding a drop.
   */
  let place: number | null = null;
  let won: boolean | null = null;

  const announce = (key: string, kind: 'sfx' | 'song') => events.emit({ type: 'audio.played', key, kind });

  const sfx = (key: SfxKey) => {
    if (!running()) return;
    const pitch = STEADY.has(key) ? 1 : 1 + (options.rng.next() * 2 - 1) * PITCH_SPREAD;
    try {
      playSfx(synth, options.sfxBus, key, synth.context.currentTime, { pitch });
    } catch (error) {
      options.onError(new Error(`Sound effect "${key}" could not be scheduled`, { cause: error }));
      return;
    }
    announce(key, 'sfx');
  };

  const syncMusic = () => {
    if (!running() || wanted === started) return;
    started = wanted;
    if (wanted === null) {
      sequencer.stop();
      return;
    }
    sequencer.play(songFor(wanted));
    announce(wanted, 'song');
  };

  const followSequencer = () => {
    if (!running() || started === null) return;
    const news = sequencer.poll();
    for (const section of news.sections) announce(`${started}:${section}`, 'song');
    if (news.ended && (started === 'win' || started === 'lose')) {
      wanted = 'results';
      syncMusic();
    }
  };

  const onEvent = (event: RuntimeEvent) => {
    switch (event.type) {
      case 'scene.started':
        if (event.scene === 'title') wanted = 'title';
        else if (event.scene === 'race') {
          wanted = null;
          lifted = false;
          place = null;
          won = null;
        } else if (event.scene === 'results') wanted = won === null ? 'results' : won ? 'win' : 'lose';
        return;
      case 'race.countdown':
        return sfx('countdown');
      case 'race.started':
        wanted = 'race';
        return sfx('go');
      case 'racer.kicked':
        if (event.id === 'player') sfx('kick');
        return;
      case 'racer.bumped':
        if (event.a === 'player' || event.b === 'player') sfx('bump');
        return;
      case 'player.place':
        if (place !== null && event.place !== place) sfx(event.place < place ? 'place.up' : 'place.down');
        place = event.place;
        return;
      case 'racer.finished':
        if (event.id === 'player') sfx('finish');
        return;
      case 'race.finished':
        won = event.playerPlace === 1 && event.playerTicks !== null;
        return;
      case 'coral.broken':
        return sfx('coral');
      case 'menu.selected':
        return sfx('menu.confirm');
    }
  };

  return {
    onEvents(drained: readonly Stamped<RuntimeEvent>[]) {
      for (const event of drained) onEvent(event);
      syncMusic();
      followSequencer();
    },
    onRaceProgress(fraction: number) {
      if (lifted || fraction < LIFT_AT || started !== 'race' || !running()) return;
      lifted = true;
      sequencer.setTempoScale(LIFT_TEMPO);
      announce('race:lift', 'song');
    },
  };
}

/** Cuts a song to its first two bars and plays it once, for the placeholder jingles. */
function asJingle(song: Song): Song {
  const lengthBeats = song.beatsPerBar * 2;
  return {
    ...song,
    lengthBeats,
    loopStart: null,
    sections: [],
    notes: song.notes.filter((note) => note.start < lengthBeats),
  };
}

/** Back-to-back notes of `beats` each on one channel, from beat `start`. */
function line(channel: Channel, start: number, beats: number, pitches: NoteEvent['pitch'][]): NoteEvent[] {
  return pitches.map((pitch, i) => ({ channel, start: start + i * beats, length: beats, pitch, velocity: 1 }));
}

/**
 * A 4-bar test song in C major exercising all four voices, two sections and the loop, so the
 * sequencer can be heard before the real soundtrack lands. Not part of the game's music.
 */
const PLACEHOLDER_SONG: Song = {
  name: 'placeholder',
  bpm: 140,
  beatsPerBar: 4,
  lengthBeats: 16,
  loopStart: 0,
  sections: [
    { name: 'A', bar: 0 },
    { name: 'B', bar: 2 },
  ],
  voices: {
    pulse1: { duty: 0.5, envelope: env(0.005, 0.1, 0.6, 0.05), level: 0.3 },
    pulse2: { duty: 0.25, envelope: env(0.005, 0.08, 0.4, 0.05), level: 0.15 },
    triangle: { envelope: env(0.005, 0.02, 0.9, 0.03), level: 0.5 },
    noise: { envelope: env(0.001, 0.05, 0, 0.02), level: 0.3 },
  },
  notes: [
    ...line('pulse1', 0, 1, [72, 76, 79, 76, 77, 81, 79, 77, 76, 79, 84, 79, 74, 79, 72, 72]),
    ...line('pulse2', 0, 2, [64, 67, 65, 64, 67, 64, 65, 64]),
    ...line('triangle', 0, 1, [48, 55, 48, 55, 53, 60, 55, 43, 48, 55, 48, 55, 43, 50, 48, 55]),
    ...line(
      'noise',
      0,
      1,
      Array.from({ length: 16 }, (_, beat) => (beat % 2 === 0 ? 'kick' : 'snare')),
    ),
  ],
};
