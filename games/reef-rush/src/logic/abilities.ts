/**
 * Signature abilities: every hook the race systems consult about a racer's
 * character. Each system calls its hook at one named point, so an ability
 * changes the race only through here. Each hook checks the racer's character
 * and returns the plain rule for everyone else.
 *
 * | Character | Ability | Effect |
 * | --- | --- | --- |
 * | Rudy | Shake it off | stuns and bubble traps last half as long |
 * | Gil | Spring kick | kicks push harder upward |
 * | Streak | Wind-up | top speed rises the longer it swims without turning hard or being hit |
 * | Onyx | Ambush | bumping a racer from behind takes some of its speed |
 * | Nib | Deep pockets | holds 4 power-ups instead of 3 |
 * | Baron Barnacle | Bulldozer | breaks coral by ramming, barely moves in bumps, accelerates slowly |
 * | Selene | Moonlight | sees through dark zones, immune to jelly stings |
 * | Rook | Frenzy | when a racer near it is hit or loses a power-up, it gets a short speed burst |
 *
 * Abilities keep their per-racer state in `racer.ability` (zeroed at the start line by `noItems`).
 * The numbers are in ABILITY; they stay small next to power-ups.
 */
import type { GameEvent } from './events.ts';
import { length } from './num.ts';
import { bumpMass } from './powerups/passives.ts';
import { STACK_MAX } from './powerups/tuning.ts';
import { activeRacers, centreOf } from './racers.ts';
import { type HitCause, type MoveModifiers, type Racer, type RacerId, TILE, type Vec, type World } from './types.ts';

/** Every ability's numbers. Durations are ticks, speeds px/s. */
export const ABILITY = {
  /** Rudy: stuns and traps last this fraction of their time. */
  shakeItOff: { statusMul: 0.4 },
  /**
   * Gil: a kick aimed steeply up (the unit aim's y at most -`minUp`, about 45 degrees or more above
   * level) has its upward part `upMul` times as strong. Flatter kicks are plain, so the spring helps
   * climbs without flinging him off a level line.
   */
  springKick: { upMul: 1.8, minUp: 0.7 },
  /**
   * Streak: forceMul rises linearly to `maxBonus` over `rampTicks` of straight swimming. Straight
   * means at least `minSpeed` and heading within 45 degrees of its facing (forward at least as fast
   * as up or down), so a hard turn, a stop or a hit starts it over.
   */
  windUp: { rampTicks: 180, maxBonus: 0.1, minSpeed: 40 },
  /** Onyx: bumping a racer from behind takes this fraction of its velocity and adds it to Onyx's. */
  ambush: { steal: 0.12 },
  /** Nib holds this many power-ups. */
  deepPockets: { stackMax: 4 },
  /**
   * Baron: bumps with `massMul` times his mass. From a standstill he swims with `accelMul` of his
   * force, rising linearly to full force at `fullForceSpeed`, so he reaches the same cruise speed
   * but takes longer to get going after every stop, stun or knock.
   */
  bulldozer: { massMul: 2, accelMul: 0.4, fullForceSpeed: 60 },
  /** Rook: another racer hit within `rangeTiles` gives him `forceBonus` more swim force for `ticks`. */
  frenzy: { rangeTiles: 5, ticks: 90, forceBonus: 0.25 },
} as const;

/**
 * The racer's swimming modifiers with its ability folded in, called last in `modifiersFor`.
 * Streak (Wind-up) raises forceMul with `ability.windUp`; Baron (Bulldozer) swims with less force
 * while slow; Rook (Frenzy) raises forceMul while `ability.frenzy` runs.
 */
export function abilityModifiers(racer: Racer, mods: MoveModifiers): MoveModifiers {
  switch (racer.character) {
    case 'streak': {
      const { rampTicks, maxBonus } = ABILITY.windUp;
      const wound = Math.min(racer.ability.windUp, rampTicks) / rampTicks;
      return { ...mods, forceMul: mods.forceMul * (1 + maxBonus * wound) };
    }
    case 'baron': {
      const { accelMul, fullForceSpeed } = ABILITY.bulldozer;
      const goingFor = Math.min(1, length(racer.body.vx, racer.body.vy) / fullForceSpeed);
      return { ...mods, forceMul: mods.forceMul * (accelMul + (1 - accelMul) * goingFor) };
    }
    case 'rook':
      return racer.ability.frenzy > 0 ? { ...mods, forceMul: mods.forceMul * (1 + ABILITY.frenzy.forceBonus) } : mods;
    default:
      return mods;
  }
}

/** Most power-ups the racer holds before a new one pushes out the oldest (`gainPowerUp`). Nib holds 4. */
export function stackMaxFor(racer: Racer): number {
  return racer.character === 'nib' ? ABILITY.deepPockets.stackMax : STACK_MAX;
}

/** Multiplies the ticks of a stun or bubble trap as `applyHit` sets it (rounded to whole ticks). Rudy gets 0.5. */
export function statusDurationMul(racer: Racer, _status: 'stunned' | 'trapped'): number {
  return racer.character === 'rudy' ? ABILITY.shakeItOff.statusMul : 1;
}

/**
 * The mass the racer bumps with in `separateRacers`: `bumpMass` (profile mass, Puffer included)
 * with the ability on top. Baron (Bulldozer) is much heavier, so he barely moves in bumps.
 */
