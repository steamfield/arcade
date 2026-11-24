/**
 * The notices the online screens and the title show, with at most `NOTICE_MAX_CHARS` per line
 * so they fit clear of the touch zones. Every notice the flow sets comes from here.
 */
import type { CloseReason } from '../../net/transport/types.ts';

/** The longest notice, in characters of the text face: one line, clear of the touch zones. */
export const NOTICE_MAX_CHARS = 40;

export const NOTICES = {
  creating: 'Creating room...',
  joining: 'Joining room...',
  unavailable: 'Rooms are unavailable right now',
  copied: 'Link copied',
  shared: 'Link shared',
  notCopied: 'Could not copy the link',
  outOfSync: 'The race went out of sync',
  /** The tab was hidden during a race, which leaves it. */
  hidden: 'You left the race',
} as const;

/** What each way a connection can end says; the player leaving on purpose says nothing. */
const CLOSED_NOTICES: Readonly<Record<Exclude<CloseReason, 'quota'>, string | null>> = {
  left: null,
  full: 'That room is full',
  version: 'Game versions differ: everyone reload',
  'unknown-room': 'No room with that code',
  kicked: 'You were dropped from the race',
  unavailable: NOTICES.unavailable,
  lost: 'Connection lost',
};

/** Two lines fit above the menu. The reset time uses the player's time zone. */
export function quotaNotice(resetAt: number | null): string {
  if (resetAt === null) return 'Online play hit its daily limit\nTry again later. Solo races still work.';
  const time = new Date(resetAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `Online play is full for today\nBack at ${time}. Solo races still work.`;
}

/** What the title says after a connection ended for `reason` (null reads as lost); null when the player left on purpose. */
export function closedNotice(reason: CloseReason | null, resetAt: number | null = null): string | null {
  return reason === 'quota' ? quotaNotice(resetAt) : CLOSED_NOTICES[reason ?? 'lost'];
}
