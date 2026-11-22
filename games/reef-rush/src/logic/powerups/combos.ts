/**
 * Combo detection: which named pairs (COMBO_PAIRS in `powerups/tuning.ts`) a set
 * of held power-ups contains. `burst.ts` reads it to change effects.
 */
import type { ComboName, PowerUpKind } from '../types.ts';
import { COMBO_PAIRS } from './tuning.ts';

/**
 * Every combo whose pair is held, in COMBO_PAIRS order. Order within the stack doesn't matter and
 * extra kinds are allowed.
 */
export function combosIn(kinds: readonly PowerUpKind[]): ComboName[] {
  return COMBO_PAIRS.filter(({ kinds: [a, b] }) => kinds.includes(a) && kinds.includes(b)).map(({ name }) => name);
}

/** The combo a burst reports: the first of `combosIn(kinds)`, or null when no pair is held. */
export function comboFor(kinds: readonly PowerUpKind[]): ComboName | null {
  return combosIn(kinds)[0] ?? null;
}
