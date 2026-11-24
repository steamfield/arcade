/**
 * Swim's rival pilot (`Medium.steer`): the aim from the steer field (the smash field while it can
 * break coral: inflated, or holding a Puffer or Cannonball with its item use ready; the ram field always for a rival that rams
 * coral), a bounded wobble, a bend around any urchin or jelly in the way (`ai/avoid.ts`), the kick
 * decision, and the speed-based stuck recovery.
 *
 * A stunned or trapped rival can't act, so its stuck counter resets and it starts no recovery swim.
 * A rival swerving round a hazard holds its kick; a recovering one saves it. It spends dash charges
 * only while it has them, keeping one back for a latch shake-off unless it trails the leader by more
 * than RESERVE_WAIVED_BEHIND places, or is latched (`hasDashToSpend`).
 *
 * In a dark zone (`inDark`) a rival that can't see (`racerSeesInDark`: not Selene, no Glow Lantern)
 * wobbles twice as far and re-reads its field half as often; so does the player, unless its level
 * lights its way (`playerHasLanternLight`, Easy).
 *
 * It reads only the draws it is handed, never the rng, so rng use per tick is the generic AI's.
 */
import { breaksCoralOnContact, racerSeesInDark } from '../../abilities.ts';
import { avoidHazards } from '../../ai/avoid.ts';
import { steerDirection } from '../../ai/steer.ts';
import { playerHasLanternLight } from '../../difficulty-level.ts';
import { inDark } from '../../level/query.ts';
import { length } from '../../num.ts';
import { holds } from '../../powerups/inventory.ts';
import { CORAL_BREAKERS } from '../../powerups/tuning.ts';
import type { MoveModifiers, Racer, Vec, World } from '../../types.ts';
import {
  canRecover,
  DARK_STEERING,
  hasDashToSpend,
  LOOKAHEAD_TILES,
  recoveryMove,
  stepWobble,
  wobbledAim,
} from '../pilot-kit.ts';
import type { AiDraws, Steering } from '../types.ts';
import { type SwimPilot, swimNav, swimPilot } from './data.ts';

/** How much looser a swim rival steers in a dark zone it can't see in (the shared pilot kit's). */
export { DARK_STEERING };

/** Kick only when the aim is within about 37 degrees of the way the racer is already moving. */
const KICK_ALIGNMENT = 0.8;

/** A swim rival's pilot memory at the start line. */
export function createSwimPilot(): SwimPilot {
  return {
    kind: 'swim',
    wobble: 0,
    stuckTicks: 0,
    recoverTicks: 0,
    recoverDir: { x: 0, y: 0 },
    aim: { x: 0, y: 0 },
    replanIn: 0,
  };
}

/**
 * A swim rival's steering this tick. Mutates only the rival's pilot memory. `forceRecover` starts a
 * stuck recovery now unless one is already running.
 *
 * @throws {Error} When `racer.ai` is null (a human drives it), or its memory or the world's nav isn't swim's.
 */
export function steerSwimmer(
  world: World,
  racer: Racer,
  _mods: MoveModifiers,
  draws: AiDraws,
  forceRecover: boolean,
): Steering {
  const ai = racer.ai;
  if (!ai) throw new Error(`swim.steer needs AI memory, but racer '${racer.id}' has none (a human drives it)`);
  const memory = swimPilot(ai.pilot);
  const blind = inDark(world.level, racer.body) && !racerSeesInDark(racer) && !playerHasLanternLight(world, racer);
  replanAim(world, racer, memory, blind ? DARK_STEERING.reactionMul : 1);
  stepWobble(memory, racer.profile.wobble * (blind ? DARK_STEERING.wobbleMul : 1), draws.wobble);
  const wobbled = wobbledAim(memory);
  const aim = avoidHazards(world, racer, wobbled);
  // avoidHazards hands back the same object when nothing is in the way.
  const swerving = aim !== wobbled;
  const recovery = canRecover(world, racer, memory) ? recoveryMove(racer, memory, draws.side, forceRecover) : null;
  // A recovering rival is sliding off a wall, not racing, so it saves its kick for the aim.
  // A swerving rival holds its kick, which would carry it on toward the hazard.
  const kick = recovery === null && !swerving && wantsKick(racer, aim, draws.kick);
  return { move: recovery ?? aim, kick, kickHeld: kick, aim, recovering: recovery !== null };
}

/**
 * Re-reads its field every `reactionTicks` (times `reactionMul`), so slower rivals react later to
 * the course. A rival that is inflated, or holds a Puffer or Cannonball in any slot with its item use
 * ready, reads the smash field and aims through coral, which inflating breaks; while its use cools
 * down it steers around like everyone else. A rival that rams coral reads the ram field always.
 */
function replanAim(world: World, racer: Racer, memory: SwimPilot, reactionMul: number): void {
  if (memory.replanIn <= 0) {
    const { level, broken } = world;
    const nav = swimNav(world.nav);
    const holdsBreaker = CORAL_BREAKERS.some((kind) => holds(racer, kind));
    const pufferReady = racer.status.inflated > 0 || (holdsBreaker && racer.useCooldown === 0);
    const rams = breaksCoralOnContact(racer);
    const field = rams ? nav.ram : pufferReady ? nav.smash : nav.steer;
    memory.aim = steerDirection(field, nav, level, broken, racer.body, LOOKAHEAD_TILES, rams || pufferReady);
    memory.replanIn = racer.profile.reactionTicks * reactionMul;
  }
  memory.replanIn--;
}

/** Kicks when ready, has a dash to spend, is already moving roughly along its aim, and the skill roll passes. */
function wantsKick(racer: Racer, aim: Vec, roll: number): boolean {
  if (racer.kickCooldown > 0 || !hasDashToSpend(racer)) return false;
  const { vx, vy } = racer.body;
  const speed = length(vx, vy);
  if (speed === 0) return false;
  const alignment = (aim.x * vx + aim.y * vy) / speed;
  return alignment > KICK_ALIGNMENT && roll < racer.profile.kickSkill;
}
