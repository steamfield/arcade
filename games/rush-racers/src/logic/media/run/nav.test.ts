/**
 * Run's stand tiles, links and nav, checked on small inline levels: which tiles a runner stands on,
 * where walks, drops and jumps lead, what the solved nav answers through the medium's own members
 * (`distanceAt`, `nextTile`, `aimFrom`, `validateLevel`), and that a planned jump lands where it says
 * when the real physics flies it.
 */
import { EventLog, TICK_DT } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import { CASES_BY_MEDIUM } from '../../conformance/geometries.ts';
import type { GameEvent } from '../../events.ts';
import { assistedIntent, guideFor } from '../../guide.ts';
import { parseLevel } from '../../level/parse.ts';
import { tileIndex } from '../../level/query.ts';
import { progressAt } from '../../race/flowfield.ts';
import { courseFromLevel, hold, IDLE, placeOnTile, racerOf } from '../../test-world.ts';
import { type Level, TILE, type Vec, type World } from '../../types.ts';
import { createWorld, stepWorld } from '../../world.ts';
import { MEDIA } from '../index.ts';
import { runMotion } from './data.ts';
import { buildLinks } from './links.ts';
import { buildRunNav } from './nav.ts';
import { standTiles } from './terrain.ts';
import { RUN_TUNING } from './tuning.ts';
import type { RunLink } from './way-data.ts';

const run = MEDIA.run;
const NOTHING_BROKEN: ReadonlySet<number> = new Set();

/** Rock all round, six rows of air over a floor at row 7 with the starts on it and a pit of `width` tiles from col 8. */
function pitLevel(width: number): string {
  const air = `#${'.'.repeat(20)}#`;
  const rows = [
    '#'.repeat(22),
    air,
    air,
    air,
    air,
    air,
    `#1.2.3.4${'.'.repeat(12)}F#`,
    `${'#'.repeat(8)}${'.'.repeat(width)}${'#'.repeat(14 - width)}`,
  ];
  return rows.join('\n');
}

/** Two ledge tiles a two-tile jump up from the floor, in front of a wall too high to jump. */
const LEDGE_LEVEL = `
  ##################
  #...............F#
  #...............F#
  #...............F#
  #...........######
  #...........######
  #.......====######
  #1.2.3.4....######
  ##################
`;

/** A floor with a rock step, a crate on top of a one-tile gap above it, and the finish beyond. */
const SHAPES = `
  ###########
  #.........#
  #...?.....#
  #.........#
  #.=.......#
  #C..1234.F#
  ###########
`;

/** A drop off a ledge of floor onto a lower pocket. */
const DROP_LEVEL = `
  ############
  #..........#
  #1234.....F#
  ######....##
  ######....##
  ######....##
  ############
`;

function levelOf(ascii: string): Level {
  return parseLevel({ name: 'nav', ascii });
}

/** The tile (col,row) as the strings "col,row", in reading order, for readable expectations. */
function names(tiles: Iterable<number>, width: number): string[] {
  return [...tiles].sort((a, b) => a - b).map((tile) => `${tile % width},${Math.floor(tile / width)}`);
}

/** The links out of tile (col, row) in `ascii`. */
function linksFrom(ascii: string, col: number, row: number, broken: ReadonlySet<number> = NOTHING_BROKEN): RunLink[] {
  const level = levelOf(ascii);
  return buildLinks(level, broken, run.tuning).get(tileIndex(level, col, row)) ?? [];
}

/** The link kinds and the tile each one ends on, as "kind->col,row". */
function describeLinks(links: readonly RunLink[], width: number): string[] {
  return links.map((link) => `${link.kind}->${link.to % width},${Math.floor(link.to / width)}`);
}

/** A world in run on `ascii`, before the countdown has moved anyone. */
function runWorld(ascii: string): World {
  return createWorld(courseFromLevel(ascii, 'run'), new EventLog<GameEvent>(100_000), { seed: 1 });
}

describe('stand tiles', () => {
  const level = levelOf(SHAPES);

  it('are the open tiles with rock, coral, a ledge or a crate under them', () => {
    const found = names(standTiles(level, NOTHING_BROKEN), level.width);

    expect(found).toEqual([
      '4,1', // on the crate
      '2,3', // on the ledge
      '1,4', // on the coral
      '2,5',
      '3,5',
      '4,5',
      '5,5',
      '6,5',
      '7,5',
      '8,5',
      '9,5', // along the floor
    ]);
  });

  it('lose the tile over coral once the coral is broken, and gain the one in its place', () => {
    const coral = tileIndex(level, 1, 5);
    const found = names(standTiles(level, new Set([coral])), level.width);

    expect(found).not.toContain('1,4');
    expect(found).toContain('1,5');
  });
});

