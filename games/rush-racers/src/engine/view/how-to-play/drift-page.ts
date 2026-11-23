/**
 * Page 1 on a drift course, THRUST AND DRIFT. Swim's move page stands in until the drift page is drawn.
 */
import type { PageBuilder } from './kit.ts';
import { buildMovePage } from './move-page.ts';

/** The move page of a course raced in the drift medium. */
export const buildDriftMovePage: PageBuilder = (kit) => buildMovePage(kit);
