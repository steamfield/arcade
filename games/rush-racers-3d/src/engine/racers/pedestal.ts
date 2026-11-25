import { TICK_DT } from '@arcade/core';
import * as THREE from 'three';
import type { CharacterId, Course } from '../../logic/types.ts';
import type { Theme } from '../themes/types.ts';
import type { TrackFrames } from '../track/track-geometry.ts';
import { RacerView } from './racer-view.ts';

/** Creates the select-screen pedestal and owns its rotating racer preview. */
export function createPedestal(scene: THREE.Scene, frames: TrackFrames, course: Course, theme: Theme) {
  const stand = frames.frameAt(course.startS + 31);
  const height = 0.55;
  const top = new THREE.Vector3(stand.x, stand.y + height, stand.z);
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(1.35, 1.55, height, 16),
    new THREE.MeshLambertMaterial({ color: theme.props.pedestal }),
  );
  mesh.position.copy(top);
  mesh.position.y -= height / 2 + 0.01;
  mesh.visible = false;
  mesh.receiveShadow = true;
  scene.add(mesh);

  let preview: RacerView | undefined;
  let started = 0;
  return {
    top,
    sync(character: CharacterId | null, ticks: number): void {
      mesh.visible = character !== null;
      if (character === null) {
        preview?.dispose();
        preview = undefined;
        return;
      }
      if (preview?.character !== character) {
        preview?.dispose();
        preview = new RacerView(character);
        scene.add(preview.root);
        started = ticks;
      }
      preview.preview(top.x, top.y, top.z, 0.45 + (ticks - started) * TICK_DT * 0.85);
    },
  };
}
