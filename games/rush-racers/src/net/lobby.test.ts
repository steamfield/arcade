/**
 * The lobby one peer holds about its room, driven by the room's messages and the other peers'
 * relayed lobby messages exactly as a client would feed them in.
 */
import { describe, expect, it } from 'vitest';
import type { CharacterId } from '../logic/types.ts';
import { createLobby, type Lobby, type LobbyOptions } from './lobby.ts';
import { type RelayedGameMessage, StartSchema } from './messages.ts';

const OPTIONS: LobbyOptions = { character: 'rudy', course: 'reef', difficulty: 'normal' };

/** A lobby welcomed into a room as peer `you`, with `peers` present in join order and `host` hosting. */
function welcomed(you: number, peers: number[], host: number, options: LobbyOptions = OPTIONS): Lobby {
  const lobby = createLobby(options);
  lobby.apply({ type: 'welcome', you, peers, host, phase: 'lobby' });
  return lobby;
}

/** A relayed lobby message from peer `from`. */
function entry(
  from: number,
  character: CharacterId,
  fields: { ping?: number; ready?: boolean; course?: string; difficulty?: 'normal' | 'hard' } = {},
): RelayedGameMessage {
  return { type: 'lobby', from, character, ping: fields.ping ?? 0, ready: fields.ready ?? true, ...fields };
}

/** Each peer's id and label, in the order the view lists them. */
function roster(lobby: Lobby): string[] {
  return lobby.view.peers.map((peer) => `${peer.label}:${peer.id}`);
}

describe('lobby roster', () => {
  it('lists peers in join order and relabels them after a leave', () => {
    const lobby = welcomed(2, [1, 2], 1);
    lobby.apply({ type: 'joined', peer: 3, host: 1 });
    lobby.apply({ type: 'joined', peer: 4, host: 1 });
    expect(roster(lobby)).toEqual(['P1:1', 'P2:2', 'P3:3', 'P4:4']);

    lobby.apply({ type: 'left', peer: 2, host: 1 });
    expect(roster(lobby)).toEqual(['P1:1', 'P2:3', 'P3:4']);
  });

  it('follows the host the room names after the host leaves', () => {
    const lobby = welcomed(3, [1, 2, 3], 1);
    lobby.apply({ type: 'left', peer: 1, host: 2 });

    expect(lobby.view.host).toBe(2);
    expect(lobby.view.peers.map((peer) => [peer.id, peer.host])).toEqual([
      [2, true],
      [3, false],
    ]);
  });

  it('shows picks, pings and readiness from lobby messages, and nothing for a silent peer', () => {
    const lobby = welcomed(1, [1, 2, 3, 4], 1);
    lobby.apply(entry(2, 'gil', { ping: 40 }));
    lobby.apply(entry(3, 'onyx', { ping: 25 }));
    lobby.apply(entry(3, 'nib', { ping: 30, ready: false }));

    expect(lobby.view.peers).toEqual([
      { id: 1, label: 'P1', character: 'rudy', ping: null, ready: true, host: true, you: true },
      { id: 2, label: 'P2', character: 'gil', ping: 40, ready: true, host: false, you: false },
      { id: 3, label: 'P3', character: 'nib', ping: 30, ready: false, host: false, you: false },
      { id: 4, label: 'P4', character: null, ping: null, ready: false, host: false, you: false },
    ]);
  });

  it('ignores lobby and left messages about peers it does not know', () => {
    const lobby = welcomed(2, [1, 2], 1);
    lobby.apply(entry(7, 'gil', { course: 'elsewhere', difficulty: 'hard' }));
    lobby.apply({ type: 'left', peer: 9, host: 9 });

    expect(roster(lobby)).toEqual(['P1:1', 'P2:2']);
    expect(lobby.view.host).toBe(1);

    lobby.apply({ type: 'joined', peer: 7, host: 1 });
    expect(lobby.view.peers[2]).toMatchObject({ id: 7, character: null, ready: false });
  });

  it('sets the room phase from the room', () => {
    const lobby = welcomed(1, [1, 2], 1);
    lobby.apply({ type: 'phase', phase: 'racing' });
    expect(lobby.view.phase).toBe('racing');
  });
});

describe('lobby race settings', () => {
  it('takes course and difficulty from the host only', () => {
    const lobby = welcomed(3, [1, 2, 3], 1);
    lobby.apply(entry(2, 'gil', { course: 'not-host', difficulty: 'hard' }));
    expect([lobby.view.course, lobby.view.difficulty]).toEqual(['reef', 'normal']);

    lobby.apply(entry(1, 'onyx', { course: 'bramble', difficulty: 'hard' }));
    expect([lobby.view.course, lobby.view.difficulty]).toEqual(['bramble', 'hard']);
  });

  it('starts a host whose save is on easy on normal', () => {
    const lobby = welcomed(1, [1], 1, { ...OPTIONS, difficulty: 'easy' });
    expect(lobby.view.difficulty).toBe('normal');
    expect(lobby.mine().difficulty).toBe('normal');
  });

  it("sends this peer's own entry, with the race settings only when host", () => {
    const guest = welcomed(2, [1, 2], 1);
    guest.setCharacter('selene');
    guest.setPing(41.6);
    guest.setReady(false);
    guest.setCourse('ignored');
    guest.setDifficulty('hard');
    expect(guest.mine()).toEqual({ type: 'lobby', character: 'selene', ping: 42, ready: false });
    expect([guest.view.course, guest.view.difficulty]).toEqual(['reef', 'normal']);

    const host = welcomed(1, [1, 2], 1);
    host.setCourse('bramble');
    host.setDifficulty('hard');
    expect(host.mine()).toEqual({
      type: 'lobby',
      character: 'rudy',
      ping: 0,
      ready: true,
      course: 'bramble',
      difficulty: 'hard',
    });
  });
});

