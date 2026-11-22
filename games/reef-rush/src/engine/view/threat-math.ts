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

/** A fresh marker, for callers that reuse one through `markerFor`'s `out`. */
export function newMarker(): Marker {
  return { x: 0, y: 0, angle: 0 };
}

/**
 * The arrow for a squid at `squid` hunting a player at `player` (both screen px), written into `out`
 * and returned. Off-screen, it sits where the line from the player to the squid leaves
 * `MARKER_BOUNDS`, so it points the way the squid really is; in view, just short of the squid.
 * Always inside `MARKER_BOUNDS` and clear of `TOUCH_ZONES` and of `avoid` (such as a splash on
 * screen), pointing along the player-to-squid line to the nearest 45 degrees.
 */
export function markerFor(player: Point, squid: Point, out: Marker = newMarker(), avoid: readonly Rect[] = []): Marker {
  const dx = squid.x - player.x;
  const dy = squid.y - player.y;
  const length = Math.hypot(dx, dy) || 1;
  if (contains(MARKER_BOUNDS, squid)) {
    out.x = squid.x - (dx / length) * STANDOFF;
    out.y = squid.y - (dy / length) * STANDOFF;
  } else {
    exitPoint(player, dx, dy, out);
  }
  clampInto(MARKER_BOUNDS, out);
  clearOfZones(out, avoid);
  out.angle = Math.round(Math.atan2(dy, dx) / EIGHTH_TURN) * EIGHTH_TURN;
  return out;
}

/** Where the ray from `from` along (dx, dy) first leaves `MARKER_BOUNDS`, written into `out`. A start outside the bounds counts as on their nearest edge. */
function exitPoint(from: Point, dx: number, dy: number, out: Point): void {
  const start = { x: from.x, y: from.y };
  clampInto(MARKER_BOUNDS, start);
  const reach = (origin: number, delta: number, min: number, max: number) =>
    delta > 0 ? (max - origin) / delta : delta < 0 ? (min - origin) / delta : Number.POSITIVE_INFINITY;
  const t = Math.min(
    reach(start.x, dx, MARKER_BOUNDS.x, MARKER_BOUNDS.x + MARKER_BOUNDS.w),
    reach(start.y, dy, MARKER_BOUNDS.y, MARKER_BOUNDS.y + MARKER_BOUNDS.h),
  );
  out.x = start.x + dx * t;
  out.y = start.y + dy * t;
}

function contains(rect: Rect, point: Point): boolean {
  return point.x >= rect.x && point.x <= rect.x + rect.w && point.y >= rect.y && point.y <= rect.y + rect.h;
}

function clampInto(rect: Rect, point: Point): void {
  point.x = Math.min(rect.x + rect.w, Math.max(rect.x, point.x));
  point.y = Math.min(rect.y + rect.h, Math.max(rect.y, point.y));
}

/** Moves `point` out of every touch zone and `avoid` rectangle by the shortest way that stays inside the bounds. */
function clearOfZones(point: Point, avoid: readonly Rect[]): void {
  const zones = [...TOUCH_ZONES, ...avoid];
  for (const zone of zones) {
    if (!contains(zone, point)) continue;
    const exits: Point[] = [
      { x: point.x, y: zone.y - 1 },
      { x: zone.x - 1, y: point.y },
      { x: zone.x + zone.w + 1, y: point.y },
      { x: point.x, y: zone.y + zone.h + 1 },
    ].filter((exit) => contains(MARKER_BOUNDS, exit) && !zones.some((other) => contains(other, exit)));
    const [best] = exits.sort(
      (a, b) => Math.hypot(a.x - point.x, a.y - point.y) - Math.hypot(b.x - point.x, b.y - point.y),
    );
    if (best) {
      point.x = best.x;
      point.y = best.y;
    }
  }
}
