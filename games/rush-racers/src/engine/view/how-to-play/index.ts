/**
 * How to Play's pages, in order. Each is built once from the game's own sprites and glyphs by a
 * builder in this folder, and starts hidden; the scene shows one at a time. Page 1 explains how
 * the current course's medium moves; the pages after it are the same for every medium.
 */
import type Phaser from 'phaser';
import type { ShippedMediumId } from '../../../logic/courses/types.ts';
import type { CharacterId } from '../../../logic/types.ts';
import { HOW_TO_PLAY_PAGES } from '../../how-to-play.ts';
import type { WorldSkin } from '../../worlds/types.ts';
import { controlName } from '../control-glyphs.ts';
import { buildAttacksPage } from './attacks-page.ts';
import { buildClamsPage } from './clams-page.ts';
import { buildDodgePage } from './dodge-page.ts';
import { buildEnemiesPage } from './enemies-page.ts';
import { buildFirePage } from './fire-page.ts';
import { createPage, type Page, type PageBuilder } from './kit.ts';
import { buildMovePage } from './move-page.ts';
import { buildPearlsPage } from './pearls-page.ts';

export type { Page } from './kit.ts';

/** A page's heading (at most four short words, naming the fire control as the player's screen does) and builder. */
interface PageSpec {
  heading: (touch: boolean) => string;
  build: PageBuilder;
}

/** A medium's move page: its heading and builder. */
export interface MovePage {
  heading: string;
  build: PageBuilder;
}

/** Page 1 for each shipped medium, so shipping a medium without a move page fails to compile. */
export const MOVE_PAGES: Readonly<Record<ShippedMediumId, MovePage>> = {
  swim: { heading: 'SWIM AND DASH', build: buildMovePage },
};

/** The medium whose move page stands in for one How to Play has no page for. */
const FALLBACK_MEDIUM: ShippedMediumId = 'swim';

/** The pages after the move page, the same in every medium. */
const SHARED_PAGES: readonly PageSpec[] = [
  { heading: () => 'OPEN CLAMS', build: buildClamsPage },
  { heading: (touch) => `${controlName('fire', touch)} FIRES ONE`, build: buildFirePage },
  { heading: () => 'GRAB PEARLS', build: buildPearlsPage },
  { heading: () => 'DASH TO BONK', build: buildEnemiesPage },
  { heading: () => 'ATTACKS', build: buildAttacksPage },
  { heading: () => 'DASH TO DODGE', build: buildDodgePage },
];

/**
 * The move page for `medium`, a course's medium id. A medium that isn't shipped, such as one a
 * test registered, gets swim's page.
 */
export function movePageFor(medium: string): MovePage {
  return Object.hasOwn(MOVE_PAGES, medium) ? MOVE_PAGES[medium as ShippedMediumId] : MOVE_PAGES[FALLBACK_MEDIUM];
}

/**
 * Builds every page, hidden. `medium` picks page 1, `touch` draws on-screen button glyphs instead
 * of key caps, and `character` is whose racer the pictures show.
 *
 * @throws {Error} When the pages here and `HOW_TO_PLAY_PAGES` disagree, since paging would go wrong.
 */
export function createPages(
  scene: Phaser.Scene,
  medium: string,
  touch: boolean,
  character: CharacterId,
  skin: WorldSkin,
): Page[] {
  const move = movePageFor(medium);
  const pages: readonly PageSpec[] = [{ heading: () => move.heading, build: move.build }, ...SHARED_PAGES];
  if (pages.length !== HOW_TO_PLAY_PAGES) {
    throw new Error(`How to Play has ${pages.length} pages built but paging expects ${HOW_TO_PLAY_PAGES}`);
  }
  return pages.map(({ heading, build }) => createPage(scene, touch, character, skin, heading(touch), build));
}
