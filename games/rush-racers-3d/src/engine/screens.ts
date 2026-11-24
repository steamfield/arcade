/**
 * The title and character select screens: DOM over the 3D scene, shown while `runtime.scene` is
 * `title` or `select` and hidden otherwise. Reads runtime state; never changes it.
 */
import type { CharacterId } from '../logic/types.ts';
import type { Scene } from './runtime.ts';

/** What the screens draw from, read from the `Runtime` each frame. */
export interface ScreenState {
  scene: Scene;
  /** The select cursor's index in `CHARACTER_IDS`. */
  cursor: number;
  /** The character races currently use. */
  character: CharacterId;
}

export interface Screens {
  /** Shows the screen for `state.scene`, updating the DOM only when something changed. */
  sync(state: ScreenState): void;
}

/** Adds the screens' DOM to `container`. Phase 2 lane b draws them; until then they draw nothing. */
export function createScreens(container: HTMLElement): Screens {
  void container;
  return { sync: () => {} };
}
