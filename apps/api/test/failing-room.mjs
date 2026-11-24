import { DurableObject } from 'cloudflare:workers';

export { default } from '../src/index.ts';

/** The real Worker routes, with a Room binding that fails at the same RPC boundary as a quota error. */
export class Room extends DurableObject {
  async claim() {
    throw new Error(this.env.ROOM_FAILURE);
  }

  async fetch() {
    throw new Error(this.env.ROOM_FAILURE);
  }
}
