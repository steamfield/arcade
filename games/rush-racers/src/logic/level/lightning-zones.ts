/**
 * Reads a course's storm zones (`LevelDef.lightning`) into the level: each zone a forward range of
 * columns on the map, apart from every other zone, with a cycle long enough to warn before it
 * strikes. Its own module so the parser stays about tiles.
 */
import { LIGHTNING } from '../hazards/tuning.ts';
import type { LevelDef, LightningZone } from '../types.ts';
import { LevelError } from './level-error.ts';

/** The shortest cycle a zone may have: a whole warning, then a whole strike. */
const MIN_PERIOD_TICKS = LIGHTNING.warnTicks + LIGHTNING.strikeTicks;

/**
 * Copies of the storm zones, in the order given, each checked against a map `width` columns wide.
 *
 * @throws {LevelError} For a zone whose columns run backwards or leave the map, whose period is
 *   shorter than `LIGHTNING.warnTicks + LIGHTNING.strikeTicks`, or that shares a column with another
 *   zone, naming the zone by its index and the columns or ticks at fault.
 */
export function requireLightningZones(zones: NonNullable<LevelDef['lightning']>, width: number): LightningZone[] {
  const checked = zones.map((zone, index) => requireZone(zone, index, width));
  requireApart(checked);
  return checked;
}

/** A copy of one zone, checked on its own. */
function requireZone(
  { cols: [from, to], periodTicks, offsetTicks }: LightningZone,
  index: number,
  width: number,
): LightningZone {
  if (from > to) throw new LevelError(`Lightning zone ${index} runs backwards from column ${from} to ${to}`);
  if (from < 0 || to >= width) {
    throw new LevelError(`Lightning zone ${index} covers columns ${from}-${to} but the map has columns 0-${width - 1}`);
  }
  if (periodTicks < MIN_PERIOD_TICKS) {
    throw new LevelError(
      `Lightning zone ${index} repeats every ${periodTicks} ticks, shorter than its ${LIGHTNING.warnTicks}-tick ` +
        `warning plus ${LIGHTNING.strikeTicks}-tick strike; use at least ${MIN_PERIOD_TICKS}`,
    );
  }
  return { cols: [from, to], periodTicks, offsetTicks };
}

/** Throws on the first pair of zones that share a column, so a racer is only ever in one storm. */
function requireApart(zones: readonly LightningZone[]): void {
  zones.forEach((zone, index) => {
    zones.slice(0, index).forEach((earlier, other) => {
      if (!overlaps(earlier, zone)) return;
      throw new LevelError(
        `Lightning zone ${index} (columns ${zone.cols.join('-')}) overlaps zone ${other} (columns ${earlier.cols.join('-')})`,
      );
    });
  });
}

function overlaps(a: LightningZone, b: LightningZone): boolean {
  return a.cols[0] <= b.cols[1] && b.cols[0] <= a.cols[1];
}
