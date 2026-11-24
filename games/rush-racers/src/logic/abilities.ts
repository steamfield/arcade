/**
 * Signature abilities: every hook the race systems consult about a racer's
 * character. Each system calls its hook at one named point, so an ability
 * changes the race only through here. Each hook checks the racer's character
 * and returns the plain rule for everyone else.
 *
 * | Character | Ability | Effect |
 * | --- | --- | --- |
 * | Rudy | Shake it off | stuns and bubble traps last 40% as long |
 * | Gil | Spring kick | kicks push harder upward; jumps higher in media that jump |
 * | Streak | Wind-up | top speed rises the longer it swims without turning hard or being hit |
 * | Onyx | Ambush | bumping a racer from behind takes some of its speed |
 * | Nib | Deep pockets | has 4 item slots instead of 3 |
 * | Baron Barnacle | Bulldozer | breaks coral by ramming, barely moves in bumps, accelerates slowly |
 * | Selene | Moonlight | sees through dark zones, immune to jelly stings |
 * | Rook | Frenzy | when a racer near it is hit (which is also how anyone loses a power-up), it gets a short speed burst |
 *
 * Abilities keep their per-racer state in `racer.ability` (zeroed at the start line by `noItems`).
 * `ability.windUp` is a run counter: Streak's straight-line ticks, and Baron's ticks since the
 * start or his last hit (no one else uses it). The numbers are in ABILITY; they stay small next to power-ups.
 */
import type { GameEvent } from './events.ts';
import type { KickRules } from './media/types.ts';
import { length } from './num.ts';
import { selectedItem } from './powerups/inventory.ts';
import { bumpMass } from './powerups/passives.ts';
import { STACK_MAX } from './powerups/tuning.ts';
import { activeRacers, centreOf } from './racers.ts';
import { type HitCause, type MoveModifiers, type Racer, TILE, type Vec, type World } from './types.ts';

/**
 * The multiplier on a jumping medium's jump speed for `racer`: Gil (Spring jump) leaves the ground
 * `springJump.speedMul` times as fast, everyone else 1. Media that don't jump (swim) never call it.
 */
export function jumpMulFor(racer: Pick<Racer, 'character'>): number {
  return racer.character === 'gil' ? ABILITY.springJump.speedMul : 1;
}

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
  /** Gil in media that jump: jump speed times `speedMul`, so a held jump rises about 25 % higher. */
  springJump: { speedMul: 1.12 },
  /**
   * Streak: forceMul rises linearly to `maxBonus` over `rampTicks` of straight swimming. Straight
   * means at least `minSpeed` and heading within 45 degrees of its facing (forward at least as fast
   * as up or down), so a hard turn, a stop or a hit starts it over.
   */
  windUp: { rampTicks: 180, maxBonus: 0.1, minSpeed: 40 },
  /**
   * Onyx: bumping a racer from behind takes `steal` of its velocity and adds it to Onyx's. Behind
   * means the line from Onyx to it lies within 45 degrees of the way it was heading (cos² 0.5).
   */
  ambush: { steal: 0.12, behindCosSq: 0.5 },
  /** Nib has this many item slots. */
  deepPockets: { stackMax: 4 },
  /**
   * Baron: bumps with `massMul` times his mass. Off the start line and after every hit (a stun, a
   * trap or a knock) he swims with `accelMul` of his force, rising linearly to full force over
   * `rampTicks`. The ramp counts ticks, not speed, so in kelp or against a current he reaches the
   * same cruise as anyone once it has run; he just takes longer to get going.
   */
  bulldozer: { massMul: 2, accelMul: 0.4, rampTicks: 60 },
  /** Rook: another racer hit within `rangeTiles` gives him `forceBonus` more swim force for exactly `ticks` ticks. */
  frenzy: { rangeTiles: 5, ticks: 90, forceBonus: 0.25 },
} as const;

/**
 * The racer's swimming modifiers with its ability folded in, called last in `modifiersFor`.
 * Streak (Wind-up) raises forceMul with `ability.windUp`; Baron (Bulldozer) swims with less force
 * for `bulldozer.rampTicks` after the start or a hit; Rook (Frenzy) raises forceMul while `ability.frenzy` runs.
 */
export function abilityModifiers(racer: Racer, mods: MoveModifiers): MoveModifiers {
  switch (racer.character) {
    case 'streak': {
      const { rampTicks, maxBonus } = ABILITY.windUp;
      const wound = Math.min(racer.ability.windUp, rampTicks) / rampTicks;
      return { ...mods, forceMul: mods.forceMul * (1 + maxBonus * wound) };
    }
    case 'baron': {
      const { accelMul, rampTicks } = ABILITY.bulldozer;
      const underWay = Math.min(racer.ability.windUp, rampTicks) / rampTicks;
      return { ...mods, forceMul: mods.forceMul * (accelMul + (1 - accelMul) * underWay) };
    }
    case 'rook':
      return racer.ability.frenzy > 0 ? { ...mods, forceMul: mods.forceMul * (1 + ABILITY.frenzy.forceBonus) } : mods;
    default:
      return mods;
  }
}

/** How many inventory slots the racer has (`Racer.items`). Nib has 4, everyone else 3. */
export function stackMaxFor(racer: Pick<Racer, 'character'>): number {
  return racer.character === 'nib' ? ABILITY.deepPockets.stackMax : STACK_MAX;
}

/**
 * Multiplies the ticks of a stun, bubble trap or squid latch as `applyHit` and `squids.ts` set them
 * (rounded to whole ticks). Rudy gets 0.4: his stuns, traps and latches last 40% of their time.
 */
