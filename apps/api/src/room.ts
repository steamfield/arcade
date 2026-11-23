/**
 * The Room Durable Object: one per room code. It relays what its peers send to each other, tells
 * them who joined and left, derives whether a race is on, and never runs the game.
 *
 * It uses the WebSocket Hibernation API, so it may be evicted between any two events. Every
 * decision is therefore made from the sockets' attachments (`peers.ts`) and storage (the claimed
 * flag and the next peer id); only heard times and rate counters live in memory (`traffic.ts`).
 */
import { DurableObject } from 'cloudflare:workers';
import { byteLength, parseRelayed, type Relayed } from './incoming.ts';
import type { Env } from './index.ts';
import { connectedPeers, hostOf, joinRefusal, type Peer, peerOnSocket, phaseOf, updateAttachment } from './peers.ts';
import {
  CLOSE,
  KickSchema,
  MAX_MESSAGE_BYTES,
  MAX_MESSAGES_PER_SECOND,
  PING,
  PONG,
  RESERVED_TYPES,
  ROOM_IDLE_MS,
  type RoomMessage,
  type RoomPhase,
  StartRelaySchema,
} from './protocol.ts';
import { refuseSocket, replyToClose, sendQuietly, upgradeResponse } from './sockets.ts';
import { kickSilenceMs, PeerTraffic } from './traffic.ts';

/** Storage key of the flag `claim` sets. */
const CLAIMED_KEY = 'claimed';
/** Storage key of the id the next accepted peer gets. */
const NEXT_PEER_KEY = 'nextPeer';
const FIRST_PEER_ID = 1;

/** Why the room closes a socket it had accepted; each is the name of its `CLOSE` code. */
type DepartureCause = 'kicked' | 'limit' | 'idle';

