/**
 * A race between two browsers on the real room service: the host creates a room from Friends, the
 * guest opens its `?room=` link, both pick characters, and they race Run Test with every page
 * stepping the same simulation from the inputs the room relays.
 */
import type { GameDriver } from '@arcade/testing';
import {
  ARMED_TICKS,
  expect,
  press,
  raceTogether,
  raceToResults,
  startRace,
  summaryOf,
  test,
  turnsUntil,
  twoReady,
} from './online-kit.ts';

/** What `debugState()` holds that these tests compare. */
interface RaceState {
  worldHash: number;
  race: { result: { standings: string[] } | null };
  racers: { id: string; character: string }[];
}

const stateOf = async (game: GameDriver) => (await game.state()) as RaceState;

test.describe('an online race between two browsers', () => {
  // A whole race played in turns on two pages: several times a typical scenario's work.
  test.slow();

  test('finishes with equal standings and world hashes, each page in its own slot', async ({ game: host, guest }) => {
    await startRace(host, guest);
    const starts = await Promise.all([host, guest].map(summaryOf));
    expect(starts.map((summary) => summary.net?.race?.local)).toEqual(['player', 'tess']);
    expect(starts.map((summary) => summary.net?.race?.delay)).toEqual([3, 3]);

    await raceToResults([host, guest]);

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
    await raceToResults([host, guest]);

    for (const game of [host, guest]) await press(game, 'fire');
    await turnsUntil(
      [host, guest],
      (summary) => summary.scene === 'room' && summary.net?.phase === 'lobby' && twoReady(summary),
    );
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
