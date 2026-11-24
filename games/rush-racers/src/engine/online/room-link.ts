/**
 * Room links: the `?room=<code>` a player shares, read back when a friend opens it. Plain string
 * work, no DOM, so the runtime and its tests use it alike.
 */
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from '@arcade/api/protocol';

/** What a page's query says about a room. */
export type RoomLinkParam =
  /** No `?room=`. */
  | { kind: 'none' }
  /** A well-formed code, upper-cased. */
  | { kind: 'room'; code: string }
  /** A `?room=` that is not a room code, as given. */
  | { kind: 'invalid'; value: string };

/** Whether `code` is `ROOM_CODE_LENGTH` characters, each from `ROOM_CODE_ALPHABET`. */
export function isRoomCode(code: string): boolean {
  return code.length === ROOM_CODE_LENGTH && [...code].every((char) => ROOM_CODE_ALPHABET.includes(char));
}

/** The room `search` (a `location.search`) names. Codes are read case-insensitively, since people retype links. */
export function roomLinkParam(search: string): RoomLinkParam {
  const value = new URLSearchParams(search).get('room');
  if (value === null) return { kind: 'none' };
  const code = value.trim().toUpperCase();
  return isRoomCode(code) ? { kind: 'room', code } : { kind: 'invalid', value };
}

/** The link that opens room `code` on the page at `href`: the same page with only `?room=` in its query. */
export function roomLink(href: string, code: string): string {
  const url = new URL(href);
  url.search = '';
  url.hash = '';
  url.searchParams.set('room', code);
  return url.toString();
}
