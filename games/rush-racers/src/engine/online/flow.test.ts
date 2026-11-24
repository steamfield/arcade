/**
 * The online flow driven the way the runtime drives it: one flow per player over one in-memory
 * room, each ticked once per round on whichever screen it says the player is on, with presses where
 * a player would press, then the room delivers. Worlds are real, on Run Test.
 */
import { ROOM_CODE_ALPHABET } from '@arcade/api/protocol';
import { EventLog } from '@arcade/core';
import { describe, expect, it, vi } from 'vitest';
import type { GameEvent } from '../../logic/events.ts';
import { hashWorld } from '../../logic/hash.ts';
import { RACER_IDS, type RacerId, type TickInput, type World } from '../../logic/types.ts';
import type { RaceView } from '../../net/client.ts';
import { IDLE_INPUT } from '../../net/codec.ts';
import type { StartMessage } from '../../net/messages.ts';
import { createOnlineWorld } from '../../net/race-world.ts';
import { createMemoryRoom, type MemoryRoom, type MemoryRoomOptions } from '../../net/transport/memory.ts';
import type { CloseReason, ConnectionEvent, RoomConnection } from '../../net/transport/types.ts';
import type { CreateRoomResult } from '../../net/transport/websocket.ts';
import { createOnlineFlow, type FlowNext, type OnlineFlow, type ResultsChoice } from './flow.ts';
import type { ScreenPress } from './friends-screen.ts';
import { closedNotice, NOTICE_MAX_CHARS, NOTICES } from './notices.ts';
import { WAITING_AFTER_MS, waitingLine } from './race-hud.ts';

/** Wall time one logic tick stands for. */
const STEP_MS = 16;
/** Rounds after which a condition that has not come true counts as stuck. */
const ROUND_LIMIT = 6000;
const CODE = 'ABCDEF';
const COURSES = ['sunlit-shallows', 'bramble-run', 'run-test'] as const;

type Screen = 'friends' | 'room' | 'race' | 'results' | 'title';

/** One player: their flow, the screen the runtime would show, and what the flow asked for along the way. */
interface Player {
  flow: OnlineFlow;
  screen: Screen;
  /** The world the flow last sent this player to race in. */
  world: World | null;
  local: RacerId | null;
  /** Every `FlowNext` other than `stay`, in order. */
  signals: FlowNext['kind'][];
  /** Every start `createRace` was called with, and the slot it was for. */
  built: { start: StartMessage; local: RacerId }[];
  /** Each distinct notice in the order it showed. */
  notices: (string | null)[];
  warnings: string[];
  /** A frozen player's page has stopped: the table never ticks it. */
  frozen: boolean;
}

/** Run right, jumping on a cycle that differs per slot: clears Run Test well inside the race. */
function scriptedInput(slot: RacerId, tick: number): TickInput {
  const phase = tick % (40 + 10 * RACER_IDS.indexOf(slot));
  return { ...IDLE_INPUT, move: phase < 25 ? { x: Math.SQRT1_2, y: -Math.SQRT1_2 } : { x: 1, y: 0 } };
}

interface PlayerOptions {
  createRoom?: () => Promise<CreateRoomResult>;
  copyLink?: () => Promise<boolean>;
  /** Replaces the table's room for this player's connections. */
  connect?: () => RoomConnection;
  /** Stall before this player's client asks the room to kick a silent racer; never by default. */
  kickAfterMs?: number;
}

/** A connection to a room that never answers: the player stays connecting. */
const silentConnection = (): RoomConnection => ({ send() {}, poll: () => [], close() {} });

/** Lets every answer already given to a port reach the flow. */
const flushAnswers = () => new Promise((resolve) => setTimeout(resolve, 0));

/**
 * A port answered by hand: every ask gets the one answer `give` supplies, whether it is given
 * before or after the flow gets round to asking.
 */
function answerByHand<T>() {
  let give: (value: T) => void = () => {};
  const promise = new Promise<T>((resolve) => (give = resolve));
  return { port: () => promise, give: (value: T) => give(value) };
}

