/**
 * How race facts read on screen: times as m:ss.cc, places as "2nd", and each
 * racer's display name. The HUD, title and results all format through here so
 * the same fact always reads the same way.
 */
import { TICK_HZ } from '@arcade/core';
import type { RacerId } from '../../logic/types.ts';

const RACER_NAMES: Record<RacerId, string> = { player: 'Pip', tess: 'Tess', squib: 'Squib', bo: 'Bo' };

/** Logic ticks as a race time, e.g. 1234 ticks reads "0:20.56". Rounds down to the hundredth. */
export function formatRaceTime(ticks: number): string {
  const centis = Math.floor((ticks * 100) / TICK_HZ);
  const minutes = Math.floor(centis / 6000);
  const seconds = Math.floor((centis % 6000) / 100);
  return `${minutes}:${String(seconds).padStart(2, '0')}.${String(centis % 100).padStart(2, '0')}`;
}

/** A place as an English ordinal: 1st, 2nd, 3rd, 4th. */
export function ordinal(place: number): string {
  const teens = place % 100 >= 11 && place % 100 <= 13;
  const suffix = teens ? 'th' : (['th', 'st', 'nd', 'rd'][place % 10] ?? 'th');
  return `${place}${suffix}`;
}

/** The saved best as the title screen shows it, e.g. "Best 0:24.46 (2nd)". */
export function formatBest(best: { ticks: number; place: number }): string {
  return `Best ${formatRaceTime(best.ticks)} (${ordinal(best.place)})`;
}

/** The name a racer goes by on screen. */
export function racerName(id: RacerId): string {
  return RACER_NAMES[id];
}
