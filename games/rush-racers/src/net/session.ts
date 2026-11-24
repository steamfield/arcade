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
import { createHashLedger, HASH_INTERVAL_TICKS, type HashLedger } from './hash-ledger.ts';

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

/** Everything a session tracks between pumps, RFC 5.3's state. `simTick` is `world.tick`. */
interface Lockstep {
  options: SessionOptions;
  /** The humans other than this peer. */
  remotes: readonly RacerId[];
  /** Every input held per slot, by tick; a tick's entries are deleted once it is stepped. */
  buffer: Map<RacerId, Map<number, TickInput>>;
  /** The last tick each slot has an input for; ticks up to `delay` need none. */
  lastInput: Map<RacerId, number>;
  /** The first tick each departed slot is driven by the AI. */
  goneFrom: Map<RacerId, number>;
  hashes: HashLedger;
  /** The stall time at which a kick was last asked for each slot, since the last step. */
  kickedAt: Map<RacerId, number>;
  /** Input read but not yet scheduled. */
  pending: TickInput;
  targetTick: number;
  /** The next tick this peer's input will be scheduled for. */
  inputTick: number;
  stalledMs: number;
  state: Session['state'];
}

/**
 * A session for `options.local` in a race among `options.humans`.
 *
 * @throws {Error} When `local` is not in `humans`, or `delay` is not a whole number from 1 to 12.
 */
export function createSession(options: SessionOptions): Session {
  requireValidOptions(options);
  const lockstep = createLockstep(options);
  const { world } = options;
  return {
    pump: (input, elapsedMs) => pump(lockstep, input, elapsedMs),
    receive: (slot, bytes) => receive(lockstep, slot, bytes),
    peerLeft: (slot) => peerLeft(lockstep, slot),
    get simTick() {
      return world.tick;
    },
    get targetTick() {
      return lockstep.targetTick;
    },
    get stalledMs() {
      return lockstep.stalledMs;
    },
    get waitingOn() {
      return waitingOn(lockstep);
    },
    get state() {
      return lockstep.state;
    },
  };
}

function createLockstep(options: SessionOptions): Lockstep {
  const { world, local, humans, delay } = options;
  const lockstep: Lockstep = {
    options,
    remotes: humans.filter((slot) => slot !== local),
    buffer: new Map(humans.map((slot) => [slot, new Map()])),
    lastInput: new Map(humans.map((slot) => [slot, delay])),
    goneFrom: new Map(),
    hashes: createHashLedger((mismatch) => {
      lockstep.state = 'desynced';
      options.onDesync(mismatch);
    }),
    kickedAt: new Map(),
    pending: IDLE_INPUT,
    targetTick: world.tick,
    inputTick: world.tick + delay + 1,
    stalledMs: 0,
    state: 'running',
  };
  return lockstep;
}

