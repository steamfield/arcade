/**
 * The arcade-api Worker: checks the origin, creates rooms, and hands a room's WebSocket upgrade to
 * its Durable Object. Wiring only; the room's behaviour is in `room.ts`.
 */
export { Room } from './room.ts';

/** What the Worker is bound to. */
export interface Env {
  ROOM: DurableObjectNamespace<import('./room.ts').Room>;
  /** Overrides `KICK_SILENCE_MS`, in milliseconds, so tests need not wait five seconds. */
  KICK_SILENCE_MS?: string;
}

export default {
  fetch(_request: Request, _env: Env): Response {
    throw new Error('not implemented');
  },
} satisfies ExportedHandler<Env>;
