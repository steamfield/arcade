/**
 * Firing items: one press fires the selected item's effect and spends one of its charges. Also the
 * per-tick side of items that last: holding a dash's speed and breaking coral while inflated.
 *
 * Per-kind effects of `fireItem` (tuning in `powerups/tuning.ts`). "Aim" is the unit input, or
 * facing when there is none.
 * - jetFin: a boost. `status.dashing = DASH.ticks` at DASH.speed along the aim, held by `driveDash`.
 * - cannonball: a dash of CANNONBALL.ticks at CANNONBALL.speed, inflated and invulnerable for its
 *   whole length, so it breaks coral and hits the racers it touches and no hit ends it.
 * - bubbleShield: a trap bubble moving BUBBLE.speed along the aim (`bubble.spawned`).
 * - puffer: inflates for INFLATE.ticks, never shortening a longer inflation.
 * - inkSac: one ink cloud INK.behind px behind the racer (`ink.spawned`).
 * - glowLantern: `flashAround`.
 * - homingSquid: `launchSquid` along the aim.
 * - riptide: `layRiptide` along the aim.
 * - undertow: `fireUndertow`.
 * - mimic: `spawnDecoy`.
 * Jet Fins and Cannonball do nothing while a dash is already running: no charge is spent and
 * nothing is emitted.
 */
import { flashAround } from '../hazards/contacts.ts';
import { launchSquid } from '../hazards/squids.ts';
import { bodyTiles } from '../level/query.ts';
import { mediumOf } from '../media/index.ts';
import { length } from '../num.ts';
import { breakCoral } from '../race/coral.ts';
import { centreOf, hitbox } from '../racers.ts';
import type { Intent, PowerUpKind, Racer, Vec, World } from '../types.ts';
import { spawnDecoy } from './decoys.ts';
import { cycleSelection, selectSlot, spendCharge } from './inventory.ts';
import { layRiptide } from './riptides.ts';
import { BUBBLE, CANNONBALL, DASH, INFLATE, INK, USE_COOLDOWN_TICKS } from './tuning.ts';
import { fireUndertow } from './undertow.ts';

/** The kinds that start a dash, and so can't fire while one is running. */
const DASHING_KINDS: readonly PowerUpKind[] = ['jetFin', 'cannonball'];

/**
 * The items slot of `stepWorld`. For each racer: a `cycle` moves its selection first, then a
 * `useSlot` fires that slot, else a `use` press fires the selected slot. `intents[i]` belongs to
 * `racers[i]` (the active racers, with stunned and trapped intents already cut to `cycle` only).
 */
export function useItems(world: World, racers: readonly Racer[], intents: readonly Intent[]): void {
  racers.forEach((racer, i) => {
    const intent = intents[i];
    if (!intent) return;
    if (intent.cycle !== 0) cycleSelection(world, racer, intent.cycle);
    if (intent.useSlot !== undefined) fireItem(world, racer, intent.useSlot, intent.move);
    else if (intent.use) fireItem(world, racer, racer.selected, intent.move);
  });
}

/**
 * Fires the item in `slot`: selects that slot, sets `useCooldown = USE_COOLDOWN_TICKS`, emits
 * `item.used {id, kind, slot, chargesLeft}`, applies the kind's effect (see the module doc) and
 * spends one charge (`spendCharge`, which empties the slot at 0).
 *
 * @param move The racer's input this tick; it aims dashes, bubbles, squids and lanes.
 * @returns true when it fired; false, changing nothing and emitting nothing, when the slot is empty
 *   or out of range, the cooldown is running, or a dashing kind is pressed mid-dash.
 */
export function fireItem(world: World, racer: Racer, slot: number, move: Vec): boolean {
  const item = racer.items[slot];
  if (!item || racer.useCooldown > 0) return false;
  if (DASHING_KINDS.includes(item.kind) && racer.status.dashing > 0) return false;
  selectSlot(world, racer, slot);
  racer.useCooldown = USE_COOLDOWN_TICKS;
  world.events.emit({ type: 'item.used', id: racer.id, kind: item.kind, slot, chargesLeft: item.charges - 1 });
  applyEffect(world, racer, item.kind, aimOf(racer, move));
  spendCharge(world, racer, slot);
  return true;
}

