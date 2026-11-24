/** Small layout helpers the backdrop layers share for placing things that repeat without an rng. */

/** A fixed pseudo-random number in [0, 1) for a pair of integers, so layouts repeat without an rng. */
export function hash(a: number, b: number): number {
  const n = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

/** The remainder of `value` over `size`, never negative. */
export function wrap(value: number, size: number): number {
  return ((value % size) + size) % size;
}
