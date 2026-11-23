/**
 * The lockstep session: one per peer per race. It decides when this peer's world may step. A tick
 * is stepped only once an input for it is held from every human still racing, so every peer steps
 * the same ticks from the same inputs and a bad connection costs smoothness, never agreement.
 * See plans/reef-rush-multiplayer.md, sections 5.3 and 5.4.
 */
import { TICK_DT } from '@arcade/core';
import { hashWorld } from '../logic/hash.ts';
import type { RacerId, TickInput, World } from '../logic/types.ts';
import { stepRace } from '../logic/world.ts';
import { decode, encodeHash, encodeInputs, IDLE_INPUT } from './codec.ts';

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

const MIN_DELAY = 1;
const MAX_DELAY = 12;
/** Stepped ticks between hash checks. */
const HASH_EVERY = 60;
/** How long a hash is kept waiting for the other side of its tick: ten seconds of ticks. */
const HASH_KEEP_TICKS = 600;

/**
 * A session for `options.local` in a race among `options.humans`.
 *
 * @throws {Error} When `local` is not in `humans`, or `delay` is not a whole number from 1 to 12.
 */
export function createSession(options: SessionOptions): Session {
  requireValidOptions(options);
  const { world, local, humans, delay } = options;
  const remotes = humans.filter((slot) => slot !== local);
  /** Every input held per slot, by tick; a tick's entries are deleted once it is stepped. */
  const buffer = new Map<RacerId, Map<number, TickInput>>(humans.map((slot) => [slot, new Map()]));
  /** The last tick each slot has an input for; ticks up to `delay` need none. */
  const lastInput = new Map<RacerId, number>(humans.map((slot) => [slot, delay]));
  /** The first tick each departed slot is driven by the AI. */
  const goneFrom = new Map<RacerId, number>();
  const hashes = createHashLedger((desync) => {
    state = 'desynced';
    options.onDesync(desync);
  });
  /** The stall time at which a kick was last asked for each slot, since the last step. */
  const kickedAt = new Map<RacerId, number>();
  let pending: TickInput = IDLE_INPUT;
  let targetTick = world.tick;
  let inputTick = world.tick + delay + 1;
  let stalledMs = 0;
  let state: Session['state'] = 'running';

  const racingAt = (slot: RacerId, tick: number) => tick < (goneFrom.get(slot) ?? Number.POSITIVE_INFINITY);

  /** Each racing human's input for `tick`, or the slots still missing one. */
  function inputsFor(tick: number): { inputs: Partial<Record<RacerId, TickInput>>; missing: RacerId[] } {
    const inputs: Partial<Record<RacerId, TickInput>> = {};
    const missing: RacerId[] = [];
    for (const slot of humans) {
      if (!racingAt(slot, tick)) continue;
      const input = tick <= delay ? IDLE_INPUT : buffer.get(slot)?.get(tick);
      if (input) inputs[slot] = input;
      else missing.push(slot);
    }
    return { inputs, missing };
  }

  /** Schedules the pending input for `inputTick` and sends it; presses are cleared once scheduled. */
  function scheduleLocalInput(): void {
    const bytes = encodeInputs(inputTick, pending);
    // Kept as the others will decode it, so every peer steps from identical values.
    const sent = decode(bytes);
    if (sent?.kind !== 'inputs') throw new Error(`codec could not decode its own input for tick ${inputTick}`);
    buffer.get(local)?.set(inputTick, sent.input);
    lastInput.set(local, inputTick);
    options.send(bytes);
    pending = { ...pending, kick: false, use: false, cycle: 0 };
    inputTick++;
  }

  /** Steps the next tick if every input for it is held; returns whether it stepped. */
  function tryStep(): boolean {
    if (world.tick >= targetTick) return false;
    const tick = world.tick + 1;
    const { inputs, missing } = inputsFor(tick);
    if (missing.length > 0) return false;
    stepRace(world, inputs, TICK_DT);
    for (const slotInputs of buffer.values()) slotInputs.delete(tick);
    stalledMs = 0;
    kickedAt.clear();
    if (tick % HASH_EVERY === 0) sendHash(tick);
    return true;
  }

  function sendHash(tick: number): void {
    const hash = hashWorld(world);
    options.send(encodeHash(tick, hash));
    hashes.recordLocal(tick, hash);
  }

  function receiveInput(slot: RacerId, tick: number, input: TickInput): boolean {
    if (goneFrom.has(slot) || tick <= (lastInput.get(slot) ?? delay)) return false;
    buffer.get(slot)?.set(tick, input);
    lastInput.set(slot, tick);
    return true;
  }

  function requestKicksIfStalled(): void {
    const { kickAfterMs } = options;
    if (kickAfterMs === null || stalledMs < kickAfterMs) return;
    for (const slot of session.waitingOn) {
      const last = kickedAt.get(slot);
      if (last !== undefined && stalledMs - last < kickAfterMs) continue;
      kickedAt.set(slot, stalledMs);
      options.requestKick(slot);
    }
  }

  const session: Session = {
    pump(input, elapsedMs) {
      if (state === 'desynced' || world.race.phase === 'finished') return 0;
      pending = mergeInput(pending, input);
      if (world.tick === targetTick) targetTick++;
      if (inputTick <= targetTick + delay) scheduleLocalInput();
      if (tryStep()) return 1;
      stalledMs += elapsedMs;
      requestKicksIfStalled();
      return 0;
    },
    receive(slot, bytes) {
      const message = decode(bytes);
      if (!message || !remotes.includes(slot)) return false;
      if (message.kind === 'hash') return hashes.receiveRemote(slot, message.tick, message.hash, world.tick);
      return receiveInput(slot, message.tick, message.input);
    },
    peerLeft(slot) {
      if (!remotes.includes(slot) || goneFrom.has(slot)) return;
      goneFrom.set(slot, (lastInput.get(slot) ?? delay) + 1);
    },
    get simTick() {
      return world.tick;
    },
    get targetTick() {
      return targetTick;
    },
    get stalledMs() {
      return stalledMs;
    },
    get waitingOn() {
      return world.tick < targetTick ? inputsFor(world.tick + 1).missing : [];
    },
    get state() {
      return state;
    },
  };
  return session;
}