export function statusDurationMul(racer: Racer, _status: 'stunned' | 'trapped' | 'latched'): number {
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
 * (no event, no invulnerability). Selene (Moonlight) ignores 'jelly' (a static wisp in the sky), but
 * not 'lightning': seeing in the storm cell doesn't make her proof against its strikes.
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
 * The kick's direction scaled per axis, as a medium's `applyIntent` fires it: the kick adds the
 * medium's kick speed times `kickMul` times this vector. `dir` is the unit aim. Gil (Spring kick)
 * scales the upward part of a kick the medium's `rules.springKick` accepts (see ABILITY.springKick).
 */
export function kickImpulse(racer: Racer, dir: Vec, rules: KickRules): Vec {
  if (racer.character !== 'gil' || !rules.springKick(dir)) return dir;
  return { x: dir.x, y: dir.y * ABILITY.springKick.upMul };
}

/**
 * Called by `separateRacers` when racers `a` and `b` start touching (the tick `racer.bumped`
 * fires), after they're pushed apart and before the closing speed they share is added, so
 * velocities here are the ones they bumped with. Onyx (Ambush), bumping a racer from behind (see
 * ABILITY.ambush), takes `ambush.steal` of its velocity and adds it to his own. A racer at rest,
 * or one Onyx meets side by side or head on, keeps its speed.
 */
export function onBump(_world: World, a: Racer, b: Racer): void {
  if (a.character === 'onyx') ambush(a, b);
  else if (b.character === 'onyx') ambush(b, a);
}

function ambush(onyx: Racer, victim: Racer): void {
  const { vx, vy } = victim.body;
  const from = centreOf(onyx);
  const to = centreOf(victim);
  const offset = { x: to.x - from.x, y: to.y - from.y };
  const along = offset.x * vx + offset.y * vy;
  const { steal, behindCosSq } = ABILITY.ambush;
  // Squared cosine, so no square roots: the offset is within 45 degrees of the heading.
  const lengthsSq = (offset.x * offset.x + offset.y * offset.y) * (vx * vx + vy * vy);
  if (along <= 0 || along * along < behindCosSq * lengthsSq) return;
  victim.body.vx -= vx * steal;
  victim.body.vy -= vy * steal;
  onyx.body.vx += vx * steal;
  onyx.body.vy += vy * steal;
}

/** `ability.windUp` after a hit this tick: `tickAbilities` turns it into 0 without counting the tick. */
const HIT_THIS_TICK = -1;

/**
 * Called once per tick in `stepWorld`, after statuses tick, with every event emitted since the
 * previous call (`world.recentEvents`). A landed hit (`racer.hit`) ends Streak's wind-up and Baron's
 * run, for the whole tick. Rook (Frenzy), while in play, starts `ability.frenzy` when another racer
 * within `frenzy.rangeTiles` is hit; a new trigger restarts it, never stacks. A power-up is only
 * ever knocked off by a hit, so `racer.hit` covers losing one too.
 */
export function onWorldEvents(world: World, events: readonly GameEvent[]): void {
  const racing = activeRacers(world);
  for (const event of events) {
    if (event.type !== 'racer.hit') continue;
    const victim = racing.find((racer) => racer.id === event.id);
    if (!victim) continue;
    if (victim.character === 'streak' || victim.character === 'baron') victim.ability.windUp = HIT_THIS_TICK;
    for (const rook of racing) {
      if (rook.character === 'rook' && rook !== victim && withinTiles(rook, victim, ABILITY.frenzy.rangeTiles)) {
        // One more than the bonus, because tickAbilities takes a tick off this same tick.
        rook.ability.frenzy = ABILITY.frenzy.ticks + 1;
      }
    }
  }
}

function withinTiles(a: Racer, b: Racer, tiles: number): boolean {
  const from = centreOf(a);
  const to = centreOf(b);
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const reachPx = tiles * TILE;
  return dx * dx + dy * dy <= reachPx * reachPx;
}

/**
 * Called once per tick in `stepWorld`, right after `onWorldEvents`, for the racers still in play.
 * `ability.windUp` grows by one each tick Streak swims straight (see ABILITY.windUp) and each tick
 * for Baron (ABILITY.bulldozer); it is 0 when Streak isn't swimming straight, and for both after a
 * hit this tick. Rook's `ability.frenzy`
 * counts down.
 */
export function tickAbilities(_world: World, racing: readonly Racer[]): void {
  for (const racer of racing) {
    const run = runCounts(racer);
    if (run !== null)
      racer.ability.windUp = racer.ability.windUp !== HIT_THIS_TICK && run ? racer.ability.windUp + 1 : 0;
    if (racer.ability.frenzy > 0) racer.ability.frenzy -= 1;
  }
}

/** Whether this tick extends the racer's run (Streak swimming straight; every tick for Baron); null for everyone else. */
function runCounts(racer: Racer): boolean | null {
  if (racer.character === 'baron') return true;
  if (racer.character !== 'streak') return null;
  const { vx, vy } = racer.body;
  return length(vx, vy) >= ABILITY.windUp.minSpeed && vx * racer.facing >= Math.abs(vy);
}

/**
 * True when the racer sees through dark zones (`inDark` in level/query.ts) as if lit: Selene
 * (Moonlight), or anyone with a Glow Lantern selected, whose passive lights the dark around its holder.
 * Rivals that can't see steer loosely there (`ai/rival.ts`).
 */
export function racerSeesInDark(racer: Racer): boolean {
  return racer.character === 'selene' || selectedItem(racer)?.kind === 'glowLantern';
}
