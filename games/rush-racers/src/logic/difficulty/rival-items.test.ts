/**
 * The rival item bands for every character but Rudy, and the every-kind check, in one file so they
 * share their races (see `rival-items.ts`). Rudy's band is in `rival-items-rudy.test.ts`.
 */
import { CHARACTER_IDS } from '../types.ts';
import { describeRivalItems, describeRivalKinds } from './rival-items.ts';

for (const character of CHARACTER_IDS) if (character !== 'rudy') describeRivalItems(character);
describeRivalKinds();
