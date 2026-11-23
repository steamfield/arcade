/**
 * Reading run's nav: the distance to the finish at a tile, the next step along the best link, a
 * horizontal-only aim for the Easy guide and steering assist, and the level check that every start
 * can reach the finish.
 */
import { fieldAt } from '../../race/flowfield.ts';
import { type Box, type Level, TILE, type Vec, type World } from '../../types.ts';
import type { LevelProblem, MediumNav } from '../types.ts';
import { type RunLink, type RunNav, runNav } from './way-data.ts';

/**
 * The ticks to the finish from `tile`; Infinity off the grid or where it can't be reached. An open
 * tile in the air reads the stand tile it falls to.
 *
 * @throws {Error} When the world's nav was built by another medium.
 */
export function runDistanceAt(world: World, tile: Vec): number {
  const nav = runNav(world.nav);
  return fieldAt(nav.distance, nav, tile);
}

/** The first step of a link: sideways along a walk or a drop, and up along a jump (diagonal when it moves sideways). */
function firstStep(link: RunLink, from: Vec, width: number): Vec {
  if (link.kind !== 'jump') return { x: link.dir, y: 0 };
  return { x: Math.sign((link.to % width) - from.x), y: -1 };
}

/**
 * The step for an open tile with no link of its own: the first step of the link its stand tile
 * follows, so a runner in the air keeps the arrow the jump had; the step toward that stand tile when
 * it follows none. Null when the tile reads no stand tile or is on the finish.
 */
function stepFromAnchor(nav: RunNav, tile: Vec): Vec | null {
  const anchor = nav.anchor[tile.y * nav.width + tile.x] ?? -1;
  if (anchor < 0) return null;
  const anchorTile = { x: anchor % nav.width, y: Math.floor(anchor / nav.width) };
  const link = nav.best[anchor];
  if (link) return firstStep(link, anchorTile, nav.width);
  const step = { x: Math.sign(anchorTile.x - tile.x), y: Math.sign(anchorTile.y - tile.y) };
  return step.x === 0 && step.y === 0 ? null : step;
}

/**
 * Offset of the next step toward the finish from `tile`: the first step of a stand tile's best link
 * (up or diagonal for a jump), or for an open tile in the air the first step of the link of the
 * stand tile it reads. Null at the finish, where nothing is reachable, off the grid or in rock.
 *
 * @throws {Error} When the world's nav was built by another medium.
 */
export function runNextTile(world: World, tile: Vec): Vec | null {
  const nav = runNav(world.nav);
  if (tile.x < 0 || tile.y < 0 || tile.x >= nav.width || tile.y >= nav.height) return null;
  if (!Number.isFinite(runDistanceAt(world, tile))) return null;
  const link = nav.best[tile.y * nav.width + tile.x];
  return link ? firstStep(link, tile, nav.width) : stepFromAnchor(nav, tile);
}

/**
 * Horizontal unit aim toward the next tile on the way: `{x: ±1, y: 0}`, or zero at the finish or
 * when the way goes straight up or down. Always horizontal, so the Easy steering assist never presses Up.
 *
 * @throws {Error} When the world's nav was built by another medium.
 */
export function runAimFrom(world: World, body: Box, _lookaheadTiles: number): Vec {
  const tile = { x: Math.floor((body.x + body.w / 2) / TILE), y: Math.floor((body.y + body.h / 2) / TILE) };
  const step = runNextTile(world, tile);
  if (!step || step.x === 0) return { x: 0, y: 0 };
  return { x: Math.sign(step.x), y: 0 };
}

/**
 * Why `level` can't be raced on foot: one problem for each start whose distance to the finish is
 * Infinity, located at that start.
 *
 * @throws {Error} When `nav` was built by another medium.
 */
export function validateRunLevel(level: Level, nav: MediumNav): LevelProblem[] {
  const runNavigation = runNav(nav);
  return level.starts.flatMap((start, index) =>
    Number.isFinite(fieldAt(runNavigation.distance, runNavigation, start))
      ? []
      : [
          {
            message: `Start ${index + 1} cannot reach the finish running: no chain of walks, drops and jumps leads there`,
            row: start.y,
            col: start.x,
          },
        ],
  );
}
