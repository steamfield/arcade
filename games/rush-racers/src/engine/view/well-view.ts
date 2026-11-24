/**
 * Gravity wells on the race screen: where each one is, how far it reaches, and for a black hole the
 * horizon not to cross. `wellMarks` says what to draw, in world pixels; `createWellView` draws it
 * once into one static Graphics object: a planet as a shaded globe over the rock the course gives it,
 * a black hole as a black disc ringed by a bright accretion rim and disc. Wells never move, so
 * nothing is redrawn after create and nothing animates (UI.md: motion comes from the logic tick so
 * captures repeat), which also keeps reduced motion and full motion the same picture.
 */
import type Phaser from 'phaser';
import { cellAt } from '../../logic/level/query.ts';
import { type Level, TILE, type Vec } from '../../logic/types.ts';
import { Layer } from './layers.ts';

/** What to draw for one well: its centre, the ring at its reach, and a horizon disc for a black hole (null for a planet). */
export interface WellMark {
  centre: Vec;
  reach: number;
  horizon: number | null;
}

/** Just over the terrain tiles and under everything at `Layer.water` (solar wind, the finish gate), so a well never hides either. */
const WELL_DEPTH = Layer.tiles + 0.5;
/** The faint ring at the edge of a well's pull. */
const REACH_RING = { width: 1, colour: 0xc8d8ff, alpha: 0.3 } as const;
/**
 * A planet: a globe shaded from its night side to a highlight toward the upper left, where the
 * theme's light comes from, inside a thin haze of atmosphere. Its radius reaches the nearest tile
 * that isn't rock, so the body covers the rock the course gives it, between `minRadius` and
 * `maxReachFraction` of its reach.
 */
const PLANET = {
  shades: [0x1a2448, 0x2c4278, 0x4a68a8, 0x7896d0, 0xb4ccf0],
  /** Each lighter shade's disc is this fraction of the body's radius smaller than the one under it. */
  shadeStep: 0.16,
  atmosphere: { width: 2, colour: 0x8fb0e8, alpha: 0.35 },
  minRadius: TILE / 2,
  maxReachFraction: 0.5,
} as const;
/** The way toward the light, as a unit vector: up and to the left. */
const TOWARD_LIGHT = { x: -Math.SQRT1_2, y: -Math.SQRT1_2 } as const;
/**
 * A black hole: a flattened accretion disc of glowing gas seen edge-on behind it, a solid black disc
 * to the horizon, a bright photon rim, and a thin band of the disc crossing in front. Sizes are in
 * horizon radii.
 */
const HOLE = {
  glow: { colour: 0xff9a3c, alpha: 0.25, width: 4 },
  disc: [
    { colour: 0x8a3a12, halfWidth: 2.1, halfHeight: 0.5 },
    { colour: 0xd86a24, halfWidth: 1.75, halfHeight: 0.36 },
    { colour: 0xffb860, halfWidth: 1.4, halfHeight: 0.22 },
  ],
  core: 0x000000,
  rim: { width: 2, colour: 0xffe2a8 },
  frontBand: { colour: 0xffd08a, alpha: 0.85, halfWidth: 1.05, halfHeight: 0.1, drop: 0.12 },
} as const;

/** One mark per well of `level`, in the level's order. */
export function wellMarks(level: Level): WellMark[] {
  return level.wells.map((well) => ({
    centre: { x: well.centre.x, y: well.centre.y },
    reach: well.reach,
    horizon: well.horizon,
  }));
}

/**
 * Draws `level`'s wells in `scene`, behind racers and pickups and in front of the backdrop. A level
 * without wells draws nothing. The drawing is still, so `_reducedMotion` changes nothing.
 */
export function createWellView(scene: Phaser.Scene, level: Level, _reducedMotion: boolean): void {
  const marks = wellMarks(level);
  if (marks.length === 0) return;
  const graphics = scene.add.graphics().setDepth(WELL_DEPTH);
  for (const mark of marks) {
    drawReachRing(graphics, mark);
    if (mark.horizon === null) drawPlanet(graphics, mark.centre, planetRadius(level, mark));
    else drawBlackHole(graphics, mark.centre, mark.horizon);
  }
}

