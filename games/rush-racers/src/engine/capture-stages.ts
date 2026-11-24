/**
 * Capture stages for `arcade see`-style review: `?stage=<name>` on the race URL puts the attack
 * power-ups into the world before the first frame, so their views can be reviewed without waiting
 * for a race to roll one (a seed rarely draws the squid, and the dark zone is the course's last stretch). A
 * stage only writes plain world state (items, a status, a squid, a lane, a decoy) that the views
 * read. It is honoured only with `?debug=1` or in test mode, and `Runtime.startRace` marks the race
 * staged so its result is never saved. Applied by `Runtime.startRace`, right after the world is built.
 * "The player" below is the local racer (the slot the screen follows, slot 1 without `?local=`), and
 * "a rival" is slot 2, or slot 1 when the local racer is slot 2.
 *
 * The names: `icons-a`, `icons-b` and `icons-c` (a lone Undertow, gone once fired) fill the player's well; `cannonball`
 * holds a Cannonball three tiles before the first coral gate, facing it; `squid-flight` sends squids at rivals;
 * `squid-lockon` locks one on the player from in view and `squid-lockon-far` from off-screen;
 * `squid-latched` latches squids on the player and a rival; `riptide` lays a lane over a current
 * with a rival riding it; `decoy` leaves a rival's decoy beside it; `undertow` pulls two racers back;
 * `dark` moves the pack into the first dark zone with a squid and a decoy near the player; `guide`
 * stands the player against the first wall whose way on is up or down, already stuck for 2.5 s, so
 * the Easy guide arrow shows from the GO (and does nothing on a course with no such wall); `enemies` stands the
 * player on the floor with a crab on the floor 3 tiles ahead walking away from them and a shark about 6 tiles
 * ahead facing them, and moves the rivals up out of the way;
 * `enemy-modes` lines up each enemy kind in each of its modes ahead of the player on the floor, for reviewing
 * their look (the logic moves them on from there once the race starts); `surface` puts the player
 * 3 tiles under the first surface; `hole` puts the player at rest in the first black hole's column,
 * two tiles outside its reach (below it, or above when below is rock or off the map), so a short
 * flight at it is swallowed.
 */
import { guideDistanceAt, guideFor } from '../logic/guide.ts';
import { createEnemies } from '../logic/hazards/enemies/index.ts';
import { cellAt, isSolid } from '../logic/level/query.ts';
import { CHARGES } from '../logic/powerups/charges.ts';
import { setItems, slotItems } from '../logic/powerups/inventory.ts';
import {
  type Enemy,
  type EnemyKind,
  type Level,
  type PowerUpKind,
  type Racer,
  type RacerId,
  TILE,
  type Vec,
  type World,
} from '../logic/types.ts';
import { localOf } from './local-racer.ts';

/** Every stage name `applyStage` knows. */
export const STAGES = [
  'icons-a',
  'icons-b',
  'icons-c',
  'cannonball',
  'squid-flight',
  'squid-lockon',
  'squid-lockon-far',
  'squid-latched',
  'riptide',
  'decoy',
  'undertow',
  'dark',
  'guide',
  'enemies',
  'enemy-modes',
  'surface',
  'hole',
] as const;

/** A name from `STAGES`. */
type StageName = (typeof STAGES)[number];

/**
 * The items a stage puts in the player's slots from the left, each with the charges a clam gives,
 * the first selected. `icons-c` holds a lone Undertow, which has one charge, so firing it empties
 * the inventory.
 */
const STAGED_ITEMS: Partial<Record<StageName, readonly PowerUpKind[]>> = {
  'icons-a': ['homingSquid', 'riptide', 'undertow'],
  'icons-b': ['mimic', 'cannonball'],
  'icons-c': ['undertow'],
  cannonball: ['cannonball'],
};

/** Ticks a staged effect lasts; long enough to still be showing when a capture is taken. */
const STAGED_TICKS = 600;
const SQUID_SPEED = 110;
/** How long the `guide` stage has the player stuck already (150 ticks, 2.5 s: past the arrow's 1.5 s). */
const STAGED_STUCK_TICKS = 150;

/** The launch parameters a stage depends on. */
interface StageGate {
  debug: boolean;
  testMode: boolean;
}

/**
 * The `?stage=` the page was opened with: null unless it names a known stage and the launch is a
 * debug (`?debug=1`) or test-mode one, so a stray or shared link cannot stage a real race.
 */
