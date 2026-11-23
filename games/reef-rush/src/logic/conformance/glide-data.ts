/**
 * Glide's shapes of the data a medium keeps in the world, each extending the opaque base in
 * `media/types.ts` with `kind: 'glide'`, and the accessors glide reads them through. They share
 * nothing with swim's, which is the point: the conformance suite proves generic code never assumes
 * swim's shapes. An accessor throws on another medium's data. Test-only.
 */
import type { MediumEnv, MediumNav, PilotMemory, RacerMotion } from '../media/types.ts';
import type { GridSize, Vec } from '../types.ts';

/** Glide's navigation: one uniform-cost distance to the finish, indexed `y * width + x`, in tiles. */
export interface GlideNav extends MediumNav, GridSize {
  readonly kind: 'glide';
  distance: Float32Array;
}

/** Still air: glide's surroundings do nothing to a body. */
export interface GlideEnv extends MediumEnv {
  readonly kind: 'glide';
}

/** A glide rival's memory: its last aim and any sideways push a forced recovery holds. */
export interface GlidePilot extends PilotMemory {
  readonly kind: 'glide';
  /** Unit aim along the way from the last tick. */
  aim: Vec;
  /** Ticks left of the sideways push; 0 when not recovering. */
  recoverTicks: number;
  recoverDir: Vec;
}

/** Glide keeps no per-racer movement state beyond its kind. */
export interface GlideMotion extends RacerMotion {
  readonly kind: 'glide';
}

/**
 * The world's nav as glide's distance field.
 *
 * @throws {Error} When the nav was built by another medium.
 */
export function glideNav(nav: MediumNav): GlideNav {
  if (nav.kind !== 'glide') throw wrongKind('nav', nav.kind);
  return nav as GlideNav;
}

/**
 * A rival's pilot memory as glide's.
 *
 * @throws {Error} When the memory was created by another medium.
 */
export function glidePilot(memory: PilotMemory): GlidePilot {
  if (memory.kind !== 'glide') throw wrongKind('pilot memory', memory.kind);
  return memory as GlidePilot;
}

function wrongKind(what: string, kind: string): Error {
  return new Error(`Glide read ${what} of kind '${kind}'; it can only read its own ('glide') data`);
}
