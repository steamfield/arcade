import { TICK_DT } from '@arcade/core';
import * as THREE from 'three';
import type { CharacterId, Course } from '../../logic/types.ts';
import type { Theme } from '../themes/types.ts';
import type { TrackFrames } from '../track/track-geometry.ts';
import { RacerView } from './racer-view.ts';

/** Growth rings for the stump's cut face: light and dark bands, slightly wobbly, darker at the rim. */
function ringTexture(): THREE.DataTexture {
  const size = 128;
  const pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x + 0.5) / size - 0.5;
      const dy = (y + 0.5) / size - 0.5;
      const r = Math.hypot(dx, dy) * 2;
      const wobble = 0.015 * Math.sin(Math.atan2(dy, dx) * 5);
      const ring = 0.5 + 0.5 * Math.cos((r + wobble) * 58);
      const shade = Math.round(255 * (0.62 + 0.22 * ring) * (r > 0.92 ? 0.55 : 1));
      const i = (y * size + x) * 4;
      pixels.set([shade, shade, shade, 255], i);
    }
  }
  const texture = new THREE.DataTexture(pixels, size, size);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

/** Creates the select-screen pedestal and owns its rotating racer preview. */
export function createPedestal(scene: THREE.Scene, frames: TrackFrames, course: Course, theme: Theme) {
  const stand = frames.frameAt(course.startS + 31);
  const height = 0.55;
  const top = new THREE.Vector3(stand.x, stand.y + height, stand.z);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.6, height, 40, 1), [
    new THREE.MeshStandardMaterial({ color: theme.props.pedestal, roughness: 0.95 }),
    new THREE.MeshStandardMaterial({ color: theme.props.cutWood, map: ringTexture(), roughness: 0.8 }),
    new THREE.MeshStandardMaterial({ color: theme.props.pedestal, roughness: 0.95 }),
  ]);
  mesh.position.copy(top);
  mesh.position.y -= height / 2 + 0.01;
  mesh.visible = false;
  mesh.receiveShadow = true;
  mesh.castShadow = true;
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