export function stageFor(gate: StageGate, search: string = window.location.search): StageName | null {
  if (!gate.debug && !gate.testMode) return null;
  const name = new URLSearchParams(search).get('stage');
  return STAGES.find((stage) => stage === name) ?? null;
}

/** Writes the stage's state into `world`. Call it once, before the first frame. */
export function applyStage(world: World, stage: StageName): void {
  const player = localOf(world);
  const rival = racer(world, player.id === 'tess' ? 'player' : 'tess');
  const at = centreOf(player);
  const kinds = STAGED_ITEMS[stage];
  if (kinds) {
    const slots = slotItems(player).map((_, slot) => {
      const kind = kinds[slot];
      return kind === undefined ? null : { kind, charges: CHARGES[kind] };
    });
    setItems(player, slots, 0);
  }
  switch (stage) {
    case 'icons-a':
    case 'icons-b':
    case 'icons-c':
      return;
    case 'cannonball':
      faceFirstCoral(world, player);
      return;
    case 'squid-flight':
      world.squids.push(
        squid(at.x + 70, at.y - 24, SQUID_SPEED, 0, player.id, { kind: 'racer', id: rival.id }),
        squid(at.x - 30, at.y + 30, -SQUID_SPEED * 0.8, SQUID_SPEED * 0.6, 'squib', { kind: 'racer', id: 'bo' }),
      );
      return;
    case 'squid-lockon':
      world.squids.push(squid(at.x + 90, at.y - 20, -SQUID_SPEED, 12, rival.id, { kind: 'racer', id: player.id }));
      return;
    case 'squid-lockon-far':
      world.squids.push(squid(at.x - 300, at.y - 40, SQUID_SPEED, 6, rival.id, { kind: 'racer', id: player.id }));
      return;
    case 'squid-latched':
      player.status.latched = STAGED_TICKS;
      rival.status.latched = STAGED_TICKS;
      return;
    case 'riptide':
      layRiptideOverCurrent(world, player, rival);
      return;
    case 'decoy': {
      const rivalAt = centreOf(rival);
      world.decoys.push({ x: rivalAt.x + 22, y: rivalAt.y + 2, vx: 66, vy: 0, ttl: STAGED_TICKS, owner: rival.id });
      return;
    }
    case 'dark':
      stageInDarkZone(world, player, rival);
      return;
    case 'guide':
      standAtWall(world, player);
      return;
    case 'undertow':
      rival.status.undertow = STAGED_TICKS;
      racer(world, 'squib').status.undertow = STAGED_TICKS;
      return;
    case 'enemies':
      stageEnemies(world, player);
      return;
    case 'enemy-modes':
      stageEnemyModes(world, player);
      return;
    case 'surface':
      stageUnderSurface(world, player);
      return;
    case 'hole':
      stageOutsideHole(world, player);
      return;
  }
}

/** Tiles between a black hole's reach and where the `hole` stage puts the player. */
const HOLE_STAGE_GAP_TILES = 2;

/**
 * Puts the player at rest in the first black hole's column, `HOLE_STAGE_GAP_TILES` outside its
 * reach: below the hole when that spot is open, else above it.
 *
 * @throws {Error} When the course has no black hole, or both spots are rock or off the map.
 */
function stageOutsideHole(world: World, player: Racer): void {
  const hole = world.level.wells.find((well) => well.horizon !== null);
  if (!hole) throw new Error('The hole stage needs a black hole, and this course has none');
  const offset = hole.reach + HOLE_STAGE_GAP_TILES * TILE;
  const tx = Math.floor(hole.centre.x / TILE);
  const { w, h } = player.body;
  // Every tile the placed body would overlap must be open, since a reach need not be whole tiles.
  const y = [hole.centre.y + offset, hole.centre.y - offset].find((candidate) => {
    for (let ty = Math.floor((candidate - h / 2) / TILE); ty <= Math.floor((candidate + h / 2 - 1) / TILE); ty += 1) {
      for (
        let x = Math.floor((hole.centre.x - w / 2) / TILE);
        x <= Math.floor((hole.centre.x + w / 2 - 1) / TILE);
        x += 1
      ) {
        if (ty < 0 || ty >= world.level.height || isSolid(world.level, world.broken, x, ty)) return false;
      }
    }
    return true;
  });
  if (y === undefined) {
    throw new Error(
      `The hole stage needs an open tile ${offset / TILE} tiles above or below the black hole in column ${tx}`,
    );
  }
  player.body.x = hole.centre.x - player.body.w / 2;
  player.body.y = y - player.body.h / 2;
  player.body.vx = 0;
  player.body.vy = 0;
}

