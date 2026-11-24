/**
 * The size and rate limits: the room closes a peer that sends a message over `MAX_MESSAGE_BYTES`
 * or floods it beyond its allowance, and lets a burst within `MESSAGE_BURST` through.
 */
import { afterAll, beforeAll, expect, test } from 'vitest';
import { CLOSE, MAX_MESSAGE_BYTES, MESSAGE_BURST } from '../src/protocol.ts';
import { type RoomService, roomWithPeers, startRoomService } from './room-kit.ts';

/** A burst a racer may send after a network stall, well inside `MESSAGE_BURST`. */
const BACKLOG_BURST = 100;

/** A flood sent all at once, far beyond `MESSAGE_BURST` plus what refills while it arrives. */
const FLOOD = 400;

let service: RoomService;

beforeAll(async () => {
  service = await startRoomService();
});

afterAll(async () => {
  await service.dispose();
});

test('a message over the size limit closes the sender limit', async () => {
  const [first, second] = await roomWithPeers(service, 2);

  first.sendJson({ type: 'lobby', padding: 'x'.repeat(2 * MAX_MESSAGE_BYTES) });

  expect(await first.closed).toMatchObject({ code: CLOSE.limit });
  expect(await second.nextJson()).toEqual({ type: 'left', peer: 1, host: 2 });
});

test('a burst of 100 messages at once is relayed and the sender stays open', async () => {
  const [first, second] = await roomWithPeers(service, 2);

  for (let sent = 0; sent < BACKLOG_BURST; sent++) first.sendJson({ type: 'backlog', sent });

  for (let relayed = 0; relayed < BACKLOG_BURST; relayed++) {
    expect(await second.nextJson()).toEqual({ type: 'backlog', sent: relayed, from: 1 });
  }
  second.sendJson({ type: 'probe' });
  expect(await first.nextJson()).toEqual({ type: 'probe', from: 2 });
});

test('a flood of 400 messages at once closes the sender limit', async () => {
  const [first, second] = await roomWithPeers(service, 2);

  for (let sent = 0; sent < FLOOD; sent++) first.sendJson({ type: 'flood', sent });

  expect(await first.closed).toMatchObject({ code: CLOSE.limit });
  let relayed = 0;
  let message = await second.nextJson();
  while (message.type === 'flood') {
    expect(message).toEqual({ type: 'flood', sent: relayed, from: 1 });
    relayed++;
    message = await second.nextJson();
  }
  expect(message).toEqual({ type: 'left', peer: 1, host: 2 });
  expect(relayed).toBeGreaterThanOrEqual(MESSAGE_BURST);
  expect(relayed).toBeLessThan(FLOOD);
});
