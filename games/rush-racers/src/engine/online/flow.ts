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
import { createPending } from './pending.ts';
import { roomLinkParam } from './room-link.ts';
import { createRoomScreen, pressRoom, type RoomAction } from './room-screen.ts';
import type { OnlineState } from './state.ts';

/** What the flow needs from the page: the network, the clipboard and a seed. `page-ports.ts` supplies the real ones. */
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
  /** Reports a problem worth a warning (a bad `?room=`, a failed request, the client's dropped messages). */
  warn(message: string): void;
}

/** What the runtime should do after a flow tick. */
export type FlowNext =
  | { kind: 'stay' }
  | { kind: 'room' }
  /**
   * Race `world`, following slot `local`. The client built the world and alone steps it; it already
   * stepped `stepped` ticks (0 or 1) in the tick that started it, whose per-step work is the runtime's.
   */
  | { kind: 'race'; world: World; local: RacerId; stepped: number }
  /** Back to the title; `state.notice` holds the reason, if any. */
  | { kind: 'title' };

/** What the player picked on an online results screen, if anything this tick. */
export type ResultsChoice = 'again' | 'title' | null;

/** One player's online flow. */
export interface OnlineFlow {
  /** What the friends and room scenes draw. */
  readonly state: OnlineState;
  /** The client of the room in use (closed, once its connection ends, until released); null outside online play. */
  readonly client: OnlineClient | null;
  /** True while a request to the outside (create room, copy link) has not answered. The game is not idle meanwhile. */
  readonly busy: boolean;
  /** Puts the friends screen back on its menu with no notice, leaving any room. */
  openFriends(): void;
  /** Connects to room `code`; the caller shows the room screen. */
  join(code: string): void;
  /**
   * Joins the room `search` (a `location.search`) names with `?room=`, and returns true; false when
   * it names none. A `?room=` that is not a room code is warned about and ignored.
   */
  openLink(search: string): boolean;
  /** Leaves online play: closes the room and forgets it and any request, keeping only the notice. */
  release(): void;
  /** One tick on the friends screen with this tick's press. */
  friends(press: ScreenPress | null): FlowNext;
  /** One tick on the room screen with this tick's press; `elapsedMs` is the wall time the tick stands for. */
  room(press: ScreenPress | null, elapsedMs: number): FlowNext;
  /**
   * One tick of an online race: the client handles the network and steps the world when lockstep
   * allows. `stepped` is for the race in hand; when `next` is another race, its count is in `next`.
   */
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
  const creation = createPending<CreateRoomResult>();
  /** A copy belongs to the room it was asked in: leaving that room cancels it, so its answer never shows in another. */
  const copy = createPending<boolean>();

  /** Closes the room in use, if any, and forgets it with its race and any copy still on its way. */
  function dropClient(): void {
    if (client && client.view.status !== 'closed') client.leave();
    client = null;
    raced = null;
    copy.cancel();
    state.code = null;
    state.view = null;
  }

  function join(code: string): void {
    dropClient();
    creation.cancel();
    client = createClient({
      connection: deps.connect(code),
      lobby: deps.lobby(),
      createRace: deps.createRace,
      kickAfterMs: deps.kickAfterMs,
      warn: deps.warn,
    });
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
   * not been sent to yet (a start, or the next start while this peer was still on results). `stepped`
   * is what the client's tick just stepped, which for a new race is that race's first step.
   */
  function follow(current: OnlineClient, stepped: number): FlowNext | null {
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
      return { kind: 'race', world, local: view.race.local, stepped };
    }
    return null;
  }

  /** Ticks the client with no input, as on every screen outside a race, and follows it. */
  function drain(current: OnlineClient, elapsedMs: number): FlowNext | null {
    const stepped = current.tick(IDLE_INPUT, elapsedMs);
    refresh();
    return follow(current, stepped);
  }

  /** Leaves the room on purpose, for the title, with no notice. */
  function leave(current: OnlineClient): FlowNext {
    current.leave();
    refresh();
    state.notice = null;
    return TITLE;
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
    state.notice = NOTICES.creating;
    creation.start(
      () => deps.createRoom(),
      (error) => {
        deps.warn(`online: creating a room failed: ${error instanceof Error ? error.message : String(error)}`);
        return { ok: false };
      },
    );
  }

  function actOnFriends(action: FriendsAction): FlowNext {
    if (action.kind === 'back') {
      creation.cancel();
      state.notice = null;
      return TITLE;
    }
    if (action.kind === 'join') {
      join(action.code);
      return ROOM;
    }
    createRoom();
    return STAY;
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
      case 'copy': {
        const code = state.code;
        if (code !== null)
          copy.start(
            () => deps.copyLink(code),
            () => false,
          );
        break;
      }
      case 'leave':
        return leave(current);
    }
    refresh();
    // A start steps the new world at the next tick, so it has not stepped yet.
    return follow(current, 0);
  }

  return {
    state,
    get client() {
      return client;
    },
    get busy() {
      return creation.waiting || copy.waiting;
    },
    openFriends() {
      dropClient();
      creation.cancel();
      state.friends = createFriendsScreen();
      state.notice = null;
    },
    join,
    openLink(search) {
      const param = roomLinkParam(search);
      if (param.kind === 'invalid') deps.warn(`?room=${param.value} is not a room code, so no room was joined`);
      if (param.kind !== 'room') return false;
      join(param.code);
      return true;
    },
    release() {
      dropClient();
      creation.cancel();
    },
    friends(press) {
      const created = creation.take();
      if (created) return applyCreated(created.value);
      // While a room is being created the menu holds still; only B (Back) acts, and abandons it.
      if (creation.waiting) return press === 'dash' ? actOnFriends({ kind: 'back' }) : STAY;
      if (press === null) return STAY;
      const action = pressFriends(state.friends, press);
      return action ? actOnFriends(action) : STAY;
    },
    room(press, elapsedMs) {
      const copied = copy.take();
      if (copied) state.notice = copied.value ? NOTICES.copied : NOTICES.notCopied;
      const current = requireClient('room');
      const next = drain(current, elapsedMs);
      if (next) return next;
      // Before the room has welcomed this peer, B still gets it out.
      if (current.view.status === 'connecting' && press === 'dash') return leave(current);
      if (press === null || current.view.status !== 'lobby') return STAY;
      const action = pressRoom(state.room, current.view.lobby, ownCharacter(current), deps.courses, press);
      return (action && actInRoom(current, action)) ?? STAY;
    },
    race(input, elapsedMs) {
      const current = requireClient('race');
      const stepped = current.tick(input, elapsedMs);
      refresh();
      return { stepped, next: follow(current, stepped) ?? STAY };
    },
    results(choice, elapsedMs) {
      const current = requireClient('results');
      const next = drain(current, elapsedMs);
      if (next) return next;
      if (choice === 'title') return leave(current);
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
