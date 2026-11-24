/**
 * One request to the outside (creating a room, copying a link) whose answer arrives between logic
 * ticks. The answer is kept until the next tick takes it, so it is acted on inside a tick, and an
 * answer to a request the flow has since moved on from (cancelled, or asked again) is dropped.
 */

/** A request that may be waiting for its answer. */
export interface Pending<T> {
  /** True from `start` until the answer arrives or the request is cancelled. */
  readonly waiting: boolean;
  /**
   * Calls `call` on a later microtask, so a port that throws at once still answers through
   * `recover`, as one whose promise rejects does. Any earlier request's answer is dropped.
   */
  start(call: () => Promise<T>, recover: (error: unknown) => T): void;
  /** The answer, once, if it has arrived; null otherwise. */
  take(): { value: T } | null;
  /** Forgets the request: `waiting` is false at once and its answer, when it comes, is dropped. */
  cancel(): void;
}

/** A request slot with nothing asked yet. */
export function createPending<T>(): Pending<T> {
  let generation = 0;
  let waiting = false;
  let answer: { value: T } | null = null;
  return {
    get waiting() {
      return waiting;
    },
    start(call, recover) {
      const asked = ++generation;
      waiting = true;
      answer = null;
      void Promise.resolve()
        .then(call)
        .catch(recover)
        .then((value) => {
          if (asked !== generation) return;
          answer = { value };
          waiting = false;
        });
    },
    take() {
      const taken = answer;
      answer = null;
      return taken;
    },
    cancel() {
      generation++;
      waiting = false;
      answer = null;
    },
  };
}
