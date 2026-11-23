/**
 * `defineTheme`, the one way a theme file builds its theme, so optional parts get their defaults in
 * one place.
 */
import type { Theme, ThemeSpec } from './types.ts';

/** A theme from its spec: no legend glyph art and no extra layers unless the spec gives them. */
export function defineTheme(spec: ThemeSpec): Theme {
  return {
    ...spec,
    terrain: { ...spec.terrain, glyphTiles: spec.terrain.glyphTiles ?? {} },
    extraLayers: spec.extraLayers ?? (() => []),
  };
}
