/**
 * Art loads per screen: boot builds the UI kit and the art of the courses the title and select
 * screens draw, another world's art loads when course select picks it, and a chunk that fails to
 * load says so on screen and reports a game error.
 */
import { GameDriver } from '@arcade/testing';
import { expect, test } from '@arcade/testing/playwright';
import { TWO_COURSE_SAVE, tap, wait } from '../scenarios/kit.ts';

/** Title Race, then down to Bramble Run on course select and fire once it has armed. */
const PICK_BRAMBLE_RUN = [wait(25), tap('fire'), wait(5), tap('down'), wait(20), tap('fire'), wait(2)];

/** A world's or theme's art chunk: `art.ts` from the dev server, `art-<hash>.js` from a build. */
const ART_CHUNK = /\/art(?:\.ts|-[\w-]+\.js)(?:\?.*)?$/;

test("boot builds only the menu course's world and theme on top of the UI kit", async ({ game }) => {
  await game.open();
  const title = await game.summary();
  expect(title).toMatchObject({ scene: 'title', course: 'sunlit-shallows', art: ['ocean', 'reef'] });
  expect(title.textures).toBeGreaterThan(0);
});

test('boot with ?course=bramble-run and a save on Sunlit Shallows builds both worlds', async ({ game }) => {
  await game.open({ query: { course: 'bramble-run' } });
  await game.loadState(TWO_COURSE_SAVE);
  await game.open({ query: { course: 'bramble-run' } });
  expect(await game.summary()).toMatchObject({
    scene: 'title',
    course: 'bramble-run',
    art: ['forest', 'thornwood', 'ocean', 'reef'],
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

// The `game` fixture fails any test with a game error or a failed request, and this one expects
// exactly those, so it drives its own GameDriver and asserts the whole problem list instead.
test('a chunk that fails to load shows a reload message and reports a game error', async ({ page, gamePath }) => {
  const game = new GameDriver(page, gamePath);
  await game.open();
  await page.route(ART_CHUNK, (route) => route.fulfill({ status: 404, body: '' }));

  await game.play(PICK_BRAMBLE_RUN);

  expect(await game.summary()).toMatchObject({ scene: 'course', course: 'bramble-run', art: ['ocean', 'reef'] });
  await expect(page.locator('.arcade-notice')).toHaveText(
    "Couldn't load the course art. Reload the page to try again.",
  );
  // One 404'd chunk, as the page sees it: the game's report, the response, Chrome's console line
  // for it, and the aborted module request.
  expect(await game.problems()).toEqual([
    { kind: 'game-error', message: expect.stringMatching(/^art: Couldn't load the art for theme 'forest': /) },
    { kind: 'request-failed', message: expect.stringMatching(/^404 \S+\/art[.-]/) },
    { kind: 'console-error', message: expect.stringMatching(/status of 404/) },
    { kind: 'request-failed', message: expect.stringMatching(/\/art[.-]\S+ net::ERR_ABORTED$/) },
  ]);
});
