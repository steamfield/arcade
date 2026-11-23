/**
 * Who is in a room, read from its sockets, and who may join it. Everything the room must still know
 * after hibernating lives in each socket's attachment, so the host, the phase and the peer list are
 * derived here from `ctx.getWebSockets()` on every event rather than kept in fields.
 */
import { MAX_PEER_ID, MAX_PEERS, PROTOCOL_VERSION, type RoomPhase } from './protocol.ts';

/** What the room keeps on each accepted socket; it survives hibernation. */
export interface PeerAttachment {
  /** The peer's id, its join sequence number. */
  peer: number;
  /** The build id the peer joined with; every peer in a room runs the same one. */
  build: string;
  /** Whether the peer is in the current race, set by the last `start`. */
  racing: boolean;
  /** Whether the peer has sent `end` since the last `start`. */
  ended: boolean;
  /** Whether the room already counts the peer as gone and has said so with `left`. */
  departed: boolean;
}

/** A socket the room still counts as connected, with its attachment. */
export interface Peer {
  socket: WebSocket;
  attachment: PeerAttachment;
}

/** The attachment of a socket the room accepted. */
export function attachmentOf(socket: WebSocket): PeerAttachment {
  return socket.deserializeAttachment() as PeerAttachment;
}

/** Applies `changes` to the attachment of `socket`, so they survive hibernation. */
export function updateAttachment(socket: WebSocket, changes: Partial<PeerAttachment>): void {
  socket.serializeAttachment({ ...attachmentOf(socket), ...changes });
}

/** The sockets of peers that have not departed, in join order. */
export function connectedPeers(sockets: readonly WebSocket[]): Peer[] {
  return sockets
    .map((socket) => ({ socket, attachment: attachmentOf(socket) }))
    .filter((peer) => !peer.attachment.departed)
    .sort((a, b) => a.attachment.peer - b.attachment.peer);
}

/** The host: the connected peer that joined first, or 0 when nobody is connected. */
export function hostOf(peers: readonly Peer[]): number {
  return peers[0]?.attachment.peer ?? 0;
}

/** The race phase: racing while any connected peer is in the current race and has not sent `end`. */
export function phaseOf(peers: readonly Peer[]): RoomPhase {
  return peers.some(({ attachment }) => attachment.racing && !attachment.ended) ? 'racing' : 'lobby';
}

/** The connected peer on `socket`, or undefined when that socket's peer has departed. */
export function peerOnSocket(peers: readonly Peer[], socket: WebSocket): Peer | undefined {
  return peers.find((peer) => peer.socket === socket);
}

/** What decides whether a socket may join: storage, the joiner's query parameters and who is present. */
export interface JoinRequest {
  /** Whether someone created the room with `claim`. */
  claimed: boolean;
  /** The id the joiner would get. */
  nextPeer: number;
  /** The joiner's `v` parameter, as sent. */
  version: string | null;
  /** The joiner's `build` parameter. */
  build: string;
  peers: readonly Peer[];
}

/** Why a joining socket is refused; each is the name of its `CLOSE` code. */
export type Refusal = 'unknownRoom' | 'full' | 'version' | 'unavailable';

/** Why a socket may not join, checked in the order `Refusal` lists them, or null when it may. */
export function joinRefusal(request: JoinRequest): Refusal | null {
  if (!request.claimed) return 'unknownRoom';
  if (request.peers.length >= MAX_PEERS) return 'full';
  if (request.version !== String(PROTOCOL_VERSION)) return 'version';
  if (request.peers.some(({ attachment }) => attachment.build !== request.build)) return 'version';
  if (request.nextPeer > MAX_PEER_ID) return 'unavailable';
  return null;
}
