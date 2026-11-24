import { createRng, EventLog, type Stamped } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import { COURSES } from '../../logic/courses/index.ts';
import type { GameEvent } from '../../logic/events.ts';
import { racerOf } from '../../logic/test-world.ts';
import { createWorld } from '../../logic/world.ts';
import type { RuntimeEvent } from '../runtime.ts';
import { FOREST_THEME } from '../themes/forest.ts';
import { createItemEffects } from './item-effects.ts';
import { createParticleField } from './particles.ts';
import { createRecipePlayer } from './recipe-player.ts';
import { FxFrame } from './textures.ts';

/** Item effects over a Bramble Run world, with the frames each field shows after one tick's `events`. */
function framesAfter(events: GameEvent[]) {
  const world = createWorld(COURSES['bramble-run'], new EventLog<GameEvent>(), { seed: 1 });
  const back = createParticleField(64);
  const front = createParticleField(64);
  const effects = createItemEffects(
    world,
    'forest',
    createRecipePlayer(back, front, createRng(1), FOREST_THEME, false),
  );
  effects.onTick(events.map((event, seq) => ({ ...event, tick: 300, seq }) as Stamped<RuntimeEvent>));
  const frames = (field: typeof back) =>
    new Set(field.particles.filter((particle) => particle.live).map((particle) => particle.frame));
  return { world, back: frames(back), front: frames(front), backParticles: back.particles.filter((p) => p.live) };
}

describe('item effects in Thornwood', () => {
  it('trails a flame behind a racer firing Jet Fins, with leaves where it took off', () => {
    const { world, back, backParticles } = framesAfter([
      { type: 'item.used', id: 'tess', kind: 'jetFin', slot: 0, chargesLeft: 0 },
    ]);
    const tess = racerOf(world, 'tess');

    expect(back).toEqual(new Set([FxFrame.flame, FxFrame.leaf]));
    const flames = backParticles.filter((particle) => particle.frame === FxFrame.flame);
    // Tess faces right at the start, so the flame streams out to her left.
    for (const flame of flames) expect(flame.x).toBeLessThan(tess.body.x + tess.body.w / 2);
  });

  it('throws thorns off a racer an urchin hits and shards off a popped shield', () => {
    expect(framesAfter([{ type: 'racer.hit', id: 'player', cause: 'urchin', by: null }]).front).toEqual(
      new Set([FxFrame.thorn]),
    );
    expect(framesAfter([{ type: 'shield.popped', id: 'player' }]).front).toEqual(new Set([FxFrame.shard]));
  });

  it('throws dust where a Meteor lands and sparks where a Comet ends, and nothing for a boulder, a fizzle or a meteor that hit', () => {
    const ended = (style: 'boulder' | 'meteor' | 'comet', reason: 'hit' | 'landed' | 'fizzled' | 'expired') =>
      framesAfter([{ type: 'shot.ended', owner: 'tess', style, reason, x: 500, y: 300 }]);
    const shown = (frames: ReturnType<typeof framesAfter>) => [...frames.back, ...frames.front];

    expect(shown(ended('meteor', 'landed'))).toEqual([FxFrame.puff]);
    expect(shown(ended('comet', 'hit'))).toEqual([FxFrame.spark]);
    expect(shown(ended('comet', 'expired'))).toEqual([FxFrame.spark]);
    expect(shown(ended('meteor', 'fizzled'))).toEqual([]);
    expect(shown(ended('comet', 'fizzled'))).toEqual([]);
    expect(shown(ended('boulder', 'landed'))).toEqual([]);
    expect(shown(ended('meteor', 'hit'))).toEqual([]);
  });

  it('shows nothing for events that are not about items', () => {
    const { back, front } = framesAfter([{ type: 'racer.kicked', id: 'player' }]);

    expect([...back, ...front]).toEqual([]);
  });
});
