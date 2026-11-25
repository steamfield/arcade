import * as THREE from 'three';
import { afterEach, expect, it, vi } from 'vitest';
import { THORNWOOD_TRAIL } from '../../logic/courses/thornwood-trail.ts';
import { buildTrackFrames } from '../track/track-geometry.ts';
import { createPedestal } from './pedestal.ts';

afterEach(() => vi.unstubAllGlobals());

it('returns to the same opening pose after browsing back to the saved runner', () => {
  vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) });
  const scene = new THREE.Scene();
  const stand = createPedestal(
    scene,
    buildTrackFrames(THORNWOOD_TRAIL),
    THORNWOOD_TRAIL,
    new THREE.MeshBasicMaterial(),
  );
  const pose = () => {
    scene.updateMatrixWorld(true);
    const transforms: number[][] = [];
    scene.traverse((part) => {
      if (part instanceof THREE.Mesh) transforms.push(part.matrixWorld.toArray());
    });
    return transforms;
  };
  stand.sync('grit', 0);
  const initial = pose();
  stand.sync('skip', 42);
  stand.sync('grit', 94);
  stand.sync('grit', 120);
  stand.sync('grit', 0);
  expect(pose()).toEqual(initial);
});
