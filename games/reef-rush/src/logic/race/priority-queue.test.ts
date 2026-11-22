import { describe, expect, it } from 'vitest';
import { PriorityQueue } from './priority-queue.ts';

function drain<T>(queue: PriorityQueue<T>): T[] {
  const out: T[] = [];
  for (let value = queue.pop(); value !== undefined; value = queue.pop()) out.push(value);
  return out;
}

describe('PriorityQueue', () => {
  it('pops values in ascending key order regardless of push order', () => {
    const queue = new PriorityQueue<string>();
    for (const [key, value] of [
      [5, 'e'],
      [1, 'a'],
      [4, 'd'],
      [Number.POSITIVE_INFINITY, 'far'],
      [2.5, 'c'],
      [0, 'start'],
      [2, 'b'],
    ] as const) {
      queue.push(key, value);
    }

    expect(drain(queue)).toEqual(['start', 'a', 'b', 'c', 'd', 'e', 'far']);
    expect(queue.size).toBe(0);
  });

  it('returns equal keys in the order they were pushed', () => {
    const queue = new PriorityQueue<string>();
    const names = ['n0', 'n1', 'n2', 'n3', 'n4', 'n5', 'n6', 'n7', 'n8'];
    queue.push(3, 'late');
    for (const name of names) queue.push(1, name);
    queue.push(0, 'first');

    expect(drain(queue)).toEqual(['first', ...names, 'late']);
  });

  it('returns undefined when empty, including after being drained', () => {
    const queue = new PriorityQueue<number>();
    expect(queue.pop()).toBeUndefined();

    queue.push(1, 10);
    expect(queue.pop()).toBe(10);
    expect(queue.pop()).toBeUndefined();
  });

  it('keeps order when pushes and pops interleave, as in a Dijkstra search', () => {
    const queue = new PriorityQueue<string>();
    queue.push(0, 'origin');
    queue.push(4, 'd4');
    expect(queue.pop()).toBe('origin');
    queue.push(1, 'd1');
    queue.push(2, 'd2');
    expect(queue.pop()).toBe('d1');
    queue.push(1.5, 'd1.5');
    queue.push(2, 'd2-again');

    expect(queue.size).toBe(4);
    expect(drain(queue)).toEqual(['d1.5', 'd2', 'd2-again', 'd4']);
  });
});
