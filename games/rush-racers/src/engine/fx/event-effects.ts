/**
 * Maps one tick's drained events to effects: which burst plays where (kick puffs, coral debris,
 * pickups, a squid fizzling, a racer shaking one off, a decoy's pop, the splash of a racer breaching
 * the surface or falling back in, a puff under a racer springing off a bounce cloud, and sparkles
 * where the local racer passes a boost ring), and how much screen shake the local racer's own
 * knocks and a lightning strike on screen add (the slot the screen follows; see `local-racer.ts`). A
 * strike is on screen by the same measure the lightning view uses for its flash (`view/storm-reach.ts`). Positions come from the event and the world as it stands
 * after the tick. Shake is only ever asked for through `shake`, which the caller leaves out
 * under reduced motion. Item fires, hits, shield pops and the Riptide and Undertow lines are
 * `item-effects.ts`'s.
 */
import type { Stamped } from '@arcade/core';
import { CANNONBALL } from '../../logic/powerups/tuning.ts';
import { type Decoy, RACER_SIZE, type RacerId, type Squid, TILE, type Vec, type World } from '../../logic/types.ts';
import { localIdOf, localOf } from '../local-racer.ts';
import type { RuntimeEvent } from '../runtime.ts';
import { type CameraSpan, zoneSide } from '../view/storm-reach.ts';
import type { BubbleTracker } from './bubble-tracker.ts';
import type { Bursts } from './bursts.ts';

/** Reacts to each tick's events. */
export interface EventEffects {
  onTick(events: readonly Stamped<RuntimeEvent>[]): void;
}

/** Trauma (0..1, see `shake.ts`) for a hit that lands on the local racer. */
const LOCAL_HIT_TRAUMA = 0.7;
/** A Bubble Shield soaking up a hit on the local racer: felt, but lighter than a hit. */
const SHIELD_POP_TRAUMA = 0.4;
/** Added once per tick on which the local racer's cannonball smashes coral or a racer; a gate stacks up to a big jolt. */
const CANNONBALL_TRAUMA = 0.6;
/** A view of nothing, for effects built without a camera. */
const NO_SCREEN: CameraSpan = { x: 0, y: 0, width: 0 };
/** A lightning strike on screen: a jolt lighter than a hit. */
const STRIKE_TRAUMA = 0.35;

/**
 * Builds the event-to-effect mapping for `world`.
 *
 * @param shake Adds screen-shake trauma; a no-op under reduced motion.
 * @param screen What the race camera shows when the tick's events arrive (see `cameraSpan`); with
 *   none, as for effects built without a camera, no strike is on screen.
 */
