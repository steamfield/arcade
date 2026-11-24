/**
 * The course's shifting wind zones (`level.shiftingWind`) on the race screen, a sky theme extra
 * layer: pale streaks drifting along the way each zone blows over its columns, and a windsock hung
 * from the first open tile at the top of the zone's middle column that points downwind and swings round through the warning
 * before each turn. Read from the zone's timer (`windDirection`, `ticksToTurn`), so it is drawn
 * from `world.race.raceTick` alone. Code-drawn global art.
 */
import type Phaser from 'phaser';
import { isSolid } from '../../logic/level/query.ts';
import { SHIFTING_WIND, ticksToTurn, windDirection, windWarning } from '../../logic/setpieces/shifting-wind.ts';
import { type Level, type ShiftingWindDef, TILE, type World } from '../../logic/types.ts';
import type { ThemeLayer } from '../themes/types.ts';
import { Layer } from './layers.ts';

/** How one zone looks on one frame. */
export interface WindLook {
  /** Which way the streaks drift: 1 toward +x, -1 toward -x. */
  dir: -1 | 1;
  /** How far the streaks have drifted along `dir`, px, wrapped to one streak spacing. */
  driftPx: number;
  streakAlpha: number;
  /** Where the windsock points, from -1 (straight toward -x) through 0 (hanging) to 1 (toward +x). */
  sockLean: number;
}

/** Horizontal and vertical gap between streaks, px. */
const STREAK_SPACING_X = 48;
const STREAK_SPACING_Y = 40;
const STREAK_LENGTH_PX = 24;
/** How fast streaks drift, px per race tick: a gust's 60 px/s. */
const STREAK_PX_PER_TICK = 1;
const STREAK_ALPHA = 0.5;
/** Streaks fade to this through a warning, so the coming turn reads. */
const WARNING_STREAK_ALPHA = 0.25;
const STREAK_COLOUR = 0xeef4ff;
const SOCK_COLOUR = 0xff7a3a;
const POLE_COLOUR = 0x5a5470;
const SOCK_LENGTH_PX = 30;
const POLE_HEIGHT_PX = 26;

/**
 * How `zone` looks on race tick `raceTick`. Streaks drift downwind; through the warning they fade and
 * the windsock swings from downwind across to the coming direction, hanging straight halfway.
 */
export function windLook(zone: ShiftingWindDef, raceTick: number): WindLook {
  const dir = windDirection(zone, raceTick);
  const warning = windWarning(zone, raceTick);
  const drift = (raceTick * STREAK_PX_PER_TICK) % STREAK_SPACING_X;
  const swing = warning ? 1 - ticksToTurn(zone, raceTick) / SHIFTING_WIND.warnTicks : 0;
  return {
    dir,
    driftPx: dir * drift,
    streakAlpha: warning ? WARNING_STREAK_ALPHA : STREAK_ALPHA,
    sockLean: dir * (1 - 2 * swing),
  };
}

/** Adds the wind zones of `world`'s level to `scene` as a theme layer; a level without any adds nothing. */
export function createWindView(scene: Phaser.Scene, world: World): ThemeLayer {
  const zones = world.level.shiftingWind;
  const streaks = scene.add.graphics().setDepth(Layer.water + 0.4);
  const sock = scene.add.graphics().setDepth(Layer.player + 0.3);
  const heightPx = world.level.height * TILE;
  const socks = zones.map((zone) => sockMount(world.level, zone));
  return {
    sync(current) {
      streaks.clear();
      sock.clear();
      const raceTick = current.race.phase === 'racing' ? current.race.raceTick : 0;
      zones.forEach((zone, index) => {
        const look = windLook(zone, raceTick);
        drawStreaks(streaks, zone, look, heightPx);
        drawSock(sock, socks[index] ?? { x: 0, y: 0 }, look);
      });
    },
  };
}

/** Short streaks on a staggered grid over the zone's columns, shifted along the wind by `look.driftPx`. */
function drawStreaks(
  graphics: Phaser.GameObjects.Graphics,
  zone: ShiftingWindDef,
  look: WindLook,
  heightPx: number,
): void {
  const left = zone.cols[0] * TILE;
  const right = (zone.cols[1] + 1) * TILE;
  graphics.lineStyle(2, STREAK_COLOUR, look.streakAlpha);
  for (let row = 0, y = STREAK_SPACING_Y / 2; y < heightPx; row++, y += STREAK_SPACING_Y) {
    // Alternate rows sit half a spacing apart so the streaks don't line up in columns.
    const stagger = (row % 2) * (STREAK_SPACING_X / 2);
    for (let x = left - STREAK_SPACING_X + stagger + look.driftPx; x < right; x += STREAK_SPACING_X) {
      const from = Math.max(left, x);
      const to = Math.min(right, x + STREAK_LENGTH_PX);
      if (to > from) graphics.lineBetween(from, y, to, y);
    }
  }
}

/** Where a zone's windsock pole hangs from, px: the zone's middle, at the top of its first open tile from the sky's top. */
function sockMount(level: Level, zone: ShiftingWindDef): { x: number; y: number } {
  const column = Math.floor((zone.cols[0] + zone.cols[1]) / 2);
  let row = 0;
  while (row < level.height - 1 && isSolid(level, new Set(), column, row)) row += 1;
  return { x: (column + 0.5) * TILE, y: row * TILE };
}

/** The windsock: a pole hanging from `mount` with the cone at its foot. */
function drawSock(graphics: Phaser.GameObjects.Graphics, mount: { x: number; y: number }, look: WindLook): void {
  const { x } = mount;
  const top = mount.y + POLE_HEIGHT_PX;
  graphics.lineStyle(2, POLE_COLOUR, 1);
  graphics.lineBetween(x, mount.y, x, top);
  // The cone runs downwind from the pole top; hanging straight it droops down the pole.
  const reach = look.sockLean * SOCK_LENGTH_PX;
  const droop = (1 - Math.abs(look.sockLean)) * SOCK_LENGTH_PX;
  graphics.fillStyle(SOCK_COLOUR, 1);
  graphics.fillTriangle(x, top - 6, x, top + 6, x + reach, top + droop);
}
