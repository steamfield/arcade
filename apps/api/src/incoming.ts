/**
 * Reading what a peer sent: its size on the wire, and whether a text message is a JSON object the
 * room can relay. Pure.
 */
import { RelayedSchema } from './protocol.ts';

/** A JSON message a peer sent, as far as the room reads it. */
export type Relayed = { type: string } & Record<string, unknown>;

/** A peer's text message as a relayable JSON object, or null when it is not one. */
export function parseRelayed(text: string): Relayed | null {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    // Unparseable JSON from a peer is dropped, never an error (plan, "Error model").
    return null;
  }
  const relayed = RelayedSchema.safeParse(value);
  return relayed.success ? relayed.data : null;
}

/** The size of a message in bytes as it went over the wire. */
export function byteLength(message: string | ArrayBuffer): number {
  return typeof message === 'string' ? new TextEncoder().encode(message).byteLength : message.byteLength;
}
