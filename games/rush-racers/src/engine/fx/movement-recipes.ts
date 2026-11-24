/**
 * The recipe table for movement: what a racer sheds as it moves through its medium. Runners kick
 * up dust when they jump, land and turn hard; flyers shed a wisp on each flap and speed lines in a
 * dive; drifters burn a thruster flame and spark off what they rebound from. Swimmers keep the
 * bubble trail (`trail.ts`). Looks come from the theme's materials, so a runner in a Reef test
 * course still kicks up sand rather than leaves.
 */
import type { ThemeId } from '../../logic/courses/types.ts';
import { MATERIALS, type Materials } from './materials.ts';
import type { Recipe, RecipePart } from './recipe-types.ts';

/** Every movement moment that has an effect. */
export type MovementMoment = 'jump' | 'land' | 'skid' | 'flap' | 'dive' | 'thrust' | 'rebound';

/** A part with the defaults most movement parts share: drawn behind the racers. */
const part = (spec: Omit<RecipePart, 'layer'> & Partial<Pick<RecipePart, 'layer'>>): RecipePart => ({
  layer: 'back',
  ...spec,
});

/** Each moment's particles, from a theme's materials. */
const MOVEMENT: Readonly<Record<MovementMoment, (m: Materials) => Recipe>> = {
  jump: (m) => [part({ pattern: 'kickup', look: m.dust, motion: 'drift', count: 4, radius: 2, speed: 0.9, life: 18 })],
  land: (m) => [part({ pattern: 'kickup', look: m.dust, motion: 'drift', count: 8, radius: 3, speed: 1.4, life: 20 })],
  skid: (m) => [part({ pattern: 'kickup', look: m.dust, motion: 'drift', count: 4, radius: 2, speed: 0.8, life: 16 })],
  flap: (m) => [part({ pattern: 'scatter', look: m.wisp, motion: 'fall', count: 3, radius: 5, speed: 0.5, life: 26 })],
  dive: (m) => [
    part({ pattern: 'streak', look: m.streak, motion: 'coast', count: 1, radius: 10, speed: 0.4, life: 10 }),
  ],
  thrust: (m) => [
    part({ pattern: 'streak', look: m.flame, motion: 'coast', count: 2, radius: 6, speed: 1.2, life: 8 }),
  ],
  rebound: (m) => [
    part({
      pattern: 'ring',
      look: m.spark,
      motion: 'coast',
      count: 5,
      radius: 3,
      speed: 1.6,
      life: 10,
      layer: 'front',
    }),
  ],
};

/** The particles movement moment `moment` sheds in a race drawn in theme `theme`. */
export function movementRecipe(moment: MovementMoment, theme: ThemeId): Recipe {
  return MOVEMENT[moment](MATERIALS[theme]);
}
