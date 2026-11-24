/**
 * An in-memory room for tests: any number of `RoomConnection`s that relay to each other the way
 * `apps/api`'s Room does, as far as a client can observe: welcome, joined, left and phase; at most
 * `MAX_PEERS` members; JSON serialized and shape-checked, then relayed with `from`; binary only
 * between members racing in the current race; `kick` checked against the target's silence; and
 * pings. Nothing moves until the test calls `deliver`, so a test decides exactly when each message
 * arrives. The room's clock is counted in `deliver` steps, not milliseconds.
 */
import {
  KickSchema,
  MAX_PEERS,
  RESERVED_TYPES,
  RelayedSchema,
  type RoomMessage,
  type RoomPhase,
  StartRelaySchema,
} from '@arcade/api/protocol';
import type { CloseReason, ConnectionEvent, RoomConnection } from './types.ts';

/** A room held in memory. */
export interface MemoryRoom {
  /** Connects a new peer, which is welcomed on the next `deliver`; a fifth peer gets only `closed` with `full`. */
  connect(): RoomConnection;
  /**
   * Moves the room's clock on one step and hands over every message due by then. A message sent
   * during step `n` is due at step `n + latency()`; messages to one peer always arrive in the order sent.
   */
  deliver(): void;
  /**
   * Closes the connection of the peer with this id from the room's side, as a kick or a lost network
   * would. What was already on its way to that peer still arrives, then `closed`.
   */
  drop(peer: number, reason: CloseReason): void;
  /** The room's phase, derived as the real room derives it. */
  readonly phase: RoomPhase;
}

/** How the room behaves beyond its latency. */
export interface MemoryRoomOptions {
  /** Steps a racer must have sent no binary for before a `kick` naming it is honoured. Defaults to 300 (5 s of ticks). */
  kickSilenceSteps?: number;
  /** When set, each member gets a `ping` event with this round trip on the step after it joins and every 120 steps after. */
  roundTripMs?: (peer: number) => number;
}

/** Steps between two pings to one member: two seconds of ticks. */
const PING_EVERY_STEPS = 120;
const DEFAULT_KICK_SILENCE_STEPS = 300;

interface Member {
  id: number;
  inbox: ConnectionEvent[];
  /** Messages on their way to this peer, each with the step it is due at. */
  pending: { due: number; event: ConnectionEvent }[];
  open: boolean;
  racing: boolean;
  ended: boolean;
  /** The step this member joined at. */
  joinedAt: number;
  /** The step the room last heard binary from this member, or the step its race started. */
  heardAt: number;
}

/** A member in the current race that has not sent `end`. */
const isRacing = (member: Member) => member.open && member.racing && !member.ended;

/**
 * A room in memory.
 *
 * @param latency - Steps a message takes to arrive, asked once per message; 0 delivers on the next `deliver`. Defaults to 0.
 */
