/**
 * Distance-to-finish fields over the tile grid (see FlowFields) and the two
 * questions asked of them: how far along is a body, and which way should it swim.
 */
import type { Body, FlowFields, Level, Vec } from '../types.ts';

/** Builds all three fields by Dijkstra from the finish column. Rebuild when coral breaks. */
export function buildFlowFields(level: Level, broken: ReadonlySet<number>): FlowFields {
  void level;
  void broken;
  throw new Error('not implemented');
}

/**
 * Distance to the finish in tiles at a body's centre, interpolated inside the tile toward its
 * lowest neighbour so a body further along the same tile reads lower.
 */
export function progressAt(fields: FlowFields, level: Level, body: Body): number {
  void fields;
  void level;
  void body;
  throw new Error('not implemented');
}

/**
 * Unit direction from a body's centre toward the tile `lookahead` steps down `field`,
 * never across a solid corner. `{x: 0, y: 0}` on a finish tile.
 */
export function steerDirection(
  field: Float32Array,
  fields: FlowFields,
  level: Level,
  broken: ReadonlySet<number>,
  body: Body,
  lookahead: number,
): Vec {
  void field;
  void fields;
  void level;
  void broken;
  void body;
  void lookahead;
  throw new Error('not implemented');
}

/** Indices into `level.starts` whose tile cannot reach the finish on the `steer` field. */
export function unreachableStarts(level: Level, fields: FlowFields): number[] {
  void level;
  void fields;
  throw new Error('not implemented');
}
