/**
 * What each world's effects are made of. Recipes name a role (the puff a moment sheds, the flame
 * behind a burn, the spark off a hit) and this table says how that role looks in each theme: in the
 * Reef a puff is a bubble, in Thornwood a leaf, in Cloudreach a cloud puff, in Farside a wisp of
 * plasma. Colours are picked to sit with each theme's palette (the forest's trail brown, the sky's
 * contrail white, the space trail's ice blue) without adding to the theme files.
 */
import type { ThemeId } from '../../logic/courses/types.ts';
import type { ParticleLook } from './recipe-types.ts';
import { FxFrame } from './textures.ts';

/**
 * The parts effects are built from:
 * - `puff`: the medium's soft stuff, shed by launches, pops and shields.
 * - `dust`: heavier grit kicked off the ground or thrown by a heavy impact.
 * - `flame`: a burn: Jet Fins, thrusters.
 * - `spark`: a hard knock: rebounds, enemy hits.
 * - `zap`: an electric sting: jellies, lightning.
 * - `ink`: a dark cloud.
 * - `shard`: a broken shield.
 * - `glow`: a bright point of light: flashes, shimmers.
 * - `streak`: a speed line.
 * - `thorn`: a barb: urchins, Puffers.
 * - `wisp`: what a wingbeat sheds.
 */
export type Role = 'puff' | 'dust' | 'flame' | 'spark' | 'zap' | 'ink' | 'shard' | 'glow' | 'streak' | 'thorn' | 'wisp';

/** How every role looks in one theme. */
export type Materials = Readonly<Record<Role, ParticleLook>>;

const look = (frame: string, tint: number, alpha = 1): ParticleLook => ({ frame, tint, alpha });

/** The Reef: bubbles, sand, water jets and urchin purple. */
const OCEAN: Materials = {
  puff: look(FxFrame.bubble, 0xffffff, 0.9),
  dust: look(FxFrame.chip, 0xe8d8a8, 0.9),
  flame: look(FxFrame.streak, 0x7fdbff, 0.9),
  spark: look(FxFrame.spark, 0xffffff),
  zap: look(FxFrame.spark, 0x9af0ff),
  ink: look(FxFrame.puff, 0x4a3a78, 0.9),
  shard: look(FxFrame.shard, 0xbfefff, 0.9),
  glow: look(FxFrame.sparkle, 0xfff0a0),
  streak: look(FxFrame.streak, 0xe4f8ff, 0.8),
  thorn: look(FxFrame.thorn, 0xc890ff),
  wisp: look(FxFrame.bubbleSmall, 0xffffff, 0.8),
};

/** Thornwood: leaves, earth, fire and thorns. */
const FOREST: Materials = {
  puff: look(FxFrame.leaf, 0x8cc850, 0.95),
  dust: look(FxFrame.puff, 0xb09070, 0.85),
  flame: look(FxFrame.flame, 0xffa040),
  spark: look(FxFrame.spark, 0xffe890),
  zap: look(FxFrame.spark, 0xfff080),
  ink: look(FxFrame.puff, 0x5a4860, 0.9),
  shard: look(FxFrame.shard, 0xe0f4c0, 0.9),
  glow: look(FxFrame.sparkle, 0xfff4b0),
  streak: look(FxFrame.streak, 0xd8c090, 0.8),
  thorn: look(FxFrame.thorn, 0xa8d060),
  wisp: look(FxFrame.leaf, 0xc8e070, 0.9),
};

/** Cloudreach: cloud puffs, feathers, sunlit streaks and storm grey. */
const SKY: Materials = {
  puff: look(FxFrame.puff, 0xf4f8ff, 0.85),
  dust: look(FxFrame.puff, 0xc8d2e4, 0.8),
  flame: look(FxFrame.streak, 0xfff4d8, 0.9),
  spark: look(FxFrame.spark, 0xfff6a0),
  zap: look(FxFrame.spark, 0xfff060),
  ink: look(FxFrame.puff, 0x4e4868, 0.9),
  shard: look(FxFrame.shard, 0xffffff, 0.9),
  glow: look(FxFrame.sparkle, 0xffd8a8),
  streak: look(FxFrame.streak, 0xffffff, 0.75),
  thorn: look(FxFrame.thorn, 0xe4eeff),
  wisp: look(FxFrame.feather, 0xffffff, 0.9),
};

/** Farside: plasma, sparks, blue thruster flame and the void's dark. */
const SPACE: Materials = {
  puff: look(FxFrame.puff, 0xb0a0ff, 0.8),
  dust: look(FxFrame.chip, 0x9fc8ff, 0.8),
  flame: look(FxFrame.flame, 0xff9870),
  spark: look(FxFrame.spark, 0xd8ecff),
  zap: look(FxFrame.spark, 0xa0e0ff),
  ink: look(FxFrame.puff, 0x6a5a90, 0.9),
  shard: look(FxFrame.shard, 0xb0d8ff, 0.9),
  glow: look(FxFrame.sparkle, 0xe0f0ff),
  streak: look(FxFrame.streak, 0x9fc8ff, 0.8),
  thorn: look(FxFrame.thorn, 0xc0a0ff),
  wisp: look(FxFrame.chip, 0xb0a0ff, 0.8),
};

/** Every theme's materials. */
export const MATERIALS: Readonly<Record<ThemeId, Materials>> = { ocean: OCEAN, forest: FOREST, sky: SKY, space: SPACE };
