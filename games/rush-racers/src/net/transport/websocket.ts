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

/**
 * Ping intervals without a PONG, on a visible page, after which an open socket counts as dead. A
 * network that drops silently never fires `close`, so this is how such a connection ends.
 */
export const DEAD_AFTER_PINGS = 3;

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

/** JSON text as a message; text that does not parse is passed on as the raw string, for the client to count as malformed. */
function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/**
 * Opens a connection to room `code` for a page running simulation build `build`. Events are queued
 * in arrival order. It measures its round trip to the room every `PING_EVERY_MS` and queues each
 * measurement as a `ping` event. When no PONG has come back for `DEAD_AFTER_PINGS` intervals while
 * the page is visible, it closes the socket and queues `closed` with reason `lost`. A hidden tab is
 * not checked, since browsers throttle its timers, and the clock restarts when it shows again.
 */
export function connectToRoom(code: string, build: string): RoomConnection {
  const scheme = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const socket = new WebSocket(`${scheme}//${location.host}${roomSocketPath(code, build)}`);
  socket.binaryType = 'arraybuffer';
  const queue: ConnectionEvent[] = [];
  let opened = false;
  let closedByUs = false;
  let pingSentAt: number | null = null;
  /** When the room last showed it was there: the socket opening, a PONG, or the page showing again. */
  let heardAt = performance.now();

  const isSilent = () => !document.hidden && performance.now() - heardAt > DEAD_AFTER_PINGS * PING_EVERY_MS;
  const pinger = setInterval(() => {
    if (socket.readyState !== WebSocket.OPEN) return;
    if (isSilent()) {
      end('lost');
      return;
    }
    pingSentAt = performance.now();
    socket.send(PING);
  }, PING_EVERY_MS);
  const onVisibilityChange = () => {
    if (!document.hidden) heardAt = performance.now();
  };
  document.addEventListener('visibilitychange', onVisibilityChange);

  /** Ends the connection from this side; `closed` with `reason` is the last event queued. */
  function end(reason: CloseReason): void {
    closedByUs = true;
    clearInterval(pinger);
    document.removeEventListener('visibilitychange', onVisibilityChange);
    // Closing a socket still connecting logs a console error, so it is closed once it opens. If it
    // fails or closes before then, `open` never fires and there is nothing left to close.
    if (socket.readyState === WebSocket.CONNECTING)
      socket.addEventListener('open', () => socket.close(), { once: true });
    else socket.close();
    queue.push({ kind: 'closed', reason });
  }

  // Each event is queued inside its own handler, so the queue keeps the socket's arrival order.
  socket.addEventListener('open', () => {
    // After `close()` the queue already ends with `closed`, which must stay last.
    if (closedByUs) return;
    opened = true;
    heardAt = performance.now();
    queue.push({ kind: 'open' });
  });
  socket.addEventListener('message', (event: MessageEvent) => {
    // After we closed, the queue ends with `closed`; anything the socket still delivers is dropped.
    if (closedByUs) return;
    if (event.data instanceof ArrayBuffer) {
      const bytes = new Uint8Array(event.data);
      if (bytes.length > 0) queue.push({ kind: 'binary', from: bytes[0] ?? 0, bytes: bytes.subarray(1) });
      return;
    }
    const text = String(event.data);
    if (text === PONG) {
      heardAt = performance.now();
      if (pingSentAt !== null) queue.push({ kind: 'ping', roundTripMs: performance.now() - pingSentAt });
      pingSentAt = null;
      return;
    }
    queue.push({ kind: 'json', message: parseJson(text) });
  });
  socket.addEventListener('close', (event: CloseEvent) => {
    clearInterval(pinger);
    document.removeEventListener('visibilitychange', onVisibilityChange);
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
      if (!closedByUs) end('left');
    },
  };
}
