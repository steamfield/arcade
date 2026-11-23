/**
 * The world skin registry: every shipped world's skin by world id, the lookup views go through for a
 * course, boot registration of skin textures, and the completeness checks boot and tests run.
 */
import type Phaser from 'phaser';
import type { Course } from '../../logic/courses/types.ts';
import { CHARACTER_IDS, ENEMY_KINDS, POWER_UP_KINDS } from '../../logic/types.ts';
import type { ShippedWorldId } from '../../logic/worlds/types.ts';
import { Frame } from '../art/keys.ts';
import { REEF_SKIN } from './reef.ts';
import { THORNWOOD_SKIN } from './thornwood.ts';
import type { WorldSkin } from './types.ts';

/** Every shipped world's skin, keyed by world id, so shipping a world without a skin fails to compile. */
export const SKINS: Readonly<Record<ShippedWorldId, WorldSkin>> = {
  reef: REEF_SKIN,
  thornwood: THORNWOOD_SKIN,
};

/**
 * The skin a course is drawn with: its world's.
 *
 * @throws {Error} When the course's world has no skin, naming the course and the world.
 */
export function skinFor(course: Pick<Course, 'id' | 'world'>): WorldSkin {
  if (!Object.hasOwn(SKINS, course.world)) {
    throw new Error(`Course '${course.id}' names world '${course.world}', which the engine has no skin for`);
  }
  return SKINS[course.world as ShippedWorldId];
}

/** Builds every shipped skin's own textures; boot calls it once. */
export function registerSkinTextures(scene: Phaser.Scene): void {
  for (const skin of Object.values(SKINS)) skin.registerTextures(scene);
}

/**
 * Throws unless `skin` names art for every character slot, item, enemy, pickup and hazard glint, and words for
 * every item caption and enemy caption. Skins are compiled in, so a miss is a programming error.
 *
 * @throws {Error} Naming the world and the first missing key, e.g. "World 'thornwood' skin has no racer for 'gil'".
 */
export function assertSkinAssets(skin: WorldSkin): void {
  const missing = (what: string, key: string): never => {
    throw new Error(`World '${skin.id}' skin has no ${what} for '${key}'`);
  };
  for (const id of CHARACTER_IDS) {
    if (!skin.cast.racers[id]) missing('racer', id);
    if (!skin.cast.portraits[id]?.texture) missing('portrait', id);
    if (!skin.cast.heads[id]?.texture) missing('head', id);
    if (!skin.cast.abilities[id]?.name) missing('ability text', id);
  }
  for (const kind of POWER_UP_KINDS) {
    if (!skin.objects.itemIcons[kind]?.texture) missing('item icon', kind);
    if (!skin.objects.itemTextures[kind]) missing('item texture', kind);
  }
  for (const kind of ENEMY_KINDS) {
    if (!skin.objects.enemies.bodies[kind]) missing('enemy', kind);
    if (!skin.objects.text.enemyCaptions[kind]) missing('enemy caption', kind);
  }
  for (const [what, key] of Object.entries(skin.objects.pickups)) if (!key) missing('pickup', what);
  for (const [what, key] of Object.entries(skin.objects.attack)) if (!key) missing('attack art', what);
  for (const hazard of ['urchin', 'jelly'] as const) if (!skin.objects.glints[hazard]?.key) missing('glint', hazard);
}

/** What `assertSkinTextures` asks of Phaser's texture manager: whether a texture, and a frame in it, exist. */
export interface TextureLookup {
  exists(key: string): boolean;
  get(key: string): { has(frame: string): boolean };
}

/**
 * Throws unless every texture and frame `skin` names was built: the racers with both stride frames,
 * portraits, heads, item icons and sprites, attack art, the pearl and the clam's open and shut
 * frames, enemy bodies and marks. Boot runs it for every skin once textures are registered, so a key
 * a skin names but never draws fails at boot rather than as a missing-texture square mid-race.
 *
 * @throws {Error} Naming the world and the first missing texture or frame, e.g.
 *   "World 'thornwood' skin names texture 'thornwood-acorn', which was never built".
 */
export function assertSkinTextures(textures: TextureLookup, skin: WorldSkin): void {
  const need = (texture: string, frame?: string): void => {
    if (!textures.exists(texture)) {
      throw new Error(`World '${skin.id}' skin names texture '${texture}', which was never built`);
    }
    if (frame !== undefined && !textures.get(texture).has(frame)) {
      throw new Error(`World '${skin.id}' skin names frame '${frame}' of '${texture}', which was never built`);
    }
  };
  const { cast, objects } = skin;
  for (const id of CHARACTER_IDS) {
    need(cast.racers[id], Frame.a);
    need(cast.racers[id], Frame.b);
    need(cast.portraits[id].texture, cast.portraits[id].frame);
    need(cast.heads[id].texture, cast.heads[id].frame);
  }
  for (const kind of POWER_UP_KINDS) {
    need(objects.itemIcons[kind].texture, objects.itemIcons[kind].frame);
    need(objects.itemTextures[kind]);
  }
  for (const texture of Object.values(objects.attack)) need(texture);
  need(objects.pickups.pearl);
  need(objects.pickups.clam, Frame.clamClosed);
  need(objects.pickups.clam, Frame.clamOpen);
  for (const kind of ENEMY_KINDS) need(objects.enemies.bodies[kind]);
  need(objects.enemies.eelBody);
  need(objects.enemies.marks);
}
