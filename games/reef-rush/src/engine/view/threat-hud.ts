/**
 * What the HUD says about a Homing Squid hunting the player: an arrow on the screen's edge that
 * points at the squid while it is locked on, and a big KICK! prompt (with PRESS A on touch screens,
 * where A is the kick button) while one is latched on, since kicks are how it is shaken off. The
 * short LOCKED ON! caption is the HUD's own caption line. Both pieces read world state only;
 * the arrow blinks at 3 Hz, the WCAG ceiling, and shows steadily under reduced motion.
 */
import type Phaser from 'phaser';
import { playerOf } from '../../logic/racers.ts';
import type { World } from '../../logic/types.ts';
import { createLabel } from '../art/font.ts';
import { IconFrame, UiTex } from '../art/ui/keys.ts';
import { Layer } from './layers.ts';
import { TONE_CSS } from './race-text.ts';
import { markerFor, squidHuntingPlayer } from './threat-math.ts';

/** The squid warnings; `sync` redraws them from the world. */
export interface ThreatHud {
  /** `view` is the camera's world rectangle, to turn the squid's and the player's world positions into screen ones. */
  sync(world: World, view: Phaser.Geom.Rectangle): void;
}

/** UI.md: KICK! centres on the caption line, PRESS A just under it. */
const PROMPT_CENTRE = { x: 160, y: 45 } as const;
const TOUCH_HINT_CENTRE = { x: 160, y: 58 } as const;
/** The arrow is on for 14 of every 20 ticks: 3 blinks a second. */
const ARROW_BLINK = { on: 14, period: 20 } as const;
/** The KICK! prompt changes tone every this many ticks (3 changes a second). */
const PROMPT_PULSE_TICKS = 10;

/** Adds the lock-on arrow and the KICK! prompt to `scene`, pinned to the screen. */
export function createThreatHud(scene: Phaser.Scene, reducedMotion: boolean): ThreatHud {
  const arrow = scene.add
    .image(0, 0, UiTex.icons, IconFrame.warnArrow)
    .setScrollFactor(0)
    .setDepth(Layer.banner)
    .setVisible(false);
  const prompt = createLabel(scene, PROMPT_CENTRE.x, PROMPT_CENTRE.y, '', {
    size: 'display',
    tone: 'sun',
    outline: true,
    align: 'center',
    fixed: true,
    depth: Layer.banner,
  });
  const touchHint = createLabel(scene, TOUCH_HINT_CENTRE.x, TOUCH_HINT_CENTRE.y, '', {
    tone: 'foam',
    outline: true,
    align: 'center',
    fixed: true,
    depth: Layer.banner,
  });
  const touch = isTouchScreen();

  return {
    sync(world, view) {
      const player = playerOf(world);
      const squid = squidHuntingPlayer(world);
      const blinkOn = reducedMotion || world.tick % ARROW_BLINK.period < ARROW_BLINK.on;
      arrow.setVisible(squid !== null && blinkOn);
      if (squid) {
        const at = (x: number, y: number) => ({ x: x - view.x, y: y - view.y });
        const marker = markerFor(
          at(player.body.x + player.body.w / 2, player.body.y + player.body.h / 2),
          at(squid.x, squid.y),
        );
        arrow.setPosition(Math.round(marker.x), Math.round(marker.y)).setRotation(marker.angle);
      }

      const latched = player.status.latched > 0;
      const pulse = !reducedMotion && Math.floor(world.tick / PROMPT_PULSE_TICKS) % 2 === 1;
      prompt.setText(latched ? 'KICK!' : '').setColor(TONE_CSS[pulse ? 'foam' : 'sun']);
      touchHint.setText(latched && touch ? 'PRESS A' : '');
    },
  };
}

/** Whether the on-screen touch controls are up: the shell's `?touch=1`, or a coarse pointer (the rule `@arcade/input` uses). */
function isTouchScreen(): boolean {
  const forced = new URLSearchParams(window.location.search).get('touch') === '1';
  return forced || window.matchMedia('(pointer: coarse)').matches;
}