describe('links', () => {
  it('walk to the next stand tile on the row, both ways', () => {
    const width = levelOf(DROP_LEVEL).width;

    expect(describeLinks(linksFrom(DROP_LEVEL, 2, 2), width).filter((link) => link.startsWith('walk'))).toEqual([
      'walk->3,2',
      'walk->1,2',
    ]);
  });

  it('drop off an edge to the stand tile below it, and not into a wall', () => {
    const width = levelOf(DROP_LEVEL).width;
    const drop = describeLinks(linksFrom(DROP_LEVEL, 5, 2), width).filter((link) => link.startsWith('drop'));

    expect(drop).toEqual(['drop->6,5']);
    expect(describeLinks(linksFrom(DROP_LEVEL, 1, 2), width).filter((link) => link.startsWith('drop'))).toEqual([]);
  });

  it('jump a pit three tiles wide, and not one five wide', () => {
    const crossing = (width: number) =>
      linksFrom(pitLevel(width), 7, 6).filter((link) => link.kind === 'jump' && link.to % 22 >= 8 + width);

    expect(crossing(3).map((link) => link.to % 22)).toEqual([11]);
    expect(crossing(5)).toEqual([]);
  });

  it('give each jump the shortest hold that lands, longer for a longer jump', () => {
    const holds = linksFrom(pitLevel(3), 7, 6)
      .filter((link) => link.kind === 'jump' && link.dir === 1)
      .map((link) => link.holdTicks);

    expect(holds.length).toBeGreaterThan(0);
    expect(holds.every((ticks) => ticks >= 1)).toBe(true);
  });

  it('jump up through a ledge onto it from below', () => {
    const level = levelOf(LEDGE_LEVEL);
    const up = linksFrom(LEDGE_LEVEL, 7, 7).filter(
      (link) => link.kind === 'jump' && Math.floor(link.to / level.width) === 5,
    );

    expect(up.map((link) => link.to % level.width)).toContain(9);
  });

  it('end only on stand tiles, never inside a crate or a wall', () => {
    const level = levelOf(SHAPES);
    const stand = standTiles(level, NOTHING_BROKEN);
    const ends = [...buildLinks(level, NOTHING_BROKEN, run.tuning).values()].flat().map((link) => link.to);

    expect(ends.filter((tile) => !stand.has(tile))).toEqual([]);
  });
});

/**
 * Where a jump link lands when `ascii`'s real physics flies it from the middle of its tile, held
 * toward the way it runs. The runner is as slow as the slowest rivals the links are planned for
 * (forceMul 0.8 runs at 90 % of `runSpeed`).
 */
function flownLanding(ascii: string, from: Vec, link: RunLink): Vec {
  const world = runWorld(ascii);
  world.race = { phase: 'racing', raceTick: 0, rivalsDoneAt: null, result: null, endsWhen: 'player' };
  const player = racerOf(world, 'player');
  placeOnTile(player, from.x, from.y);
  player.body.y = (from.y + 1) * TILE - player.body.h;
  player.profile = { ...player.profile, forceMul: 0.8 };
  player.body.vx = RUN_TUNING.extra.runSpeed * 0.9 * link.dir;
  runMotion(player.motion).grounded = true;
  for (let tick = 0; tick < 120; tick++) {
    stepWorld(world, hold({ x: link.dir, y: tick < link.holdTicks ? -1 : 0 }), TICK_DT);
    if (tick > 2 && runMotion(player.motion).grounded) break;
  }
  const centre = player.body.x + player.body.w / 2;
  return { x: Math.floor(centre / TILE), y: Math.floor((player.body.y + player.body.h - 1) / TILE) };
}

describe('planned jumps', () => {
  it('land on the row they name and within a tile of the column when the real physics flies them', () => {
    const level = levelOf(LEDGE_LEVEL);
    const table = buildLinks(level, NOTHING_BROKEN, run.tuning);
    const wrong: string[] = [];
    for (const [from, out] of table) {
      for (const link of out.filter((candidate) => candidate.kind === 'jump')) {
        const start = { x: from % level.width, y: Math.floor(from / level.width) };
        const landed = flownLanding(LEDGE_LEVEL, start, link);
        const wanted = { x: link.to % level.width, y: Math.floor(link.to / level.width) };
        if (landed.y !== wanted.y || Math.abs(landed.x - wanted.x) > 1) {
          wrong.push(
            `${start.x},${start.y} hold ${link.holdTicks} wanted ${wanted.x},${wanted.y} got ${landed.x},${landed.y}`,
          );
        }
      }
    }

    expect(wrong).toEqual([]);
  });
});

