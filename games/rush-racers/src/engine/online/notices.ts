/**
 * The status lines the online screens show. Placeholder wording: phase 4 of the online plan writes
 * the final text for each, and every notice the flow sets comes from here so that happens in one place.
 */
import type { CloseReason } from '../../net/transport/types.ts';

export const NOTICES = {
  creating: 'Creating room...',
  joining: 'Joining room...',
  unavailable: 'Rooms are unavailable',
  copied: 'Link copied',
  notCopied: 'Could not copy the link',
  outOfSync: 'Out of sync',
} as const;

/** What the title says after a connection ended for `reason`; null when the player left on purpose. */
export function closedNotice(reason: CloseReason | null): string | null {
  if (reason === 'left') return null;
  return `Disconnected: ${reason ?? 'lost'}`;
}
