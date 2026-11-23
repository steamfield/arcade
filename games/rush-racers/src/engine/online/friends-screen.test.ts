import { ROOM_CODE_ALPHABET } from '@arcade/api/protocol';
import { describe, expect, it } from 'vitest';
import {
  createFriendsScreen,
  type FriendsAction,
  type FriendsScreen,
  pressFriends,
  type ScreenPress,
} from './friends-screen.ts';

/** Presses each of `presses` in order and returns every action they asked for. */
function pressAll(screen: FriendsScreen, presses: readonly ScreenPress[]): (FriendsAction | null)[] {
  return presses.map((press) => pressFriends(screen, press));
}

const FIRST = ROOM_CODE_ALPHABET[0] as string;
const LAST = ROOM_CODE_ALPHABET[ROOM_CODE_ALPHABET.length - 1] as string;

describe('the friends menu', () => {
  it('opens on the menu with Create room selected and six blank cells', () => {
    expect(createFriendsScreen()).toEqual({ mode: 'menu', selected: 0, cells: Array(6).fill(FIRST), cell: 0 });
  });

  it('moves down and up through the options, wrapping at both ends', () => {
    const screen = createFriendsScreen();
    const seen = (['down', 'down', 'down', 'up'] as const).map((press) => {
      expect(pressFriends(screen, press)).toBeNull();
      return screen.selected;
    });
    expect(seen).toEqual([1, 2, 0, 2]);
  });

  it('asks to create a room on fire over Create room', () => {
    const screen = createFriendsScreen();
    expect(pressFriends(screen, 'fire')).toEqual({ kind: 'create' });
    expect(screen.mode).toBe('menu');
  });

  it('opens the cells on fire over Join without asking for anything', () => {
    const screen = createFriendsScreen();
    expect(pressAll(screen, ['down', 'fire'])).toEqual([null, null]);
    expect(screen).toMatchObject({ mode: 'code', cell: 0 });
  });

  it('asks to go back on fire over Back, and on dash from any option', () => {
    const onBack = createFriendsScreen();
    expect(pressAll(onBack, ['up', 'fire'])).toEqual([null, { kind: 'back' }]);
    const onJoin = createFriendsScreen();
    expect(pressAll(onJoin, ['down', 'dash'])).toEqual([null, { kind: 'back' }]);
    expect(onJoin.mode).toBe('menu');
  });

  it('ignores left and right', () => {
    const screen = createFriendsScreen();
    expect(pressAll(screen, ['left', 'right'])).toEqual([null, null]);
    expect(screen).toEqual(createFriendsScreen());
  });
});

describe('the code cells', () => {
  function openCells(): FriendsScreen {
    const screen = createFriendsScreen();
    pressAll(screen, ['down', 'fire']);
    return screen;
  }

  it('steps the cell up through the alphabet and wraps from the last back to the first', () => {
    const screen = openCells();
    pressAll(screen, ['up', 'up']);
    expect(screen.cells[0]).toBe(ROOM_CODE_ALPHABET[2]);
    pressAll(screen, Array(ROOM_CODE_ALPHABET.length - 2).fill('up'));
    expect(screen.cells[0]).toBe(FIRST);
  });

  it('steps down from the first character to the last', () => {
    const screen = openCells();
    expect(pressFriends(screen, 'down')).toBeNull();
    expect(screen.cells).toEqual([LAST, FIRST, FIRST, FIRST, FIRST, FIRST]);
  });

  it('moves to the next cell on right and on fire, and joins with the code from the last cell', () => {
    const screen = openCells();
    const actions = pressAll(screen, ['up', 'right', 'up', 'up', 'fire', 'down', 'right', 'right', 'fire']);
    expect(actions).toEqual(Array(9).fill(null));
    expect(screen.cell).toBe(5);
    expect(pressFriends(screen, 'up')).toBeNull();
    expect(pressFriends(screen, 'fire')).toEqual({ kind: 'join', code: `34${LAST}${FIRST}${FIRST}3` });
  });

  it('steps back a cell on left and on dash, and from the first cell returns to the menu keeping the cells', () => {
    const screen = openCells();
    pressAll(screen, ['up', 'right', 'right', 'up']);
    expect(pressAll(screen, ['left', 'dash'])).toEqual([null, null]);
    expect(screen.cell).toBe(0);
    expect(pressFriends(screen, 'dash')).toBeNull();
    expect(screen).toEqual({ mode: 'menu', selected: 1, cells: ['3', FIRST, '3', FIRST, FIRST, FIRST], cell: 0 });
  });

  it('reopens on the first cell with the code spelled so far', () => {
    const screen = openCells();
    pressAll(screen, ['right', 'up', 'left', 'left', 'fire']);
    expect(screen).toEqual({ mode: 'code', selected: 1, cells: [FIRST, '3', FIRST, FIRST, FIRST, FIRST], cell: 0 });
  });
});
