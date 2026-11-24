/**
 * The lockstep session, driven the way the client will drive it: each peer builds its own world
 * on Run Test, talks to the others through the in-memory room, and pumps once per round with a
 * scripted input. The room's latency, the order peers pump in and who goes silent are the knobs.
 */
import { createRng, EventLog } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import { COURSES } from '../logic/courses/index.ts';
import type { GameEvent } from '../logic/events.ts';
import { hashWorld } from '../logic/hash.ts';
import { RACER_IDS, type RacerId, type TickInput, type World } from '../logic/types.ts';
import { createWorld } from '../logic/world.ts';
import { decode, encodeInputs } from './codec.ts';
import { createSession, type Desync, type Session } from './session.ts';
import { createMemoryRoom, type MemoryRoom } from './transport/memory.ts';
import type { RoomConnection } from './transport/types.ts';

/** The short course these races run on. */
const RUN_TEST_COURSE = COURSES['run-test'];
/** Wall time one logic step stands for, rounded so stall sums stay exact. */
const STEP_MS = 16;
/** Rounds after which a race that has not ended counts as stuck. */
const ROUND_LIMIT = 20_000;
const RUN_RIGHT = { x: 1, y: 0 };
const JUMP_RIGHT = { x: Math.SQRT1_2, y: -Math.SQRT1_2 };

/** One peer: its connection, world and session, and what its session reported. */
interface Peer {
  slot: RacerId;
  connection: RoomConnection;
  world: World;
  session: Session;
  desyncs: Desync[];
  kicks: RacerId[];
  /** Every binary message that arrived for this peer, with the sender's peer id. */
  binaryArrived: { from: number; bytes: Uint8Array }[];
}

interface RaceOptions {
  peers: number;
  delay: number;
  latency?: () => number;
  kickAfterMs?: number | null;
}

/** Says whether `peer` sits out round number `round` (counted from 0): it neither reads nor pumps. */
type Skip = (peer: Peer, round: number) => boolean;

/** A race among `peers` people, each running a session on its own world, joined through one room. */
interface Race {
  room: MemoryRoom;
  peers: Peer[];
  /** Every peer still connected and not skipped handles what arrived and pumps once, in join order; then the room delivers. */
  round(skip?: Skip): void;
  /** Runs rounds until every peer still connected has finished its race. */
  runToEnd(skip?: Skip): void;
  /** Drops `peer`'s connection as a lost network would; it takes no further part. */
  leave(peer: Peer): void;
  /** Rounds run so far, which is also the room's clock: a message sent in round n with latency l arrives at the end of round n + l. */
  readonly roundsRun: number;
}

/**
 * Run right and jump on a cycle that differs per slot, pressing kick at the start of each jump,
 * which clears Run Test in roughly 700 ticks. It follows the peer's race clock, as a player
 * watching a stalled race would, so stalls do not change the route.
 */
function scriptedInput(slot: RacerId, clockTick: number): TickInput {
  const period = 40 + 10 * RACER_IDS.indexOf(slot);
  const phase = clockTick % period;
  return { move: phase < 25 ? JUMP_RIGHT : RUN_RIGHT, kick: phase === 0, use: false, cycle: 0, kickHeld: false };
}

/** Peers join in slot order, so the room's peer id n races in the nth slot. */
const slotOfPeer = (peerId: number): RacerId => RACER_IDS[peerId - 1] ?? 'player';

function isLeft(message: unknown): message is { type: 'left'; peer: number } {
  return typeof message === 'object' && message !== null && (message as { type?: unknown }).type === 'left';
}

/** Hands everything that arrived for `peer` to its session, in arrival order, as the client will. */
function handleArrivals(peer: Peer): void {
  for (const event of peer.connection.poll()) {
    if (event.kind === 'binary') {
      peer.binaryArrived.push({ from: event.from, bytes: event.bytes });
      peer.session.receive(slotOfPeer(event.from), event.bytes);
    }
    if (event.kind === 'json' && isLeft(event.message)) peer.session.peerLeft(slotOfPeer(event.message.peer));
  }
}

function createPeer(room: MemoryRoom, slot: RacerId, humans: readonly RacerId[], options: RaceOptions): Peer {
  const connection = room.connect();
  const world = createWorld(RUN_TEST_COURSE, new EventLog<GameEvent>(10_000), {
    seed: 7,
    humans,
    difficulty: 'normal',
  });
  const desyncs: Desync[] = [];
  const kicks: RacerId[] = [];
  const session = createSession({
    world,
    local: slot,
    humans,
    delay: options.delay,
    send: (bytes) => connection.send(bytes),
    onDesync: (desync) => desyncs.push(desync),
    kickAfterMs: options.kickAfterMs ?? null,
    requestKick: (kicked) => kicks.push(kicked),
  });
  return { slot, connection, world, session, desyncs, kicks, binaryArrived: [] };
}

