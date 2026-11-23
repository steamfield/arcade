/**
 * Glide's rival pilot, its own and minimal: aim along the way (`glideAimFrom`), kick whenever the
 * kick is ready, and when the generic backstop sends `forceRecover`, push sideways to the aim for
 * RECOVER_TICKS. It has no wobble, no hazard avoidance and no speed-based stuck rule of its own.
 * Its memory is a `GlidePilot` (`glide-data.ts`). Test-only.
 */
import type { AiDraws, Steering } from '../media/types.ts';
import type { MoveModifiers, Racer, World } from '../types.ts';
import { type GlidePilot, glidePilot } from './glide-data.ts';
import { glideAimFrom } from './glide-nav.ts';

/** Ticks of the sideways push a forced recovery holds. */
const RECOVER_TICKS = 30;

/** A glide rival's pilot memory at the start line. */
export function createGlidePilot(): GlidePilot {
  return { kind: 'glide', aim: { x: 0, y: 0 }, recoverTicks: 0, recoverDir: { x: 0, y: 0 } };
}

/**
 * A glide rival's steering this tick. Mutates only its pilot memory.
 *
 * @throws {Error} When `racer.ai` is null (a human drives it), or its memory or the world's nav isn't glide's.
 */
export function steerGlider(
  world: World,
  racer: Racer,
  _mods: MoveModifiers,
  draws: AiDraws,
  forceRecover: boolean,
): Steering {
  const ai = racer.ai;
  if (!ai) throw new Error(`glide.steer needs AI memory, but racer '${racer.id}' has none (a human drives it)`);
  const memory = glidePilot(ai.pilot);
  memory.aim = glideAimFrom(world, racer.body, 1);
  if (forceRecover && memory.recoverTicks === 0) {
    const side = draws.side < 0.5 ? 1 : -1;
    memory.recoverTicks = RECOVER_TICKS;
    memory.recoverDir = { x: -memory.aim.y * side, y: memory.aim.x * side };
  }
  if (memory.recoverTicks > 0) {
    memory.recoverTicks--;
    return { move: { ...memory.recoverDir }, kick: false, kickHeld: false, aim: memory.aim, recovering: true };
  }
  const kick = racer.kickCooldown === 0;
  return { move: { ...memory.aim }, kick, kickHeld: kick, aim: memory.aim, recovering: false };
}
