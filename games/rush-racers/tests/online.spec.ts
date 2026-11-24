/**
 * A race between two browsers on the real room service: the host creates a room from Friends, the
 * guest opens its `?room=` link, both pick characters, and they race Run Test with every page
 * stepping the same simulation from the inputs the room relays.
 */
import type { GameDriver } from '@arcade/testing';
import { tap, wait } from '../scenarios/kit.ts';
import { expect, press, raceTogether, type Summary, summaryOf, test, turnsUntil } from './online-kit.ts';

/** Ticks a menu screen ignores fire after it appears (20), plus one. */
const ARMED_TICKS = 21;
/** Ticks from the end of a race to a results screen that takes input: the 90-tick delay, then the menu's arming. */
const END_TO_RESULTS = 90 + ARMED_TICKS + 5;

/** What `debugState()` holds that these tests compare. */
interface RaceState {
  worldHash: number;
  race: { result: { standings: string[] } | null };
  racers: { id: string; character: string }[];
}

const stateOf = async (game: GameDriver) => (await game.state()) as RaceState;
const twoPeers = (summary: Summary) => summary.net?.peers.length === 2 && summary.net.peers.every((peer) => peer.ready);

/**
 * The host creates a room on Run Test, the guest joins by link, the host picks Streak and the guest
 * Gil, and the host starts; returns once both pages are racing.
 */
async function startRace(host: GameDriver, guest: GameDriver): Promise<void> {
  await host.open({ scene: 'friends', query: { course: 'run-test' } });
  await host.play([wait(ARMED_TICKS), tap('fire')]);
  await turnsUntil([host], (summary) => summary.net?.status === 'lobby');
  const code = (await summaryOf(host)).net?.code;
  expect(code, 'the host summary names the room').toMatch(/^[2-9A-Z]{6}$/);

  await guest.open({ query: { room: code as string } });
  await turnsUntil([host, guest], twoPeers);
  await press(host, 'right', 'right');
  await press(guest, 'right');
  const picked = (summary: Summary) => summary.net?.peers.map((peer) => peer.character).join() === 'streak,gil';
  await turnsUntil([host, guest], (summary) => picked(summary) && summary.net?.phase === 'lobby');
  expect((await summaryOf(host)).net?.canStart).toBe(true);

  await press(host, 'down', 'down', 'down', 'fire');
  await turnsUntil([host, guest], (summary) => summary.scene === 'race');
}

/** Both pages race to the end, then wait out the results delay together. */
async function raceToResults(host: GameDriver, guest: GameDriver): Promise<void> {
  await raceTogether([host, guest], 'over');
  for (const game of [host, guest]) await game.advance(END_TO_RESULTS);
  await turnsUntil([host, guest], (summary) => summary.scene === 'results');
}

test.describe('an online race between two browsers', () => {
  // A whole race played in turns on two pages: several times a typical scenario's work.
  test.slow();

  test('finishes with equal standings and world hashes, each page in its own slot', async ({ game: host, guest }) => {
    await startRace(host, guest);
    const starts = await Promise.all([host, guest].map(summaryOf));
    expect(starts.map((summary) => summary.net?.race?.local)).toEqual(['player', 'tess']);
    expect(starts.map((summary) => summary.net?.race?.delay)).toEqual([3, 3]);

    await raceToResults(host, guest);

    const [hostState, guestState] = await Promise.all([host, guest].map(stateOf));
    expect(hostState?.race.result?.standings).toHaveLength(4);
    expect(guestState?.race.result?.standings).toEqual(hostState?.race.result?.standings);
    expect(guestState?.worldHash).toBe(hostState?.worldHash);
    const cast = (state: RaceState | undefined) =>
      state?.racers.slice(0, 2).map(({ id, character }) => [id, character]);
    expect(cast(hostState)).toEqual([
      ['player', 'streak'],
      ['tess', 'gil'],
    ]);
    expect(cast(guestState)).toEqual(cast(hostState));
    const ends = await Promise.all([host, guest].map(summaryOf));
    for (const summary of ends) {
      expect(summary.net).toMatchObject({ status: 'racing', dropped: 0, race: { over: true, desync: false } });
    }
  });

  test('Race again on both pages goes back to the room, and a second race reaches GO', async ({
    game: host,
    guest,
  }) => {
    await startRace(host, guest);
    await raceToResults(host, guest);

    for (const game of [host, guest]) await press(game, 'fire');
    await turnsUntil([host, guest], (summary) => summary.scene === 'room' && summary.net?.phase === 'lobby');
    expect((await summaryOf(host)).net?.canStart).toBe(true);
    // The host's cursor is still on Start; the room ignores fire until it has been up 20 ticks.
    await host.advance(ARMED_TICKS);
    await press(host, 'fire');
    await turnsUntil([host, guest], (summary) => summary.scene === 'race');
    await raceTogether([host, guest], 'go');

    const summaries = await Promise.all([host, guest].map(summaryOf));
    expect(summaries.map((summary) => summary.net?.race?.desync)).toEqual([false, false]);
    expect(summaries.map((summary) => summary.net?.dropped)).toEqual([0, 0]);
  });
});
