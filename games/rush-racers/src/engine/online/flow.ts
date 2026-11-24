/**
 * The online flow: Friends, then a room, then races in it, for one player. It owns the
 * `OnlineState` the friends and room scenes draw and the `OnlineClient` with its connection, and
 * decides which screen comes next. The runtime calls it once per logic tick on the friends, room,
 * online race and online results screens, and does what the returned `FlowNext` says. There is no
 * Phaser, DOM, clock or fetch in here: everything outside arrives through `OnlineFlowDeps`.
 */
import type { CharacterId, RacerId, TickInput, World } from '../../logic/types.ts';
import { createClient, type OnlineClient } from '../../net/client.ts';
import { IDLE_INPUT } from '../../net/codec.ts';
import type { LobbyOptions } from '../../net/lobby.ts';
import type { StartMessage } from '../../net/messages.ts';
import type { RoomConnection } from '../../net/transport/types.ts';
import type { CreateRoomResult } from '../../net/transport/websocket.ts';
import { createFriendsScreen, type FriendsAction, pressFriends, type ScreenPress } from './friends-screen.ts';
import { closedNotice, NOTICES } from './notices.ts';
import { createRoomScreen, pressRoom, type RoomAction } from './room-screen.ts';
import type { OnlineState } from './state.ts';

/** What the flow needs from the page: the network, the clipboard and a seed. `game.ts` supplies the real ones. */
export interface OnlinePorts {
  /** Opens a connection to room `code`. */
  connect(code: string): RoomConnection;
  /** Asks the room service for a new room; never rejects. */
  createRoom(): Promise<CreateRoomResult>;
  /** Puts room `code`'s link on the clipboard; resolves false when the browser refuses. */
  copyLink(code: string): Promise<boolean>;
  /** A seed for a race this peer starts as host. */
  seed(): number;
  /** Milliseconds of stall before asking the room to kick the silent racer; null never asks (test mode). */
  kickAfterMs: number | null;
}

/** Everything the flow is built from: the page's ports and what the runtime knows. */
export interface OnlineFlowDeps extends OnlinePorts {
  /** Builds this peer's world for a start; the client calls it when a race begins. */
  createRace(start: StartMessage, local: RacerId): World;
  /** The course ids a host may pick from, in menu order. */
  courses: readonly string[];
  /** This peer's pick and, should it be host, the race settings, read each time a room is opened. */
  lobby(): LobbyOptions;
  /** Reports a problem worth a warning (the client's dropped messages). */
  warn(message: string): void;
}

/** What the runtime should do after a flow tick. */
export type FlowNext =
  | { kind: 'stay' }
  | { kind: 'room' }
  /** Race `world`, following slot `local`. The client built the world and alone steps it. */
  | { kind: 'race'; world: World; local: RacerId }
  /** Back to the title; `state.notice` holds the reason, if any. */
  | { kind: 'title' };

/** What the player picked on an online results screen, if anything this tick. */
export type ResultsChoice = 'again' | 'title' | null;

/** One player's online flow. */
export interface OnlineFlow {
  /** What the friends and room scenes draw. */
  readonly state: OnlineState;
  /** The client of the room opened last, kept after it closes so its reason can be read; null before any. */
  readonly client: OnlineClient | null;
  /** True while a request to the outside (create room, copy link) has not answered. The game is not idle meanwhile. */
  readonly busy: boolean;
  /** Puts the friends screen back on its menu with no notice, dropping a closed client. */
  openFriends(): void;
  /** Connects to room `code`; the caller shows the room screen. */
  join(code: string): void;
  /** One tick on the friends screen with this tick's press. */
  friends(press: ScreenPress | null): FlowNext;
  /** One tick on the room screen with this tick's press; `elapsedMs` is the wall time the tick stands for. */
  room(press: ScreenPress | null, elapsedMs: number): FlowNext;
  /** One tick of an online race: the client handles the network and steps the world when lockstep allows. */
  race(input: TickInput, elapsedMs: number): { stepped: number; next: FlowNext };
  /** One tick on an online race's results screen. */
  results(choice: ResultsChoice, elapsedMs: number): FlowNext;
}

const STAY: FlowNext = { kind: 'stay' };
const ROOM: FlowNext = { kind: 'room' };
const TITLE: FlowNext = { kind: 'title' };

