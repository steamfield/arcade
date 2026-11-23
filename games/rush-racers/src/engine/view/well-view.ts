/**
 * Gravity wells on the race screen: where each one is, how far it reaches, and for a black hole the
 * horizon not to cross. `wellMarks` says what to draw, in world pixels; `createWellView` draws it
 * once, with placeholder shapes, into one static Graphics object. Wells never move, so nothing is
 * redrawn after create and nothing animates (UI.md: motion comes from the logic tick so captures
 * repeat), which also keeps reduced motion and full motion the same picture.
 */
import type Phaser from 'phaser';
import type { Level, Vec } from '../../logic/types.ts';
import { Layer } from './layers.ts';

/** What to draw for one well: its centre, the ring at its reach, and a horizon disc for a black hole (null for a planet). */
export interface WellMark {
  centre: Vec;
  reach: number;
  horizon: number | null;
}

/** In front of the backdrop and terrain tiles, behind pickups (`Layer.objects`) and racers. Drift courses have no water. */
const WELL_DEPTH = Layer.water;
/** The faint ring at the edge of a well's pull. */
const REACH_RING = { width: 1, colour: 0xc8d8ff, alpha: 0.3 } as const;
/** A planet's body: a fraction of its reach across, in a pale colour laid down in see-through layers so its edge is soft. */
const PLANET = { reachFraction: 0.25, colour: 0x9fb8e8, layerAlpha: 0.22, layers: 3 } as const;
/** A black hole: solid black to its horizon, with a bright rim so it reads against dark space. */
const HOLE = { colour: 0x000000, rimWidth: 2, rimColour: 0xffd98a } as const;

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
    if (mark.horizon === null) drawPlanet(graphics, mark);
    else drawBlackHole(graphics, mark.centre, mark.horizon);
  }
}

/** The faint circle where the well's pull ends. */
function drawReachRing(graphics: Phaser.GameObjects.Graphics, mark: WellMark): void {
  graphics.lineStyle(REACH_RING.width, REACH_RING.colour, REACH_RING.alpha);
  graphics.strokeCircle(mark.centre.x, mark.centre.y, mark.reach);
}

/** A planet's soft disc: smaller see-through discs stacked on each other, densest at the centre. */
function drawPlanet(graphics: Phaser.GameObjects.Graphics, mark: WellMark): void {
  const radius = mark.reach * PLANET.reachFraction;
  graphics.fillStyle(PLANET.colour, PLANET.layerAlpha);
  for (let layer = 0; layer < PLANET.layers; layer++) {
    graphics.fillCircle(mark.centre.x, mark.centre.y, radius * (1 - layer / PLANET.layers));
  }
}

/** A black hole: a black disc filling its horizon, outlined by a bright rim. */
function drawBlackHole(graphics: Phaser.GameObjects.Graphics, centre: Vec, horizon: number): void {
  graphics.fillStyle(HOLE.colour, 1);
  graphics.fillCircle(centre.x, centre.y, horizon);
  graphics.lineStyle(HOLE.rimWidth, HOLE.rimColour, 1);
  graphics.strokeCircle(centre.x, centre.y, horizon);
}
