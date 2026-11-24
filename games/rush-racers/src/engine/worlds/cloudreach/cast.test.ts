/**
 * Cloudreach's own cast rows: its ability wording and the wing beat that makes its racers fly.
 * What every world's cast shares is checked in `worlds/skins.test.ts`.
 */
import { describe, expect, it } from 'vitest';
import { CHARACTER_IDS } from '../../../logic/types.ts';
import { Frame } from '../../art/keys.ts';
import { WORLD_ART } from '../index.ts';
import { framePixels, pixelCount, recordingScene } from '../recording-scene.ts';
import { CLOUDREACH_CAST } from './cast.ts';
import { SkyRacerTex } from './keys.ts';

/** Rows 0 to 5 of a 12-row racer frame: where raised wings show. */
const RACER_TOP_HALF = 6;

/** Pixels a wing beat must move between halves, so the two frames read as a stroke and not a twitch. */
const MIN_BEAT_PIXELS = 6;

describe('Cloudreach cast', () => {
  it("keeps Cloudreach's own ability wording for the Spring Flap hummingbird", () => {
    expect(CLOUDREACH_CAST.abilities.gil.name).toBe('SPRING FLAP');
  });

  it('beats every wing up in frame a and down in frame b: more of a sits in the top half, more of b below', () => {
    const { scene, built } = recordingScene();
    WORLD_ART.cloudreach(scene);
    for (const slot of CHARACTER_IDS) {
      const texture = built.get(SkyRacerTex[slot]);
      const [upTop, upBottom, downTop, downBottom] = [Frame.a, Frame.b].flatMap((frame) => {
        const runs = framePixels(texture, frame);
        return [
          pixelCount(runs.filter((run) => run.y < RACER_TOP_HALF)),
          pixelCount(runs.filter((run) => run.y >= RACER_TOP_HALF)),
        ];
      });
      expect((upTop ?? 0) - (downTop ?? 0), `${slot}: frame a's extra pixels in the top half`).toBeGreaterThanOrEqual(
        MIN_BEAT_PIXELS,
      );
      expect(
        (downBottom ?? 0) - (upBottom ?? 0),
        `${slot}: frame b's extra pixels in the bottom half`,
      ).toBeGreaterThanOrEqual(MIN_BEAT_PIXELS);
    }
  });
});
