/**
 * The course's storm zones (`level.lightning`) on the race screen: a darkening cloud band and a
 * column shimmer during a zone's warning and a bolt during its strike, read from each zone's phase
 * (`lightningPhase`) and how far into it the race tick is, plus a screen flash on `lightning.struck`
 * for a zone on screen that reduced motion skips. A zone just off screen shows its shimmer at that screen edge, so a warning reads before the
 * zone scrolls into view. Code-drawn global art until a sky theme restyles it.
 */
import type { Stamped } from '@arcade/core';
import type Phaser from 'phaser';
import { type LightningPhase, lightningPhase } from '../../logic/hazards/lightning.ts';
import { LIGHTNING } from '../../logic/hazards/tuning.ts';
import { type LightningZone, TILE, type World } from '../../logic/types.ts';
import { drawFrames, type NamedFrame } from '../art/pixel.ts';
import type { RuntimeEvent } from '../runtime.ts';
import { Layer } from './layers.ts';
import { type CameraSpan, cameraSpan, zoneSide } from './storm-reach.ts';

/** The storm zones; `sync` redraws them from the world, `onEvents` hears warnings and strikes drained on world tick `tick`. */
export interface LightningView {
  sync(world: World, tick: number): void;
  onEvents(events: readonly Stamped<RuntimeEvent>[], tick: number): void;
}

/** How one zone looks on one frame; an alpha of 0 hides that part. */
export interface StormLook {
  shadeAlpha: number;
  shimmerAlpha: number;
  cloudAlpha: number;
  boltVisible: boolean;
  /** The bolt is mirrored on alternate beats of a strike, so it crackles. */
  boltFlipped: boolean;
}

/** Texture key for the storm sheet, drawn once per game. */
export const STORM_TEXTURE = 'sky-storm';
const StormFrame = { cloud: 'cloud', shimmer: 'shimmer', bolt: 'bolt' } as const;

/** The storm art is 8 px tiles drawn at twice size. */
const ART_SCALE = 2;
const ART_TILE = 8 * ART_SCALE;
/** The width of the strip at a screen edge that shows a zone just off screen, px. */
const EDGE_STRIP_PX = 8;
/** The edge strip is darker and brighter than the zone itself, by these factors, so it reads at a glance. */
const EDGE_SHADE_BOOST = 2.5;
const EDGE_SHIMMER_BOOST = 1.4;
const SHADE_COLOUR = 0x101828;
/** The bolt's beat during a strike: it mirrors every this many ticks. */
const BOLT_BEAT_TICKS = 3;
/** How far the shimmer drifts down per race tick, px. */
const SHIMMER_DRIFT_PX = 0.5;
const FLASH_TICKS = 6;
const FLASH_ALPHA = 0.35;

const FRAMES: readonly NamedFrame[] = [
  {
    name: StormFrame.cloud,
    palette: [0x22243a, 0x3c3f58, 0x575b76],
    rows: ['22111221', '11111111', '11111111', '01111110', '00111100', '.000000.', '..0..0..', '........'],
  },
  {
    name: StormFrame.shimmer,
    palette: [0x8ab0ff, 0xd8e8ff],
    rows: ['1.......', '0.......', '........', '....1...', '....0...', '........', '........', '........'],
  },
  {
    name: StormFrame.bolt,
    palette: [0x9fc8ff, 0xffffff],
    rows: ['..010...', '...010..', '....010.', '...010..', '..010...', '.010....', '..010...', '..010...'],
  },
];

/** One zone's sprites. */
interface ZoneSprites {
  zone: LightningZone;
  shade: Phaser.GameObjects.Rectangle;
  shimmer: Phaser.GameObjects.TileSprite;
  cloud: Phaser.GameObjects.TileSprite;
  bolt: Phaser.GameObjects.TileSprite;
  edgeShade: Phaser.GameObjects.Rectangle;
  edgeShimmer: Phaser.GameObjects.TileSprite;
}

/**
 * Adds the storm zones of `world`'s level to `scene`; under `reducedMotion` strikes flash nothing
 * and the shimmer and bolt hold still.
 *
 * @throws {Error} When the storm pixel text is malformed (see `drawFrames`).
 */
export function createLightningView(scene: Phaser.Scene, world: World, reducedMotion: boolean): LightningView {
  if (!scene.textures.exists(STORM_TEXTURE)) drawFrames(scene, STORM_TEXTURE, FRAMES);
  const camera = scene.cameras.main;
  const zones = world.level.lightning.map((zone) => addZone(scene, zone, world.level.height * TILE));
  const flash = scene.add
    .rectangle(0, 0, camera.width, camera.height, 0xffffff)
    .setOrigin(0)
    .setScrollFactor(0)
    .setDepth(Layer.hud - 0.5)
    .setVisible(false);
  let flashedOn = Number.NEGATIVE_INFINITY;

  return {
    sync(current, tick) {
      const racing = current.race.phase === 'racing';
      const raceTick = current.race.raceTick;
      const view = cameraSpan(camera);
      for (const sprites of zones) {
        const phase = racing ? lightningPhase(sprites.zone, raceTick) : 'calm';
        const look = stormLook(phase, ticksIntoPhase(sprites.zone, raceTick, phase), reducedMotion);
        showZone(sprites, look, view, reducedMotion ? 0 : raceTick);
      }
      const sinceFlash = tick - flashedOn;
      flash.setVisible(sinceFlash < FLASH_TICKS).setAlpha(FLASH_ALPHA * (1 - sinceFlash / FLASH_TICKS));
    },
    onEvents(events, tick) {
      if (reducedMotion) return;
      for (const event of events) {
        if (event.type !== 'lightning.struck') continue;
        const zone = world.level.lightning[event.zone];
        if (zone && zoneSide(zone, cameraSpan(camera)) === 'on screen') flashedOn = tick;
      }
    },
  };
}

