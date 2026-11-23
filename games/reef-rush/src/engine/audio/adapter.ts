/**
 * Turns the game's drained events into sound: an effect per player-facing
 * event, and the music each screen wants (title theme, race theme from GO with
 * a tempo lift on the final stretch, a win or lose jingle into the results
 * loop). Every sound that actually starts is announced once as `audio.played`,
 * on the game's tick, so tests can hear the game. Nothing plays or is announced
 * while the AudioContext is not running (before the first gesture).
 */
import type { EventSink, Rng, Stamped } from '@arcade/core';
import type { RacerId } from '../../logic/types.ts';
import { FINAL_STRETCH_AT } from '../race-progress.ts';
import type { RuntimeEvent } from '../runtime.ts';
import { createAttackSfx } from './attack-sfx.ts';
import type { AudioPort } from './index.ts';
import type { Song } from './notation.ts';
import type { Sequencer } from './sequencer.ts';
import { playSfx, type SfxKey } from './sfx.ts';
import { type SongName, songs } from './songs/index.ts';
import type { Synth } from './synth.ts';

/** Every piece of music the game plays. */

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
  /**
   * Receives effects that WebAudio refused to schedule: once per failed play, since each
   * effect is a one-off (unlike songs, which the sequencer stops after one report).
   */
  onError(error: unknown): void;
  /** Whether racer `id` is near enough the player to hear what it does; every racer is when omitted. */
  audibleFromPlayer?(id: RacerId): boolean;
  /** The song the current race plays: the course's own (`Course.song`). Read when each race starts. */
  raceSong(): SongName;
}

/** Final-stretch tempo, as a multiple of the race theme's own. */
const LIFT_TEMPO = 1.1;
/** Random pitch spread for effects: ±5%. */
const PITCH_SPREAD = 0.05;
/** Musical cues that must stay in tune with each other, so they skip the random pitch. */
const STEADY: ReadonlySet<SfxKey> = new Set(['countdown', 'go']);

/** The song for `name`. The single place songs are chosen. */
export function songFor(name: SongName): Song {
  return songs[name];
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

  const attacks = createAttackSfx(options.audibleFromPlayer);
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

  const onEvent = (event: RuntimeEvent, tick: number) => {
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
        wanted = options.raceSong();
        return sfx('go');
      case 'racer.kicked':
        if (event.id === 'player') sfx('kick');
        return;
      case 'pearl.collected':
      case 'loosePearl.collected':
        if (event.id === 'player') sfx('pearl');
        return;
      case 'pearls.dropped':
        if (event.id === 'player') sfx('pearl.drop');
        return;
      case 'item.used':
        if (event.id === 'player') sfx('item.use');
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
      case 'howToPlay.page':
        return sfx('menu.move');
      default: {
        const attack = attacks.forEvent(event, tick);
        if (attack) sfx(attack);
      }
    }
  };

  return {
    onEvents(drained: readonly Stamped<RuntimeEvent>[]) {
      for (const event of drained) onEvent(event, event.tick);
      syncMusic();
      followSequencer();
    },
    onRaceProgress(fraction: number) {
      if (lifted || fraction < FINAL_STRETCH_AT || started !== options.raceSong() || !running()) return;
      lifted = true;
      sequencer.setTempoScale(LIFT_TEMPO);
      announce(`${started}:lift`, 'song');
    },
  };
}
