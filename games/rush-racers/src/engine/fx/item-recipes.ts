/**
 * The recipe table for items: what each power-up's fire looks like, what each cause of a hit looks
 * like where it lands, and a Bubble Shield breaking. Each row names its shape here and takes its
 * look from the theme's materials (`materials.ts`), so a Puffer is always a spiky burst but its
 * barbs are urchin purple on the Reef and green thorns in Thornwood.
 */
import type { ThemeId } from '../../logic/courses/types.ts';
import type { HitCause, PowerUpKind } from '../../logic/types.ts';
import { MATERIALS, type Materials } from './materials.ts';
import type { Recipe, RecipePart } from './recipe-types.ts';

/** Builds one kind's recipe from a theme's materials. */
type RecipeFor = (materials: Materials) => Recipe;

/** A part with the defaults most parts share: drawn above the racers, coasting. */
const part = (
  spec: Pick<RecipePart, 'pattern' | 'look' | 'count' | 'radius' | 'speed' | 'life'> & Partial<RecipePart>,
): RecipePart => ({ motion: 'coast', layer: 'front', ...spec });

/** Each power-up's fire, played at the racer that used it, pointing the way it is going. */
const FIRE: Readonly<Record<PowerUpKind, RecipeFor>> = {
  jetFin: (m) => [
    part({ pattern: 'streak', look: m.flame, count: 8, radius: 20, speed: 1.4, life: 14, layer: 'back' }),
    part({ pattern: 'ring', look: m.puff, motion: 'rise', count: 4, radius: 3, speed: 0.6, life: 18, layer: 'back' }),
  ],
  bubbleShield: (m) => [part({ pattern: 'ring', look: m.shard, count: 12, radius: 6, speed: 1.1, life: 16 })],
  puffer: (m) => [
    part({ pattern: 'scatter', look: m.thorn, count: 10, radius: 5, speed: 2.6, life: 11 }),
    part({ pattern: 'ring', look: m.puff, motion: 'rise', count: 4, radius: 4, speed: 0.5, life: 16 }),
  ],
  inkSac: (m) => [
    part({ pattern: 'scatter', look: m.ink, motion: 'drift', count: 12, radius: 7, speed: 0.7, life: 30 }),
  ],
  glowLantern: (m) => [
    part({ pattern: 'ring', look: m.glow, count: 12, radius: 4, speed: 2.8, life: 12 }),
    part({ pattern: 'twinkle', look: m.glow, count: 4, radius: 4, speed: 0, life: 10 }),
  ],
  cannonball: (m) => [
    part({ pattern: 'ring', look: m.dust, motion: 'fall', count: 12, radius: 6, speed: 1.7, life: 22, layer: 'back' }),
    part({ pattern: 'streak', look: m.streak, count: 6, radius: 24, speed: 1.2, life: 14, layer: 'back' }),
  ],
  homingSquid: (m) => [
    part({ pattern: 'ring', look: m.puff, motion: 'rise', count: 5, radius: 3, speed: 0.8, life: 14 }),
  ],
  riptide: (m) => [
    part({ pattern: 'streak', look: m.streak, count: 6, radius: 28, speed: -1.6, life: 16, layer: 'back' }),
  ],
  undertow: (m) => [part({ pattern: 'inward', look: m.streak, count: 10, radius: 24, speed: 1.8, life: 13 })],
  mimic: (m) => [part({ pattern: 'twinkle', look: m.glow, count: 8, radius: 11, speed: 0, life: 24 })],
};

/** What a hit looks like where it lands, by what caused it. */
const IMPACT: Readonly<Record<HitCause, RecipeFor>> = {
  urchin: (m) => [part({ pattern: 'ring', look: m.thorn, count: 8, radius: 4, speed: 2, life: 12 })],
  puffer: (m) => [part({ pattern: 'scatter', look: m.thorn, count: 8, radius: 4, speed: 2.2, life: 12 })],
  jelly: (m) => [part({ pattern: 'scatter', look: m.zap, count: 8, radius: 7, speed: 0.6, life: 10 })],
  lightning: (m) => [part({ pattern: 'scatter', look: m.zap, count: 10, radius: 9, speed: 0.8, life: 12 })],
  bubble: (m) => [part({ pattern: 'ring', look: m.puff, motion: 'splash', count: 8, radius: 3, speed: 1.4, life: 14 })],
  flash: (m) => [part({ pattern: 'ring', look: m.glow, count: 8, radius: 3, speed: 1.2, life: 16 })],
  squid: (m) => [part({ pattern: 'scatter', look: m.ink, motion: 'drift', count: 8, radius: 4, speed: 1, life: 20 })],
  shark: enemyThump,
  eel: enemyThump,
  crab: enemyThump,
};

/** A creature's hit: a heavy ring of grit and a few sparks. */
function enemyThump(m: Materials): Recipe {
  return [
    part({ pattern: 'ring', look: m.dust, motion: 'fall', count: 8, radius: 5, speed: 1.5, life: 18 }),
    part({ pattern: 'scatter', look: m.spark, count: 4, radius: 3, speed: 1.8, life: 10 }),
  ];
}

/** The fire of power-up `kind` in a race drawn in theme `theme`. */
export function fireRecipe(kind: PowerUpKind, theme: ThemeId): Recipe {
  return FIRE[kind](MATERIALS[theme]);
}

/** A hit by `cause` landing in a race drawn in theme `theme`. */
export function impactRecipe(cause: HitCause, theme: ThemeId): Recipe {
  return IMPACT[cause](MATERIALS[theme]);
}

/** A Bubble Shield soaking up a hit: a ring of shards flying off. */
export function shieldPopRecipe(theme: ThemeId): Recipe {
  return [part({ pattern: 'ring', look: MATERIALS[theme].shard, count: 10, radius: 7, speed: 1.9, life: 14 })];
}

/** One speed line along a new Riptide lane, played every few px of it pointing along the flow. */
export function laneRecipe(theme: ThemeId): Recipe {
  return [
    part({
      pattern: 'streak',
      look: MATERIALS[theme].streak,
      count: 1,
      radius: 0,
      speed: -1.2,
      life: 22,
      layer: 'back',
    }),
  ];
}

/** Speed lines trailing a racer an Undertow has just caught, pointing the way it is dragged. */
export function pulledRecipe(theme: ThemeId): Recipe {
  return [part({ pattern: 'streak', look: MATERIALS[theme].streak, count: 3, radius: 12, speed: 0.8, life: 14 })];
}
