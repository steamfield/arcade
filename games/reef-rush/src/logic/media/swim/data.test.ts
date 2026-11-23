/**
 * A medium reads only its own data: asked about a world another medium built, swim and glide each
 * fail at the read, naming the kind they got, instead of racing on the other's numbers.
 */
import { EventLog } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import { GLIDE_MEDIUM } from '../../conformance/glide.ts';
import type { GameEvent } from '../../events.ts';
import { courseFromLevel, racerOf } from '../../test-world.ts';
import { createWorld } from '../../world.ts';
import { MEDIA, registerMedium } from '../index.ts';

registerMedium(GLIDE_MEDIUM);

const LANES = `
  ########
  #1....F#
  #2....F#
  #3....F#
  #4....F#
  ########
`;

const worldIn = (medium: string) => createWorld(courseFromLevel(LANES, medium), new EventLog<GameEvent>(), { seed: 1 });

describe("a medium asked about another medium's world", () => {
  it('swim refuses glide nav', () => {
    expect(() => MEDIA.swim.distanceAt(worldIn('glide'), { x: 1, y: 1 })).toThrow(
      "Swim read nav of kind 'glide'; it can only read its own ('swim') data",
    );
  });

  it('glide refuses swim nav', () => {
    expect(() => GLIDE_MEDIUM.distanceAt(worldIn('swim'), { x: 1, y: 1 })).toThrow(
      "Glide read nav of kind 'swim'; it can only read its own ('glide') data",
    );
  });

  it("swim refuses a glide rival's pilot memory", () => {
    const world = worldIn('glide');
    const tess = racerOf(world, 'tess');
    const draws = { wobble: 0.5, kick: 0.5, side: 0.5, item: 0.5 };

    expect(() => MEDIA.swim.steer(world, tess, MEDIA.swim.tuning.base, draws, false)).toThrow(
      "Swim read pilot memory of kind 'glide'",
    );
  });
});
