/**
 * The one rule for a racer touching an enemy, shared by every kind: a racer mid-dash bonks it, a
 * racer landing on it from above stomps it in a medium with a stomp bounce, anyone else gets hurt.
 * Also how an enemy is beaten (`defeatEnemy`), which a Homing Squid uses too.
 */
import { TICK_DT } from '@arcade/core';
import { mediumOf } from '../../media/index.ts';
import { scatterPearls } from '../../pickups/pearl-drift.ts';
import { hitbox } from '../../racers.ts';
import { isDowned } from '../../status.ts';
import type { Box, Enemy, EnemyKind, Racer, RacerId, World } from '../../types.ts';
import { overlaps, squareAt } from '../boxes.ts';
import { applyHit } from '../hits.ts';
import { CRAB, EEL, SHARK } from './tuning.ts';

/** Each kind's numbers that the touch rule reads. */
const KIND: Record<EnemyKind, { size: number; pearls: number }> = { shark: SHARK, eel: EEL, crab: CRAB };

/**
 * How far, in px, a stomping racer may sink into an enemy beyond one tick's fall. Enemies move
 * too, so the racer's fall alone can leave it a little deeper than it came down this tick.
 */
const STOMP_SLACK = 2;

/** What a bonk was: a dash (or boost) into the enemy, or a landing on top of it. */
type BonkHow = 'dash' | 'stomp';

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
 * stops touching, and is ignored by that enemy until then), stomps it when `isStomping` (a bonk that
 * also bounces the racer up at the medium's `stompBounce`), and is otherwise hit with the enemy's
 * kind as cause when the enemy is harmful and the racer isn't downed (`applyHit` passes over an
 * invulnerable one). A bonk emits `enemy.bonked` with how it happened and takes 1 hp; at 0 the enemy
 * is defeated (`defeatEnemy`), else `onBonked` reacts (a shark staggers).
 *
 * @throws {Error} When the world names a medium that is neither shipped nor registered.
 */
export function touchEnemies(
  world: World,
  racers: readonly Racer[],
  onBonked: (enemy: Enemy, racer: Racer) => void,
): void {
  const { stompBounce } = mediumOf(world).effects;
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
      if (isBonking(racer)) bonk(world, { enemy, index, racer, how: 'dash' }, onBonked);
      else if (stompBounce !== null && isStomping(racer, enemy)) {
        bonk(world, { enemy, index, racer, how: 'stomp' }, onBonked);
        racer.body.vy = -stompBounce;
      } else if (isHarmful(enemy) && !isDowned(racer)) applyHit(world, racer, enemy.kind, null, enemy.at);
    }
  });
}

/**
 * Whether `racer`, touching `enemy`, came down onto it from above this tick: it is falling and not
 * downed, and sinks into the enemy's top no deeper than one tick's fall plus STOMP_SLACK. Needs
 * no stored positions; a racer meeting the enemy side on overlaps it far deeper than that.
 */
export function isStomping(racer: Racer, enemy: Enemy): boolean {
  const { vy } = racer.body;
  if (vy <= 0 || isDowned(racer)) return false;
  const box = hitbox(racer);
  const depthFromAbove = box.y + box.h - enemyBox(enemy).y;
  return depthFromAbove <= vy * TICK_DT + STOMP_SLACK;
}

/** One bonk: which enemy (and its index in `world.enemies`), by whom, and how. */
interface Bonk {
  enemy: Enemy;
  index: number;
  racer: Racer;
  how: BonkHow;
}

function bonk(world: World, { enemy, index, racer, how }: Bonk, onBonked: (enemy: Enemy, racer: Racer) => void): void {
  enemy.hp = Math.max(0, enemy.hp - 1);
  enemy.bonkedBy.push(racer.id);
  world.events.emit({ type: 'enemy.bonked', index, kind: enemy.kind, by: racer.id, hpLeft: enemy.hp, how });
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
