import { EventLog, type Stamped } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import type { RuntimeEvent } from '../runtime.ts';
import { createAdapter } from './adapter.ts';
import type { Sequencer } from './sequencer.ts';
import type { Synth } from './synth.ts';

/** A synth whose context is running and that accepts every note: only WebAudio itself is faked. */
function runningSynth(): Synth {
  const node = {} as GainNode;
  return {
    context: { state: 'running', currentTime: 0 } as AudioContext,
    master: node,
    createBus: () => node,
    tone() {},
    noise() {},
    drum() {},
    setMuted() {},
  };
}

const SILENT_SEQUENCER: Sequencer = {
  playing: null,
  play() {},
  stop() {},
  setTempoScale() {},
  poll: () => ({ sections: [], ended: false }),
  dispose() {},
};

/** The sfx keys heard when `events` are drained together, by owner distance `near`. */
function heard(events: RuntimeEvent[], near: boolean): string[] {
  const log = new EventLog<RuntimeEvent>();
  const adapter = createAdapter({
    synth: runningSynth(),
    sequencer: SILENT_SEQUENCER,
    sfxBus: {} as AudioNode,
    events: log,
    rng: { next: () => 0.5 } as never,
    onError(error) {
      throw error;
    },
    audibleFromPlayer: () => near,
  });
  const stamped: Stamped<RuntimeEvent>[] = events.map((event, seq) => ({ ...event, tick: 300, seq }));
  adapter.onEvents(stamped);
  return log
    .all()
    .filter((e) => e.type === 'audio.played' && e.kind === 'sfx')
    .map((e) => (e as { key: string }).key);
}

describe('the adapter and the attack power-ups', () => {
  it('plays a cue for the attack events aimed at the player', () => {
    expect(
      heard(
        [
          { type: 'squid.locked', owner: 'tess', target: 'player' },
          { type: 'squid.latched', id: 'player', by: 'tess' },
          { type: 'racer.shaken', id: 'player' },
        ],
        true,
      ),
    ).toEqual(['squid.lock', 'squid.latch', 'squid.shake']);
  });

  it('stays silent for a rival’s squid fired out of earshot, and plays it nearby', () => {
    const fired: RuntimeEvent[] = [{ type: 'squid.spawned', owner: 'tess', target: null }];
    expect(heard(fired, false)).toEqual([]);
    expect(heard(fired, true)).toEqual(['squid.fire']);
  });
});