describe('lobby canStart', () => {
  it('is true for a ready host in the lobby with another ready peer', () => {
    const lobby = welcomed(1, [1, 2], 1);
    lobby.apply(entry(2, 'gil'));
    expect(lobby.view.canStart).toBe(true);
  });

  it('is false before the room has welcomed this peer', () => {
    expect(createLobby(OPTIONS).view.canStart).toBe(false);
  });

  it('is false for a peer that is not host', () => {
    const lobby = welcomed(2, [1, 2], 1);
    lobby.apply(entry(1, 'gil'));
    expect(lobby.view.canStart).toBe(false);
  });

  it('is false during a race', () => {
    const lobby = welcomed(1, [1, 2], 1);
    lobby.apply(entry(2, 'gil'));
    lobby.apply({ type: 'phase', phase: 'racing' });
    expect(lobby.view.canStart).toBe(false);
  });

  it('is false while the host itself is away', () => {
    const lobby = welcomed(1, [1, 2, 3], 1);
    lobby.apply(entry(2, 'gil'));
    lobby.apply(entry(3, 'onyx'));
    lobby.setReady(false);
    expect(lobby.view.canStart).toBe(false);
  });

  it('is false when no other peer is ready', () => {
    const lobby = welcomed(1, [1, 2, 3], 1);
    lobby.apply(entry(2, 'gil', { ready: false }));
    expect(lobby.view.canStart).toBe(false);
  });
});

describe('lobby buildStart', () => {
  it('gives slots in join order to the ready peers, skipping one who is away', () => {
    const lobby = welcomed(1, [1, 2, 3, 4], 1);
    lobby.apply(entry(2, 'gil'));
    lobby.apply(entry(3, 'onyx', { ready: false }));
    lobby.apply(entry(4, 'nib'));

    const start = lobby.buildStart(77);
    expect(start).toEqual({
      type: 'start',
      seed: 77,
      course: 'reef',
      difficulty: 'normal',
      slots: { '1': 'player', '2': 'tess', '4': 'squib' },
      characters: { player: 'rudy', tess: 'gil', squib: 'nib' },
      delay: 3,
    });
    expect(StartSchema.safeParse(start).success).toBe(true);
  });

  it('keeps the earliest pick and gives later duplicates the first free character', () => {
    const lobby = welcomed(1, [1, 2, 3, 4], 1);
    lobby.apply(entry(2, 'rudy'));
    lobby.apply(entry(3, 'streak'));
    lobby.apply(entry(4, 'streak'));

    const start = lobby.buildStart(1);
    expect(start.characters).toEqual({ player: 'rudy', tess: 'gil', squib: 'streak', bo: 'onyx' });
    expect(StartSchema.safeParse(start).success).toBe(true);
  });

  it('uses the shortest delay for local pings', () => {
    const lobby = welcomed(1, [1, 2], 1);
    lobby.setPing(1);
    lobby.apply(entry(2, 'gil', { ping: 2 }));
    expect(lobby.buildStart(1).delay).toBe(3);
  });

  it('covers the slowest pair of peers: 8 ticks for two at 50 ms', () => {
    const lobby = welcomed(1, [1, 2, 3], 1);
    lobby.setPing(50);
    lobby.apply(entry(2, 'gil', { ping: 50 }));
    lobby.apply(entry(3, 'onyx', { ping: 10 }));
    expect(lobby.buildStart(1).delay).toBe(8);
  });

  it('caps the delay at 12 ticks', () => {
    const lobby = welcomed(1, [1, 2], 1);
    lobby.setPing(300);
    lobby.apply(entry(2, 'gil', { ping: 300 }));
    expect(lobby.buildStart(1).delay).toBe(12);
  });

  it('throws when this peer is not host', () => {
    const lobby = welcomed(2, [1, 2], 1);
    lobby.apply(entry(1, 'gil'));
    expect(() => lobby.buildStart(1)).toThrow('buildStart: peer 2 is not host (host is 1)');
  });

  it('throws when fewer than two peers are ready', () => {
    const lobby = welcomed(1, [1, 2], 1);
    lobby.apply(entry(2, 'gil', { ready: false }));
    expect(() => lobby.buildStart(1)).toThrow('buildStart: a race needs 2 ready peers, 1 ready');
  });
});
