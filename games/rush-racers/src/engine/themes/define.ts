/**
 * `defineTheme`, the one way a theme file builds its theme, so optional parts get their defaults in
 * one place.
 */
import type { Theme, ThemeSpec } from './types.ts';

/** A theme from its spec: no legend glyph art unless the spec gives it. */
export function defineTheme(spec: ThemeSpec): Theme {
  return {
    ...spec,
    terrain: { ...spec.terrain, glyphTiles: spec.terrain.glyphTiles ?? {} },
  };
}
