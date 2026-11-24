/**
 * What a flyer's surroundings do to it this tick: the cell under its centre, where currents are wind
 * (gusts `<` `>`, updrafts `^`, downdrafts `v`) and kelp is a fog bank. A shifting wind zone over the
 * flyer (`setpieces/shifting-wind.ts`) replaces the cell's sideways wind with its gust, a Headwind front
 * over it (`powerups/twists/headwind.ts`) replaces either, and a Jet Stream (Riptide) lane over the
 * flyer replaces all of them, as it does a swimmer's current. `physics.ts` turns the
 * wind into a gust's drift (`windSpeed`) or a draft's push (`draftForce`) and fog into a lower cruise.
 */
import { sampleEnvironment } from '../../level/query.ts';
import { feltCurrent } from '../../powerups/riptides.ts';
import { headwindAt } from '../../powerups/twists/headwind.ts';
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
  const wind = windUnderJetStream(world, racer, cell.current);
  return { kind: 'flight', wind: feltCurrent(world, racer, wind), inFog: cell.inKelp };
}

/**
 * The wind a Jet Stream lane would replace: a Headwind front's gust over the flyer, else a shifting
 * wind zone's, else the cell's own. Either gust replaces only the cell's sideways wind, so an updraft
 * or downdraft still lifts or sinks the flyer.
 */
function windUnderJetStream(world: World, racer: Racer, cellWind: Vec | null): Vec | null {
  const headwind = headwindAt(world, racer);
  if (headwind !== null) return { x: headwind, y: cellWind?.y ?? 0 };
  const zone = shiftingWindAt(world, centreOf(racer));
  return zone ? gustOver(zone, cellWind) : cellWind;
}

/** A shifting wind zone's gust as flight's wind: one unit along x per gust's push, over the cell's own draft. */
function gustOver(zone: FeltWind, cellWind: Vec | null): Vec {
  return { x: (zone.dir * zone.push) / GUST_PUSH, y: cellWind?.y ?? 0 };
}
