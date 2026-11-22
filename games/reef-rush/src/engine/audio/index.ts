/**
 * The audio seam. The runtime hands every tick's drained events to an
 * `AudioPort`; this phase's port is silent, and phase 4 replaces the body of
 * `createAudio` with the synthesizer behind the same port.
 */
import type { Stamped } from '@arcade/core';
import type { GameContext } from '@arcade/shell';
import type { RuntimeEvent, Settings } from '../runtime.ts';

/** Everything that plays sound reads events through this port, never from logic directly. */
export interface AudioPort {
  /** Called once per tick with the events drained that tick, in order. */
  onEvents(events: readonly Stamped<RuntimeEvent>[]): void;
  setMuted(muted: boolean): void;
  dispose(): void;
}

/** Creates the game's audio. Silent in this phase: it accepts events and plays nothing. */
export function createAudio(_ctx: GameContext, _settings: Settings): AudioPort {
  return {
    onEvents() {},
    setMuted() {},
    dispose() {},
  };
}
