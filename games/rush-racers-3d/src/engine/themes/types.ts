/** What a theme gives the engine: how a course's sky, light, ground and scenery look. */
import type { ThemeId } from '../../logic/types.ts';

/** Colours are 0xRRGGBB numbers. */
export interface Theme {
  id: ThemeId;
  /** Background and fog colour, and the fog's near and far distances, m. */
  sky: { color: number; fogNear: number; fogFar: number };
  /** The directional sun and the sky/ground hemisphere light. */
  light: {
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
  /** Logs, arches and other built props. */
  props: { cutWood: number; bark: readonly number[]; wood: number; trim: number };
  /** Trees, rocks and shrubs planted beside the trail. */
  scenery: {
    bark: readonly number[];
    needles: readonly number[];
    leaves: readonly number[];
    rock: number;
    shrub: number;
  };
  /** Leaves blown across gusts. */
  gustLeaves: readonly number[];
}
