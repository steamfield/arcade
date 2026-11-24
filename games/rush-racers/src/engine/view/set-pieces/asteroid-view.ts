/**
 * Drifting asteroids on the race screen (`level.asteroids`): a rock sprite at each asteroid's place
 * this race tick (`asteroidAt`, the same function the logic hits with), turning slowly as it glides,
 * and on Easy a faint dotted line along each track so a child can see where it will go. Before the
 * race starts every asteroid sits where race tick 0 puts it. The spin comes from the race tick, so
 * captures repeat, and is slow enough to keep under reduced motion (a theme layer isn't told the
 * setting). A space theme extra layer.
 */
import type Phaser from 'phaser';
import { asteroidAt } from '../../../logic/setpieces/asteroids.ts';
import { type AsteroidDef, TILE, type Vec, type World } from '../../../logic/types.ts';
import { drawSprite } from '../../art/pixel.ts';
import type { ThemeLayer } from '../../themes/types.ts';
import { Layer } from '../layers.ts';

/** What to draw for one asteroid on one frame: its centre and size in px and its turn in radians. */
export interface AsteroidMark {
  x: number;
  y: number;
  radius: number;
  angle: number;
}

/** Texture key for the asteroid rock, drawn once per game. */
export const ASTEROID_TEXTURE = 'asteroid-rock';

/** How far an asteroid turns per race tick, radians: a full turn in about 5 s. */
const SPIN_PER_TICK = (2 * Math.PI) / 300;
/** Px between the dots of an Easy track line, and each dot's radius and look. */
const TRACK_DOT = { spacing: 10, radius: 1.5, colour: 0xe8c8a0, alpha: 0.35 } as const;

/**
 * A lumpy rock with craters, lit from the upper left like the theme's planets, inside a dark outline
 * with a warm rim on its lit side, so it reads as a moving hazard apart from the grey course rock.
 */
const ROCK_ROWS = [
  '.....000000.....',
  '...0044443300...',
  '..045443333330..',
  '.04543333113330.',
  '.04433311113330.',
  '0443333311333330',
  '0433333333333110',
  '0433113333331110',
  '0431111333333310',
  '0433113333333310',
  '0333333331133310',
  '.03333333113310.',
  '.03333333333110.',
  '..033331333110..',
  '...0011111100...',
  '.....000000.....',
];
const ROCK_PALETTE = [0x2a1e2e, 0x4c4a68, 0xb0aed0, 0x8a88b0, 0xe4e2f8, 0xffb070];

/** One mark per asteroid of `world`'s level at its current race tick, in the level's order. */
export function asteroidMarks(world: World): AsteroidMark[] {
  const { raceTick } = world.race;
  return world.level.asteroids.map((def, index) => {
    const at = asteroidAt(def, raceTick);
    // Neighbours turn opposite ways, so a field of them doesn't spin in lockstep.
    const direction = index % 2 === 0 ? 1 : -1;
    return { x: at.x, y: at.y, radius: def.radius * TILE, angle: direction * raceTick * SPIN_PER_TICK };
  });
}

/** The dots of an Easy track line from one end of `def`'s track to the other, in px. */
export function trackDots(def: AsteroidDef): Vec[] {
  const from = { x: (def.from[0] + 0.5) * TILE, y: (def.from[1] + 0.5) * TILE };
  const to = { x: (def.to[0] + 0.5) * TILE, y: (def.to[1] + 0.5) * TILE };
  const steps = Math.max(1, Math.round(Math.hypot(to.x - from.x, to.y - from.y) / TRACK_DOT.spacing));
  return Array.from({ length: steps + 1 }, (_, step) => ({
    x: from.x + ((to.x - from.x) * step) / steps,
    y: from.y + ((to.y - from.y) * step) / steps,
  }));
}

/**
 * Adds `world`'s asteroids to `scene` and returns the layer that moves them each frame. A level
 * without asteroids adds nothing.
 *
 * @throws {Error} When the rock's pixel text is malformed (see `drawSprite`).
 */
export function createAsteroidView(scene: Phaser.Scene, world: World): ThemeLayer {
  if (world.level.asteroids.length === 0) return { sync() {} };
  if (!scene.textures.exists(ASTEROID_TEXTURE)) drawSprite(scene, ASTEROID_TEXTURE, ROCK_ROWS, ROCK_PALETTE);
  if (world.difficulty === 'easy') drawTracks(scene, world.level.asteroids);
  const rocks = world.level.asteroids.map((def) =>
    scene.add
      .image(0, 0, ASTEROID_TEXTURE)
      .setDisplaySize(def.radius * 2 * TILE, def.radius * 2 * TILE)
      .setDepth(Layer.objects),
  );
  return {
    sync(current) {
      asteroidMarks(current).forEach((mark, index) => {
        rocks[index]?.setPosition(mark.x, mark.y).setRotation(mark.angle);
      });
    },
  };
}

/** The faint dotted track lines, drawn once under the rocks. */
function drawTracks(scene: Phaser.Scene, defs: readonly AsteroidDef[]): void {
  const graphics = scene.add.graphics().setDepth(Layer.objects - 0.1);
  graphics.fillStyle(TRACK_DOT.colour, TRACK_DOT.alpha);
  for (const def of defs) {
    for (const dot of trackDots(def)) graphics.fillCircle(dot.x, dot.y, TRACK_DOT.radius);
  }
}
