/**
 * Two pages in one room, for the online Playwright tests. `test` adds a `guest` fixture beside the
 * usual `game` (the host): a second page in its own browser context with its own `GameDriver`, held
 * to the same checks (console errors, failed requests, game errors, dropped events). The helpers
 * advance the pages and read their summaries; nothing here sleeps.
 */
import { isRoomCode } from '@arcade/api/protocol';
import { GameDriver } from '@arcade/testing';
import { test as base, expect } from '@arcade/testing/playwright';
import { tap, wait } from '../scenarios/kit.ts';
import type { Action } from '../src/engine/input.ts';

export { expect };

/** The `game` fixture's host page plus a guest page in a browser context of its own. */
export const test = base.extend<{ guest: GameDriver }>({
  guest: async ({ browser, baseURL, viewport, gamePath }, use, testInfo) => {
    const context = await browser.newContext({ baseURL, viewport });
    const guest = new GameDriver(await context.newPage(), gamePath);
    await use(guest);
    await testInfo.attach('guest-console.log', {
      body: guest.console.join('\n') || '(empty)',
      contentType: 'text/plain',
    });
    const problems = await guest.problems();
    await context.close();
    if (problems.length > 0) {
      throw new Error(`Problems on the guest page:\n${problems.map((p) => `  ${p.kind}: ${p.message}`).join('\n')}`);
    }
  },
});

/** A peer as `debugSummary().net.peers` lists it. */
export interface NetPeer {
  label: string;
  character: string | null;
  ready: boolean;
  pingMs: number | null;
}

/** `debugSummary().net`, as far as these tests read it. */
export interface NetSummary {
  status: string;
  reason: string | null;
  code: string | null;
  phase: string;
  canStart: boolean;
  peers: NetPeer[];
  notice: string | null;
  dropped: number;
  race?: { local: string; delay: number; simTick: number; targetTick: number; over: boolean; desync: boolean };
}

/** The summary fields these tests read. */
export interface Summary {
  scene: string;
  phase?: string;
  net?: NetSummary;
  /** On the title, why online play ended. */
  onlineNotice?: string;
  /** On Friends: the mode, the code cells as one string, and the cursor's cell. */
  friends?: { mode: string; cells: string; cell: number };
}

export const summaryOf = async (game: GameDriver) => (await game.summary()) as unknown as Summary;

/** Ticks a menu screen ignores fire after it appears (20), plus one. */
export const ARMED_TICKS = 21;
/** Ticks from the end of a race to a results screen that takes input: the 90-tick delay, then the menu's arming. */
const END_TO_RESULTS = 90 + ARMED_TICKS + 5;

/** True when the room holds two players and both are ready. */
export const twoReady = (summary: Summary) =>
  summary.net?.peers.length === 2 && summary.net.peers.every((peer) => peer.ready);

/** The host opens Friends on Run Test and creates a room; returns its code once the host is in it. */
export async function createRoom(host: GameDriver): Promise<string> {
  await host.open({ scene: 'friends', query: { course: 'run-test' } });
  await host.play([wait(ARMED_TICKS), tap('fire')]);
  await turnsUntil([host], (summary) => summary.net?.status === 'lobby');
  const code = (await summaryOf(host)).net?.code;
  expect(isRoomCode(code ?? ''), `the host summary names the room, not ${code}`).toBe(true);
  return code as string;
}

/**
 * The host creates a room on Run Test, the guest joins by link, the host picks Streak and the guest
 * Gil, and the host starts; returns once both pages are racing.
 */
export async function startRace(host: GameDriver, guest: GameDriver): Promise<void> {
  const code = await createRoom(host);
  await guest.open({ query: { room: code } });
  await turnsUntil([host, guest], twoReady);
  await press(host, 'right', 'right');
  await press(guest, 'right');
  const picked = (summary: Summary) => summary.net?.peers.map((peer) => peer.character).join() === 'streak,gil';
  await turnsUntil([host, guest], (summary) => picked(summary) && summary.net?.phase === 'lobby');
  expect((await summaryOf(host)).net?.canStart).toBe(true);

  await press(host, 'down', 'down', 'down', 'fire');
  await turnsUntil([host, guest], (summary) => summary.scene === 'race');
}

/** Every page races to the end, then waits out the results delay together. */
export async function raceToResults(games: readonly GameDriver[]): Promise<void> {
  await raceTogether(games, 'over');
  for (const game of games) await game.advance(END_TO_RESULTS);
  await turnsUntil(games, (summary) => summary.scene === 'results');
}

/** Ticks each page runs in a turn before the other gets one. */
const TURN_TICKS = 4;
/** Turns the pages may take before a condition counts as stuck. */
const TURN_LIMIT = 500;

