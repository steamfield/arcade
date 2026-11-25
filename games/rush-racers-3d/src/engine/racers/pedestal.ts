import { TICK_DT } from '@arcade/core';
import * as THREE from 'three';
import type { CharacterId, Course } from '../../logic/types.ts';
import { timberUVs } from '../track/timber.ts';
import type { TrackFrames } from '../track/track-geometry.ts';
import { RacerView } from './racer-view.ts';

/** Creates the select-screen pedestal and owns its rotating racer preview. */
export function createPedestal(scene: THREE.Scene, frames: TrackFrames, course: Course, timber: THREE.Material) {
  const stand = frames.frameAt(course.startS + 33);
  const height = 0.55;
  const top = new THREE.Vector3(stand.x + stand.rx * 3.7, stand.y + height, stand.z + stand.rz * 3.7);
  const geometry = new THREE.CylinderGeometry(1.35, 1.6, height, 96, 1);
  timberUVs(geometry, 'stump');
  const vertices = geometry.getAttribute('position');
  const normals = geometry.getAttribute('normal');
  const colors = new Float32Array(vertices.count * 3).fill(1);
  const normal = new THREE.Vector3();
  for (let i = 0; i < vertices.count; i++) {
    const x = vertices.getX(i);
    const z = vertices.getZ(i);
    const angle = Math.atan2(z, x);
    const flute = 1 + 0.026 * Math.sin(5 * angle) + 0.015 * Math.cos(9 * angle + 1);
    vertices.setXYZ(i, x * flute, vertices.getY(i), z * flute);
    if (Math.abs(normals.getY(i)) > 0.8) continue;
    // Normal of the tapered, fluted side. Both copies of the UV seam get the same normal.
    const slope = (5 * 0.026 * Math.cos(5 * angle) - 9 * 0.015 * Math.sin(9 * angle + 1)) / flute;
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    normal.set(c + s * slope, (0.25 / height) * flute, s - c * slope).normalize();
    normals.setXYZ(i, normal.x, normal.y, normal.z);
    const tone = (vertices.getY(i) > 0 ? 1 : 0.82) + 0.045 * Math.sin(3 * angle - 0.4);
    colors.fill(tone, i * 3, i * 3 + 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const underside = geometry.groups[2];
  if (underside) geometry.setDrawRange(0, underside.start);
  const mesh = new THREE.Mesh(geometry, timber);
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
      if (ticks === 0) started = 0;
      preview.preview(top.x, top.y, top.z, 1.18 + (ticks - started) * TICK_DT * 0.85);
    },
  };
}
