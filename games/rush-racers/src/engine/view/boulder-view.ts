/**
 * Thornwood's rolling Boulders on the race screen, as a forest theme extra layer: each boulder shot
 * in `world.shots` drawn as a cracked stone turning with the distance it has rolled, and a puff of
 * dust that fades where one ended. Read from world state every frame, so a boulder that is gone from
 * `world.shots` since the last frame is one that ended there. Code-drawn art, one texture per game.
 */
import type Phaser from 'phaser';
import { BOULDER_TUNING } from '../../logic/powerups/cannonball/boulder.ts';
import type { Shot, World } from '../../logic/types.ts';
import { drawFrames, type NamedFrame } from '../art/pixel.ts';
import type { ThemeLayer } from '../themes/types.ts';
import { Layer } from './layers.ts';

/** Texture key for the boulder sheet: the stone and its dust puff. */
export const BOULDER_TEXTURE = 'forest-boulder';
const BoulderFrame = { stone: 'stone', dust: 'dust' } as const;

/** How long a boulder's dust shows after it ends, in logic ticks. */
export const DUST_TICKS = 20;
/** How much the dust puff grows over its life, as a scale factor at its end. */
const DUST_GROWTH = 1.8;

/** A boulder as drawn this frame: who threw it and when (its key), where its centre is, and its turn in radians. */
export interface BoulderPose {
  key: string;
  x: number;
  y: number;
  angle: number;
}

/** A dust puff as drawn this frame. */
export interface DustLook {
  alpha: number;
  scale: number;
}

const FRAMES: readonly NamedFrame[] = [
  {
    name: BoulderFrame.stone,
    palette: [0x1a1612, 0x6e665a, 0x9a9282, 0x3a342c],
    rows: [
      '.....000000.....',
      '...0022222100...',
      '..022222211110..',
      '.02222221111110.',
      '.02222211331110.',
      '0222221133111110',
      '0222211331111110',
      '0221113311111110',
      '0211133111111110',
      '0111331111111110',
      '0113311111111130',
      '.01311111111130.',
      '.01111111111330.',
      '..011111113330..',
      '...0033333300...',
      '.....000000.....',
    ],
  },
  {
    name: BoulderFrame.dust,
    palette: [0x5a4a38, 0x8a7a62, 0xb8a88a],
    rows: [
      '................',
      '................',
      '.....1111.......',
      '....122221..11..',
      '...12222221.121.',
      '..1222222221.1..',
      '..12222222221...',
      '.1222222222221..',
      '.12222222222221.',
      '.11222222222221.',
      '..1112222222211.',
      '...011111111110.',
      '....0000000000..',
      '................',
      '................',
      '................',
    ],
  },
];

/**
 * The boulders in `world` this frame. Rolling without slipping, a boulder has turned through the
 * distance it rolled over its radius; since it rolls only along x, that is its x over its radius
 * (plus a constant, which no one can see). Its key is its owner and the tick it was thrown,
 * which stays the same for as long as it rolls.
 */
export function boulderPoses(world: World): BoulderPose[] {
  const radius = BOULDER_TUNING.size / 2;
  return world.shots
    .filter((shot) => shot.style === 'boulder')
    .map((shot) => ({ key: keyOf(world, shot), x: shot.x, y: shot.y, angle: shot.x / radius }));
}

/** How the dust puff looks `ticks` after its boulder ended: fading and spreading, or null once it is gone. */
export function dustLook(ticks: number): DustLook | null {
  if (ticks < 0 || ticks >= DUST_TICKS) return null;
  const life = ticks / DUST_TICKS;
  return { alpha: 1 - life, scale: 1 + (DUST_GROWTH - 1) * life };
}

/** A boulder shot's key: its owner and the tick it was thrown, worked back from the ttl it has left. */
function keyOf(world: World, shot: Shot): string {
  return `${shot.owner}@${world.tick - (BOULDER_TUNING.ttlTicks - shot.ttl)}`;
}

/** A puff of dust left where a boulder ended, and the tick it ended on. */
interface Dust {
  sprite: Phaser.GameObjects.Image;
  endedAt: number;
}

/**
 * The boulder layer for `world`: syncs one stone per boulder in flight and a dust puff for each one
 * that ended since the last frame.
 *
 * @throws {Error} When the boulder pixel text is malformed (see `drawFrames`).
 */
export function createBoulderView(scene: Phaser.Scene, world: World): ThemeLayer {
  if (!scene.textures.exists(BOULDER_TEXTURE)) drawFrames(scene, BOULDER_TEXTURE, FRAMES);
  const stones = new Map<string, Phaser.GameObjects.Image>();
  const dusts: Dust[] = [];
  let last = boulderPoses(world);

  return {
    sync(current) {
      const poses = boulderPoses(current);
      const live = new Set(poses.map((pose) => pose.key));
      for (const gone of last.filter((pose) => !live.has(pose.key))) {
        stones.get(gone.key)?.destroy();
        stones.delete(gone.key);
        const sprite = scene.add.image(gone.x, gone.y, BOULDER_TEXTURE, BoulderFrame.dust).setDepth(Layer.objects);
        dusts.push({ sprite, endedAt: current.tick });
      }
      for (const pose of poses) {
        const stone = stones.get(pose.key) ?? addStone(scene, stones, pose.key);
        stone.setPosition(pose.x, pose.y).setRotation(pose.angle);
      }
      fadeDust(dusts, current.tick);
      last = poses;
    },
  };
}

/** Adds the stone sprite for a boulder that just started rolling. */
function addStone(scene: Phaser.Scene, stones: Map<string, Phaser.GameObjects.Image>, key: string) {
  const stone = scene.add.image(0, 0, BOULDER_TEXTURE, BoulderFrame.stone).setDepth(Layer.objects);
  stones.set(key, stone);
  return stone;
}

/** Fades and spreads each dust puff by its age at `tick`, removing the ones that have faded out. */
function fadeDust(dusts: Dust[], tick: number): void {
  for (let index = dusts.length - 1; index >= 0; index--) {
    const dust = dusts[index];
    if (!dust) continue;
    const look = dustLook(tick - dust.endedAt);
    if (look) {
      dust.sprite.setAlpha(look.alpha).setScale(look.scale);
      continue;
    }
    dust.sprite.destroy();
    dusts.splice(index, 1);
  }
}
