import { EventLog, type Stamped } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import { raceOn } from '../../logic/test-world.ts';
import type { RuntimeEvent } from '../runtime.ts';
import { stormWithinReach } from '../view/set-pieces/storm-reach.ts';
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
 * says which enemies are in earshot and `stormAudible` which storm zones (every one when left out).
 */
function heard(
  events: RuntimeEvent[],
  near: boolean,
  enemyAudible?: AdapterOptions['enemyAudible'],
  stormAudible?: AdapterOptions['stormAudible'],
): string[] {
  return heardPerDrain([events], near, enemyAudible, stormAudible);
}

/** As `heard`, with each list in `drains` drained on its own, one tick apart. */
function heardPerDrain(
  drains: RuntimeEvent[][],
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
  drains.forEach((events, drain) => {
    const stamped: Stamped<RuntimeEvent>[] = events.map((event, seq) => ({ ...event, tick: 300 + drain, seq }));
    adapter.onEvents(stamped);
  });
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
          { type: 'racer.rebounded', id: 'player', speed: 120, axis: 'x' },
          { type: 'racer.fell', id: 'player' },
          { type: 'racer.respawned', id: 'player', x: 40, y: 40 },
        ],
        true,
      ),
    ).toEqual(['clank', 'fall', 'respawn']);
  });

  it('stays silent when it is a rival that jumps, bounces, falls or returns, even nearby', () => {
    expect(
      heard(
        [
          { type: 'racer.jumped', id: 'tess' },
          { type: 'racer.rebounded', id: 'tess', speed: 120, axis: 'y' },
          { type: 'racer.fell', id: 'tess' },
          { type: 'racer.respawned', id: 'tess', x: 40, y: 40 },
        ],
        true,
      ),
    ).toEqual([]);
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

  // The player starts at column 1 (centre about 22 px): the zone over columns 6-8 is within a
  // warning's reach, the one over 34-36 (about 520 px off) only within a strike's, and the one over
  // 50-52 (about 780 px off) within neither.
  const { world } = raceOn({
    name: 'storms',
    ascii: `
      ############################################################
      #1........................................................F#
      #2........................................................F#
      #3........................................................F#
      #4........................................................F#
      ############################################################
    `,
    lightning: [
      { cols: [6, 8], periodTicks: 150, offsetTicks: 0 },
      { cols: [34, 36], periodTicks: 150, offsetTicks: 0 },
      { cols: [50, 52], periodTicks: 150, offsetTicks: 0 },
    ],
  });
  const inReach = (zone: number, reachPx: number) => stormWithinReach(world, zone, reachPx);
  const [NEAR_ZONE, MIDDLE_ZONE, FAR_ZONE] = [0, 1, 2];
  const warned = (zone: number): RuntimeEvent => ({ type: 'lightning.warned', zone });
  const struck = (zone: number): RuntimeEvent => ({ type: 'lightning.struck', zone });

  it('warns of a storm zone near the camera and not of one farther off', () => {
    expect(heard([warned(NEAR_ZONE)], true, undefined, inReach)).toEqual(['lightning.warn']);
    expect(heard([warned(MIDDLE_ZONE)], true, undefined, inReach)).toEqual([]);
    expect(heard([warned(FAR_ZONE)], true, undefined, inReach)).toEqual([]);
  });

  it('hears a strike from twice as far as a warning, and not from beyond', () => {
    expect(heard([struck(NEAR_ZONE)], true, undefined, inReach)).toEqual(['lightning.strike']);
    expect(heard([struck(MIDDLE_ZONE)], true, undefined, inReach)).toEqual(['lightning.strike']);
    expect(heard([struck(FAR_ZONE)], true, undefined, inReach)).toEqual([]);
  });

  it('sounds zones striking on the same tick once, and the next strike again', () => {
    const together = [struck(NEAR_ZONE), struck(MIDDLE_ZONE)];
    expect(heardPerDrain([together, [struck(NEAR_ZONE)]], true, undefined, inReach)).toEqual([
      'lightning.strike',
      'lightning.strike',
    ]);
  });
});

describe('the adapter schedules each effect through the synth', () => {
  /** The synth calls draining `events` makes, as `tone` or `noise` with the scheduled frequency in whole Hz. */
  function scheduled(events: RuntimeEvent[]): string[] {
    const calls: string[] = [];
    const synth: Synth = {
      ...runningSynth(),
      tone(_out, spec) {
        calls.push(`tone ${Math.round(spec.frequency)}`);
      },
      noise(_out, spec) {
        calls.push(`noise ${Math.round(spec.frequency)}`);
      },
    };
    const adapter = createAdapter({
      synth,
      sequencer: SILENT_SEQUENCER,
      sfxBus: {} as AudioNode,
      events: new EventLog<RuntimeEvent>(),
      // 0.5 is the middle of the pitch spread, so every effect plays at its written pitch.
      rng: { next: () => 0.5 } as never,
      onError(error) {
        throw error;
      },
      raceSong: () => 'race',
    });
    adapter.onEvents(events.map((event, seq) => ({ ...event, tick: 300, seq })));
    return calls;
  }

  it("plays a strike's crack, boom and rumble", () => {
    expect(scheduled([{ type: 'lightning.struck', zone: 0 }])).toEqual(['noise 3000', 'noise 900', 'tone 55']);
  });

  it("plays the player's kick as its rising hiss", () => {
    expect(scheduled([{ type: 'racer.kicked', id: 'player' }])).toEqual(['noise 600']);
  });
});

