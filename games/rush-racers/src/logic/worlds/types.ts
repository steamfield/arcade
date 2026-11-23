/**
 * What a world is: a movement style plus the names a player reads for its cast and for the shared
 * items, pickups, enemies and hazards. Mechanics, ids and balance are shared by every world; a world
 * only names them. Ids are plain strings so tests can register worlds beside the shipped ones. The
 * engine's world skin (`engine/worlds/`) draws a world; this is its data in logic.
 */
import type { CharacterId, EnemyKind, PowerUpKind } from '../types.ts';

/** Shipped worlds. Grows with each world: 'thornwood', then air or space. */
export type ShippedWorldId = 'reef' | 'thornwood';

/** Hazards the course format places (`*` and `j`), by their logic names. */
export type HazardKind = 'urchin' | 'jelly';

/** Pickups the course format places (`?` and `o`), by their logic names. */
export type PickupKind = 'clam' | 'pearl';

/** A world as data. */
export interface WorldDef {
  /** Stable id: courses name it. */
  id: string;
  /** Shown where worlds are told apart (course select). */
  name: string;
  /** A key of `MEDIA` (or a medium registered for tests): how every course in this world is raced. */
  medium: string;
  /** Each character slot's name in this world; the view upper-cases it and takes the first word as the short name. */
  cast: Readonly<Record<CharacterId, string>>;
  /** What the player calls each item in this world. */
  items: Readonly<Record<PowerUpKind, string>>;
  /** What the player calls each pickup in this world. */
  pickups: Readonly<Record<PickupKind, string>>;
  /** What the player calls each enemy in this world. */
  enemies: Readonly<Record<EnemyKind, string>>;
  /** What the player calls each placed hazard in this world. */
  hazards: Readonly<Record<HazardKind, string>>;
}
