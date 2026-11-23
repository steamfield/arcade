/**
 * Which racer the AI rivals measure their catch-up against.
 */
import { isHuman } from '../racers.ts';
import { type Finish, RACER_IDS, type Racer, type World } from '../types.ts';

/** A racer that has crossed the line. */
type FinishedRacer = Racer & { finished: Finish };

/**
 * The human the rivals pace themselves to: among human slots (taken over or not), the unfinished one
 * with the least progress left, ties to the earlier slot in RACER_IDS order, or the best finisher once
 * every human slot is home. With one human this is always that human.
 *
 * @throws {Error} When the world has no racer in a human slot. createWorld always has at least one,
 * so this means the world was assembled by hand without it.
 */
export function catchUpTarget(world: World): Racer {
  const humans = humanRacers(world);
  if (humans.length === 0) {
    throw new Error(`World has no racer in a human slot (humans: ${world.humans.join(', ') || 'none'})`);
  }
  const unfinished = humans.filter((racer) => !racer.finished);
  if (unfinished.length > 0) return leastProgressLeft(unfinished);
  return bestFinisher(humans.filter(hasFinished));
}

/** Racers in human slots, in RACER_IDS order. */
function humanRacers(world: World): Racer[] {
  return world.racers
    .filter((racer) => isHuman(world, racer.id))
    .sort((a, b) => RACER_IDS.indexOf(a.id) - RACER_IDS.indexOf(b.id));
}

/** The racer with the lowest `progress`; the first in `racers` wins a tie. `racers` is not empty. */
function leastProgressLeft(racers: readonly Racer[]): Racer {
  return racers.reduce((best, racer) => (racer.progress < best.progress ? racer : best));
}

/** Whether `racer` has crossed the line. */
function hasFinished(racer: Racer): racer is FinishedRacer {
  return racer.finished !== null;
}

/** The racer with the best finish place. `racers` is not empty. */
function bestFinisher(racers: readonly FinishedRacer[]): Racer {
  return racers.reduce((best, racer) => (racer.finished.place < best.finished.place ? racer : best));
}
