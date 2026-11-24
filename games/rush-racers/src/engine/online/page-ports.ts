/**
 * The page side of online play: the room service over WebSocket and fetch, the share sheet and
 * clipboard, and race seeds. The only online module in the engine that touches the browser; the flow gets these as
 * `OnlinePorts` and stays free of the DOM.
 */
import { KICK_SILENCE_MS } from '@arcade/api/protocol';
import type { GameContext } from '@arcade/shell';
import { createRoomTransport } from '../../net/transport/websocket.ts';
import { BUILD_ID } from '../build-id.ts';
import { isTouchScreen } from '../touch.ts';
import type { LinkShared, OnlinePorts } from './flow.ts';
import { roomLink } from './room-link.ts';

/**
 * The real ports for this page. In test mode a race's seed is the page's `?seed=`, so a run
 * repeats, and nobody is ever kicked, since a test page stalls whenever the harness stops advancing it.
 */
export function pagePorts(ctx: GameContext): OnlinePorts {
  const transport = createRoomTransport();
  return {
    connect: (code) => transport.connectToRoom(code, BUILD_ID),
    createRoom: transport.createRoom,
    quotaBlockedUntil: transport.quotaBlockedUntil,
    shareLink: (code) => shareLink(roomLink(window.location.href, code)),
    seed: () => (ctx.params.testMode ? ctx.params.seed >>> 0 : randomSeed()),
    kickAfterMs: ctx.params.testMode ? null : KICK_SILENCE_MS,
  };
}

/**
 * Opens the system share sheet with `url` on a touch screen whose browser has one, so a phone can
 * send it straight to a chat; anywhere else, or when the sheet can't open, copies it instead.
 */
async function shareLink(url: string): Promise<LinkShared> {
  if (isTouchScreen() && navigator.canShare?.({ url })) {
    try {
      await navigator.share({ title: 'Race me in Rush Racers', url });
      return 'shared';
    } catch (error) {
      // AbortError is the player closing the sheet; anything else falls back to the clipboard.
      if (error instanceof DOMException && error.name === 'AbortError') return 'dismissed';
    }
  }
  return (await copyText(url)) ? 'copied' : 'failed';
}

/** Writes `text` to the clipboard; false when the browser has no clipboard or refuses (no permission, page not focused). */
async function copyText(text: string): Promise<boolean> {
  if (!navigator.clipboard) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // A refusal is the player's browser saying no; the flow shows it as a notice, and there is nothing to report.
    return false;
  }
}

/** A random 32-bit race seed. */
function randomSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0] ?? 0;
}
