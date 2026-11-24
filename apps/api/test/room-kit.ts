/**
 * Test kit for the room service: starts the real Worker in-process through wrangler, creates rooms
 * over HTTP and opens real WebSockets on them. Every wait is on an event (the next message, the
 * close) with a deadline, never a sleep.
 */
import { fileURLToPath } from 'node:url';
import { unstable_startWorker } from 'wrangler';
import { type Created, CreatedSchema, PROTOCOL_VERSION, type RoomMessage, roomSocketPath } from '../src/protocol.ts';

const CONFIG_PATH = fileURLToPath(new URL('../wrangler.jsonc', import.meta.url));

/** How long a wait gives up after, well inside Vitest's own five-second test timeout. */
export const WAIT_DEADLINE_MS = 4000;

/** The build id test peers join with unless a test says otherwise. */
export const TEST_BUILD = 'test-build';

/** A running copy of the room service. */
export interface RoomService {
  /** The service's base URL, such as `http://127.0.0.1:53817`. */
  url: URL;
  /** Stops the Worker. */
  dispose(): Promise<void>;
}

/**
 * Starts the Worker from `apps/api/wrangler.jsonc` on a free port, without persistence.
 *
 * @param vars - Extra plain-text vars, such as a short `KICK_SILENCE_MS`.
 * @param entrypoint - A test Worker entry point, when the Room binding itself needs to fail.
 */
export async function startRoomService(vars: Record<string, string> = {}, entrypoint?: string): Promise<RoomService> {
  const bindings = Object.fromEntries(
    Object.entries(vars).map(([name, value]) => [name, { type: 'plain_text' as const, value }]),
  );
  const worker = await unstable_startWorker({
    config: CONFIG_PATH,
    entrypoint,
    bindings,
    dev: { server: { port: 0 }, inspector: false, logLevel: 'error', persist: false, watch: false },
  });
  return { url: await worker.url, dispose: () => worker.dispose() };
}

/** `POST /api/rooms`, as a browser on `origin` would send it (or a non-browser, without one). */
export function postCreateRoom(service: RoomService, origin?: string): Promise<Response> {
  const headers: Record<string, string> = origin === undefined ? {} : { Origin: origin };
  return fetch(new URL('/api/rooms', service.url), { method: 'POST', headers });
}

/**
 * Creates a room and returns its code.
 *
 * @throws Error when the service does not answer 201 with a code.
 */
export async function createRoom(service: RoomService): Promise<string> {
  const response = await postCreateRoom(service);
  if (response.status !== 201) throw new Error(`POST /api/rooms answered ${response.status}: ${await response.text()}`);
  const created: Created = CreatedSchema.parse(await response.json());
  return created.code;
}

/** How a test peer opens its socket. */
export interface JoinOptions {
  build?: string;
  /** The `v` query parameter; defaults to `PROTOCOL_VERSION`. */
  version?: number;
  origin?: string;
}

/** A close the test saw: the code and whether the socket had opened before it (a refused upgrade never opens). */
export interface SeenClose {
  code: number;
  reason: string;
  opened: boolean;
}

/** One end of a room socket, held by the test. */
export class TestSocket {
  #socket: WebSocket;
  #opened = false;
  #queue: (string | Uint8Array)[] = [];
  #waiter: (() => void) | null = null;
  /** Resolves when the socket closes, however it closes. */
  readonly closed: Promise<SeenClose>;