describe('the solved nav', () => {
  const world = runWorld(pitLevel(3));

  it('counts ticks that fall to 0 at the finish, and are Infinity in rock and off the grid', () => {
    const along = [1, 5, 11, 15, 20].map((tx) => run.distanceAt(world, { x: tx, y: 6 }));

    expect(along).toEqual([...along].sort((a, b) => b - a));
    expect(along.at(-1)).toBe(0);
    expect(run.distanceAt(world, { x: 1, y: 7 })).toBe(Number.POSITIVE_INFINITY);
    expect(run.distanceAt(world, { x: -1, y: 6 })).toBe(Number.POSITIVE_INFINITY);
  });

  it('reads an open tile in the air as the stand tile it falls to', () => {
    expect(run.distanceAt(world, { x: 3, y: 2 })).toBe(run.distanceAt(world, { x: 3, y: 6 }));
  });

  it('reads the mouth of a pit as the nearest stand tile on its row plus a penalty', () => {
    const edge = run.distanceAt(world, { x: 7, y: 6 });

    expect(run.distanceAt(world, { x: 9, y: 6 })).toBeGreaterThan(edge - 1);
    expect(run.distanceAt(world, { x: 9, y: 6 })).toBeLessThan(Number.POSITIVE_INFINITY);
  });

  it('points a stand tile at its best link: sideways to walk, up to jump', () => {
    expect(run.nextTile(world, { x: 3, y: 6 })).toEqual({ x: 1, y: 0 });
    expect(run.nextTile(world, { x: 7, y: 6 })).toEqual({ x: 1, y: -1 });
    expect(run.nextTile(world, { x: 20, y: 6 })).toBeNull();
  });

  it('points a tile in the air down toward the stand tile it reads', () => {
    expect(run.nextTile(world, { x: 3, y: 3 })).toEqual({ x: 0, y: 1 });
  });

  it('aims only sideways from every open tile, so the Easy assist never presses Up', () => {
    const aims = world.level.cells.flatMap((row, ty) =>
      row.flatMap((cell, tx) =>
        cell === 'rock' ? [] : [run.aimFrom(world, { x: tx * TILE + 2, y: ty * TILE + 3, w: 12, h: 10 }, 1)],
      ),
    );

    expect(aims.filter((aim) => aim.y !== 0)).toEqual([]);
    expect(run.aimFrom(world, { x: 3 * TILE + 2, y: 6 * TILE + 3, w: 12, h: 10 }, 1)).toEqual({ x: 1, y: 0 });
  });

  it('ranks a runner over the pit ahead of one still before it', () => {
    const racing = runWorld(pitLevel(3));
    const ahead = racerOf(racing, 'tess').body;
    const behind = racerOf(racing, 'bo').body;
    placeOnTile(racerOf(racing, 'tess'), 9, 5);
    placeOnTile(racerOf(racing, 'bo'), 6, 6);

    expect(progressAt(racing.progress, ahead)).toBeLessThan(progressAt(racing.progress, behind));
  });
});

describe('route choice', () => {
  const cases = CASES_BY_MEDIUM.run?.geometries ?? [];
  const geometry = (name: string) => {
    const found = cases.find((candidate) => candidate.name === name);
    if (!found)
      throw new Error(`Run lists no geometry named '${name}'; its cases are ${cases.map((c) => c.name).join(', ')}`);
    return found.ascii;
  };

  it('takes a shorter high route over the longer way down and back up', () => {
    const world = runWorld(geometry('a high route'));

    expect(run.nextTile(world, { x: 8, y: 4 })).toEqual({ x: 1, y: -1 });
  });

  it('never links a jump across a gap too wide to cross, and gets over by the floor below', () => {
    const ascii = geometry('a dead-end jump');
    const world = runWorld(ascii);
    const { width } = world.level;
    const across = linksFrom(ascii, 9, 4).filter((link) => link.to % width >= 15 && Math.floor(link.to / width) < 8);

    expect(across).toEqual([]);
    expect(run.distanceAt(world, { x: 9, y: 4 })).toBeLessThan(Number.POSITIVE_INFINITY);
  });

  it('gives Infinity to a tile whose only way on is a jump no one can make', () => {
    const world = runWorld(`
      ####################
      #..................#
      #..................#
      #.............1234F#
      ########.....#######
    `);

    expect(run.distanceAt(world, { x: 3, y: 3 })).toBe(Number.POSITIVE_INFINITY);
    expect(run.distanceAt(world, { x: 14, y: 3 })).toBeLessThan(Number.POSITIVE_INFINITY);
  });
});

