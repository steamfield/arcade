/**
 * What the net layer needs from a connection to a room. A connection is polled: whatever arrived
 * since the last `poll` is returned in arrival order, so the caller handles messages inside its own
 * logic tick and nothing calls back into it from the network.
 */

/** Why a connection ended, as the player needs to hear it. */
export type CloseReason =
  /** This peer closed it. */
  | 'left'
  /** The room holds four players already. */
  | 'full'
  /** This page's build differs from the room's; reloading fixes it. */
  | 'version'
  /** No room has this code. */
  | 'unknown-room'
  /** The room said this peer went silent during a race. */
  | 'kicked'
  /** The room service could not be reached, or refused for a reason of its own (its limits, its idle timeout, the origin rule). */
  | 'unavailable'
  /** The connection dropped. */
  | 'lost';

/** One thing that happened on a connection. */
export type ConnectionEvent =
  /** The socket is open; `welcome` follows as a `json` event. */
  | { kind: 'open' }
  /** A text message, parsed as JSON but not yet validated. */
  | { kind: 'json'; message: unknown }
  /** A relayed binary message: the sender's peer id and the bytes it sent. */
  | { kind: 'binary'; from: number; bytes: Uint8Array }
  /** A measured round trip to the room, in milliseconds. */
  | { kind: 'ping'; roundTripMs: number }
  /** The connection is over. Always the last event. */
  | { kind: 'closed'; reason: CloseReason };

/** A connection to one room. */
export interface RoomConnection {
  /** Sends a JSON message or raw bytes. Does nothing once the connection is closed. */
  send(message: object | Uint8Array): void;
  /** Everything that arrived since the last call, oldest first. */
  poll(): ConnectionEvent[];
  /** Closes the connection; `poll` then ends with a `closed` event whose reason is `left`. */
  close(): void;
}