/** Presses each of `actions` for one tick on `game`, with a tick between, so each press registers. */
export async function press(game: GameDriver, ...actions: Action[]): Promise<void> {
  await game.play(actions.flatMap((action) => [tap(action), wait(1)]));
}

/**
 * Advances `games` a few ticks each, in turns, until `done` holds for every page's summary. Each
 * page polls its connection inside its own ticks, so turns are what let messages cross. For the
 * friends and room screens only: a race sends a message every tick, and turns would send them
 * faster than the room's rate limit allows (`raceTogether` keeps to real time).
 */
export async function turnsUntil(games: readonly GameDriver[], done: (summary: Summary) => boolean): Promise<void> {
  for (let turn = 0; turn < TURN_LIMIT; turn++) {
    const summaries = await Promise.all(games.map(summaryOf));
    if (summaries.every(done)) return;
    for (const game of games) await game.advance(TURN_TICKS);
  }
  throw new Error(`pages did not reach the condition in ${TURN_LIMIT} turns of ${TURN_TICKS} ticks`);
}

/**
 * Where on Run Test (columns, by the local racer's tile) the pilot jumps: the cracked block, the
 * beetle, the crate block, the pit, the ledge and the plateau.
 */
const JUMP_COLUMNS: readonly (readonly [number, number])[] = [
  [12, 14],
  [18, 19],
  [21, 23],
  [27, 31],
  [35, 37],
  [40, 43],
];
/** Up is held for the first `JUMP_ON` ticks of every `JUMP_PERIOD` inside a jump column, so each jump is a fresh press. */
const JUMP_PERIOD = 36;
const JUMP_ON = 30;
/**
 * The least wall time between two ticks of a racing page. A racing page sends one input message
 * per tick, and the room closes a socket that keeps up more than 80 a second, so a race in a test
 * runs at about real time (one tick per animation frame), as it would in play.
 */
const MIN_TICK_MS = 15;

/** How far `raceTogether` plays: to GO (the countdown over), or to the end of the race. */
export type RaceUntil = 'go' | 'over';

/**
 * Plays one page's online race on its own clock: one tick per animation frame, steering the local
 * racer along Run Test as a player would (run right, jump at each obstacle), until `until`. Ticks
 * while the other page's inputs are on their way step nothing; the messages land between frames.
 */
async function pilot(game: GameDriver, until: RaceUntil): Promise<void> {
  await game.page.waitForFunction(
    ({ until, columns, period, on, minTickMs }) => {
      const arcade = window.__arcade;
      if (!arcade) return false;
      type Read = {
        phase?: string;
        player?: { tile: number[] };
        net?: { race?: { targetTick: number; over: boolean } };
      };
      const done = (summary: Read) => (until === 'go' ? summary.phase === 'racing' : summary.net?.race?.over === true);
      const summary = arcade.debugSummary() as Read;
      if (done(summary)) return true;
      const clock = window as { onlineTestTickAt?: number };
      const now = performance.now();
      if (now - (clock.onlineTestTickAt ?? 0) < minTickMs) return false;
      clock.onlineTestTickAt = now;
      const column = summary.player?.tile[0] ?? 0;
      const inColumn = columns.some(([from, to]) => column >= from && column <= to);
      arcade.inject('right', true);
      arcade.inject('up', inColumn && (summary.net?.race?.targetTick ?? 0) % period < on);
      arcade.advance(1);
      return done(arcade.debugSummary() as Read);
    },
    { until, columns: JUMP_COLUMNS, period: JUMP_PERIOD, on: JUMP_ON, minTickMs: MIN_TICK_MS },
    // No wait of its own: the test's timeout bounds the race. Run Test ends within about 1500 ticks
    // however the pilot fares (the rivals finish, then the grace runs out), about 25 s at 60 a second.
    { polling: 'raf', timeout: 0 },
  );
}

/**
 * Plays every page's online race at once, each on its own clock, until each reaches `until`; then
 * lets go of the buttons and collects the events. A page that stops short names where every page was.
 */
export async function raceTogether(games: readonly GameDriver[], until: RaceUntil): Promise<void> {
  await Promise.all(games.map((game) => pilot(game, until))).catch(async (error: unknown) => {
    const where = await Promise.all(games.map(summaryOf));
    const lines = where.map((summary, page) => `  page ${page + 1} (${summary.scene}): ${JSON.stringify(summary.net)}`);
    throw new Error(`the pages did not all reach ${until}:\n${lines.join('\n')}`, { cause: error });
  });
  for (const game of games) {
    await game.page.evaluate(() => {
      window.__arcade?.inject('right', false);
      window.__arcade?.inject('up', false);
    });
    // Collects the events of the ticks just run, as every advance does.
    await game.advance(0);
  }
}
