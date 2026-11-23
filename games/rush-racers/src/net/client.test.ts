/**
 * One peer's whole online flow, driven the way the engine drives it: real clients on the in-memory
 * room, each building a real world on Run Test, ticked once per round with a scripted input, then
 * the room delivers. A few peers are bare connections that send what a client never would.
 */
import { EventLog } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import { courseById } from '../logic/courses/index.ts';
import type { GameEvent } from '../logic/events.ts';
import { hashWorld } from '../logic/hash.ts';
import { RACER_IDS, type RacerId, type TickInput } from '../logic/types.ts';
import { createWorld } from '../logic/world.ts';
import { type ClientOptions, createClient, type OnlineClient } from './client.ts';
import { encodeInputs } from './codec.ts';
import type { StartMessage } from './messages.ts';
import { createMemoryRoom, type MemoryRoom, type MemoryRoomOptions } from './transport/memory.ts';
import type { ConnectionEvent, RoomConnection } from './transport/types.ts';

/** Wall time one logic step stands for, rounded so stall sums stay exact. */
const STEP_MS = 16;
/** Rounds after which a condition that has not come true counts as stuck. */
const ROUND_LIMIT = 20_000;
const RUN_RIGHT = { x: 1, y: 0 };
const JUMP_RIGHT = { x: Math.SQRT1_2, y: -Math.SQRT1_2 };
const SEED = 7;
/** A well-formed start for peers 1 and 2, for a test to forge from a peer the room would never relay it from. */
const FORGED_START: StartMessage = {
  type: 'start',
  seed: 1,
  course: 'run-test',
  difficulty: 'normal',
  slots: { '1': 'player', '2': 'tess' },
  characters: { player: 'rudy', tess: 'gil' },
  delay: 3,
};

/** The world the engine would build for a start: Run Test's course, the start's cast and level. */
function createRace(start: StartMessage): ReturnType<ClientOptions['createRace']> {
  const course = courseById(start.course);
  if (!course) throw new Error(`test createRace: unknown course ${start.course}`);
  const humans = RACER_IDS.filter((slot) => Object.values(start.slots).includes(slot));
  return createWorld(course, new EventLog<GameEvent>(10_000), {
    seed: start.seed,
    humans,
    characters: start.characters,
    difficulty: start.difficulty,
  });
}

/**
 * Run right and jump on a cycle that differs per slot, which clears Run Test in roughly 700 ticks.
 * It follows the race clock, as a player watching a stalled race would.
 */
function scriptedInput(slot: RacerId, clockTick: number): TickInput {
  const period = 40 + 10 * RACER_IDS.indexOf(slot);
  const phase = clockTick % period;
  return { move: phase < 25 ? JUMP_RIGHT : RUN_RIGHT, kick: phase === 0, use: false, cycle: 0, kickHeld: false };
}

/** A real connection to the room whose `poll` also returns events the test forges, as a misbehaving room would send. */
interface ForgingConnection extends RoomConnection {
  forge(event: ConnectionEvent): void;
}

function forging(connection: RoomConnection): ForgingConnection {
  const forged: ConnectionEvent[] = [];
  return {
    send: (message) => connection.send(message),
    poll: () => [...connection.poll(), ...forged.splice(0)],
    close: () => connection.close(),
    forge: (event) => forged.push(event),
  };
}

interface Peer {
  client: OnlineClient;
  connection: ForgingConnection;
  warnings: string[];
}

interface Table {
  room: MemoryRoom;
  peers: Peer[];
  /** Connects a new client with this pick. */
  join(character?: ClientOptions['lobby']['character']): Peer;
  /** Every open peer not skipped ticks once, in join order; then the room delivers. */
  round(skip?: (peer: Peer) => boolean): void;
  /** Two rounds: what was sent before them is delivered in the first and handled in the second. */
  settle(): void;
  /** Runs rounds until `done` holds, failing after a bound so a broken client cannot hang the test. */
  until(done: () => boolean, skip?: (peer: Peer) => boolean): void;
}

const CHARACTERS = ['rudy', 'gil', 'onyx', 'nib', 'baron'] as const;

