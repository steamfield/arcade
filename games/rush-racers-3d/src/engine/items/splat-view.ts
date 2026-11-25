import * as THREE from 'three';
import { pitAt } from '../../logic/course.ts';
import { ITEMS } from '../../logic/tuning.ts';
import type { Course, Splat } from '../../logic/types.ts';
import type { TrackFrame, TrackFrames } from '../track/track-geometry.ts';

const NO_SPLATS: readonly Splat[] = [];
const GROUND_LIFT = 0.05;
const FADE_TICKS = 60;

function mudTexture(): THREE.DataTexture {
  const size = 64;
  const pixels = new Uint8Array(size * size * 4);
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const x = ((i + 0.5) * 2) / size - 1;
      const y = ((j + 0.5) * 2) / size - 1;
      const angle = Math.atan2(y, x);
      const rim = 0.73 + 0.07 * Math.sin(7 * angle) + 0.04 * Math.cos(11 * angle);
      const core = 1 - THREE.MathUtils.smoothstep(Math.hypot(x, y), rim - 0.06, rim);
      const mottling = Math.cos(7 * x + 9 * y) * Math.sin(11 * x - 6 * y);
      const index = (j * size + i) * 4;
      pixels[index] = 111 - 38 * core + 4 * mottling;
      pixels[index + 1] = 72 - 29 * core + 3 * mottling;
      pixels[index + 2] = 53 - 17 * core + 2 * mottling;
      pixels[index + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(pixels, size, size);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

/** The largest number of cells a splat of this size can span along one axis. */
function maxCells(edges: readonly number[], width: number): number {
  let first = 0;
  let count = 1;
  for (const [last, edge] of edges.entries()) {
    while (edge - (edges[first] ?? edge) > width) first++;
    count = Math.max(count, last - first + 2);
  }
  return count;
}

function nextEdge(edges: readonly number[], current: number, end: number): number {
  let first = 0;
  let last = edges.length;
  while (first < last) {
    const mid = (first + last) >>> 1;
    if ((edges[mid] ?? Infinity) <= current) first = mid + 1;
    else last = mid;
  }
  return Math.min(end, edges[first] ?? end);
}

/**
 * Batches mud decals across their full ground footprint, splitting at hills and pit edges.
 * Each patch fades over its final 60 ticks while keeping its footprint fixed.
 */
export function createSplatView(root: THREE.Group, course: Course, track: TrackFrames, capacity: number) {
  const rows = new Set(course.hills.map((hill) => hill.s));
  const sides = new Set<number>();
  for (let s = 0; s < track.length; s++) rows.add(s);
  for (const feature of course.features) {
    if (feature.kind !== 'pit') continue;
    rows.add(feature.s0).add(feature.s1);
    sides.add(feature.d0).add(feature.d1);
  }
  const rowEdges = [...rows].sort((a, b) => a - b);
  const sideEdges = [...sides].sort((a, b) => a - b);
  const cells = capacity * maxCells(rowEdges, ITEMS.splatLength) * maxCells(sideEdges, ITEMS.splatWidth);
  const geometry = new THREE.BufferGeometry();
  const positions = new THREE.BufferAttribute(new Float32Array(cells * 4 * 3), 3);
  const uvs = new THREE.BufferAttribute(new Float32Array(cells * 4 * 2), 2);
  const colors = new THREE.BufferAttribute(new Float32Array(cells * 4 * 4).fill(1), 4);
  positions.setUsage(THREE.DynamicDrawUsage);
  uvs.setUsage(THREE.DynamicDrawUsage);
  colors.setUsage(THREE.DynamicDrawUsage);
  colors.onUpload(() => colors.clearUpdateRanges());
  geometry.setAttribute('position', positions);
  geometry.setAttribute('uv', uvs);
  geometry.setAttribute('color', colors);
  const indices = new Uint32Array(cells * 6);
  for (let i = 0; i < cells; i++) {
    const vertex = i * 4;
    const at = i * 6;
    indices[at] = vertex;
    indices[at + 1] = vertex + 1;
    indices[at + 2] = vertex + 2;
    indices[at + 3] = vertex;
    indices[at + 4] = vertex + 2;
    indices[at + 5] = vertex + 3;
  }
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  const material = new THREE.MeshBasicMaterial({
    map: mudTexture(),
    vertexColors: true,
    transparent: true,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  // Blend the ground decals before racer shadows and other transparent effects.
  // Overlaps within the batch blend in the order of the splat list.
  mesh.renderOrder = -1;
  mesh.frustumCulled = false;
  mesh.visible = false;
  root.add(mesh);

  const frame: TrackFrame = { x: 0, y: 0, z: 0, tx: 0, tz: 0, rx: 0, rz: 0 };
  const positionRange = { start: 0, count: 0 };
  const uvRange = { start: 0, count: 0 };
  const colorRange = { start: 0, count: 0 };
  const patches = Array.from({ length: capacity }, () => ({
    s0: 0,
    d0: 0,
    s1: 0,
    d1: 0,
    firstVertex: 0,
    endVertex: 0,
    opacity: -1,
  }));
  let drawnCount = 0;
  let vertex = 0;
  function write(s: number, d: number, u: number, v: number): void {
    const { x, y, z, rx, rz } = track.frameAt(s, frame);
    positions.setXYZ(vertex, x + rx * d, y + GROUND_LIFT, z + rz * d);
    uvs.setXY(vertex++, u, v);
  }

  function draw(splat: Splat): void {
    const length = splat.s1 - splat.s0;
    const width = splat.d1 - splat.d0;
    const endS = Math.min(track.length, splat.s1);
    const endD = Math.min(course.halfWidth, splat.d1);
    for (let s0 = Math.max(0, splat.s0); s0 < endS; ) {
      const s1 = nextEdge(rowEdges, s0, endS);
      const v0 = (s0 - splat.s0) / length;
      const v1 = (s1 - splat.s0) / length;
      for (let d0 = Math.max(-course.halfWidth, splat.d0); d0 < endD; ) {
        const d1 = nextEdge(sideEdges, d0, endD);
        if (!pitAt(course, (s0 + s1) / 2, (d0 + d1) / 2)) {
          if (vertex >= positions.count) return;
          const u0 = (d0 - splat.d0) / width;
          const u1 = (d1 - splat.d0) / width;
          write(s0, d0, u0, v0);
          write(s0, d1, u1, v0);
          write(s1, d1, u1, v1);
          write(s1, d0, u0, v1);
        }
        d0 = d1;
      }
      s0 = s1;
    }
  }

  function layoutChanged(splats: readonly Splat[], count: number): boolean {
    if (count !== drawnCount) return true;
    for (let i = 0; i < count; i++) {
      const splat = splats[i];
      const patch = patches[i];
      if (!splat || !patch) continue;
      if (patch.s0 !== splat.s0 || patch.d0 !== splat.d0 || patch.s1 !== splat.s1 || patch.d1 !== splat.d1) return true;
    }
    return false;
  }

  function rebuild(splats: readonly Splat[], count: number): void {
    drawnCount = count;
    vertex = 0;
    colors.clearUpdateRanges();
    for (let i = 0; i < count; i++) {
      const splat = splats[i];
      const patch = patches[i];
      if (!splat || !patch) continue;
      patch.s0 = splat.s0;
      patch.d0 = splat.d0;
      patch.s1 = splat.s1;
      patch.d1 = splat.d1;
      patch.firstVertex = vertex;
      draw(splat);
      patch.endVertex = vertex;
      patch.opacity = -1;
    }
    mesh.visible = vertex > 0;
    geometry.setDrawRange(0, (vertex / 4) * 6);
    if (!mesh.visible) return;
    positionRange.count = vertex * positions.itemSize;
    uvRange.count = vertex * uvs.itemSize;
    positions.updateRanges[0] = positionRange;
    uvs.updateRanges[0] = uvRange;
    positions.needsUpdate = true;
    uvs.needsUpdate = true;
  }

  function updateOpacity(splats: readonly Splat[], count: number): void {
    let start = vertex;
    let end = 0;
    for (let i = 0; i < count; i++) {
      const splat = splats[i];
      const patch = patches[i];
      if (!splat || !patch || patch.firstVertex === patch.endVertex) continue;
      const opacity = THREE.MathUtils.clamp(splat.ticksLeft / FADE_TICKS, 0, 1);
      if (opacity === patch.opacity) continue;
      patch.opacity = opacity;
      for (let at = patch.firstVertex; at < patch.endVertex; at++) colors.setW(at, opacity);
      start = Math.min(start, patch.firstVertex);
      end = Math.max(end, patch.endVertex);
    }
    if (end <= start) return;
    start *= colors.itemSize;
    end *= colors.itemSize;
    if (colors.updateRanges.length > 0) {
      start = Math.min(start, colorRange.start);
      end = Math.max(end, colorRange.start + colorRange.count);
    }
    colorRange.start = start;
    colorRange.count = end - start;
    colors.updateRanges[0] = colorRange;
    colors.needsUpdate = true;
  }

  return {
    sync(splats: readonly Splat[] = NO_SPLATS): void {
      const count = Math.min(splats.length, capacity);
      if (layoutChanged(splats, count)) rebuild(splats, count);
      if (mesh.visible) updateOpacity(splats, count);
    },
  };
}
