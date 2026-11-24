/**
 * Geyser vents, Sunlit Shallows' set piece: each vent warns, then erupts on a timer that is a pure
 * function of the race tick, pushing racers in its column upward (`LevelDef.vents`). Reading the
 * vents from the course, the phase of each one, the column it reaches, and the push it gives during
 * the race all live here; nothing about a vent is stored on `World`.
 */
import { LevelError } from '../level/level-error.ts';
import { centreOf } from '../racers.ts';
import { type Box, type Racer, TILE, type Vec, type VentDef, type World } from '../types.ts';

/**
 * A vent's timing and force. Each cycle opens with `warnTicks` of rumbling and then `eruptTicks` of
 * eruption; the rest of the period is quiet. `push` is the upward acceleration an eruption gives a
 * racer in its column (px/s²): twice a strong current (swim's 160 under a Riptide's 1.5x), so even
 * an idle racer riding it from the floor breaches a surface above it, and in the air it just beats
 * gravity (450), carrying a racer up to the column's top before it arcs back down.
 * A column is `widthTiles` wide, from the vent's column rightward, so a racer crossing it at cruise
 * speed spends long enough inside to be thrown.
 */
export const VENT = { warnTicks: 45, eruptTicks: 60, push: 480, widthTiles: 2 } as const;

/** The shortest period a vent may have: one whole warning and one whole eruption. */
export const VENT_MIN_PERIOD_TICKS = VENT.warnTicks + VENT.eruptTicks;

/** Where a vent is in its cycle. */
export type VentPhase = 'quiet' | 'warning' | 'erupting';

/**
 * How far into its current cycle `vent` is on `raceTick`, from 0 to `periodTicks - 1`. The race
 * starts `offsetTicks` into the first cycle, so a vent with offset k is where an unshifted vent
 * will be k ticks later.
 */
export function ventCycleTick(vent: VentDef, raceTick: number): number {
  const shifted = (raceTick + vent.offsetTicks) % vent.periodTicks;
  // `%` keeps the dividend's sign, so a negative tick needs a period added to land in the cycle.
  return shifted < 0 ? shifted + vent.periodTicks : shifted;
}

/**
 * The phase of `vent` on `raceTick`: 'warning' for the first `VENT.warnTicks` of each cycle,
 * 'erupting' for the `VENT.eruptTicks` after them, 'quiet' for the rest.
 */
export function ventPhase(vent: VentDef, raceTick: number): VentPhase {
  const cycleTick = ventCycleTick(vent, raceTick);
  if (cycleTick < VENT.warnTicks) return 'warning';
  if (cycleTick < VENT_MIN_PERIOD_TICKS) return 'erupting';
  return 'quiet';
}

/**
 * The world px an eruption of `vent` reaches: `VENT.widthTiles` columns from the vent's, from the
 * bottom of its tile up to the top of the tile `height` rows above it.
 */
export function ventColumn(vent: VentDef): Box {
  const top = vent.row - vent.height;
  return { x: vent.col * TILE, y: top * TILE, w: VENT.widthTiles * TILE, h: (vent.height + 1) * TILE };
}

/**
 * Checks a level's vents and returns copies of them in the order written.
 *
 * @throws {LevelError} For a vent whose column leaves a map `width` by `height` tiles (its foot or
 *   its top), a `height` below 1, a `periodTicks` shorter than `VENT_MIN_PERIOD_TICKS`, or two vents whose columns
 *   share a map column, naming the vent by its index.
 */
export function parseVents(defs: readonly VentDef[], width: number, height: number): VentDef[] {
  const vents = defs.map((def, index) => requireVent(def, index, width, height));
  requireApart(vents);
  return vents;
}