  constructor(url: URL, options: JoinOptions) {
    const headers = options.origin === undefined ? {} : { Origin: options.origin };
    // Node's WebSocket takes a second, non-standard argument with request headers.
    const init = { headers } as unknown as string[];
    this.#socket = new WebSocket(url, init);
    this.#socket.binaryType = 'arraybuffer';
    this.#socket.addEventListener('open', () => {
      this.#opened = true;
    });
    this.#socket.addEventListener('message', (event) => {
      this.#queue.push(typeof event.data === 'string' ? event.data : new Uint8Array(event.data as ArrayBuffer));
      this.#waiter?.();
    });
    this.closed = new Promise((resolve) => {
      this.#socket.addEventListener('close', (event) => {
        resolve({ code: event.code, reason: event.reason, opened: this.#opened });
        this.#waiter?.();
      });
    });
  }

  /** The next message as it arrived: text, or binary bytes. */
  nextMessage(): Promise<string | Uint8Array> {
    return this.#next();
  }

  /** The next JSON message, parsed. */
  async nextJson(): Promise<Record<string, unknown>> {
    const message = await this.#next();
    if (typeof message !== 'string') throw new Error(`Expected JSON, got binary [${[...message].join(', ')}].`);
    return JSON.parse(message) as Record<string, unknown>;
  }

  /** The next binary message's bytes. */
  async nextBinary(): Promise<number[]> {
    const message = await this.#next();
    if (typeof message === 'string') throw new Error(`Expected binary, got ${message}.`);
    return [...message];
  }

  /** Sends `message` as JSON. */
  sendJson(message: object): void {
    this.#socket.send(JSON.stringify(message));
  }

  /** Sends raw text or bytes. */
  send(message: string | Uint8Array): void {
    this.#socket.send(message);
  }

  /** Closes the socket from the peer's side and waits for the close to finish. */
  async close(): Promise<void> {
    this.#socket.close();
    await this.closed;
  }

  /** The next JSON message if one arrives within `ms`, or null when none does. */
  async nextJsonWithin(ms: number): Promise<Record<string, unknown> | null> {
    if (!(await this.#waitForMessage(ms))) return null;
    return this.nextJson();
  }

  async #next(): Promise<string | Uint8Array> {
    if (!(await this.#waitForMessage(WAIT_DEADLINE_MS))) throw new Error(`No message within ${WAIT_DEADLINE_MS} ms.`);
    const message = this.#queue.shift();
    if (message === undefined) throw new Error('Message queue emptied while reading.');
    return message;
  }

  /**
   * Waits until a message is queued or `ms` pass, and says whether one is queued.
   *
   * @throws Error when the socket closes with nothing queued.
   */
  async #waitForMessage(ms: number): Promise<boolean> {
    const deadline = Date.now() + ms;
    while (this.#queue.length === 0) {
      if (this.#socket.readyState === WebSocket.CLOSED) throw new Error('Socket closed while waiting for a message.');
      const remaining = deadline - Date.now();
      if (remaining <= 0) return false;
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, remaining);
        this.#waiter = () => {
          clearTimeout(timer);
          resolve();
        };
      });
      this.#waiter = null;
    }
    return true;
  }
}

/** Opens a socket on room `code` without waiting for anything. */
export function openSocket(service: RoomService, code: string, options: JoinOptions = {}): TestSocket {
  const path = roomSocketPath(code, options.build ?? TEST_BUILD).replace(
    `v=${PROTOCOL_VERSION}`,
    `v=${options.version ?? PROTOCOL_VERSION}`,
  );
  const url = new URL(path, service.url);
  url.protocol = 'ws:';
  return new TestSocket(url, options);
}

/** A peer that joined a room, with the `welcome` it got. */
export interface JoinedPeer {
  socket: TestSocket;
  welcome: Extract<RoomMessage, { type: 'welcome' }>;
}

/**
 * Joins room `code` and waits for `welcome`.
 *
 * @throws Error when the first message is not a `welcome`.
 */
export async function joinPeer(service: RoomService, code: string, options: JoinOptions = {}): Promise<JoinedPeer> {
  const socket = openSocket(service, code, options);
  const welcome = await socket.nextJson();
  if (welcome.type !== 'welcome') throw new Error(`Expected welcome, got ${JSON.stringify(welcome)}.`);
  return { socket, welcome: welcome as JoinedPeer['welcome'] };
}

/** How many peers a room can hold, as a type. */
export type PeerCount = 1 | 2 | 3 | 4;

/** A tuple of `N` sockets, so tests can destructure them without checking for undefined. */
export type Sockets<N extends PeerCount> = N extends 1
  ? [TestSocket]
  : N extends 2
    ? [TestSocket, TestSocket]
    : N extends 3
      ? [TestSocket, TestSocket, TestSocket]
      : [TestSocket, TestSocket, TestSocket, TestSocket];

/**
 * Joins `count` peers to a fresh room in order, and drains each earlier peer's `joined` messages,
 * so every socket starts the test with an empty queue.
 */
export async function roomWithPeers<N extends PeerCount>(service: RoomService, count: N): Promise<Sockets<N>> {
  const code = await createRoom(service);
  return joinPeers(service, code, count);
}

/** Joins `count` peers to room `code` in order and drains the `joined` messages the earlier ones get. */
export async function joinPeers<N extends PeerCount>(
  service: RoomService,
  code: string,
  count: N,
): Promise<Sockets<N>> {
  const sockets: TestSocket[] = [];
  for (let index = 0; index < count; index++) {
    const { socket } = await joinPeer(service, code);
    for (const earlier of sockets) await earlier.nextJson();
    sockets.push(socket);
  }
  return sockets as Sockets<N>;
}