function createRace(options: RaceOptions): Race {
  const room = createMemoryRoom(options.latency);
  const humans = RACER_IDS.slice(0, options.peers);
  const peers = humans.map((slot) => createPeer(room, slot, humans, options));
  // The room relays inputs only between racers, so the host starts a race for everyone, as the client will.
  const slots = Object.fromEntries(humans.map((slot, index) => [String(index + 1), slot]));
  peers[0]?.connection.send({ type: 'start', slots });
  const left = new Set<Peer>();
  let roundsRun = 0;
  const round = (skip: Skip = () => false) => {
    for (const peer of peers) {
      if (left.has(peer) || skip(peer, roundsRun)) continue;
      handleArrivals(peer);
      peer.session.pump(scriptedInput(peer.slot, peer.session.targetTick), STEP_MS);
    }
    room.deliver();
    roundsRun++;
  };
  const runToEnd = (skip?: Skip) => {
    const ended = () => peers.every((peer) => left.has(peer) || peer.world.race.phase === 'finished');
    roundsUntil({ round }, ended, skip);
  };
  const leave = (peer: Peer) => {
    left.add(peer);
    room.drop(peers.indexOf(peer) + 1, 'lost');
  };
  return {
    room,
    peers,
    round,
    runToEnd,
    leave,
    get roundsRun() {
      return roundsRun;
    },
  };
}

/** Runs rounds until `done` holds, failing after a bound so a broken session cannot hang the test. */
function roundsUntil(race: Pick<Race, 'round'>, done: () => boolean, skip?: Skip): void {
  for (let rounds = 0; rounds < ROUND_LIMIT && !done(); rounds++) race.round(skip);
  if (!done()) throw new Error(`condition not reached within ${ROUND_LIMIT} rounds`);
}

/** What `peer`'s race ended as: tick, phase, hash and which humans the AI took over. */
function outcomeOf(peer: Peer) {
  const takenOver = peer.world.racers.filter((racer) => racer.tookOverAt !== undefined).map((racer) => racer.id);
  return { tick: peer.world.tick, phase: peer.world.race.phase, hash: hashWorld(peer.world), takenOver };
}

/** Every peer's race finished in the same state with no desync, and only `takenOver` went to the AI. */
function expectSameFinishedRace(peers: Peer[], takenOver: RacerId[] = []): void {
  const [first] = peers.map(outcomeOf);
  expect(first).toMatchObject({ phase: 'finished', takenOver });
  expect(peers.map(outcomeOf)).toEqual(peers.map(() => first));
  expect(peers.flatMap((peer) => peer.desyncs)).toEqual([]);
}

const racerIn = (peer: Peer, slot: RacerId) => peer.world.racers.find((racer) => racer.id === slot);

describe('sessions that keep exchanging inputs', () => {
  const cases = [2, 4].flatMap((peers) =>
    [1, 3, 12].flatMap((delay) => [0, 2, 8].map((latency) => ({ peers, delay, latency }))),
  );

  it.each(cases)(
    '$peers peers finish hash-equal at delay $delay with latency $latency',
    ({ peers, delay, latency }) => {
      const race = createRace({ peers, delay, latency: () => latency });
      race.runToEnd();
      expectSameFinishedRace(race.peers);
    },
  );

  it('finish hash-equal when each message takes its own time to arrive', () => {
    const jitter = createRng(11);
    const race = createRace({ peers: 4, delay: 3, latency: () => jitter.int(0, 6) });
    race.runToEnd();
    expectSameFinishedRace(race.peers);
  });

  it('finish hash-equal when one peer pumps only every other round', () => {
    const race = createRace({ peers: 3, delay: 3 });
    race.runToEnd((peer, round) => peer.slot === 'tess' && round % 2 === 1);
    expectSameFinishedRace(race.peers);
  });
});

