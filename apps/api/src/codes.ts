/**
 * Room codes.
 */

/**
 * A room code: `ROOM_CODE_LENGTH` characters of `ROOM_CODE_ALPHABET`.
 *
 * @param randomByte - Returns a uniformly random integer from 0 to 255; the Worker passes one backed by `crypto.getRandomValues`.
 */
export function randomRoomCode(_randomByte: () => number): string {
  throw new Error('not implemented');
}