/** A table of players around one room. */
function createTable(roomOptions: MemoryRoomOptions = {}) {
  const room: MemoryRoom = createMemoryRoom(undefined, roomOptions);
  const players: Player[] = [];

  function seat(options: PlayerOptions = {}): Player {
    const player: Player = {
      flow: null as unknown as OnlineFlow,
      screen: 'friends',
      world: null,
      local: null,
      signals: [],
      built: [],
      notices: [null],
      warnings: [],
      frozen: false,
    };
    player.flow = createOnlineFlow({
      connect: options.connect ?? (() => room.connect()),
      createRoom: options.createRoom ?? (() => Promise.resolve({ ok: true, code: CODE })),
      copyLink: options.copyLink ?? (() => Promise.resolve(true)),
      seed: () => 5,
      kickAfterMs: options.kickAfterMs ?? null,
      createRace(start, local) {
        player.built.push({ start, local });
        return createOnlineWorld(start, new EventLog<GameEvent>(10_000));
      },
      courses: COURSES,
      lobby: () => ({ character: 'rudy', course: 'run-test', difficulty: 'easy' }),
      warn: (message) => player.warnings.push(message),
    });
    players.push(player);
    return player;
  }

  /** Does what `next` says, as the runtime would. */
  function follow(player: Player, next: FlowNext): void {
    if (next.kind === 'stay') return;
    player.signals.push(next.kind);
    if (next.kind === 'race') {
      player.screen = 'race';
      player.world = next.world;
      player.local = next.local;
    } else player.screen = next.kind;
  }

  /** One tick for `player` on its screen, with `press` (a menu press on results). */
  function tick(player: Player, press: ScreenPress | null = null, choice: ResultsChoice = null): void {
    const { flow } = player;
    if (player.frozen) return;
    if (player.screen === 'friends') follow(player, flow.friends(press));
    else if (player.screen === 'room') follow(player, flow.room(press, STEP_MS));
    else if (player.screen === 'results') follow(player, flow.results(choice, STEP_MS));
    else if (player.screen === 'race') {
      const input = scriptedInput(player.local ?? 'player', flow.client?.view.race?.targetTick ?? 0);
      follow(player, flow.race(input, STEP_MS).next);
      // The runtime shows results once the race has finished; nothing else moves a player there.
      if (player.screen === 'race' && player.world?.race.result && flow.client?.view.race?.over)
        player.screen = 'results';
    }
    if (flow.state.notice !== player.notices.at(-1)) player.notices.push(flow.state.notice);
  }

  /** Every player ticks once with no press, then the room delivers. */
  function round(): void {
    for (const player of players) tick(player);
    room.deliver();
  }

  function until(done: () => boolean): void {
    for (let rounds = 0; rounds < ROUND_LIMIT && !done(); rounds++) round();
    if (!done()) throw new Error(`condition not reached within ${ROUND_LIMIT} rounds`);
  }

  return { room, players, seat, tick, round, until };
}

type Table = ReturnType<typeof createTable>;

/** The presses that spell `code` in the friends screen's cells, from the menu with Create room selected. */
function spell(code: string): ScreenPress[] {
  const presses: ScreenPress[] = ['down', 'fire'];
  for (const char of code) {
    presses.push(...Array.from({ length: ROOM_CODE_ALPHABET.indexOf(char) }, () => 'up' as const), 'fire');
  }
  return presses;
}

/** Presses each of `presses` on one tick of its own for `player`. */
function pressAll(table: Table, player: Player, presses: readonly ScreenPress[]): void {
  for (const press of presses) table.tick(player, press);
}

const lobbyOf = (player: Player) => player.flow.client?.view.lobby;
const peerCount = (player: Player) => lobbyOf(player)?.peers.length ?? 0;

/** How `seatedRoom` sets the table up. */
interface SeatingOptions {
  /** Players who join after the host; one by default. */
  guests?: number;
  room?: MemoryRoomOptions;
  kickAfterMs?: number;
}

/**
 * A host who created room CODE and guests who joined it by spelling the code, each seeing all the
 * others. `guest` is the first guest.
 */