describe('a stall', () => {
  it('stops the clock of the peer waiting on late inputs, which then steps one tick per pump through the backlog', () => {
    const lateRounds = { from: Number.POSITIVE_INFINITY, until: 0, arriveAt: 0 };
    let roundNow = () => 0;
    // Everything sent during the late rounds arrives together, so a backlog of inputs lands at once.
    const latency = () => {
      const round = roundNow();
      return round >= lateRounds.from && round < lateRounds.until ? lateRounds.arriveAt - round : 0;
    };
    const race = createRace({ peers: 2, delay: 4, latency });
    roundNow = () => race.roundsRun;
    const [host] = race.peers as [Peer, Peer];
    roundsUntil(race, () => host.session.simTick >= 300);
    lateRounds.from = race.roundsRun;
    lateRounds.until = race.roundsRun + 10;
    lateRounds.arriveAt = race.roundsRun + 30;

    roundsUntil(race, () => host.session.waitingOn.length > 0);
    const stalledAt = { sim: host.session.simTick, target: host.session.targetTick };
    roundsUntil(race, () => race.roundsRun >= lateRounds.arriveAt);
    expect(host.session).toMatchObject({ simTick: stalledAt.sim, targetTick: stalledAt.target, waitingOn: ['tess'] });

    const progress: number[] = [];
    for (let round = 0; round < 10; round++) {
      race.round();
      progress.push(host.session.simTick - stalledAt.sim);
    }
    expect(progress).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(host.session.stalledMs).toBe(0);
  });

  it('schedules a use pressed during it for the next scheduled tick, once', () => {
    const delay = 4;
    const race = createRace({ peers: 2, delay });
    const [host, guest] = race.peers as [Peer, Peer];
    roundsUntil(race, () => host.session.simTick >= 120);
    roundsUntil(
      race,
      () => host.session.waitingOn.length > 0,
      (peer) => peer === guest,
    );
    const scheduledNext = host.session.targetTick + delay + 1;

    host.session.pump({ ...scriptedInput('player', 0), use: true }, STEP_MS);
    host.session.pump(scriptedInput('player', 1), STEP_MS);
    for (let round = 0; round < 30; round++) race.round();

    const useTicks = guest.binaryArrived
      .flatMap((arrived) => (arrived.from === 1 ? [decode(arrived.bytes)] : []))
      .flatMap((message) => (message?.kind === 'inputs' && message.input.use ? [message.tick] : []));
    expect(useTicks).toEqual([scheduledNext]);
  });

  it('asks for a kick of the silent peer after 5000 ms, not at 4900', () => {
    const race = createRace({ peers: 2, delay: 3, kickAfterMs: 5000 });
    const [host] = race.peers as [Peer, Peer];
    roundsUntil(
      race,
      () => host.session.waitingOn.length > 0,
      (peer) => peer !== host,
    );
    const stepMs = 100;
    // The pump that found the stall counted STEP_MS; 48 more of 100 ms reach 4800 + 16.
    for (let pump = 0; pump < 48; pump++) host.session.pump(scriptedInput('player', pump), stepMs);
    host.session.pump(scriptedInput('player', 48), stepMs - STEP_MS);
    expect({ stalledMs: host.session.stalledMs, kicks: host.kicks }).toEqual({ stalledMs: 4900, kicks: [] });
    host.session.pump(scriptedInput('player', 49), stepMs);
    expect({ stalledMs: host.session.stalledMs, kicks: host.kicks }).toEqual({ stalledMs: 5000, kicks: ['tess'] });
  });

  it('never asks for a kick when kickAfterMs is null', () => {
    const race = createRace({ peers: 2, delay: 3, kickAfterMs: null });
    const [host] = race.peers as [Peer, Peer];
    roundsUntil(
      race,
      () => host.session.waitingOn.length > 0,
      (peer) => peer !== host,
    );
    for (let pump = 0; pump < 300; pump++) host.session.pump(scriptedInput('player', pump), 100);
    expect({ stalledMs: host.session.stalledMs, kicks: host.kicks }).toEqual({
      stalledMs: 30_000 + STEP_MS,
      kicks: [],
    });
  });
});

describe('a peer that leaves', () => {
  it('is taken over on the tick after its last input on every session, and the race stays hash-equal', () => {
    const delay = 5;
    const race = createRace({ peers: 3, delay });
    const [host, leaver, lagger] = race.peers as [Peer, Peer, Peer];
    roundsUntil(race, () => host.session.simTick >= 250);
    const lastInputTick = leaver.session.targetTick + delay;
    expect(lagger.session.simTick).toBe(lastInputTick - 5);

    race.leave(leaver);
    const stayed = [host, lagger];
    race.runToEnd();

    expect(stayed.map((peer) => racerIn(peer, 'tess')?.tookOverAt)).toEqual([lastInputTick + 1, lastInputTick + 1]);
    expectSameFinishedRace(stayed, ['tess']);
  });

  it('before sending anything is taken over at delay + 1', () => {
    const delay = 3;
    const race = createRace({ peers: 3, delay });
    const [host, leaver, third] = race.peers as [Peer, Peer, Peer];
    race.leave(leaver);
    const stayed = [host, third];
    race.runToEnd();

    expect(stayed.map((peer) => racerIn(peer, 'tess')?.tookOverAt)).toEqual([delay + 1, delay + 1]);
    expectSameFinishedRace(stayed, ['tess']);
  });
});