/**
 * Stands the player on the floor below its start, with a crab on the floor 3 tiles ahead walking
 * away from them (so it can't walk into the player before a dash) and a shark 6 tiles ahead in the
 * first open water 2 or more tiles above the floor, facing the player. The rivals go to the top of
 * the player's start column, out of the way, so none of them dashes into the crab first.
 */
function stageEnemies(world: World, player: Racer): void {
  const column = Math.floor(centreOf(player).x / TILE);
  const start = standOnFloor(world, player);
  const sharkFloor = nearestFloor(world.level, start.x + 6, start.y);
  const shark = openWaterAbove(world.level, sharkFloor.x, sharkFloor.y - 2);
  world.enemies.push(
    { ...stagedEnemy(world.level, 'crab', nearestFloor(world.level, start.x + 3, start.y)), facing: 1 },
    { ...stagedEnemy(world.level, 'shark', shark), facing: -1 },
  );
  const rivals = world.racers.filter((racer) => racer !== player);
  const topRows = openRowsFromTop(world.level, column, rivals.length);
  rivals.forEach((rival, index) => {
    const row = topRows[index] as number;
    rival.body.x = (column + 0.5) * TILE - rival.body.w / 2;
    rival.body.y = (row + 0.5) * TILE - rival.body.h / 2;
    rival.body.vx = 0;
    rival.body.vy = 0;
  });
}

/**
 * The first `count` water rows in column `x`, top down.
 *
 * @throws {Error} When the column has fewer, naming it.
 */
function openRowsFromTop(level: Level, x: number, count: number): number[] {
  const rows = [...Array(level.height).keys()].filter((y) => cellAt(level, x, y) === 'water').slice(0, count);
  if (rows.length < count) {
    throw new Error(
      `The enemies stage needs ${count} open water tiles in column ${x} for the rivals, and has ${rows.length}`,
    );
  }
  return rows;
}

/**
 * Stands the player on the floor and lines up, ahead of them: on the floor, an eel hidden, warning
 * and out (each in the floor, lunging up), a walking crab and a staggered crab; above, a shark
 * patrolling, winding up on the player and charging, and one staggered. An enemy whose column has
 * no floor (a bounce cloud or a pit there) stands in the nearest column that has one.
 */
function stageEnemyModes(world: World, player: Racer): void {
  const start = standOnFloor(world, player);
  const onFloor = (dx: number) => nearestFloor(world.level, start.x + dx, start.y);
  const above = (dx: number, rise: number) => {
    const floor = onFloor(dx);
    return openWaterAbove(world.level, floor.x, floor.y - rise);
  };
  const lunging = stagedEnemy(world.level, 'eel', onFloor(5));
  lunging.at.y -= 1.5 * TILE;
  world.enemies.push(
    { ...stagedEnemy(world.level, 'crab', onFloor(7)), vel: { x: -20, y: 0 } },
    { ...stagedEnemy(world.level, 'crab', onFloor(9)), mode: 'stagger' },
    { ...stagedEnemy(world.level, 'eel', onFloor(1)), mode: 'hidden' },
    { ...stagedEnemy(world.level, 'eel', onFloor(3)), mode: 'windup', modeTicks: 10 },
    { ...lunging, mode: 'lunge' },
    { ...stagedEnemy(world.level, 'shark', above(3, 5)), facing: 1, hp: 2 },
    { ...stagedEnemy(world.level, 'shark', above(6, 5)), mode: 'windup', target: player.id, hp: 2 },
    {
      ...stagedEnemy(world.level, 'shark', above(3, 2)),
      mode: 'charge',
      target: player.id,
      facing: -1,
      vel: { x: -180, y: 0 },
    },
    { ...stagedEnemy(world.level, 'shark', above(7, 2)), mode: 'stagger', hp: 1 },
  );
}

/** A fresh enemy of `kind` on `tile` of `level`, as `createEnemies` makes one from a glyph there (and checks it fits). */
function stagedEnemy(level: Level, kind: EnemyKind, tile: Vec): Enemy {
  const [enemy] = createEnemies({ ...level, enemies: [{ kind, tile }] });
  if (!enemy) throw new Error(`createEnemies made no ${kind} for the stage`);
  return enemy;
}

