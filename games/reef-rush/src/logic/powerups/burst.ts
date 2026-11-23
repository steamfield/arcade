/**
 * Bursts: firing every held power-up's burst together and running the effects
 * that last beyond the firing tick (dashes, inflation, ink trails, comet flashes).
 *
 * Per-kind effects of `fireBurst` (tuning in `powerups/tuning.ts`), applied in stack order:
 * - jetFin: `status.dashing = DASH.ticks`, `dashDir` = unit input (facing when none), velocity set to
 *   DASH.speed along it on the firing tick and held there by `driveDash` while dashing (on the axes
 *   the medium holds, `effects.dashAxes`).
 * - bubbleShield: pushes a Bubble at the racer's centre moving BUBBLE.speed along the same aim, ttl
 *   BUBBLE.ttlTicks, `seeking` (it lights the dark and stuns jellies it passes) when the lanternBubble
 *   combo is held; emits `bubble.spawned`. With the bubbleDecoy combo it fires no bubble: the decoy wears it.
 * - puffer: `status.inflated = INFLATE.ticks`.
 * - inkSac: pushes an InkCloud of INK.radius INK.behind px behind the racer's centre (opposite its
 *   facing), ttl INK.ttlTicks; emits `ink.spawned`. With the inkSquid combo it drops none: the squid
 *   bursts ink on whoever it latches.
 * - glowLantern: `flashAround(world, racer)` (hazards/contacts.ts).
 * - homingSquid: `launchSquid` (hazards/squids.ts) along the same aim, `inked` with the inkSquid combo.
 * - riptide: `layRiptide` (riptides.ts) along the aim, from the racer's centre; with the surfline combo
 *   it lays nothing now: the dash lays a longer, stronger lane where it ends.
 * - undertow: `fireUndertow` (undertow.ts), then the power-up is used up (`powerup.lost` cause 'used').
 *   The one kind a burst doesn't keep.
 * - mimic: `spawnDecoy` (decoys.ts), bubbled with the bubbleDecoy combo.
 * Combo changes (`combosIn`): cannonball keeps the racer inflated for the whole dash; inkTrail drops
 * a cloud every INK.trailEveryTicks of the dash, from the firing tick, instead of one; inkBomb makes
 * the cloud INK.bombRadius and centred on the racer; comet flashes on the firing tick and again on
 * the dash's last tick (DASH.ticks - 1 ticks later); surfline lays its lane at the racer's centre on that
 * same last tick. All matching combos apply.
 *
 * The dash's later effects (inkTrail clouds, the comet's second flash) follow `racer.dashCombos`,
 * fixed when the dash fires: gaining a kind mid-dash never starts one, and `popForHit` removes a
 * combo whose pair a hit breaks. A landed hit also ends the dash (`applyHit` zeroes dashing).
 */
import { flashAround } from '../hazards/contacts.ts';
import { launchSquid } from '../hazards/squids.ts';
import { bodyTiles } from '../level/query.ts';
import { mediumOf } from '../media/index.ts';
import { length } from '../num.ts';
import { breakCoral } from '../race/coral.ts';
import { centreOf, hitbox } from '../racers.ts';
import type { ComboName, Intent, PowerUpKind, Racer, Vec, World } from '../types.ts';
import { combosIn } from './combos.ts';
import { spawnDecoy } from './decoys.ts';
import { layRiptide, PLAIN_LANE, SURFLINE_LANE } from './riptides.ts';
import { BUBBLE, BURST_COOLDOWN_TICKS, DASH, INFLATE, INK } from './tuning.ts';
import { fireUndertow } from './undertow.ts';

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
  world.events.emit({ type: 'burst.fired', id: racer.id, kinds, combo: combos[0] ?? null });
  const aim = aimOf(racer, move);
  for (const kind of kinds) {
    switch (kind) {
      case 'jetFin':
        startDash(world, racer, aim, combos);
        break;
      case 'bubbleShield':
        if (!combos.includes('bubbleDecoy')) fireBubble(world, racer, aim, combos.includes('lanternBubble'));
        break;
      case 'puffer':
        racer.status.inflated = INFLATE.ticks;
        break;
      case 'inkSac':
        if (!combos.includes('inkSquid')) dropInk(world, racer, combos);
        break;
      case 'glowLantern':
        flashAround(world, racer);
        break;
      case 'homingSquid':
        launchSquid(world, racer, aim, combos.includes('inkSquid'));
        break;
      case 'riptide':
        if (!combos.includes('surfline')) layRiptide(world, racer, aim, PLAIN_LANE);
        break;
      case 'undertow':
        fireUndertow(world, racer);
        break;
      case 'mimic':
        spawnDecoy(world, racer, combos.includes('bubbleDecoy'));
        break;
    }
  }
  useUp(world, racer, 'undertow');
  if (combos.includes('cannonball')) racer.status.inflated = Math.max(racer.status.inflated, DASH.ticks);
  return true;
}

/** Removes a one-use `kind` from the stack after its burst, emitting `powerup.lost` with cause 'used'. */
function useUp(world: World, racer: Racer, kind: PowerUpKind): void {
  const at = racer.stack.indexOf(kind);
  if (at < 0) return;
  racer.stack.splice(at, 1);
  world.events.emit({ type: 'powerup.lost', id: racer.id, kind, cause: 'used' });
}

/**
 * Holds a dashing racer's velocity at DASH.speed along `dashDir`, overriding swimming and drag, on
 * both axes or, where the medium says so (`effects.dashAxes`), horizontally only so its gravity
 * keeps working. Called in `stepWorld` after swimming and before the body moves. When not dashing
 * (the dash ran out or a hit ended it) it leaves velocity alone and clears `dashCombos`.
 */
export function driveDash(world: World, racer: Racer): void {
  if (racer.status.dashing === 0) {
    racer.dashCombos = [];
    return;
  }
  racer.body.vx = racer.dashDir.x * DASH.speed;
  if (mediumOf(world).effects.dashAxes === 'both') racer.body.vy = racer.dashDir.y * DASH.speed;
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
  const size = length(move.x, move.y);
  return size === 0 ? { x: racer.facing, y: 0 } : { x: move.x / size, y: move.y / size };
}

function startDash(world: World, racer: Racer, aim: Vec, combos: readonly ComboName[]): void {
  racer.status.dashing = DASH.ticks;
  racer.dashDir = { ...aim };
  racer.dashCombos = [...combos];
  driveDash(world, racer);
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
  const combos = racer.dashCombos;
  if (combos.includes('inkTrail') && elapsed % INK.trailEveryTicks === 0) dropInk(world, racer, combos);
  if (racer.status.dashing !== 1) return;
  if (combos.includes('comet')) flashAround(world, racer);
  if (combos.includes('surfline')) layRiptide(world, racer, racer.dashDir, SURFLINE_LANE);
}

function smashCoral(world: World, racer: Racer): void {
  const tiles = bodyTiles(hitbox(racer));
  for (let ty = tiles.top; ty <= tiles.bottom; ty++) {
    for (let tx = tiles.left; tx <= tiles.right; tx++) breakCoral(world, tx, ty, racer.id);
  }
}
