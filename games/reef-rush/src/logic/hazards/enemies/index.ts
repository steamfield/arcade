/**
 * Enemies: creatures on the course a racer beats with a dash bonk. This file builds them from the
 * level and dispatches each tick to the kind's own module (shark, eel, crab).
 *
 * Phase 3 scaffold: `createEnemies` is final; `stepEnemies` is a no-op until lane a fills it in.
 */
import { type Enemy, type Level, type Racer, TILE, type World } from '../../types.ts';

/** One enemy per `level.enemies` entry, in order, at its tile centre, patrolling, unhurt, facing left. */
export function createEnemies(level: Level): Enemy[] {
  return level.enemies.map(({ kind, tile }) => ({
    kind,
    home: { ...tile },
    at: { x: (tile.x + 0.5) * TILE, y: (tile.y + 0.5) * TILE },
    vel: { x: 0, y: 0 },
    facing: -1,
    mode: 'patrol',
    modeTicks: 0,
    hp: 1,
    target: null,
  }));
}

/**
 * The enemies slot of `stepWorld`, after the jellies: moves each enemy, and resolves its contacts
 * with `racers` (a hit on the racer, or a bonk when the racer's `status.bonking` is above 0).
 */
export function stepEnemies(_world: World, _racers: readonly Racer[]): void {}
