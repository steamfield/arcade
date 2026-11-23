/**
 * The real room: a `RoomConnection` over a browser WebSocket to the room service, and room creation
 * over fetch. The only file in `net/` that touches the DOM.
 */
import { CLOSE, CREATE_ROOM_PATH, CreatedSchema, PING, PONG, roomSocketPath } from '@arcade/api/protocol';
import type { CloseReason, ConnectionEvent, RoomConnection } from './types.ts';

/** How creating a room went. */
export type CreateRoomResult = { ok: true; code: string } | { ok: false };

/** Milliseconds between round-trip measurements while the socket is open. */
export const PING_EVERY_MS = 2000;

/** The reason each of the room's close codes stands for; any other code is a lost connection. */
const REASON_BY_CODE: Readonly<Record<number, CloseReason>> = {
  [CLOSE.full]: 'full',
  [CLOSE.version]: 'version',
  [CLOSE.unknownRoom]: 'unknown-room',
  [CLOSE.kicked]: 'kicked',
  [CLOSE.unavailable]: 'unavailable',
  [CLOSE.limit]: 'unavailable',
  [CLOSE.idle]: 'unavailable',
  [CLOSE.origin]: 'unavailable',
};

/**
 * Asks the room service for a new room. Resolves to `{ ok: false }` when the service is
 * unreachable, refuses or answers with anything but a code; it never rejects.
 */
export async function createRoom(): Promise<CreateRoomResult> {
  try {
    const response = await fetch(CREATE_ROOM_PATH, { method: 'POST' });
    if (!response.ok) return { ok: false };
    const created = CreatedSchema.safeParse(await response.json());
    return created.success ? { ok: true, code: created.data.code } : { ok: false };
  } catch {
    // Unreachable or an unreadable body: the caller only needs to know there is no room.
    return { ok: false };
  }
}

/** JSON text as a message, or undefined when it does not parse. */
function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/**
 * Opens a connection to room `code` for a page running simulation build `build`. Events are queued
 * in arrival order. It measures its round trip to the room every `PING_EVERY_MS` and queues each
 * measurement as a `ping` event.
 */
export function connectToRoom(code: string, build: string): RoomConnection {
  const scheme = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const socket = new WebSocket(`${scheme}//${location.host}${roomSocketPath(code, build)}`);
  socket.binaryType = 'arraybuffer';
  const queue: ConnectionEvent[] = [];
  let opened = false;
  let closedByUs = false;
  let pingSentAt: number | null = null;

  const pinger = setInterval(() => {
    if (socket.readyState !== WebSocket.OPEN) return;
    pingSentAt = performance.now();
    socket.send(PING);
  }, PING_EVERY_MS);

  // Each event is queued inside its own handler, so the queue keeps the socket's arrival order.
  socket.addEventListener('open', () => {
    opened = true;
    queue.push({ kind: 'open' });
  });
  socket.addEventListener('message', (event: MessageEvent) => {
    if (event.data instanceof ArrayBuffer) {
      const bytes = new Uint8Array(event.data);
      if (bytes.length > 0) queue.push({ kind: 'binary', from: bytes[0] ?? 0, bytes: bytes.subarray(1) });
      return;
    }
    const text = String(event.data);
    if (text === PONG) {
      if (pingSentAt !== null) queue.push({ kind: 'ping', roundTripMs: performance.now() - pingSentAt });
      pingSentAt = null;
      return;
    }
    const message = parseJson(text);
    if (message !== undefined) queue.push({ kind: 'json', message });
  });
  socket.addEventListener('close', (event: CloseEvent) => {
    clearInterval(pinger);
    if (closedByUs) return;
    const reason = opened ? (REASON_BY_CODE[event.code] ?? 'lost') : 'unavailable';
    queue.push({ kind: 'closed', reason });
  });

  return {
    send(message) {
      if (closedByUs || socket.readyState !== WebSocket.OPEN) return;
      // Copied so the socket gets a plain ArrayBuffer view, which is all `send` accepts.
      socket.send(message instanceof Uint8Array ? Uint8Array.from(message) : JSON.stringify(message));
    },
    poll: () => queue.splice(0),
    close() {
      if (closedByUs) return;
      closedByUs = true;
      clearInterval(pinger);
      socket.close();
      queue.push({ kind: 'closed', reason: 'left' });
    },
  };
}
