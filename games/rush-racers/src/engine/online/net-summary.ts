/**
 * The online part of `debugSummary()`: what tests and `arcade see` read about the room, the peers
 * and the race in progress. Small and rounded, like the rest of the summary.
 */

import type { OnlineFlow } from './flow.ts';
import { FRIENDS_OPTIONS } from './friends-screen.ts';
import { waitingLine } from './race-hud.ts';
import type { OnlineState } from './state.ts';

/** The summary's `net`: the client's status, room, peers and, while racing, the lockstep race. Null with no client. */
export function netSummary(flow: OnlineFlow): Record<string, unknown> | null {
  const client = flow.client;
  if (!client) return null;
  const { status, reason, lobby, race, dropped } = client.view;
  return {
    status,
    reason,
    code: flow.state.code,
    phase: lobby.phase,
    canStart: lobby.canStart,
    host: lobby.host,
    you: lobby.you,
    peers: lobby.peers.map(({ label, character, ready, ping }) => ({ label, character, ready, pingMs: ping })),
    notice: flow.state.notice,
    dropped,
    ...(race
      ? {
          race: {
            local: race.local,
            delay: race.inputDelay,
            simTick: race.simTick,
            targetTick: race.targetTick,
            waitingOn: race.waitingOn,
            // True while the race screen shows WAITING FOR.
            stalled: waitingLine(race) !== null,
            over: race.over,
            desync: race.desync !== null,
          },
        }
      : {}),
  };
}

/** The friends screen as the summary shows it: menu or code entry, the option under the cursor, the code so far and its cursor cell, and the notice. */
export function friendsSummary(state: OnlineState): Record<string, unknown> {
  const { mode, selected, cells, cell } = state.friends;
  return { mode, selected: FRIENDS_OPTIONS[selected] ?? null, cells: cells.join(''), cell, notice: state.notice };
}
