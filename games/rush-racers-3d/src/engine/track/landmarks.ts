import { createLogger } from '@arcade/core';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { groundY, type LogFeature } from '../../logic/course.ts';
import { RUN } from '../../logic/tuning.ts';
import type { Course } from '../../logic/types.ts';
import type { TrackFrames } from './track-geometry.ts';

type ArchTitle = 'START' | 'FINISH';

const log = createLogger('rush-racers-3d');
const CUT_WOOD = new THREE.Color(0xf1ba6e);
const BARK = [new THREE.Color(0x995c32), new THREE.Color(0x865034), new THREE.Color(0xb97541)];
const WOOD = new THREE.Color(0x72432c);
const TRIM = new THREE.Color(0x9c6b41);

function paint(geometry: THREE.BufferGeometry, getColor: (i: number) => THREE.Color): THREE.BufferGeometry {
  const colors = new Float32Array(geometry.getAttribute('position').count * 3);
  for (let i = 0; i < colors.length / 3; i++) getColor(i).toArray(colors, i * 3);
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}

function logGeometry(feature: LogFeature, course: Course, track: TrackFrames): THREE.BufferGeometry {
  const s = feature.s + RUN.logDepth / 2;
  const f = track.frameAt(s);
  const y = groundY(course, feature.s) + feature.height / 2;
  const point = track.toWorld(s, (feature.d0 + feature.d1) / 2, y);
  const geometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 16, 1);
  const normals = geometry.getAttribute('normal');
  return paint(geometry, (i) => {
    if (Math.abs(normals.getY(i)) > 0.5) return CUT_WOOD;
    return BARK[Math.floor((normals.getZ(i) + 1) * 3 + normals.getX(i) * 2 + 4) % BARK.length] ?? CUT_WOOD;
  })
    .rotateZ(-Math.PI / 2)
    .scale(feature.d1 - feature.d0, feature.height, RUN.logDepth)
    .rotateY(-Math.atan2(f.tx, -f.tz))
    .translate(point.x, point.y, point.z);
}

function signTexture(title: ArchTitle): THREE.CanvasTexture | undefined {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 112;
  const context = canvas.getContext('2d');
  if (!context) {
    log.warn(`2D canvas context unavailable; drawing the ${title} arch without its sign`);
    return undefined;
  }
  context.fillStyle = title === 'START' ? '#343b27' : '#504129';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = '#c9a571';
  context.lineWidth = 4;
  context.strokeRect(7, 7, 626, 98);
  context.fillStyle = '#fff1ca';
  context.font = '900 72px system-ui';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(title, 320, 57);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  return map;
}

function archAt(s: number, title: ArchTitle, halfWidth: number, track: TrackFrames) {
  const f = track.frameAt(s);
  const yaw = -Math.atan2(f.tx, -f.tz);
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
    box(0.61, 6, 0.65, post, 2.875, WOOD);
    box(0.82, 0.58, 0.81, post, 0.28, TRIM);
    box(0.77, 0.23, 0.77, post, 5.9, TRIM);
  }
  box(halfWidth * 2 + 1.6, 0.63, 0.74, 0, 5.51, WOOD);
  box(halfWidth * 2 + 1.84, 0.13, 0.88, 0, 5.86, TRIM);

  const map = signTexture(title);
  if (!map) return { pieces };
  const signHeight = 5.18;
  box(6.36, 1.08, 0.38, 0, signHeight, TRIM);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(6.18, 0.97), new THREE.MeshBasicMaterial({ map }));
  sign.rotation.y = yaw;
  sign.position.set(f.x - f.tx * 0.39, f.y + signHeight, f.z - f.tz * 0.39);
  return { pieces, sign };
}

/** Adds the merged log and arch geometry, plus the signs when a 2D canvas is available. */
export function trackLandmarks(root: THREE.Group, course: Course, track: TrackFrames): void {
  const pieces = course.features
    .filter((feature) => feature.kind === 'log')
    .map((feature) => logGeometry(feature, course, track));
  for (const [s, title] of [
    [course.startS, 'START'],
    [course.finishS, 'FINISH'],
  ] as const) {
    const arch = archAt(s, title, course.halfWidth, track);
    pieces.push(...arch.pieces);
    if (arch.sign) root.add(arch.sign);
  }
  root.add(new THREE.Mesh(mergeGeometries(pieces), new THREE.MeshLambertMaterial({ vertexColors: true })));
  for (const piece of pieces) piece.dispose();
}
