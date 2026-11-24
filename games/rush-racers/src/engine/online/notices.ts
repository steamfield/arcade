/**
 * The status lines the online screens and the title show, each at most `NOTICE_MAX_CHARS` long so
 * it fits one line clear of the touch zones. Every notice the flow sets comes from here.
 */
import type { CloseReason } from '../../net/transport/types.ts';

/** The longest notice, in characters of the text face: one line, clear of the touch zones. */
export const NOTICE_MAX_CHARS = 40;

export const NOTICES = {
  creating: 'Creating room...',
  joining: 'Joining room...',
  unavailable: 'Rooms are unavailable right now',
  copied: 'Link copied',
  notCopied: 'Could not copy the link',
  outOfSync: 'The race went out of sync',
  /** The tab was hidden during a race, which leaves it. */
  hidden: 'You left the race',
} as const;

/** What each way a connection can end says; the player leaving on purpose says nothing. */
const CLOSED_NOTICES: Readonly<Record<CloseReason, string | null>> = {
  left: null,
  full: 'That room is full',
  version: 'Game versions differ: everyone reload',
  'unknown-room': 'No room with that code',
  kicked: 'You were dropped from the race',
  unavailable: NOTICES.unavailable,
  lost: 'Connection lost',
};

/** What the title says after a connection ended for `reason` (null reads as lost); null when the player left on purpose. */
export function closedNotice(reason: CloseReason | null): string | null {
  return CLOSED_NOTICES[reason ?? 'lost'];
}
