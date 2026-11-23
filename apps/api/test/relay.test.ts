/**
 * What the room passes between peers, and how `start`, `end` and departures move its phase and
 * host, through the real Worker and real sockets.
 */
import { afterAll, beforeAll, expect, test } from 'vitest';
import { PING, PONG } from '../src/protocol.ts';
import { createRoom, joinPeer, joinPeers, type RoomService, roomWithPeers, startRoomService } from './room-kit.ts';

let service: RoomService;

beforeAll(async () => {
  service = await startRoomService();
});

afterAll(async () => {
  await service.dispose();
});

/** A `start` naming these peer ids as racers, with the payload the room does not read. */
function startFor(...peers: number[]) {
  return { type: 'start', seed: 7, slots: Object.fromEntries(peers.map((peer, index) => [String(peer), `r${index}`])) };
}

test('JSON is relayed with from and not echoed to the sender', async () => {
  const [first, second] = await roomWithPeers(service, 2);

  first.sendJson({ type: 'lobby', pick: 'fox', from: 99 });
  expect(await second.nextJson()).toEqual({ type: 'lobby', pick: 'fox', from: 1 });
  second.sendJson({ type: 'probe' });

  expect(await first.nextJson()).toEqual({ type: 'probe', from: 2 });
});

test("binary is relayed with the sender's id in front", async () => {
  const [first, second, third] = await roomWithPeers(service, 3);

  third.send(new Uint8Array([1, 9, 0, 0, 0, 4, 2]));

  expect(await first.nextBinary()).toEqual([3, 1, 9, 0, 0, 0, 4, 2]);
  expect(await second.nextBinary()).toEqual([3, 1, 9, 0, 0, 0, 4, 2]);
});

test('start from a peer that is not host is not relayed', async () => {
  const [first, second] = await roomWithPeers(service, 2);

  second.sendJson(startFor(1, 2));
  second.sendJson({ type: 'probe' });

  expect(await first.nextJson()).toEqual({ type: 'probe', from: 2 });
});

test('start from the host is relayed and phase racing follows', async () => {
  const [first, second] = await roomWithPeers(service, 2);

  first.sendJson(startFor(1, 2));

  expect(await second.nextJson()).toEqual({ ...startFor(1, 2), from: 1 });
  expect(await second.nextJson()).toEqual({ type: 'phase', phase: 'racing' });
  expect(await first.nextJson()).toEqual({ type: 'phase', phase: 'racing' });
});

test('a peer joining during a race is welcomed with phase racing', async () => {
  const code = await createRoom(service);
  const [first, second] = await joinPeers(service, code, 2);
  first.sendJson(startFor(1, 2));
  await second.nextJson();
  await second.nextJson();

  const third = await joinPeer(service, code);

  expect(third.welcome).toEqual({ type: 'welcome', you: 3, peers: [1, 2, 3], host: 1, phase: 'racing' });
});

test('end from every racer returns the phase to lobby', async () => {
  const [first, second] = await roomWithPeers(service, 2);
  first.sendJson(startFor(1, 2));
  await second.nextJson();
  await second.nextJson();
  await first.nextJson();

  first.sendJson({ type: 'end', tick: 900 });
  expect(await second.nextJson()).toEqual({ type: 'end', tick: 900, from: 1 });
  second.sendJson({ type: 'end', tick: 900 });

  expect(await first.nextJson()).toEqual({ type: 'end', tick: 900, from: 2 });
  expect(await first.nextJson()).toEqual({ type: 'phase', phase: 'lobby' });
  expect(await second.nextJson()).toEqual({ type: 'phase', phase: 'lobby' });
});

test('the last racer leaving without end returns the phase to lobby', async () => {
  const code = await createRoom(service);
  const [first, second, third] = await joinPeers(service, code, 3);
  first.sendJson(startFor(1, 2));
  for (const peer of [second, third]) await peer.nextJson();
  for (const peer of [first, second, third]) await peer.nextJson();
  first.sendJson({ type: 'end' });
  for (const peer of [second, third]) await peer.nextJson();

  await second.close();

  expect(await third.nextJson()).toEqual({ type: 'left', peer: 2, host: 1 });
  expect(await third.nextJson()).toEqual({ type: 'phase', phase: 'lobby' });
});

test('a leaving host produces one left and the next lowest peer becomes host', async () => {
  const [first, second, third] = await roomWithPeers(service, 3);

  await first.close();
  expect(await second.nextJson()).toEqual({ type: 'left', peer: 1, host: 2 });
  expect(await third.nextJson()).toEqual({ type: 'left', peer: 1, host: 2 });
  second.sendJson({ type: 'probe' });

  expect(await third.nextJson()).toEqual({ type: 'probe', from: 2 });
});

test('PING is answered with PONG', async () => {
  const [first] = await roomWithPeers(service, 1);

  first.send(PING);

  expect(await first.nextMessage()).toBe(PONG);
});

test('a peer sending left or phase reaches nobody', async () => {
  const [first, second] = await roomWithPeers(service, 2);

  second.sendJson({ type: 'left', peer: 1, host: 2 });
  second.sendJson({ type: 'phase', phase: 'racing' });
  second.sendJson({ type: 'probe' });

  expect(await first.nextJson()).toEqual({ type: 'probe', from: 2 });
});

test('a start leaving out a connected peer returns to lobby once the named peers have sent end', async () => {
  const [first, second, third] = await roomWithPeers(service, 3);
  first.sendJson(startFor(1, 2));
  for (const peer of [second, third]) await peer.nextJson();
  for (const peer of [first, second, third]) expect(await peer.nextJson()).toEqual({ type: 'phase', phase: 'racing' });

  first.sendJson({ type: 'end' });
  expect(await third.nextJson()).toEqual({ type: 'end', from: 1 });
  second.sendJson({ type: 'end' });

  expect(await third.nextJson()).toEqual({ type: 'end', from: 2 });
  expect(await third.nextJson()).toEqual({ type: 'phase', phase: 'lobby' });
});

test('a start without slots is not relayed', async () => {
  const [first, second] = await roomWithPeers(service, 2);

  first.sendJson({ type: 'start', seed: 7 });
  first.sendJson({ type: 'probe' });

  expect(await second.nextJson()).toEqual({ type: 'probe', from: 1 });
});
