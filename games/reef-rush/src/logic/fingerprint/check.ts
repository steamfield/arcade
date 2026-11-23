/**
 * Registers one character's fingerprint tests, so each character's eight races run in a file of
 * their own (Vitest runs files in parallel). With FINGERPRINT_RECORD=1 it writes the hashes instead.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { CharacterId } from '../types.ts';
import { FINGERPRINT_RACES, fingerprint, firstDifference, raceKey } from './fingerprint.ts';

/** Eight whole races per file; about 5 s alone, more under a loaded run. */
const TIMEOUT_MS = 60_000;

/** Registers the fingerprint tests for `character`. */
export function describeFingerprints(character: CharacterId): void {
  const file = new URL(`./data/${character}.json`, import.meta.url);
  const recording = process.env.FINGERPRINT_RECORD === '1';

  describe(`fingerprints of the phase-7 ocean race as ${character}`, () => {
    if (recording) {
      it(
        'records',
        () => {
          const data = Object.fromEntries(
            FINGERPRINT_RACES.map((race) => [raceKey(race), fingerprint(character, race).join(' ')]),
          );
          writeFileSync(file, `${JSON.stringify(data, null, 1)}\n`);
        },
        TIMEOUT_MS,
      );
      return;
    }
    const recorded: Record<string, string> = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
    it.each(FINGERPRINT_RACES.map((race) => [raceKey(race), race] as const))(
      '%s plays exactly as recorded',
      (key, race) => {
        const want = recorded[key];
        expect(want, `no recorded fingerprint for ${character} ${key}`).toBeDefined();
        const difference = firstDifference(want?.split(' ') ?? [], fingerprint(character, race));
        expect(difference, `${character} ${key} changed`).toBeNull();
      },
      TIMEOUT_MS,
    );
  });
}
