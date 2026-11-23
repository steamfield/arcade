/**
 * What tests and `arcade see` read about the running game: a small, stable
 * summary for assertions and the CLI (with a `threat` readout of the squid warnings), and a fuller state dump for state.json.
 */
import type { SaveStatus } from '@arcade/save';
import { playerOf } from '../logic/racers.ts';
import type { World } from '../logic/types.ts';
import { summarize, toAscii } from '../logic/world.ts';
import { HOW_TO_PLAY_PAGES } from './how-to-play.ts';
import type { Runtime } from './runtime.ts';
import { formatBest, levelBanner } from './view/race-text.ts';
import { squidHuntingPlayer } from './view/threat-math.ts';

/**
 * Scene, save status, the character the player races as (the select cursor while picking), the
 * difficulty in force and the world summary (with the difficulty the race was built on, the
 * `levelBanner` the countdown shows, null once it ends, and the in-race `hints` showing), plus the menu on
 * menu screens, the best line as shown on the title (for the level now selected), the 1-based page on How to Play, and the
 * race outcome on results.
 *
 * @param sceneRunning Whether Phaser is actually running `rt.scene`. When it isn't, the
 * scene reads 'none', so a runtime that believes in a scene Phaser stopped is visible.
 */
export function debugSummary(rt: Runtime, saveStatus: SaveStatus, sceneRunning: boolean): Record<string, unknown> {
  const { menu, world } = rt;
  return {
    scene: sceneRunning ? rt.scene : 'none',
    save: saveStatus,
    character: rt.selectedCharacter,
    difficulty: rt.settings.difficulty,
    ...(world
      ? {
          ...summarize(world),
          raceDifficulty: world.difficulty,
          levelBanner: levelBanner(world),
          threat: threatOf(world),
          hints: rt.hints,
        }
      : {}),
    ...(menu ? { menu: { options: menu.options, selected: menu.selected } } : {}),
    ...sceneDetails(rt),
  };
}

/** What the squid warnings on the HUD are showing: a squid locked on the player, and a squid latched on them. */
function threatOf(world: World) {
  return { lockedOn: squidHuntingPlayer(world) !== null, latched: playerOf(world).status.latched > 0 };
}

function sceneDetails(rt: Runtime): Record<string, unknown> {
  const best = rt.save?.best[rt.settings.difficulty];
  if (rt.scene === 'title') return { best: best ? formatBest(best) : null };
  if (rt.scene === 'howToPlay') return { howToPlay: { page: rt.howToPage + 1, pages: HOW_TO_PLAY_PAGES } };
  if (rt.scene !== 'results' || !rt.lastResult) return {};
  const { result, newBest, saveFailed } = rt.lastResult;
  return { result: { place: result.playerPlace, ticks: result.playerTicks, newBest, saveFailed } };
}

/** Everything in the summary plus racers (with their characters), race state, settings, the save and the course as ASCII. */
export function debugState(rt: Runtime, saveStatus: SaveStatus, sceneRunning: boolean): Record<string, unknown> {
  const { world } = rt;
  return {
    ...debugSummary(rt, saveStatus, sceneRunning),
    save: rt.save,
    saveStatus,
    settings: rt.settings,
    lastResult: rt.lastResult,
    race: world?.race ?? null,
    racers:
      world?.racers.map(({ id, character, body, facing, kickCooldown, place, progress, finished }) => ({
        id,
        character,
        body,
        facing,
        kickCooldown,
        place,
        progress,
        finished,
      })) ?? [],
    ascii: world ? toAscii(world) : null,
  };
}