function createTable(options: MemoryRoomOptions & { kickAfterMs?: number | null } = {}): Table {
  const room = createMemoryRoom(() => 0, options);
  const peers: Peer[] = [];
  const join: Table['join'] = (character = CHARACTERS[peers.length] ?? 'rudy') => {
    const connection = forging(room.connect());
    const warnings: string[] = [];
    const client = createClient({
      connection,
      lobby: { character, course: 'run-test', difficulty: 'normal' },
      createRace,
      kickAfterMs: options.kickAfterMs ?? null,
      warn: (message) => warnings.push(message),
    });
    const peer = { client, connection, warnings };
    peers.push(peer);
    return peer;
  };
  const round: Table['round'] = (skip = () => false) => {
    for (const { client } of peers.filter((peer) => !skip(peer))) {
      const race = client.view.race;
      client.tick(scriptedInput(race?.local ?? 'player', race?.targetTick ?? 0), STEP_MS);
    }
    room.deliver();
  };
  const until: Table['until'] = (done, skip) => {
    for (let rounds = 0; rounds < ROUND_LIMIT && !done(); rounds++) round(skip);
    if (!done()) throw new Error(`condition not reached within ${ROUND_LIMIT} rounds`);
  };
  const settle = () => {
    round();
    round();
  };
  return { room, peers, join, round, settle, until };
}

/** A table with `count` clients, all welcomed and each knowing every other's entry. */
function seated(count: number, options?: Parameters<typeof createTable>[0]): Table {
  const table = createTable(options);
  for (let index = 0; index < count; index++) table.join();
  const knowsEveryone = ({ client }: Peer) =>
    client.view.lobby.peers.length === count && client.view.lobby.peers.every((each) => each.character !== null);
  table.until(() => table.peers.every(knowsEveryone));
  return table;
}

const hostOf = (table: Table): Peer => table.peers[0] as Peer;
const isOver = (peer: Peer) => peer.client.view.status !== 'racing' || peer.client.view.race?.over === true;

/** What a peer's finished race looks like to the player. */
function outcomeOf(peer: Peer) {
  const world = peer.client.world;
  return {
    standings: world?.race.result?.standings,
    tick: world?.tick,
    hash: world ? hashWorld(world) : null,
    takenOver: world?.racers.filter((racer) => racer.tookOverAt !== undefined).map((racer) => racer.id),
  };
}

function expectSameFinish(peers: Peer[], takenOver: RacerId[] = []): void {
  const outcomes = peers.map(outcomeOf);
  expect(outcomes[0]).toMatchObject({ takenOver });
  expect(outcomes[0]?.standings).toHaveLength(4);
  expect(outcomes).toEqual(peers.map(() => outcomes[0]));
  expect(peers.map((peer) => [peer.client.view.race?.over, peer.client.view.race?.desync])).toEqual(
    peers.map(() => [true, null]),
  );
}

/** Starts a race from the host and runs every racer to its end. */
function raceToEnd(table: Table, skip?: (peer: Peer) => boolean): void {
  hostOf(table).client.start(SEED);
  table.until(() => table.peers.every(isOver), skip);
  // Deliver the ends, so the room and every lobby see the race over.
  table.until(
    () => table.room.phase === 'lobby' && table.peers.every((peer) => peer.client.view.lobby.phase === 'lobby'),
  );
}