/** The hashes kept for comparison between this peer and the others. */
interface HashLedger {
  /** Keeps this peer's hash at `tick` and compares it with any remote hash already held for that tick. */
  recordLocal(tick: number, hash: number): void;
  /** Compares a remote hash now, or keeps it until this peer reaches `tick`; false when `tick` has passed beyond checking. */
  receiveRemote(slot: RacerId, tick: number, hash: number, simTick: number): boolean;
}

/** A ledger that calls `onMismatch` for the first hash pair that differs, and never again after. */
function createHashLedger(onMismatch: (desync: Desync) => void): HashLedger {
  const localHashes = new Map<number, number>();
  const remoteHashes = new Map<number, { slot: RacerId; hash: number }[]>();
  let mismatched = false;

  function compare(tick: number, slot: RacerId, remote: number): void {
    const local = localHashes.get(tick);
    if (mismatched || local === undefined || local === remote) return;
    mismatched = true;
    onMismatch({ tick, local, remote, slot });
  }

  function forgetBefore(oldest: number): void {
    for (const tick of localHashes.keys()) if (tick < oldest) localHashes.delete(tick);
    for (const tick of remoteHashes.keys()) if (tick < oldest) remoteHashes.delete(tick);
  }

  return {
    recordLocal(tick, hash) {
      localHashes.set(tick, hash);
      for (const remote of remoteHashes.get(tick) ?? []) compare(tick, remote.slot, remote.hash);
      remoteHashes.delete(tick);
      forgetBefore(tick - HASH_KEEP_TICKS);
    },
    receiveRemote(slot, tick, hash, simTick) {
      if (localHashes.has(tick)) {
        compare(tick, slot, hash);
        return true;
      }
      // A hash for a tick already passed and forgotten can no longer be checked.
      if (tick <= simTick) return false;
      remoteHashes.set(tick, [...(remoteHashes.get(tick) ?? []), { slot, hash }]);
      return true;
    },
  };
}

/**
 * `next` read this step merged into the input not yet scheduled: held values take the newest
 * reading, and presses are kept until scheduled, since a press must survive a pump that schedules nothing.
 */
function mergeInput(pending: TickInput, next: TickInput): TickInput {
  return {
    move: next.move,
    kickHeld: next.kickHeld ?? false,
    kick: pending.kick || next.kick,
    use: pending.use || next.use,
    cycle: next.cycle !== 0 ? next.cycle : pending.cycle,
  };
}

function requireValidOptions({ local, humans, delay }: SessionOptions): void {
  if (!humans.includes(local)) {
    throw new Error(`createSession: local slot ${local} is not one of humans [${humans.join(', ')}]`);
  }
  if (!Number.isInteger(delay) || delay < MIN_DELAY || delay > MAX_DELAY) {
    throw new Error(`createSession: delay ${delay} must be a whole number of ticks from ${MIN_DELAY} to ${MAX_DELAY}`);
  }
}
