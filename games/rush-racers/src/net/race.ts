/**
 * The race half of a client: one peer's part in one race, from the host's start message to its
 * `end`. It builds the world and the lockstep session, maps peer ids to slots for what the network
 * sends, and ends the race when the world finishes or a hash differs, by a session hash check or
 * by another racer's `end`.
 */
import { hashWorld } from '../logic/hash.ts';
import { RACER_IDS, type RacerId, type TickInput, type World } from '../logic/types.ts';
import type { RaceView } from './client.ts';
import type { LobbyPeer } from './lobby.ts';
import type { EndMessage, StartMessage } from './messages.ts';
import { createSession, type Desync } from './session.ts';

/** What a race is built from. */
export interface OnlineRaceOptions {
  start: StartMessage;
  /** The slot this peer races in, taken from the start's `slots`. */
  local: RacerId;
  /** The lobby's peers when the start was handled; a racer missing from them has already left. */
  present: readonly LobbyPeer[];
  createRace(start: StartMessage, local: RacerId): World;
  /** Sends a message to the room. */
  send(message: object | Uint8Array): void;
  kickAfterMs: number | null;
}

/** One peer's part in one race. */
export interface OnlineRace {
  readonly world: World;
  readonly view: RaceView;
  /** Pumps the session once and ends the race if the world finished; returns the ticks stepped. */
  tick(input: TickInput, elapsedMs: number): number;
  /** Takes binary relayed from `peer`; false when the peer is not racing or the session refused the bytes. */
  receiveBinary(peer: number, bytes: Uint8Array): boolean;
  /** Takes another peer's `end`, comparing it with this peer's own once both are known. */
  receiveEnd(peer: number, end: EndMessage): void;
  /** The peer with this id left the room; its racer goes to the AI if it was in this race. */
  peerLeft(peer: number): void;
}

/** Where a race ended for one peer: the last tick it stepped and the world's hash there. */
type RaceEnd = Pick<EndMessage, 'tick' | 'hash'>;

/** The start's `slots` with numeric peer ids. */
function slotsByPeer(start: StartMessage): Record<number, RacerId> {
  return Object.fromEntries(Object.entries(start.slots).map(([peer, slot]) => [Number(peer), slot]));
}

/** The lobby label of each racing slot whose peer is still present. */
function labelsOf(slots: Record<number, RacerId>, present: readonly LobbyPeer[]): Partial<Record<RacerId, string>> {
  const labels: Partial<Record<RacerId, string>> = {};
  for (const peer of present) {
    const slot = slots[peer.id];
    if (slot !== undefined) labels[slot] = peer.label;
  }
  return labels;
}

/** This peer's race from `options.start`, its world built and its session ready to pump. */
export function createOnlineRace(options: OnlineRaceOptions): OnlineRace {
  const { start, local, send } = options;
  const slots = slotsByPeer(start);
  const peerOfSlot = new Map(Object.entries(slots).map(([peer, slot]) => [slot, Number(peer)]));
  const labels = labelsOf(slots, options.present);
  const world = options.createRace(start, local);
  const remoteEnds = new Map<number, RaceEnd>();
  let ownEnd: RaceEnd | null = null;
  let desync: Desync | null = null;

  /** Records the first desync, from either source; the race is over from then on. */
  function desynced(found: Desync): void {
    desync ??= found;
    sendEnd();
  }

  function compareEnd(peer: number, remote: RaceEnd): void {
    const slot = slots[peer];
    if (ownEnd === null || slot === undefined || remote.tick !== ownEnd.tick || remote.hash === ownEnd.hash) return;
    desynced({ tick: ownEnd.tick, local: ownEnd.hash, remote: remote.hash, slot });
  }

  /** Sends this peer's `end` once, then checks it against every `end` already received. */
  function sendEnd(): void {
    if (ownEnd !== null) return;
    ownEnd = { tick: world.tick, hash: hashWorld(world) };
    send({ type: 'end', ...ownEnd });
    for (const [peer, remote] of remoteEnds) compareEnd(peer, remote);
  }

  const session = createSession({
    world,
    local,
    humans: RACER_IDS.filter((slot) => peerOfSlot.has(slot)),
    delay: start.delay,
    send,
    onDesync: desynced,
    kickAfterMs: options.kickAfterMs,
    requestKick(slot) {
      const peer = peerOfSlot.get(slot);
      if (peer !== undefined) send({ type: 'kick', peer });
    },
  });

  // A racer whose `left` arrived before the start is handed to the AI from the first scheduled tick.
  const present = new Set(options.present.map((peer) => peer.id));
  for (const [peer, slot] of Object.entries(slots)) if (!present.has(Number(peer))) session.peerLeft(slot);

  return {
    world,
    get view(): RaceView {
      return {
        local,
        slots,
        labels,
        inputDelay: start.delay,
        simTick: session.simTick,
        targetTick: session.targetTick,
        stalledMs: session.stalledMs,
        waitingOn: session.waitingOn.map((slot) => labels[slot] ?? slot),
        over: ownEnd !== null,
        desync,
      };
    },
    tick(input, elapsedMs) {
      const stepped = session.pump(input, elapsedMs);
      if (world.race.result !== null) sendEnd();
      return stepped;
    },
    receiveBinary(peer, bytes) {
      const slot = slots[peer];
      return slot !== undefined && session.receive(slot, bytes);
    },
    receiveEnd(peer, end) {
      remoteEnds.set(peer, { tick: end.tick, hash: end.hash });
      compareEnd(peer, end);
    },
    peerLeft(peer) {
      const slot = slots[peer];
      if (slot !== undefined) session.peerLeft(slot);
    },
  };
}
