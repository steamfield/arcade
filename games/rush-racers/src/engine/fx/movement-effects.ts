/**
 * Plays each medium's movement particles once per world tick: dust at a runner's feet when it
 * jumps, lands or skids, a wisp on a flap and speed lines in a dive, a thruster flame behind a
 * drifter's burn and a spark where it rebounds. Jumps, flaps and rebounds come from events; the
 * rest are read from world state by `movement-sense.ts`. Looks come from the theme's materials.
 */
import type { Stamped } from '@arcade/core';
import type { ThemeId } from '../../logic/courses/types.ts';
import type { Racer, RacerId, World } from '../../logic/types.ts';
import type { RuntimeEvent } from '../runtime.ts';
import { type MovementMoment, movementRecipe } from './movement-recipes.ts';
import { createMovementSense } from './movement-sense.ts';
import type { RecipePlayer } from './recipe-player.ts';
import type { Recipe } from './recipe-types.ts';

/** Reacts to each tick's events and world state. */
export interface MovementEffects {
  onTick(events: readonly Stamped<RuntimeEvent>[]): void;
}

/** A diving flyer sheds a speed line every this many ticks. */
const DIVE_EVERY_TICKS = 3;
/** A burning drifter's flame puffs every this many ticks; the flame's particles live long enough to join up. */
const THRUST_EVERY_TICKS = 2;
/** How far behind a drifter's centre its flame starts, px: just off the back of the sprite. */
const NOZZLE_OFFSET = 7;

const MOMENTS: readonly MovementMoment[] = ['jump', 'land', 'skid', 'flap', 'dive', 'thrust', 'rebound'];

/** Builds the movement effects for `world`, drawn in theme `theme`, played through `player`. */
export function createMovementEffects(world: World, theme: ThemeId, player: RecipePlayer): MovementEffects {
  // Built once, so a tick of thrusting racers allocates no recipes.
  const recipes = Object.fromEntries(MOMENTS.map((moment) => [moment, movementRecipe(moment, theme)])) as Record<
    MovementMoment,
    Recipe
  >;
  const sense = createMovementSense();
  const racerById = (id: RacerId) => world.racers.find((candidate) => candidate.id === id);

  const atFeet = (racer: Racer, moment: MovementMoment, dirX: number) =>
    player.play(recipes[moment], centreX(racer), racer.body.y + racer.body.h, dirX, 0);

  const playEvent = (event: Stamped<RuntimeEvent>) => {
    if (event.type !== 'racer.jumped' && event.type !== 'racer.flapped' && event.type !== 'racer.rebounded') return;
    const racer = racerById(event.id);
    if (!racer) return;
    if (event.type === 'racer.jumped') atFeet(racer, 'jump', racer.facing);
    else if (event.type === 'racer.flapped') player.play(recipes.flap, centreX(racer), centreY(racer), racer.facing, 0);
    else player.play(recipes.rebound, ...reboundPoint(racer, event.axis), 0, 0);
  };

  return {
    onTick(events) {
      for (const event of events) playEvent(event);
      sense.sense(world, (racer, moment, dirX, dirY) => {
        if (moment === 'land' || moment === 'skid') atFeet(racer, moment, dirX);
        else if (moment === 'dive' && world.tick % DIVE_EVERY_TICKS === 0)
          player.play(recipes.dive, centreX(racer), centreY(racer), dirX, dirY);
        else if (moment === 'thrust' && world.tick % THRUST_EVERY_TICKS === 0)
          player.play(
            recipes.thrust,
            centreX(racer) - dirX * NOZZLE_OFFSET,
            centreY(racer) - dirY * NOZZLE_OFFSET,
            dirX,
            dirY,
          );
      });
    },
  };
}

const centreX = (racer: Racer) => racer.body.x + racer.body.w / 2;
const centreY = (racer: Racer) => racer.body.y + racer.body.h / 2;

/**
 * Where a rebound struck: the edge of the body facing the tile it bounced off. After the bounce the
 * racer is moving away from that tile, so the tile lies against its velocity on `axis`.
 */
function reboundPoint(racer: Racer, axis: 'x' | 'y'): [number, number] {
  const { body } = racer;
  if (axis === 'x') return [centreX(racer) - Math.sign(body.vx) * (body.w / 2), centreY(racer)];
  return [centreX(racer), centreY(racer) - Math.sign(body.vy) * (body.h / 2)];
}
