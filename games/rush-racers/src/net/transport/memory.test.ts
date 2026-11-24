/**
 * The in-memory room behaves like `apps/api`'s Room for everything a client can observe, since the
 * client's tests run on it: who gets in, what is relayed to whom, kicks, closes and pings.
 */
import { describe, expect, it } from 'vitest';
import { createMemoryRoom, type MemoryRoom } from './memory.ts';
import type { ConnectionEvent, RoomConnection } from './types.ts';

const BYTES = Uint8Array.from([1, 0, 0, 0, 0, 0, 0]);

/** Connects `count` peers, delivers their greetings and clears them, so each test starts quiet. */
function joinedRoom(count: number, room: MemoryRoom = createMemoryRoom()): RoomConnection[] {
  const peers = Array.from({ length: count }, () => room.connect());
  room.deliver();
  for (const peer of peers) peer.poll();
  return peers;
}

/** Starts a race for peer ids `racing` from the host (peer 1), delivers it and clears every inbox. */
function startRace(room: MemoryRoom, peers: RoomConnection[], racing: number[]): void {
  const slots = Object.fromEntries(racing.map((id, index) => [String(id), `slot-${index}`]));
  peers[0]?.send({ type: 'start', slots });
  room.deliver();
  for (const peer of peers) peer.poll();
}

const binaryFrom = (events: ConnectionEvent[]) =>
  events.flatMap((event) => (event.kind === 'binary' ? [event.from] : []));

describe('createMemoryRoom', () => {
  it('refuses a fifth peer with full, and tells nobody', () => {
    const room = createMemoryRoom();
    const peers = joinedRoom(4, room);

    const fifth = room.connect();
    expect(fifth.poll()).toEqual([{ kind: 'closed', reason: 'full' }]);
    room.deliver();
    expect(peers.map((peer) => peer.poll())).toEqual([[], [], [], []]);
    expect(fifth.poll()).toEqual([]);
  });

  it('relays JSON as it would arrive over the wire: serialized, shape-checked, never shared', () => {
    const room = createMemoryRoom();
    const [sender, first, second] = joinedRoom(3, room);
    const sent = { type: 'note', nested: { count: 1 }, gone: undefined };

    sender?.send(sent);
    sender?.send({ nested: { count: 2 } });
    sender?.send({ type: '' });
    sender?.send({ type: 'x'.repeat(33) });
    // Its wire form has no type, so the room never sees one.
    sender?.send({ type: 'note', toJSON: () => ({ nested: { count: 3 } }) });
    sent.nested.count = 99;
    room.deliver();

    const [atFirst, atSecond] = [first?.poll() ?? [], second?.poll() ?? []];
    const expected = [{ kind: 'json', message: { type: 'note', nested: { count: 1 }, from: 1 } }];
    expect(atFirst).toEqual(expected);
    expect(atSecond).toEqual(expected);
    const messageAt = (events: ConnectionEvent[]) => (events[0]?.kind === 'json' ? events[0].message : null);
    expect(messageAt(atFirst)).not.toBe(messageAt(atSecond));
    expect(Object.keys(messageAt(atFirst) ?? {})).toEqual(['type', 'nested', 'from']);
  });

  it('relays binary only from a racer that has not ended, and only to such racers', () => {
    const room = createMemoryRoom();
    const peers = joinedRoom(3, room);
    const [host, guest, waiting] = peers as [RoomConnection, RoomConnection, RoomConnection];

    host.send(BYTES);
    room.deliver();
    expect(peers.map((peer) => binaryFrom(peer.poll()))).toEqual([[], [], []]);

    startRace(room, peers, [1, 2]);
    host.send(BYTES);
    guest.send(BYTES);
    waiting.send(BYTES);
    room.deliver();
    expect(peers.map((peer) => binaryFrom(peer.poll()))).toEqual([[2], [1], []]);

    guest.send({ type: 'end' });
    room.deliver();
    for (const peer of peers) peer.poll();
    host.send(BYTES);
    guest.send(BYTES);
    room.deliver();
    expect(peers.map((peer) => binaryFrom(peer.poll()))).toEqual([[], [], []]);
  });

  it('honours a kick only once the target has sent no binary for kickSilenceSteps', () => {
    const room = createMemoryRoom(() => 0, { kickSilenceSteps: 10 });
    const peers = joinedRoom(3, room);
    const [host, silent, third] = peers as [RoomConnection, RoomConnection, RoomConnection];
    startRace(room, peers, [1, 2, 3]);
    silent.send(BYTES);
    for (let step = 0; step < 9; step++) room.deliver();
    for (const peer of peers) peer.poll();

    host.send({ type: 'kick', peer: 2 });
    room.deliver();
    expect(peers.map((peer) => peer.poll())).toEqual([[], [], []]);

    host.send({ type: 'kick', peer: 2 });
    room.deliver();
    const left = { kind: 'json', message: { type: 'left', peer: 2, host: 1 } };
    expect([host.poll(), silent.poll(), third.poll()]).toEqual([
      [left],
      [{ kind: 'closed', reason: 'kicked' }],
      [left],
    ]);
  });

  it('delivers what was on its way before a room-side close, and nothing after a peer closes itself', () => {
    const room = createMemoryRoom(() => 2);
    const peers = joinedRoom(3, room);
    for (let step = 0; step < 2; step++) room.deliver();
    for (const peer of peers) peer.poll();
    const [sender, dropped, leaving] = peers as [RoomConnection, RoomConnection, RoomConnection];

    sender.send({ type: 'note' });
    room.drop(2, 'lost');
    leaving.close();
    expect([dropped.poll(), leaving.poll()]).toEqual([[], [{ kind: 'closed', reason: 'left' }]]);
    for (let step = 0; step < 3; step++) room.deliver();

    expect(dropped.poll()).toEqual([
      { kind: 'json', message: { type: 'note', from: 1 } },
      { kind: 'closed', reason: 'lost' },
    ]);
    expect(leaving.poll()).toEqual([]);
  });

  it('pings each member on the step after it joins and every 120 steps after', () => {
    const room = createMemoryRoom(() => 0, { roundTripMs: (peer) => peer * 10 });
    const members: RoomConnection[] = [room.connect()];
    const pings: { peer: number; step: number; roundTripMs: number }[] = [];
    for (let step = 1; step <= 250; step++) {
      if (step === 6) members.push(room.connect());
      room.deliver();
      members.forEach((member, index) => {
        for (const event of member.poll()) {
          if (event.kind === 'ping') pings.push({ peer: index + 1, step, roundTripMs: event.roundTripMs });
        }
      });
    }
    expect(pings).toEqual([
      { peer: 1, step: 1, roundTripMs: 10 },
      { peer: 2, step: 6, roundTripMs: 20 },
      { peer: 1, step: 121, roundTripMs: 10 },
      { peer: 2, step: 126, roundTripMs: 20 },
      { peer: 1, step: 241, roundTripMs: 10 },
      { peer: 2, step: 246, roundTripMs: 20 },
    ]);
  });
});
