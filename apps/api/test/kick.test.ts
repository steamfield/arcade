/**
 * When the room honours a `kick`: only between racers, and only once it has heard no inputs
 * (binary) from the target for the silence window. The Worker runs with a short `KICK_SILENCE_MS`.
 *
 * Nothing here sleeps. A test that needs the window to have passed kicks a silent "clock" racer
 * until the room agrees; any peer silent since the clock went silent is then past the window too.
 */
import { setTimeout } from 'node:timers/promises';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { CLOSE } from '../src/protocol.ts';
import {
  type RoomService,
  roomWithPeers,
  type SeenClose,
  startRoomService,
  type TestSocket,
  WAIT_DEADLINE_MS,
} from './room-kit.ts';

/** Short enough to keep the kick tests quick, long enough that a peer that just sent inputs is never silent. */
const TEST_SILENCE_MS = 400;

/** How often a kicker repeats its `kick` while waiting for the silence window to pass. */
const KICK_RETRY_MS = 100;

/** Bytes standing in for an `inputs` message; the room reads only that it is binary. */
const INPUTS = new Uint8Array([1, 0, 0, 0, 0, 0, 0]);

let service: RoomService;

beforeAll(async () => {
  service = await startRoomService({ KICK_SILENCE_MS: String(TEST_SILENCE_MS) });
});

afterAll(async () => {
  await service.dispose();
});

/**
 * Has `peers[0]`, the host, start a race for the peer ids in `racers`, and drains the `start` and
 * `phase` messages it causes.
 */
async function startRace(peers: readonly TestSocket[], racers: readonly number[]): Promise<void> {
  const [host, ...others] = peers;
  host?.sendJson({ type: 'start', slots: Object.fromEntries(racers.map((id) => [String(id), `r${id}`])) });
  for (const peer of others) expect(await peer.nextJson()).toMatchObject({ type: 'start' });
  for (const peer of peers) expect(await peer.nextJson()).toEqual({ type: 'phase', phase: 'racing' });
}

/** The clock trick's cast: who kicks, which silent racer is the clock, who watches, and what else happens each round. */
interface ClockRun {
  kicker: TestSocket;
  clock: number;
  witness: TestSocket;
  /** Runs after each kick of the clock, so whatever it sends reaches the room later than that kick. */
  meanwhile?: () => void;
}

/**
 * Kicks the silent racer `clock` every `KICK_RETRY_MS` until `witness` hears it leave, ignoring
 * any other JSON the witness gets. It never waits on the clock's own close, which workerd does not
 * finish for a socket that has sent nothing.
 *
 * @throws Error when the witness hears no `left` for the clock within `WAIT_DEADLINE_MS`.
 */
async function kickClockUntilGone({ kicker, clock, witness, meanwhile }: ClockRun): Promise<void> {
  const deadline = Date.now() + WAIT_DEADLINE_MS;
  while (Date.now() < deadline) {
    kicker.sendJson({ type: 'kick', peer: clock });
    meanwhile?.();
    if (await witnessHearsLeft(witness, clock, Date.now() + KICK_RETRY_MS)) return;
  }
  throw new Error(`Nobody heard peer ${clock} leave within ${WAIT_DEADLINE_MS} ms.`);
}

/**
 * Reads `witness`'s JSON until `until`, and says whether a `left` for `peer` arrived. Other JSON is
 * skipped; the round always lasts until `until`, so a chatty peer cannot speed up the kicks.
 */
async function witnessHearsLeft(witness: TestSocket, peer: number, until: number): Promise<boolean> {
  for (let remaining = until - Date.now(); remaining > 0; remaining = until - Date.now()) {
    const heard = await witness.nextJsonWithin(remaining);
    if (heard === null) return false;
    if (heard.type === 'left' && heard.peer === peer) return true;
  }
  return false;
}

/**
 * Has `kicker` send `kick` naming `peer` every `KICK_RETRY_MS` until `target` closes.
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

/**
 * Three peers racing, where peer 2 spoke once in the lobby and has sent nothing since. It speaks
 * once because workerd never finishes closing a socket that has sent nothing, and these tests
 * watch the kicked socket close.
 */
async function raceOfThreeWithSilentSecond(): Promise<[TestSocket, TestSocket, TestSocket]> {
  const [first, second, third] = await roomWithPeers(service, 3);
  second.sendJson({ type: 'lobby' });
  for (const peer of [first, third]) await peer.nextJson();
  await startRace([first, second, third], [1, 2, 3]);
  return [first, second, third];
}

