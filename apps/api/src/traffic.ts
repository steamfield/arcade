/**
 * When the room last heard inputs from each peer, how much of its message allowance it has left,
 * and how long a silence must last before a kick. The only room state kept in memory: hibernation
 * wipes it, and that fails safe. A peer the room knows nothing about counts as heard when the
 * object woke, so a kick still works one silence window later, and a fresh allowance only lets a
 * peer send more.
 */
import type { Env } from './index.ts';
import { KICK_SILENCE_MS, MAX_MESSAGES_PER_SECOND, MESSAGE_BURST } from './protocol.ts';

const MS_PER_SECOND = 1000;

interface PeerCounts {
  /** When the room last heard inputs from the peer, or accepted its socket, or started its race. */
  heardAt: number;
  /** Messages the peer may still send at once: a token bucket holding up to `MESSAGE_BURST`. */
  tokens: number;
  /** When `tokens` was last topped up. */
  refilledAt: number;
}

/** Per-peer heard times and message allowances, keyed by peer id. */
export class PeerTraffic {
  #counts = new Map<number, PeerCounts>();
  #wokeAt: number;

  /** @param wokeAt - When the Room object was constructed: the heard time of every peer it has no record of. */
  constructor(wokeAt: number) {
    this.#wokeAt = wokeAt;
  }

  /** Starts tracking a peer whose socket was just accepted at `now`, as if it had just spoken. */
  joined(peer: number, now: number): void {
    this.#counts.set(peer, { heardAt: now, tokens: MESSAGE_BURST, refilledAt: now });
  }

  /**
   * Takes one message from `peer`'s allowance at `now`, after refilling it at
   * `MAX_MESSAGES_PER_SECOND`. Returns false when the allowance is spent.
   */
  spend(peer: number, now: number): boolean {
    const counts = this.#countsOf(peer, now);
    const refill = ((now - counts.refilledAt) * MAX_MESSAGES_PER_SECOND) / MS_PER_SECOND;
    counts.tokens = Math.min(MESSAGE_BURST, counts.tokens + refill);
    counts.refilledAt = now;
    if (counts.tokens < 1) return false;
    counts.tokens -= 1;
    return true;
  }

  /** Records that the room heard inputs from `peer`, or that its race started, at `now`. */
  heard(peer: number, now: number): void {
    this.#countsOf(peer, now).heardAt = now;
  }

  /** How long `peer` has been silent at `now`. */
  silentFor(peer: number, now: number): number {
    return now - (this.#counts.get(peer)?.heardAt ?? this.#wokeAt);
  }

  /** Stops tracking a peer that has gone. */
  forget(peer: number): void {
    this.#counts.delete(peer);
  }

  /** The record for `peer`, starting one heard at waking with a full allowance when there is none. */
  #countsOf(peer: number, now: number): PeerCounts {
    let counts = this.#counts.get(peer);
    if (counts === undefined) {
      counts = { heardAt: this.#wokeAt, tokens: MESSAGE_BURST, refilledAt: now };
      this.#counts.set(peer, counts);
    }
    return counts;
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
