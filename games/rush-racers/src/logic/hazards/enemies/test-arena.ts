/**
 * Test-only setup for enemy tests: the player's own small level with the three rivals sealed in lanes
 * of their own above it, so they race without ever reaching the enemies under test.
 */
import type { EventLog } from '@arcade/core';
import type { GameEvent } from '../../events.ts';
import { length } from '../../num.ts';
import { centreOf } from '../../racers.ts';
import { hold, raceOn, racerOf, step } from '../../test-world.ts';
import type { Difficulty, Enemy, Vec, World } from '../../types.ts';

/**
 * A racing world whose player area is `rows` (each written with its own walls, the player start `1`
 * and a finish `F`), under three sealed one-row rival lanes of the same width.
 */
export function arena(rows: readonly string[], options: { seed?: number; difficulty?: Difficulty } = {}) {
  const width = rows[0]?.length ?? 0;
  const wall = '#'.repeat(width);
  const lane = (digit: string) => `#${digit}${'.'.repeat(width - 4)}F#`;
  const ascii = [wall, lane('2'), wall, lane('3'), wall, lane('4'), wall, ...rows].join('\n');
  const { world, log } = raceOn(ascii, { seed: options.seed ?? 1 });
  if (options.difficulty) world.difficulty = options.difficulty;
  return { world, log };
}

/** Rows above the player area in every `arena`: add to a player-area row to get its level row. */
export const ARENA_TOP = 7;

/** The world's enemy at `index`. */
export function enemyAt(world: World, index = 0): Enemy {
  const enemy = world.enemies[index];
  if (!enemy) throw new Error(`No enemy at index ${index} (the world has ${world.enemies.length})`);
  return enemy;
}

/** The unit direction from the player's centre to `enemy`'s, or right when they coincide. */
export function towardEnemy(world: World, enemy: Enemy): Vec {
  const centre = centreOf(racerOf(world, 'player'));
  const distance = length(enemy.at.x - centre.x, enemy.at.y - centre.y);
  return distance === 0
    ? { x: 1, y: 0 }
    : { x: (enemy.at.x - centre.x) / distance, y: (enemy.at.y - centre.y) / distance };
}

/**
 * Swims the player straight at `enemy` until its centre is within `px` of the enemy's (at most 300
 * ticks), so a dash can start right before contact.
 */
export function swimUntilNear(world: World, log: EventLog<GameEvent>, enemy: Enemy, px: number): void {
  const player = racerOf(world, 'player');
  for (let tick = 0; tick < 300; tick++) {
    const centre = centreOf(player);
    const dx = centre.x - enemy.at.x;
    const dy = centre.y - enemy.at.y;
    if (dx * dx + dy * dy <= px * px) return;
    step(world, log, 1, hold(towardEnemy(world, enemy)));
  }
  throw new Error(
    `The player never came within ${px}px of the enemy (it stopped at ${JSON.stringify(centreOf(player))})`,
  );
}
