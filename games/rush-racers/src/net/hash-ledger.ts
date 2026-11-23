/**
 * The hash checks between peers: this peer's world hashes and the ones the others sent, kept until
 * both sides of a tick are known, then compared. Peers run a few ticks apart, so either side can
 * arrive first. Hashes older than the keep window are forgotten.
 */
import type { RacerId } from '../logic/types.ts';
import type { Desync } from './session.ts';

/** Ticks a hash is kept waiting for the other side of its tick: ten seconds. */
export const HASH_KEEP_TICKS = 600;

/** The hashes kept for comparison between this peer and the others. */
export interface HashLedger {
  /** Keeps this peer's hash at `tick`, compares it with any remote hash already held for that tick, and forgets hashes past the window. */
  recordLocal(tick: number, hash: number): void;
  /**
   * Compares a remote hash with this peer's hash at `tick`, or keeps it until this peer reaches
   * `tick`. Returns false when `tick` is already stepped and its local hash is no longer kept.
   */
  receiveRemote(slot: RacerId, tick: number, hash: number, simTick: number): boolean;
}

/** A ledger that calls `onMismatch` for the first pair of hashes that differ, and never again after. */
export function createHashLedger(onMismatch: (mismatch: Desync) => void): HashLedger {
  const localHashes = new Map<number, number>();
  const remoteHashes = new Map<number, { slot: RacerId; hash: number }[]>();
  let mismatched = false;

  function compare(tick: number, slot: RacerId, remote: number): void {
    const local = localHashes.get(tick);
    if (mismatched || local === undefined || local === remote) return;
    mismatched = true;
    onMismatch({ tick, local, remote, slot });
  }

  function forgetBefore(oldest: number): void {
    for (const tick of localHashes.keys()) if (tick < oldest) localHashes.delete(tick);
    for (const tick of remoteHashes.keys()) if (tick < oldest) remoteHashes.delete(tick);
  }

  return {
    recordLocal(tick, hash) {
      localHashes.set(tick, hash);
      for (const remote of remoteHashes.get(tick) ?? []) compare(tick, remote.slot, remote.hash);
      remoteHashes.delete(tick);
      forgetBefore(tick - HASH_KEEP_TICKS);
    },
    receiveRemote(slot, tick, hash, simTick) {
      if (localHashes.has(tick)) {
        compare(tick, slot, hash);
        return true;
      }
      if (tick <= simTick) return false;
      remoteHashes.set(tick, [...(remoteHashes.get(tick) ?? []), { slot, hash }]);
      return true;
    },
  };
}