async function seatedRoom({ guests: guestCount = 1, room, kickAfterMs }: SeatingOptions = {}) {
  const table = createTable(room);
  const seatOptions: PlayerOptions = kickAfterMs === undefined ? {} : { kickAfterMs };
  const host = table.seat(seatOptions);
  table.tick(host, 'fire');
  await vi.waitFor(() => expect(host.flow.busy).toBe(false));
  table.tick(host);
  const guests = Array.from({ length: guestCount }, () => {
    const guest = table.seat(seatOptions);
    pressAll(table, guest, spell(CODE));
    return guest;
  });
  const everyone = [host, ...guests];
  table.until(
    () => everyone.every((player) => peerCount(player) === everyone.length) && lobbyOf(host)?.canStart === true,
  );
  return { table, host, guest: guests[0] as Player, guests };
}

/** Starts a race from the host's Start row (three down from Character) and runs both players to results. */
function raceToResults(table: Table, host: Player, guest: Player): void {
  pressAll(table, host, ['down', 'down', 'down', 'fire']);
  table.until(() => host.screen === 'results' && guest.screen === 'results');
}

const outcomeOf = (player: Player) => ({
  standings: player.world?.race.result?.standings,
  hash: player.world ? hashWorld(player.world) : null,
});

describe('Friends', () => {
  it('creates a room: busy while asking, then into the room, with the notices in order', async () => {
    const created = answerByHand<CreateRoomResult>();
    const table = createTable();
    const host = table.seat({ createRoom: created.port });

    table.tick(host, 'fire');
    table.tick(host, 'down');
    expect(host.flow.busy).toBe(true);
    expect(host.screen).toBe('friends');
    expect(host.flow.state.friends.selected).toBe(0);

    created.give({ ok: true, code: CODE });
    await vi.waitFor(() => expect(host.flow.busy).toBe(false));
    table.until(() => host.flow.client?.view.status === 'lobby');

    expect(host.screen).toBe('room');
    expect(host.flow.state.code).toBe(CODE);
    expect(host.notices).toEqual([null, 'Creating room...', 'Joining room...', null]);
    expect(lobbyOf(host)).toMatchObject({ you: 1, host: 1, course: 'run-test', difficulty: 'normal' });
  });

  it('stays on Friends with a notice when no room can be created', async () => {
    const table = createTable();
    const host = table.seat({ createRoom: () => Promise.resolve({ ok: false }) });

    table.tick(host, 'fire');
    await vi.waitFor(() => expect(host.flow.busy).toBe(false));
    table.tick(host);

    expect(host.screen).toBe('friends');
    expect(host.flow.client).toBeNull();
    expect(host.notices).toEqual([null, 'Creating room...', 'Rooms are unavailable right now']);
  });

  it('joins by code, and host and guest see each other', async () => {
    const { host, guest } = await seatedRoom();

    expect(guest.flow.state.code).toBe(CODE);
    expect(guest.signals).toEqual(['room']);
    expect(lobbyOf(guest)?.peers.map(({ label, you, host: isHost }) => [label, you, isHost])).toEqual([
      ['P1', false, true],
      ['P2', true, false],
    ]);
    expect(lobbyOf(host)?.peers.map(({ label, you }) => [label, you])).toEqual([
      ['P1', true],
      ['P2', false],
    ]);
  });

  it.each([
    ['rejects', () => Promise.reject(new Error('offline'))],
    [
      'throws at once',
      () => {
        throw new Error('offline');
      },
    ],
  ])('stays on Friends, not busy, with one warning, when creating a room %s', async (_how, createRoom) => {
    const table = createTable();
    const host = table.seat({ createRoom });

    table.tick(host, 'fire');
    await vi.waitFor(() => expect(host.flow.busy).toBe(false));
    table.tick(host);

    expect(host.screen).toBe('friends');
    expect(host.notices).toEqual([null, 'Creating room...', 'Rooms are unavailable right now']);
    expect(host.warnings).toEqual(['online: creating a room failed: offline']);
  });

  it('goes back to the title on B while a room is being created, and drops the room that arrives after', async () => {
    const created = answerByHand<CreateRoomResult>();
    const table = createTable();
    const host = table.seat({ createRoom: created.port });
    table.tick(host, 'fire');
    expect(host.flow.busy).toBe(true);

    table.tick(host, 'dash');
    expect([host.screen, host.flow.busy, host.flow.state.notice]).toEqual(['title', false, null]);

    created.give({ ok: true, code: CODE });
    await flushAnswers();
    host.screen = 'friends';
    table.tick(host);
    expect([host.screen, host.flow.client]).toEqual(['friends', null]);
  });

  it('goes back to the title on Back', () => {
    const table = createTable();
    const player = table.seat();

    pressAll(table, player, ['up', 'fire']);

    expect(player.screen).toBe('title');
    expect(player.flow.client).toBeNull();
  });
});

