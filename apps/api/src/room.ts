/**
 * The Room Durable Object: one per room code. It relays what its peers send to each other, tells
 * them who joined and left, derives whether a race is on, and never runs the game.
 */
import { DurableObject } from 'cloudflare:workers';
import type { Env } from './index.ts';

/** One room. See `protocol.ts` for everything it reads and sends. */
export class Room extends DurableObject<Env> {
  /** Marks this room's code as taken. Returns false when it already was, so the Worker picks another code. */
  async claim(): Promise<boolean> {
    throw new Error('not implemented');
  }

  /** Accepts a peer's socket, or accepts and closes it with the `CLOSE` code that says why not. */
  override async fetch(_request: Request): Promise<Response> {
    throw new Error('not implemented');
  }
}