export function createMemoryRoom(latency: () => number = () => 0, options: MemoryRoomOptions = {}): MemoryRoom {
  const kickSilenceSteps = options.kickSilenceSteps ?? DEFAULT_KICK_SILENCE_STEPS;
  const members: Member[] = [];
  let step = 0;
  let nextId = 1;
  let phase: RoomPhase = 'lobby';

  const connected = () => members.filter((member) => member.open);
  const host = () => connected()[0]?.id ?? 0;

  /** Queues `event` for `to`, never ahead of something already queued for it. */
  function post(to: Member, event: ConnectionEvent): void {
    const last = to.pending.at(-1)?.due ?? 0;
    to.pending.push({ due: Math.max(last, step + Math.max(0, latency())), event });
  }

  /** Queues JSON `text` for `to`, parsed afresh so no two members share an object. */
  function postJson(to: Member, text: string): void {
    post(to, { kind: 'json', message: JSON.parse(text) });
  }

  function broadcast(message: RoomMessage, except?: Member): void {
    const text = JSON.stringify(message);
    for (const member of connected()) if (member !== except) postJson(member, text);
  }

  function refreshPhase(): void {
    const next: RoomPhase = connected().some(isRacing) ? 'racing' : 'lobby';
    if (next === phase) return;
    phase = next;
    broadcast({ type: 'phase', phase });
  }

  /** Puts the members a host's `start` names in a new race; false, changing nothing, when the room refuses it. */
  function startRace(from: Member, message: unknown): boolean {
    const start = StartRelaySchema.safeParse(message);
    if (!start.success || from.id !== host() || phase !== 'lobby') return false;
    for (const member of connected()) {
      member.racing = String(member.id) in start.data.slots;
      member.ended = false;
      // A start counts as hearing every racer, so nobody is kickable the moment a race begins.
      member.heardAt = step;
    }
    return true;
  }

  /** Closes the member a `kick` names when both are racing and the target has been silent long enough. */
  function kick(from: Member, message: unknown): void {
    const request = KickSchema.safeParse(message);
    if (!request.success || phase !== 'racing' || !isRacing(from)) return;
    const target = connected().find((member) => member.id === request.data.peer);
    if (!target || !isRacing(target) || step - target.heardAt < kickSilenceSteps) return;
    closeFromRoom(target, 'kicked');
  }

  /** Relays a JSON message the way the real room reads it: serialized, shape-checked, then acted on. */
  function relayJson(from: Member, message: object): void {
    const relayed = RelayedSchema.safeParse(JSON.parse(JSON.stringify(message)));
    if (!relayed.success) return;
    const { type } = relayed.data;
    if (type === 'kick') {
      kick(from, relayed.data);
      return;
    }
    if (RESERVED_TYPES.includes(type)) return;
    if (type === 'start' && !startRace(from, relayed.data)) return;
    if (type === 'end') from.ended = true;
    const text = JSON.stringify({ ...relayed.data, from: from.id });
    for (const member of connected()) if (member !== from) postJson(member, text);
    refreshPhase();
  }

  /** Relays binary from a racer to the other racers; anyone else's binary is dropped. */
  function relayBinary(from: Member, message: Uint8Array): void {
    if (!isRacing(from)) return;
    from.heardAt = step;
    for (const member of connected()) {
      if (member !== from && isRacing(member))
        post(member, { kind: 'binary', from: from.id, bytes: Uint8Array.from(message) });
    }
  }

  /** Tells the others a member is gone. */
  function announceLeft(member: Member): void {
    broadcast({ type: 'left', peer: member.id, host: host() });
    refreshPhase();
  }

  /** The room ends a member's connection: what is already on its way still arrives, then `closed`. */
  function closeFromRoom(member: Member, reason: CloseReason): void {
    if (!member.open) return;
    member.open = false;
    const last = member.pending.at(-1);
    const closed: ConnectionEvent = { kind: 'closed', reason };
    if (last) member.pending.push({ due: last.due, event: closed });
    else member.inbox.push(closed);
    announceLeft(member);
  }

  /** The member closes its own connection: nothing more arrives for it. */
  function closeFromPeer(member: Member): void {
    if (!member.open) return;
    member.open = false;
    member.pending.length = 0;
    member.inbox.push({ kind: 'closed', reason: 'left' });
    announceLeft(member);
  }

  function join(): RoomConnection {
    const member: Member = {
      id: nextId++,
      inbox: [{ kind: 'open' }],
      pending: [],
      open: true,
      racing: false,
      ended: false,
      joinedAt: step,
      heardAt: step,
    };
    members.push(member);
    const peers = connected().map((each) => each.id);
    postJson(member, JSON.stringify({ type: 'welcome', you: member.id, peers, host: host(), phase }));
    broadcast({ type: 'joined', peer: member.id, host: host() }, member);
    return {
      send(message) {
        if (!member.open) return;
        if (message instanceof Uint8Array) relayBinary(member, message);
        else relayJson(member, message);
      },
      poll: () => member.inbox.splice(0),
      close: () => closeFromPeer(member),
    };
  }

  /** Moves everything due by now into `member`'s inbox, then its ping if one is due. */
  function deliverTo(member: Member): void {
    while (member.pending[0] && member.pending[0].due <= step) {
      const next = member.pending.shift();
      if (next) member.inbox.push(next.event);
    }
    const sinceJoin = step - member.joinedAt;
    if (options.roundTripMs && member.open && sinceJoin > 0 && (sinceJoin - 1) % PING_EVERY_STEPS === 0) {
      member.inbox.push({ kind: 'ping', roundTripMs: options.roundTripMs(member.id) });
    }
  }

  return {
    connect: () => (connected().length >= MAX_PEERS ? refusedConnection('full') : join()),
    deliver() {
      step++;
      for (const member of members) deliverTo(member);
    },
    drop(peer, reason) {
      const member = members.find((each) => each.id === peer);
      if (member) closeFromRoom(member, reason);
    },
    get phase() {
      return phase;
    },
  };
}

/** A connection the room refused: it holds only its `closed` event and sends nothing. */
function refusedConnection(reason: CloseReason): RoomConnection {
  const inbox: ConnectionEvent[] = [{ kind: 'closed', reason }];
  return {
    send() {},
    poll: () => inbox.splice(0),
    close() {},
  };
}
