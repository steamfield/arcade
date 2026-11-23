/**
 * Steering around hazards. The flow fields treat urchin and jelly tiles (and the
 * enemies swimming over open water) as open water, so a rival aiming through one is knocked back and swims into it again.
 * `avoidHazards` checks the body's path a short way along the aim and, when a
 * hazard is in it, turns the aim by the smallest angle that clears it.
 *
 * Reads the world only. No trig per tick: the turns are precomputed.
 */
import { ignoresHazard } from '../abilities.ts';
import { enemyBox, isHarmful } from '../hazards/enemies/contact.ts';
import { eelReachBox } from '../hazards/enemies/eel.ts';
import { SHARK } from '../hazards/enemies/tuning.ts';
import { jellyCentre } from '../hazards/jellies.ts';
import { JELLY } from '../hazards/tuning.ts';
import { isSolid } from '../level/query.ts';
import { cos, sin } from '../num.ts';
import { type Box, type Enemy, type Racer, TILE, type Vec, type World } from '../types.ts';

/**
 * How far ahead along the aim, in px, the body's path is checked; the step between checks; the
 * clearance kept around the body; how far a turn must stay off rock; how far above and below its
 * box a jelly is treated as reaching, for the bob it makes while the racer closes in; and the
 * turns tried, in degrees.
 */
export const HAZARD_AVOID = {
  lookaheadPx: 64,
  stepPx: 4,
  marginPx: 2,
  wallCheckPx: 12,
  jellyReachPx: 24,
  turnsDeg: [15, 30, 45, 60, 75, 90],
} as const;

/** How far ahead along its move, in px, a rival with a dash charge looks for a crab or out eel to dash into. */
export const BONK_LOOKAHEAD_PX = 24;

/** Turns tried, smallest first, as cos and sin pairs. */
const TURNS = HAZARD_AVOID.turnsDeg.map((deg) => ({
  cos: cos((deg * Math.PI) / 180),
  sin: sin((deg * Math.PI) / 180),
}));

/**
 * The aim, or the nearest turn of it either side (left first) whose path is clear, widened by one
 * more step when that is clear too, since the body carries its momentum through the turn. A path
 * is clear when the body's box, grown by the margin, slides `lookaheadPx` along it without touching
 * an urchin tile, a jelly's reach or an enemy (`enemyDanger`), nor rock within `wallCheckPx`.
 *
 * An inflated racer is urchin-proof and bonks enemies, so it steers around jellies only; a racer whose ability
 * ignores jelly stings (`ignoresHazard`) swims straight through jellies.
 *
 * @returns `aim` itself (the same object) when its path is clear or no turn is; a new unit vector
 *   when it turns.
 */
export function avoidHazards(world: World, racer: Racer, aim: Vec): Vec {
  if (aim.x === 0 && aim.y === 0) return aim;
  const hazards = hazardsNear(world, racer.body, {
    urchins: racer.status.inflated === 0,
    jellies: !ignoresHazard(racer, 'jelly'),
    enemies: racer.status.inflated === 0,
  });
  if (hazards.length === 0 || pathIsClear(world, hazards, racer.body, aim)) return aim;
  const turn = (index: number, side: number): Vec => {
    const { cos: c, sin: s } = TURNS[Math.min(index, TURNS.length - 1)] ?? { cos: 1, sin: 0 };
    return { x: aim.x * c - aim.y * s * side, y: aim.y * c + aim.x * s * side };
  };
  for (let index = 0; index < TURNS.length; index++) {
    for (const side of [-1, 1]) {
      if (!pathIsClear(world, hazards, racer.body, turn(index, side))) continue;
      const wider = turn(index + 1, side);
      return pathIsClear(world, hazards, racer.body, wider) ? wider : turn(index, side);
    }
  }
  return aim;
}

/**
 * Boxes of the active jellies, the urchins and the dangerous enemies, each kind only when it can hurt, near enough to
 * matter within the look-ahead. Runs every tick for every rival, so it rules hazards out by
 * position before building any box.
 */
function hazardsNear(world: World, body: Box, hurts: { urchins: boolean; jellies: boolean; enemies: boolean }): Box[] {
  const reach = HAZARD_AVOID.lookaheadPx + 2 * TILE;
  const near = (x: number, y: number) => Math.abs(x - body.x) < reach && Math.abs(y - body.y) < reach;
  const found: Box[] = [];
  if (hurts.urchins) {
    for (const tile of world.level.urchins) {
      if (near(tile.x * TILE, tile.y * TILE)) found.push({ x: tile.x * TILE, y: tile.y * TILE, w: TILE, h: TILE });
    }
  }
  if (hurts.jellies) {
    const half = JELLY.size / 2;
    const reachY = HAZARD_AVOID.jellyReachPx;
    for (const jelly of world.jellies) {
      // A jelly bobs straight up and down, so its home column settles x before its bob is worked out.
      if (jelly.stunned > 0 || Math.abs((jelly.home.x + 0.5) * TILE - half - body.x) >= reach) continue;
      const centre = jellyCentre(jelly);
      const box = { x: centre.x - half, y: centre.y - half - reachY, w: JELLY.size, h: JELLY.size + 2 * reachY };
      if (near(box.x, box.y)) found.push(box);
    }
  }
  if (hurts.enemies) {
    for (const enemy of world.enemies) {
      const box = enemyDanger(enemy);
      if (box && near(box.x, box.y)) found.push(box);
    }
  }
  return found;
}

