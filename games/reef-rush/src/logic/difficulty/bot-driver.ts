/**
 * How the difficulty harness drives the player's racer with a bot. Most bots drive it the way a
 * rival drives itself: the world asks the rival AI each tick. The no-dash bot (`BOT_PROFILES.noDash`)
 * must never dash or fire, and the rival AI adds a dash of its own when a crab or eel is about to
 * touch it, so the harness asks the AI for that bot's steering and passes on only the stick, as
 * input a player who holds forward and steers would give. Test-only; nothing in the game imports it.
 */
import type { Rng } from '@arcade/core';
import { BOT_PROFILES } from '../ai/profiles.ts';
import { rivalIntent } from '../ai/rival.ts';
import { playerOf } from '../racers.ts';
import type { RivalProfile, TickInput, World } from '../types.ts';

/** No stick, no buttons: what the world gets while a bot drives through the rival AI. */
const IDLE: TickInput = { move: { x: 0, y: 0 }, kick: false, use: false, cycle: 0 };

/** Gives the input for the player's racer this tick, before the world steps. */
export type BotDriver = (world: World) => TickInput;

/**
 * The driver for `bot` in `world`, which was created with `bot` as its `playerBot`. For the no-dash
 * bot it takes the player's AI memory out of the world, so the world reads the input instead of
 * asking the AI.
 *
 * @throws {Error} When the no-dash bot is asked for but the world's player has no AI memory.
 */
export function botDriver(world: World, bot: RivalProfile): BotDriver {
  if (bot !== BOT_PROFILES.noDash) return () => IDLE;
  const player = playerOf(world);
  const memory = player.ai;
  if (!memory)
    throw new Error('The no-dash bot needs a world created with it as playerBot, but the player has no AI memory');
  player.ai = null;
  const rng: Rng = world.rngs['ai.player'];
  return (current) => {
    if (current.race.phase !== 'racing' || player.finished) return IDLE;
    player.ai = memory;
    try {
      return { move: rivalIntent(current, player, rng).move, kick: false, use: false, cycle: 0 };
    } finally {
      player.ai = null;
    }
  };
}
