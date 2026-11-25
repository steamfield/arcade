/** A course's sky, lighting and palettes. Colours are 0xRRGGBB numbers. */
export interface Theme {
  /** Horizon and fog colour, the sky dome's colour overhead, and the fog's near and far distances, m. */
  sky: { color: number; zenith: number; fogNear: number; fogFar: number };
  /** Tone mapping exposure, environment strength, the directional sun (which casts the shadows) and the sky/ground hemisphere light. */
  light: {
    exposure: number;
    /** Strength of the sky-gradient environment light on standard materials. */
    environment: number;
    sun: { color: number; intensity: number; position: readonly [number, number, number] };
    hemisphere: { sky: number; ground: number; intensity: number };
  };
  /** Trail and terrain surfaces. */
  ground: {
    dirt: number;
    shoulder: number;
    grass: number;
    mud: number;
    pitRim: number;
    pitWall: number;
    pitFloor: number;
    chalk: number;
    darkMark: number;
  };
  /** Logs, arches, signs and the character select pedestal. */
  props: {
    cutWood: number;
    bark: readonly number[];
    wood: number;
    trim: number;
    pedestal: number;
    sign: { start: number; finish: number; border: number; text: number };
  };
  /**
   * Tints multiplied over the nature kit's textures, picked per plant from these lists: conifers,
   * broadleaf trees, bushes and ferns, grass, and rocks and pebbles.
   */
  scenery: {
    conifer: readonly number[];
    broadleaf: readonly number[];
    undergrowth: readonly number[];
    grass: readonly number[];
    rock: readonly number[];
  };
  /** Leaves blown across gusts. */
  gustLeaves: readonly number[];
}