describe('the lobby', () => {
  it('shows two clients each other’s pick, ping and readiness', () => {
    const table = seated(2);
    const [host, guest] = table.peers as [Peer, Peer];
    guest.client.setReady(false);
    table.settle();

    expect(host.client.view).toMatchObject({ status: 'lobby', reason: null, race: null, dropped: 0 });
    expect(host.client.view.lobby.peers).toEqual([
      { id: 1, label: 'P1', character: 'rudy', ping: null, ready: true, host: true, you: true },
      { id: 2, label: 'P2', character: 'gil', ping: 0, ready: false, host: false, you: false },
    ]);
    expect(guest.client.view.lobby.peers).toEqual([
      { id: 1, label: 'P1', character: 'rudy', ping: 0, ready: true, host: true, you: false },
      { id: 2, label: 'P2', character: 'gil', ping: null, ready: false, host: false, you: true },
    ]);
  });

  it('greets a client that joins late with the entries of those already there', () => {
    const table = seated(2);
    table.peers[1]?.client.setCharacter('streak');
    table.settle();
    const late = table.join('nib');
    const peersKnown = () => late.client.view.lobby.peers.filter((peer) => peer.character !== null).length;
    table.until(() => peersKnown() === 3);

    expect(late.client.view.lobby.peers.map((peer) => [peer.label, peer.character, peer.ready])).toEqual([
      ['P1', 'rudy', true],
      ['P2', 'streak', true],
      ['P3', 'nib', true],
    ]);
  });

  it('carries the host’s course and level to the others, and not a guest’s', () => {
    const table = seated(2);
    const [host, guest] = table.peers as [Peer, Peer];
    host.client.setCourse('bramble-run');
    host.client.setDifficulty('hard');
    guest.client.setCourse('sunlit-shallows');
    guest.client.setDifficulty('normal');
    table.settle();

    const settings = (peer: Peer) => [peer.client.view.lobby.course, peer.client.view.lobby.difficulty];
    expect([settings(host), settings(guest)]).toEqual([
      ['bramble-run', 'hard'],
      ['bramble-run', 'hard'],
    ]);
  });

  it('refuses to start when the room cannot start', () => {
    const alone = seated(1);
    expect(() => hostOf(alone).client.start(SEED)).toThrow('buildStart: a race needs 2 ready peers, 1 ready');
    const table = seated(2);
    expect(() => table.peers[1]?.client.start(SEED)).toThrow('buildStart: peer 2 is not host (host is 1)');
  });

  it('measures pings from the room and sets the start’s delay from them', () => {
    const table = seated(2, { roundTripMs: () => 100 });
    const [host, guest] = table.peers as [Peer, Peer];
    table.until(() => table.peers.every((peer) => peer.client.view.lobby.peers.every((each) => each.ping === 50)));
    host.client.start(SEED);

    expect(guest.client.view.lobby.peers.map((peer) => peer.ping)).toEqual([50, 50]);
    expect(host.client.view.race?.inputDelay).toBe(8);
    table.settle();
    expect(guest.client.view.race?.inputDelay).toBe(8);
  });
});