/** RFC 5.3's pump, steps 1 to 5. */
function pump(lockstep: Lockstep, input: TickInput, elapsedMs: number): number {
  const { world, delay } = lockstep.options;
  if (lockstep.state === 'desynced' || world.race.phase === 'finished') return 0;
  lockstep.pending = mergeInput(lockstep.pending, input);
  if (world.tick === lockstep.targetTick) lockstep.targetTick++;
  if (lockstep.inputTick <= lockstep.targetTick + delay) scheduleLocalInput(lockstep);
  if (tryStep(lockstep)) return 1;
  lockstep.stalledMs += elapsedMs;
  requestKicksIfStalled(lockstep);
  return 0;
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

/** Schedules the pending input for `inputTick` and sends it; presses are cleared once scheduled. */
function scheduleLocalInput(lockstep: Lockstep): void {
  const { local, send } = lockstep.options;
  const tick = lockstep.inputTick;
  const bytes = encodeInputs(tick, lockstep.pending);
  // Kept as the others will decode it, so every peer steps from identical values.
  const sent = decode(bytes);
  if (sent?.kind !== 'inputs') throw new Error(`codec could not decode its own input for tick ${tick}`);
  lockstep.buffer.get(local)?.set(tick, sent.input);
  lockstep.lastInput.set(local, tick);
  send(bytes);
  lockstep.pending = { ...lockstep.pending, kick: false, use: false, cycle: 0 };
  lockstep.inputTick++;
}

/** Each human still racing at `tick` with its input, and the slots whose input is missing. */
function inputsFor(lockstep: Lockstep, tick: number) {
  const { humans, delay } = lockstep.options;
  const inputs: Partial<Record<RacerId, TickInput>> = {};
  const missing: RacerId[] = [];
  for (const slot of humans) {
    if (tick >= (lockstep.goneFrom.get(slot) ?? Number.POSITIVE_INFINITY)) continue;
    const input = tick <= delay ? IDLE_INPUT : lockstep.buffer.get(slot)?.get(tick);
    if (input) inputs[slot] = input;
    else missing.push(slot);
  }
  return { inputs, missing };
}

/** Steps the next tick if the world is behind its clock and every input for it is held; returns whether it stepped. */
function tryStep(lockstep: Lockstep): boolean {
  const { world } = lockstep.options;
  if (world.tick >= lockstep.targetTick) return false;
  const tick = world.tick + 1;
  const { inputs, missing } = inputsFor(lockstep, tick);
  if (missing.length > 0) return false;
  stepRace(world, inputs, TICK_DT);
  for (const slotInputs of lockstep.buffer.values()) slotInputs.delete(tick);
  lockstep.stalledMs = 0;
  lockstep.kickedAt.clear();
  if (tick % HASH_INTERVAL_TICKS === 0) sendHash(lockstep, tick);
  return true;
}

function sendHash(lockstep: Lockstep, tick: number): void {
  const hash = hashWorld(lockstep.options.world);
  lockstep.options.send(encodeHash(tick, hash));
  lockstep.hashes.recordLocal(tick, hash);
}

function waitingOn(lockstep: Lockstep): RacerId[] {
  const { world } = lockstep.options;
  return world.tick < lockstep.targetTick ? inputsFor(lockstep, world.tick + 1).missing : [];
}

/** Asks for a kick of each slot waited on once the stall passes `kickAfterMs`, again every `kickAfterMs` after. */
function requestKicksIfStalled(lockstep: Lockstep): void {
  const { kickAfterMs, requestKick } = lockstep.options;
  const { stalledMs, kickedAt } = lockstep;
  if (kickAfterMs === null || stalledMs < kickAfterMs) return;
  for (const slot of waitingOn(lockstep)) {
    const last = kickedAt.get(slot);
    if (last !== undefined && stalledMs - last < kickAfterMs) continue;
    kickedAt.set(slot, stalledMs);
    requestKick(slot);
  }
}

function receive(lockstep: Lockstep, slot: RacerId, bytes: Uint8Array): boolean {
  const message = decode(bytes);
  if (!message || !lockstep.remotes.includes(slot)) return false;
  if (message.kind === 'hash') {
    return lockstep.hashes.receiveRemote(slot, message.tick, message.hash, lockstep.options.world.tick);
  }
  return receiveInput(lockstep, slot, message.tick, message.input);
}

/**
 * Holds a remote input when it is for the slot's next expected tick. The relay is ordered, so any
 * other tick is a peer's bug, and holding it would leave a gap the session would wait on forever.
 */
function receiveInput(lockstep: Lockstep, slot: RacerId, tick: number, input: TickInput): boolean {
  const { goneFrom, lastInput, buffer } = lockstep;
  const expected = (lastInput.get(slot) ?? lockstep.options.delay) + 1;
  if (goneFrom.has(slot) || tick !== expected) return false;
  buffer.get(slot)?.set(tick, input);
  lastInput.set(slot, tick);
  return true;
}

/** Hands a departed slot to the AI from the tick after its last input, never before `delay + 1`. */
function peerLeft(lockstep: Lockstep, slot: RacerId): void {
  if (!lockstep.remotes.includes(slot) || lockstep.goneFrom.has(slot)) return;
  lockstep.goneFrom.set(slot, (lockstep.lastInput.get(slot) ?? lockstep.options.delay) + 1);
}

function requireValidOptions({ local, humans, delay }: SessionOptions): void {
  if (!humans.includes(local)) {
    throw new Error(`createSession: local slot ${local} is not one of humans [${humans.join(', ')}]`);
  }
  if (!Number.isInteger(delay) || delay < MIN_DELAY || delay > MAX_DELAY) {
    throw new Error(`createSession: delay ${delay} must be a whole number of ticks from ${MIN_DELAY} to ${MAX_DELAY}`);
  }
}