describe('the room', () => {
  it('sends picks, and the host’s course and level, to the other player', async () => {
    const { table, host, guest } = await seatedRoom();

    table.tick(guest, 'right');
    pressAll(table, host, ['down', 'right', 'down', 'right']);
    table.round();
    table.round();

    const guestEntry = (player: Player) => lobbyOf(player)?.peers[1]?.character;
    expect([guestEntry(host), guestEntry(guest)]).toEqual(['gil', 'gil']);
    for (const player of [host, guest]) {
      expect(lobbyOf(player)).toMatchObject({ course: 'sunlit-shallows', difficulty: 'hard' });
    }
  });

  it('copies the link with a notice, and says so when the browser refuses', async () => {
    const { table, host } = await seatedRoom();
    const refused = table.seat({ copyLink: () => Promise.reject(new Error('NotAllowedError')) });
    pressAll(table, refused, spell(CODE));
    table.until(() => peerCount(refused) === 3);

    pressAll(table, host, ['up', 'up', 'fire']);
    pressAll(table, refused, ['up', 'up', 'fire']);
    await vi.waitFor(() => expect(host.flow.busy || refused.flow.busy).toBe(false));
    table.round();

    expect(host.flow.state.notice).toBe('Link copied');
    expect(refused.flow.state.notice).toBe('Could not copy the link');
  });

  it('drops the answer to a copy asked for in a room the player has since left', async () => {
    const copied = answerByHand<boolean>();
    const table = createTable();
    const host = table.seat({ copyLink: copied.port });
    table.tick(host, 'fire');
    await vi.waitFor(() => expect(host.flow.busy).toBe(false));
    table.until(() => host.flow.client?.view.status === 'lobby');
    pressAll(table, host, ['up', 'up', 'fire']);
    expect(host.flow.busy).toBe(true);

    host.flow.openFriends();
    host.flow.join(CODE);
    host.screen = 'room';
    expect(host.flow.busy).toBe(false);
    copied.give(true);
    await flushAnswers();
    table.until(() => host.flow.client?.view.status === 'lobby');

    expect(host.flow.state.notice).toBeNull();
    expect(host.notices).not.toContain('Link copied');
  });

  it('goes to the title on B before the room has answered', () => {
    const table = createTable();
    const player = table.seat({ connect: silentConnection });
    player.flow.join(CODE);
    player.screen = 'room';
    table.tick(player);
    expect(player.flow.client?.view.status).toBe('connecting');

    table.tick(player, 'dash');

    expect(player.screen).toBe('title');
    expect(player.flow.state.notice).toBeNull();
  });

  it('leaves for the title on Leave, and the other player sees them gone', async () => {
    const { table, host, guest } = await seatedRoom();

    table.tick(guest, 'dash');
    table.until(() => peerCount(host) === 1);

    expect(guest.screen).toBe('title');
    expect(guest.flow.client?.view).toMatchObject({ status: 'closed', reason: 'left' });
    expect(guest.flow.state.notice).toBeNull();
  });

  it('goes to the title with the reason when the room closes the connection', async () => {
    const { table, host, guest } = await seatedRoom();

    table.room.drop(lobbyOf(guest)?.you ?? 0, 'kicked');
    table.until(() => guest.screen === 'title');

    expect(guest.flow.state.notice).toBe('You were dropped from the race');
    expect(guest.signals).toEqual(['room', 'title']);
    expect(host.screen).toBe('room');
  });
});