export function bumpMassFor(racer: Racer): number {
  return bumpMass(racer) * (racer.character === 'baron' ? ABILITY.bulldozer.massMul : 1);
}

/**
 * True when a hit of this cause does nothing to the racer, checked in `applyHit` before any effect
 * (no event, no invulnerability). Selene (Moonlight) ignores 'jelly'.
 */
export function ignoresHazard(racer: Racer, cause: HitCause): boolean {
  return racer.character === 'selene' && cause === 'jelly';
}

/**
 * True when the racer breaks coral by swimming into it: `stepWorld` then breaks every coral tile its
 * body would enter this tick (`ramCoral`) before moving it. Baron (Bulldozer).
 */
export function breaksCoralOnContact(racer: Racer): boolean {
  return racer.character === 'baron';
}

/**
 * The kick's direction scaled per axis, as `applyIntent` fires it: the kick adds
 * `SWIM.kick * kickMul` times this vector. `dir` is the unit aim. Gil (Spring kick) scales the
 * upward part of a steep upward kick (see ABILITY.springKick).
 */
export function kickImpulse(racer: Racer, dir: Vec): Vec {
  if (racer.character !== 'gil' || dir.y > -ABILITY.springKick.minUp) return dir;
  return { x: dir.x, y: dir.y * ABILITY.springKick.upMul };
}

/**
 * Called by `separateRacers` when racers `a` and `b` start touching (the tick `racer.bumped`
 * fires), after they're pushed apart. Onyx (Ambush), bumping a racer from behind, takes
 * `ambush.steal` of that racer's velocity and adds it to his own. "From behind" means Onyx's centre
 * is behind the other racer's along the way it is moving; a racer at rest has nothing to take.
 */
export function onBump(_world: World, a: Racer, b: Racer): void {
  if (a.character === 'onyx') ambush(a, b);
  else if (b.character === 'onyx') ambush(b, a);
}

function ambush(onyx: Racer, victim: Racer): void {
  const { vx, vy } = victim.body;
  const from = centreOf(onyx);
  const to = centreOf(victim);
  if ((to.x - from.x) * vx + (to.y - from.y) * vy <= 0) return;
  const { steal } = ABILITY.ambush;
  victim.body.vx -= vx * steal;
  victim.body.vy -= vy * steal;
  onyx.body.vx += vx * steal;
  onyx.body.vy += vy * steal;
}

/**
 * Called once per tick in `stepWorld`, after statuses tick, with every event emitted since the
 * previous call (`world.recentEvents`). A hit ends Streak's wind-up. Rook (Frenzy), while in play,
 * starts `ability.frenzy` when another racer within `frenzy.rangeTiles` is hit (`racer.hit`) or
 * knocked out of a power-up (`powerup.lost` by a hit); a new trigger restarts it, never stacks.
 */
export function onWorldEvents(world: World, events: readonly GameEvent[]): void {
  const racing = activeRacers(world);
  for (const event of events) {
    const struck = struckRacer(event);
    const victim = racing.find((racer) => racer.id === struck);
    if (!victim) continue;
    if (victim.character === 'streak') victim.ability.windUp = 0;
    for (const rook of racing) {
      if (rook.character === 'rook' && rook !== victim && withinTiles(rook, victim, ABILITY.frenzy.rangeTiles)) {
        rook.ability.frenzy = ABILITY.frenzy.ticks;
      }
    }
  }
}

/** The racer an event says was hit or knocked out of a power-up, or null for any other event. */
function struckRacer(event: GameEvent): RacerId | null {
  if (event.type === 'racer.hit') return event.id;
  if (event.type === 'powerup.lost' && event.cause === 'hit') return event.id;
  return null;
}

function withinTiles(a: Racer, b: Racer, tiles: number): boolean {
  const from = centreOf(a);
  const to = centreOf(b);
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  return dx * dx + dy * dy <= (tiles * TILE) ** 2;
}

/**
 * Called once per tick in `stepWorld`, right after `onWorldEvents`, for the racers still in play.
 * Streak's `ability.windUp` grows by one while swimming straight (see ABILITY.windUp) and resets
 * otherwise; Rook's `ability.frenzy` counts down.
 */
export function tickAbilities(_world: World, racing: readonly Racer[]): void {
  for (const racer of racing) {
    if (racer.character === 'streak') racer.ability.windUp = swimmingStraight(racer) ? racer.ability.windUp + 1 : 0;
    if (racer.ability.frenzy > 0) racer.ability.frenzy -= 1;
  }
}

function swimmingStraight(racer: Racer): boolean {
  const { vx, vy } = racer.body;
  return length(vx, vy) >= ABILITY.windUp.minSpeed && vx * racer.facing >= Math.abs(vy);
}

/**
 * True when the racer sees through dark zones (`inDark` in level/query.ts) as if lit: Selene
 * (Moonlight), or anyone holding a Glow Lantern, whose passive lights the dark around its holder.
 * Rivals that can't see steer loosely there (`ai/rival.ts`).
 */
export function racerSeesInDark(racer: Racer): boolean {
  return racer.character === 'selene' || racer.stack.includes('glowLantern');
}