describe('a race', () => {
  it.each([2, 3, 4])(
    'among %i clients ends with equal standings and hashes, and the room back in the lobby',
    (count) => {
      const table = seated(count);
      raceToEnd(table);

      expectSameFinish(table.peers);
      expect(table.peers.map((peer) => [peer.client.view.status, peer.client.view.dropped])).toEqual(
        table.peers.map(() => ['racing', 0]),
      );
      expect(table.peers.map((peer) => peer.client.view.race?.local)).toEqual(RACER_IDS.slice(0, count));
      expect(hostOf(table).client.view.race?.labels).toEqual(
        Object.fromEntries(RACER_IDS.slice(0, count).map((slot, index) => [slot, `P${index + 1}`])),
      );
    },
  );

  it('can be followed by another after returning to the lobby', () => {
    const table = seated(2);
    raceToEnd(table);
    const first = outcomeOf(hostOf(table));
    for (const peer of table.peers) peer.client.returnToLobby();
    expect(table.peers.map((peer) => [peer.client.view.status, peer.client.world])).toEqual([
      ['lobby', null],
      ['lobby', null],
    ]);

    raceToEnd(table);
    expectSameFinish(table.peers);
    expect(outcomeOf(hostOf(table)).hash).toBe(first.hash);
  });

  it.each([
    { who: 'after returning to the lobby', hostReturns: true },
    { who: 'still on the last race’s results', hostReturns: false },
  ])('is started by a host $who for guests still on the last race’s results', ({ hostReturns }) => {
    const table = seated(3);
    raceToEnd(table);
    const firstWorlds = table.peers.map((peer) => peer.client.world);
    if (hostReturns) hostOf(table).client.returnToLobby();
    hostOf(table).client.start(SEED + 1);
    const inNextRace = ({ client }: Peer) => client.world !== null && !firstWorlds.includes(client.world);
    table.until(
      () =>
        table.peers.every((peer) => inNextRace(peer) && isOver(peer)) &&
        table.room.phase === 'lobby' &&
        table.peers.every((peer) => peer.client.view.lobby.phase === 'lobby'),
    );

    expectSameFinish(table.peers);
    expect(table.peers.map((peer) => peer.client.view.dropped)).toEqual([0, 0, 0]);
  });

  it('refuses a host’s start while its own race is not over, even if the room says the lobby', () => {
    const table = seated(2);
    const host = hostOf(table);
    host.client.start(SEED);
    table.until(() => (host.client.view.race?.simTick ?? 0) >= 30);
    host.connection.forge({ kind: 'json', message: { type: 'phase', phase: 'lobby' } });
    table.round();
    const simTick = host.client.view.race?.simTick;

    expect(host.client.view.lobby.canStart).toBe(true);
    expect(() => host.client.start(SEED + 1)).toThrow('start: this peer is in a race that is not over yet');
    table.settle();
    expect(table.peers.map((peer) => peer.client.view.dropped)).toEqual([0, 0]);
    expect(host.client.view.race?.simTick).toBeGreaterThan(simTick ?? 0);
  });

  it('leaves a client that was away at the start in the lobby, watching the phase', () => {
    const table = seated(3);
    const away = table.peers[2] as Peer;
    away.client.setReady(false);
    table.settle();
    const phases = [away.client.view.lobby.phase];
    hostOf(table).client.start(SEED);
    const racersDone = () => table.peers.slice(0, 2).every(isOver) && table.room.phase === 'lobby';
    for (let rounds = 0; rounds < ROUND_LIMIT && !(racersDone() && phases.at(-1) === 'lobby'); rounds++) {
      table.round();
      if (phases.at(-1) !== away.client.view.lobby.phase) phases.push(away.client.view.lobby.phase);
    }

    expect(phases).toEqual(['lobby', 'racing', 'lobby']);
    expect(away.client.view).toMatchObject({ status: 'lobby', race: null, dropped: 0 });
    expect(away.client.world).toBeNull();
    expectSameFinish(table.peers.slice(0, 2));
  });

  it('keeps a client that joins during it waiting in the lobby without dropping anything', () => {
    const table = seated(2);
    hostOf(table).client.start(SEED);
    table.until(() => (hostOf(table).client.view.race?.simTick ?? 0) > 100);
    const late = table.join();
    table.until(() => table.peers.slice(0, 2).every(isOver) && table.room.phase === 'lobby');

    expect(late.client.view).toMatchObject({ status: 'lobby', race: null, dropped: 0 });
    expect(late.client.view.lobby.peers.map((peer) => peer.character)).toEqual(['rudy', 'gil', 'onyx']);
    expect(late.warnings).toEqual([]);
  });

  it('ignores a start from a peer that is not host', () => {
    const table = seated(2);
    const host = hostOf(table);
    host.connection.forge({ kind: 'json', message: { ...FORGED_START, from: 2 } });
    table.settle();

    expect(host.client.view).toMatchObject({ status: 'lobby', race: null, dropped: 1 });
    expect(host.warnings).toEqual(['online: dropped a start from peer 2, who is not host']);
  });

  it('ignores a second start while racing, and the race goes on', () => {
    const table = seated(2);
    const [host, guest] = table.peers as [Peer, Peer];
    host.client.start(SEED);
    table.until(() => (guest.client.view.race?.simTick ?? 0) >= 30);
    guest.connection.forge({ kind: 'json', message: { ...FORGED_START, from: 1 } });
    table.until(() => table.peers.every(isOver) && table.room.phase === 'lobby');

    expect([host.client.view.dropped, guest.client.view.dropped]).toEqual([0, 1]);
    expect(guest.warnings).toEqual(['online: dropped a start from peer 1 during a race']);
    expectSameFinish(table.peers);
  });

  it('drops and counts a start naming a course this build lacks', () => {
    const table = createTable();
    const foreignHost = table.room.connect();
    const guest = table.join();
    table.until(() => guest.client.view.lobby.peers.length === 2);
    foreignHost.send({
      type: 'start',
      seed: 1,
      course: 'coral-canyon',
      difficulty: 'normal',
      slots: { '1': 'player', '2': 'tess' },
      characters: { player: 'rudy', tess: 'gil' },
      delay: 3,
    });
    table.settle();

    expect(guest.client.view).toMatchObject({ status: 'lobby', race: null, dropped: 1 });
    expect(guest.warnings).toHaveLength(1);
  });
});

