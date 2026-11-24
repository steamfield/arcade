/**
 * WebSocket helpers shared by the Worker and the Room: the upgrade response, refusing a socket the
 * way browsers accept, answering a peer's close, and sending to one socket of many without letting
 * it stop the rest.
 */
import type { CloseCode } from './protocol.ts';

/** HTTP status of a successful WebSocket upgrade. */
const SWITCHING_PROTOCOLS = 101;

/** Close codes a socket may send: 1000, and the range set aside for libraries and applications. */
const NORMAL_CLOSURE = 1000;
const FIRST_APPLICATION_CLOSE = 3000;
const LAST_APPLICATION_CLOSE = 4999;

/** The response that completes a WebSocket upgrade, handing `client` to the peer. */
export function upgradeResponse(client: WebSocket): Response {
  return new Response(null, { status: SWITCHING_PROTOCOLS, webSocket: client });
}

/**
 * The upgrade response for a socket the service will not take. It accepts the socket outside the
 * hibernation API and closes it with `code` at once, because a 4xx on the upgrade shows up in the
 * browser as a console error. Outside the hibernation API the socket never appears in
 * `ctx.getWebSockets()`, so a refused socket never produces a `left`.
 */
export function refuseSocket(code: CloseCode, reason: string): Response {
  const { 0: client, 1: server } = new WebSocketPair();
  server.accept();
  server.close(code, reason);
  return upgradeResponse(client);
}

/** Sends `payload` to `socket`, reporting rather than throwing when the socket can no longer take it. */
export function sendQuietly(socket: WebSocket, payload: string | ArrayBuffer | Uint8Array): void {
  try {
    socket.send(payload);
  } catch (error) {
    // A socket that is closing throws here. The caller is relaying one message to several peers,
    // and one closing peer must not stop the others getting it; its close event follows anyway.
    console.warn('room: send to a closing socket failed', error);
  }
}

/**
 * Answers the close frame a peer began with the same code and reason, or with no code when the
 * peer's code may not be sent (1005, 1006 and the other reserved ones). Only a socket still
 * `CLOSING` is answered; one the room closed itself is already `CLOSED` by the time its close event
 * arrives.
 *
 * The config's compatibility date turns on `web_socket_auto_reply_to_close`, so the deployed
 * runtime may answer by itself. Under local workerd (wrangler 4.166.0) it does not, even with the
 * flag named explicitly: the socket is `CLOSING` in `webSocketClose`, and without this reply the
 * peer's close never completes.
 */
export function replyToClose(socket: WebSocket, code: number, reason: string): void {
  if (socket.readyState !== WebSocket.CLOSING) return;
  const sendable = code === NORMAL_CLOSURE || (code >= FIRST_APPLICATION_CLOSE && code <= LAST_APPLICATION_CLOSE);
  if (sendable) closeQuietly(socket, code, reason);
  else closeQuietly(socket);
}

/**
 * Closes `socket`, logging rather than throwing when it cannot be closed, so closing one socket
 * never stops the caller's work on the others or on storage.
 */
export function closeQuietly(socket: WebSocket, code?: number, reason?: string): void {
  try {
    socket.close(code, reason);
  } catch (error) {
    // A socket that is already closed, or that the runtime has answered for, throws here.
    console.warn(`room: closing a socket with ${code ?? 'no code'} failed`, error);
  }
}
