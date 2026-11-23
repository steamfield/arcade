/**
 * Draws the course: rock and coral through a Phaser Tilemap built from the
 * parsed level, kelp and currents as animated sprites, the finish gate, and
 * inert placeholders for pearls, clams, urchins and jellies. Phase 3's pickup
 * and hazard views take over those placeholders. Broken coral is removed when
 * its `coral.broken` event arrives.
 */
import type { Stamped } from '@arcade/core';
import type Phaser from 'phaser';
import { type Cell, type Level, TILE, type Vec } from '../../logic/types.ts';
import { Anim, type AnimKey, Frame, type FrameKey, Tex, type TexKey, TileIndex } from '../art/keys.ts';
import type { RuntimeEvent } from '../runtime.ts';
import { Layer } from './layers.ts';

/** Course objects drawn as stand-ins until phase 3 gives them behaviour. Phase 3 may destroy and replace them. */
export interface LevelPlaceholders {
  pearls: Phaser.GameObjects.Image[];
  clams: Phaser.GameObjects.Image[];
  urchins: Phaser.GameObjects.Image[];
  jellies: Phaser.GameObjects.Sprite[];
}

/** The drawn course: its placeholders and a hook for course-changing events. */
export interface LevelView {
  placeholders: LevelPlaceholders;
  /** Applies a tick's drained events to the course (today only `coral.broken`). */
  onEvents(events: readonly Stamped<RuntimeEvent>[]): void;
}

const TILESET_NAME = 'reef';
const EMPTY_TILE = -1;

const TILE_FOR_CELL: Partial<Record<Cell, number>> = { rock: TileIndex.rock, coral: TileIndex.coral };

const FLOWING: Partial<Record<Cell, { texture: TexKey; anim: AnimKey }>> = {
  kelp: { texture: Tex.kelp, anim: Anim.kelpSway },
  'current-right': { texture: Tex.currentRight, anim: Anim.currentRight },
  'current-left': { texture: Tex.currentLeft, anim: Anim.currentLeft },
  'current-up': { texture: Tex.currentUp, anim: Anim.currentUp },
  'current-down': { texture: Tex.currentDown, anim: Anim.currentDown },
};

/**
 * Builds every course object for `level` in `scene`.
 *
 * @throws {Error} When Phaser rejects the generated tileset or layer, which means `buildTextures` has not run.
 */
export function createLevelView(scene: Phaser.Scene, level: Level): LevelView {
  const layer = createTileLayer(scene, level);
  addFlowingWater(scene, level);
  addFinishGate(scene, level);
  const placeholders = addPlaceholders(scene, level);
  return {
    placeholders,
    onEvents(events) {
      for (const event of events) {
        if (event.type === 'coral.broken') layer.removeTileAt(event.tx, event.ty);
      }
    },
  };
}

function createTileLayer(scene: Phaser.Scene, level: Level): Phaser.Tilemaps.TilemapLayerBase {
  const data = level.cells.map((row) => row.map((cell) => TILE_FOR_CELL[cell] ?? EMPTY_TILE));
  const map = scene.make.tilemap({ data, tileWidth: TILE, tileHeight: TILE });
  const tileset = map.addTilesetImage(TILESET_NAME, Tex.tiles, TILE, TILE, 0, 0);
  if (!tileset)
    throw new Error(`Tileset "${TILESET_NAME}" could not use texture "${Tex.tiles}"; run buildTextures first`);
  const layer = map.createLayer(0, tileset, 0, 0);
  if (!layer) throw new Error(`Tilemap layer for "${level.name}" could not be created`);
  return layer.setDepth(Layer.tiles);
}

function addFlowingWater(scene: Phaser.Scene, level: Level): void {
  level.cells.forEach((row, y) => {
    row.forEach((cell, x) => {
      const flow = FLOWING[cell];
      if (!flow) return;
      scene.add
        .sprite(x * TILE, y * TILE, flow.texture)
        .setOrigin(0)
        .setDepth(Layer.water)
        .play(flow.anim);
    });
  });
}

function addFinishGate(scene: Phaser.Scene, level: Level): void {
  level.cells.forEach((row, y) => {
    if (row[level.finishX] !== 'water') return;
    scene.add
      .image(level.finishX * TILE, y * TILE, Tex.finishGate)
      .setOrigin(0)
      .setDepth(Layer.water);
  });
}

function addPlaceholders(scene: Phaser.Scene, level: Level): LevelPlaceholders {
  const imagesAt = (tiles: Vec[], texture: TexKey, frame?: FrameKey) =>
    tiles.map((tile) => scene.add.image(centre(tile.x), centre(tile.y), texture, frame).setDepth(Layer.objects));
  return {
    pearls: imagesAt(level.pearls, Tex.pearl),
    clams: imagesAt(level.clams, Tex.clam, Frame.clamClosed),
    urchins: imagesAt(level.urchins, Tex.urchin),
    jellies: level.jellies.map((tile) =>
      scene.add.sprite(centre(tile.x), centre(tile.y), Tex.jelly).setDepth(Layer.objects).play(Anim.jellyPulse),
    ),
  };
}

function centre(tile: number): number {
  return tile * TILE + TILE / 2;
}
