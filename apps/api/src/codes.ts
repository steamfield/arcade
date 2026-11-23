/**
 * Room codes: making a random one and recognising a well-formed one. Pure: randomness comes in as
 * a function.
 */
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from './protocol.ts';

/**
 * Bytes at or above this are redrawn, so every alphabet character is equally likely: it is the
 * largest multiple of the alphabet's length that fits in a byte.
 */
const UNBIASED_BYTE_LIMIT = 256 - (256 % ROOM_CODE_ALPHABET.length);

const ROOM_CODE_PATTERN = new RegExp(`^[${ROOM_CODE_ALPHABET}]{${ROOM_CODE_LENGTH}}$`);

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

/** Whether `text` could be a room code: the right length, every character from the alphabet. */
export function isRoomCode(text: string): boolean {
  return ROOM_CODE_PATTERN.test(text);
}
