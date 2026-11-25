/**
 * The title and character select screens: DOM over the 3D scene, shown while `runtime.scene` is
 * `title` or `select` and hidden otherwise. Reads runtime state; never changes it.
 */
import { CAST } from '../../logic/characters.ts';
import { CHARACTER_IDS, type CharacterId } from '../../logic/types.ts';
import { RACER_COLORS } from '../racers/racer-geometry.ts';
import type { Scene } from '../runtime.ts';
import { SCREENS_CSS } from './screens-style.ts';

/** What the screens draw from, read from the `Runtime` each frame. */
export interface ScreenState {
  scene: Scene;
  /** The select cursor's index in `CHARACTER_IDS`. */
  cursor: number;
  /** The character races currently use. */
  character: CharacterId;
}

/** The title and character-select overlays. */
export interface Screens {
  /** Shows the screen for `state.scene`, updating the DOM only when something changed. */
  sync(state: ScreenState): void;
}

/** Adds the menus' DOM to `container`. */
export function createScreens(container: HTMLElement): Screens {
  const root = document.createElement('div');
  root.className = 'rr3d-menus';
  const style = document.createElement('style');
  style.textContent = SCREENS_CSS;

  const title = document.createElement('section');
  title.className = 'rr3d-title';
  title.hidden = true;
  const titleCopy = document.createElement('div');
  titleCopy.className = 'rr3d-title-copy';
  const heading = document.createElement('h1');
  heading.append('Rush ');
  const racers = document.createElement('span');
  racers.textContent = 'Racers';
  const format = document.createElement('sup');
  format.textContent = '3D';
  heading.append(racers, ' ', format);
  const start = document.createElement('p');
  start.textContent = 'Press Enter or ★ to start';
  titleCopy.append(heading, start);
  title.append(titleCopy);

  const select = document.createElement('section');
  select.className = 'rr3d-select';
  select.hidden = true;
  const selectCopy = document.createElement('div');
  selectCopy.className = 'rr3d-select-copy';
  const choose = document.createElement('h2');
  choose.textContent = 'Choose a racer';
  const grid = document.createElement('ul');
  grid.className = 'rr3d-cards';
  const cards = CHARACTER_IDS.map((id) => {
    const card = document.createElement('li');
    const swatch = document.createElement('span');
    swatch.className = 'rr3d-card-color';
    swatch.style.backgroundColor = `#${RACER_COLORS[id].toString(16).padStart(6, '0')}`;
    const name = document.createElement('strong');
    name.className = 'rr3d-card-name';
    name.textContent = CAST[id].name;
    const species = document.createElement('span');
    species.className = 'rr3d-card-species';
    species.textContent = CAST[id].species;
    card.append(swatch, name, species);
    return card;
  });
  grid.append(...cards);
  const hint = document.createElement('p');
  hint.className = 'rr3d-select-hint';
  for (const text of ['Arrows or d-pad to choose', 'Enter or ★ to race · X or B to go back']) {
    const part = document.createElement('span');
    part.textContent = text;
    hint.append(part);
  }
  selectCopy.append(choose, grid, hint);
  select.append(selectCopy);
  root.append(style, title, select);
  container.append(root);

  let scene: Scene | undefined;
  let selected: HTMLLIElement | undefined;
  return {
    sync(state) {
      if (state.scene !== scene) {
        scene = state.scene;
        title.hidden = scene !== 'title';
        select.hidden = scene !== 'select';
      }
      if (scene !== 'select') return;
      const card = cards[state.cursor] ?? cards[CHARACTER_IDS.indexOf(state.character)];
      if (card === selected) return;
      selected?.removeAttribute('aria-current');
      selected = card;
      selected?.setAttribute('aria-current', 'true');
    },
  };
}