/** A flow on the friends screen, with no room open. */
export function createOnlineFlow(deps: OnlineFlowDeps): OnlineFlow {
  const state: OnlineState = {
    friends: createFriendsScreen(),
    room: createRoomScreen(),
    code: null,
    view: null,
    notice: null,
  };
  let client: OnlineClient | null = null;
  /** The world of the race the runtime was last sent to, so a new start (the client swaps its world) is noticed. */
  let raced: World | null = null;
  let creating = false;
  let created: CreateRoomResult | null = null;
  let copying = false;
  let copied: boolean | null = null;

  function join(code: string): void {
    client?.leave();
    client = createClient({
      connection: deps.connect(code),
      lobby: deps.lobby(),
      createRace: deps.createRace,
      kickAfterMs: deps.kickAfterMs,
      warn: deps.warn,
    });
    raced = null;
    state.code = code;
    state.room = createRoomScreen();
    state.notice = NOTICES.joining;
    refresh();
  }

  /** Copies the client's view into the state the scenes draw; the joining notice goes once the room welcomes this peer. */
  function refresh(): void {
    state.view = client?.view ?? null;
    if (state.notice === NOTICES.joining && state.view && state.view.status !== 'connecting') state.notice = null;
  }

  function requireClient(screen: string): OnlineClient {
    if (!client) throw new Error(`The ${screen} screen is ticking with no room open; open one with join()`);
    return client;
  }

  /**
   * Where the client's own changes send the player: the title when the connection closed, the room
   * with a notice when the race went out of sync, a race when the client is in one the runtime has
   * not been sent to yet (a start, or the next start while this peer was still on results).
   */
  function follow(current: OnlineClient): FlowNext | null {
    const view = current.view;
    if (view.status === 'closed') {
      state.notice = closedNotice(view.reason);
      return TITLE;
    }
    if (view.race?.desync) {
      current.returnToLobby();
      raced = null;
      state.notice = NOTICES.outOfSync;
      refresh();
      return ROOM;
    }
    const world = current.world;
    if (view.status === 'racing' && view.race && world && world !== raced) {
      raced = world;
      return { kind: 'race', world, local: view.race.local };
    }
    return null;
  }

  /** Ticks the client with no input, as on every screen outside a race, and follows it. */
  function drain(current: OnlineClient, elapsedMs: number): FlowNext | null {
    current.tick(IDLE_INPUT, elapsedMs);
    refresh();
    return follow(current);
  }

  function applyCreated(result: CreateRoomResult): FlowNext {
    if (!result.ok) {
      state.notice = NOTICES.unavailable;
      return STAY;
    }
    join(result.code);
    return ROOM;
  }

  function createRoom(): void {
    creating = true;
    state.notice = NOTICES.creating;
    void deps
      .createRoom()
      .catch((error: unknown) => {
        deps.warn(`online: creating a room failed: ${error instanceof Error ? error.message : String(error)}`);
        return { ok: false } as const;
      })
      .then((result) => {
        created = result;
        creating = false;
      });
  }

  function actOnFriends(action: FriendsAction): FlowNext {
    if (action.kind === 'back') return TITLE;
    if (action.kind === 'join') {
      join(action.code);
      return ROOM;
    }
    createRoom();
    return STAY;
  }

  function copyLink(code: string): void {
    copying = true;
    void deps
      .copyLink(code)
      .catch(() => false)
      .then((ok) => {
        copied = ok;
        copying = false;
      });
  }

  /** This peer's own pick, as the lobby holds it. */
  function ownCharacter(current: OnlineClient): CharacterId {
    return current.view.lobby.peers.find((peer) => peer.you)?.character ?? deps.lobby().character;
  }

  function actInRoom(current: OnlineClient, action: RoomAction): FlowNext | null {
    switch (action.kind) {
      case 'character':
        current.setCharacter(action.character);
        break;
      case 'course':
        current.setCourse(action.course);
        break;
      case 'difficulty':
        current.setDifficulty(action.difficulty);
        break;
      case 'start':
        current.start(deps.seed());
        break;
      case 'copy':
        if (state.code !== null) copyLink(state.code);
        break;
      case 'leave':
        current.leave();
        refresh();
        state.notice = null;
        return TITLE;
    }
    refresh();
    return follow(current);
  }

  return {
    state,
    get client() {
      return client;
    },
    get busy() {
      return creating || copying;
    },
    openFriends() {
      if (client && client.view.status !== 'closed') client.leave();
      client = null;
      raced = null;
      state.friends = createFriendsScreen();
      state.code = null;
      state.view = null;
      state.notice = null;
    },
    join,
    friends(press) {
      if (created) {
        const result = created;
        created = null;
        return applyCreated(result);
      }
      if (creating || press === null) return STAY;
      const action = pressFriends(state.friends, press);
      return action ? actOnFriends(action) : STAY;
    },
    room(press, elapsedMs) {
      if (copied !== null) {
        state.notice = copied ? NOTICES.copied : NOTICES.notCopied;
        copied = null;
      }
      const current = requireClient('room');
      const next = drain(current, elapsedMs);
      if (next) return next;
      if (press === null || current.view.status !== 'lobby') return STAY;
      const action = pressRoom(state.room, current.view.lobby, ownCharacter(current), deps.courses, press);
      return (action && actInRoom(current, action)) ?? STAY;
    },
    race(input, elapsedMs) {
      const current = requireClient('race');
      const stepped = current.tick(input, elapsedMs);
      refresh();
      return { stepped, next: follow(current) ?? STAY };
    },
    results(choice, elapsedMs) {
      const current = requireClient('results');
      const next = drain(current, elapsedMs);
      if (next) return next;
      if (choice === 'title') {
        current.leave();
        refresh();
        state.notice = null;
        return TITLE;
      }
      if (choice === 'again') {
        current.returnToLobby();
        raced = null;
        state.notice = null;
        refresh();
        return ROOM;
      }
      return STAY;
    },
  };
}
