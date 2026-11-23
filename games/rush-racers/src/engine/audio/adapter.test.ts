import { EventLog, type Stamped } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import { raceOn } from '../../logic/test-world.ts';
import type { RuntimeEvent } from '../runtime.ts';
import { type AdapterOptions, createAdapter, enemyWithinHearing, stormWithinHearing } from './adapter.ts';
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
 * says which enemies are in earshot and `stormAudible` which storm zones (every one when left out).
 */
function heard(
  events: RuntimeEvent[],
  near: boolean,
  enemyAudible?: AdapterOptions['enemyAudible'],
  stormAudible?: AdapterOptions['stormAudible'],
): string[] {
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
    ...(stormAudible && { stormAudible }),
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

describe('the adapter and the sky set pieces', () => {
  it("plays the player's flap, bounce and ring", () => {
    const own: RuntimeEvent[] = [
      { type: 'racer.flapped', id: 'player' },
      { type: 'racer.bounced', id: 'player' },
      { type: 'ring.passed', id: 'player', ring: 0 },
    ];
    expect(heard(own, true)).toEqual(['flap', 'bounce', 'ring']);
  });

  it("stays silent for a rival's flap, bounce and ring, even nearby", () => {
    const rivals: RuntimeEvent[] = [
      { type: 'racer.flapped', id: 'tess' },
      { type: 'racer.bounced', id: 'tess' },
      { type: 'ring.passed', id: 'tess', ring: 0 },
    ];
    expect(heard(rivals, true)).toEqual([]);
  });

  // The player starts at column 1: the zone over columns 6-8 is in earshot, the one over 34-36 (over 500 px off) is not.
  const { world } = raceOn({
    name: 'storms',
    ascii: `
      ########################################
      #1....................................F#
      #2....................................F#
      #3....................................F#
      #4....................................F#
      ########################################
    `,
    lightning: [
      { cols: [6, 8], periodTicks: 150, offsetTicks: 0 },
      { cols: [34, 36], periodTicks: 150, offsetTicks: 0 },
    ],
  });
  const inEarshot = (zone: number) => stormWithinHearing(world, zone);
  const [NEAR_ZONE, FAR_ZONE] = [0, 1];

  it('warns of a storm zone near the camera and not of one far off', () => {
    const warned = (zone: number): RuntimeEvent[] => [{ type: 'lightning.warned', zone }];
    expect(heard(warned(NEAR_ZONE), true, undefined, inEarshot)).toEqual(['lightning.warn']);
    expect(heard(warned(FAR_ZONE), true, undefined, inEarshot)).toEqual([]);
  });

  it('sounds every strike', () => {
    const strikes: RuntimeEvent[] = [
      { type: 'lightning.struck', zone: NEAR_ZONE },
      { type: 'lightning.struck', zone: FAR_ZONE },
    ];
    expect(heard(strikes, false, undefined, inEarshot)).toEqual(['lightning.strike', 'lightning.strike']);
  });
});
