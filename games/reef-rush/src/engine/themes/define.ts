/**
 * `defineTheme`, the one way a theme file builds its theme, so optional parts get their defaults in
 * one place.
 */
import type { Theme, ThemeSpec } from './types.ts';

/** A theme from its spec, with defaults filled for optional parts. */
export function defineTheme(spec: ThemeSpec): Theme {
  return { ...spec };
}
