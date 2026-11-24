/**
 * Item fires as a player hears them: every item kind its own sound, coloured by the world raced in,
 * only the local racer's fires, and never more synth voices or time than the single generic fire
 * sound these replaced (two parts, over within 0.4 s), so a burst of fires can't crowd the song.
 */
import { EventLog, type Stamped } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import { COURSES } from '../../logic/courses/index.ts';
import type { GameEvent } from '../../logic/events.ts';
import { POWER_UP_KINDS, type PowerUpKind, type RacerId, type World } from '../../logic/types.ts';
import { createWorld } from '../../logic/world.ts';
import type { RuntimeEvent } from '../runtime.ts';
import { createAdapter } from './adapter.ts';
import type { Sequencer } from './sequencer.ts';
import type { Synth } from './synth.ts';

/** One synth voice an effect started: its wave (or 'noise'), frequency in whole Hz, and when it ends. */
interface Voice {
  wave: string;
  hz: number;
  duty?: number;
  endsAt: number;
}

/** One effect as heard: its key and the voices it started. */
interface Heard {
  key: string;
  voices: Voice[];
}

const SILENT_SEQUENCER: Sequencer = {
  playing: null,
  play() {},
  stop() {},
  setTempoScale() {},
  poll: () => ({ sections: [], ended: false }),
  dispose() {},
};

/** A racing world on one course of each shipped world, built once. */
const WORLDS = {
  reef: createWorld(COURSES['sunlit-shallows'], new EventLog<GameEvent>(), { seed: 1 }),
  thornwood: createWorld(COURSES['bramble-run'], new EventLog<GameEvent>(), { seed: 1 }),
  cloudreach: createWorld(COURSES['thunderhead-pass'], new EventLog<GameEvent>(), { seed: 1 }),
  farside: createWorld(COURSES['slingshot-alley'], new EventLog<GameEvent>(), { seed: 1 }),
};

/** The effects heard draining `events` on one tick while racing `world`, each with the voices it started. */
function hear(events: RuntimeEvent[], world: World | null = WORLDS.reef): Heard[] {
  let voices: Voice[] = [];
  const heard: Heard[] = [];
  const node = {} as GainNode;
  const synth: Synth = {
    context: { state: 'running', currentTime: 0 } as AudioContext,
    master: node,
    createBus: () => node,
    tone(_out, spec) {
      voices.push({ wave: spec.wave, hz: Math.round(spec.frequency), duty: spec.duty, endsAt: spec.at + spec.length });
    },
    noise(_out, spec) {
      voices.push({ wave: 'noise', hz: Math.round(spec.frequency), endsAt: spec.at + spec.length });
    },
    drum() {},
    setMuted() {},
  };
  const adapter = createAdapter({
    synth,
    sequencer: SILENT_SEQUENCER,
    sfxBus: node,
    events: {
      emit(event) {
        if (event.type !== 'audio.played' || event.kind !== 'sfx') return;
        heard.push({ key: event.key, voices });
        voices = [];
      },
    },
    // 0.5 is the middle of the pitch spread, so every effect plays at its written pitch.
    rng: { next: () => 0.5 } as never,
    onError(error) {
      throw error;
    },
    raceSong: () => 'race',
    raceWorld: () => world,
  });
  adapter.onEvents(events.map((event, seq): Stamped<RuntimeEvent> => ({ ...event, tick: 300, seq })));
  return heard;
}

const fired = (kind: PowerUpKind, id: RacerId = 'player'): RuntimeEvent => ({
  type: 'item.used',
  id,
  kind,
  slot: 0,
  chargesLeft: 0,
});

/** The one effect firing `kind` makes in `world`. */
function fireOf(kind: PowerUpKind, world: World): Heard {
  const heard = hear([fired(kind)], world);
  expect(heard).toHaveLength(1);
  return heard[0] as Heard;
}

const tones = (heard: Heard) => heard.voices.filter((voice) => voice.wave !== 'noise');
const noises = (heard: Heard) => heard.voices.filter((voice) => voice.wave === 'noise');

describe('item fire sounds', () => {
  it('plays each kind its own fire sound, and no two kinds sound alike', () => {
    const fires = POWER_UP_KINDS.map((kind) => fireOf(kind, WORLDS.reef));
    expect(fires.map((fire) => fire.key)).toEqual(POWER_UP_KINDS.map((kind) => `fire.${kind}`));
    expect(new Set(fires.map((fire) => JSON.stringify(fire.voices))).size).toBe(POWER_UP_KINDS.length);
  });

  it('plays no fire for a rival, near or far, even when all four racers fire on one tick', () => {
    const burst = (['player', 'tess', 'squib', 'bo'] as const).map((id) => fired('cannonball', id));
    expect(hear(burst).map((heard) => heard.key)).toEqual(['fire.cannonball']);
    expect(hear([fired('jetFin', 'tess')])).toEqual([]);
  });

  it('keeps every fire, in every world, to two voices over within 0.4 s, like the generic fire it replaced', () => {
    for (const world of Object.values(WORLDS)) {
      for (const kind of POWER_UP_KINDS) {
        const fire = fireOf(kind, world);
        expect(fire.voices.length, `${kind} in ${world.course}`).toBeLessThanOrEqual(2);
        expect(Math.max(...fire.voices.map((voice) => voice.endsAt)), `${kind} in ${world.course}`).toBeLessThanOrEqual(
          0.4,
        );
      }
    }
  });

  it('sounds lower and duller in Thornwood, and higher and airier in Cloudreach, than on the reef', () => {
    for (const kind of POWER_UP_KINDS) {
      const reef = fireOf(kind, WORLDS.reef);
      for (const [world, shift] of [
        ['thornwood', -1],
        ['cloudreach', 1],
      ] as const) {
        const flavoured = fireOf(kind, WORLDS[world]);
        const sign = (a: Voice, b: Voice | undefined) => Math.sign(a.hz - (b?.hz ?? Number.NaN));
        expect(
          tones(flavoured).map((voice, i) => sign(voice, tones(reef)[i])),
          `${kind} tones in ${world}`,
        ).toEqual(tones(reef).map(() => shift));
        expect(
          noises(flavoured).map((voice, i) => sign(voice, noises(reef)[i])),
          `${kind} noise in ${world}`,
        ).toEqual(noises(reef).map(() => shift));
      }
    }
  });

  it('gives every tone a square edge in Farside, and leaves its noise as the reef has it', () => {
    for (const kind of POWER_UP_KINDS) {
      const farside = fireOf(kind, WORLDS.farside);
      expect(tones(farside).map(({ wave, duty }) => `${wave} ${duty}`)).toEqual(tones(farside).map(() => 'pulse 0.5'));
      expect(noises(farside)).toEqual(noises(fireOf(kind, WORLDS.reef)));
    }
  });

  it('plays the reef’s fire off the race screen, where there is no world', () => {
    expect(hear([fired('inkSac')], null)).toEqual(hear([fired('inkSac')], WORLDS.reef));
  });
});
