/**
 * How to Play's pages, in order. Each is built once from the game's own sprites and glyphs by a
 * builder in this folder, and starts hidden; the scene shows one at a time.
 */
import type Phaser from 'phaser';
import type { CharacterId } from '../../../logic/types.ts';
import { HOW_TO_PLAY_PAGES } from '../../how-to-play.ts';
import { controlName } from '../control-glyphs.ts';
import { buildAttacksPage } from './attacks-page.ts';
import { buildBurstPage } from './burst-page.ts';
import { buildClamsPage } from './clams-page.ts';
import { createPage, type Page, type PageBuilder } from './kit.ts';
import { buildMovePage } from './move-page.ts';

export type { Page } from './kit.ts';

/** Each page's heading (at most four short words, naming the burst control as the player's screen does) and builder. */
const PAGES: readonly { heading: (touch: boolean) => string; build: PageBuilder }[] = [
  { heading: () => 'SWIM AND KICK', build: buildMovePage },
  { heading: () => 'OPEN CLAMS', build: buildClamsPage },
  { heading: (touch) => `${controlName('burst', touch)} USES ALL!`, build: buildBurstPage },
  { heading: () => 'ATTACKS', build: buildAttacksPage },
];

/**
 * Builds every page, hidden. `touch` draws on-screen button glyphs instead of key caps, and
 * `character` is whose racer the pictures show.
 *
 * @throws {Error} When the pages here and `HOW_TO_PLAY_PAGES` disagree, since paging would go wrong.
 */
export function createPages(scene: Phaser.Scene, touch: boolean, character: CharacterId): Page[] {
  if (PAGES.length !== HOW_TO_PLAY_PAGES) {
    throw new Error(`How to Play has ${PAGES.length} pages built but paging expects ${HOW_TO_PLAY_PAGES}`);
  }
  return PAGES.map(({ heading, build }) => createPage(scene, touch, character, heading(touch), build));
}
