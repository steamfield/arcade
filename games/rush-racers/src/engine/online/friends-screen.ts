/**
 * The friends screen as plain state, with no Phaser in it: a short menu (Create room, Join, Back)
 * and, under Join, four cells that spell a room code with the d-pad or the keyboard. The online
 * flow feeds it presses and typing; `scenes/friends.ts` draws it.
 */
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from '@arcade/api/protocol';
import { roomLinkParam } from './room-link.ts';

/** The menu's options, top to bottom. */
export const FRIENDS_OPTIONS = ['Create room', 'Join', 'Back'] as const;

/** A button press the menu screens understand. */
export type ScreenPress = 'up' | 'down' | 'left' | 'right' | 'fire' | 'dash';

/** The friends screen. */
export interface FriendsScreen {
  /** `menu` shows the options; `code` shows the four cells. */
  mode: 'menu' | 'code';
  /** Index into `FRIENDS_OPTIONS`. */
  selected: number;
  /** The code so far: one character of `ROOM_CODE_ALPHABET` per cell, `ROOM_CODE_LENGTH` of them. */
  cells: string[];
  /** The cell the cursor is on. */
  cell: number;
}

/** One edit typed on the keyboard: a key or a paste, or a Backspace. `@arcade/input`'s `TextEdit`. */
export type CodeEdit = { text: string } | { backspace: true };

/** What a press asks the online flow to do. */
export type FriendsAction = { kind: 'create' } | { kind: 'join'; code: string } | { kind: 'back' };

/** `index + step` wrapped into `0..length - 1`. */
export function wrapIndex(index: number, step: number, length: number): number {
  return (((index + step) % length) + length) % length;
}

/** The screen as it opens: the menu, with Create room selected and every cell on the alphabet's first character. */
export function createFriendsScreen(): FriendsScreen {
  return {
    mode: 'menu',
    selected: 0,
    cells: Array.from({ length: ROOM_CODE_LENGTH }, () => ROOM_CODE_ALPHABET[0] as string),
    cell: 0,
  };
}

/**
 * Applies `press` to `screen` and returns what it asks for, or null when it only moved the cursor.
 * Menu: up and down move and wrap; fire picks (Join opens the cells); dash is Back. Cells: up and
 * down step the cell's character through the alphabet, wrapping; right and fire move to the next
 * cell, and from the last cell join with the code; left and dash move back a cell, and from the
 * first cell return to the menu.
 */
export function pressFriends(screen: FriendsScreen, press: ScreenPress): FriendsAction | null {
  return screen.mode === 'menu' ? pressMenu(screen, press) : pressCells(screen, press);
}

function pressMenu(screen: FriendsScreen, press: ScreenPress): FriendsAction | null {
  switch (press) {
    case 'up':
    case 'down':
      screen.selected = wrapIndex(screen.selected, press === 'up' ? -1 : 1, FRIENDS_OPTIONS.length);
      return null;
    case 'dash':
      return { kind: 'back' };
    case 'fire':
      return pickOption(screen);
    default:
      return null;
  }
}

function pickOption(screen: FriendsScreen): FriendsAction | null {
  const option = FRIENDS_OPTIONS[screen.selected];
  if (option === 'Create room') return { kind: 'create' };
  if (option === 'Back') return { kind: 'back' };
  // Join opens the cells on the first one, keeping whatever was spelled before.
  screen.mode = 'code';
  screen.cell = 0;
  return null;
}

function pressCells(screen: FriendsScreen, press: ScreenPress): FriendsAction | null {
  switch (press) {
    case 'up':
    case 'down':
      stepCharacter(screen, press === 'up' ? 1 : -1);
      return null;
    case 'right':
    case 'fire':
      if (screen.cell >= ROOM_CODE_LENGTH - 1) return { kind: 'join', code: screen.cells.join('') };
      screen.cell += 1;
      return null;
    default:
      if (screen.cell === 0) screen.mode = 'menu';
      else screen.cell -= 1;
      return null;
  }
}

/** Moves the cursor cell's character `step` places through the alphabet, wrapping. */
function stepCharacter(screen: FriendsScreen, step: number): void {
  const current = ROOM_CODE_ALPHABET.indexOf(screen.cells[screen.cell] ?? '');
  screen.cells[screen.cell] = ROOM_CODE_ALPHABET[wrapIndex(current, step, ROOM_CODE_ALPHABET.length)] as string;
}

/**
 * Applies `edit` to the cells; does nothing on the menu. Each typed letter of the alphabet, either
 * case, fills the cursor's cell and moves to the next, staying on the last cell so the player
 * can check the code before joining; other characters are skipped. A pasted room link fills every
 * cell with its code. Backspace steps back a cell and stops at the first.
 */
export function typeFriends(screen: FriendsScreen, edit: CodeEdit): void {
  if (screen.mode !== 'code') return;
  if ('backspace' in edit) {
    screen.cell = Math.max(0, screen.cell - 1);
    return;
  }
  const linked = linkedCode(edit.text);
  if (linked) {
    screen.cells = [...linked];
    screen.cell = ROOM_CODE_LENGTH - 1;
    return;
  }
  for (const char of edit.text.toUpperCase()) {
    if (!ROOM_CODE_ALPHABET.includes(char)) continue;
    screen.cells[screen.cell] = char;
    screen.cell = Math.min(screen.cell + 1, ROOM_CODE_LENGTH - 1);
  }
}

/** The room code in `text` when it is a room link, else null. */
function linkedCode(text: string): string | null {
  if (!URL.canParse(text.trim())) return null;
  const param = roomLinkParam(new URL(text.trim()).search);
  return param.kind === 'room' ? param.code : null;
}
