/**
 * The friends screen as plain state, with no Phaser in it: a short menu (Create room, Join, Back)
 * and, under Join, six cells that spell a room code with the d-pad. The online flow feeds it
 * presses; `scenes/friends.ts` draws it.
 */

/** The menu's options, top to bottom. */
export const FRIENDS_OPTIONS = ['Create room', 'Join', 'Back'] as const;
export type FriendsOption = (typeof FRIENDS_OPTIONS)[number];

/** A button press the menu screens understand. */
export type ScreenPress = 'up' | 'down' | 'left' | 'right' | 'fire' | 'dash';

/** The friends screen. */
export interface FriendsScreen {
  /** `menu` shows the options; `code` shows the six cells. */
  mode: 'menu' | 'code';
  /** Index into `FRIENDS_OPTIONS`. */
  selected: number;
  /** The code so far: one character of `ROOM_CODE_ALPHABET` per cell, `ROOM_CODE_LENGTH` of them. */
  cells: string[];
  /** The cell the cursor is on. */
  cell: number;
}

/** What a press asks the online flow to do. */
export type FriendsAction = { kind: 'create' } | { kind: 'join'; code: string } | { kind: 'back' };

/** The screen as it opens: the menu, with Create room selected and every cell on the alphabet's first character. */
export function createFriendsScreen(): FriendsScreen {
  throw new Error('not implemented');
}

/**
 * Applies `press` to `screen` and returns what it asks for, or null when it only moved the cursor.
 * Menu: up and down move and wrap; fire picks (Join opens the cells); dash is Back. Cells: up and
 * down step the cell's character through the alphabet, wrapping; right and fire move to the next
 * cell, and from the last cell join with the code; left and dash move back a cell, and from the
 * first cell return to the menu.
 */
export function pressFriends(_screen: FriendsScreen, _press: ScreenPress): FriendsAction | null {
  throw new Error('not implemented');
}
