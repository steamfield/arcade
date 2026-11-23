/**
 * The room screen as plain state, with no Phaser in it: a column of rows the cursor moves over.
 * Everyone has Character, Copy link and Leave; the host also has Course, Level and Start. The
 * online flow feeds it presses; `scenes/room.ts` draws it beside the list of players.
 */

import { CHARACTER_IDS, type CharacterId } from '../../logic/types.ts';
import type { LobbyView } from '../../net/lobby.ts';
import { ONLINE_DIFFICULTIES, type OnlineDifficulty } from '../../net/messages.ts';
import { type ScreenPress, wrapIndex } from './friends-screen.ts';

/** A row of the room screen. */
export type RoomRow = 'Character' | 'Course' | 'Level' | 'Start' | 'Copy link' | 'Leave';

/** The room screen: which row the cursor is on, as an index into `roomRows`. */
export interface RoomScreen {
  row: number;
}

/** What a press asks the online flow to do. */
export type RoomAction =
  | { kind: 'character'; character: CharacterId }
  | { kind: 'course'; course: string }
  | { kind: 'difficulty'; difficulty: OnlineDifficulty }
  | { kind: 'start' }
  | { kind: 'copy' }
  | { kind: 'leave' };

const HOST_ROWS: readonly RoomRow[] = ['Character', 'Course', 'Level', 'Start', 'Copy link', 'Leave'];
const GUEST_ROWS: readonly RoomRow[] = ['Character', 'Copy link', 'Leave'];

/** The screen as it opens, with the cursor on Character. */
export function createRoomScreen(): RoomScreen {
  return { row: 0 };
}

/** The rows `lobby` offers this peer, top to bottom: the host's has Course, Level and Start after Character. */
export function roomRows(lobby: LobbyView): readonly RoomRow[] {
  return lobby.you !== null && lobby.you === lobby.host ? HOST_ROWS : GUEST_ROWS;
}

/**
 * Applies `press` to `screen` and returns what it asks for, or null when it only moved the cursor
 * or asked for nothing. Up and down move over `roomRows(lobby)` and wrap; the cursor is clamped
 * first, since the rows change when the host does. Left and right step the row's value: Character
 * through `CHARACTER_IDS`, Course through `courses`, Level between the two online levels, each
 * wrapping. Fire on Start asks to start only while `lobby.canStart`; fire on Copy link and Leave
 * asks for those; dash asks to leave from any row.
 *
 * @param character - This peer's current pick.
 * @param courses - The ids of the courses a host may choose, in menu order.
 */
export function pressRoom(
  screen: RoomScreen,
  lobby: LobbyView,
  character: CharacterId,
  courses: readonly string[],
  press: ScreenPress,
): RoomAction | null {
  const rows = roomRows(lobby);
  screen.row = Math.min(Math.max(0, screen.row), rows.length - 1);
  const row = rows[screen.row] as RoomRow;
  switch (press) {
    case 'up':
    case 'down':
      screen.row = wrapIndex(screen.row, press === 'up' ? -1 : 1, rows.length);
      return null;
    case 'left':
    case 'right':
      return stepValue(row, lobby, character, courses, press === 'left' ? -1 : 1);
    case 'fire':
      return fireOn(row, lobby);
    case 'dash':
      return { kind: 'leave' };
  }
}

/** The value `row` takes one `step` along, or null for a row without a value to step. */
function stepValue(
  row: RoomRow,
  lobby: LobbyView,
  character: CharacterId,
  courses: readonly string[],
  step: number,
): RoomAction | null {
  switch (row) {
    case 'Character':
      return { kind: 'character', character: stepThrough(CHARACTER_IDS, character, step) };
    case 'Course':
      return courses.length > 1 ? { kind: 'course', course: stepThrough(courses, lobby.course, step) } : null;
    case 'Level':
      return { kind: 'difficulty', difficulty: stepThrough(ONLINE_DIFFICULTIES, lobby.difficulty, step) };
    default:
      return null;
  }
}

/** The entry of `values` `step` places from `current`, wrapping; a `current` not in `values` counts as the first. */
function stepThrough<T>(values: readonly T[], current: T, step: number): T {
  return values[wrapIndex(Math.max(0, values.indexOf(current)), step, values.length)] as T;
}

function fireOn(row: RoomRow, lobby: LobbyView): RoomAction | null {
  if (row === 'Start') return lobby.canStart ? { kind: 'start' } : null;
  if (row === 'Copy link') return { kind: 'copy' };
  if (row === 'Leave') return { kind: 'leave' };
  return null;
}
