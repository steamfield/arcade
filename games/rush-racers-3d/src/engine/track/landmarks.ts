import { createLogger } from '@arcade/core';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { groundY, type LogFeature } from '../../logic/course.ts';
import { RUN } from '../../logic/tuning.ts';
import type { Course } from '../../logic/types.ts';
import type { Theme } from '../themes/types.ts';
import { timberUVs } from './timber.ts';
import type { TrackFrames } from './track-geometry.ts';

type ArchTitle = 'START' | 'FINISH';

const log = createLogger('rush-racers-3d');

function paint(geometry: THREE.BufferGeometry, getColor: (i: number) => THREE.Color): THREE.BufferGeometry {
  const colors = new Float32Array(geometry.getAttribute('position').count * 3);
  for (let i = 0; i < colors.length / 3; i++) getColor(i).toArray(colors, i * 3);
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}

function logGeometry(feature: LogFeature, course: Course, track: TrackFrames): THREE.BufferGeometry {
  const s = feature.s + RUN.logDepth / 2;
  const f = track.frameAt(s);
  const y = groundY(course, feature.s) + feature.height * 0.48;
  const point = track.toWorld(s, (feature.d0 + feature.d1) / 2, y);
  const geometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 16, 4);
  timberUVs(geometry);
  const position = geometry.getAttribute('position');
  const color = new THREE.Color();
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const h = position.getY(i);
    const z = position.getZ(i);
    const radius = 0.97 - h * 0.07 + 0.042 * Math.sin(h * 13 + s + x * 4 + z);
    position.setXYZ(i, x * radius + 0.024 * Math.sin(h * 7 + s), h, z * radius);
  }
  geometry.computeVertexNormals();
  const width = feature.d1 - feature.d0;
  const trunk = paint(geometry, (i) => color.setScalar(0.89 - 0.27 * position.getX(i)))
    .rotateZ(-Math.PI / 2)
    .scale(width, feature.height, RUN.logDepth);
  // A snapped-off limb shows the pale heartwood to runners approaching a full-width log.
  const limb = new THREE.CylinderGeometry(feature.height * 0.16, feature.height * 0.24, 0.43, 11);
  timberUVs(limb, 0.15);
  paint(limb, () => color.setScalar(0.94));
  limb
    .rotateX(1.04)
    .rotateZ(-0.37)
    .translate(width * 0.31, feature.height * 0.17, RUN.logDepth * 0.39);
  const logGeometry = mergeGeometries([trunk, limb]);
  trunk.dispose();
  limb.dispose();
  return logGeometry.rotateY(-Math.atan2(f.tx, -f.tz)).translate(point.x, point.y, point.z);
}

function signTexture(title: ArchTitle, palette: Theme['props']['sign']): THREE.CanvasTexture | undefined {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 112;
  const context = canvas.getContext('2d');
  if (!context) {
    log.warn(`2D canvas context unavailable; drawing the ${title} arch without its sign`);
    return undefined;
  }
  context.fillStyle = `#${new THREE.Color(title === 'START' ? palette.start : palette.finish).getHexString()}`;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = `#${new THREE.Color(palette.border).getHexString()}`;
  context.lineWidth = 4;
  context.strokeRect(7, 7, 626, 98);
  for (const x of [31, 545]) {
    for (let i = 0; i < 6; i++) {
      context.fillStyle = i % 2 ? '#e3bc78' : '#486957';
      context.fillRect(x + (i % 3) * 18, 40 + Math.floor(i / 3) * 18, 16, 16);
    }
  }
  context.fillStyle = `#${new THREE.Color(palette.text).getHexString()}`;
  context.font = 'italic 900 70px Georgia, serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(title, 320, 57);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  return map;
}

function archAt(s: number, title: ArchTitle, halfWidth: number, track: TrackFrames, palette: Theme['props']) {
  const f = track.frameAt(s);
  const yaw = -Math.atan2(f.tx, -f.tz);
  const wood = new THREE.Color(palette.wood);
  const trim = new THREE.Color(palette.trim);
  const pieces: THREE.BufferGeometry[] = [];
  const box = (width: number, height: number, depth: number, d: number, y: number, color: THREE.Color) => {
    const p = track.toWorld(s, d, f.y + y);
    pieces.push(
      paint(new THREE.BoxGeometry(width, height, depth), () => color)
        .rotateY(yaw)
        .translate(p.x, p.y, p.z),
    );
  };
  for (const side of [-1, 1]) {
    const post = side * (halfWidth + 0.45);
    box(0.46, 6.51, 0.5, post, 3.2, wood);
    box(0.82, 0.58, 0.81, post, 0.28, trim);
    box(0.65, 0.23, 0.64, post, 6.43, trim);
  }
  box(halfWidth * 2 + 1.6, 0.24, 0.37, 0, 6.24, wood);
  box(halfWidth * 2 + 1.84, 0.1, 0.44, 0, 6.41, trim);

  const map = signTexture(title, palette.sign);
  if (!map) return { pieces };
  const signHeight = 5.91;
  box(6.36, 1.08, 0.14, 0, signHeight, trim);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(6.18, 0.97), new THREE.MeshBasicMaterial({ map }));
  sign.rotation.y = yaw;
  sign.position.set(f.x - f.tx * 0.235, f.y + signHeight, f.z - f.tz * 0.235);
  return { pieces, sign };
}

/** Adds the merged log and arch geometry, plus the signs when a 2D canvas is available. */
export function trackLandmarks(
  root: THREE.Group,
  course: Course,
  track: TrackFrames,
  palette: Theme['props'],
  timber: THREE.Material,
): void {
  const pieces = course.features
    .filter((feature) => feature.kind === 'log')
    .map((feature) => logGeometry(feature, course, track));
  for (const [s, title] of [
    [course.startS, 'START'],
    [course.finishS, 'FINISH'],
  ] as const) {
    const arch = archAt(s, title, course.halfWidth, track, palette);
    for (const piece of arch.pieces) {
      const uv = piece.getAttribute('uv');
      for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.29, 0.14);
      pieces.push(piece);
    }
    if (arch.sign) root.add(arch.sign);
  }
  const props = new THREE.Mesh(mergeGeometries(pieces), timber);
  props.castShadow = true;
  props.receiveShadow = true;
  root.add(props);
  for (const piece of pieces) piece.dispose();
}
