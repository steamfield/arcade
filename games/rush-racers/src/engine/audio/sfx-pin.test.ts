/**
 * Pins what the ocean race sounds like while phases 8 and 9 move the course behind seams: every
 * sound effect and song a whole race on Sunlit Shallows plays, counted by key. A change here is a
 * change a player hears, so it fails until someone means it.
 */
import { EventLog, type Stamped, TICK_DT } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import { BOT_PROFILES } from '../../logic/ai/profiles.ts';
import { COURSES, DEFAULT_COURSE } from '../../logic/courses/index.ts';
import type { GameEvent } from '../../logic/events.ts';
import type { TickInput } from '../../logic/types.ts';
import { createWorld, stepWorld } from '../../logic/world.ts';
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

const IDLE: TickInput = { move: { x: 0, y: 0 }, kick: false, use: false, cycle: 0 };

/** The races the pin listens to: an expert, a coral-ramming Baron, and a novice who gets hit on Easy. */
const RACES = [
  { seed: 1, difficulty: 'hard', character: 'rudy', playerBot: BOT_PROFILES.expert },
  { seed: 1, difficulty: 'hard', character: 'baron', playerBot: BOT_PROFILES.expert },
  { seed: 7, difficulty: 'easy', character: 'nib', playerBot: BOT_PROFILES.novice },
] as const;

/** Every `audio.played` key one whole race makes, counted, added into `counts`. */
function listen(options: (typeof RACES)[number], counts: Record<string, number>): void {
  const race = new EventLog<GameEvent>(100_000);
  const world = createWorld(DEFAULT_COURSE, race, { ...options });
  for (let i = 0; i < 20_000 && world.race.phase !== 'finished'; i++) stepWorld(world, IDLE, TICK_DT);

  const heard = new EventLog<RuntimeEvent>(100_000);
  const adapter = createAdapter({
    synth: runningSynth(),
    sequencer: SILENT_SEQUENCER,
    sfxBus: {} as AudioNode,
    events: heard,
    rng: { next: () => 0.5 } as never,
    onError(error) {
      throw error;
    },
    audibleFromLocal: () => true,
    raceSong: () => COURSES['sunlit-shallows'].song,
  });
  // Three drains, as the runtime would: the race scene, the race, then results. One drain would
  // replace the race song with the results song before the music ever synced.
  let seq = 0;
  const drain = (events: readonly RuntimeEvent[]) =>
    adapter.onEvents(events.map((event): Stamped<RuntimeEvent> => ({ ...event, tick: 0, seq: seq++ })));
  drain([{ type: 'scene.started', scene: 'race' }]);
  drain(race.all());
  drain([{ type: 'scene.started', scene: 'results' }]);

  for (const event of heard.all()) {
    if (event.type !== 'audio.played') continue;
    const key = `${event.kind}:${event.key}`;
    counts[key] = (counts[key] ?? 0) + 1;
  }
}

describe('the sound of a race on Sunlit Shallows', () => {
  it('races to the race song', () => {
    expect(COURSES['sunlit-shallows'].song).toBe('race');
  });

  it('plays the same sound effects and songs with enemies on the course, every one audible, and the reef-difficulty course, over three whole races', () => {
    const counts: Record<string, number> = {};
    for (const race of RACES) listen(race, counts);
    // Re-pinned when the course gained its surface section, cave, 17 eels and a third shark. This
    // harness hears every enemy; the game's own `enemyAudible` keeps far-off eels quiet.
    // Re-pinned again when each item kind got its own fire sound: the nine `item.use` fires are now
    // two Bubble Shields, an Ink Sac, three Jet Fins and three Mimics.
    // Re-pinned when Sunlit gained geyser vents: they move every racer, so the counts shift and one
    // of the two Hard expert races now places second. This harness has no race world, so the vents'
    // own rumble and rush stay silent here (`setpiece-cues.test.ts` covers them).
    expect(counts).toEqual({
      'sfx:bump': 75,
      'sfx:coral': 4,
      'sfx:countdown': 9,
      'sfx:decoy.pop': 4,
      'sfx:decoy.spawn': 4,
      'sfx:eel.warn': 2767,
      'sfx:enemy.bite': 1,
      'sfx:enemy.bonk': 4,
      'sfx:enemy.defeat': 5,
      'sfx:finish': 3,
      'sfx:fire.bubbleShield': 2,
      'sfx:fire.inkSac': 4,
      'sfx:fire.mimic': 3,
      'sfx:go': 3,
      'sfx:kick': 194,
      'sfx:pearl': 22,
      'sfx:pearl.drop': 5,
      'sfx:place.down': 25,
      'sfx:place.up': 28,
      'sfx:riptide': 12,
      'sfx:shark.windup': 13,
      'sfx:squid.fire': 15,
      'sfx:squid.latch': 1,
      'sfx:squid.lock': 1,
      'sfx:undertow': 3,
      'song:lose': 1,
      'song:race': 3,
      'song:win': 2,
    });
    // Three whole races: about 1.5 s alone, several times that while the difficulty bars share the CPU.
  }, 30_000);
});
