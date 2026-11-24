/**
 * Creating rooms and joining them: codes, the origin rule and every refusal, through the real
 * Worker and real sockets.
 */
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { CLOSE, PROTOCOL_VERSION, ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from '../src/protocol.ts';
import {
  createRoom,
  joinPeer,
  joinPeers,
  openSocket,
  postCreateRoom,
  type RoomService,
  startRoomService,
} from './room-kit.ts';

const FOREIGN_ORIGIN = 'https://elsewhere.example';
const FAILING_ROOM = fileURLToPath(new URL('./failing-room.mjs', import.meta.url));

let service: RoomService;

beforeAll(async () => {
  service = await startRoomService();
});

afterAll(async () => {
  await service.dispose();
});

test('create returns a six-character code from the alphabet', async () => {
  const response = await postCreateRoom(service);

  expect(response.status).toBe(201);
  const body = (await response.json()) as { code: string };
  expect(Object.keys(body)).toEqual(['code']);
  expect(body.code).toHaveLength(ROOM_CODE_LENGTH);
  expect([...body.code].every((character) => ROOM_CODE_ALPHABET.includes(character))).toBe(true);
});

test.each([
  ['Exceeded the free tier daily request limit for Durable Objects.', 429, { reason: 'quota' }, 4009, 'quota'],
  [
    'Durable Object is overloaded. Too many requests for the same object (limit reached).',
    503,
    {},
    CLOSE.unavailable,
    'unavailable',
  ],
])('reports a Room failure on create and join (%s)', async (message, status, body, code, reason) => {
  const failing = await startRoomService({ ROOM_FAILURE: message }, FAILING_ROOM);
  try {
    const response = await postCreateRoom(failing);
    const close = await openSocket(failing, 'ABCDEF').closed;

    expect.soft([response.status, await response.json()]).toEqual([status, { error: expect.any(String), ...body }]);
    expect(close).toEqual({ code, reason, opened: true });
  } finally {
    await failing.dispose();
  }
});

test('create from a foreign origin is 403 and a join from one is closed with origin', async () => {
  const response = await postCreateRoom(service, FOREIGN_ORIGIN);
  expect(response.status).toBe(403);
  expect(await response.json()).toEqual({ error: expect.any(String) });

  const code = await createRoom(service);
  const socket = openSocket(service, code, { origin: FOREIGN_ORIGIN });
  expect(await socket.closed).toMatchObject({ code: CLOSE.origin, opened: true });
});

test('joining an unknown code is closed with unknownRoom after a successful upgrade', async () => {
  const socket = openSocket(service, 'ZZZZZZ');

  expect(await socket.closed).toEqual({ code: CLOSE.unknownRoom, reason: 'unknownRoom', opened: true });
});

test('the first peer is host and is welcomed into the lobby', async () => {
  const code = await createRoom(service);

  const { welcome } = await joinPeer(service, code);

  expect(welcome).toEqual({ type: 'welcome', you: 1, peers: [1], host: 1, phase: 'lobby' });
});

test("the second peer's welcome lists both and the first is told it joined", async () => {
  const code = await createRoom(service);
  const first = await joinPeer(service, code);

  const second = await joinPeer(service, code);

  expect(second.welcome).toEqual({ type: 'welcome', you: 2, peers: [1, 2], host: 1, phase: 'lobby' });
  expect(await first.socket.nextJson()).toEqual({ type: 'joined', peer: 2, host: 1 });
});

test('a fifth socket is closed full', async () => {
  const code = await createRoom(service);
  await joinPeers(service, code, 4);

  const fifth = openSocket(service, code);

  expect(await fifth.closed).toMatchObject({ code: CLOSE.full, opened: true });
});

test('a different build is closed version', async () => {
  const code = await createRoom(service);
  await joinPeer(service, code, { build: 'one' });

  const other = openSocket(service, code, { build: 'two' });

  expect(await other.closed).toMatchObject({ code: CLOSE.version, opened: true });
});

test('a malformed build id is closed version', async () => {
  const code = await createRoom(service);

  const odd = openSocket(service, code, { build: 'Build With Spaces' });

  expect(await odd.closed).toMatchObject({ code: CLOSE.version, opened: true });
});

test('a wrong protocol version is closed version', async () => {
  const code = await createRoom(service);

  const old = openSocket(service, code, { version: PROTOCOL_VERSION + 1 });

  expect(await old.closed).toMatchObject({ code: CLOSE.version, opened: true });
});

test('after refused joins a valid join still succeeds and nobody hears a left for the refused sockets', async () => {
  const code = await createRoom(service);
  const [first, second, third] = await joinPeers(service, code, 3);
  const wrongBuild = openSocket(service, code, { build: 'stale' });
  expect(await wrongBuild.closed).toMatchObject({ code: CLOSE.version });

  const { welcome } = await joinPeer(service, code);
  const fifth = openSocket(service, code);
  expect(await fifth.closed).toMatchObject({ code: CLOSE.full });
  first.sendJson({ type: 'probe' });

  expect(welcome).toMatchObject({ you: 4, peers: [1, 2, 3, 4] });
  expect(await first.nextJson()).toEqual({ type: 'joined', peer: 4, host: 1 });
  for (const peer of [second, third]) {
    expect(await peer.nextJson()).toEqual({ type: 'joined', peer: 4, host: 1 });
    expect(await peer.nextJson()).toEqual({ type: 'probe', from: 1 });
  }
});
