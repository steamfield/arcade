/**
 * Where the lock-on warning goes. Pure geometry in screen px, kept out of the Phaser view so it
 * can be tested without a renderer: which squid is hunting the player, and where on the screen's
 * edge its arrow sits so it points at the squid without landing under the HUD or the touch controls.
 */
import { playerOf } from '../../logic/racers.ts';
import type { Squid, World } from '../../logic/types.ts';

/** A point in px. */
export interface Point {
  x: number;
  y: number;
}

/** A rectangle in px, `(x, y)` its top-left corner. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The lock-on arrow's place and the way it points. */
export interface Marker extends Point {
  /** Radians clockwise from pointing right, a multiple of 45 degrees. */
  angle: number;
}

/**
 * Where the arrow may sit: inside the screen's margin and below the HUD row and caption line
 * (which end at y 48), so it never covers a panel.
 */
export const MARKER_BOUNDS: Rect = { x: 8, y: 52, w: 304, h: 120 };
/** UI.md "Safe zones": the back link, the d-pad and the A/B buttons, which the arrow must stay out of. */
export const TOUCH_ZONES: readonly Rect[] = [
  { x: 248, y: 0, w: 72, h: 26 },
  { x: 0, y: 76, w: 108, h: 104 },
  { x: 228, y: 118, w: 92, h: 62 },
];
/** How far short of an on-screen squid its arrow sits, so the arrow points at it without covering it. */
const STANDOFF = 14;
const EIGHTH_TURN = Math.PI / 4;

/** The squid closest to the player among those that have locked on to them, or null when none has. */
export function squidHuntingPlayer(world: World): Squid | null {
  const player = playerOf(world);
  const px = player.body.x + player.body.w / 2;
  const py = player.body.y + player.body.h / 2;
  let nearest: Squid | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const squid of world.squids) {
    if (squid.target?.kind !== 'racer' || squid.target.id !== 'player') continue;
    const distance = Math.hypot(squid.x - px, squid.y - py);
    if (distance < nearestDistance) {
      nearest = squid;
      nearestDistance = distance;
    }
  }
  return nearest;
}

/**
 * The arrow for a squid at `squid` hunting a player at `player` (both screen px): on the screen's
 * edge in the squid's direction when it is off-screen, just short of it when it is in view. Always
 * inside `MARKER_BOUNDS` and clear of `TOUCH_ZONES`, pointing along the player-to-squid line to the
 * nearest 45 degrees.
 */
export function markerFor(player: Point, squid: Point): Marker {
  const dx = squid.x - player.x;
  const dy = squid.y - player.y;
  const length = Math.hypot(dx, dy) || 1;
  const inView = contains(MARKER_BOUNDS, squid);
  const aim = inView
    ? { x: squid.x - (dx / length) * STANDOFF, y: squid.y - (dy / length) * STANDOFF }
    : { x: squid.x, y: squid.y };
  const placed = clearOfZones(clampTo(MARKER_BOUNDS, aim));
  return { ...placed, angle: Math.round(Math.atan2(dy, dx) / EIGHTH_TURN) * EIGHTH_TURN };
}

function contains(rect: Rect, point: Point): boolean {
  return point.x >= rect.x && point.x <= rect.x + rect.w && point.y >= rect.y && point.y <= rect.y + rect.h;
}

function clampTo(rect: Rect, point: Point): Point {
  return {
    x: Math.min(rect.x + rect.w, Math.max(rect.x, point.x)),
    y: Math.min(rect.y + rect.h, Math.max(rect.y, point.y)),
  };
}

/** Moves `point` out of any touch zone by the shortest way that stays inside the bounds. */
function clearOfZones(point: Point): Point {
  let at = point;
  for (const zone of TOUCH_ZONES) {
    if (!contains(zone, at)) continue;
    const exits: Point[] = [
      { x: at.x, y: zone.y - 1 },
      { x: zone.x - 1, y: at.y },
      { x: zone.x + zone.w + 1, y: at.y },
      { x: at.x, y: zone.y + zone.h + 1 },
    ].filter((exit) => contains(MARKER_BOUNDS, exit) && !TOUCH_ZONES.some((other) => contains(other, exit)));
    const [best] = exits.sort((a, b) => Math.hypot(a.x - at.x, a.y - at.y) - Math.hypot(b.x - at.x, b.y - at.y));
    if (best) at = best;
  }
  return at;
}
