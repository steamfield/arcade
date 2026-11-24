/**
 * The audio seam. The runtime hands every tick's drained events and the
 * local racer's race progress to an `AudioPort`; behind it, `createAudio` wires a
 * WebAudio chip synth, the song sequencer and the event adapter together.
 */

import { createLogger, createRng, type EventSink, type Stamped } from '@arcade/core';
import type { GameContext } from '@arcade/shell';
import type { RuntimeEvent, Settings } from '../runtime.ts';
import { type AdapterOptions, createAdapter } from './adapter.ts';
import { createSequencer } from './sequencer.ts';
import type { SongName } from './songs/index.ts';
import { createSynth, type Synth } from './synth.ts';

/** Everything that plays sound reads events through this port, never from logic directly. */
export interface AudioPort {
  /** Called once per tick with the events drained that tick, in order. */
  onEvents(events: readonly Stamped<RuntimeEvent>[]): void;
  /** Called each racing tick with the local racer's progress, 0 at the start line to 1 at the finish. */
  onRaceProgress(fraction: number): void;
  setMuted(muted: boolean): void;
  dispose(): void;
}

/** Effects sit a little above the music so cues cut through. */
const SFX_LEVEL = 0.8;
/** Salt for the cosmetic pitch rng, so it never replays a gameplay stream at the same seed. */
const COSMETIC_SALT = 0x5f3759df;

const log = createLogger('rush-racers:audio');

/** A port that plays nothing, for browsers where audio could not be set up. */
const SILENT: AudioPort = {
  onEvents() {},
  onRaceProgress() {},
  setMuted() {},
  dispose() {},
};

/**
 * Creates the game's audio on its own AudioContext, registered with the shell so it is
 * resumed after a gesture or an iOS interruption. `hearing.audibleFromLocal` says which racers are near enough
 * for their attacks to be heard, `hearing.enemyAudible` which enemies (by index in `world.enemies`),
 * `hearing.stormAudible` which storm zones (by index in `level.lightning`) are within a reach, and
 * `hearing.localRacer` which slot the screen follows, and `hearing.raceWorld` the world being raced, which the
 * local racer's movement sounds and the world's item flavour need (neither plays without it). `events` is the runtime's log, where
 * `audio.played` is emitted once a sound actually starts. `settings.muted` applies at once.
 * When WebAudio can't be set up the failure goes to `ctx.reportError` and the game runs silent.
 */
export function createAudio(
  ctx: GameContext,
  settings: Settings,
  events: EventSink<RuntimeEvent>,
  hearing: Pick<AdapterOptions, 'audibleFromLocal' | 'enemyAudible' | 'stormAudible' | 'localRacer' | 'raceWorld'>,
  raceSong: () => SongName,
): AudioPort {
  const reportError = (error: unknown) => ctx.reportError('audio', error);
  const context = openContext(reportError);
  if (!context) return SILENT;
  const synth = buildSynth(context, settings.muted, reportError);
  if (!synth) return SILENT;
  ctx.registerAudioContext(context);
  const stopUnlocking = unlockOnGesture(context, reportError);
  const sequencer = createSequencer(synth, reportError);
  const adapter = createAdapter({
    synth,
    sequencer,
    sfxBus: synth.createBus(SFX_LEVEL),
    events,
    rng: createRng((ctx.params.seed ^ COSMETIC_SALT) >>> 0),
    onError: reportError,
    ...hearing,
    raceSong,
  });
  log.debug('audio ready', { state: context.state, muted: settings.muted });
  return {
    ...adapter,
    setMuted: (muted) => synth.setMuted(muted),
    dispose() {
      stopUnlocking();
      sequencer.dispose();
      context.close().catch(reportError);
    },
  };
}

/**
 * Resumes `context` on the next key press or pointer press until it is running, then stops
 * listening. The shell's start-gate tap resumes contexts before this one exists, so on
 * gesture-strict browsers (Safari) it would otherwise stay suspended for keyboard-only
 * players. Returns the function that removes the listeners.
 */
function unlockOnGesture(context: AudioContext, reportError: (error: unknown) => void): () => void {
  const stop = () => {
    window.removeEventListener('keydown', unlock);
    window.removeEventListener('pointerdown', unlock);
  };
  function unlock() {
    if (context.state === 'running') {
      stop();
      return;
    }
    context.resume().then(() => {
      if (context.state === 'running') stop();
    }, reportError);
  }
  if (context.state === 'running') return stop;
  window.addEventListener('keydown', unlock);
  window.addEventListener('pointerdown', unlock);
  return stop;
}

/** A new AudioContext, or null (reported) when the browser refuses one. */
function openContext(reportError: (error: unknown) => void): AudioContext | null {
  try {
    return new AudioContext();
  } catch (error) {
    reportError(new Error('Audio is off: this browser could not create an AudioContext', { cause: error }));
    return null;
  }
}

/** The synth on `context`, or null (reported, context closed) when its nodes can't be built. */
function buildSynth(context: AudioContext, muted: boolean, reportError: (error: unknown) => void): Synth | null {
  try {
    return createSynth(context, muted);
  } catch (error) {
    reportError(new Error('Audio is off: the synthesizer nodes could not be created', { cause: error }));
    context.close().catch(reportError);
    return null;
  }
}