test('a kick naming a racer that keeps sending inputs does nothing', async () => {
  const [first, second, , fourth] = await roomWithPeers(service, 4);
  await startRace([first, second, fourth], [1, 2, 3]);

  await kickClockUntilGone({ kicker: first, clock: 3, witness: fourth, meanwhile: () => second.send(INPUTS) });
  second.send(INPUTS);
  first.sendJson({ type: 'kick', peer: 2 });
  first.sendJson({ type: 'probe' });

  expect(await fourth.nextJson()).toEqual({ type: 'probe', from: 1 });
});

test('a kick naming a silent racer closes it kicked and the others hear left', async () => {
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

test('a kick naming a racer that never spoke after joining tells the others it left', async () => {
  const [first, second, third] = await roomWithPeers(service, 3);
  await startRace([first, second, third], [1, 2, 3]);

  await kickClockUntilGone({ kicker: first, clock: 2, witness: third });
});

test('a racer sending only JSON counts as silent and is kicked', async () => {
  const [first, second, third] = await roomWithPeers(service, 3);
  await startRace([first, second, third], [1, 2]);

  await kickClockUntilGone({
    kicker: first,
    clock: 2,
    witness: third,
    meanwhile: () => second.sendJson({ type: 'lobby' }),
  });

  expect(await second.closed).toMatchObject({ code: CLOSE.kicked });
});

test('a kick from a peer waiting in the lobby is ignored', async () => {
  const [first, second, third, fourth] = await roomWithPeers(service, 4);
  await startRace([first, second, third, fourth], [1, 2, 3]);

  await kickClockUntilGone({
    kicker: first,
    clock: 3,
    witness: fourth,
    meanwhile: () => fourth.sendJson({ type: 'kick', peer: 2 }),
  });
  fourth.sendJson({ type: 'probe' });

  expect(await first.nextJson()).toEqual({ type: 'left', peer: 3, host: 1 });
  expect(await first.nextJson()).toEqual({ type: 'probe', from: 4 });
});

test('a kick naming a peer waiting in the lobby is ignored', async () => {
  const [first, second, third, fourth] = await roomWithPeers(service, 4);
  await startRace([first, second, third, fourth], [1, 3]);

  await kickClockUntilGone({
    kicker: first,
    clock: 3,
    witness: fourth,
    meanwhile: () => first.sendJson({ type: 'kick', peer: 2 }),
  });
  first.sendJson({ type: 'probe' });

  expect(await fourth.nextJson()).toEqual({ type: 'probe', from: 1 });
});

test('a kick naming a racer that has sent end is ignored', async () => {
  const [first, second, third, fourth] = await roomWithPeers(service, 4);
  await startRace([first, second, third, fourth], [1, 2, 3]);
  second.sendJson({ type: 'end' });
  for (const peer of [first, third, fourth]) expect(await peer.nextJson()).toEqual({ type: 'end', from: 2 });

  await kickClockUntilGone({
    kicker: first,
    clock: 3,
    witness: fourth,
    meanwhile: () => first.sendJson({ type: 'kick', peer: 2 }),
  });
  first.sendJson({ type: 'probe' });

  expect(await fourth.nextJson()).toEqual({ type: 'probe', from: 1 });
});

test('a racer silent since long before the start is not kickable until the window after it', async () => {
  const [first, second, third, fourth] = await roomWithPeers(service, 4);
  await startRace([first, second, third, fourth], [1, 3]);
  await kickClockUntilGone({ kicker: first, clock: 3, witness: fourth });
  for (const peer of [first, second]) expect(await peer.nextJson()).toEqual({ type: 'left', peer: 3, host: 1 });
  first.sendJson({ type: 'end' });
  for (const peer of [second, fourth]) expect(await peer.nextJson()).toEqual({ type: 'end', from: 1 });
  for (const peer of [first, second, fourth]) expect(await peer.nextJson()).toEqual({ type: 'phase', phase: 'lobby' });

  await startRace([first, second, fourth], [1, 2]);
  first.sendJson({ type: 'kick', peer: 2 });
  first.sendJson({ type: 'probe' });

  expect(await fourth.nextJson()).toEqual({ type: 'probe', from: 1 });
});
