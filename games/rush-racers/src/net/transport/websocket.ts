/**
 * The real room: a `RoomConnection` over a browser WebSocket to the room service, and room creation
 * over fetch. The only file in `net/` that touches the DOM.
 */
import type { RoomConnection } from './types.ts';

/** How creating a room went. */
export type CreateRoomResult = { ok: true; code: string } | { ok: false };

/**
 * Asks the room service for a new room. Resolves to `{ ok: false }` when the service is
 * unreachable, refuses or answers with anything but a code; it never rejects.
 */
export function createRoom(): Promise<CreateRoomResult> {
  throw new Error('not implemented');
}

/**
 * Opens a connection to room `code` for a page running simulation build `build`. Events are queued
 * in arrival order. It measures its round trip to the room every `PING_EVERY_MS` and queues each
 * measurement as a `ping` event.
 */
export function connectToRoom(_code: string, _build: string): RoomConnection {
  throw new Error('not implemented');
}