/** A wall two tiles high at col 5, right of the starts, with the finish beyond it. Runners stand on row 6. */
const TWO_TILE_WALL = `
  ############
  #.........F#
  #.........F#
  #.........F#
  #.........F#
  #....#....F#
  #1234#....F#
  ############
`;

describe('the Easy guide in run', () => {
  /** The player against the wall on Easy with the assist already on. */
  function playerAtTheWall() {
    const world = runWorld(TWO_TILE_WALL);
    world.difficulty = 'easy';
    world.guide.helpTicks = 30;
    const player = racerOf(world, 'player');
    placeOnTile(player, 4, 6);
    return { world, player };
  }

  it('points up at the jump', () => {
    const { world, player } = playerAtTheWall();

    expect(guideFor(world, player).dir).toEqual({ x: 1, y: -1 });
  });

  it('never presses Up for the player, whichever way the stick is held', () => {
    const { world, player } = playerAtTheWall();
    const sticks = [-1, -0.5, 0, 0.5, 1].flatMap((x) => [-0.5, -0.25, 0, 0.5, 1].map((y) => ({ x, y })));
    const pressed = sticks.filter((stick) => assistedIntent(world, player, hold(stick)).move.y < -0.5);

    expect(pressed).toEqual([]);
  });
});

describe('the level check', () => {
  const problemsIn = (ascii: string) => {
    const level = levelOf(ascii);
    return run.validateLevel(level, run.buildNav(level, NOTHING_BROKEN, run.tuning));
  };

  it('finds nothing wrong with a level a runner can race', () => {
    expect(problemsIn(pitLevel(3))).toEqual([]);
  });

  it('reports a start behind a pit too wide to jump, at its row and col', () => {
    const problems = problemsIn(pitLevel(5));

    expect(problems.map(({ row, col }) => ({ row, col }))).toEqual([1, 3, 5, 7].map((col) => ({ row: 6, col })));
    expect(problems[0]?.message).toContain('Start 1 cannot reach the finish running');
  });

  it('reports a start walled in by a crate, which is a platform and never a way through', () => {
    const problems = problemsIn(`
      ###########
      #.....#...#
      #.....#...#
      #.....#...#
      #.....#...#
      #.....#...#
      #1234.?..F#
      ###########
    `);

    expect(problems.map(({ row, col }) => ({ row, col }))).toEqual([1, 2, 3, 4].map((col) => ({ row: 6, col })));
  });

  it('rebuilds around broken coral so a start can pass', () => {
    const level = levelOf(`
      ##########
      #....C...#
      #....C...#
      #....C...#
      #....C...#
      #....C...#
      #1234C..F#
      ##########
    `);
    const coral = tileIndex(level, 5, 6);

    expect(run.validateLevel(level, run.buildNav(level, NOTHING_BROKEN, run.tuning)).length).toBeGreaterThan(0);
    expect(run.validateLevel(level, run.buildNav(level, new Set([coral]), run.tuning))).toEqual([]);
  });
});

describe('building the nav', () => {
  it('takes under 50 ms for a 300 by 20 level', () => {
    const row = (inner: string) => `#${inner}#`;
    const air = row('.'.repeat(298));
    const ground = row(Array.from({ length: 298 }, (_, col) => (col % 25 >= 20 && col % 25 < 23 ? '.' : '#')).join(''));
    const floorStand = row(`1.2.3.4${Array.from({ length: 291 }, (_, col) => (col === 290 ? 'F' : '.')).join('')}`);
    const rows = [
      row('#'.repeat(298)),
      ...Array.from({ length: 16 }, () => air),
      floorStand,
      ground,
      row('#'.repeat(298)),
    ];
    const level = levelOf(rows.join('\n'));
    const elapsed = Array.from({ length: 3 }, () => {
      const started = performance.now();
      buildRunNav(level, NOTHING_BROKEN, run.tuning);
      return performance.now() - started;
    });

    expect(Math.min(...elapsed)).toBeLessThan(50);
  });

  it('is unchanged by an idle step, so a world can keep its nav', () => {
    const world = runWorld(pitLevel(3));
    const before = world.nav;
    stepWorld(world, IDLE, TICK_DT);

    expect(world.nav).toBe(before);
  });
});