/** Puts the player at rest on the floor below its start tile and returns that tile. */
function standOnFloor(world: World, player: Racer): Vec {
  const centre = centreOf(player);
  const tile = nearestFloor(world.level, Math.floor(centre.x / TILE), Math.floor(centre.y / TILE));
  player.body.x = (tile.x + 0.5) * TILE - player.body.w / 2;
  player.body.y = (tile.y + 0.5) * TILE - player.body.h / 2;
  player.body.vx = 0;
  player.body.vy = 0;
  player.facing = 1;
  return tile;
}

/**
 * The floor tile nearest column `x`: the floor row at or below `fromY` (see `floorRowIn`) in column
 * `x`, or, when that column has none (a bounce cloud or a pit in the floor), in the closest column
 * that has one, ahead before behind on a tie.
 *
 * @throws {Error} When no column has such a floor, naming the row and column asked for.
 */
function nearestFloor(level: Level, x: number, fromY: number): Vec {
  for (let reach = 0; reach < level.width; reach++) {
    const columns = reach === 0 ? [x] : [x + reach, x - reach];
    for (const column of columns) {
      if (column < 0 || column >= level.width) continue;
      const row = floorRowIn(level, column, fromY);
      if (row !== null) return { x: column, y: row };
    }
  }
  throw new Error(
    `The enemy stages need a floor below row ${fromY} in column ${x}, and no column has a floor at or below that row`,
  );
}

/** The first row at or below `fromY` in column `x` that isn't rock and has rock under it, or null when there is none. */
function floorRowIn(level: Level, x: number, fromY: number): number | null {
  for (let y = Math.max(0, fromY); y < level.height - 1; y++) {
    if (cellAt(level, x, y) !== 'rock' && cellAt(level, x, y + 1) === 'rock') return y;
  }
  return null;
}

/**
 * The first water tile in column `x` from row `fromY` upward.
 *
 * @throws {Error} When the column has no open water there, naming it.
 */
function openWaterAbove(level: Level, x: number, fromY: number): Vec {
  for (let y = fromY; y >= 0; y--) {
    if (cellAt(level, x, y) === 'water') return { x, y };
  }
  throw new Error(`The enemy stages need open water above row ${fromY} in column ${x}, and there is none`);
}

/**
 * Puts the player at rest three tiles left of the course's first coral (scanning columns left to
 * right, each top down), level with the middle of a two-tile gate or the centre of a one-tile one.
 *
 * @throws {Error} When the course has no coral to face.
 */
function faceFirstCoral(world: World, player: Racer): void {
  const coral = firstCoral(world.level);
  const centreY = cellAt(world.level, coral.x, coral.y + 1) === 'coral' ? (coral.y + 1) * TILE : (coral.y + 0.5) * TILE;
  player.body.x = (coral.x - 3 + 0.5) * TILE - player.body.w / 2;
  player.body.y = centreY - player.body.h / 2;
  player.body.vx = 0;
  player.body.vy = 0;
  player.facing = 1;
}

/** The course's first coral tile, scanning columns left to right and each top down. */
function firstCoral(level: Level): Vec {
  for (let x = 0; x < level.width; x++) {
    for (let y = 0; y < level.height; y++) {
      if (cellAt(level, x, y) === 'coral') return { x, y };
    }
  }
  throw new Error('The cannonball stage needs coral to break, and this course has none');
}

function racer(world: World, id: RacerId): Racer {
  const found = world.racers.find((candidate) => candidate.id === id);
  if (!found)
    throw new Error(`The stage needs racer "${id}" but the world has ${world.racers.map((r) => r.id).join(', ')}`);
  return found;
}

function centreOf(body: Racer): Vec {
  return { x: body.body.x + body.body.w / 2, y: body.body.y + body.body.h / 2 };
}

function squid(
  x: number,
  y: number,
  vx: number,
  vy: number,
  owner: RacerId,
  target: World['squids'][number]['target'],
): World['squids'][number] {
  return { x, y, vx, vy, ttl: STAGED_TICKS, owner, target };
}

/**
 * Moves the player and a rival to the first run of rightward current in the course and lays a
 * lane 8 tiles long over it, the rival inside the lane and the player behind it.
 */
