/**
 * Bursts: firing every held power-up's burst together and running the effects
 * that last beyond the firing tick (dashes, inflation, ink trails, comet flashes).
 *
 * Per-kind effects of `fireBurst` (tuning in `powerups/tuning.ts`), applied in stack order:
 * - jetFin: `status.dashing = DASH.ticks`, `dashDir` = unit input (facing when none), velocity set to
 *   DASH.speed along it on the firing tick and held there by `driveDash` while dashing.
 * - bubbleShield: pushes a Bubble at the racer's centre moving BUBBLE.speed along the same aim, ttl
 *   BUBBLE.ttlTicks, `seeking` when the seekerBubble combo is held; emits `bubble.spawned`.
 * - puffer: `status.inflated = INFLATE.ticks`.
 * - inkSac: pushes an InkCloud of INK.radius INK.behind px behind the racer's centre (opposite its
 *   facing), ttl INK.ttlTicks; emits `ink.spawned`.
 * - glowLantern: `flashAround(world, racer)` (hazards/contacts.ts).
 * Combo changes (`combosIn`): cannonball keeps the racer inflated for the whole dash; inkTrail drops
 * a cloud every INK.trailEveryTicks of the dash, from the firing tick, instead of one; inkBomb makes
 * the cloud INK.bombRadius and centred on the racer; comet flashes on the firing tick and again on
 * the dash's last tick (DASH.ticks - 1 ticks later). All matching combos apply.
 *
 * The dash's later effects (inkTrail clouds, the comet's second flash) read the stack each tick, so
 * a dash keeps them only while the racer still holds the pair; a hit that knocks one off ends them.
 */
import { flashAround } from '../hazards/contacts.ts';
import { breakCoral } from '../race/coral.ts';
import { centreOf, hitbox } from '../racers.ts';
import { type Box, type ComboName, type Intent, type Racer, TILE, type Vec, type World } from '../types.ts';
import { comboFor, combosIn } from './combos.ts';
import { BUBBLE, BURST_COOLDOWN_TICKS, DASH, INFLATE, INK } from './tuning.ts';

/**
 * The bursts slot of `stepWorld`: fires `fireBurst` for each racer whose intent presses burst.
 * `intents[i]` belongs to `racers[i]` (the active racers, with stunned and trapped intents already idle).
 */
export function fireBursts(world: World, racers: readonly Racer[], intents: readonly Intent[]): void {
  racers.forEach((racer, i) => {
    const intent = intents[i];
    if (intent?.burst) fireBurst(world, racer, intent.move);
  });
}

/**
 * Fires every held power-up's burst at once when the stack is non-empty and `burstCooldown` is 0:
 * sets `burstCooldown` to BURST_COOLDOWN_TICKS and emits `burst.fired` with the held kinds in stack
 * order and `comboFor(stack)`, then applies each kind's effect (see the module doc). The stack is
 * kept: bursting doesn't use power-ups up.
 *
 * @param move The racer's input this tick; aims the dash and bubble (facing when zero).
 * @returns true when it fired; false, changing nothing, otherwise.
 */
export function fireBurst(world: World, racer: Racer, move: Vec): boolean {
  if (racer.stack.length === 0 || racer.burstCooldown > 0) return false;
  const kinds = [...racer.stack];
  const combos = combosIn(kinds);
  racer.burstCooldown = BURST_COOLDOWN_TICKS;
  world.events.emit({ type: 'burst.fired', id: racer.id, kinds, combo: comboFor(kinds) });
  const aim = aimOf(racer, move);
  for (const kind of kinds) {
    switch (kind) {
      case 'jetFin':
        startDash(racer, aim);
        break;
      case 'bubbleShield':
        fireBubble(world, racer, aim, combos.includes('seekerBubble'));
        break;
      case 'puffer':
        racer.status.inflated = INFLATE.ticks;
        break;
      case 'inkSac':
        dropInk(world, racer, combos);
        break;
      case 'glowLantern':
        flashAround(world, racer);
        break;
    }
  }
  if (combos.includes('cannonball')) racer.status.inflated = Math.max(racer.status.inflated, DASH.ticks);
  return true;
}

