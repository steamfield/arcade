/**
 * Swimming as a medium: free 8-direction swimming with momentum and drag, an idle sink, currents and
 * kelp, and a kick. This scaffold delegates the members that already exist as functions and leaves
 * the rest to lane 8/a, which moves swimming fully behind this object.
 */
import { createAiMemory } from '../../ai/rival.ts';
import { TRAPPED_RISE_SPEED } from '../../hazards/tuning.ts';
import { sampleEnvironment } from '../../level/query.ts';
import { feltCurrent } from '../../powerups/riptides.ts';
import { LOOSE } from '../../powerups/tuning.ts';
import { buildFlowFields } from '../../race/flowfield.ts';
import { applyIntent, BASE_MODIFIERS, SWIM } from '../../swim/physics.ts';
import type { Medium } from '../types.ts';

function notImplemented(member: string): never {
  throw new Error(`swim.${member} is not implemented yet (lane 8/a)`);
}

/** The swim medium. */
export const SWIM_MEDIUM: Medium = {
  id: 'swim',
  tuning: {
    base: BASE_MODIFIERS,
    force: SWIM.force,
    drag: SWIM.drag,
    maxSpeed: SWIM.maxSpeed,
    kick: SWIM.kick,
    extra: { sink: SWIM.sink, currentForce: SWIM.currentForce, kelpDragMul: SWIM.kelpDragMul },
  },
  createMotion: () => ({}),
  createPilot: () => {
    const { wobble, stuckTicks, recoverTicks, recoverDir, aim, replanIn } = createAiMemory();
    return { wobble, stuckTicks, recoverTicks, recoverDir, aim, replanIn };
  },
  sampleEnvironment(world, racer) {
    const water = sampleEnvironment(world.level, racer.body);
    return { ...water, current: feltCurrent(world, racer, water.current) };
  },
  applyIntent,
  buildNav: buildFlowFields,
  steer: () => notImplemented('steer'),
  enterCost: () => notImplemented('enterCost'),
  aimFrom: () => notImplemented('aimFrom'),
  nextTile: () => notImplemented('nextTile'),
  distanceAt: () => notImplemented('distanceAt'),
  validateLevel: () => notImplemented('validateLevel'),
  racerCollision: 'solid',
  effects: { dashAxes: 'both', trappedDrift: -TRAPPED_RISE_SPEED, looseDrift: -LOOSE.riseSpeed },
  kickRules: {
    dodgesSquid: true,
    shakesLatch: true,
    countersUndertow: true,
    springKick: () => notImplemented('kickRules.springKick'),
  },
};
