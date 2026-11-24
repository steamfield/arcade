/**
 * Players leaving, and rooms that cannot be joined, between real browsers on the real room service:
 * a guest closing its page mid-race, a guest leaving the room, a link to a room nobody created, and
 * both players going back to the room after a race. Each test waits on the page that stays, never
 * on the leaver's socket.
 */
import {
  ARMED_TICKS,
  createRoom,
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

test.describe('players leaving an online room', () => {
  // Two of these play a whole race in turns on two pages.
  test.slow();

  test('a guest closing its page mid-race leaves the host racing to results against its racer, now the AI', async ({
    game: host,
    guest,
  }) => {
    await startRace(host, guest);
    await raceTogether([host, guest], 'go');

    await guest.page.close();
    await raceToResults([host]);

    const takeovers = (await host.events()).filter((event) => event.type === 'racer.takeover');
    expect(takeovers.map((event) => event.id)).toEqual(['tess']);
    expect((await summaryOf(host)).net).toMatchObject({
      status: 'racing',
      dropped: 0,
      peers: [{ label: 'P1' }],
      race: { over: true, desync: false },
    });
  });

  test('a guest leaving from the room leaves the host alone in it, and the room can be joined again', async ({
    game: host,
    guest,
  }) => {
    const code = await createRoom(host);
    await guest.open({ query: { room: code } });
    await turnsUntil([host, guest], twoReady);

    // The room ignores B until it has been up 20 ticks.
    await guest.advance(ARMED_TICKS);
    await press(guest, 'dash');
    expect((await summaryOf(guest)).scene).toBe('title');
    await turnsUntil([host], (summary) => summary.net?.peers.length === 1);
    expect((await summaryOf(host)).net).toMatchObject({ status: 'lobby', canStart: false });

    await guest.open({ query: { room: code } });
    await turnsUntil([host, guest], twoReady);
  });

  test('a link to a room nobody created lands on the title saying so', async ({ game }) => {
    await game.open({ query: { room: 'ZZZZZZ' } });
    await turnsUntil([game], (summary) => summary.scene === 'title');

    const summary = await summaryOf(game);
    expect(summary.onlineNotice).toBe('No room with that code');
    expect(summary.net).toBeUndefined();
  });

  test('after a finished race, Race again on both pages shows both ready in the room', async ({
    game: host,
    guest,
  }) => {
    await startRace(host, guest);
    await raceToResults([host, guest]);

    for (const game of [host, guest]) await press(game, 'fire');
    await turnsUntil([host, guest], (summary) => summary.scene === 'room' && twoReady(summary));
    expect((await summaryOf(host)).net).toMatchObject({ phase: 'lobby', canStart: true });
  });
});
