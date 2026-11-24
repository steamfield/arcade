/**
 * Players leaving, and rooms that cannot be joined, between real browsers on the real room service:
 * a guest closing its page mid-race, a guest leaving the room, a guest whose connection goes silent,
 * and a link to a room nobody created. The room's side is read on the page that stays, never on the
 * leaver's socket.
 */
import { DEAD_AFTER_PINGS, PING_EVERY_MS } from '../src/net/transport/websocket.ts';
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
  // One of these plays a whole race in turns on two pages; one waits out a dead connection on wall time.
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

  test('a guest whose connection goes silent lands on the title with Connection lost, and the host sees it go', async ({
    game: host,
    guest,
  }) => {
    // Stands in for a network that dies without a close: once cut, nothing passes either way and
    // the room's close never reaches the guest. The guest's own close still reaches the room.
    let cut = false;
    await guest.page.routeWebSocket(/\/api\/rooms\//, (page) => {
      const room = page.connectToServer();
      page.onMessage((message) => {
        if (!cut) room.send(message);
      });
      room.onMessage((message) => {
        if (!cut) page.send(message);
      });
      room.onClose((code, reason) => {
        if (!cut) void page.close({ code, reason });
      });
    });
    const code = await createRoom(host);
    await guest.open({ query: { room: code } });
    await turnsUntil([host, guest], twoReady);

    cut = true;
    // The guest notices on its ping clock, which runs on wall time, so this polls while ticking it.
    await expect
      .poll(
        async () => {
          await guest.advance(1);
          return (await summaryOf(guest)).scene;
        },
        { timeout: (DEAD_AFTER_PINGS + 2) * PING_EVERY_MS * 2 },
      )
      .toBe('title');
    expect((await summaryOf(guest)).onlineNotice).toBe('Connection lost');
    await turnsUntil([host], (summary) => summary.net?.peers.length === 1);
    expect((await summaryOf(host)).net).toMatchObject({ status: 'lobby', canStart: false });
  });

  test('a link to a room nobody created lands on the title saying so', async ({ game }) => {
    await game.open({ query: { room: 'ZZZZZZ' } });
    await turnsUntil([game], (summary) => summary.scene === 'title');

    const summary = await summaryOf(game);
    expect(summary.onlineNotice).toBe('No room with that code');
    expect(summary.net).toBeUndefined();
  });
});
