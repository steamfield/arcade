/**
 * The music half of the audio adapter: which song each screen wants (title theme, race theme from GO
 * with a tempo lift on the final stretch, a win or lose jingle into the results loop), starting it once
 * the AudioContext is running and announcing each song and section as `audio.played`. It remembers
 * whether the local racer won, since the results screen's jingle depends on it, and lets the sound
 * test audition any song in place of the screen's own until the next scene.
 */
import type { RacerId } from '../../logic/types.ts';
import { FINAL_STRETCH_AT } from '../race-progress.ts';
import type { RuntimeEvent } from '../runtime.ts';
import type { Song } from './notation.ts';
import type { Sequencer } from './sequencer.ts';
import { type SongName, songs } from './songs/index.ts';

/** Final-stretch tempo, as a multiple of the race theme's own. */
const LIFT_TEMPO = 1.1;

/** What the music cues drive. */
export interface MusicCueOptions {
  sequencer: Sequencer;
  /** Whether sound can play; nothing starts or is announced while it can't. */
  running(): boolean;
  /** Announces a song or section that started, as `audio.played`. */
  announce(key: string, kind: 'song'): void;
  /** The slot the screen follows, whose finish decides the win or lose jingle. */
  localRacer(): RacerId;
  /** The song the current race plays; read once when each race starts. */
  raceSong(): SongName;
}

/** The music state machine. */
export interface MusicCues {
  /** Updates the music the screen wants from `event`: scene changes, the race starting and finishing. */
  onEvent(event: RuntimeEvent): void;
  /** Starts or stops the wanted music, then announces what the sequencer reached and moves a jingle on to the results loop. */
  sync(): void;
  /** Lifts the race theme's tempo once the leader reaches the final stretch (`fraction` of the way round). */
  onRaceProgress(fraction: number): void;
  /**
   * Plays `name` at once from its start, or from the first beat of `section`, holding it until the
   * next audition or `scene.started`; null stops the music. A one-shot jingle ends in silence.
   *
   * @throws {Error} When `section` is not one of the song's sections; the music is left as it was.
   */
  audition(name: SongName | null, section?: string): void;
}

/**
 * The key suffix `audio.played` carries when a one-shot song has finished sounding, as `<song>:end`.
 * Section announcements share the `<song>:<name>` form, so the notation reserves both marks
 * (`RESERVED_SECTION_NAMES`) and no section can be mistaken for one.
 */
export const SONG_ENDED = 'end';
/** The key suffix for the final-stretch tempo lift, as `<song>:lift`. */
export const SONG_LIFTED = 'lift';

/** The song for `name`. The single place songs are chosen. */
export function songFor(name: SongName): Song {
  return songs[name];
}

/**
 * The beat `section` of `song` starts on.
 *
 * @throws {Error} When `song` has no section called `section`.
 */
function sectionStartBeat(song: Song, section: string): number {
  const found = song.sections.find((candidate) => candidate.name === section);
  if (found) return found.bar * song.beatsPerBar;
  const known = song.sections.map((candidate) => `"${candidate.name}"`).join(', ') || 'none';
  throw new Error(`Song "${song.name}" has no section "${section}"; its sections are ${known}.`);
}

/** The jingle that ends a race on the results screen, kept until the results loop takes over. */
function isJingle(name: SongName | null): boolean {
  return name === 'win' || name === 'lose';
}

/** Creates music cues that want silence until a scene starts. */
export function createMusicCues(options: MusicCueOptions): MusicCues {
  const { sequencer, running, announce } = options;
  /** The music the current screen wants, or null for silence. */
  let wanted: SongName | null = null;
  /** The music actually started, which lags `wanted` while the context is suspended. */
  let started: SongName | null = null;
  /** The beat the next start plays from; only an audition of a section moves it off 0. */
  let fromBeat = 0;
  /** Whether the next start replays `wanted` even when it is already playing, as an audition does. */
  let restart = false;
  /** Whether an audition holds the music until the next scene. */
  let auditioning = false;
  /** Whether the results screen chose a win or lose jingle, which moves on to the results loop when it ends. */
  let jingleLeadsToResults = false;
  /** The track this race plays, read once at GO; null outside a race. */
  let raceTrack: SongName | null = null;
  let lifted = false;
  let won: boolean | null = null;
  /** Whether the local racer crossed the line this race; `race.finished` only says whether slot 1 did. */
  let localFinished = false;

  const start = () => {
    if (!running() || (wanted === started && !restart)) return;
    started = wanted;
    restart = false;
    const beat = fromBeat;
    fromBeat = 0;
    if (wanted === null) {
      sequencer.stop();
      return;
    }
    sequencer.play(songFor(wanted), beat);
    announce(wanted, 'song');
  };

  const followSequencer = () => {
    if (!running() || started === null) return;
    const news = sequencer.poll();
    for (const section of news.sections) announce(`${started}:${section}`, 'song');
    // A one-shot that ran out is news too: the sound test shows it as no longer playing.
    if (news.ended) announce(`${started}:${SONG_ENDED}`, 'song');
    if (news.ended && jingleLeadsToResults && isJingle(started)) {
      jingleLeadsToResults = false;
      wanted = 'results';
      start();
    }
  };

  const onSceneStarted = (scene: string) => {
    auditioning = false;
    jingleLeadsToResults = scene === 'results' && won !== null;
    fromBeat = 0;
    restart = false;
    if (scene === 'title') wanted = 'title';
    else if (scene === 'race') {
      wanted = null;
      raceTrack = null;
      lifted = false;
      won = null;
      localFinished = false;
    } else if (scene === 'results') wanted = won === null ? 'results' : won ? 'win' : 'lose';
  };

  return {
    onEvent(event) {
      switch (event.type) {
        case 'scene.started':
          return onSceneStarted(event.scene);
        case 'race.started':
          raceTrack = options.raceSong();
          if (!auditioning) wanted = raceTrack;
          return;
        case 'racer.finished':
          if (event.id === options.localRacer()) localFinished = true;
          return;
        case 'race.finished':
          won = event.standings[0] === options.localRacer() && localFinished;
          return;
        default:
      }
    },
    sync() {
      start();
      followSequencer();
    },
    onRaceProgress(fraction) {
      if (lifted || fraction < FINAL_STRETCH_AT || started === null || started !== raceTrack || !running()) return;
      lifted = true;
      sequencer.setTempoScale(LIFT_TEMPO);
      announce(`${started}:${SONG_LIFTED}`, 'song');
    },
    audition(name, section) {
      const beat = name !== null && section !== undefined ? sectionStartBeat(songFor(name), section) : 0;
      auditioning = true;
      jingleLeadsToResults = false;
      wanted = name;
      fromBeat = beat;
      restart = true;
      start();
    },
  };
}
