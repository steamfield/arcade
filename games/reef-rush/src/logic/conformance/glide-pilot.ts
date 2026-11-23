/**
 * Glide's rival pilot, its own and minimal: aim along the way (`glideAimFrom`), kick whenever the
 * kick is ready, and when the generic backstop sends `forceRecover`, push sideways to the aim for
 * RECOVER_TICKS. It has no wobble, no hazard avoidance and no speed-based stuck rule of its own.
 *
 * `PilotMemory` is swim-shaped until a second shipped medium makes it a union, so glide keeps its
 * state in those fields with its own meaning: `aim` is the last aim, `recoverTicks` and `recoverDir`
 * the sideways push; `wobble`, `stuckTicks` and `replanIn` stay 0. Test-only.
 */
import type { AiDraws, PilotMemory, Steering } from '../media/types.ts';
import type { MoveModifiers, Racer, World } from '../types.ts';
import { glideAimFrom } from './glide-nav.ts';

/** Ticks of the sideways push a forced recovery holds. */
const RECOVER_TICKS = 30;

/** A glide rival's pilot memory at the start line. */
export function createGlidePilot(): PilotMemory {
  return { wobble: 0, stuckTicks: 0, recoverTicks: 0, recoverDir: { x: 0, y: 0 }, aim: { x: 0, y: 0 }, replanIn: 0 };
}

/**
 * A glide rival's steering this tick. Mutates only its pilot memory.
 *
 * @throws {Error} When `racer.ai` is null (a human drives it).
 */
export function steerGlider(
  world: World,
  racer: Racer,
  _mods: MoveModifiers,
  draws: AiDraws,
  forceRecover: boolean,
): Steering {
  const memory = racer.ai?.pilot;
  if (!memory) throw new Error(`glide.steer needs AI memory, but racer '${racer.id}' has none (a human drives it)`);
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
