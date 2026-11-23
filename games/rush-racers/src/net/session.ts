/**
 * The lockstep session: one per peer per race. It decides when this peer's world may step. A tick
 * is stepped only once an input for it is held from every human still racing, so every peer steps
 * the same ticks from the same inputs and a bad connection costs smoothness, never agreement.
 * See plans/reef-rush-multiplayer.md, sections 5.3 and 5.4.
 */
import type { RacerId, TickInput, World } from '../logic/types.ts';

/** A world hash that differed between two peers. */
export interface Desync {
  tick: number;
  /** This peer's hash at `tick`. */
  local: number;
  /** The other peer's. */
  remote: number;
  /** The slot whose peer sent `remote`. */
  slot: RacerId;
}

/** What a session is built from. */
export interface SessionOptions {
  /** This peer's world, built from the start message and not yet stepped. The session is the only thing that steps it. */
  world: World;
  /** The slot this peer races in. */
  local: RacerId;
  /** Every slot a person races in, this peer's included. */
  humans: readonly RacerId[];
  /** Ticks between reading an input and applying it, equal on every peer. */
  delay: number;
  /** Sends a binary message to the other peers. */
  send(bytes: Uint8Array): void;
  /** Called once, when a hash from another peer differs from this peer's. */
  onDesync(desync: Desync): void;
  /** Milliseconds of stall after which the session asks for the peers it waits on to be kicked; null never asks. */
  kickAfterMs: number | null;
  /** Asks the room to remove the peer in `slot`, which this session has been waiting on. */
  requestKick(slot: RacerId): void;
}

/** One peer's lockstep session. */
export interface Session {
  /**
   * Run once per logic step with the input read this step and the wall time the step stands for.
   * Returns how many ticks the world stepped: 0 or 1.
   */
  pump(input: TickInput, elapsedMs: number): number;
  /** Takes a binary message from the peer in `slot`. Malformed bytes and input for a slot already gone are dropped; returns false for those. */
  receive(slot: RacerId, bytes: Uint8Array): boolean;
  /** The peer in `slot` left: its racer is handed to the AI from the tick after its last input. */
  peerLeft(slot: RacerId): void;
  /** The last tick the world stepped. */
  readonly simTick: number;
  /** The tick this peer's clock says the world should have reached. */
  readonly targetTick: number;
  /** Milliseconds this peer has been unable to step while behind its clock; 0 while on time. */
  readonly stalledMs: number;
  /** The slots whose input for the next tick is missing; empty while on time. */
  readonly waitingOn: readonly RacerId[];
  /** `desynced` once a hash differed; the session then never steps again. */
  readonly state: 'running' | 'desynced';
}

/**
 * A session for `options.local` in a race among `options.humans`.
 *
 * @throws {Error} When `local` is not in `humans`, or `delay` is not a whole number from 1 to 12.
 */
export function createSession(_options: SessionOptions): Session {
  throw new Error('not implemented');
}
