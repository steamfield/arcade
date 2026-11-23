/**
 * The Worker's two routes: creating a room, and handing a join's WebSocket upgrade to its Room.
 * Both apply the origin rule first. The JSON answers for everything else live here too.
 */
import { isRoomCode, randomRoomCode } from './codes.ts';
import type { Env } from './index.ts';
import { allowedOrigin } from './origin.ts';
import { CLOSE, type Created } from './protocol.ts';
import { refuseSocket } from './sockets.ts';

/** Codes tried before creating a room gives up; with 31^6 codes a second collision is already unlikely. */
const CLAIM_ATTEMPTS = 5;

const CREATED = 201;
const FORBIDDEN = 403;
const NOT_FOUND = 404;
const UNAVAILABLE = 503;

/**
 * `POST /api/rooms`: claims a fresh code and answers 201 `{ code }`, 503 `{ error }` when every
 * code tried was taken, or 403 `{ error }` for a page on another site.
 */
export async function createRoom(request: Request, env: Env): Promise<Response> {
  if (!allowedOrigin(request)) return jsonResponse(FORBIDDEN, { error: 'Rooms can only be created from this site.' });
  for (let attempt = 0; attempt < CLAIM_ATTEMPTS; attempt++) {
    const code = randomRoomCode(randomByte);
    if (await env.ROOM.getByName(code).claim()) return jsonResponse(CREATED, { code } satisfies Created);
  }
  return jsonResponse(UNAVAILABLE, { error: `No free room code after ${CLAIM_ATTEMPTS} tries. Try again.` });
}

/**
 * `GET /api/rooms/<code>` with `Upgrade: websocket`: passes the upgrade to the room's Durable
 * Object. A page on another site, or a code that cannot exist, gets a socket closed with `origin`
 * or `unknownRoom` instead.
 */
export async function joinRoom(request: Request, env: Env, code: string): Promise<Response> {
  if (!allowedOrigin(request)) return refuseSocket(CLOSE.origin, 'origin');
  if (!isRoomCode(code)) return refuseSocket(CLOSE.unknownRoom, 'unknownRoom');
  return env.ROOM.getByName(code).fetch(request);
}

/** The answer for any path the service does not serve. */
export function notFound(request: Request): Response {
  return jsonResponse(NOT_FOUND, { error: `No route for ${request.method} ${new URL(request.url).pathname}.` });
}

function jsonResponse(status: number, body: object): Response {
  return Response.json(body, { status });
}

/** One byte from the runtime's cryptographic random source. */
function randomByte(): number {
  return crypto.getRandomValues(new Uint8Array(1))[0] ?? 0;
}
