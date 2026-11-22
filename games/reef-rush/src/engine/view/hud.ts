/**
 * The race HUD, read entirely from the world each frame: the player's place in
 * big type, the race timer, a kick-ready pip, a progress strip across the top
 * with one marker per racer (each a different shape and colour), and the
 * centre banner for 3-2-1-GO and the finish. It sits in the top-left so it
 * stays clear of the shell's back link and the touch controls.
 */
import type Phaser from 'phaser';
import { playerOf } from '../../logic/racers.ts';
import type { RacerId, World } from '../../logic/types.ts';
import { createLabel } from '../art/font.ts';
import { Frame, type FrameKey, Tex } from '../art/keys.ts';
import { Layer } from './layers.ts';
import { formatRaceTime, ordinal } from './race-text.ts';

/** The race HUD; `sync` redraws it from the world. */
export interface Hud {
  sync(world: World): void;
}

/** Progress strip geometry in screen px. It stops short of the top-right corner, where the back link sits. */
const STRIP = { left: 10, right: 236, y: 7 } as const;
const MARKER_FRAME: Record<RacerId, FrameKey> = {
  player: Frame.markerCircle,
  tess: Frame.markerSquare,
  squib: Frame.markerTriangle,
  bo: Frame.markerDiamond,
};

const COUNTDOWN_TICKS_PER_NUMBER = 60;
/** How long "GO!" stays up after the start, in race ticks. */
const GO_TICKS = 45;

/** Adds the HUD to `scene`, pinned to the screen. */
export function createHud(scene: Phaser.Scene): Hud {
  const { width, height } = scene.cameras.main;
  drawStripTrack(scene);
  const markers = createMarkers(scene);
  const place = createLabel(scene, 8, 14, '', { size: 'large', color: '#ffd23f', fixed: true, depth: Layer.hud });
  const timer = createLabel(scene, 46, 20, '', { size: 'medium', fixed: true, depth: Layer.hud });
  const kickPip = scene.add.image(50, 37, Tex.kickPip, Frame.pipReady).setScrollFactor(0).setDepth(Layer.hud);
  const kickLabel = createLabel(scene, 56, 33, 'kick', { size: 'small', fixed: true, depth: Layer.hud });
  const banner = createLabel(scene, width / 2, height / 2 - 24, '', {
    size: 'title',
    color: '#ffd23f',
    align: 'center',
    fixed: true,
    depth: Layer.banner,
  });
  // Distance to the finish from the furthest start, fixed at the first sync; markers show the share of it covered.
  let courseLength: number | null = null;

  return {
    sync(world) {
      courseLength ??= longestStart(world);
      const player = playerOf(world);
      place.setText(ordinal(player.place));
      timer.setText(formatRaceTime(raceTime(world)));
      const kickReady = player.kickCooldown === 0;
      kickPip.setFrame(kickReady ? Frame.pipReady : Frame.pipCooling);
      kickLabel.setColor(kickReady ? '#7fdbff' : '#6a8aa6');
      banner.setText(bannerText(world));
      for (const racer of world.racers) {
        const fraction = racer.finished ? 1 : 1 - racer.progress / courseLength;
        markers[racer.id].setX(Math.round(STRIP.left + clampUnit(fraction) * (STRIP.right - STRIP.left)));
      }
    },
  };
}

function drawStripTrack(scene: Phaser.Scene): void {
  const track = scene.add.graphics().setScrollFactor(0).setDepth(Layer.hud);
  track.fillStyle(0x0b1d33, 0.7).fillRect(STRIP.left - 4, STRIP.y - 5, STRIP.right - STRIP.left + 8, 10);
  track.fillStyle(0x9fe7ff, 1).fillRect(STRIP.left, STRIP.y, STRIP.right - STRIP.left, 1);
  track.fillStyle(0xffffff, 1).fillRect(STRIP.right, STRIP.y - 4, 1, 9);
}

function createMarkers(scene: Phaser.Scene): Record<RacerId, Phaser.GameObjects.Image> {
  const marker = (id: RacerId) =>
    scene.add
      .image(STRIP.left, STRIP.y, Tex.hudMarker, MARKER_FRAME[id])
      .setScrollFactor(0)
      // The player's marker draws on top so it never hides behind a rival's.
      .setDepth(id === 'player' ? Layer.banner : Layer.hud);
  return { player: marker('player'), tess: marker('tess'), squib: marker('squib'), bo: marker('bo') };
}

function longestStart(world: World): number {
  const finite = world.racers.map((racer) => racer.progress).filter(Number.isFinite);
  return Math.max(1, ...finite);
}

/** Ticks shown on the timer: zero in the countdown, the player's finish time once they cross. */
function raceTime(world: World): number {
  const { race } = world;
  if (race.phase === 'countdown') return 0;
  return playerOf(world).finished?.tick ?? race.raceTick;
}

function bannerText(world: World): string {
  const { race } = world;
  if (race.phase === 'countdown')
    return String(Math.max(1, 3 - Math.floor(race.raceTick / COUNTDOWN_TICKS_PER_NUMBER)));
  if (race.phase === 'racing') return race.raceTick < GO_TICKS ? 'GO!' : '';
  return race.result?.playerTicks === null ? 'DNF' : 'FINISH!';
}

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value));
}