/** A sequencer that records what it is asked to play, and reports the sections and endings a test queues. */
function recordingSequencer() {
  const calls: string[] = [];
  let news = { sections: [] as string[], ended: false };
  const sequencer: Sequencer = {
    playing: null,
    play(song, fromBeat) {
      calls.push(`play ${song.name} from ${fromBeat ?? 0}`);
    },
    stop() {
      calls.push('stop');
    },
    setTempoScale(scale) {
      calls.push(`tempo ${scale}`);
    },
    poll() {
      const reported = news;
      news = { sections: [], ended: false };
      return reported;
    },
    dispose() {},
  };
  const report = (sections: string[], ended: boolean) => {
    news = { sections, ended };
  };
  return { sequencer, calls, report };
}

/** An adapter on a running synth with a recording sequencer, and the songs it announces. */
function musicRig(raceSong: AdapterOptions['raceSong']) {
  const log = new EventLog<RuntimeEvent>();
  const { sequencer, calls, report } = recordingSequencer();
  const adapter = createAdapter({
    synth: runningSynth(),
    sequencer,
    sfxBus: {} as AudioNode,
    events: log,
    rng: { next: () => 0.5 } as never,
    onError(error) {
      throw error;
    },
    raceSong,
  });
  const drain = (...events: RuntimeEvent[]) =>
    adapter.onEvents(events.map((event, seq) => ({ ...event, tick: 0, seq })));
  const announced = () =>
    log
      .all()
      .filter((e) => e.type === 'audio.played' && e.kind === 'song')
      .map((e) => (e as { key: string }).key);
  return { adapter, calls, report, drain, announced };
}

describe('the adapter and the race music', () => {
  it('plays and lifts the track it was given at GO, even if the answer changes later', () => {
    let track: 'thornwood' | 'farside' = 'thornwood';
    const rig = musicRig(() => track);
    rig.drain({ type: 'scene.started', scene: 'race' }, { type: 'race.started' });
    track = 'farside';
    rig.adapter.onRaceProgress(0.95);
    expect(rig.calls).toEqual(['play thornwood from 0', 'tempo 1.1']);
    expect(rig.announced()).toEqual(['thornwood', 'thornwood:lift']);
  });

  it('plays the win jingle on the results screen after a won race, then the results loop', () => {
    const rig = musicRig(() => 'race');
    rig.drain({ type: 'scene.started', scene: 'race' }, { type: 'race.started' });
    rig.drain(
      { type: 'racer.finished', id: 'player', place: 1, ticks: 3600 },
      { type: 'race.finished', standings: ['player', 'tess'], playerPlace: 1, playerTicks: 3600 },
      { type: 'scene.started', scene: 'results' },
    );
    rig.report([], true);
    rig.drain();
    expect(rig.calls).toEqual(['play race from 0', 'play win from 0', 'play results from 0']);
  });
});

describe('the adapter and the sound test', () => {
  it('plays an auditioned song from its start at once, replacing the screen’s music', () => {
    const rig = musicRig(() => 'race');
    rig.drain({ type: 'scene.started', scene: 'title' });
    rig.adapter.audition('farside');
    expect(rig.calls).toEqual(['play title from 0', 'play farside from 0']);
    expect(rig.announced()).toEqual(['title', 'farside']);
  });

  it('starts an audition from the first beat of a named section, and keeps announcing sections', () => {
    const rig = musicRig(() => 'race');
    rig.adapter.audition('race', 'B');
    rig.report(['turnaround'], false);
    rig.drain();
    // B starts on bar 18 of the race song, in 4/4.
    expect(rig.calls).toEqual(['play race from 72']);
    expect(rig.announced()).toEqual(['race', 'race:turnaround']);
  });

  it('replays a song auditioned twice', () => {
    const rig = musicRig(() => 'race');
    rig.adapter.audition('title');
    rig.adapter.audition('title');
    expect(rig.calls).toEqual(['play title from 0', 'play title from 0']);
  });

  it('stops the music when nothing is auditioned', () => {
    const rig = musicRig(() => 'race');
    rig.drain({ type: 'scene.started', scene: 'title' });
    rig.adapter.audition(null);
    rig.drain();
    expect(rig.calls).toEqual(['play title from 0', 'stop']);
    expect(rig.announced()).toEqual(['title']);
  });

  it('rejects a section the song does not have, naming the song and its sections', () => {
    const rig = musicRig(() => 'race');
    rig.drain({ type: 'scene.started', scene: 'title' });
    expect(() => rig.adapter.audition('race', 'bridge')).toThrow(
      'Song "race" has no section "bridge"; its sections are "intro", "A", ',
    );
    rig.drain();
    expect(rig.calls).toEqual(['play title from 0']);
  });

  it('holds an audition until the next scene, which brings back that scene’s music', () => {
    const rig = musicRig(() => 'race');
    rig.adapter.audition('farside');
    rig.drain({ type: 'race.started' });
    rig.drain({ type: 'scene.started', scene: 'title' });
    expect(rig.calls).toEqual(['play farside from 0', 'play title from 0']);
  });

  it('lets an auditioned jingle end in silence instead of moving on to the results loop', () => {
    const rig = musicRig(() => 'race');
    rig.adapter.audition('win');
    rig.report([], true);
    rig.drain();
    rig.drain();
    expect(rig.calls).toEqual(['play win from 0']);
    expect(rig.announced()).toEqual(['win', 'win:end']);
  });

  it('never chains an auditioned jingle into the results loop after leaving for another screen', () => {
    const rig = musicRig(() => 'race');
    rig.adapter.audition('win');
    rig.drain({ type: 'scene.started', scene: 'select' });
    rig.report([], true);
    rig.drain();
    rig.drain();
    expect(rig.calls).toEqual(['play win from 0']);
  });
});
