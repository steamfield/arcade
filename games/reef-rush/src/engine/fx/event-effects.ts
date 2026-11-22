/**
 * Maps one tick's drained events to effects: which burst plays where (including the attack
 * power-ups' fire, lane, pull, shake-off and pop), and how much screen shake the player's own
 * knocks add. Positions come from the event and the world as it stands
 * after the tick. Shake is only ever asked for through `shake`, which the caller leaves out
 * under reduced motion.
 */
import type { Stamped } from '@arcade/core';
import { playerOf } from '../../logic/racers.ts';
import { type Decoy, type RacerId, type Squid, TILE, type Vec, type World } from '../../logic/types.ts';
import type { RuntimeEvent } from '../runtime.ts';
import type { BubbleTracker } from './bubble-tracker.ts';
import type { Bursts } from './bursts.ts';

/** Reacts to each tick's events. */
export interface EventEffects {
  onTick(events: readonly Stamped<RuntimeEvent>[]): void;
}

/** Trauma (0..1, see `shake.ts`) for a hit that lands on the player. */
const PLAYER_HIT_TRAUMA = 0.7;
/** A Bubble Shield soaking up a hit on the player: felt, but lighter than a hit. */
const SHIELD_POP_TRAUMA = 0.4;
/** Added once per tick on which the player's cannonball smashes coral or a racer; a gate stacks up to a big jolt. */
const CANNONBALL_TRAUMA = 0.6;
/** Bubbles shed along a new Riptide lane, one per this many px of its length. */
const LANE_BUBBLE_SPACING = 12;
/** Bubbles shed from each racer an Undertow pulls. */
const PULL_BUBBLES = 3;

/**
 * Builds the event-to-effect mapping for `world`.
 *
 * @param shake Adds screen-shake trauma; a no-op under reduced motion.
 */
export function createEventEffects(
  world: World,
  bursts: Bursts,
  bubbles: BubbleTracker,
  shake: (trauma: number) => void,
): EventEffects {
  let playerPlace = playerOf(world).place;
  // Squids and decoys are gone from the world by the time their end events are drained, so remember where they were.
  const lastSquidAt = new Map<Squid, Vec>();
  const lastDecoyAt = new Map<Decoy, Vec>();

  const racerAt = (id: RacerId, effect: (x: number, y: number) => void) => {
    const racer = world.racers.find((candidate) => candidate.id === id);
    if (racer) effect(racer.body.x + racer.body.w / 2, racer.body.y + racer.body.h / 2);
  };
  const tileCentre = (tile: number) => tile * TILE + TILE / 2;
  const playerCannonballing = () => {
    const player = playerOf(world);
    return player.status.dashing > 0 && player.dashCombos.includes('cannonball');
  };

  return {
    onTick(events) {
      let cannonballImpact = false;
      let bubblesPopped = false;
      // A shielded hit emits both racer.hit and shield.popped on one tick; only the lighter shake applies.
      let playerHit = false;
      let playerShieldPopped = false;
      for (const event of events) {
        switch (event.type) {
          case 'racer.kicked': {
            const racer = world.racers.find((candidate) => candidate.id === event.id);
            if (racer) racerAt(event.id, (x, y) => bursts.kickPuff(x, y, racer.body.vx, racer.body.vy, racer.facing));
            break;
          }
          case 'coral.broken':
            bursts.coralDebris(tileCentre(event.tx), tileCentre(event.ty));
            if (event.by === 'player' && playerCannonballing()) cannonballImpact = true;
            break;
          case 'racer.hit':
            racerAt(event.id, bursts.hitSparks);
            if (event.id === 'player') playerHit = true;
            if (event.by === 'player' && event.cause === 'puffer' && playerCannonballing()) cannonballImpact = true;
            break;
          case 'shield.popped':
            racerAt(event.id, bursts.bubblePop);
            if (event.id === 'player') playerShieldPopped = true;
            break;
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
          case 'ink.spawned': {
            const ink = world.inks.findLast((cloud) => cloud.owner === event.owner);
            if (ink) bursts.inkPuff(ink.x, ink.y);
            break;
          }
          case 'bubble.popped':
            bubblesPopped = true;
            break;
          case 'player.place':
            if (event.place < playerPlace) racerAt('player', bursts.placeUp);
            playerPlace = event.place;
            break;
          case 'racer.finished':
            if (event.id === 'player') racerAt('player', bursts.finishBurst);
            break;
          case 'squid.spawned':
            racerAt(event.owner, bursts.bubblePop);
            break;
          case 'squid.lost': {
            const at = goneOwnedBy(lastSquidAt, world.squids, event.owner);
            if (at) bursts.inkPuff(at.x, at.y);
            break;
          }
          case 'racer.shaken':
            racerAt(event.id, bursts.bubblePop);
            break;
          case 'riptide.spawned':
            shedLaneBubbles(world, event.owner, bursts);
            break;
          case 'undertow.fired':
            for (const id of event.pulled) {
              racerAt(id, (x, y) => {
                for (let bubble = 0; bubble < PULL_BUBBLES; bubble++) bursts.trailBubble(x - bubble * 4, y);
              });
            }
            break;
          case 'decoy.popped': {
            const at = goneOwnedBy(lastDecoyAt, world.decoys, event.owner);
            if (at) bursts.bubblePop(at.x, at.y);
            break;
          }
        }
      }
      if (playerShieldPopped) shake(SHIELD_POP_TRAUMA);
      else if (playerHit) shake(PLAYER_HIT_TRAUMA);
      if (cannonballImpact) shake(CANNONBALL_TRAUMA);
      if (bubblesPopped) bubbles.vanished(world, bursts.bubblePop);
      bubbles.remember(world);
      forgetGone(lastSquidAt, world.squids);
      forgetGone(lastDecoyAt, world.decoys);
      track(lastSquidAt, world.squids);
      track(lastDecoyAt, world.decoys);
    },
  };
}

/** Bubbles strung along the newest lane `owner` laid, so a new Riptide announces its length. */
function shedLaneBubbles(world: World, owner: RacerId, bursts: Bursts): void {
  const lane = world.riptides.findLast((riptide) => riptide.owner === owner);
  if (!lane) return;
  const alongX = Math.abs(lane.dir.x) >= Math.abs(lane.dir.y);
  const length = alongX ? lane.w : lane.h;
  for (let along = 0; along < length; along += LANE_BUBBLE_SPACING) {
    const x = alongX ? lane.x + along : lane.x + lane.w / 2;
    const y = alongX ? lane.y + lane.h / 2 : lane.y + along;
    bursts.trailBubble(x, y);
  }
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
