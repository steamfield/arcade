/**
 * What an online race draws on top of the usual race screen (UI.md "Race HUD", online rows): each
 * human racer's lobby label over its sprite (under it near the HUD's rows), and the WAITING FOR
 * line at the bottom of the safe column while the race is stalled on someone. The choices come
 * from `online/race-hud.ts`; this only places the text.
 */
import type Phaser from 'phaser';
import type { RacerId, World } from '../../logic/types.ts';
import type { RaceView } from '../../net/client.ts';
import { createLabel, type Label } from '../art/font.ts';
import { measureText, TEXT_FACE } from '../art/ui/typeface.ts';
import { racerTags, tagTop, waitingLine } from '../online/race-hud.ts';
import { Layer } from './layers.ts';
import type { ScreenLayout } from './screen-layout.ts';

/** Racer sprites are 16 px tall, centred on the body. */
const SPRITE_HALF_HEIGHT = 8;
/** A centre-anchored label puts its top this far above its y: half the text face's 7 px, rounded down. */
const HALF_LINE = 3;

/** The online race's tags and waiting line, synced each frame. */
interface OnlineRaceView {
  sync(world: World, race: RaceView | null): void;
}

/** Tags and the waiting line for an online race, hidden until `sync` has something to show. */
export function createOnlineRaceView(scene: Phaser.Scene, layout: ScreenLayout): OnlineRaceView {
  const camera = scene.cameras.main;
  // Labels are created once at the origin and slid into place, since a label's anchor is fixed.
  const tags = new Map<RacerId, { label: Label; text: string }>();
  const waiting = createLabel(scene, layout.besideX, 0, '', {
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

  function syncTags(world: World, race: RaceView | null): void {
    // The scroll, not worldView: the camera moved this frame and worldView catches up only at render.
    const scrollY = Math.round(camera.scrollY);
    const shown = new Set<RacerId>();
    for (const { id, label } of race ? racerTags(world, race) : []) {
      const racer = world.racers.find((each) => each.id === id);
      if (!racer) continue;
      const { body } = racer;
      const centreY = Math.round(body.y + body.h / 2) - scrollY;
      const top = tagTop({ top: centreY - SPRITE_HALF_HEIGHT, bottom: centreY + SPRITE_HALF_HEIGHT });
      if (top === null) continue;
      tagFor(id, label)
        .setOffset(Math.round(body.x + body.w / 2), top + scrollY + HALF_LINE)
        .setVisible(true);
      shown.add(id);
    }
    for (const [id, { label }] of tags) if (!shown.has(id)) label.setVisible(false);
  }

  function syncWaiting(race: RaceView | null): void {
    const line = race ? waitingLine(race) : null;
    waiting.setVisible(line !== null);
    if (line === null) return;
    // The line's bottom stays on the bottom margin however many lines it takes.
    const { height } = measureText(TEXT_FACE, line);
    waiting.setText(line).setOffset(0, layout.lowest - height + Math.floor(height / 2));
  }

  return {
    sync(world, race) {
      syncTags(world, race);
      syncWaiting(race);
    },
  };
}