function layRiptideOverCurrent(world: World, player: Racer, rival: Racer): void {
  const tile = firstCurrentRun(world.level);
  const place = (target: Racer, tx: number, ty: number) => {
    target.body.x = tx * TILE + (TILE - target.body.w) / 2;
    target.body.y = ty * TILE + (TILE - target.body.h) / 2;
    target.body.vx = 0;
    target.body.vy = 0;
  };
  place(player, tile.x - 3, tile.y);
  place(rival, tile.x + 2, tile.y);
  world.riptides.push({
    x: tile.x * TILE,
    y: (tile.y - 1) * TILE,
    w: 8 * TILE,
    h: 2 * TILE,
    dir: { x: 1, y: 0 },
    ttl: STAGED_TICKS,
    owner: player.id,
  });
}

/** The first tile in the course that starts a run of at least 3 rightward current tiles with open water above it. */
function firstCurrentRun(level: Level): Vec {
  for (let x = 4; x < level.width - 4; x++) {
    for (let y = 2; y < level.height - 1; y++) {
      const run = [0, 1, 2].every((step) => level.cells[y]?.[x + step] === 'current-right');
      if (run && level.cells[y - 1]?.[x] === 'water') return { x, y };
    }
  }
  throw new Error(
    'The riptide stage needs a run of three rightward current tiles under open water, and this course has none',
  );
}

/** Moves the player and a rival into open water in the first dark zone, with a squid and a decoy beside them. */
function stageInDarkZone(world: World, player: Racer, rival: Racer): void {
  const zone = world.level.dark[0];
  if (!zone) throw new Error('The dark stage needs a dark zone, and this course has none');
  const tx = zone[0] + 10;
  const ty = [...Array(world.level.height).keys()].find(
    (y) => world.level.cells[y]?.[tx] === 'water' && world.level.cells[y - 1]?.[tx] === 'water',
  );
  if (ty === undefined) throw new Error(`The dark stage needs open water in column ${tx}, and there is none`);
  const place = (target: Racer, x: number, y: number) => {
    target.body.x = x - target.body.w / 2;
    target.body.y = y - target.body.h / 2;
    target.body.vx = 0;
    target.body.vy = 0;
  };
  const cx = tx * TILE + TILE / 2;
  const cy = ty * TILE + TILE / 2;
  place(player, cx, cy);
  place(rival, cx + 70, cy);
  world.squids.push(squid(cx + 36, cy - 14, -SQUID_SPEED, 0, rival.id, { kind: 'racer', id: player.id }));
  world.decoys.push({ x: cx + 70, y: cy + 22, vx: 66, vy: 0, ttl: STAGED_TICKS, owner: rival.id });
}

/**
 * Puts the player at rest 3 tiles under the first surface, 5 columns into it, with open water and
 * then sky straight above, so swimming up breaches.
 */
function stageUnderSurface(world: World, player: Racer): void {
  const surface = world.level.surface[0];
  if (!surface) throw new Error('The surface stage needs a surface, and this course has none');
  const tx = surface.from + 5;
  const ty = surface.row + 3;
  for (let y = 0; y <= ty; y++) {
    const cell = world.level.cells[y]?.[tx];
    if (cell !== (y < surface.row ? 'air' : 'water')) {
      throw new Error(`The surface stage needs a clear column at ${tx} down to row ${ty}, and row ${y} is ${cell}`);
    }
  }
  player.body.x = tx * TILE + TILE / 2 - player.body.w / 2;
  player.body.y = ty * TILE + TILE / 2 - player.body.h / 2;
  player.body.vx = 0;
  player.body.vy = 0;
}

/**
 * Puts the player at rest on the first open tile (scanning columns left to right from the start, each from the bottom up) whose
 * right-hand neighbour is rock and whose way on is straight up or down, and records them as stuck
 * there. Leaves the world alone when the course has no such tile.
 */
function standAtWall(world: World, player: Racer): void {
  const { level } = world;
  for (let tx = 4; tx < level.width - 1; tx++) {
    for (let ty = level.height - 2; ty >= 1; ty--) {
      if (cellAt(level, tx, ty) !== 'water' || cellAt(level, tx + 1, ty) !== 'rock') continue;
      player.body.x = tx * TILE + (TILE - player.body.w) / 2;
      player.body.y = ty * TILE + (TILE - player.body.h) / 2;
      player.body.vx = 0;
      player.body.vy = 0;
      const way = guideFor(world, player).dir;
      if (way?.x !== 0) continue;
      world.guide.bestSteer = guideDistanceAt(world, { x: tx, y: ty });
      world.guide.stuckTicks = STAGED_STUCK_TICKS;
      return;
    }
  }
}
