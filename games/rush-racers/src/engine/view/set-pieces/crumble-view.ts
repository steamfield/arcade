/**
 * Loose bark and new shoots on Thornwood's crumbling branches. The shared tilemap draws the wood,
 * and this layer ages the shake and bark from the phase countdown and the sprout from its regrow tick.
 */
import type Phaser from 'phaser';
import { CRUMBLE } from '../../../logic/setpieces/crumbles.ts';
import { type CrumbleDef, type CrumbleState, TILE, type World } from '../../../logic/types.ts';
import { CrumblePalette } from '../../themes/forest/palettes.ts';
import type { ThemeLayer } from '../../themes/types.ts';
import { Layer } from '../layers.ts';
import { syncCrumbleTiles } from '../level-view.ts';

const SPROUT_TICKS = 18;
const BARK_FALL_TICKS = 14;
const REST = { offset: 0, barkAge: null, warning: false, sproutHeight: 0 };

interface CrumbleLook {
  offset: number;
  barkAge: number | null;
  warning: boolean;
  sproutHeight: number;
}

/** The branch's appearance is independent of how many frames were drawn before this tick. */
export function crumbleLook(state: CrumbleState, tick: number, reducedMotion: boolean): CrumbleLook {
  if (state.phase === 'shaking') {
    const age = CRUMBLE.shakeTicks - state.ticks;
    const offset = reducedMotion ? 0 : Math.floor(age / 4) % 2 === 0 ? -1 : 1;
    return { ...REST, offset, barkAge: reducedMotion ? 0 : age, warning: true };
  }
  if (state.phase === 'fallen') {
    const age = CRUMBLE.fallenTicks - state.ticks;
    return !reducedMotion && age < BARK_FALL_TICKS ? { ...REST, barkAge: CRUMBLE.shakeTicks + age } : REST;
  }
  const age = tick - state.ticks;
  if (state.ticks > 0 && age < SPROUT_TICKS) {
    return { ...REST, sproutHeight: reducedMotion ? 7 : Math.min(7, 2 + Math.floor(age / 2)) };
  }
  return REST;
}

/** Adds the forest theme's branch layer. Visibility comes from the world even on the first frame. */
export function createCrumbleView(scene: Phaser.Scene, world: World, reducedMotion: boolean): ThemeLayer {
  if (world.level.crumbles.length === 0) return { sync() {} };
  const graphics = scene.add.graphics().setDepth(Layer.tiles + 0.5);
  return {
    sync(current) {
      const looks = current.crumbles.map((state) => crumbleLook(state, current.tick, reducedMotion));
      syncCrumbleTiles(scene, current, (branch) => looks[branch]?.offset ?? 0);
      graphics.clear();
      current.level.crumbles.forEach((branch, index) => {
        const look = looks[index];
        if (look) drawBranch(graphics, branch, look, current.crumbles[index]?.phase !== 'fallen');
      });
    },
  };
}

function drawBranch(
  graphics: Phaser.GameObjects.Graphics,
  branch: CrumbleDef,
  look: CrumbleLook,
  standing: boolean,
): void {
  const y = branch.row * TILE;
  for (let tile = 0; tile < branch.length; tile++) {
    const x = (branch.col + tile) * TILE + look.offset;
    if (standing) {
      const cut = x + 5 + (tile % 3) * 3;
      graphics
        .fillStyle(CrumblePalette.split)
        .fillRect(cut, y, 2, 2)
        .fillRect(cut + 2, y + 2, 2, 2);
      if (look.warning) graphics.fillStyle(CrumblePalette.rawWood).fillRect(cut + 2, y, 2, 1);
    }
    if (look.barkAge !== null) drawBark(graphics, x, y, look.barkAge, tile);
    if (look.sproutHeight > 0 && tile % 2 === 0) drawSprout(graphics, x + 8, y, look.sproutHeight);
  }
}

function drawBark(graphics: Phaser.GameObjects.Graphics, x: number, y: number, age: number, tile: number): void {
  // Stagger each tile's chips, then let the last chips fall away without starting another shower.
  const lastShakeAge = Math.min(age, CRUMBLE.shakeTicks);
  const trail = age - lastShakeAge;
  const fall = ((lastShakeAge + tile * 5) % 16) + trail;
  graphics
    .fillStyle(CrumblePalette.bark, Math.max(0, 1 - trail / BARK_FALL_TICKS))
    .fillRect(x + 4 - Math.floor(fall / 8), y + 5 + Math.floor((fall * fall) / 24), 2, 2);
  graphics
    .fillStyle(CrumblePalette.rawWood, Math.max(0, 0.8 - trail / BARK_FALL_TICKS))
    .fillRect(x + 10 + Math.floor(fall / 7), y + 7 + Math.floor((fall * fall) / 32), 1, 2);
}

function drawSprout(graphics: Phaser.GameObjects.Graphics, x: number, y: number, height: number): void {
  graphics.fillStyle(CrumblePalette.stem).fillRect(x, y - height, 1, height);
  graphics.fillStyle(CrumblePalette.leaf).fillRect(x + 1, y - height, 3, 2);
  if (height >= 5) graphics.fillRect(x - 3, y - height + 2, 3, 2);
}
