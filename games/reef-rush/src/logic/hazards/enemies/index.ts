/**
 * Enemies: creatures on the course a racer beats with a dash bonk. This file builds them from the
 * level and dispatches each tick to the kind's own module (shark, eel, crab), then resolves touches
 * through the shared rule in `contact.ts`.
 */
import { type Enemy, type EnemyKind, type Level, type Racer, TILE, type World } from '../../types.ts';
import { touchEnemies } from './contact.ts';
import { requireCrabFloor, stepCrab } from './crab.ts';
import { eelOutward, startEel, stepEel } from './eel.ts';
import { staggerShark, stepShark } from './shark.ts';
import { CRAB, EEL, SHARK } from './tuning.ts';

/** How each kind starts: its hp and first mode (an eel's is then moved along its cycle by `startEel`). */
const START: Record<EnemyKind, Pick<Enemy, 'hp' | 'mode'>> = {
  shark: { hp: SHARK.hp, mode: 'patrol' },
  eel: { hp: EEL.hp, mode: 'hidden' },
  crab: { hp: CRAB.hp, mode: 'patrol' },
};

/**
 * One enemy per `level.enemies` entry, in order, unhurt: sharks and crabs at their tile centre facing
 * left and patrolling, eels partway through their cycle by an offset from their home tile (`startEel`).
 *
 * Each eel's lunge direction (`out`) is worked out here, once; sharks and crabs get a zero `out`.
 *
 * @throws {LevelError} With row and col for an eel with no rock beside it or no open water to lunge
 *   into, or a crab with no rock below it.
 */
export function createEnemies(level: Level): Enemy[] {
  return level.enemies.map(({ kind, tile }) => {
    const out = kind === 'eel' ? eelOutward(level, tile) : { x: 0, y: 0 };
    if (kind === 'crab') requireCrabFloor(level, tile);
    const enemy: Enemy = {
      kind,
      home: { ...tile },
      at: { x: (tile.x + 0.5) * TILE, y: (tile.y + 0.5) * TILE },
      vel: { x: 0, y: 0 },
      facing: -1,
      out,
      ...START[kind],
      modeTicks: 0,
      target: null,
      bonkedBy: [],
    };
    if (kind === 'eel') startEel(enemy);
    return enemy;
  });
}

/**
 * The enemies slot of `stepWorld`, after the jellies: moves each enemy that isn't defeated by its
 * kind's rules, then resolves its contacts with `racers` (`touchEnemies`: a bonk, or a hit).
 */
export function stepEnemies(world: World, racers: readonly Racer[]): void {
  world.enemies.forEach((enemy, index) => {
    if (enemy.mode === 'defeated') return;
    if (enemy.kind === 'shark') stepShark(world, enemy, index, racers);
    else if (enemy.kind === 'eel') stepEel(world, enemy, index);
    else stepCrab(world, enemy);
  });
  touchEnemies(world, racers, (enemy, racer) => {
    if (enemy.kind === 'shark') staggerShark(enemy, racer);
  });
}
