/**
 * A reference to one frame of a texture, as world skins name art that lives in a shared sheet
 * (a portrait in `ui-portraits`, an icon in `ui-icons`).
 */

/** One frame of one texture. Keys are plain strings so each world can register its own textures. */
export interface ArtRef {
  texture: string;
  frame: string;
}
