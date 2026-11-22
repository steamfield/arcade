import type Phaser from 'phaser';

/** Texture keys. Use these, never string literals, so a typo fails typecheck. */
export const Tex = {
  rock: 'rock',
  coral: 'coral',
  kelp: 'kelp',
  current: 'current',
  finish: 'finish',
  player: 'player',
  tess: 'tess',
  squib: 'squib',
  bo: 'bo',
} as const;

/**
 * Placeholder art drawn at boot so the race can be played before real sprites
 * exist. Phase 2 moves this behind art/index.ts; phase 4 replaces it with pixel art.
 */
export function createPlaceholderTextures(scene: Phaser.Scene): void {
  const g = scene.add.graphics();
  const make = (key: string, w: number, h: number, draw: () => void) => {
    g.clear();
    draw();
    g.generateTexture(key, w, h);
  };
  make(Tex.rock, 16, 16, () => {
    g.fillStyle(0x3b3355).fillRect(0, 0, 16, 16);
    g.fillStyle(0x5a4f7a).fillRect(1, 1, 6, 3).fillRect(9, 8, 5, 3);
  });
  make(Tex.coral, 16, 16, () => {
    g.fillStyle(0xd9577a).fillRect(0, 0, 16, 16);
    g.fillStyle(0xff9ab0).fillRect(2, 2, 3, 3).fillRect(9, 6, 3, 3).fillRect(4, 11, 3, 3);
  });
  make(Tex.kelp, 16, 16, () => {
    g.fillStyle(0x2f8f4e).fillRect(3, 0, 2, 16).fillRect(10, 0, 2, 16);
  });
  make(Tex.current, 16, 16, () => {
    g.fillStyle(0x7fdbff, 0.35).fillRect(0, 7, 12, 2);
    g.fillStyle(0x7fdbff, 0.6).fillTriangle(11, 4, 15, 8, 11, 12);
  });
  make(Tex.finish, 16, 16, () => {
    g.fillStyle(0xffffff).fillRect(6, 0, 4, 8);
    g.fillStyle(0x111111).fillRect(6, 8, 4, 8);
  });
  const racer = (key: string, body: number, eye: number) =>
    make(key, 12, 10, () => {
      g.fillStyle(body).fillRect(0, 1, 12, 8);
      g.fillStyle(eye).fillRect(8, 3, 2, 2);
    });
  racer(Tex.player, 0xffd23f, 0x1d2b53);
  racer(Tex.tess, 0x4caf50, 0x0b2e13);
  racer(Tex.squib, 0xb388ff, 0x2a0b4d);
  racer(Tex.bo, 0xff7043, 0x3e1308);
  g.destroy();
}
