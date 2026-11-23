/**
 * When the room last heard from each peer and how many messages it sent this second, and how long
 * a silence must last before a kick. The only room state kept in memory: hibernation wipes it, and
 * that fails safe, because a peer the room has no time for is never kicked and a fresh counter only
 * lets a peer send more.
 */
import type { Env } from './index.ts';
import { KICK_SILENCE_MS } from './protocol.ts';

/** The window message rates are counted over, in milliseconds. */
const RATE_WINDOW_MS = 1000;

interface PeerCounts {
  /** When the room last heard from the peer, or accepted its socket. */
  heardAt: number;
  /** When the current rate window began. */
  windowStart: number;
  /** Messages received in the current rate window. */
  sent: number;
}

/** Per-peer heard times and message counts, keyed by peer id. */
export class PeerTraffic {
  #counts = new Map<number, PeerCounts>();

  /** Starts tracking a peer whose socket was just accepted at `now`, as if it had just spoken. */
  joined(peer: number, now: number): void {
    this.#counts.set(peer, { heardAt: now, windowStart: now, sent: 0 });
  }

  /** Records a message from `peer` at `now` and returns how many it has sent in the current second. */
  heard(peer: number, now: number): number {
    const counts = this.#counts.get(peer);
    if (counts === undefined || now - counts.windowStart >= RATE_WINDOW_MS) {
      this.#counts.set(peer, { heardAt: now, windowStart: now, sent: 1 });
      return 1;
    }
    counts.heardAt = now;
    counts.sent += 1;
    return counts.sent;
  }

  /** How long `peer` has been silent at `now`, or null when the room has not heard it since waking. */
  silentFor(peer: number, now: number): number | null {
    const counts = this.#counts.get(peer);
    return counts === undefined ? null : now - counts.heardAt;
  }

  /** Stops tracking a peer that has gone. */
  forget(peer: number): void {
    this.#counts.delete(peer);
  }
}

/**
 * How long a peer must be silent before a `kick` naming it is honoured: `KICK_SILENCE_MS` unless
 * the Worker's `KICK_SILENCE_MS` var overrides it.
 *
 * @throws Error when the var is set but is not a positive number of milliseconds.
 */
export function kickSilenceMs(env: Env): number {
  if (env.KICK_SILENCE_MS === undefined) return KICK_SILENCE_MS;
  const silence = Number(env.KICK_SILENCE_MS);
  if (!(silence > 0)) {
    throw new Error(`KICK_SILENCE_MS must be a positive number of milliseconds, got "${env.KICK_SILENCE_MS}".`);
  }
  return silence;
}
