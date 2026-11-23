import { describe, expect, it } from 'vitest';
import { CHARACTER_IDS, type CharacterId } from '../../logic/types.ts';
import type { LobbyPeer, LobbyView } from '../../net/lobby.ts';
import type { ScreenPress } from './friends-screen.ts';
import { createRoomScreen, pressRoom, type RoomAction, type RoomScreen, roomRows } from './room-screen.ts';

const COURSES = ['shallows', 'bramble', 'trench'] as const;

function peer(id: number, host: number, you: number): LobbyPeer {
  return { id, label: `P${id}`, character: 'rudy', ping: 20, ready: true, host: id === host, you: id === you };
}

/** A two-peer lobby as peer `you` sees it, with peer 1 host. */
function lobbyFor(you: number, overrides: Partial<LobbyView> = {}): LobbyView {
  return {
    you,
    host: 1,
    phase: 'lobby',
    peers: [peer(1, 1, you), peer(2, 1, you)],
    course: 'shallows',
    difficulty: 'normal',
    canStart: you === 1,
    ...overrides,
  };
}
const HOST = lobbyFor(1);
const GUEST = lobbyFor(2);

/** A room screen with the cursor on `row`. */
function onRow(row: number): RoomScreen {
  return { ...createRoomScreen(), row };
}

function press(
  screen: RoomScreen,
  key: ScreenPress,
  lobby: LobbyView = HOST,
  options: { character?: CharacterId; courses?: readonly string[] } = {},
): RoomAction | null {
  return pressRoom(screen, lobby, options.character ?? 'rudy', options.courses ?? COURSES, key);
}

describe('the room rows', () => {
  it('gives a guest Character, Copy link and Leave', () => {
    expect(roomRows(GUEST)).toEqual(['Character', 'Copy link', 'Leave']);
  });

  it('gives the host Course, Level and Start after Character', () => {
    expect(roomRows(HOST)).toEqual(['Character', 'Course', 'Level', 'Start', 'Copy link', 'Leave']);
  });

  it('gives a peer not yet welcomed the guest rows', () => {
    expect(roomRows(lobbyFor(1, { you: null, host: null }))).toEqual(['Character', 'Copy link', 'Leave']);
  });
});

describe('the room cursor', () => {
  it('opens on Character', () => {
    expect(createRoomScreen()).toEqual({ row: 0 });
  });

  it('moves down and up over the rows and wraps at both ends', () => {
    const screen = createRoomScreen();
    const seen = (['up', 'down', 'down', 'down'] as const).map((key) => {
      expect(press(screen, key, GUEST)).toBeNull();
      return screen.row;
    });
    expect(seen).toEqual([2, 0, 1, 2]);
  });

  it("is clamped to a guest's rows when the host's rows shrink, and acts on the row it lands on", () => {
    const screen = onRow(5);
    expect(press(screen, 'fire', GUEST)).toEqual({ kind: 'leave' });
    expect(screen.row).toBe(2);
    const fromStart = onRow(3);
    expect(press(fromStart, 'down', GUEST)).toBeNull();
    expect(fromStart.row).toBe(0);
  });
});

describe('stepping a row value', () => {
  it('steps Character through every character and wraps both ways', () => {
    expect(press(onRow(0), 'right', GUEST, { character: 'rudy' })).toEqual({ kind: 'character', character: 'gil' });
    expect(press(onRow(0), 'left', GUEST, { character: 'rudy' })).toEqual({ kind: 'character', character: 'rook' });
    expect(press(onRow(0), 'right', GUEST, { character: 'rook' })).toEqual({ kind: 'character', character: 'rudy' });
    const last = CHARACTER_IDS[CHARACTER_IDS.length - 2] as CharacterId;
    expect(press(onRow(0), 'right', GUEST, { character: last })).toEqual({ kind: 'character', character: 'rook' });
  });

  it('steps Course through the given courses and wraps both ways', () => {
    expect(press(onRow(1), 'right')).toEqual({ kind: 'course', course: 'bramble' });
    expect(press(onRow(1), 'left')).toEqual({ kind: 'course', course: 'trench' });
    expect(press(onRow(1), 'right', lobbyFor(1, { course: 'trench' }))).toEqual({ kind: 'course', course: 'shallows' });
  });

  it('steps a course that is not in the list as if it were the first', () => {
    const offList = lobbyFor(1, { course: 'run-test' });
    expect(press(onRow(1), 'right', offList)).toEqual({ kind: 'course', course: 'bramble' });
    expect(press(onRow(1), 'left', offList)).toEqual({ kind: 'course', course: 'trench' });
  });

  it('does nothing on Course when there is one course', () => {
    expect(press(onRow(1), 'right', HOST, { courses: ['shallows'] })).toBeNull();
    expect(press(onRow(1), 'left', HOST, { courses: ['shallows'] })).toBeNull();
  });

  it('toggles Level between normal and hard', () => {
    expect(press(onRow(2), 'right')).toEqual({ kind: 'difficulty', difficulty: 'hard' });
    expect(press(onRow(2), 'left')).toEqual({ kind: 'difficulty', difficulty: 'hard' });
    expect(press(onRow(2), 'right', lobbyFor(1, { difficulty: 'hard' }))).toEqual({
      kind: 'difficulty',
      difficulty: 'normal',
    });
  });

  it("gives nothing for left and right on a guest's Copy link and Leave, nor on a stale cursor clamped to Leave", () => {
    const actions = [1, 2, 4].flatMap((row) => [press(onRow(row), 'left', GUEST), press(onRow(row), 'right', GUEST)]);
    expect(actions).toEqual(Array(6).fill(null));
  });

  it('gives nothing for left and right on Start, Copy link and Leave', () => {
    const actions = [3, 4, 5].flatMap((row) => [press(onRow(row), 'left'), press(onRow(row), 'right')]);
    expect(actions).toEqual(Array(6).fill(null));
  });
});

describe('firing on a row', () => {
  it('asks to start from Start only while the lobby can start', () => {
    expect(press(onRow(3), 'fire')).toEqual({ kind: 'start' });
    expect(press(onRow(3), 'fire', lobbyFor(1, { canStart: false, phase: 'racing' }))).toBeNull();
  });

  it('asks to copy the link and to leave from those rows, for host and guest alike', () => {
    expect(press(onRow(4), 'fire')).toEqual({ kind: 'copy' });
    expect(press(onRow(5), 'fire')).toEqual({ kind: 'leave' });
    expect(press(onRow(1), 'fire', GUEST)).toEqual({ kind: 'copy' });
    expect(press(onRow(2), 'fire', GUEST)).toEqual({ kind: 'leave' });
  });

  it('gives nothing for fire on the value rows', () => {
    expect([0, 1, 2].map((row) => press(onRow(row), 'fire'))).toEqual([null, null, null]);
  });

  it('asks to leave on dash from every row', () => {
    const fromHostRows = [0, 1, 2, 3, 4, 5].map((row) => press(onRow(row), 'dash'));
    const fromGuestRows = [0, 1, 2].map((row) => press(onRow(row), 'dash', GUEST));
    expect([...fromHostRows, ...fromGuestRows]).toEqual(Array(9).fill({ kind: 'leave' }));
  });
});