export function createEventEffects(
  world: World,
  bursts: Bursts,
  bubbles: BubbleTracker,
  shake: (trauma: number) => void,
  screen: () => CameraSpan = () => NO_SCREEN,
): EventEffects {
  const local = localIdOf(world);
  let localPlace = localOf(world).place;
  // Squids and decoys are gone from the world by the time their end events are drained, so remember where they were.
  const lastSquidAt = new Map<Squid, Vec>();
  const lastDecoyAt = new Map<Decoy, Vec>();

  const racerAt = (id: RacerId, effect: (x: number, y: number) => void) => {
    const racer = world.racers.find((candidate) => candidate.id === id);
    if (racer) effect(racer.body.x + racer.body.w / 2, racer.body.y + racer.body.h / 2);
  };
  const tileCentre = (tile: number) => tile * TILE + TILE / 2;
  const localCannonballing = () => {
    const racer = localOf(world);
    return racer.status.dashing > 0 && racer.dashSpeed === CANNONBALL.speed;
  };

  return {
    onTick(events) {
      let cannonballImpact = false;
      let bubblesPopped = false;
      // A shielded hit emits both racer.hit and shield.popped on one tick; only the lighter shake applies.
      let localHit = false;
      let localShieldPopped = false;
      let strikeOnScreen = false;
      for (const event of events) {
        switch (event.type) {
          case 'racer.kicked': {
            const racer = world.racers.find((candidate) => candidate.id === event.id);
            if (racer) racerAt(event.id, (x, y) => bursts.kickPuff(x, y, racer.body.vx, racer.body.vy, racer.facing));
            break;
          }
          case 'coral.broken':
            bursts.coralDebris(tileCentre(event.tx), tileCentre(event.ty));
            if (event.by === local && localCannonballing()) cannonballImpact = true;
            break;
          case 'racer.hit':
            if (event.id === local) localHit = true;
            if (event.by === local && event.cause === 'puffer' && localCannonballing()) cannonballImpact = true;
            break;
          case 'shield.popped':
            if (event.id === local) localShieldPopped = true;
            break;
          case 'racer.bounced':
            racerAt(event.id, (x, y) => bursts.bubblePop(x, y + RACER_SIZE.height / 2));
            break;
          case 'ring.passed': {
            const ring = world.level.rings[event.ring];
            if (event.id === local && ring) bursts.pearlSparkle(tileCentre(ring.x), tileCentre(ring.y));
            break;
          }
          case 'lightning.struck': {
            const zone = world.level.lightning[event.zone];
            if (zone && zoneSide(zone, screen()) === 'on screen') strikeOnScreen = true;
            break;
          }
          case 'pearl.collected': {
            const pearl = world.level.pearls[event.index];
            if (pearl) bursts.pearlSparkle(tileCentre(pearl.x), tileCentre(pearl.y));
            break;
          }
          case 'clam.opened': {
            const clam = world.level.clams[event.index];
            if (clam) bursts.pickupPop(tileCentre(clam.x), tileCentre(clam.y), event.kind);
            break;
          }
          case 'loose.grabbed':
            racerAt(event.id, (x, y) => bursts.pickupPop(x, y, event.kind));
            break;
          case 'bubble.popped':
            bubblesPopped = true;
            break;
          case 'player.place':
            if (event.id !== local) break;
            if (event.place < localPlace) racerAt(local, bursts.placeUp);
            localPlace = event.place;
            break;
          case 'racer.finished':
            if (event.id === local) racerAt(local, bursts.finishBurst);
            break;
          case 'squid.lost': {
            const at = goneOwnedBy(lastSquidAt, world.squids, event.owner);
            if (at) bursts.inkPuff(at.x, at.y);
            break;
          }
          case 'racer.shaken':
            racerAt(event.id, bursts.bubblePop);
            break;
          // Leaving the water and falling back in both throw droplets, which move by the theme's splash physics.
          case 'racer.breached':
          case 'racer.splashed':
            racerAt(event.id, bursts.bubblePop);
            break;
          case 'decoy.popped': {
            const at = goneOwnedBy(lastDecoyAt, world.decoys, event.owner);
            if (at) bursts.bubblePop(at.x, at.y);
            break;
          }
        }
      }
      if (localShieldPopped) shake(SHIELD_POP_TRAUMA);
      else if (localHit) shake(LOCAL_HIT_TRAUMA);
      if (cannonballImpact) shake(CANNONBALL_TRAUMA);
      if (strikeOnScreen) shake(STRIKE_TRAUMA);
      if (bubblesPopped) bubbles.vanished(world, bursts.bubblePop);
      bubbles.remember(world);
      forgetGone(lastSquidAt, world.squids);
      forgetGone(lastDecoyAt, world.decoys);
      track(lastSquidAt, world.squids);
      track(lastDecoyAt, world.decoys);
    },
  };
}

/**
 * Keeps `seen` in step with `present`: each thing's last position is updated in place (no
 * allocation while it lives), and a thing that has left the world stays in `seen` until
 * `goneOwnedBy` hands its position to the event that reports it gone.
 */
function track<T extends { x: number; y: number }>(seen: Map<T, Vec>, present: readonly T[]): void {
  for (const thing of present) {
    const at = seen.get(thing);
    if (at) {
      at.x = thing.x;
      at.y = thing.y;
    } else seen.set(thing, { x: thing.x, y: thing.y });
  }
}

/** Drops from `seen` everything no longer in `present`, so a thing's end is reported once. */
function forgetGone<T>(seen: Map<T, Vec>, present: readonly T[]): void {
  for (const thing of seen.keys()) if (!present.includes(thing)) seen.delete(thing);
}

/** The last position of a thing owned by `owner` that is in `seen` but no longer in `present`, taken out of `seen`; undefined when none. */
function goneOwnedBy<T extends { owner: RacerId }>(
  seen: Map<T, Vec>,
  present: readonly T[],
  owner: RacerId,
): Vec | undefined {
  for (const [thing, at] of seen) {
    if (thing.owner !== owner || present.includes(thing)) continue;
    seen.delete(thing);
    return at;
  }
  return undefined;
}
