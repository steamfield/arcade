/**
 * Draws the course in its theme's look: solid tiles through a Phaser Tilemap built from the parsed
 * level (a legend glyph with its own art gets its own tile, and air draws as the theme's sky),
 * flowing cells such as kelp and currents as animated sprites, the theme's wave crest along the
 * top of the water under open sky, the finish gate, and inert placeholders for pearls, clams, urchins
 * and jellies. The pickup and hazard views take over those placeholders. Broken coral is removed
 * when its `coral.broken` event arrives.
 */
import type { Stamped } from '@arcade/core';
import type Phaser from 'phaser';
import type { Cell, Level } from '../../logic/types.ts';
import { TILE, type Vec } from '../../logic/types.ts';
import { Frame, type FrameKey, Tex, type TexKey } from '../art/keys.ts';
import type { RuntimeEvent } from '../runtime.ts';
import type { HazardSkin, TerrainArt, Theme } from '../themes/types.ts';
import { addHazardSprite } from './hazard-view.ts';
import { Layer } from './layers.ts';
import { type Legend, tileAt } from './terrain-tile.ts';

/** Course objects drawn as stand-ins until the pickup and hazard views replace them. */
export interface LevelPlaceholders {
  pearls: Phaser.GameObjects.Image[];
  clams: Phaser.GameObjects.Image[];
  urchins: Phaser.GameObjects.Sprite[];
  jellies: Phaser.GameObjects.Sprite[];
}

/** The drawn course: its placeholders and a hook for course-changing events. */
export interface LevelView {
  placeholders: LevelPlaceholders;
  /** Applies a tick's drained events to the course (today only `coral.broken`). */
  onEvents(events: readonly Stamped<RuntimeEvent>[]): void;
}

const TILESET_NAME = 'reef';

/**
 * Builds every course object for `level` in `scene`, drawn with `theme`. `legend` is the course's
 * own glyph legend, so its glyphs can draw with their own art.
 *
 * @throws {Error} When Phaser rejects the generated tileset or layer, which means the theme's textures were not registered.
 */
export function createLevelView(scene: Phaser.Scene, level: Level, theme: Theme, legend: Legend = {}): LevelView {
  const layer = createTileLayer(scene, level, theme.terrain, legend);
  addFlowingCells(scene, level, theme.terrain);
  addWaterline(scene, level, theme.terrain);
  addFinishGate(scene, level, theme.terrain);
  const placeholders = addPlaceholders(scene, level, theme.hazards);
  return {
    placeholders,
    onEvents(events) {
      for (const event of events) {
        if (event.type === 'coral.broken') layer.removeTileAt(event.tx, event.ty);
      }
    },
  };
}

function createTileLayer(
  scene: Phaser.Scene,
  level: Level,
  terrain: TerrainArt,
  legend: Legend,
): Phaser.Tilemaps.TilemapLayerBase {
  const data = level.cells.map((row, y) => row.map((_, x) => tileAt(level, terrain, legend, x, y)));
  const map = scene.make.tilemap({ data, tileWidth: TILE, tileHeight: TILE });
  const tileset = map.addTilesetImage(TILESET_NAME, terrain.tileset, TILE, TILE, 0, 0);
  if (!tileset) {
    throw new Error(
      `Tileset "${TILESET_NAME}" could not use texture "${terrain.tileset}"; register the theme's textures first`,
    );
  }
  const layer = map.createLayer(0, tileset, 0, 0);
  if (!layer) throw new Error(`Tilemap layer for "${level.name}" could not be created`);
  return layer.setDepth(Layer.tiles);
}

function addFlowingCells(scene: Phaser.Scene, level: Level, terrain: TerrainArt): void {
  level.cells.forEach((row, y) => {
    row.forEach((cell, x) => {
      const flow = terrain.flowing[cell];
      if (!flow) return;
      scene.add
        .sprite(x * TILE, y * TILE, flow.texture)
        .setOrigin(0)
        .setDepth(Layer.water)
        .play(flow.anim);
    });
  });
}

/** Cells the sea's surface can't sit on: air above it and the solid cells. */
const NOT_OPEN_WATER: ReadonlySet<Cell> = new Set<Cell>(['air', 'rock', 'coral']);

/**
 * The tiles the waterline is drawn on: every open water tile (water, kelp or a current) whose tile
 * above is air, in reading order. A level without a surface has none.
 */
export function waterlineTiles(level: Pick<Level, 'cells'>): Vec[] {
  const tiles: Vec[] = [];
  level.cells.forEach((row, y) => {
    row.forEach((cell, x) => {
      if (NOT_OPEN_WATER.has(cell)) return;
      if (level.cells[y - 1]?.[x] === 'air') tiles.push({ x, y });
    });
  });
  return tiles;
}

function addWaterline(scene: Phaser.Scene, level: Level, terrain: TerrainArt): void {
  const crest = terrain.surface;
  if (!crest) return;
  for (const tile of waterlineTiles(level)) {
    scene.add
      .sprite(tile.x * TILE, tile.y * TILE, crest.texture)
      .setOrigin(0)
      .setDepth(Layer.water)
      .play(crest.anim);
  }
}

function addFinishGate(scene: Phaser.Scene, level: Level, terrain: TerrainArt): void {
  level.cells.forEach((row, y) => {
    if (row[level.finishX] !== 'water') return;
    scene.add
      .image(level.finishX * TILE, y * TILE, terrain.finishGate)
      .setOrigin(0)
      .setDepth(Layer.water);
  });
}

function addPlaceholders(scene: Phaser.Scene, level: Level, hazards: Theme['hazards']): LevelPlaceholders {
  const imagesAt = (tiles: Vec[], texture: TexKey, frame?: FrameKey) =>
    tiles.map((tile) => scene.add.image(centre(tile.x), centre(tile.y), texture, frame).setDepth(Layer.objects));
  const hazardsAt = (tiles: Vec[], skin: HazardSkin) =>
    tiles.map((tile) => addHazardSprite(scene, centre(tile.x), centre(tile.y), skin));
  return {
    pearls: imagesAt(level.pearls, Tex.pearl),
    clams: imagesAt(level.clams, Tex.clam, Frame.clamClosed),
    urchins: hazardsAt(level.urchins, hazards.urchin),
    jellies: hazardsAt(level.jellies, hazards.jelly),
  };
}

function centre(tile: number): number {
  return tile * TILE + TILE / 2;
}