/** The sprites for `zone`, hidden until its first warning; the columns run the level's full `heightPx`. */
function addZone(scene: Phaser.Scene, zone: LightningZone, heightPx: number): ZoneSprites {
  const left = zone.cols[0] * TILE;
  const width = (zone.cols[1] - zone.cols[0] + 1) * TILE;
  const screenHeight = scene.cameras.main.height;
  const tiled = (x: number, w: number, h: number, frame: string, depth: number) =>
    scene.add
      .tileSprite(x, 0, w, h, STORM_TEXTURE, frame)
      .setOrigin(0)
      .setTileScale(ART_SCALE)
      .setDepth(depth)
      .setVisible(false);
  return {
    zone,
    shade: scene.add
      .rectangle(left, 0, width, heightPx, SHADE_COLOUR)
      .setOrigin(0)
      .setDepth(Layer.water + 0.5)
      .setVisible(false),
    shimmer: tiled(left, width, heightPx, StormFrame.shimmer, Layer.water + 0.6),
    cloud: tiled(left, width, ART_TILE, StormFrame.cloud, Layer.player + 0.4),
    bolt: tiled(left + width / 2 - ART_TILE / 2, ART_TILE, heightPx, StormFrame.bolt, Layer.player + 0.5),
    edgeShade: scene.add
      .rectangle(0, 0, EDGE_STRIP_PX, screenHeight, SHADE_COLOUR)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(Layer.player + 0.6)
      .setVisible(false),
    // At art size, so both of the shimmer tile's streaks fit in the narrow strip.
    edgeShimmer: tiled(0, EDGE_STRIP_PX, screenHeight, StormFrame.shimmer, Layer.player + 0.7)
      .setTileScale(1)
      .setScrollFactor(0),
  };
}

/**
 * Draws one zone as `look` says against the camera's `view`: the cloud band hangs from the view's
 * top, and the edge strip shows at the side of the screen the zone is just past. `driftTick` moves
 * the shimmer down; pass 0 to hold it still.
 */
function showZone(sprites: ZoneSprites, look: StormLook, view: CameraSpan, driftTick: number): void {
  const { shade, shimmer, cloud, bolt } = sprites;
  shade.setVisible(look.shadeAlpha > 0).setAlpha(look.shadeAlpha);
  shimmer.setVisible(look.shimmerAlpha > 0).setAlpha(look.shimmerAlpha);
  shimmer.tilePositionY = -driftTick * SHIMMER_DRIFT_PX;
  cloud
    .setVisible(look.cloudAlpha > 0)
    .setAlpha(look.cloudAlpha)
    .setY(view.y);
  bolt.setVisible(look.boltVisible).setFlipX(look.boltFlipped);
  showEdge(sprites, look, view, shimmer.tilePositionY);
}

/** Shows `sprites`' edge strip at the side of `view` its zone is just past, or hides it when the zone is on screen or far. */
function showEdge(sprites: ZoneSprites, look: StormLook, view: CameraSpan, driftY: number): void {
  const side = zoneSide(sprites.zone, view);
  const shown = (side === 'left' || side === 'right') && look.shimmerAlpha > 0;
  const x = side === 'right' ? view.width - EDGE_STRIP_PX : 0;
  sprites.edgeShade
    .setVisible(shown)
    .setX(x)
    .setAlpha(Math.min(1, look.shadeAlpha * EDGE_SHADE_BOOST));
  sprites.edgeShimmer
    .setVisible(shown)
    .setX(x)
    .setAlpha(Math.min(1, look.shimmerAlpha * EDGE_SHIMMER_BOOST));
  sprites.edgeShimmer.tilePositionY = driftY;
}

/**
 * How a zone looks `ticksInPhase` race ticks into `phase`. Calm shows nothing. A warning darkens
 * the zone, its shimmer and cloud band growing stronger over `LIGHTNING.warnTicks`. A strike keeps
 * them at full strength and adds the bolt, which mirrors on a beat unless `reducedMotion`.
 */
export function stormLook(phase: LightningPhase, ticksInPhase: number, reducedMotion: boolean): StormLook {
  if (phase === 'calm') {
    return { shadeAlpha: 0, shimmerAlpha: 0, cloudAlpha: 0, boltVisible: false, boltFlipped: false };
  }
  const striking = phase === 'strike';
  const build = striking ? 1 : Math.min(1, Math.max(0, ticksInPhase / LIGHTNING.warnTicks));
  return {
    shadeAlpha: 0.12 + 0.18 * build,
    shimmerAlpha: 0.3 + 0.4 * build,
    cloudAlpha: 0.5 + 0.4 * build,
    boltVisible: striking,
    boltFlipped: striking && !reducedMotion && Math.floor(ticksInPhase / BOLT_BEAT_TICKS) % 2 === 1,
  };
}

/**
 * How many race ticks `zone` has been in `phase` on `raceTick`, worked out from its cycle (the race
 * starts `offsetTicks` into the first one, as `lightningPhase` has it), so a view built mid-warning
 * picks up the ramp where the race is. 0 while calm.
 */
export function ticksIntoPhase(zone: LightningZone, raceTick: number, phase: LightningPhase): number {
  if (phase === 'calm') return 0;
  const shifted = (raceTick + zone.offsetTicks) % zone.periodTicks;
  const cycleTick = shifted < 0 ? shifted + zone.periodTicks : shifted;
  const phaseTicks = phase === 'strike' ? LIGHTNING.strikeTicks : LIGHTNING.warnTicks + LIGHTNING.strikeTicks;
  return cycleTick - (zone.periodTicks - phaseTicks);
}
