/**
 * The audio seam. The runtime hands every tick's drained events and the
 * player's race progress to an `AudioPort`. Silent until phase 4 lane b fills
 * `createAudio` with the synthesizer behind the same port.
 */
import type { EventSink, Stamped } from '@arcade/core';
import type { GameContext } from '@arcade/shell';
import type { RuntimeEvent, Settings } from '../runtime.ts';

/** Everything that plays sound reads events through this port, never from logic directly. */
export interface AudioPort {
  /** Called once per tick with the events drained that tick, in order. */
  onEvents(events: readonly Stamped<RuntimeEvent>[]): void;
  /** Called each racing tick with the player's progress, 0 at the start line to 1 at the finish. */
  onRaceProgress(fraction: number): void;
  setMuted(muted: boolean): void;
  dispose(): void;
}

/**
 * Creates the game's audio. `events` is the runtime's log, where the audio emits
 * `audio.played` once a sound actually starts. Silent for now: it plays and emits nothing.
 */
export function createAudio(_ctx: GameContext, _settings: Settings, _events: EventSink<RuntimeEvent>): AudioPort {
  return {
    onEvents() {},
    onRaceProgress() {},
    setMuted() {},
    dispose() {},
  };
}
