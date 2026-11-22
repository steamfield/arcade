/**
 * A binary min-heap keyed by distance, used by the flow-field Dijkstra. Equal
 * keys come out in the order they went in, so a search visits tiles the same
 * way every run.
 */

interface Entry<T> {
  key: number;
  /** Insertion count; breaks ties between equal keys. */
  order: number;
  value: T;
}

/** Values ordered by a numeric key, lowest first; equal keys first in, first out. */
export class PriorityQueue<T> {
  private readonly entries: Entry<T>[] = [];
  private pushed = 0;

  /** Number of values waiting. */
  get size(): number {
    return this.entries.length;
  }

  /** Adds a value under `key`. */
  push(key: number, value: T): void {
    this.entries.push({ key, order: this.pushed++, value });
    let child = this.entries.length - 1;
    while (child > 0) {
      const parent = (child - 1) >> 1;
      if (!this.comesBefore(child, parent)) return;
      this.swap(child, parent);
      child = parent;
    }
  }

  /**
   * Removes and returns the value with the lowest key.
   *
   * @returns undefined when the queue is empty.
   */
  pop(): T | undefined {
    const top = this.entries[0];
    const last = this.entries.pop();
    if (!top || !last || this.entries.length === 0) return top?.value;
    this.entries[0] = last;
    this.siftDown();
    return top.value;
  }

  private siftDown(): void {
    let parent = 0;
    for (;;) {
      let first = parent;
      for (const child of [2 * parent + 1, 2 * parent + 2]) {
        if (this.comesBefore(child, first)) first = child;
      }
      if (first === parent) return;
      this.swap(parent, first);
      parent = first;
    }
  }

  /** False when either index is past the end, so callers can probe children freely. */
  private comesBefore(i: number, j: number): boolean {
    const a = this.entries[i];
    const b = this.entries[j];
    if (!a || !b) return false;
    return a.key < b.key || (a.key === b.key && a.order < b.order);
  }

  private swap(i: number, j: number): void {
    const held = this.entries[i] as Entry<T>;
    this.entries[i] = this.entries[j] as Entry<T>;
    this.entries[j] = held;
  }
}