describe('departures', () => {
  it('hands a client dropped mid-race to the AI on the same tick everywhere, and the rest finish hash-equal', () => {
    const table = seated(3);
    const [host, leaver, third] = table.peers as [Peer, Peer, Peer];
    host.client.start(SEED);
    table.until(() => (host.client.view.race?.simTick ?? 0) >= 200);
    table.room.drop(2, 'lost');
    const stayed = [host, third];
    table.until(
      () => stayed.every(isOver) && table.room.phase === 'lobby',
      (peer) => peer === leaver,
    );
    table.round((peer) => peer !== leaver);
    const closedAt = leaver.client.world?.tick;
    const stepped = [0, 1, 2].map((tick) => leaver.client.tick(scriptedInput('tess', tick), STEP_MS));

    expect(leaver.client.view).toMatchObject({ status: 'closed', reason: 'lost' });
    expect({ stepped, tick: leaver.client.world?.tick }).toEqual({ stepped: [0, 0, 0], tick: closedAt });
    const tookOver = stayed.map((peer) => peer.client.world?.racers.find((racer) => racer.id === 'tess')?.tookOverAt);
    expect(tookOver[0]).toBeGreaterThan(200);
    expect(tookOver[1]).toBe(tookOver[0]);
    expectSameFinish(stayed, ['tess']);
  });

  it('takes over from the first scheduled tick a racer whose left arrived before the start', () => {
    const table = seated(3);
    const [host, leaver, third] = table.peers as [Peer, Peer, Peer];
    leaver.client.leave();
    host.client.start(SEED);
    const delay = host.client.view.race?.inputDelay ?? 0;
    const stayed = [host, third];
    table.until(
      () => stayed.every(isOver) && table.room.phase === 'lobby',
      (peer) => peer === leaver,
    );

    const tookOver = stayed.map((peer) => peer.client.world?.racers.find((racer) => racer.id === 'tess')?.tookOverAt);
    expect(tookOver).toEqual([delay + 1, delay + 1]);
    expectSameFinish(stayed, ['tess']);
  });

  it('has the room kick a silent racer once the others have stalled past kickAfterMs, and they finish', () => {
    const table = seated(3, { kickAfterMs: 1000, kickSilenceSteps: 30 });
    const [host, silent, third] = table.peers as [Peer, Peer, Peer];
    host.client.start(SEED);
    table.until(() => (host.client.view.race?.simTick ?? 0) >= 100);
    const isSilent = (peer: Peer) => peer === silent;
    table.until(() => host.client.view.race?.waitingOn.length === 1, isSilent);
    expect(host.client.view.race?.waitingOn).toEqual(['P2']);
    table.until(() => [host, third].every(isOver) && table.room.phase === 'lobby', isSilent);
    table.settle();

    expect(silent.client.view).toMatchObject({ status: 'closed', reason: 'kicked' });
    expectSameFinish([host, third], ['tess']);
  });

  it('never asks to kick a silent racer when kickAfterMs is null', () => {
    const table = seated(2, { kickAfterMs: null, kickSilenceSteps: 30 });
    const [host, silent] = table.peers as [Peer, Peer];
    host.client.start(SEED);
    table.until(() => (host.client.view.race?.simTick ?? 0) >= 100);
    for (let round = 0; round < 600; round++) table.round((peer) => peer === silent);
    const stalled = host.client.view.race;
    table.settle();

    expect(stalled?.waitingOn).toEqual(['P2']);
    expect(stalled?.stalledMs).toBeGreaterThan(5000);
    expect(silent.client.view.status).toBe('racing');
  });

  it('gives the others one left and the leaver closed with left', () => {
    const table = seated(3);
    const [host, leaver, third] = table.peers as [Peer, Peer, Peer];
    leaver.client.leave();
    table.settle();

    expect(leaver.client.view).toMatchObject({ status: 'closed', reason: 'left' });
    for (const peer of [host, third]) expect(peer.client.view.lobby.peers.map((each) => each.id)).toEqual([1, 3]);
    expect([host, third].map((peer) => peer.client.view.dropped)).toEqual([0, 0]);
  });

  it('shows a connection the room closed as closed with its reason, after which nothing is sent or stepped', () => {
    const table = seated(2);
    const [host, guest] = table.peers as [Peer, Peer];
    table.room.drop(2, 'kicked');
    table.settle();
    expect(guest.client.view).toMatchObject({ status: 'closed', reason: 'kicked' });

    const before = host.client.view.lobby.peers;
    guest.client.setCharacter('rook');
    guest.client.setReady(false);
    guest.client.start(SEED);
    guest.client.leave();
    table.settle();
    expect(guest.client.tick(scriptedInput('tess', 0), STEP_MS)).toBe(0);
    expect(guest.client.view).toMatchObject({ status: 'closed', reason: 'kicked' });
    expect(host.client.view.lobby.peers).toEqual(before);
  });

  it('closes a fifth client with full', () => {
    const table = seated(4);
    const fifth = table.join();
    table.settle();
    expect(fifth.client.view).toMatchObject({ status: 'closed', reason: 'full' });
  });
});