describe('an online race', () => {
  it('starts both players in worlds built from one start, and they finish alike without asking for anything else', async () => {
    const { table, host, guest } = await seatedRoom();

    raceToResults(table, host, guest);

    expect(host.built.map(({ local }) => local)).toEqual(['player']);
    expect(guest.built.map(({ local }) => local)).toEqual(['tess']);
    // The guest's copy arrived relayed, so it carries the sender too.
    expect(guest.built[0]?.start).toEqual({ ...host.built[0]?.start, from: 1 });
    expect(host.built[0]?.start).toMatchObject({ seed: 5, course: 'run-test', difficulty: 'normal' });
    expect([host.local, guest.local]).toEqual(['player', 'tess']);
    expect(outcomeOf(host).standings).toHaveLength(4);
    expect(outcomeOf(guest)).toEqual(outcomeOf(host));
    expect(host.signals).toEqual(['room', 'race']);
    expect(guest.signals).toEqual(['room', 'race']);
    expect([...host.warnings, ...guest.warnings]).toEqual([]);
    expect([host, guest].map((player) => player.flow.client?.view.dropped)).toEqual([0, 0]);
  });

  it('goes back to the room on Race again, and a second race starts', async () => {
    const { table, host, guest } = await seatedRoom();
    raceToResults(table, host, guest);
    const firstWorlds = [host.world, guest.world];

    table.tick(host, null, 'again');
    table.tick(guest, null, 'again');
    expect([host.screen, guest.screen]).toEqual(['room', 'room']);
    table.until(() => lobbyOf(host)?.canStart === true);
    table.tick(host, 'fire');
    table.until(() => host.screen === 'race' && guest.screen === 'race');

    expect(host.built).toHaveLength(2);
    expect(guest.built).toHaveLength(2);
    expect([host.world, guest.world]).not.toContain(firstWorlds[0]);
    expect([host.world, guest.world]).not.toContain(firstWorlds[1]);
  });

  it('takes a player still on results into the host’s next race', async () => {
    const { table, host, guest } = await seatedRoom();
    raceToResults(table, host, guest);

    table.tick(host, null, 'again');
    table.until(() => lobbyOf(host)?.canStart === true);
    table.tick(host, 'fire');
    table.until(() => guest.screen === 'race');

    expect(guest.signals).toEqual(['room', 'race', 'race']);
    expect(guest.world).toBe(guest.flow.client?.world);
  });

  it('leaves the room for the title on Title from results', async () => {
    const { table, host, guest } = await seatedRoom();
    raceToResults(table, host, guest);

    table.tick(guest, null, 'title');
    table.until(() => peerCount(host) === 1);

    expect(guest.screen).toBe('title');
    expect(guest.flow.client?.view.status).toBe('closed');
  });

  it('goes back to the room with a notice when the race goes out of sync', async () => {
    const { table, host, guest } = await seatedRoom();
    pressAll(table, host, ['down', 'down', 'down', 'fire']);
    table.until(() => (guest.flow.client?.view.race?.simTick ?? 0) >= 70);
    const racer = guest.world?.racers.find((each) => each.id === 'tess');
    if (!racer) throw new Error('no tess racer in the guest world');
    racer.body.x += 1;
    table.until(() => host.screen === 'room' && guest.screen === 'room');

    for (const player of [host, guest]) {
      expect(player.flow.state.notice).toBe('The race went out of sync');
      expect(player.flow.client?.view).toMatchObject({ status: 'lobby', race: null });
    }
  });
});

/** A connection the room refuses at once, for `reason`, as the real room does with a close code. */
function refusedConnection(reason: CloseReason): RoomConnection {
  let events: ConnectionEvent[] = [{ kind: 'closed', reason }];
  return {
    send() {},
    poll() {
      const arrived = events;
      events = [];
      return arrived;
    },
    close() {},
  };
}

/** Starts a race from the host's Start row and runs until every player in `players` is racing past the countdown. */
function startRace(table: Table, host: Player, players: readonly Player[]): void {
  pressAll(table, host, ['down', 'down', 'down', 'fire']);
  table.until(() => players.every((player) => player.world?.race.phase === 'racing'));
}

/** The tick the AI took over `slot` in `player`'s world, if it has. */
const takenOverAt = (player: Player, slot: RacerId | null) =>
  player.world?.racers.find((racer) => racer.id === slot)?.tookOverAt;

