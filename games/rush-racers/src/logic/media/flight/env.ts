/**
 * What a flyer's surroundings do to it this tick: the cell under its centre, where currents are wind
 * (gusts `<` `>`, updrafts `^`, downdrafts `v`) and kelp is a fog bank. A shifting wind zone over the
 * flyer (`setpieces/shifting-wind.ts`) replaces the cell's wind with its gust, and a Jet Stream
 * (Riptide) lane over the flyer replaces either, as it does a swimmer's current. `physics.ts` turns the
 * wind into a gust's drift (`windSpeed`) or a draft's push (`draftForce`) and fog into a lower cruise.
 */
import { sampleEnvironment } from '../../level/query.ts';
import { feltCurrent } from '../../powerups/riptides.ts';
import { centreOf } from '../../racers.ts';
import { type FeltWind, shiftingWindAt } from '../../setpieces/shifting-wind.ts';
import type { Racer, Vec, World } from '../../types.ts';
import type { FlightEnv } from './data.ts';
import { FLIGHT_TUNING } from './tuning.ts';

/**
 * A gust cell's push, px/s²: it drifts a flyer coasting in still air up to `windSpeed` at `drag`, so
 * a shifting wind zone pushing at `push` px/s² is felt as `push / GUST_PUSH` gusts.
 */
const GUST_PUSH = FLIGHT_TUNING.drag;

/** Flight's `sampleEnvironment`. */
export function sampleFlightEnvironment(world: World, racer: Racer): FlightEnv {
  const cell = sampleEnvironment(world.level, racer.body);
  const zone = shiftingWindAt(world, centreOf(racer));
  const wind = zone ? gustOver(zone, cell.current) : cell.current;
  return { kind: 'flight', wind: feltCurrent(world, racer, wind), inFog: cell.inKelp };
}

/** A shifting wind zone's gust as flight's wind: one unit along x per gust's push, over the cell's own draft. */
function gustOver(zone: FeltWind, cellWind: Vec | null): Vec {
  return { x: (zone.dir * zone.push) / GUST_PUSH, y: cellWind?.y ?? 0 };
}
