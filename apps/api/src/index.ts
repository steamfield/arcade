/**
 * The arcade-api Worker: checks the origin, creates rooms, and hands a room's WebSocket upgrade to
 * its Durable Object. Wiring only; the routes are in `routes.ts` and the room's behaviour in `room.ts`.
 */
import { CREATE_ROOM_PATH } from './protocol.ts';
import { createRoom, joinRoom, notFound } from './routes.ts';

export { Room } from './room.ts';

/** What the Worker is bound to. */
export interface Env {
  ROOM: DurableObjectNamespace<import('./room.ts').Room>;
  /** Overrides `KICK_SILENCE_MS`, in milliseconds, so tests need not wait five seconds. */
  KICK_SILENCE_MS?: string;
}

/** A room's socket path: `/api/rooms/<code>`, the code captured as it was sent. */
const ROOM_SOCKET_PATH = /^\/api\/rooms\/([^/]+)$/;

/** The Worker: `POST /api/rooms`, a WebSocket upgrade on `/api/rooms/<code>`, and 404 JSON for anything else. */
export default {
  fetch(request: Request, env: Env): Promise<Response> | Response {
    const { pathname } = new URL(request.url);
    if (request.method === 'POST' && pathname === CREATE_ROOM_PATH) return createRoom(request, env);
    const code = ROOM_SOCKET_PATH.exec(pathname)?.[1];
    const upgrade = request.headers.get('Upgrade')?.toLowerCase() === 'websocket';
    if (request.method === 'GET' && upgrade && code !== undefined) return joinRoom(request, env, code);
    return notFound(request);
  },
} satisfies ExportedHandler<Env>;