/** One kind's effect on firing, as the module doc lists. */
function applyEffect(world: World, racer: Racer, kind: PowerUpKind, aim: Vec): void {
  switch (kind) {
    case 'jetFin':
      startDash(world, racer, aim, DASH);
      return;
    case 'cannonball':
      fireCannonball(world, racer, aim);
      return;
    case 'bubbleShield':
      fireBubble(world, racer, aim);
      return;
    case 'puffer':
      racer.status.inflated = Math.max(racer.status.inflated, INFLATE.ticks);
      return;
    case 'inkSac':
      dropInk(world, racer);
      return;
    case 'glowLantern':
      flashAround(world, racer);
      return;
    case 'homingSquid':
      launchSquid(world, racer, aim);
      return;
    case 'riptide':
      layRiptide(world, racer, aim);
      return;
    case 'undertow':
      fireUndertow(world, racer);
      return;
    case 'mimic':
      spawnDecoy(world, racer);
      return;
  }
}

/**
 * Holds a dashing racer's velocity at `dashSpeed` along `dashDir`, overriding swimming and drag, on
 * both axes or, where the medium says so (`effects.dashAxes`), horizontally only so its gravity
 * keeps working. Called in `stepWorld` after swimming and before the body moves. Leaves velocity
 * alone when not dashing (the dash ran out or a hit ended it).
 *
 * @throws {Error} When the world names a medium that is neither shipped nor registered.
 */
export function driveDash(world: World, racer: Racer): void {
  if (racer.status.dashing === 0) return;
  racer.body.vx = racer.dashDir.x * racer.dashSpeed;
  if (mediumOf(world).effects.dashAxes === 'both') racer.body.vy = racer.dashDir.y * racer.dashSpeed;
}

/** The per-tick side of items, run right after `useItems`: inflated racers break the coral their hitbox touches. */
export function sustainItems(world: World, racers: readonly Racer[]): void {
  for (const racer of racers) {
    if (racer.status.inflated > 0) smashCoral(world, racer);
  }
}

/** The unit input direction, or straight ahead along facing when there is no input. */
function aimOf(racer: Racer, move: Vec): Vec {
  const size = length(move.x, move.y);
  return size === 0 ? { x: racer.facing, y: 0 } : { x: move.x / size, y: move.y / size };
}

function startDash(world: World, racer: Racer, aim: Vec, dash: { ticks: number; speed: number }): void {
  racer.status.dashing = dash.ticks;
  racer.dashDir = { ...aim };
  racer.dashSpeed = dash.speed;
  driveDash(world, racer);
}

function fireCannonball(world: World, racer: Racer, aim: Vec): void {
  startDash(world, racer, aim, CANNONBALL);
  racer.status.inflated = Math.max(racer.status.inflated, CANNONBALL.ticks);
  racer.status.invulnerable = Math.max(racer.status.invulnerable, CANNONBALL.ticks);
}

function fireBubble(world: World, racer: Racer, aim: Vec): void {
  const centre = centreOf(racer);
  world.bubbles.push({
    x: centre.x,
    y: centre.y,
    vx: aim.x * BUBBLE.speed,
    vy: aim.y * BUBBLE.speed,
    ttl: BUBBLE.ttlTicks,
    owner: racer.id,
  });
  world.events.emit({ type: 'bubble.spawned', owner: racer.id });
}

function dropInk(world: World, racer: Racer): void {
  const centre = centreOf(racer);
  world.inks.push({
    x: centre.x - racer.facing * INK.behind,
    y: centre.y,
    radius: INK.radius,
    ttl: INK.ttlTicks,
    owner: racer.id,
  });
  world.events.emit({ type: 'ink.spawned', owner: racer.id });
}

function smashCoral(world: World, racer: Racer): void {
  const tiles = bodyTiles(hitbox(racer));
  for (let ty = tiles.top; ty <= tiles.bottom; ty++) {
    for (let tx = tiles.left; tx <= tiles.right; tx++) breakCoral(world, tx, ty, racer.id);
  }
}
