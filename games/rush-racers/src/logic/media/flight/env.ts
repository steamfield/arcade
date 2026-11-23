/**
 * What a flyer's surroundings do to it this tick: the cell under its centre, where currents are wind
 * (gusts `<` `>`, updrafts `^`, downdrafts `v`) and kelp is a fog bank. A Jet Stream (Riptide) lane
 * over the flyer replaces the cell's wind, as it does a swimmer's current.
 *
 * Scaffold baseline: phase 1 lane a may replace it behind the same export.
 */
import { sampleEnvironment } from '../../level/query.ts';
import { feltCurrent } from '../../powerups/riptides.ts';
import type { Racer, World } from '../../types.ts';
import type { FlightEnv } from './data.ts';

/** Flight's `sampleEnvironment`. */
export function sampleFlightEnvironment(world: World, racer: Racer): FlightEnv {
  const cell = sampleEnvironment(world.level, racer.body);
  return { kind: 'flight', wind: feltCurrent(world, racer, cell.current), inFog: cell.inKelp };
}
