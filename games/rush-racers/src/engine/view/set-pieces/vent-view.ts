/**
 * The course's geyser vents (`level.vents`) on the race screen, a theme extra layer: each vent is a
 * fissure in the floor that glows and flickers through its warning, then an eruption column of
 * bubble streaks rushing up as far as the vent reaches. Everything is read from the vent's phase
 * (`ventPhase`) and how far into it the race tick is, so a capture at tick N looks the same however
 * frames were split. Under reduced motion the column still shows, but its bubbles hold still and
 * the warning glows without flickering. The theme supplies the art.
 */
import type Phaser from 'phaser';
import { VENT, type VentPhase, ventColumn, ventCycleTick, ventPhase } from '../../../logic/setpieces/vents.ts';
import { TILE, type VentDef, type World } from '../../../logic/types.ts';
import { drawFrames, type NamedFrame } from '../../art/pixel.ts';
import type { ThemeLayer } from '../../themes/types.ts';
import { Layer } from '../layers.ts';

/** A theme's vent art: one tile each, drawn into `texture` the first time a race shows vents. */
export interface VentArt {
  texture: string;
  /** The fissure in the floor, in the frame's bottom rows. */
  crack: NamedFrame;
  /** The fissure lit, laid over `crack` while it warns and erupts. */
  glow: NamedFrame;
  /** Bubble streaks tiled up the eruption column; must repeat seamlessly in both directions. */
  bubbles: NamedFrame;
}

/** How one vent looks on one tick; an alpha of 0 hides that part. */
export interface VentLook {
  glowAlpha: number;
  columnAlpha: number;
  /** How far the column's bubbles have risen, px; 0 holds them still. */
  rise: number;
}

/** How fast the bubbles rush up an eruption column, px per race tick. */
const RISE_PX_PER_TICK = 6;
/** The warning flickers dimmer on every other beat of this many ticks. */
const FLICKER_BEAT_TICKS = 4;
const FLICKER_DIM = 0.6;
/** Ticks the column takes to surge to full strength, and to die away at the end of an eruption. */
const SURGE_TICKS = 6;
const FADE_TICKS = 10;
const COLUMN_ALPHA = 0.85;
const QUIET: VentLook = { glowAlpha: 0, columnAlpha: 0, rise: 0 };

/** One vent's sprites. */
interface VentSprites {
  vent: VentDef;
  glow: Phaser.GameObjects.TileSprite;
  column: Phaser.GameObjects.TileSprite;
}

/**
 * Adds the vents of `world`'s level to `scene` in `art`'s look; `sync` redraws them from the world.
 *
 * @throws {Error} When `art`'s pixel text is malformed or its frames differ in size (see `drawFrames`).
 */
export function createVentView(scene: Phaser.Scene, world: World, art: VentArt, reducedMotion: boolean): ThemeLayer {
  if (world.level.vents.length > 0 && !scene.textures.exists(art.texture)) {
    drawFrames(scene, art.texture, [art.crack, art.glow, art.bubbles]);
  }
  const vents = world.level.vents.map((vent) => addVent(scene, vent, art));
  return {
    sync(current) {
      const racing = current.race.phase === 'racing';
      for (const sprites of vents) {
        const look = racing ? lookOn(sprites.vent, current.race.raceTick, reducedMotion) : QUIET;
        showVent(sprites, look);
      }
    },
  };
}

/** The look of `vent` on `raceTick`. */
function lookOn(vent: VentDef, raceTick: number, reducedMotion: boolean): VentLook {
  const phase = ventPhase(vent, raceTick);
  return ventLook(phase, ticksIntoVentPhase(vent, raceTick, phase), reducedMotion);
}

/** The fissure (always shown), its glow and the eruption column for `vent`, hidden until it warns. */
function addVent(scene: Phaser.Scene, vent: VentDef, art: VentArt): VentSprites {
  const column = ventColumn(vent);
  // The fissure frames fill the vent's own tile, their crack in its bottom rows on the floor below.
  const floorPiece = (frame: string, depth: number) =>
    scene.add
      .tileSprite(column.x, vent.row * TILE, column.w, TILE, art.texture, frame)
      .setOrigin(0)
      .setDepth(depth);
  floorPiece(art.crack.name, Layer.tiles + 0.5);
  return {
    vent,
    glow: floorPiece(art.glow.name, Layer.tiles + 0.6).setVisible(false),
    column: scene.add
      .tileSprite(column.x, column.y, column.w, column.h, art.texture, art.bubbles.name)
      .setOrigin(0)
      .setDepth(Layer.water + 0.5)
      .setVisible(false),
  };
}

/** Draws one vent as `look` says. */
function showVent({ glow, column }: VentSprites, look: VentLook): void {
  glow.setVisible(look.glowAlpha > 0).setAlpha(look.glowAlpha);
  column.setVisible(look.columnAlpha > 0).setAlpha(look.columnAlpha);
  column.tilePositionY = look.rise;
}

/**
 * How a vent looks `ticksInPhase` race ticks into `phase`. Quiet shows only the fissure. A warning
 * lights it, brighter as the eruption nears, flickering on a beat unless `reducedMotion`. An
 * eruption keeps it lit and shows the column, which surges in, holds and dies away at the end; its
 * bubbles rise with the ticks unless `reducedMotion`, which holds them still.
 */
export function ventLook(phase: VentPhase, ticksInPhase: number, reducedMotion: boolean): VentLook {
  if (phase === 'quiet') return QUIET;
  if (phase === 'warning') {
    const build = 0.3 + 0.7 * Math.min(1, ticksInPhase / VENT.warnTicks);
    const dimBeat = !reducedMotion && Math.floor(ticksInPhase / FLICKER_BEAT_TICKS) % 2 === 1;
    return { glowAlpha: dimBeat ? build * FLICKER_DIM : build, columnAlpha: 0, rise: 0 };
  }
  const surge = Math.min(1, (ticksInPhase + 1) / SURGE_TICKS);
  const fade = Math.min(1, (VENT.eruptTicks - ticksInPhase) / FADE_TICKS);
  return {
    glowAlpha: 1,
    columnAlpha: COLUMN_ALPHA * Math.min(surge, fade),
    rise: reducedMotion ? 0 : ticksInPhase * RISE_PX_PER_TICK,
  };
}

/**
 * How many race ticks `vent` has been in `phase` on `raceTick`, from its cycle (the race starts
 * `offsetTicks` into the first one), so a view built mid-eruption picks up where the race is. 0 while quiet.
 */
export function ticksIntoVentPhase(vent: VentDef, raceTick: number, phase: VentPhase): number {
  if (phase === 'quiet') return 0;
  const cycleTick = ventCycleTick(vent, raceTick);
  return phase === 'warning' ? cycleTick : cycleTick - VENT.warnTicks;
}
