/**
 * What a drifter's surroundings do to it this tick: the cell under its centre, where currents are
 * solar wind and kelp is nebula dust. An Ion Stream (Riptide) lane over the drifter replaces the
 * cell's wind, as it does a swimmer's current.
 */
import { sampleEnvironment } from '../../level/query.ts';
import { feltCurrent } from '../../powerups/riptides.ts';
import type { Racer, World } from '../../types.ts';
import type { DriftEnv } from './data.ts';

/** Drift's `sampleEnvironment`. */
export function sampleDriftEnvironment(world: World, racer: Racer): DriftEnv {
  const cell = sampleEnvironment(world.level, racer.body);
  return { kind: 'drift', wind: feltCurrent(world, racer, cell.current), inDust: cell.inKelp };
}
