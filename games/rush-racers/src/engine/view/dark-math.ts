/**
 * The numbers behind the dark-zone overlay, with no Phaser in them: which
 * zones are on screen and where, how far each racer's light reaches and how
 * it fades at the edge, how far the player's pool leads along their velocity,
 * how the pools flicker, and how many fade steps a zone has room for.
 * `dark-view.ts` draws with these; `dark-math.test.ts` checks them.
 */
import { TILE } from '../../logic/types.ts';

/** Light pool radii in px: the player sees furthest; a rival's glow is smaller; a lantern adds reach. */
export const LIGHT_RADIUS = { player: 64, rival: 28, lanternBonus: 32 } as const;
/** A pool's edge is this many rings, each this wide, each letting through less light. */
export const LIGHT_RING_PX = 4;
export const LIGHT_RINGS = 4;
/** The flicker changes a pool's radius at most once per this many ticks (three times a second). */
export const FLICKER_TICKS = 20;
/** How far a flicker may shrink a pool, in px. */
export const FLICKER_PX = 2;
/** A zone fades in over up to this many steps of this many px at each end. */
export const FADE = { steps: 4, px: 8 } as const;
/**
 * The player's pool shifts ahead by this many seconds of their velocity, capped at LEAD_MAX_PX
 * each way, so at top speed (180 px/s) a hazard ahead is lit about 0.35 s before contact.
 */
export const LEAD_SECONDS = 0.12;
export const LEAD_MAX_PX = 16;

/** A fixed shuffle of shrink amounts, so the light wavers without a visible rhythm. */
const FLICKER_PATTERN = [0, 1, 0, 2, 1, 0, 0, 1, 2, 0, 1] as const;

/** How far a racer's light reaches: the player's own or a rival's, plus the lantern's reach if it holds one. */
export function lightRadius(isPlayer: boolean, holdsLantern: boolean): number {
  const base = isPlayer ? LIGHT_RADIUS.player : LIGHT_RADIUS.rival;
  return base + (holdsLantern ? LIGHT_RADIUS.lanternBonus : 0);
}

/** Every radius a pool can be drawn at, flicker included, so the view can build each texture up front. */
export function reachableRadii(): number[] {
  const radii: number[] = [];
  for (const isPlayer of [true, false]) {
    for (const lantern of [false, true]) {
      for (let shrink = 0; shrink <= FLICKER_PX; shrink++) radii.push(lightRadius(isPlayer, lantern) - shrink);
    }
  }
  return radii;
}

/**
 * How much of the veil a pool of `radius` removes `distance` px from its centre: all of it in the
 * middle, less in each of the outer rings, none past the edge.
 */
export function lightOpacity(distance: number, radius: number): number {
  const ringsIn = Math.ceil((radius - distance) / LIGHT_RING_PX);
  if (ringsIn <= 0) return 0;
  return Math.min(1, ringsIn / LIGHT_RINGS);
}

/**
 * How many px the racer at `index` loses to flicker at `tick`: 0 to FLICKER_PX, changing only
 * when the tick crosses a multiple of FLICKER_TICKS, each racer out of step with the others.
 * Always 0 under reduced motion.
 */
export function flicker(tick: number, index: number, reducedMotion: boolean): number {
  if (reducedMotion) return 0;
  const step = Math.floor(tick / FLICKER_TICKS) + index * 5;
  return FLICKER_PATTERN[step % FLICKER_PATTERN.length] ?? 0;
}

/** How far the player's pool sits ahead of them on one axis, from their speed on it in px/s. */
export function leadOffset(velocity: number): number {
  return Math.round(Math.min(LEAD_MAX_PX, Math.max(-LEAD_MAX_PX, velocity * LEAD_SECONDS)));
}

/** Dark zones as inclusive tile-column ranges, sorted, with overlapping or touching ranges merged into one. */
export function mergeZones(zones: readonly (readonly [number, number])[]): [number, number][] {
  const sorted = [...zones].sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const [from, to] of sorted) {
    const last = merged.at(-1);
    if (last && from <= last[1] + 1) last[1] = Math.max(last[1], to);
    else merged.push([from, to]);
  }
  return merged;
}

/** A zone's columns in screen px: `left` inclusive, `right` exclusive. */
export interface Span {
  left: number;
  right: number;
}

/**
 * Writes the zones that overlap the screen [0, width) into `out`, in screen px for a camera
 * scrolled to `scrollX`, and returns how many it wrote. `out` grows as needed and is reused
 * between frames, so this allocates nothing once warm.
 */
export function spansOnScreen(
  zones: readonly (readonly [number, number])[],
  scrollX: number,
  width: number,
  out: Span[],
): number {
  let count = 0;
  for (const [from, to] of zones) {
    const left = from * TILE - scrollX;
    const right = (to + 1) * TILE - scrollX;
    if (right <= 0 || left >= width) continue;
    const span = out[count] ?? { left: 0, right: 0 };
    span.left = left;
    span.right = right;
    out[count] = span;
    count++;
  }
  return count;
}

/** Fade steps at each end of a zone `width` px wide: up to FADE.steps, fewer when both ends wouldn't fit. */
export function fadeSteps(width: number): number {
  return Math.max(0, Math.min(FADE.steps, Math.floor(width / (2 * FADE.px))));
}
