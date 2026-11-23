/**
 * How to Play's pages, in order. Each is built once from the game's own sprites and glyphs by a
 * builder in this folder, and starts hidden; the scene shows one at a time. Page 1 explains how
 * the current course's medium moves; the rest are shared unless the medium has its own.
 */
import { createLogger } from '@arcade/core';
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
import { buildRunCratesPage } from './run-crates-page.ts';
import { buildRunEnemiesPage } from './run-enemies-page.ts';
import { buildRunMovePage } from './run-page.ts';
import { buildRunShieldPage } from './run-shield-page.ts';

export type { Page } from './kit.ts';

/**
 * A page's heading (at most four short words, naming the fire control as the player's screen does,
 * and the world's own words for clams and pearls) and builder.
 */
export interface PageSpec {
  heading: (touch: boolean, skin: WorldSkin) => string;
  build: PageBuilder;
}

/** A medium's move page: its heading and builder. */
export interface MovePage {
  heading: string;
  build: PageBuilder;
}

/**
 * The pages a medium has of its own. The move page is required; the crates, enemies and dodge pages
 * replace the shared ones where a medium plays differently (run hits crates from below, stomps
 * enemies instead of dashing into them, and has no dash that dodges a squid, so its page 7 shows a
 * shield stopping one).
 */
export interface MediumPages {
  move: MovePage;
  crates?: PageSpec;
  enemies?: PageSpec;
  dodge?: PageSpec;
}

/** Each shipped medium's own pages, so shipping a medium without a move page fails to compile. */
export const MEDIUM_PAGES: Readonly<Record<ShippedMediumId, MediumPages>> = {
  swim: { move: { heading: 'SWIM AND DASH', build: buildMovePage } },
  run: {
    move: { heading: 'RUN AND JUMP', build: buildRunMovePage },
    crates: { heading: (_touch, skin) => skin.objects.text.cratesHeading, build: buildRunCratesPage },
    enemies: { heading: () => 'JUMP TO STOMP', build: buildRunEnemiesPage },
    dodge: {
      heading: (_touch, skin) => `SHIELD STOPS THE ${skin.objects.text.attackCaptions.homingSquid}`,
      build: buildRunShieldPage,
    },
  },
};

/** The medium whose pages stand in for one How to Play has none for. */
const FALLBACK_MEDIUM: ShippedMediumId = 'swim';

const log = createLogger('rush-racers:how-to-play');
/** Media already warned about, so a page rebuilt on resize doesn't warn again. */
const warnedMedia = new Set<string>();

/** The pages every medium shares unless it overrides them. */
const SHARED_CRATES: PageSpec = { heading: (_touch, skin) => skin.objects.text.cratesHeading, build: buildClamsPage };
const SHARED_ENEMIES: PageSpec = { heading: () => 'DASH TO BONK', build: buildEnemiesPage };
const FIRE_PAGE: PageSpec = { heading: (touch) => `${controlName('fire', touch)} FIRES ONE`, build: buildFirePage };
const PEARLS_PAGE: PageSpec = { heading: (_touch, skin) => skin.objects.text.pearlsHeading, build: buildPearlsPage };
const ATTACKS_PAGE: PageSpec = { heading: () => 'ATTACKS', build: buildAttacksPage };
const SHARED_DODGE: PageSpec = { heading: () => 'DASH TO DODGE', build: buildDodgePage };

/**
 * The pages for `medium`, a course's medium id. Every shipped medium has its own (`MEDIUM_PAGES` is
 * typed by `ShippedMediumId`); one that isn't shipped, such as one a test registered, gets swim's
 * pages, with a warning once per medium, since they may teach moves it doesn't have.
 */
export function mediumPagesFor(medium: string): MediumPages {
  if (Object.hasOwn(MEDIUM_PAGES, medium)) return MEDIUM_PAGES[medium as ShippedMediumId];
  if (!warnedMedia.has(medium)) {
    warnedMedia.add(medium);
    log.warn(`How to Play has no pages for medium '${medium}': showing ${FALLBACK_MEDIUM}'s`, {
      medium,
      shipped: Object.keys(MEDIUM_PAGES),
    });
  }
  return MEDIUM_PAGES[FALLBACK_MEDIUM];
}

/** Every page's heading and builder, in order, using `medium`'s own page wherever it has one. */
export function pageSpecsFor(medium: string): readonly PageSpec[] {
  const { move, crates, enemies, dodge } = mediumPagesFor(medium);
  return [
    { heading: () => move.heading, build: move.build },
    crates ?? SHARED_CRATES,
    FIRE_PAGE,
    PEARLS_PAGE,
    enemies ?? SHARED_ENEMIES,
    ATTACKS_PAGE,
    dodge ?? SHARED_DODGE,
  ];
}

/**
 * Builds every page, hidden. `medium` picks page 1 and any pages it overrides, `touch` draws
 * on-screen button glyphs instead of key caps, and `character` is whose racer the pictures show.
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
  const pages = pageSpecsFor(medium);
  if (pages.length !== HOW_TO_PLAY_PAGES) {
    throw new Error(`How to Play has ${pages.length} pages built but paging expects ${HOW_TO_PLAY_PAGES}`);
  }
  return pages.map(({ heading, build }) => createPage(scene, touch, character, skin, heading(touch, skin), build));
}