describe('hash checks', () => {
  it('report a world tampered on one peer at the next multiple of 60 on both sides, which then stop stepping', () => {
    const race = createRace({ peers: 2, delay: 3 });
    const [host, guest] = race.peers as [Peer, Peer];
    roundsUntil(race, () => host.session.simTick >= 70);
    nudge(guest);

    roundsUntil(race, () => host.session.state === 'desynced' && guest.session.state === 'desynced');
    const stoppedAt = [host.session.simTick, guest.session.simTick];
    for (let round = 0; round < 30; round++) race.round();

    const hostDesync = host.desyncs[0];
    expect(hostDesync?.local).not.toBe(hostDesync?.remote);
    expect(host.desyncs).toEqual([{ tick: 120, local: hostDesync?.local, remote: hostDesync?.remote, slot: 'tess' }]);
    expect(guest.desyncs).toEqual([
      { tick: 120, local: hostDesync?.remote, remote: hostDesync?.local, slot: 'player' },
    ]);
    expect([host.session.simTick, guest.session.simTick]).toEqual(stoppedAt);
  });

  it('compare a remote hash that arrived early once this peer reaches its tick', () => {
    const race = createRace({ peers: 2, delay: 12 });
    const [host, guest] = race.peers as [Peer, Peer];
    nudge(guest);
    roundsUntil(race, () => host.session.simTick >= 50);
    const guestOnly = (peer: Peer) => peer === host;
    roundsUntil(race, () => guest.session.simTick >= 60, guestOnly);
    race.round(guestOnly);

    handleArrivals(host);
    expect({ simTick: host.session.simTick, desyncs: host.desyncs }).toEqual({ simTick: 50, desyncs: [] });
    roundsUntil(race, () => host.session.simTick >= 60);
    expect(host.desyncs.map((desync) => desync.tick)).toEqual([60]);
  });

  it('compare a remote hash that arrives after this peer has stepped past its tick', () => {
    const race = createRace({ peers: 2, delay: 12 });
    const [host, guest] = race.peers as [Peer, Peer];
    nudge(guest);
    roundsUntil(race, () => host.session.simTick >= 58);
    roundsUntil(
      race,
      () => host.session.simTick >= 70,
      (peer) => peer === guest,
    );
    const guestOnly = (peer: Peer) => peer === host;
    roundsUntil(race, () => guest.session.simTick >= 60, guestOnly);
    race.round(guestOnly);

    handleArrivals(host);
    expect(host.session.simTick).toBe(70);
    expect(host.desyncs.map((desync) => ({ tick: desync.tick, slot: desync.slot }))).toEqual([
      { tick: 60, slot: 'tess' },
    ]);
  });
});

/** Moves `peer`'s own racer one pixel, a change no input made, so its world no longer matches the others'. */
function nudge(peer: Peer): void {
  const racer = racerIn(peer, 'player');
  if (!racer) throw new Error(`no player racer in ${peer.slot}'s world`);
  racer.body.x += 1;
}

describe('dropped messages', () => {
  it('leave input for a gone slot, input that skips ticks and malformed bytes without effect', () => {
    const race = createRace({ peers: 3, delay: 3 });
    const [host, leaver, witness] = race.peers as [Peer, Peer, Peer];
    roundsUntil(race, () => host.session.simTick >= 100);
    race.leave(leaver);
    roundsUntil(race, () => host.session.simTick >= 120);

    const goneInput = encodeInputs(host.session.simTick + 4, { ...scriptedInput('tess', 0), use: true });
    const gappedInput = encodeInputs(host.session.simTick + 50, scriptedInput('squib', 0));
    const accepted = [
      host.session.receive('tess', goneInput),
      host.session.receive('squib', gappedInput),
      host.session.receive('squib', new Uint8Array([9, 9, 9])),
      host.session.receive('squib', new Uint8Array(0)),
    ];
    race.runToEnd();

    expect(accepted).toEqual([false, false, false, false]);
    expectSameFinishedRace([host, witness], ['tess']);
  });
});

describe('createSession', () => {
  it('refuses a local slot outside humans and a delay outside 1 to 12', () => {
    const humans: RacerId[] = ['player', 'tess'];
    const world = createWorld(RUN_TEST_COURSE, new EventLog<GameEvent>(100), { seed: 1, humans });
    const options = {
      world,
      local: 'player' as RacerId,
      humans,
      delay: 3,
      send: () => {},
      onDesync: () => {},
      kickAfterMs: null,
      requestKick: () => {},
    };
    expect(() => createSession({ ...options, local: 'bo' })).toThrow(
      'local slot bo is not one of humans [player, tess]',
    );
    expect(() => createSession({ ...options, delay: 13 })).toThrow(
      'delay 13 must be a whole number of ticks from 1 to 12',
    );
  });
});
