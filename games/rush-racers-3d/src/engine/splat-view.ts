import * as THREE from 'three';
import { pitAt } from '../logic/course.ts';
import { ITEMS } from '../logic/tuning.ts';
import type { Course, Splat } from '../logic/types.ts';
import type { TrackFrame, TrackFrames } from './track-geometry.ts';

const NO_SPLATS: readonly Splat[] = [];

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

/** Batches ground decals, splitting at hills and pit edges so no face spans an opening. */
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
  positions.setUsage(THREE.DynamicDrawUsage);
  uvs.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('position', positions);
  geometry.setAttribute('uv', uvs);
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
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ map: mudTexture() }));
  mesh.frustumCulled = false;
  mesh.visible = false;
  root.add(mesh);

  const frame: TrackFrame = { x: 0, y: 0, z: 0, tx: 0, tz: 0, rx: 0, rz: 0 };
  const positionRange = { start: 0, count: 0 };
  const uvRange = { start: 0, count: 0 };
  let vertex = 0;
  function write(s: number, d: number, layer: number, u: number, v: number): void {
    const { x, y, z, rx, rz } = track.frameAt(s, frame);
    positions.setXYZ(vertex, x + rx * d, y + layer, z + rz * d);
    uvs.setXY(vertex++, u, v);
  }

  function draw(splat: Splat, layer: number): void {
    const s = (splat.s0 + splat.s1) / 2;
    const d = (splat.d0 + splat.d1) / 2;
    // The dark centre contracts before expiry. The lighter mud still marks the full active span.
    const scale = Math.min(1, splat.ticksLeft / (ITEMS.splatTicks * 0.32));
    const sScale = (splat.s1 - splat.s0) * scale;
    const dScale = (splat.d1 - splat.d0) * scale;
    const endS = Math.min(track.length, splat.s1);
    const endD = Math.min(course.halfWidth, splat.d1);
    for (let s0 = Math.max(0, splat.s0); s0 < endS; ) {
      const s1 = nextEdge(rowEdges, s0, endS);
      const v0 = 0.5 + (s0 - s) / sScale;
      const v1 = 0.5 + (s1 - s) / sScale;
      for (let d0 = Math.max(-course.halfWidth, splat.d0); d0 < endD; ) {
        const d1 = nextEdge(sideEdges, d0, endD);
        if (!pitAt(course, (s0 + s1) / 2, (d0 + d1) / 2)) {
          const u0 = 0.5 + (d0 - d) / dScale;
          const u1 = 0.5 + (d1 - d) / dScale;
          write(s0, d0, layer, u0, v0);
          write(s0, d1, layer, u1, v0);
          write(s1, d1, layer, u1, v1);
          write(s1, d0, layer, u0, v1);
        }
        d0 = d1;
      }
      s0 = s1;
    }
  }

  return {
    sync(splats: readonly Splat[] = NO_SPLATS): void {
      vertex = 0;
      let layer = 0.05;
      for (const splat of splats) {
        if (splat.ticksLeft <= 0) continue;
        draw(splat, layer);
        layer += 0.0001;
      }
      mesh.visible = vertex > 0;
      if (!mesh.visible) return;
      geometry.setDrawRange(0, (vertex / 4) * 6);
      positionRange.count = vertex * positions.itemSize;
      uvRange.count = vertex * uvs.itemSize;
      positions.updateRanges[0] = positionRange;
      uvs.updateRanges[0] = uvRange;
      positions.needsUpdate = true;
      uvs.needsUpdate = true;
    },
  };
}
