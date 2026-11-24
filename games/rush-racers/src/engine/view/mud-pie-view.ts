/**
 * Thornwood's Mud Pies on the race screen, as a forest theme extra layer: each mud pie in
 * `world.twists` drawn as a tumbling pie while it flies, then as a mud patch three tiles wide lying
 * on the surface it splatted onto, fading out over its last second before it dries. Read from world
 * state every frame; each pie is known by its Twist object, which logic keeps from the throw until
 * the patch dries. Code-drawn art, one texture per sprite size.
 */
import type Phaser from 'phaser';
import { FLYING, MUD_PIE_TUNING } from '../../logic/powerups/twists/mud-pie.ts';
import type { Twist, World } from '../../logic/types.ts';
import { drawFrames, type NamedFrame } from '../art/pixel.ts';
import type { ThemeLayer } from '../themes/types.ts';
import { Layer } from './layers.ts';

/** Texture key for the flying pie. */
export const PIE_TEXTURE = 'forest-mud-pie';
/** Texture key for the splatted patch. */
export const SPLAT_TEXTURE = 'forest-mud-splat';

/** Ticks over which a patch fades out before it dries (1 s). */
export const SPLAT_FADE_TICKS = 60;
/** How far the patch's art sinks into the surface it lies on, in px, so it reads as on the ground. */
const SPLAT_SINK = 2;

const MUD_PALETTE = [0x2a1a0e, 0x5a3a20, 0x7a5232, 0x9a7048];

const PIE_FRAME: NamedFrame = {
  name: 'pie',
  palette: MUD_PALETTE,
  rows: ['..0000..', '.022210.', '02233210', '02332110', '02221110', '01211110', '.011110.', '..0000..'],
};

const SPLAT_FRAME: NamedFrame = {
  name: 'splat',
  palette: MUD_PALETTE,
  rows: [
    '.........3......................3...........2...',
    '...22...323..1222...22.....1222232211....22.323.',
    '.1222221222212222222222212222222222222222222222.',
    '122222222111222222221112222222221112222222221111',
    '011111111111111111111111111111111111111111111110',
    '.0000000..00000000000000000.0000000000000000000.',
  ],
};

/** Which sprite a mud pie shows: the pie in the air or the patch on the ground. */
export type MudPieFrame = 'pie' | 'splat';

/** A mud pie as drawn this frame: its twist, which sprite, where its centre is, its turn in radians and its opacity. */
export interface MudPieLook {
  twist: Twist;
  frame: MudPieFrame;
  x: number;
  y: number;
  angle: number;
  alpha: number;
}

/**
 * The mud pies in `world` this frame. A flying pie tumbles by the distance it has travelled over its
 * radius (held still with `reducedMotion`); a patch sits on its surface, fully opaque until its last
 * `SPLAT_FADE_TICKS`, then fading out evenly.
 */
export function mudPieLooks(world: World, reducedMotion: boolean): MudPieLook[] {
  return world.twists.filter((twist) => twist.style === 'mudPie').map((twist) => lookOf(twist, reducedMotion));
}

/** How one mud pie looks this frame. */
function lookOf(twist: Twist, reducedMotion: boolean): MudPieLook {
  if (twist.phase === FLYING) {
    const angle = reducedMotion ? 0 : twist.x / (MUD_PIE_TUNING.size / 2);
    return { twist, frame: 'pie', x: twist.x, y: twist.y, angle, alpha: 1 };
  }
  const height = SPLAT_FRAME.rows.length;
  const alpha = Math.min(1, twist.ttl / SPLAT_FADE_TICKS);
  return { twist, frame: 'splat', x: twist.x, y: twist.y - height / 2 + SPLAT_SINK, angle: 0, alpha };
}

/** A sprite drawn for one mud pie, and which of its sprites it is. */
interface Drawn {
  sprite: Phaser.GameObjects.Image;
  frame: MudPieFrame;
}

/**
 * The mud pie layer: each frame syncs one sprite per mud pie in play in the world it is given,
 * swapping the pie for its patch when it splats and removing it when it ends.
 *
 * @throws {Error} When the mud pie pixel text is malformed (see `drawFrames`).
 */
export function createMudPieView(scene: Phaser.Scene, reducedMotion: boolean): ThemeLayer {
  if (!scene.textures.exists(PIE_TEXTURE)) drawFrames(scene, PIE_TEXTURE, [PIE_FRAME]);
  if (!scene.textures.exists(SPLAT_TEXTURE)) drawFrames(scene, SPLAT_TEXTURE, [SPLAT_FRAME]);
  const drawn = new Map<Twist, Drawn>();

  return {
    sync(current) {
      const looks = mudPieLooks(current, reducedMotion);
      removeGone(drawn, new Set(looks.map((look) => look.twist)));
      for (const look of looks) {
        const sprite = spriteFor(scene, drawn, look);
        sprite.setPosition(look.x, look.y).setRotation(look.angle).setAlpha(look.alpha);
      }
    },
  };
}

/** Destroys the sprites of mud pies no longer in play. */
function removeGone(drawn: Map<Twist, Drawn>, live: ReadonlySet<Twist>): void {
  for (const [twist, entry] of drawn) {
    if (live.has(twist)) continue;
    entry.sprite.destroy();
    drawn.delete(twist);
  }
}

/** The sprite showing `look`'s mud pie: the one already drawn, or a new one when it is new or has just splatted. */
function spriteFor(scene: Phaser.Scene, drawn: Map<Twist, Drawn>, look: MudPieLook): Phaser.GameObjects.Image {
  const entry = drawn.get(look.twist);
  if (entry?.frame === look.frame) return entry.sprite;
  entry?.sprite.destroy();
  const texture = look.frame === 'pie' ? PIE_TEXTURE : SPLAT_TEXTURE;
  const sprite = scene.add.image(look.x, look.y, texture, look.frame).setDepth(Layer.objects);
  drawn.set(look.twist, { sprite, frame: look.frame });
  return sprite;
}