/** A copy of one vent, checked on its own. */
function requireVent(def: VentDef, index: number, width: number, height: number): VentDef {
  const { col, row } = def;
  const lastCol = col + VENT.widthTiles - 1;
  if (col < 0 || lastCol >= width || row < 0 || row >= height) {
    throw new LevelError(
      `Vent ${index} at col ${col}, row ${row} is off the map: its ${VENT.widthTiles}-tile column needs ` +
        `cols 0-${width - 1} and rows 0-${height - 1}`,
      row,
      col,
    );
  }
  if (!(def.height >= 1)) {
    throw new LevelError(`Vent ${index} has height ${def.height}; it must reach at least 1 tile up`, row, col);
  }
  if (row - def.height < 0) {
    throw new LevelError(
      `Vent ${index} reaches row ${row - def.height}, above the map; lower its height to at most ${row}`,
      row,
      col,
    );
  }
  if (!(def.periodTicks >= VENT_MIN_PERIOD_TICKS)) {
    throw new LevelError(
      `Vent ${index} repeats every ${def.periodTicks} ticks, shorter than its ${VENT.warnTicks}-tick warning ` +
        `plus ${VENT.eruptTicks}-tick eruption; use at least ${VENT_MIN_PERIOD_TICKS}`,
      row,
      col,
    );
  }
  return { col, row, height: def.height, periodTicks: def.periodTicks, offsetTicks: def.offsetTicks };
}

/** Throws on the first pair of vents whose columns share a map column, so a racer is only ever over one. */
function requireApart(vents: readonly VentDef[]): void {
  vents.forEach((vent, index) => {
    vents.slice(0, index).forEach((earlier, other) => {
      if (Math.abs(earlier.col - vent.col) >= VENT.widthTiles) return;
      throw new LevelError(
        `Vent ${index} at col ${vent.col} shares a column with vent ${other} at col ${earlier.col}; ` +
          `space vents at least ${VENT.widthTiles} columns apart`,
        vent.row,
        vent.col,
      );
    });
  });
}

/**
 * The vents slot of `stepRace`, after lightning and before contacts, while racing. Emits
 * `vent.warned {vent}` on a vent's first warning tick and `vent.erupted {vent}` on its first
 * eruption tick, once per cycle, and during an eruption adds `VENT.push * dt` of upward speed to
 * every racer in `racing` whose centre is in the vent's column (`ventColumn`). Finished, fallen and
 * trapped racers are left alone, as currents leave them. Every vent counts as quiet before the
 * start, so one already warning or erupting on race tick 0 announces it then.
 */
export function eruptVents(world: World, racing: readonly Racer[], dt: number): void {
  const raceTick = world.race.raceTick;
  world.level.vents.forEach((vent, index) => {
    const phase = ventPhase(vent, raceTick);
    if (phase !== phaseBefore(vent, raceTick)) announcePhase(world, index, phase);
    if (phase === 'erupting') pushRacers(vent, racing, dt);
  });
}

/** The vent's phase on the tick before `raceTick`, quiet before the race started. */
function phaseBefore(vent: VentDef, raceTick: number): VentPhase {
  return raceTick === 0 ? 'quiet' : ventPhase(vent, raceTick - 1);
}

/** Emits the event for vent `vent` entering `phase`; a vent turning quiet has none. */
function announcePhase(world: World, vent: number, phase: VentPhase): void {
  if (phase === 'warning') world.events.emit({ type: 'vent.warned', vent });
  if (phase === 'erupting') world.events.emit({ type: 'vent.erupted', vent });
}

/** Speeds every racer the eruption can move that is in the vent's column upward. */
function pushRacers(vent: VentDef, racing: readonly Racer[], dt: number): void {
  const column = ventColumn(vent);
  for (const racer of racing) {
    if (!movableByVent(racer)) continue;
    if (contains(column, centreOf(racer))) racer.body.vy -= VENT.push * dt;
  }
}

/** False for a racer the water no longer moves: finished, out of the race for now, or trapped in a bubble. */
function movableByVent(racer: Racer): boolean {
  return racer.finished === null && racer.status.fallen === 0 && racer.status.trapped === 0;
}

/** True when `point` is inside `box`, counting its top and left edges but not its bottom and right. */
function contains(box: Box, point: Vec): boolean {
  return point.x >= box.x && point.x < box.x + box.w && point.y >= box.y && point.y < box.y + box.h;
}