/** Seconds of a winding-up or charging shark's path a rival keeps out of, since a hunting shark turns after it. */
const SHARK_CHARGE_LOOKAHEAD_S = 0.4;

/**
 * The box a rival keeps out of for `enemy`, or null when it can't hurt: a crab, or a shark that is
 * neither winding up nor charging, at its box; a winding-up or charging shark along the next SHARK_CHARGE_LOOKAHEAD_S of its path; an eel
 * from the start of its warning to the end of its lunge, along its whole reach, since it comes out
 * faster than a rival turns.
 */
export function enemyDanger(enemy: Enemy): Box | null {
  if (enemy.kind === 'eel') {
    return enemy.mode === 'windup' || enemy.mode === 'lunge' ? eelReachBox(enemy) : null;
  }
  if (!isHarmful(enemy)) return null;
  const box = enemyBox(enemy);
  if (enemy.kind !== 'shark') return box;
  if (enemy.mode === 'charge') return sweptAlong(box, enemy.vel, SHARK_CHARGE_LOOKAHEAD_S);
  // A winding-up shark is about to charge out along its facing; keep out of that lane before it goes.
  if (enemy.mode === 'windup')
    return sweptAlong(box, { x: enemy.facing * SHARK.chargeSpeed, y: 0 }, SHARK_CHARGE_LOOKAHEAD_S);
  return box;
}

/** `box` stretched to cover where it will be after moving at `vel` px/s for `seconds`. */
function sweptAlong(box: Box, vel: Vec, seconds: number): Box {
  const dx = vel.x * seconds;
  const dy = vel.y * seconds;
  return { x: box.x + Math.min(0, dx), y: box.y + Math.min(0, dy), w: box.w + Math.abs(dx), h: box.h + Math.abs(dy) };
}

/** Seconds of a charging shark's path a rival with a charge treats as about to touch it. */
const SHARK_BONK_LEAD_S = 0.15;

/**
 * True when `racer`'s body, slid up to BONK_LOOKAHEAD_PX along `dir`, touches a live crab, an eel
 * that is out of its hole or a charging shark about to reach it: a dash bonk beats the first two and
 * staggers the shark, so a rival with a charge dashes into it.
 */
export function aboutToBonk(world: World, racer: Racer, dir: Vec): boolean {
  if (dir.x === 0 && dir.y === 0) return false;
  const targets = world.enemies
    .filter((enemy) => isHarmful(enemy) && (enemy.kind !== 'shark' || enemy.mode === 'charge'))
    .map((enemy) =>
      // A charging shark closes faster than a rival turns: meet it with a dash just before it lands.
      enemy.kind === 'shark' ? sweptAlong(enemyBox(enemy), enemy.vel, SHARK_BONK_LEAD_S) : enemyBox(enemy),
    );
  if (targets.length === 0) return false;
  const { body } = racer;
  for (let travelled = 0; travelled <= BONK_LOOKAHEAD_PX; travelled += HAZARD_AVOID.stepPx) {
    const box = { x: body.x + dir.x * travelled, y: body.y + dir.y * travelled, w: body.w, h: body.h };
    if (targets.some((target) => overlaps(box, target))) return true;
  }
  return false;
}

function pathIsClear(world: World, hazards: readonly Box[], body: Box, dir: Vec): boolean {
  const { lookaheadPx, stepPx, marginPx, wallCheckPx } = HAZARD_AVOID;
  for (let travelled = 0; travelled <= lookaheadPx; travelled += stepPx) {
    const box = {
      x: body.x + dir.x * travelled - marginPx,
      y: body.y + dir.y * travelled - marginPx,
      w: body.w + 2 * marginPx,
      h: body.h + 2 * marginPx,
    };
    if (hazards.some((hazard) => overlaps(box, hazard))) return false;
    // Rock only counts close by: a turn may run toward a wall it will turn back from in time.
    if (travelled <= wallCheckPx && touchesSolid(world, box)) return false;
  }
  return true;
}

function touchesSolid(world: World, box: Box): boolean {
  const { level, broken } = world;
  for (let ty = Math.floor(box.y / TILE); ty <= Math.floor((box.y + box.h) / TILE); ty++) {
    for (let tx = Math.floor(box.x / TILE); tx <= Math.floor((box.x + box.w) / TILE); tx++) {
      if (isSolid(level, broken, tx, ty)) return true;
    }
  }
  return false;
}

function overlaps(a: Box, b: Box): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
