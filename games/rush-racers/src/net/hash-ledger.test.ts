/**
 * The hash ledger's own refusals: remote hashes it could never check are dropped instead of kept.
 * Comparison in either arrival order is covered through real sessions in `session.test.ts`.
 */
import { describe, expect, it } from 'vitest';
import { createHashLedger, HASH_INTERVAL_TICKS, HASH_KEEP_TICKS } from './hash-ledger.ts';
import type { Desync } from './session.ts';

/** A ledger and the mismatches it reported. */
function ledgerWithReports() {
  const mismatches: Desync[] = [];
  return { ledger: createHashLedger((mismatch) => mismatches.push(mismatch)), mismatches };
}

describe('createHashLedger receiveRemote', () => {
  it('drops a hash for a tick that is not a multiple of the hash interval', () => {
    const { ledger, mismatches } = ledgerWithReports();

    const accepted = ledger.receiveRemote('tess', HASH_INTERVAL_TICKS + 1, 1, 0);
    ledger.recordLocal(HASH_INTERVAL_TICKS + 1, 2);

    expect({ accepted, mismatches }).toEqual({ accepted: false, mismatches: [] });
  });

  it('drops a hash more than the keep window ahead, and keeps one at the window edge', () => {
    const { ledger, mismatches } = ledgerWithReports();
    const edge = HASH_KEEP_TICKS;
    const beyond = HASH_KEEP_TICKS + HASH_INTERVAL_TICKS;

    const accepted = [ledger.receiveRemote('tess', beyond, 1, 0), ledger.receiveRemote('tess', edge, 1, 0)];
    ledger.recordLocal(beyond, 2);
    ledger.recordLocal(edge, 3);

    expect({ accepted, mismatches }).toEqual({
      accepted: [false, true],
      mismatches: [{ tick: edge, local: 3, remote: 1, slot: 'tess' }],
    });
  });
});
