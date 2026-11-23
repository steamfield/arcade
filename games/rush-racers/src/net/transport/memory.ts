/**
 * An in-memory room for tests: any number of `RoomConnection`s that relay to each other the way
 * `apps/api`'s Room does (welcome, joined, left, phase, `from` on JSON, the sender's id in front of
 * binary), with a scripted delay. Nothing moves until the test calls `deliver`, so a test decides
 * exactly when each message arrives.
 */
import { RESERVED_TYPES, type RoomMessage, type RoomPhase, StartRelaySchema } from '@arcade/api/protocol';
import type { CloseReason, ConnectionEvent, RoomConnection } from './types.ts';

/** A room held in memory. */
export interface MemoryRoom {
  /** Connects a new peer, which is welcomed on the next `deliver`. */
  connect(): RoomConnection;
  /**
   * Moves the room's clock on one step and hands over every message due by then. A message sent
   * during step `n` is due at step `n + latency()`; messages to one peer always arrive in the order sent.
   */
  deliver(): void;
  /** Closes the connection of the peer with this id from the room's side, as a kick or a lost network would. */
  drop(peer: number, reason: CloseReason): void;
  /** The room's phase, derived as the real room derives it. */
  readonly phase: RoomPhase;
}

interface Member {
  id: number;
  inbox: ConnectionEvent[];
  /** Messages on their way to this peer, each with the step it is due at. */
  pending: { due: number; event: ConnectionEvent }[];
  open: boolean;
  racing: boolean;
  ended: boolean;
}

/**
 * A room in memory.
 *
 * @param latency - Steps a message takes to arrive, asked once per message; 0 delivers on the next `deliver`. Defaults to 0.
 */
export function createMemoryRoom(latency: () => number = () => 0): MemoryRoom {
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

  function broadcast(message: RoomMessage, except?: Member): void {
    for (const member of connected()) if (member !== except) post(member, { kind: 'json', message });
  }

  function refreshPhase(): void {
    const next: RoomPhase = connected().some((member) => member.racing && !member.ended) ? 'racing' : 'lobby';
    if (next === phase) return;
    phase = next;
    broadcast({ type: 'phase', phase });
  }

  function relayJson(from: Member, message: object): void {
    const type = (message as { type?: unknown }).type;
    if (typeof type !== 'string') return;
    if (type === 'kick' || RESERVED_TYPES.includes(type)) return;
    if (type === 'start') {
      const start = StartRelaySchema.safeParse(message);
      if (!start.success || from.id !== host() || phase !== 'lobby') return;
      for (const member of connected()) {
        member.racing = String(member.id) in start.data.slots;
        member.ended = false;
      }
    }
    if (type === 'end') from.ended = true;
    for (const member of connected()) {
      if (member !== from) post(member, { kind: 'json', message: { ...message, from: from.id } });
    }
    refreshPhase();
  }

  function remove(member: Member, reason: CloseReason): void {
    if (!member.open) return;
    member.open = false;
    member.pending.length = 0;
    member.inbox.push({ kind: 'closed', reason });
    broadcast({ type: 'left', peer: member.id, host: host() });
    refreshPhase();
  }

  return {
    connect() {
      const member: Member = { id: nextId++, inbox: [], pending: [], open: true, racing: false, ended: false };
      members.push(member);
      member.inbox.push({ kind: 'open' });
      const peers = connected().map((each) => each.id);
      post(member, { kind: 'json', message: { type: 'welcome', you: member.id, peers, host: host(), phase } });
      broadcast({ type: 'joined', peer: member.id, host: host() }, member);
      return {
        send(message) {
          if (!member.open) return;
          if (!(message instanceof Uint8Array)) return relayJson(member, message);
          const bytes = Uint8Array.from(message);
          for (const other of connected()) {
            if (other !== member) post(other, { kind: 'binary', from: member.id, bytes });
          }
        },
        poll: () => member.inbox.splice(0),
        close: () => remove(member, 'left'),
      };
    },
    deliver() {
      step++;
      for (const member of members) {
        while (member.pending[0] && member.pending[0].due <= step) {
          const next = member.pending.shift();
          if (next) member.inbox.push(next.event);
        }
      }
    },
    drop(peer, reason) {
      const member = members.find((each) => each.id === peer);
      if (member) remove(member, reason);
    },
    get phase() {
      return phase;
    },
  };
}
