/**
 * Thornwood's own cast rows: its ability wording and its racers' footing. What every world's cast
 * shares is checked in `worlds/skins.test.ts`.
 */
import { describe, expect, it } from 'vitest';
import { CHARACTER_IDS } from '../../../logic/types.ts';
import { Frame } from '../../art/keys.ts';
import { framePixels, recordingScene } from '../recording-scene.ts';
import { registerArt } from './art.ts';
import { THORNWOOD_CAST } from './cast.ts';
import { ThornRacerTex } from './keys.ts';

/** Racers stand on row 10 of 12, so their feet sit on the ground line. */
const RACER_FOOT_ROW = 10;

describe('Thornwood cast', () => {
  it("keeps Thornwood's own ability wording for the Spring Jump hare", () => {
    expect(THORNWOOD_CAST.abilities.gil.name).toBe('SPRING JUMP');
  });

  it.each(CHARACTER_IDS)('plants both %s racer frames on the ground: lowest drawn row is row 10 of 12', (slot) => {
    const { scene, built } = recordingScene();
    registerArt(scene);
    for (const frame of [Frame.a, Frame.b]) {
      const rows = framePixels(built.get(ThornRacerTex[slot]), frame).map((pixel) => pixel.y);
      expect(Math.max(...rows), `frame ${frame}`).toBe(RACER_FOOT_ROW);
    }
  });
});
