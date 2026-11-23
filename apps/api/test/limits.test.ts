/**
 * How the room ends a peer's connection itself: a `kick` it agrees with, and the size and rate
 * limits. The Worker runs with a short `KICK_SILENCE_MS` so a silent peer is kickable in well
 * under a second; the silent-kick cases resend `kick` until the close arrives instead of sleeping.
 */
import { setTimeout } from 'node:timers/promises';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { CLOSE, MAX_MESSAGE_BYTES, MAX_MESSAGES_PER_SECOND } from '../src/protocol.ts';
import {
  type RoomService,
  roomWithPeers,
  type SeenClose,
  startRoomService,
  type TestSocket,
  WAIT_DEADLINE_MS,
} from './room-kit.ts';

/** Short enough to keep the kick tests quick, long enough that a peer that just spoke is never silent. */
const TEST_SILENCE_MS = 400;

/** How often the kicker repeats its `kick` while waiting for the silence window to pass. */
const KICK_RETRY_MS = 100;

let service: RoomService;

beforeAll(async () => {
  service = await startRoomService({ KICK_SILENCE_MS: String(TEST_SILENCE_MS) });
});

afterAll(async () => {
  await service.dispose();
});

/** Starts a race between peers 1 and 2 and drains the `start` and `phase` messages it causes. */
async function startRace(host: TestSocket, other: TestSocket): Promise<void> {
  host.sendJson({ type: 'start', slots: { 1: 'r0', 2: 'r1' } });
  await other.nextJson();
  await other.nextJson();
  await host.nextJson();
}

/**
 * Three peers racing, where peer 2 spoke once in the lobby and has been silent since. It speaks
 * once because workerd never finishes closing a socket that has not sent anything, so the test
 * could not see the kick's close.
 */
async function raceOfThreeWithSilentSecond(): Promise<[TestSocket, TestSocket, TestSocket]> {
  const [first, second, third] = await roomWithPeers(service, 3);
  second.sendJson({ type: 'lobby' });
  for (const peer of [first, third]) await peer.nextJson();
  first.sendJson({ type: 'start', slots: { 1: 'r0', 2: 'r1', 3: 'r2' } });
  for (const peer of [second, third]) await peer.nextJson();
  for (const peer of [first, second, third]) await peer.nextJson();
  return [first, second, third];
}

/**
 * Has `kicker` send `kick` naming `peer` every `KICK_RETRY_MS` until `target` closes. Spacing the
 * kicks keeps the kicker well under the rate limit while it waits out the silence window.
 *
 * @throws Error when the target is still open after `WAIT_DEADLINE_MS`.
 */
async function kickUntilClosed(kicker: TestSocket, peer: number, target: TestSocket): Promise<SeenClose> {
  const deadline = Date.now() + WAIT_DEADLINE_MS;
  while (Date.now() < deadline) {
    kicker.sendJson({ type: 'kick', peer });
    const close = await Promise.race([target.closed, setTimeout(KICK_RETRY_MS, null)]);
    if (close !== null) return close;
  }
  throw new Error(`Peer ${peer} was not kicked within ${WAIT_DEADLINE_MS} ms.`);
}

test('a kick naming a peer that just spoke does nothing', async () => {
  const [first, second] = await roomWithPeers(service, 2);
  await startRace(first, second);

  second.sendJson({ type: 'lobby' });
  expect(await first.nextJson()).toEqual({ type: 'lobby', from: 2 });
  first.sendJson({ type: 'kick', peer: 2 });
  first.sendJson({ type: 'probe' });

  expect(await second.nextJson()).toEqual({ type: 'probe', from: 1 });
});

test('a kick naming a silent peer closes it kicked and the others hear left', async () => {
  const [first, second, third] = await raceOfThreeWithSilentSecond();

  const close = await kickUntilClosed(first, 2, second);

  expect(close).toMatchObject({ code: CLOSE.kicked });
  expect(await third.nextJson()).toEqual({ type: 'left', peer: 2, host: 1 });
});

test('a kicked peer produces exactly one left', async () => {
  const [first, second, third] = await raceOfThreeWithSilentSecond();

  await kickUntilClosed(first, 2, second);
  first.sendJson({ type: 'probe' });

  expect(await third.nextJson()).toEqual({ type: 'left', peer: 2, host: 1 });
  expect(await third.nextJson()).toEqual({ type: 'probe', from: 1 });
});

test('a message over the size limit closes the sender limit', async () => {
  const [first, second] = await roomWithPeers(service, 2);

  first.sendJson({ type: 'lobby', padding: 'x'.repeat(2 * MAX_MESSAGE_BYTES) });

  expect(await first.closed).toMatchObject({ code: CLOSE.limit });
  expect(await second.nextJson()).toEqual({ type: 'left', peer: 1, host: 2 });
});

test('more messages in a second than the rate limit closes the sender limit', async () => {
  const [first, second] = await roomWithPeers(service, 2);

  for (let sent = 0; sent <= MAX_MESSAGES_PER_SECOND; sent++) first.send(new Uint8Array([1, sent]));

  expect(await first.closed).toMatchObject({ code: CLOSE.limit });
  for (let relayed = 0; relayed < MAX_MESSAGES_PER_SECOND; relayed++) {
    expect(await second.nextBinary()).toEqual([1, 1, relayed]);
  }
  expect(await second.nextJson()).toEqual({ type: 'left', peer: 1, host: 2 });
});
