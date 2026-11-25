import * as THREE from 'three';
import type { Course } from '../../logic/types.ts';
import type { Theme } from '../themes/types.ts';
import { plantForest } from './forest.ts';
import { windLeaves } from './gust-leaves.ts';
import { trackLandmarks } from './landmarks.ts';
import type { NatureKit } from './nature-kit.ts';
import type { TrackFrames } from './track-geometry.ts';
import { buildTerrainGrid, trackTerrain } from './track-terrain.ts';

/** Builds the trail scene and provides the tick update for its wind gusts. */
export function createTrackView(
  course: Course,
  track: TrackFrames,
  seed: number,
  theme: Theme,
  kit: NatureKit,
  light: boolean,
) {
  const root = new THREE.Group();
  const grid = buildTerrainGrid(course, track);
  trackTerrain(root, course, grid, theme.ground);
  plantForest(root, grid, track.length, seed, theme.scenery, kit, light);
  trackLandmarks(root, course, track, theme.props);
  return { root, tick: windLeaves(root, course, track, seed, theme.gustLeaves) };
}
