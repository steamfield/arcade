/**
 * A hash of a world's state, so two runs of the same race can be compared with one number: the
 * cross-engine check in tests, and later the desync check between players.
 *
 * The hash is 32-bit FNV-1a over a generic walk of the world, so state added to `World` later is
 * covered without anyone listing it. Every value kind writes a tag byte before its content, so
 * `[1]`, `{0: 1}` and `"1"` cannot produce the same bytes.
 */
import type { World } from './types.ts';

const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

const TAG = {
  undefined: 0,
  null: 1,
  boolean: 2,
  number: 3,
  string: 4,
  array: 5,
  set: 6,
  object: 7,
} as const;

/**
 * Top-level `World` keys left out of the hash: fixed before the first tick, derived from hashed
 * state, or output. Peers comparing hashes must agree on the fixed ones when the race is set up,
 * since the hash will not show a difference in them.
 */
const UNHASHED_WORLD_KEYS: ReadonlySet<string> = new Set([
  'level', // static for a race
  'humans', // which slots people race in, fixed at setup
  'progress', // static for a race
  'nav', // derived from `broken`, which is hashed
  'events', // an output sink, not state
  'recentEvents', // a per-tick buffer of events already emitted
]);

const DOUBLE_BYTES = 8;
/** Scratch space for one double. Written little-endian whatever the CPU's own byte order is. */
const doubleView = new DataView(new ArrayBuffer(DOUBLE_BYTES));

/** A running FNV-1a hash that bytes are fed into. */
interface ByteSink {
  byte(value: number): void;
  hash(): number;
}

function createByteSink(): ByteSink {
  let state = FNV_OFFSET_BASIS;
  return {
    byte(value) {
      state = Math.imul(state ^ value, FNV_PRIME);
    },
    hash: () => state >>> 0,
  };
}

/**
 * A 32-bit unsigned hash of every part of `world` that a race can change.
 *
 * @throws {TypeError} When the world holds a value there is no hashing rule for, or a value that
 *   contains itself, naming its path.
 */
export function hashWorld(world: World): number {
  const sink = createByteSink();
  writeValue(sink, hashableView(world), '', new Set());
  return sink.hash();
}

/** The world's hashed fields, with each rng stream replaced by its state since the streams are closures. */
function hashableView(world: World): Record<string, unknown> {
  const view: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(world)) {
    if (!UNHASHED_WORLD_KEYS.has(key)) view[key] = value;
  }
  view.rngs = Object.fromEntries(Object.entries(world.rngs).map(([stream, rng]) => [stream, rng.state()]));
  return view;
}

/**
 * Writes one value by its kind. `open` holds the containers on the way down to it, so a value that
 * contains itself is reported instead of walked forever.
 */
function writeValue(sink: ByteSink, value: unknown, path: string, open: Set<object>): void {
  if (value === undefined) sink.byte(TAG.undefined);
  else if (value === null) sink.byte(TAG.null);
  else if (typeof value === 'boolean') writeBoolean(sink, value);
  else if (typeof value === 'number') writeNumber(sink, value);
  else if (typeof value === 'string') writeString(sink, value);
  else if (Array.isArray(value)) writeContainer(value, path, open, () => writeArray(sink, value, path, open));
  else if (value instanceof Set) writeSet(sink, value, path);
  else if (isPlainObject(value)) writeContainer(value, path, open, () => writeObject(sink, value, path, open));
  else throw new TypeError(`hashWorld: no rule for ${describeKind(value)} at ${path || '(world)'}`);
}

/** Runs `write` for a container, refusing one that is already open above it. */
function writeContainer(container: object, path: string, open: Set<object>, write: () => void): void {
  if (open.has(container)) throw new TypeError(`hashWorld: a cycle at ${path || '(world)'}`);
  open.add(container);
  write();
  open.delete(container);
}

function writeBoolean(sink: ByteSink, value: boolean): void {
  sink.byte(TAG.boolean);
  sink.byte(value ? 1 : 0);
}

/** The canonical quiet NaN, little-endian. */
const NAN_BYTES = [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xf8, 0x7f] as const;

function writeNumber(sink: ByteSink, value: number): void {
  sink.byte(TAG.number);
  // Every NaN is written as these fixed bytes and never through setFloat64, since the spec lets an
  // engine store any NaN bit pattern there, even for the Number.NaN constant.
  if (Number.isNaN(value)) {
    for (const byte of NAN_BYTES) sink.byte(byte);
    return;
  }
  doubleView.setFloat64(0, value, true);
  for (let index = 0; index < DOUBLE_BYTES; index++) sink.byte(doubleView.getUint8(index));
}

/** Writes the length then each UTF-16 code unit as two bytes, so neighbouring strings cannot run together. */
function writeString(sink: ByteSink, value: string): void {
  sink.byte(TAG.string);
  writeCount(sink, value.length);
  for (let index = 0; index < value.length; index++) {
    const unit = value.charCodeAt(index);
    sink.byte(unit & 0xff);
    sink.byte(unit >>> 8);
  }
}

function writeCount(sink: ByteSink, count: number): void {
  for (let shift = 0; shift < 32; shift += 8) sink.byte((count >>> shift) & 0xff);
}

function writeArray(sink: ByteSink, items: readonly unknown[], path: string, open: Set<object>): void {
  sink.byte(TAG.array);
  writeCount(sink, items.length);
  // An indexed loop, so a hole in a sparse array is written as undefined and the count stays true.
  for (let index = 0; index < items.length; index++)
    writeValue(sink, items[index], joinPath(path, String(index)), open);
}

function writeSet(sink: ByteSink, members: Set<unknown>, path: string): void {
  sink.byte(TAG.set);
  writeCount(sink, members.size);
  for (const member of sortedMembers(members, path)) writeValue(sink, member, path, new Set());
}

function sortedMembers(members: Set<unknown>, path: string): unknown[] {
  const items = [...members];
  if (items.every((item) => typeof item === 'number')) return items.sort(compareNumbers);
  if (items.every((item) => typeof item === 'string')) return items.sort();
  throw new TypeError(`hashWorld: the set at ${path} must hold only numbers or only strings`);
}

/** Ascending, with NaN after every number, so the order is total and no engine's sort can disagree. */
function compareNumbers(a: number, b: number): number {
  if (Number.isNaN(a)) return Number.isNaN(b) ? 0 : 1;
  if (Number.isNaN(b)) return -1;
  return a - b;
}

function writeObject(sink: ByteSink, fields: Record<string, unknown>, path: string, open: Set<object>): void {
  const keys = Object.keys(fields)
    .filter((key) => fields[key] !== undefined)
    .sort();
  sink.byte(TAG.object);
  writeCount(sink, keys.length);
  for (const key of keys) {
    writeString(sink, key);
    writeValue(sink, fields[key], joinPath(path, key), open);
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function joinPath(path: string, key: string): string {
  return path ? `${path}.${key}` : key;
}

function describeKind(value: unknown): string {
  if (typeof value === 'object') return `an instance of ${value?.constructor?.name ?? 'an unnamed class'}`;
  return `a ${typeof value}`;
}
