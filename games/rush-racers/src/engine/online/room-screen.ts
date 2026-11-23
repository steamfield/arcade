/**
 * The room screen as plain state, with no Phaser in it: a column of rows the cursor moves over.
 * Everyone has Character, Copy link and Leave; the host also has Course, Level and Start. The
 * online flow feeds it presses; `scenes/room.ts` draws it beside the list of players.
 */

import type { CharacterId } from '../../logic/types.ts';
import type { LobbyView } from '../../net/lobby.ts';
import type { OnlineDifficulty } from '../../net/messages.ts';
import type { ScreenPress } from './friends-screen.ts';

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

/** The screen as it opens, with the cursor on Character. */
export function createRoomScreen(): RoomScreen {
  throw new Error('not implemented');
}

/** The rows `lobby` offers this peer, top to bottom: the host's has Course, Level and Start after Character. */
export function roomRows(_lobby: LobbyView): readonly RoomRow[] {
  throw new Error('not implemented');
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
  _screen: RoomScreen,
  _lobby: LobbyView,
  _character: CharacterId,
  _courses: readonly string[],
  _press: ScreenPress,
): RoomAction | null {
  throw new Error('not implemented');
}
