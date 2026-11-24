/**
 * What an online race draws on top of the usual race screen (UI.md "Race HUD", online rows): each
 * human racer's lobby label over its sprite, and the WAITING FOR line at the bottom of the safe
 * column while the race is stalled on someone. The choices come from `online/race-hud.ts`; this
 * only places the text.
 */
import type Phaser from 'phaser';
import type { RacerId, World } from '../../logic/types.ts';
import type { RaceView } from '../../net/client.ts';
import { createLabel, type Label } from '../art/font.ts';
import { racerTags, waitingLine } from '../online/race-hud.ts';
import { Layer } from './layers.ts';
import type { ScreenLayout } from './screen-layout.ts';

/** Racer sprites are 16 px tall, centred on the body. */
const SPRITE_HALF_HEIGHT = 8;
/** The tag's bottom edge sits this far above the racer's sprite. */
const TAG_GAP = 2;
/** The text face's glyph height. */
const TEXT_HEIGHT = 7;

/** The online race's tags and waiting line, synced each frame. */
export interface OnlineRaceView {
  sync(world: World, race: RaceView | null): void;
}

/** Tags and the waiting line for an online race, hidden until `sync` has something to show. */
export function createOnlineRaceView(scene: Phaser.Scene, layout: ScreenLayout): OnlineRaceView {
  // Labels are created once at the world origin and slid to each racer, since a label's anchor is fixed.
  const tags = new Map<RacerId, { label: Label; text: string }>();
  const waiting = createLabel(scene, layout.besideX, layout.lowest - TEXT_HEIGHT, '', {
    align: 'center',
    outline: true,
    fixed: true,
    depth: Layer.hud,
  }).setVisible(false);

  function tagFor(id: RacerId, text: string): Label {
    const known = tags.get(id);
    if (known && known.text === text) return known.label;
    known?.label.destroy();
    const label = createLabel(scene, 0, 0, text, { align: 'center', outline: true, depth: Layer.player + 0.5 });
    tags.set(id, { label, text });
    return label;
  }

  return {
    sync(world, race) {
      const shown = new Set<RacerId>();
      for (const { id, label } of race ? racerTags(world, race) : []) {
        const racer = world.racers.find((each) => each.id === id);
        if (!racer) continue;
        const { body } = racer;
        tagFor(id, label)
          .setOffset(
            Math.round(body.x + body.w / 2),
            Math.round(body.y + body.h / 2) - SPRITE_HALF_HEIGHT - TAG_GAP - TEXT_HEIGHT,
          )
          .setVisible(true);
        shown.add(id);
      }
      for (const [id, { label }] of tags) if (!shown.has(id)) label.setVisible(false);
      const line = race ? waitingLine(race) : null;
      waiting.setVisible(line !== null);
      if (line !== null) waiting.setText(line);
    },
  };
}
