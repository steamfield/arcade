import { createRng } from '@arcade/core';
import * as THREE from 'three';
import type { Course, Span } from '../../logic/types.ts';
import type { Theme } from '../themes/types.ts';
import type { TrackFrame, TrackFrames } from './track-geometry.ts';

/** Chunk size in terrain strips and approximate meters of scenery. */
export const TERRAIN_CHUNK = 96;
/** Meters of visual terrain beyond the two ends of the course path. */
export const SCENERY_RUNOUT = { start: 24, finish: 120 };

const PIT_DEPTH = 8;
/** Meters of ground one repeat of the grain texture covers. */
const GRAIN_TILE = 3.5;

/**
 * A tiling greyscale grain (soft blotches plus pebbly speckle) multiplied over the vertex colours,
 * so the trail and verges read as ground up close. Seeded so captures stay identical.
 */
function groundGrain(): THREE.DataTexture {
  const size = 128;
  const rng = createRng(0x9a17);
  const lattice = (cells: number) => Array.from({ length: cells * cells }, () => rng.next());
  const smooth = (t: number) => t * t * (3 - 2 * t);
  const noise = (grid: number[], cells: number, x: number, y: number) => {
    const gx = (x / size) * cells;
    const gy = (y / size) * cells;
    const x0 = Math.floor(gx);
    const y0 = Math.floor(gy);
    const at = (i: number, j: number) => grid[((j % cells) * cells + (i % cells)) % grid.length] ?? 0;
    const tx = smooth(gx - x0);
    const ty = smooth(gy - y0);
    const top = at(x0, y0) * (1 - tx) + at(x0 + 1, y0) * tx;
    const bottom = at(x0, y0 + 1) * (1 - tx) + at(x0 + 1, y0 + 1) * tx;
    return top * (1 - ty) + bottom * ty;
  };
  const octaves = [
    { cells: 4, weight: 0.5, grid: lattice(16) },
    { cells: 16, weight: 0.3, grid: lattice(256) },
    { cells: 64, weight: 0.2, grid: lattice(4096) },
  ];
  const pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let value = 0;
      for (const { cells, weight, grid } of octaves) value += noise(grid, cells, x, y) * weight;
      const speck = rng.next();
      const shade = 0.8 + (value - 0.5) * 0.32 + (speck > 0.97 ? 0.12 : speck < 0.04 ? -0.14 : 0);
      const byte = Math.round(255 * Math.max(0, Math.min(1, shade)));
      const i = (y * size + x) * 4;
      pixels[i] = byte;
      pixels[i + 1] = byte;
      pixels[i + 2] = byte;
      pixels[i + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(pixels, size, size);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

interface TrackRow {
  s: number;
  frame: TrackFrame;
}

/** Longitudinal rows and lateral breakpoints shared by the ribbon and scenery placement. */
export interface TerrainGrid {
  rows: TrackRow[];
  sides: number[];
  halfWidth: number;
}

interface Interval<T> {
  a: T;
  b: T;
}

type Cell = Interval<TrackRow> & { d0: number; d1: number };
type GroundColors = { [Surface in keyof Theme['ground']]: THREE.Color };

const uniqueSorted = (values: number[]) => [...new Set(values)].sort((a, b) => a - b);

function adjacent<T>(values: T[]): Interval<T>[] {
  const pairs: Interval<T>[] = [];
  let previous: T | undefined;
  for (const value of values) {
    if (previous !== undefined) pairs.push({ a: previous, b: value });
    previous = value;
  }
  return pairs;
}

function contains(span: Span, s: number, d: number): boolean {
  return s > span.s0 && s < span.s1 && d > span.d0 && d < span.d1;
}

function vergeRise(s: number, d: number, halfWidth: number): number {
  const verge = Math.max(0, Math.abs(d) - halfWidth - 0.6);
  return Math.min(1, verge / 14) * (1.25 + 0.8 * Math.sin(s * 0.12 + d * 0.31));
}

function sceneryFrame(track: TrackFrames, s: number): TrackFrame {
  const frame = track.frameAt(s);
  const extra = s - Math.max(0, Math.min(s, track.length));
  frame.x += extra * frame.tx;
  frame.z += extra * frame.tz;
  return frame;
}

/** Collects breakpoints so slopes, markings, and surface features share the same vertices. */
export function buildTerrainGrid(course: Course, track: TrackFrames): TerrainGrid {
  const { halfWidth } = course;
  const distances = [course.startS, course.startS + 0.65, course.finishS - 0.9, course.finishS, track.length];
  for (let s = -SCENERY_RUNOUT.start; s <= track.length + SCENERY_RUNOUT.finish; s++) distances.push(s);
  for (const knot of course.hills) distances.push(knot.s);
  const sides = [-halfWidth - 27, -halfWidth - 12, -halfWidth - 3, halfWidth + 3, halfWidth + 12, halfWidth + 27];
  // Extra columns either side of the trail's edge so the dirt-to-grass blend has vertices to fade across.
  for (const edge of [-0.9, 0.6, 1.5, 2.2, 5, 8]) sides.push(-halfWidth - edge, halfWidth + edge);
  for (let lane = -4; lane <= 4; lane++) sides.push((lane * halfWidth) / 4);
  for (const span of course.features) {
    if (span.kind !== 'pit' && span.kind !== 'mud') continue;
    distances.push(span.s0, span.s1);
    sides.push(span.d0, span.d1);
  }
  const rows = uniqueSorted(distances).map((s) => ({ s, frame: sceneryFrame(track, s) }));
  return { rows, sides: uniqueSorted(sides), halfWidth };
}

function vertexAt({ s, frame }: TrackRow, d: number, halfWidth: number) {
  return {
    x: frame.x + d * frame.rx,
    y: frame.y + vergeRise(s, d, halfWidth),
    z: frame.z + d * frame.rz,
  };
}

const rowDistance = (row: TrackRow) => row.s;
const sideDistance = (side: number) => side;

function bracket<T>(values: T[], value: number, coordinate: (sample: T) => number) {
  let lo = 0;
  let hi = values.length - 1;
  let a = values[lo];
  let b = values[hi];
  if (a === undefined || b === undefined) throw new RangeError('Terrain surface has no breakpoints');
  while (hi - lo > 1) {
    const mid = (lo + hi) >>> 1;
    const sample = values[mid];
    if (sample === undefined) throw new RangeError(`Missing terrain breakpoint ${mid} of ${values.length}`);
    if (coordinate(sample) <= value) {
      lo = mid;
      a = sample;
    } else {
      hi = mid;
      b = sample;
    }
  }
  const low = coordinate(a);
  const high = coordinate(b);
  const t = low === high ? 0 : (Math.max(low, Math.min(high, value)) - low) / (high - low);
  return { a, b, t };
}

/** Samples the verge surface at track coordinates for placing scenery. */
export function terrainPointAt(grid: TerrainGrid, s: number, d: number) {
  const { a, b, t: along } = bracket(grid.rows, s, rowDistance);
  const { a: d0, b: d1, t: across } = bracket(grid.sides, d, sideDistance);
  const start = vertexAt(a, d0, grid.halfWidth);
  const end = vertexAt(b, d1, grid.halfWidth);
  // Match the mesh's diagonal from (a, d0) to (b, d1).
  const corner = across >= along ? vertexAt(a, d1, grid.halfWidth) : vertexAt(b, d0, grid.halfWidth);
  const startWeight = 1 - Math.max(along, across);
  const endWeight = Math.min(along, across);
  const cornerWeight = Math.abs(along - across);
  return {
    x: start.x * startWeight + end.x * endWeight + corner.x * cornerWeight,
    y: start.y * startWeight + end.y * endWeight + corner.y * cornerWeight,
    z: start.z * startWeight + end.z * endWeight + corner.z * cornerWeight,
  };
}

function classifyHoles(pits: Span[], strips: Interval<TrackRow>[], widths: Interval<number>[]): boolean[][] {
  return strips.map(({ a, b }) =>
    widths.map((width) => pits.some((pit) => contains(pit, (a.s + b.s) / 2, (width.a + width.b) / 2))),
  );
}

class TerrainChunk {
  private readonly positions: number[] = [];
  private readonly colors: number[] = [];
  private readonly uvs: number[] = [];
  private readonly mix = new THREE.Color();
  private readonly halfWidth: number;
  private readonly ground: GroundColors;

  constructor(halfWidth: number, ground: GroundColors) {
    this.halfWidth = halfWidth;
    this.ground = ground;
  }

  /**
   * The open ground's colour at a point: dirt down the trail, fading through a worn shoulder to
   * grass along an edge that wanders with `s`, with darker grass patches further out.
   */
  private groundAt(s: number, d: number): THREE.Color {
    const { dirt, shoulder, grass } = this.ground;
    const edge = this.halfWidth + 0.35 * Math.sin(s * 0.7) + 0.25 * Math.sin(s * 1.9 + 1);
    const out = Math.abs(d) - edge;
    const smooth = (t: number) => {
      const c = Math.max(0, Math.min(1, t));
      return c * c * (3 - 2 * c);
    };
    const worn = smooth((out + 0.7) / 1.1);
    const grown = smooth((out - 0.6 - 0.5 * Math.sin(s * 0.43 + d)) / 2.2);
    this.mix.copy(dirt).lerp(shoulder, worn).lerp(grass, grown);
    const patch = 0.5 + 0.5 * Math.sin(s * 0.11 + d * 0.23) * Math.sin(s * 0.07 - d * 0.31);
    return this.mix.multiplyScalar(1 - 0.22 * grown * patch);
  }

  private vertex(row: TrackRow, d: number, offset: number, fixed: THREE.Color | null): void {
    const { x, y, z } = vertexAt(row, d, this.halfWidth);
    const { s } = row;
    const color = fixed ?? this.groundAt(s, d);
    const mottling = 0.05 * Math.sin(s * 2.2 + d * 4.9) + 0.07 * Math.sin(s * 0.29 + Math.sin(d) * 2.3);
    const shade = 1 + mottling - 0.11 * Math.min(1, Math.abs(d) / this.halfWidth);
    this.positions.push(x, y + offset, z);
    this.uvs.push(x / GRAIN_TILE, (z + y + offset) / GRAIN_TILE);
    this.colors.push(color.r * shade, color.g * shade, color.b * shade);
  }

  /** Adds a flat cell; a null colour shades it as open ground by position. */
  surface({ a, b, d0, d1 }: Cell, offset: number, color: THREE.Color | null): void {
    this.vertex(a, d0, offset, color);
    this.vertex(a, d1, offset, color);
    this.vertex(b, d1, offset, color);
    this.vertex(a, d0, offset, color);
    this.vertex(b, d1, offset, color);
    this.vertex(b, d0, offset, color);
  }

  private wall({ a, b, d0, d1 }: Cell, from: number, to: number, color: THREE.Color): void {
    this.vertex(a, d0, from, color);
    this.vertex(b, d1, from, color);
    this.vertex(b, d1, to, color);
    this.vertex(a, d0, from, color);
    this.vertex(b, d1, to, color);
    this.vertex(a, d0, to, color);
  }

  private pitEdge(a: TrackRow, d0: number, b: TrackRow, d1: number): void {
    const edge = { a, b, d0, d1 };
    this.wall(edge, 0, -0.45, this.ground.pitRim);
    this.wall(edge, -0.45, -PIT_DEPTH, this.ground.pitWall);
  }

  pit(cell: Cell, holes: boolean[][], i: number, j: number): void {
    const { a, b, d0, d1 } = cell;
    this.surface(cell, -PIT_DEPTH, this.ground.pitFloor);
    if (!holes[i - 1]?.[j]) this.pitEdge(a, d0, a, d1);
    if (!holes[i + 1]?.[j]) this.pitEdge(b, d1, b, d0);
    if (!holes[i]?.[j - 1]) this.pitEdge(b, d0, a, d0);
    if (!holes[i]?.[j + 1]) this.pitEdge(a, d1, b, d1);
  }

  mesh(material: THREE.Material): THREE.Mesh {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(this.colors, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(this.uvs, 2));
    geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.receiveShadow = true;
    return mesh;
  }
}

function surfaceColor(d: number, halfWidth: number, acrossLine: boolean, ground: GroundColors): THREE.Color | null {
  if (!acrossLine || Math.abs(d) > halfWidth) return null;
  return Math.floor((d / halfWidth + 1) * 4) % 2 ? ground.darkMark : ground.chalk;
}

function buildChunk(
  course: Course,
  strips: Interval<TrackRow>[],
  widths: Interval<number>[],
  holes: boolean[][],
  mud: Span[],
  first: number,
  ground: GroundColors,
): TerrainChunk {
  const chunk = new TerrainChunk(course.halfWidth, ground);
  for (const [index, { a, b }] of strips.slice(first, first + TERRAIN_CHUNK).entries()) {
    const i = first + index;
    const s = (a.s + b.s) / 2;
    const acrossLine =
      (s > course.startS && s < course.startS + 0.65) || (s > course.finishS - 0.9 && s < course.finishS);
    for (const [j, { a: d0, b: d1 }] of widths.entries()) {
      const cell = { a, b, d0, d1 };
      if (holes[i]?.[j]) {
        chunk.pit(cell, holes, i, j);
        continue;
      }
      const d = (d0 + d1) / 2;
      chunk.surface(cell, 0, surfaceColor(d, course.halfWidth, acrossLine, ground));
      if (!acrossLine && mud.some((patch) => contains(patch, s, d))) chunk.surface(cell, 0.025, ground.mud);
    }
  }
  return chunk;
}

/** Adds the chunked trail and verges, including mud surfaces and pit walls. */
export function trackTerrain(root: THREE.Group, course: Course, grid: TerrainGrid, palette: Theme['ground']): void {
  const ground: GroundColors = {
    dirt: new THREE.Color(palette.dirt),
    shoulder: new THREE.Color(palette.shoulder),
    grass: new THREE.Color(palette.grass),
    mud: new THREE.Color(palette.mud),
    pitRim: new THREE.Color(palette.pitRim),
    pitWall: new THREE.Color(palette.pitWall),
    pitFloor: new THREE.Color(palette.pitFloor),
    chalk: new THREE.Color(palette.chalk),
    darkMark: new THREE.Color(palette.darkMark),
  };
  const strips = adjacent(grid.rows);
  const widths = adjacent(grid.sides);
  const pits = course.features.filter((feature) => feature.kind === 'pit');
  const mud = course.features.filter((feature) => feature.kind === 'mud');
  const holes = classifyHoles(pits, strips, widths);
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    side: THREE.DoubleSide,
    map: groundGrain(),
    roughness: 0.95,
  });
  for (let first = 0; first < strips.length; first += TERRAIN_CHUNK) {
    root.add(buildChunk(course, strips, widths, holes, mud, first, ground).mesh(material));
  }
}
