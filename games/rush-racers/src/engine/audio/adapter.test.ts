import { EventLog, type Stamped } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import { raceOn } from '../../logic/test-world.ts';
import type { RuntimeEvent } from '../runtime.ts';
import { type AdapterOptions, createAdapter, enemyWithinHearing } from './adapter.ts';
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

/**
 * The sfx keys heard when `events` are drained together, by owner distance `near`; `enemyAudible`
 * says which enemies are in earshot (every one when left out).
 */
function heard(events: RuntimeEvent[], near: boolean, enemyAudible?: AdapterOptions['enemyAudible']): string[] {
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
    audibleFromLocal: () => near,
    ...(enemyAudible && { enemyAudible }),
    raceSong: () => 'race',
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

describe('the adapter and the enemies', () => {
  // The player starts at column 1: the shark and eel at column 7 are in earshot, those at 36 (over 500 px off) are not.
  const { world } = raceOn(`
    ########################################
    #1.....S............................S.F#
    #2....................................F#
    #3....................................F#
    #4.....E............................E.F#
    ########################################
  `);
  const inEarshot = (index: number) => enemyWithinHearing(world, index);
  const [NEAR_SHARK, FAR_SHARK, NEAR_EEL, FAR_EEL] = [0, 1, 2, 3];

  it('hears a shark wind up and an eel warn nearby, and neither out of earshot', () => {
    const tells = (shark: number, eel: number): RuntimeEvent[] => [
      { type: 'enemy.telegraphed', index: shark, kind: 'shark' },
      { type: 'enemy.telegraphed', index: eel, kind: 'eel' },
    ];
    expect(world.enemies.map((enemy) => enemy.kind)).toEqual(['shark', 'shark', 'eel', 'eel']);
    expect(heard(tells(NEAR_SHARK, NEAR_EEL), true, inEarshot)).toEqual(['shark.windup', 'eel.warn']);
    expect(heard(tells(FAR_SHARK, FAR_EEL), true, inEarshot)).toEqual([]);
  });

  it('hears a bonk and a defeat nearby, sounding the bonk that beats an enemy as its defeat', () => {
    const near: RuntimeEvent[] = [
      { type: 'enemy.bonked', index: NEAR_SHARK, kind: 'shark', by: 'player', hpLeft: 1, how: 'dash' },
      { type: 'enemy.bonked', index: NEAR_SHARK, kind: 'shark', by: 'player', hpLeft: 0, how: 'dash' },
      { type: 'enemy.defeated', index: NEAR_SHARK, kind: 'shark', by: 'player' },
    ];
    expect(heard(near, true, inEarshot)).toEqual(['enemy.bonk', 'enemy.defeat']);
    const far: RuntimeEvent[] = [
      { type: 'enemy.bonked', index: FAR_SHARK, kind: 'shark', by: 'tess', hpLeft: 1, how: 'dash' },
      { type: 'enemy.defeated', index: FAR_SHARK, kind: 'shark', by: 'tess' },
    ];
    expect(heard(far, true, inEarshot)).toEqual([]);
  });

  it('always hears an enemy get the player, and never one getting a rival', () => {
    const bites: RuntimeEvent[] = [
      { type: 'racer.hit', id: 'player', cause: 'crab', by: null },
      { type: 'racer.hit', id: 'tess', cause: 'shark', by: null },
      { type: 'racer.hit', id: 'player', cause: 'urchin', by: null },
    ];
    expect(heard(bites, false, () => false)).toEqual(['enemy.bite']);
  });
});

describe('the adapter and a racer leaving the course', () => {
  it('plays the player’s bounce off a wall, fall out of play and return, in that order', () => {
    expect(
      heard(
        [
          { type: 'racer.bounced', id: 'player', speed: 120, axis: 'x' },
          { type: 'racer.fell', id: 'player' },
          { type: 'racer.respawned', id: 'player', x: 40, y: 40 },
        ],
        true,
      ),
    ).toEqual(['bounce', 'fall', 'respawn']);
  });

  it('stays silent when it is a rival that bounces, falls or returns, even nearby', () => {
    expect(
      heard(
        [
          { type: 'racer.bounced', id: 'tess', speed: 120, axis: 'y' },
          { type: 'racer.fell', id: 'tess' },
          { type: 'racer.respawned', id: 'tess', x: 40, y: 40 },
        ],
        true,
      ),
    ).toEqual([]);
  });
});
