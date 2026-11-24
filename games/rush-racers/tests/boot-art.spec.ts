/**
 * Art loads per screen: boot builds the UI kit and the art of the courses the title and select
 * screens draw, another world's art loads when course select picks it, Friends loads every world's,
 * and a chunk that fails to load says so on screen, reports a game error, and loads on the next pick.
 */
import { GameDriver, type Problem } from '@arcade/testing';
import { expect, test } from '@arcade/testing/playwright';
import { TWO_COURSE_SAVE, tap, wait } from '../scenarios/kit.ts';

/** Title Race, then down to Bramble Run on course select and fire once it has armed. */
const PICK_BRAMBLE_RUN = [wait(25), tap('fire'), wait(5), tap('down'), wait(20), tap('fire'), wait(2)];

/** Title down to Friends and fire, once the title has armed. */
const OPEN_FRIENDS = [wait(25), tap('down'), wait(2), tap('fire'), wait(2)];

/** A world's or theme's art chunk: `art.ts` from the dev server, `art-<hash>.js` from a build. */
const ART_CHUNK = /\/art(?:\.ts|-[\w-]+\.js)(?:\?.*)?$/;

/**
 * Textures on the title after boot: the global art, the UI kit, Ocean's and Reef's (197 with every
 * world and theme). Screens make a few textures of their own, so a count taken on another screen
 * can't stand in for "every world's"; this pins the number instead. Update it when that art changes.
 */
const BOOT_TEXTURES = 59;

test("boot builds only the menu course's world and theme; Friends loads every world's", async ({ game }) => {
  await game.open();
  expect(await game.summary()).toMatchObject({
    scene: 'title',
    course: 'sunlit-shallows',
    art: ['ocean', 'reef'],
    textures: BOOT_TEXTURES,
  });

  await game.play(OPEN_FRIENDS);
  const friends = await game.summary();
  expect(friends).toMatchObject({
    scene: 'friends',
    art: expect.arrayContaining(['thornwood', 'cloudreach', 'farside', 'forest', 'sky', 'space']),
  });
  expect(friends.art).toHaveLength(8);
});

test('boot with ?course=bramble-run and a save on Sunlit Shallows builds both worlds', async ({ game }) => {
  await game.open({ query: { course: 'bramble-run' } });
  await game.loadState(TWO_COURSE_SAVE);
  await game.open({ query: { course: 'bramble-run' } });
  expect(await game.summary()).toMatchObject({
    scene: 'title',
    course: 'bramble-run',
    art: ['forest', 'ocean', 'thornwood', 'reef'],
  });
});

test("picking a course in a world not yet loaded reaches select with that world's art", async ({ game }) => {
  await game.open();
  const before = (await game.summary()).textures as number;
  await game.play(PICK_BRAMBLE_RUN);
  const select = await game.summary();
  expect(select).toMatchObject({
    scene: 'select',
    course: 'bramble-run',
    selectName: 'GRIT',
    art: ['ocean', 'reef', 'forest', 'thornwood'],
  });
  expect(select.textures).toBeGreaterThan(before);
});

/**
 * Whether `problem` is the page's side of an art chunk that 404'd: the response, the aborted module
 * request (Chromium's net::ERR_ABORTED, WebKit's "cancelled") or the browser's console line for the 404.
 */
function chunk404({ kind, message }: Problem): boolean {
  if (kind === 'console-error') return /status of 404/.test(message);
  return kind === 'request-failed' && /\/art[.-]/.test(message) && /^404 |net::ERR_ABORTED$| cancelled$/.test(message);
}

// The `game` fixture fails any test with a game error or a failed request, and this one expects
// exactly those, so it drives its own GameDriver and asserts the whole problem list instead.
test('a chunk that fails to load shows a reload message, reports a game error, and loads on the next pick', async ({
  page,
  gamePath,
}) => {
  const game = new GameDriver(page, gamePath);
  await game.open();
  await page.route(ART_CHUNK, (route) => route.fulfill({ status: 404, body: '' }));

  await game.play(PICK_BRAMBLE_RUN);

  expect(await game.summary()).toMatchObject({ scene: 'course', course: 'bramble-run', art: ['ocean', 'reef'] });
  await expect(page.locator('.arcade-notice')).toHaveText(
    "Couldn't load the course art. Reload the page to try again.",
  );
  // The game recovers on the next pick, so the shell's fatal banner (which never goes away) stays off.
  await expect(page.locator('.arcade-error')).toHaveCount(0);
  const problems = await game.problems();
  const gameErrors = problems.filter(({ kind }) => kind === 'game-error');
  expect(gameErrors).toEqual([
    {
      kind: 'game-error',
      message: expect.stringMatching(/^art: Couldn't load the art for (theme 'forest'|world 'thornwood'): /),
    },
  ]);
  expect(problems.filter((problem) => problem.kind !== 'game-error' && !chunk404(problem))).toEqual([]);

  await page.unroute(ART_CHUNK);
  await game.play([wait(2), tap('fire'), wait(2)]);
  expect(await game.summary()).toMatchObject({ scene: 'select', course: 'bramble-run' });
  expect(await game.problems()).toEqual(problems);
});
