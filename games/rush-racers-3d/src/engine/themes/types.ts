/** A course's sky, lighting and palettes. Colours are 0xRRGGBB numbers. */
export interface Theme {
  /** Horizon and fog colour, the sky dome's colour overhead, and the fog's near and far distances, m. */
  sky: { color: number; zenith: number; fogNear: number; fogFar: number };
  /** Tone mapping exposure, the directional sun (which casts the shadows) and the sky/ground hemisphere light. */
  light: {
    exposure: number;
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
  /** Trees, rocks, shrubs and grass tufts planted beside the trail. */
  scenery: {
    bark: readonly number[];
    needles: readonly number[];
    leaves: readonly number[];
    rock: number;
    shrub: number;
    grass: readonly number[];
  };
  /** Leaves blown across gusts. */
  gustLeaves: readonly number[];
}