describe('departures and states', () => {
  it.each([
    ['full', 'That room is full'],
    ['unknown-room', 'No room with that code'],
    ['version', 'Game versions differ: everyone reload'],
    ['unavailable', 'Rooms are unavailable right now'],
    ['kicked', 'You were dropped from the race'],
    ['lost', 'Connection lost'],
  ] as const)('goes to the title saying why when a join ends with %s', (reason, notice) => {
    const table = createTable();
    const player = table.seat({ connect: () => refusedConnection(reason) });

    pressAll(table, player, spell(CODE));
    table.tick(player);

    expect([player.screen, player.flow.state.notice]).toEqual(['title', notice]);
  });

  it('keeps every notice to one line of 40 characters', () => {
    const reasons: CloseReason[] = ['left', 'full', 'version', 'unknown-room', 'kicked', 'unavailable', 'lost'];
    const notices = [...Object.values(NOTICES), ...reasons.map(closedNotice)].filter((text) => text !== null);

    expect(notices.filter((text) => text.length > NOTICE_MAX_CHARS)).toEqual([]);
  });

  it('leaves a race still running when the tab hides, and the others take its racer over on one tick', async () => {
    const { table, host, guests } = await seatedRoom({ guests: 2 });
    const [leaver, third] = guests as [Player, Player];
    startRace(table, host, [host, leaver, third]);

    expect(leaver.flow.hide()).toEqual({ kind: 'title' });
    leaver.screen = 'title';
    table.until(() => host.screen === 'results' && third.screen === 'results');

    expect(leaver.flow.state.notice).toBe('You left the race');
    expect(takenOverAt(host, leaver.local)).toBeGreaterThan(0);
    expect(takenOverAt(third, leaver.local)).toBe(takenOverAt(host, leaver.local));
    expect(outcomeOf(third)).toEqual(outcomeOf(host));
  });

  it('tells the room this player is away while the tab is hidden in the room, and ready again when it shows', async () => {
    const { table, host, guest } = await seatedRoom();
    const guestReady = () => lobbyOf(host)?.peers[1]?.ready;

    expect(guest.flow.hide()).toEqual({ kind: 'stay' });
    table.until(() => guestReady() === false);
    expect(lobbyOf(host)?.canStart).toBe(false);

    guest.flow.show();
    table.until(() => guestReady() === true);
    expect(lobbyOf(host)?.canStart).toBe(true);
  });

  it('does nothing when the tab hides outside online play', () => {
    const table = createTable();
    const player = table.seat();

    expect(player.flow.hide()).toEqual({ kind: 'stay' });
    player.flow.show();
    expect([player.flow.client, player.flow.state.notice]).toEqual([null, null]);
  });

  it('shows who the race waits on once stalled, has the silent racer kicked, and the rest finish alike', async () => {
    const { table, host, guests } = await seatedRoom({
      guests: 2,
      room: { kickSilenceSteps: 30 },
      kickAfterMs: 1000,
    });
    const [guest, silent] = guests as [Player, Player];
    startRace(table, host, [host, guest, silent]);
    const silentLabel = lobbyOf(host)?.peers[2]?.label;
    const hostRace = () => host.flow.client?.view.race;

    silent.frozen = true;
    table.until(() => (hostRace()?.stalledMs ?? 0) > 0);
    expect(waitingLine(hostRace() as RaceView)).toBeNull();
    table.until(() => (hostRace()?.stalledMs ?? 0) >= WAITING_AFTER_MS);
    expect(waitingLine(hostRace() as RaceView)).toBe(`WAITING FOR ${silentLabel}`);

    table.until(() => takenOverAt(host, silent.local) !== undefined);
    table.round();
    expect(waitingLine(hostRace() as RaceView)).toBeNull();
    table.until(() => host.screen === 'results' && guest.screen === 'results');
    expect(takenOverAt(guest, silent.local)).toBe(takenOverAt(host, silent.local));
    expect(outcomeOf(guest)).toEqual(outcomeOf(host));

    silent.frozen = false;
    table.until(() => silent.screen === 'title');
    expect(silent.flow.state.notice).toBe('You were dropped from the race');
  });
});