/**
 * Holds a dashing racer's velocity at DASH.speed along `dashDir`, overriding swimming and drag.
 * Called in `stepWorld` after swimming and before the body moves; does nothing when not dashing.
 */
export function driveDash(racer: Racer): void {
  if (racer.status.dashing === 0) return;
  racer.body.vx = racer.dashDir.x * DASH.speed;
  racer.body.vy = racer.dashDir.y * DASH.speed;
}

/**
 * The per-tick side of bursts, run right after `fireBursts`: inflated racers break coral their
 * hitbox touches (via `breakCoral`), inkTrail dashes drop their clouds, and comet dashes flash on
 * their last tick.
 */
export function sustainBursts(world: World, racers: readonly Racer[]): void {
  for (const racer of racers) {
    if (racer.status.inflated > 0) smashCoral(world, racer);
    if (racer.status.dashing > 0) sustainDash(world, racer);
  }
}

/** The unit input direction, or straight ahead along facing when there is no input. */
function aimOf(racer: Racer, move: Vec): Vec {
  const length = Math.hypot(move.x, move.y);
  return length === 0 ? { x: racer.facing, y: 0 } : { x: move.x / length, y: move.y / length };
}

function startDash(racer: Racer, aim: Vec): void {
  racer.status.dashing = DASH.ticks;
  racer.dashDir = { ...aim };
  driveDash(racer);
}

function fireBubble(world: World, racer: Racer, aim: Vec, seeking: boolean): void {
  const centre = centreOf(racer);
  world.bubbles.push({
    x: centre.x,
    y: centre.y,
    vx: aim.x * BUBBLE.speed,
    vy: aim.y * BUBBLE.speed,
    ttl: BUBBLE.ttlTicks,
    owner: racer.id,
    seeking,
  });
  world.events.emit({ type: 'bubble.spawned', owner: racer.id });
}

/** One ink cloud: behind the racer, or a bigger one centred on it with the inkBomb combo. */
function dropInk(world: World, racer: Racer, combos: readonly ComboName[]): void {
  const centre = centreOf(racer);
  const bomb = combos.includes('inkBomb');
  world.inks.push({
    x: bomb ? centre.x : centre.x - racer.facing * INK.behind,
    y: centre.y,
    radius: bomb ? INK.bombRadius : INK.radius,
    ttl: INK.ttlTicks,
    owner: racer.id,
  });
  world.events.emit({ type: 'ink.spawned', owner: racer.id });
}

/** The dash's timed combo effects. The firing tick's cloud and flash came from `fireBurst`. */
function sustainDash(world: World, racer: Racer): void {
  const elapsed = DASH.ticks - racer.status.dashing;
  if (elapsed === 0) return;
  const combos = combosIn(racer.stack);
  if (combos.includes('inkTrail') && elapsed % INK.trailEveryTicks === 0) dropInk(world, racer, combos);
  if (combos.includes('comet') && racer.status.dashing === 1) flashAround(world, racer);
}

function smashCoral(world: World, racer: Racer): void {
  const tiles = tilesUnder(hitbox(racer));
  for (let ty = tiles.top; ty <= tiles.bottom; ty++) {
    for (let tx = tiles.left; tx <= tiles.right; tx++) breakCoral(world, tx, ty, racer.id);
  }
}

/** Inclusive tile range a box overlaps by positive area (edge-only contact excluded). */
function tilesUnder(box: Box): { left: number; right: number; top: number; bottom: number } {
  return {
    left: Math.floor(box.x / TILE),
    right: Math.ceil((box.x + box.w) / TILE) - 1,
    top: Math.floor(box.y / TILE),
    bottom: Math.ceil((box.y + box.h) / TILE) - 1,
  };
}
