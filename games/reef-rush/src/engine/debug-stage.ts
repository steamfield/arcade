/**
 * Capture stages for `arcade see`-style review: `?stage=<name>` on the race URL puts the attack
 * power-ups into the world before the first frame, so their views can be looked at while the
 * logic that spawns them is still being built (and without waiting for a race to roll one). A
 * stage only writes plain world state (a stack, a status, a squid, a lane, a decoy) that the views
 * read; it never runs in a normal launch, since nothing else sets `?stage=`.
 *
 * The names: `icons-a` and `icons-b` fill the player's well; `squid-flight` sends squids at rivals;
 * `squid-lockon` locks one on the player from in view and `squid-lockon-far` from off-screen;
 * `squid-latched` latches squids on the player and a rival; `riptide` lays a lane over a current
 * with a rival riding it; `decoy` leaves a rival's decoy beside it; `undertow` pulls two racers back.
 */
import { playerOf } from '../logic/racers.ts';
import { type Level, type Racer, type RacerId, TILE, type Vec, type World } from '../logic/types.ts';

/** Every stage name `applyStage` knows. */
export const STAGES = [
  'icons-a',
  'icons-b',
  'squid-flight',
  'squid-lockon',
  'squid-lockon-far',
  'squid-latched',
  'riptide',
  'decoy',
  'undertow',
] as const;

/** A name from `STAGES`. */
export type StageName = (typeof STAGES)[number];

/** Ticks a staged effect lasts; long enough to still be showing when a capture is taken. */
const STAGED_TICKS = 600;
const SQUID_SPEED = 110;

/** The `?stage=` the page was opened with, when it names a known stage. */
export function readStage(search: string = window.location.search): StageName | null {
  const name = new URLSearchParams(search).get('stage');
  return STAGES.find((stage) => stage === name) ?? null;
}

/** Writes the stage's state into `world`. Call it once, before the first frame. */
export function applyStage(world: World, stage: StageName): void {
  const player = playerOf(world);
  const rival = racer(world, 'tess');
  const at = centreOf(player);
  switch (stage) {
    case 'icons-a':
      player.stack = ['homingSquid', 'riptide', 'undertow'];
      return;
    case 'icons-b':
      player.stack = ['mimic'];
      return;
    case 'squid-flight':
      world.squids.push(
        squid(at.x + 70, at.y - 24, SQUID_SPEED, 0, 'player', { kind: 'racer', id: 'tess' }),
        squid(at.x - 30, at.y + 30, -SQUID_SPEED * 0.8, SQUID_SPEED * 0.6, 'squib', { kind: 'racer', id: 'bo' }),
      );
      return;
    case 'squid-lockon':
      world.squids.push(squid(at.x + 90, at.y - 20, -SQUID_SPEED, 12, 'tess', { kind: 'racer', id: 'player' }));
      return;
    case 'squid-lockon-far':
      world.squids.push(squid(at.x - 300, at.y - 40, SQUID_SPEED, 6, 'tess', { kind: 'racer', id: 'player' }));
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
      world.decoys.push({ x: rivalAt.x + 22, y: rivalAt.y + 2, vx: 66, vy: 0, ttl: STAGED_TICKS, owner: 'tess' });
      return;
    }
    case 'undertow':
      rival.status.undertow = STAGED_TICKS;
      racer(world, 'squib').status.undertow = STAGED_TICKS;
      return;
  }
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
    owner: 'player',
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