describe('bad traffic', () => {
  it('counts malformed JSON and binary from an unknown peer and changes nothing', () => {
    const table = seated(2);
    const [host, guest] = table.peers as [Peer, Peer];
    const raw = table.room.connect();
    table.until(() => host.client.view.lobby.peers.length === 3);
    raw.send({ type: 'lobby', character: 'nobody', ping: 0, ready: true });
    host.client.start(SEED);
    table.until(() => (host.client.view.race?.simTick ?? 0) >= 50);
    host.connection.forge({ kind: 'binary', from: 9, bytes: encodeInputs(60, scriptedInput('bo', 0)) });
    host.connection.forge({
      kind: 'json',
      message: { type: 'lobby', from: 9, character: 'rudy', ping: 0, ready: true },
    });
    table.until(() => table.peers.every(isOver) && table.room.phase === 'lobby');

    expect([host.client.view.dropped, guest.client.view.dropped]).toEqual([3, 1]);
    expect(host.warnings).toHaveLength(3);
    expect(host.client.view.lobby.peers.map((peer) => peer.character)).toEqual(['rudy', 'gil', null]);
    expectSameFinish([host, guest]);
  });

  it('counts a message that is no JSON object, even one with no printable form, without throwing', () => {
    const table = seated(2);
    const host = hostOf(table);
    const cycle: Record<string, unknown> = {};
    cycle.self = cycle;
    for (const message of [undefined, 'not json {', cycle, 10n]) host.connection.forge({ kind: 'json', message });
    table.settle();

    expect(host.client.view).toMatchObject({ status: 'lobby', dropped: 4 });
    expect(host.warnings).toEqual(['online: dropped a malformed message: undefined']);
  });

  it('ignores binary that reaches a client in the lobby, as a finished race’s traffic in flight', () => {
    const table = seated(2);
    const host = hostOf(table);
    host.connection.forge({ kind: 'binary', from: 2, bytes: encodeInputs(4, scriptedInput('tess', 0)) });
    host.connection.forge({ kind: 'binary', from: 9, bytes: new Uint8Array([1, 2]) });
    table.settle();

    expect(host.client.view).toMatchObject({ status: 'lobby', dropped: 0 });
    expect(host.warnings).toEqual([]);
  });

  it('finds worlds that differ only after the last hash check when the racers’ ends are compared', () => {
    const baseline = seated(2);
    raceToEnd(baseline);
    const finishTick = hostOf(baseline).client.world?.tick ?? 0;
    expect(finishTick % 60).toBeGreaterThan(1);

    const table = seated(2);
    const [host, tampered] = table.peers as [Peer, Peer];
    host.client.start(SEED);
    table.until(() => tampered.client.view.race?.simTick === finishTick - 1);
    const rival = tampered.client.world?.racers.find((each) => each.id === 'squib');
    if (!rival) throw new Error('no squib rival in the tampered world');
    rival.body.x += 1;
    // The host finishes and its `end` reaches the tampered peer before that peer steps its last tick.
    const holdTampered = (peer: Peer) => peer === tampered;
    table.until(() => isOver(host), holdTampered);
    table.round(holdTampered);
    expect(tampered.client.world?.tick).toBe(finishTick - 1);
    table.until(() => table.peers.every(isOver) && table.room.phase === 'lobby');
    table.settle();

    const desyncs = table.peers.map((peer) => peer.client.view.race?.desync);
    expect(desyncs.map((desync) => [desync?.tick, desync?.slot])).toEqual([
      [finishTick, 'tess'],
      [finishTick, 'player'],
    ]);
    expect(desyncs[0]?.local).toBe(desyncs[1]?.remote);
    expect(desyncs[0]?.remote).toBe(desyncs[1]?.local);
    expect(desyncs[0]?.local).not.toBe(desyncs[0]?.remote);
  });

  it('ends a race on a tampered world in desync on the clients that see it, and the room returns to the lobby', () => {
    const table = seated(3);
    const [host, tampered, third] = table.peers as [Peer, Peer, Peer];
    host.client.start(SEED);
    table.until(() => (tampered.client.view.race?.simTick ?? 0) >= 70);
    const racer = tampered.client.world?.racers.find((each) => each.id === 'tess');
    if (!racer) throw new Error('no tess racer in the tampered world');
    racer.body.x += 1;
    table.until(() => table.peers.every(isOver) && table.room.phase === 'lobby');

    const races = table.peers.map((peer) => peer.client.view.race);
    expect(races.map((race) => [race?.over, race?.desync?.tick])).toEqual([
      [true, 120],
      [true, 120],
      [true, 120],
    ]);
    expect([host, third].map((peer) => peer.client.view.race?.desync?.slot)).toEqual(['tess', 'tess']);
    expect(table.peers.map((peer) => peer.client.world?.race.result)).toEqual([null, null, null]);
  });
});
