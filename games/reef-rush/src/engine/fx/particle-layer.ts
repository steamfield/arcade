/**
 * Draws a `ParticleField` with one Phaser image per slot, all created up front at one depth.
 * Rendering only copies each record onto its image (whole-pixel position, frame, tint,
 * alpha), so a frame allocates nothing; textures change only when a slot is reused for a
 * different sprite.
 */
import type Phaser from 'phaser';
import { type ParticleField, particleAlpha, particleScreenX } from './particles.ts';
import { FX_TEXTURE, FxFrame } from './textures.ts';

/** The images showing one particle field. */
export interface ParticleLayer {
  /** Copies every particle onto its image; dead particles are hidden. */
  render(): void;
}

/** Adds an image per slot of `field` to `scene` at `depth`. */
export function createParticleLayer(scene: Phaser.Scene, field: ParticleField, depth: number): ParticleLayer {
  const images = field.particles.map(() =>
    scene.add.image(0, 0, FX_TEXTURE, FxFrame.bubble).setDepth(depth).setVisible(false),
  );

  return {
    render() {
      for (let index = 0; index < images.length; index++) {
        const image = images[index];
        const particle = field.particles[index];
        if (!image || !particle) continue;
        if (!particle.live) {
          image.setVisible(false);
          continue;
        }
        if (image.texture.key !== particle.texture || image.frame.name !== particle.frame)
          image.setTexture(particle.texture, particle.frame);
        image
          .setVisible(true)
          .setPosition(particleScreenX(particle), Math.round(particle.y))
          .setFlipX(particle.flipX)
          .setTint(particle.tint)
          .setAlpha(particleAlpha(particle));
      }
    },
  };
}
