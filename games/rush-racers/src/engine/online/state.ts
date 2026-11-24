/**
 * What the online screens draw: the two screens' cursors, the client's view of the room, and the
 * line of status text under them. The online flow owns one of these and the scenes only read it.
 */
import type { ClientView } from '../../net/client.ts';
import type { FriendsScreen } from './friends-screen.ts';
import type { RoomScreen } from './room-screen.ts';

/** The online screens' state. */
export interface OnlineState {
  friends: FriendsScreen;
  room: RoomScreen;
  /** The room code, once a room is created or joined; null on the friends screen. */
  code: string | null;
  /** The client's view; null until a connection is opened. */
  view: ClientView | null;
  /** A line to show the player ("Creating room...", "Room is full", "Link copied"); null for none. */
  notice: string | null;
}
