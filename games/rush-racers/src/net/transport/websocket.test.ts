import { CLOSE } from '@arcade/api/protocol';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createRoomTransport } from './websocket.ts';

const RESET_AT = Date.parse('2026-11-25T00:00:00Z');
const CODE = 'ABCDEF';
const BUILD = 'test-build';
const sockets: BrowserSocket[] = [];

class BrowserSocket extends EventTarget {
  // The transport uses the browser's WebSocket constants and events.
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 3;
  readyState = BrowserSocket.CONNECTING;

  constructor() {
    super();
    sockets.push(this);
  }

  open() {
    this.readyState = BrowserSocket.OPEN;
    this.dispatchEvent(new Event('open'));
  }

  close(code = 1000) {
    if (this.readyState === BrowserSocket.CLOSED) return;
    this.readyState = BrowserSocket.CLOSED;
    this.dispatchEvent(new CloseEvent('close', { code }));
  }
}

beforeEach(() => {
  vi.stubGlobal('location', new URL('https://arcade.example/games/rush-racers/'));
  vi.stubGlobal('document', new EventTarget());
  vi.stubGlobal('WebSocket', BrowserSocket);
});

afterEach(() => {
  for (const socket of sockets.splice(0)) socket.close();
  vi.unstubAllGlobals();
});

it.each([
  ['API JSON', () => Response.json({ error: 'Limit reached', reason: 'quota' }, { status: 429 })],
  ['a Cloudflare error page', () => new Response('<h1>Too Many Requests</h1>', { status: 429 })],
])('reports quota on a 429 from %s', async (_source, response) => {
  vi.stubGlobal('fetch', async () => response());
  const transport = createRoomTransport(() => RESET_AT - 1);

  expect(await transport.createRoom()).toEqual({ ok: false, reason: 'quota' });
});

it('reports quota when the service upgrades and closes with CLOSE.quota', () => {
  const transport = createRoomTransport(() => RESET_AT - 1);
  const connection = transport.connectToRoom(CODE, BUILD);
  sockets[0]?.open();
  sockets[0]?.close(CLOSE.quota);

  expect(connection.poll()).toEqual([{ kind: 'open' }, { kind: 'closed', reason: 'quota' }]);
});

it.each(['create', 'join'] as const)('blocks both requests until midnight UTC after a failed %s', async (first) => {
  let now = Date.parse('2026-11-24T09:30:00Z');
  const fetchRoom = vi.fn(async () =>
    now < RESET_AT ? new Response(null, { status: 429 }) : Response.json({ code: CODE }, { status: 201 }),
  );
  vi.stubGlobal('fetch', fetchRoom);
  const transport = createRoomTransport(() => now);

  if (first === 'create') {
    expect(await transport.createRoom()).toEqual({ ok: false, reason: 'quota' });
  } else {
    const connection = transport.connectToRoom(CODE, BUILD);
    sockets[0]?.open();
    sockets[0]?.close(CLOSE.quota);
    expect(connection.poll()).toContainEqual({ kind: 'closed', reason: 'quota' });
  }

  expect(transport.quotaBlockedUntil()).toBe(RESET_AT);
  now = RESET_AT - 1;
  expect(await transport.createRoom()).toEqual({ ok: false, reason: 'quota' });
  const blocked = transport.connectToRoom(CODE, BUILD);
  expect.soft(blocked.poll()).toEqual([{ kind: 'closed', reason: 'quota' }]);
  expect.soft(blocked.poll()).toEqual([]);
  expect.soft(fetchRoom).toHaveBeenCalledTimes(first === 'create' ? 1 : 0);
  expect.soft(sockets).toHaveLength(first === 'join' ? 1 : 0);

  now = RESET_AT;
  expect(transport.quotaBlockedUntil()).toBeNull();
  expect(await transport.createRoom()).toEqual({ ok: true, code: CODE });
  transport.connectToRoom(CODE, BUILD);
  expect(fetchRoom).toHaveBeenCalledTimes(first === 'create' ? 2 : 1);
  expect(sockets).toHaveLength(first === 'join' ? 2 : 1);
});
