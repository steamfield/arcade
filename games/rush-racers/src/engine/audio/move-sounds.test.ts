/**
 * Movement sounds as a player hears them, from real races on the run and drift test courses: the
 * local racer's footsteps (at most one every `STEP_GAP_TICKS`), its hop on a jump, its thruster
 * burns while it speeds up, and nothing at all for what the rivals do.
 */
import { EventLog, type Stamped, TICK_DT } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import { COURSES } from '../../logic/courses/index.ts';
import type { GameEvent } from '../../logic/events.ts';
import { centreOf } from '../../logic/racers.ts';
import { type RacerId, TILE, type TickInput, type World } from '../../logic/types.ts';
import { createWorld, stepRace } from '../../logic/world.ts';
import type { RuntimeEvent } from '../runtime.ts';
import { createAdapter } from './adapter.ts';
import { BURN_GAP_TICKS, STEP_GAP_TICKS } from './move-cues.ts';
import type { Sequencer } from './sequencer.ts';
import type { Synth } from './synth.ts';

const SILENT_SEQUENCER: Sequencer = {
  playing: null,
  play() {},
  stop() {},
  setTempoScale() {},
  poll: () => ({ sections: [], ended: false }),
  dispose() {},
};

const IDLE: TickInput = { move: { x: 0, y: 0 }, kick: false, use: false, cycle: 0 };
const RIGHT: TickInput = { ...IDLE, move: { x: 1, y: 0 } };
const UP_RIGHT: TickInput = { ...IDLE, move: { x: 1, y: -1 } };

/** One movement sound heard: its key, the world tick it sounded on, and the voices it started. */
interface Heard {
  key: string;
  tick: number;
  voices: number;
  endsAt: number;
}

const MOVE_KEYS = new Set(['hop', 'step', 'burn', 'clank']);

/**
 * Races `course` from GO for as many ticks as `inputs` has, the player's input taken from it a
 * tick at a time and the rivals driven by their AI, and returns the movement sounds the screen
 * following `local` heard, with the race's own events.
 */
function race(
  course: 'run-test' | 'drift-test',
  inputs: readonly TickInput[],
  local: RacerId = 'player',
  setup: (world: World) => void = () => {},
) {
  const log = new EventLog<GameEvent>(100_000);
  const world = createWorld(COURSES[course], log, { seed: 1 });
  world.race = { phase: 'racing', raceTick: 0, rivalsDoneAt: null, result: null, endsWhen: 'player' };
  setup(world);
  const heard: Heard[] = [];
  let voices: number[] = [];
  const node = {} as GainNode;
  const synth: Synth = {
    context: { state: 'running', currentTime: 0 } as AudioContext,
    master: node,
    createBus: () => node,
    tone: (_out, spec) => voices.push(spec.at + spec.length),
    noise: (_out, spec) => voices.push(spec.at + spec.length),
    drum() {},
    setMuted() {},
  };
  const adapter = createAdapter({
    synth,
    sequencer: SILENT_SEQUENCER,
    sfxBus: node,
    events: {
      emit(event) {
        if (event.type === 'audio.played' && MOVE_KEYS.has(event.key)) {
          heard.push({ key: event.key, tick: world.tick, voices: voices.length, endsAt: Math.max(...voices) });
        }
        voices = [];
      },
    },
    rng: { next: () => 0.5 } as never,
    onError(error) {
      throw error;
    },
    localRacer: () => local,
    raceSong: () => 'race',
    raceWorld: () => world,
  });
  let cursor = 0;
  for (const input of inputs) {
    log.tick = world.tick + 1;
    stepRace(world, { player: input }, TICK_DT);
    const drained = log.drain(cursor);
    cursor = drained.cursor;
    adapter.onEvents(drained.events as Stamped<RuntimeEvent>[]);
  }
  return { heard, events: log.all(), world };
}

const ticksOf = (heard: readonly Heard[], key: string) => heard.filter((h) => h.key === key).map((h) => h.tick);
const gaps = (ticks: readonly number[]) => ticks.slice(1).map((tick, i) => tick - (ticks[i] as number));
const hold = (input: TickInput, ticks: number) => Array.from({ length: ticks }, () => input);

describe('a runner’s movement sounds', () => {
  it('steps while running on the ground, never sooner than every 14 ticks, and hops on a jump', () => {
    const { heard } = race('run-test', [...hold(RIGHT, 90), ...hold(UP_RIGHT, 20)]);
    const steps = ticksOf(heard, 'step');
    expect(steps.length).toBeGreaterThanOrEqual(4);
    expect(Math.min(...gaps(steps))).toBe(STEP_GAP_TICKS);
    expect(ticksOf(heard, 'hop')).toHaveLength(1);
  });

  it('is silent while it stands still and every rival runs and jumps', () => {
    const { heard, events } = race('run-test', hold(IDLE, 240));
    expect(events.some((event) => event.type === 'racer.jumped' && event.id !== 'player')).toBe(true);
    expect(heard).toEqual([]);
  });

  it('follows the slot the screen follows, so a rival’s steps sound when the screen follows it', () => {
    const { heard } = race('run-test', hold(IDLE, 120), 'tess');
    expect(ticksOf(heard, 'step').length).toBeGreaterThan(0);
  });
});

describe('a drifter’s movement sounds', () => {
  it('burns while thrusting from rest, no sooner than every 10 ticks, and falls quiet coasting', () => {
    const { heard } = race('drift-test', [...hold(RIGHT, 40), ...hold(IDLE, 40)]);
    const burns = ticksOf(heard, 'burn');
    expect(burns.length).toBeGreaterThanOrEqual(3);
    expect(Math.min(...gaps(burns))).toBe(BURN_GAP_TICKS);
    expect(burns.every((tick) => tick <= 40)).toBe(true);
  });

  it('does not burn while a rival’s gravity bomb pulls it along, coasting', () => {
    const coastInBomb = (world: World) => {
      const player = world.racers.find((racer) => racer.id === 'player');
      if (!player) throw new Error('no player');
      player.body.vx = 0;
      const at = centreOf(player);
      world.twists.push({
        style: 'gravityBomb',
        owner: 'tess',
        x: at.x + TILE / 4,
        y: at.y,
        vx: 0,
        vy: 0,
        ttl: 240,
        phase: 0,
      });
    };
    const { heard } = race('drift-test', hold(IDLE, 12), 'player', coastInBomb);
    expect(heard).toEqual([]);
  });

  it('is silent while it sits still and every rival thrusts away', () => {
    const { heard, world } = race('drift-test', hold(IDLE, 180));
    const moved = world.racers.filter(
      (racer) => racer.id !== 'player' && Math.hypot(racer.body.vx, racer.body.vy) > 50,
    );
    expect(moved.map((racer) => racer.id)).toEqual(['tess', 'squib', 'bo']);
    expect(heard).toEqual([]);
  });
});

describe('movement sounds and the song', () => {
  it('keeps every movement sound to three voices over within 0.15 s, so steps and burns never crowd the song', () => {
    const run = race('run-test', [...hold(RIGHT, 90), ...hold(UP_RIGHT, 20)]).heard;
    const drift = race('drift-test', hold(RIGHT, 60)).heard;
    const sounds = [...run, ...drift];
    expect(new Set(sounds.map((h) => h.key))).toEqual(new Set(['step', 'hop', 'burn']));
    expect(sounds.filter((h) => h.voices > 3 || h.endsAt > 0.15)).toEqual([]);
  });
});