/** One room. See `protocol.ts` for everything it reads and sends. */
export class Room extends DurableObject<Env> {
  #traffic = new PeerTraffic();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair(PING, PONG));
  }

  /** Marks this room's code as taken. Returns false when it already was, so the Worker picks another code. */
  async claim(): Promise<boolean> {
    if (await this.ctx.storage.get<boolean>(CLAIMED_KEY)) return false;
    await this.ctx.storage.put({ [CLAIMED_KEY]: true, [NEXT_PEER_KEY]: FIRST_PEER_ID });
    await this.#postponeIdleClose();
    return true;
  }

  /** Accepts a peer's socket, or accepts and closes it with the `CLOSE` code that says why not. */
  override async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const build = url.searchParams.get('build') ?? '';
    const claimed = (await this.ctx.storage.get<boolean>(CLAIMED_KEY)) === true;
    const nextPeer = (await this.ctx.storage.get<number>(NEXT_PEER_KEY)) ?? FIRST_PEER_ID;
    const peers = this.#peers();
    const refusal = joinRefusal({ claimed, nextPeer, version: url.searchParams.get('v'), build, peers });
    if (refusal !== null) return refuseSocket(CLOSE[refusal], refusal);

    const { 0: client, 1: server } = new WebSocketPair();
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ peer: nextPeer, build, racing: false, ended: false, departed: false });
    await this.ctx.storage.put(NEXT_PEER_KEY, nextPeer + 1);
    this.#traffic.joined(nextPeer, Date.now());
    this.#greet(server, nextPeer);
    await this.#postponeIdleClose();
    return upgradeResponse(client);
  }

  /** Checks a peer's message against the limits, then relays it or acts on it. */
  override async webSocketMessage(socket: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const sender = peerOnSocket(this.#peers(), socket);
    if (sender === undefined) return;
    const { peer } = sender.attachment;
    const sentThisSecond = this.#traffic.heard(peer, Date.now());
    if (byteLength(message) > MAX_MESSAGE_BYTES || sentThisSecond > MAX_MESSAGES_PER_SECOND) {
      return this.#depart(socket, 'limit');
    }
    if (typeof message !== 'string') return this.#relayBinary(sender, message);
    const relayed = parseRelayed(message);
    if (relayed === null) return;
    if (relayed.type === 'kick') return this.#kick(relayed);
    await this.#relayJson(sender, relayed);
  }

  /** Counts a peer whose socket closed as gone, and completes the close handshake the peer began. */
  override async webSocketClose(socket: WebSocket, code: number, reason: string): Promise<void> {
    // A socket the room already counts as gone was closed by the room, or failed; it needs no reply.
    const closedByPeer = peerOnSocket(this.#peers(), socket) !== undefined;
    await this.#depart(socket);
    if (closedByPeer) replyToClose(socket, code, reason);
  }

  /** Counts a peer whose socket failed as gone. */
  override async webSocketError(socket: WebSocket): Promise<void> {
    await this.#depart(socket);
  }

  /** Closes a room nobody has joined, started or finished a race in for `ROOM_IDLE_MS`, and forgets it. */
  override async alarm(): Promise<void> {
    for (const { socket } of this.#peers()) {
      updateAttachment(socket, { departed: true });
      socket.close(CLOSE.idle, 'idle');
    }
    await this.ctx.storage.deleteAll();
  }

  /** Every peer the room still counts as connected, in join order. */
  #peers(): Peer[] {
    return connectedPeers(this.ctx.getWebSockets());
  }

  /** Sends `welcome` to the peer that just joined and `joined` to everyone else. */
  #greet(socket: WebSocket, peer: number): void {
    const peers = this.#peers();
    const host = hostOf(peers);
    const ids = peers.map(({ attachment }) => attachment.peer);
    sendQuietly(
      socket,
      JSON.stringify({ type: 'welcome', you: peer, peers: ids, host, phase: phaseOf(peers) } satisfies RoomMessage),
    );
    this.#broadcast(JSON.stringify({ type: 'joined', peer, host } satisfies RoomMessage), socket);
  }

  /** Passes binary on to every other peer with the sender's id as its first byte. */
  #relayBinary(sender: Peer, message: ArrayBuffer): void {
    const prefixed = new Uint8Array(message.byteLength + 1);
    prefixed[0] = sender.attachment.peer;
    prefixed.set(new Uint8Array(message), 1);
    this.#broadcast(prefixed, sender.socket);
  }

  /** Passes a JSON message on to every other peer with `from` added, applying `start` and `end` to the phase. */
  async #relayJson(sender: Peer, message: Relayed): Promise<void> {
    if (RESERVED_TYPES.includes(message.type)) return;
    const phaseBefore = phaseOf(this.#peers());
    if (message.type === 'start' && !(await this.#startRace(sender, message, phaseBefore))) return;
    if (message.type === 'end') updateAttachment(sender.socket, { ended: true });
    this.#broadcast(JSON.stringify({ ...message, from: sender.attachment.peer }), sender.socket);
    await this.#announcePhaseChange(phaseBefore);
  }

  /**
   * Puts the connected peers a host's `start` names in a new race. Returns false, changing nothing,
   * when the sender is not host, a race is on, or the message has no valid `slots`.
   */
  async #startRace(sender: Peer, message: Relayed, phase: RoomPhase): Promise<boolean> {
    const peers = this.#peers();
    const start = StartRelaySchema.safeParse(message);
    if (!start.success || phase !== 'lobby' || hostOf(peers) !== sender.attachment.peer) return false;
    for (const { socket, attachment } of peers) {
      updateAttachment(socket, { racing: String(attachment.peer) in start.data.slots, ended: false });
    }
    await this.#postponeIdleClose();
    return true;
  }

  /** Closes the socket a `kick` names, but only during a race and only if the room has heard nothing from it for the silence window. */
  async #kick(message: Relayed): Promise<void> {
    const kick = KickSchema.safeParse(message);
    if (!kick.success) return;
    const peers = this.#peers();
    const target = peers.find(({ attachment }) => attachment.peer === kick.data.peer);
    if (target === undefined || phaseOf(peers) !== 'racing') return;
    const silentFor = this.#traffic.silentFor(kick.data.peer, Date.now());
    if (silentFor === null || silentFor < kickSilenceMs(this.env)) return;
    await this.#depart(target.socket, 'kicked');
  }

  /**
   * Counts a socket's peer as gone, once: marks it departed, closes it when the room is the one
   * ending it, and tells the others with `left`. Close and error can both fire, after the room's own
   * close too, so a socket already departed is left alone.
   */
  async #depart(socket: WebSocket, cause?: DepartureCause): Promise<void> {
    const peers = this.#peers();
    const leaving = peerOnSocket(peers, socket);
    if (leaving === undefined) return;
    const phaseBefore = phaseOf(peers);
    updateAttachment(socket, { departed: true });
    this.#traffic.forget(leaving.attachment.peer);
    if (cause !== undefined) socket.close(CLOSE[cause], cause);
    const left: RoomMessage = { type: 'left', peer: leaving.attachment.peer, host: hostOf(this.#peers()) };
    this.#broadcast(JSON.stringify(left));
    await this.#announcePhaseChange(phaseBefore);
  }

  /** Broadcasts `phase` when the derived phase is no longer `before`; a return to the lobby restarts the idle clock. */
  async #announcePhaseChange(before: RoomPhase): Promise<void> {
    const phase = phaseOf(this.#peers());
    if (phase === before) return;
    this.#broadcast(JSON.stringify({ type: 'phase', phase } satisfies RoomMessage));
    if (phase === 'lobby') await this.#postponeIdleClose();
  }

  /** Sends `payload` to every connected peer except `except`. */
  #broadcast(payload: string | Uint8Array, except?: WebSocket): void {
    for (const { socket } of this.#peers()) {
      if (socket !== except) sendQuietly(socket, payload);
    }
  }

  /** Moves the idle alarm to `ROOM_IDLE_MS` from now. */
  async #postponeIdleClose(): Promise<void> {
    await this.ctx.storage.setAlarm(Date.now() + ROOM_IDLE_MS);
  }
}
