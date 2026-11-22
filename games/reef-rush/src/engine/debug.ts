/**
 * What tests and `arcade see` read about the running game: a small, stable
 * summary for assertions and the CLI, and a fuller state dump for state.json.
 */
import type { SaveStatus } from '@arcade/save';
import { summarize, toAscii } from '../logic/world.ts';
import type { Runtime } from './runtime.ts';
import { formatBest } from './view/race-text.ts';

/**
 * Scene, save status and the world summary, plus the menu on menu screens, the best
 * line as shown on the title, and the race outcome on results.
 */
export function debugSummary(rt: Runtime, saveStatus: SaveStatus): Record<string, unknown> {
  const { menu, world } = rt;
  return {
    scene: rt.scene,
    save: saveStatus,
    ...(world ? summarize(world) : {}),
    ...(menu ? { menu: { options: menu.options, selected: menu.selected } } : {}),
    ...sceneDetails(rt),
  };
}

function sceneDetails(rt: Runtime): Record<string, unknown> {
  const best = rt.save?.best;
  if (rt.scene === 'title') return { best: best ? formatBest(best) : null };
  if (rt.scene !== 'results' || !rt.lastResult) return {};
  const { result, newBest, saveFailed } = rt.lastResult;
  return { result: { place: result.playerPlace, ticks: result.playerTicks, newBest, saveFailed } };
}

/** Everything in the summary plus racers, race state, settings, the save and the course as ASCII. */
export function debugState(rt: Runtime, saveStatus: SaveStatus): Record<string, unknown> {
  const { world } = rt;
  return {
    ...debugSummary(rt, saveStatus),
    save: rt.save,
    saveStatus,
    settings: rt.settings,
    lastResult: rt.lastResult,
    race: world?.race ?? null,
    racers:
      world?.racers.map(({ id, body, facing, kickCooldown, place, progress, finished }) => ({
        id,
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
