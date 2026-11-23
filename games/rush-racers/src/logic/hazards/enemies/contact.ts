/**
 * The one rule for a racer touching an enemy, shared by every kind: a racer mid-dash bonks it, anyone
 * else gets hurt. Also how an enemy is beaten (`defeatEnemy`), which a Homing Squid uses too.
 */
import { scatterPearls } from '../../pickups/pearl-drift.ts';
import { hitbox } from '../../racers.ts';
import { isDowned } from '../../status.ts';
import type { Box, Enemy, EnemyKind, Racer, RacerId, World } from '../../types.ts';
import { overlaps, squareAt } from '../boxes.ts';
import { applyHit } from '../hits.ts';
import { CRAB, EEL, SHARK } from './tuning.ts';

/** Each kind's numbers that the touch rule reads. */
const KIND: Record<EnemyKind, { size: number; pearls: number }> = { shark: SHARK, eel: EEL, crab: CRAB };

/** Whether `enemy` can touch anything now: not defeated, and an eel only while it is out of its hole. */
export function canTouch(enemy: Enemy): boolean {
  if (enemy.mode === 'defeated') return false;
  return enemy.kind !== 'eel' || enemy.mode === 'lunge';
}

/** Whether a touching `enemy` hurts: it can touch and isn't staggered. */
export function isHarmful(enemy: Enemy): boolean {
  return canTouch(enemy) && enemy.mode !== 'stagger';
}

/** The square box `enemy` touches with, centred on it. */
export function enemyBox(enemy: Enemy): Box {
  return squareAt(enemy.at, KIND[enemy.kind].size);
}

/**
 * Whether `racer` bonks an enemy it touches rather than being hurt: it dashed in the last
 * `ENEMY.bonkTicks` (`status.bonking`), or is boosting (Jet Fins, Cannonball) or inflated (Puffer).
 */
export function isBonking(racer: Racer): boolean {
  return racer.status.bonking > 0 || racer.status.dashing > 0 || racer.status.inflated > 0;
}

/**
 * Resolves every touchable enemy against `racers`, in `racers` order. A racer whose hitbox overlaps
 * an enemy's box bonks it when `isBonking` (once per contact: it goes on `enemy.bonkedBy` until it
 * stops touching, and is ignored by that enemy until then), and is otherwise hit with the enemy's kind
 * as cause when the enemy is harmful and the racer isn't downed (`applyHit` passes over an
 * invulnerable one). A bonk emits `enemy.bonked` and takes 1 hp; at 0 the enemy is defeated
 * (`defeatEnemy`), else `onBonked` reacts (a shark staggers).
 */
export function touchEnemies(
  world: World,
  racers: readonly Racer[],
  onBonked: (enemy: Enemy, racer: Racer) => void,
): void {
  world.enemies.forEach((enemy, index) => {
    if (!canTouch(enemy)) return;
    for (const racer of racers) {
      if (!canTouch(enemy)) return;
      const touching = overlaps(enemyBox(enemy), hitbox(racer));
      if (!touching) {
        enemy.bonkedBy = enemy.bonkedBy.filter((id) => id !== racer.id);
        continue;
      }
      if (enemy.bonkedBy.includes(racer.id)) continue;
      if (isBonking(racer)) bonk(world, enemy, index, racer, onBonked);
      else if (isHarmful(enemy) && !isDowned(racer)) applyHit(world, racer, enemy.kind, null, enemy.at);
    }
  });
}

function bonk(
  world: World,
  enemy: Enemy,
  index: number,
  racer: Racer,
  onBonked: (enemy: Enemy, racer: Racer) => void,
): void {
  enemy.hp = Math.max(0, enemy.hp - 1);
  enemy.bonkedBy.push(racer.id);
  world.events.emit({ type: 'enemy.bonked', index, kind: enemy.kind, by: racer.id, hpLeft: enemy.hp });
  if (enemy.hp === 0) defeatEnemy(world, index, racer.id, racer.facing);
  else onBonked(enemy, racer);
}

/**
 * Beats the enemy at `world.enemies[index]` for good: mode 'defeated', still, hp 0; emits
 * `enemy.defeated {by}`, then bursts its kind's pearls loose from its centre (`pearls.burst`), which
 * anyone may collect at once (`droppedBy` null).
 *
 * @param facing The way the pearls fly: they fan out ahead of whoever beat it, so it swims into them.
 * @throws {Error} When `index` names no enemy: a caller bug.
 */
export function defeatEnemy(world: World, index: number, by: RacerId, facing: 1 | -1): void {
  const enemy = world.enemies[index];
  if (!enemy) throw new Error(`defeatEnemy: no enemy at index ${index} (the world has ${world.enemies.length})`);
  enemy.mode = 'defeated';
  enemy.modeTicks = 0;
  enemy.hp = 0;
  enemy.vel = { x: 0, y: 0 };
  enemy.target = null;
  world.events.emit({ type: 'enemy.defeated', index, kind: enemy.kind, by });
  const count = KIND[enemy.kind].pearls;
  // scatterPearls fans pearls behind the facing it is given, so the opposite facing sends them ahead.
  world.loosePearls.push(...scatterPearls(enemy.at, facing === 1 ? -1 : 1, count, null));
  world.events.emit({ type: 'pearls.burst', index, count });
}
