/**
 * The music half of the audio adapter: which song each screen wants (title theme, race theme from GO
 * with a tempo lift on the final stretch, a win or lose jingle into the results loop), starting it once
 * the AudioContext is running and announcing each song and section as `audio.played`. It remembers
 * whether the local racer won, since the results screen's jingle depends on it.
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
  /** The song the current race plays; read when each race starts. */
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
}

/** The song for `name`. The single place songs are chosen. */
export function songFor(name: SongName): Song {
  return songs[name];
}

/** Creates music cues that want silence until a scene starts. */
export function createMusicCues(options: MusicCueOptions): MusicCues {
  const { sequencer, running, announce } = options;
  /** The music the current screen wants, or null for silence. */
  let wanted: SongName | null = null;
  /** The music actually started, which lags `wanted` while the context is suspended. */
  let started: SongName | null = null;
  let lifted = false;
  let won: boolean | null = null;
  /** Whether the local racer crossed the line this race; `race.finished` only says whether slot 1 did. */
  let localFinished = false;

  const start = () => {
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
      start();
    }
  };

  return {
    onEvent(event) {
      switch (event.type) {
        case 'scene.started':
          if (event.scene === 'title') wanted = 'title';
          else if (event.scene === 'race') {
            wanted = null;
            lifted = false;
            won = null;
            localFinished = false;
          } else if (event.scene === 'results') wanted = won === null ? 'results' : won ? 'win' : 'lose';
          return;
        case 'race.started':
          wanted = options.raceSong();
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
      if (lifted || fraction < FINAL_STRETCH_AT || started !== options.raceSong() || !running()) return;
      lifted = true;
      sequencer.setTempoScale(LIFT_TEMPO);
      announce(`${started}:lift`, 'song');
    },
  };
}
