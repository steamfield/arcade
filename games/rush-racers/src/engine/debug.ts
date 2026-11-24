/**
 * What tests and `arcade see` read about the running game: a small, stable
 * summary for assertions and the CLI (with a `threat` readout of the squid warnings), and a fuller state dump for state.json.
 */
import type { SaveStatus } from '@arcade/save';
import { hashWorld } from '../logic/hash.ts';
import { bestFor } from '../logic/records.ts';
import { NEW_GAME } from '../logic/save.ts';
import type { World } from '../logic/types.ts';
import { summarize, toAscii } from '../logic/world.ts';
import { mediumIdOf } from '../logic/worlds/index.ts';
import { HOW_TO_PLAY_PAGES } from './how-to-play.ts';
import { localOf } from './local-racer.ts';
import { friendsSummary, netSummary } from './online/net-summary.ts';
import type { Runtime } from './runtime.ts';
import { rowText } from './scenes/course.ts';
import { formatBest, levelBanner, racerName } from './view/race-text.ts';
import { squidHuntingLocal } from './view/threat-math.ts';

/**
 * Scene, save status, the character slot 1 races as (the select cursor while picking), the
 * course and its medium, the difficulty in force and the world summary of the local racer (with the difficulty the race was built on, the
 * `levelBanner` the countdown shows, null once it ends, and the in-race `hints` showing), plus the menu on
 * menu screens, the best line as shown on the title (for the level now selected), on course select each row as
 * shown (`courseSelect.rows`: id, name and best time on the level in force) and the cursor's row
 * (`courseSelect.selected`), on select the highlighted racer's name as the card shows it in the course's
 * world (`selectName`), the 1-based page on How to Play, the friends screen (`friends`) on Friends, and the race outcome on results. `local` names the slot the screen follows, and is present only when
 * a `?local=` was accepted (a debug race, never saved). `net` describes the online room and race
 * whenever a room has been opened (see `netSummary`).
 *
 * @param sceneRunning Whether Phaser is actually running `rt.scene`. When it isn't, the
 * scene reads 'none', so a runtime that believes in a scene Phaser stopped is visible.
 */
export function debugSummary(rt: Runtime, saveStatus: SaveStatus, sceneRunning: boolean): Record<string, unknown> {
  const { menu, world } = rt;
  const net = netSummary(rt.flow);
  return {
    scene: sceneRunning ? rt.scene : 'none',
    save: saveStatus,
    character: rt.selectedCharacter,
    course: rt.course.id,
    medium: mediumIdOf(rt.course),
    difficulty: rt.settings.difficulty,
    ...(world
      ? {
          ...summarize(world, rt.localRacer),
          raceDifficulty: world.difficulty,
          levelBanner: levelBanner(world),
          threat: threatOf(world),
          hints: rt.hints,
        }
      : {}),
    ...(rt.localSlot === null ? {} : { local: rt.localSlot }),
    ...(menu ? { menu: { options: menu.options, selected: menu.selected } } : {}),
    ...(net ? { net } : {}),
    ...sceneDetails(rt),
  };
}

/** What the squid warnings on the HUD are showing: a squid locked on the local racer, and a squid latched on it. */
function threatOf(world: World) {
  return { lockedOn: squidHuntingLocal(world) !== null, latched: localOf(world).status.latched > 0 };
}

function sceneDetails(rt: Runtime): Record<string, unknown> {
  const best = rt.save ? bestFor(rt.save, rt.course.id, rt.settings.difficulty) : null;
  if (rt.scene === 'title') return { best: best ? formatBest(best) : null };
  if (rt.scene === 'course') return { courseSelect: courseSelectOf(rt) };
  if (rt.scene === 'select') return { selectName: racerName(rt.selectedCharacter, rt.course).toUpperCase() };
  if (rt.scene === 'friends') return { friends: friendsSummary(rt.online) };
  if (rt.scene === 'howToPlay') return { howToPlay: { page: rt.howToPage + 1, pages: HOW_TO_PLAY_PAGES } };
  if (rt.scene !== 'results' || !rt.lastResult) return {};
  const { result, newBest, saveFailed } = rt.lastResult;
  return { result: { place: result.playerPlace, ticks: result.playerTicks, newBest, saveFailed } };
}

/** Course select's rows as the screen shows them, and the index of the cursor's row. */
function courseSelectOf(rt: Runtime) {
  const save = rt.save ?? NEW_GAME;
  const rows = rt.listedCourses.map((course) => ({ id: course.id, ...rowText(course, save, rt.settings.difficulty) }));
  return { rows, selected: rt.courseCursor };
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
    ...(world ? { worldHash: hashWorld(world) } : {}),
  };
}