/** The faint circle where the well's pull ends. */
function drawReachRing(graphics: Phaser.GameObjects.Graphics, mark: WellMark): void {
  graphics.lineStyle(REACH_RING.width, REACH_RING.colour, REACH_RING.alpha);
  graphics.strokeCircle(mark.centre.x, mark.centre.y, mark.reach);
}

/** Distance in px from `point` to the nearest point of tile (`col`, `row`); 0 when the point is on it. */
function distanceToTile(point: Vec, col: number, row: number): number {
  const dx = Math.max(col * TILE - point.x, 0, point.x - (col + 1) * TILE);
  const dy = Math.max(row * TILE - point.y, 0, point.y - (row + 1) * TILE);
  return Math.hypot(dx, dy);
}

/** How big to draw a planet: out to the nearest tile around its centre that isn't rock, within the body's limits. */
function planetRadius(level: Level, mark: WellMark): number {
  const limit = mark.reach * PLANET.maxReachFraction;
  const span = Math.ceil(limit / TILE) + 1;
  const col = Math.floor(mark.centre.x / TILE);
  const row = Math.floor(mark.centre.y / TILE);
  let nearestOpen = limit;
  for (let y = row - span; y <= row + span; y++) {
    for (let x = col - span; x <= col + span; x++) {
      if (cellAt(level, x, y) === 'rock') continue;
      nearestOpen = Math.min(nearestOpen, distanceToTile(mark.centre, x, y));
    }
  }
  return Math.max(PLANET.minRadius, nearestOpen);
}

/**
 * A planet's globe: discs from its darkest shade to its lightest, each smaller one pushed toward the
 * light until it touches the body's lit edge, so the shading crowds the lit limb like a lit sphere.
 */
function drawPlanet(graphics: Phaser.GameObjects.Graphics, centre: Vec, radius: number): void {
  PLANET.shades.forEach((shade, index) => {
    const shadeRadius = radius * (1 - index * PLANET.shadeStep);
    const offset = radius - shadeRadius;
    graphics.fillStyle(shade, 1);
    graphics.fillCircle(centre.x + TOWARD_LIGHT.x * offset, centre.y + TOWARD_LIGHT.y * offset, shadeRadius);
  });
  const { atmosphere } = PLANET;
  graphics.lineStyle(atmosphere.width, atmosphere.colour, atmosphere.alpha);
  graphics.strokeCircle(centre.x, centre.y, radius + atmosphere.width / 2);
}

/** A black hole: its glow, the disc behind it, the black core and rim, then the disc's band in front. */
function drawBlackHole(graphics: Phaser.GameObjects.Graphics, centre: Vec, horizon: number): void {
  graphics.lineStyle(HOLE.glow.width, HOLE.glow.colour, HOLE.glow.alpha);
  graphics.strokeCircle(centre.x, centre.y, horizon + HOLE.glow.width);
  for (const ring of HOLE.disc) {
    graphics.fillStyle(ring.colour, 1);
    graphics.fillEllipse(centre.x, centre.y, ring.halfWidth * 2 * horizon, ring.halfHeight * 2 * horizon);
  }
  graphics.fillStyle(HOLE.core, 1);
  graphics.fillCircle(centre.x, centre.y, horizon);
  graphics.lineStyle(HOLE.rim.width, HOLE.rim.colour, 1);
  graphics.strokeCircle(centre.x, centre.y, horizon);
  const band = HOLE.frontBand;
  graphics.fillStyle(band.colour, band.alpha);
  graphics.fillEllipse(
    centre.x,
    centre.y + band.drop * horizon,
    band.halfWidth * 2 * horizon,
    band.halfHeight * 2 * horizon,
  );
}
