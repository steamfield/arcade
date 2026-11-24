/**
 * A theme is the look of a course's place: its terrain, backdrop, ambient effects, particle physics,
 * dark tint, racer trail and the colours sprites must stand off. Logic names a theme by id
 * (`Course.theme`); the engine maps the id to one of these, never the reverse. The things that live
 * in a world (racers, items, pickups, enemies and hazards) are its world skin's art (`worlds/`), and
 * the HUD and the UI are global art; neither is part of a theme.
 */
import type Phaser from 'phaser';
import type { ThemeId } from '../../logic/courses/types.ts';
import type { Cell } from '../../logic/types.ts';

/** A looping sprite drawn over a cell (the ocean's kelp and currents). */
interface FlowingArt {
  texture: string;
  anim: string;
}

/** How the course's tiles are drawn. */
export interface TerrainArt {
  /** The tileset texture the tilemap cuts 16x16 tiles from. */
  tileset: string;
  /**
   * Tile index in `tileset` for each cell drawn as a tile: the solid cells, and `air` as sky when the
   * theme has open sky. Cells not listed draw no tile.
   */
  tiles: Readonly<Partial<Record<Cell, number>>>;
  /**
   * Tile index for a legend glyph, keyed by the legend entry's `art` name, so a shipwreck hull that
   * is `rock` underneath draws as a hull. A glyph whose art isn't listed draws as its base cell.
   */
  glyphTiles: Readonly<Record<string, number>>;
  /**
   * Tile index for a solid cell with rock or coral directly above it, so a surface detail such as
   * a grass top shows only where the ground meets open space. Cells not listed draw their `tiles`
   * entry everywhere.
   */
  buriedTiles?: Readonly<Partial<Record<Cell, number>>>;
  /** Animated sprites over non-solid cells, such as kelp and currents. */
  flowing: Readonly<Partial<Record<Cell, FlowingArt>>>;
  /** A looping wave crest drawn on every open water tile with air above it; leave out for no waterline. */
  surface?: FlowingArt;
  /** Drawn on every open tile of the finish column. */
  finishGate: string;
  /** Frame `a` of this texture is the chunk a broken breakable tile scatters. */
  debris: string;
}

/** One painted parallax layer that tiles horizontally and stands on the course's floor. */
export interface PaintedLayer {
  texture: string;
  /** Height in px. */
  height: number;
  /** Fraction of camera scroll the layer follows: far layers move less. */
  factor: number;
  /** Drawn in front of the light rays (a near layer) rather than behind them. */
  aboveRays: boolean;
}

/** What is drawn behind the course, back to front. */
export interface BackdropSpec {
  /** Colour bands from the top of the level to the bottom, dithered into each other. */
  bands: readonly number[];
  /** Painted layers, back to front within their side of the rays. */
  layers: readonly PaintedLayer[];
  /** A shimmering net of light just under the top of the level, in this colour; null for none. */
  caustics: number | null;
  /** Slanted shafts of light from the top of the level, in this colour; null for none. */
  rays: number | null;
  /** A cave wall tiled behind the terrain across every dark column range; leave out for none. */
  cave?: { texture: string };
  /**
   * Thin horizontal streaks of haze over the bands, pinned to the level's height like them and
   * drifting slowly sideways; leave out for none. Each band seen through a streak is a colour racers
   * sit in front of, so a theme with haze lists those blends in its contrast bands.
   */
  haze?: HazeSpec;
}

/** The backdrop's haze streaks: their colour and how opaque they are over the bands, 0 to 1. */
export interface HazeSpec {
  colour: number;
  alpha: number;
}

/** Small moving things in front of the backdrop. */
interface AmbientSpec {
  /** Specks drifting across the screen, in this colour; null for none. */
  motes: number | null;
}

/** How one kind of particle moves each tick: velocity times `drag`, then `ay` px/tick² added downward, with an optional sway. */
export interface ParticleMotion {
  drag: number;
  ay: number;
  /** Side-to-side sway in whole px; 0 for none. */
  wobble: number;
}

/**
 * How the course's medium moves particles. `rise` things float up (bubbles in water), `fall` things
 * sink (debris), `drift` things hang where they were let go (ink), `splash` is a burst of droplets.
 * The `Still` forms are for reduced motion: slower, so they inform without large motion.
 */
interface ParticlePhysics {
  rise: ParticleMotion;
  riseStill: ParticleMotion;
  fall: ParticleMotion;
  fallStill: ParticleMotion;
  drift: ParticleMotion;
  splash: ParticleMotion;
}

/** The veil over a dark zone. */
export interface DarkTint {
  colour: number;
  /** Opacity of the full veil, 0 to 1. */
  alpha: number;
}

/** A colour that sits behind racers and text in play, which sprites and off-panel text must stand off. */
export interface ContrastBand {
  name: string;
  colour: number;
}

/** How the particles shed behind a moving racer look: a frame of the fx particle sheet, tinted, at an opacity. */
export interface TrailLook {
  /** A frame name in the fx particle sheet (`FxFrame`). */
  frame: string;
  tint: number;
  /** Opacity at spawn, 0 to 1. */
  alpha: number;
}

/**
 * The fx particle sheet frames (`FxFrame`) a theme's medium sheds where the ocean sheds bubbles: in
 * kick puffs, around breaking debris and in the finish burst. `large` and `small` alternate in a burst.
 */
export interface BubbleFrames {
  large: string;
  small: string;
}

/** A course's whole look, as the views read it. Build one with `defineTheme`. */
export interface Theme {
  id: ThemeId;
  /** Builds and registers the theme's own texture keys, sheets and animations. Boot calls it once per theme. */
  registerTextures(scene: Phaser.Scene): void;
  terrain: TerrainArt;
  backdrop: BackdropSpec;
  ambient: AmbientSpec;
  particles: ParticlePhysics;
  dark: DarkTint;
  /** What racers shed as they move (bubbles in water); null for no trail. */
  trail: TrailLook | null;
  /** The frames kick puffs, debris and the finish burst shed; leave out for the ocean's bubbles. */
  bubbleFrames?: BubbleFrames;
  /** Every colour behind play: racers' main colours hold 3:1 off each, off-panel text 4.5:1 (UI.md). */
  contrastBands: readonly ContrastBand[];
  /**
   * Racers move in the level's top rows (open sky), so the race camera scrolls up past the level's
   * top edge by the HUD row's height and the HUD covers sky rather than them. Leave out when the top
   * rows sit above play (the reef's air, the forest canopy).
   */
  hudOverSky?: boolean;
}

/** What a theme file writes; `defineTheme` fills `terrain.glyphTiles` when left out. */
export type ThemeSpec = Omit<Theme, 'terrain'> & {
  terrain: Omit<TerrainArt, 'glyphTiles'> & Partial<Pick<TerrainArt, 'glyphTiles'>>;
};
