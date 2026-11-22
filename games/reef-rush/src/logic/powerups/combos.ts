/**
 * Combo detection: which named pairs (COMBO_PAIRS in `powerups/tuning.ts`) a set
 * of held power-ups contains. `burst.ts` reads it to change effects. Lane 3/a
 * implements it; the scaffold ships the signatures.
 */
import type { ComboName, PowerUpKind } from '../types.ts';

/**
 * Every combo whose pair is held, in COMBO_PAIRS order. Order within the stack doesn't matter and
 * extra kinds are allowed.
 */
export function combosIn(kinds: readonly PowerUpKind[]): ComboName[] {
  void kinds;
  throw new Error('not implemented');
}

/** The combo a burst reports: the first of `combosIn(kinds)`, or null when no pair is held. */
export function comboFor(kinds: readonly PowerUpKind[]): ComboName | null {
  void kinds;
  throw new Error('not implemented');
}
