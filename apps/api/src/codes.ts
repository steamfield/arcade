/**
 * Making a random room code (`isRoomCode` in `protocol.ts` recognises one). Pure: randomness comes
 * in as a function.
 */
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from './protocol.ts';

/**
 * Bytes at or above this are redrawn, so every alphabet character is equally likely: it is the
 * largest multiple of the alphabet's length that fits in a byte.
 */
const UNBIASED_BYTE_LIMIT = 256 - (256 % ROOM_CODE_ALPHABET.length);

/**
 * A room code: `ROOM_CODE_LENGTH` characters of `ROOM_CODE_ALPHABET`.
 *
 * @param randomByte - Returns a uniformly random integer from 0 to 255; the Worker passes one backed by `crypto.getRandomValues`.
 */
export function randomRoomCode(randomByte: () => number): string {
  let code = '';
  while (code.length < ROOM_CODE_LENGTH) {
    const byte = randomByte();
    if (byte < UNBIASED_BYTE_LIMIT) code += ROOM_CODE_ALPHABET[byte % ROOM_CODE_ALPHABET.length];
  }
  return code;
}
