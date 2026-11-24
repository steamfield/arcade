/**
 * The title and character select screens: DOM over the 3D scene, shown while `runtime.scene` is
 * `title` or `select` and hidden otherwise. Reads runtime state; never changes it.
 */
import { CAST } from '../logic/characters.ts';
import { CHARACTER_IDS, type CharacterId } from '../logic/types.ts';
import { RACER_COLORS } from './racer-geometry.ts';
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

const CSS = `
.rr3d-menus {
  position: absolute;
  inset: 0;
  z-index: 5;
  pointer-events: none;
  color: #fff6de;
  font: 600 16px/1.25 system-ui, sans-serif;
}
.rr3d-menus [hidden] { display: none; }
.rr3d-title, .rr3d-select { position: absolute; inset: 0; }
.rr3d-title {
  display: grid;
  place-items: end center;
  text-align: center;
  background: linear-gradient(180deg, #161c1690, transparent 18%, transparent 38%, #171711de 90%);
}
.rr3d-title-copy {
  margin: 0 max(16px, env(safe-area-inset-right)) max(40px, calc(18px + env(safe-area-inset-bottom)))
    max(16px, env(safe-area-inset-left));
}
.rr3d-title h1 {
  margin: 0;
  color: #ffe1a0;
  font: italic 950 clamp(36px, 8.5vw, 104px)/0.95 system-ui, sans-serif;
  letter-spacing: -0.065em;
  text-shadow: 0 4px #35241a, 0 7px 22px #170e08;
}
.rr3d-title p {
  display: inline-block;
  margin: 20px 0 0;
  padding: 8px 14px;
  border: 1px solid #f7dcad75;
  border-radius: 6px;
  background: #231d17f5;
}
.rr3d-select {
  display: grid;
  align-items: center;
  background: linear-gradient(90deg, #231d17f8 8%, #231d17e8 39%, #231d1700 73%);
}
.rr3d-select-copy {
  margin-left: calc(clamp(14px, 3.8vw, 58px) + env(safe-area-inset-left));
  width: min(48vw, 570px);
}
.rr3d-select h2 {
  margin: 0 0 12px;
  color: #ffe1a0;
  font-size: clamp(22px, 3.6vw, 42px);
  font-weight: 850;
  letter-spacing: -0.04em;
}
.rr3d-cards {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.rr3d-cards li {
  position: relative;
  display: grid;
  align-content: start;
  gap: 3px;
  padding: 8px;
  border: 2px solid #7e6950;
  border-radius: 7px;
  background: #32281f;
}
.rr3d-cards li[aria-current="true"] {
  border-color: #ffe1a0;
  background: #55402a;
}
.rr3d-cards li[aria-current="true"]::after {
  position: absolute;
  top: 8px;
  right: 8px;
  content: '◆';
  color: #ffe1a0;
  font-size: 13px;
}
.rr3d-card-color {
  width: 23px;
  height: 7px;
  margin-bottom: 2px;
  border: 1px solid #fff6de90;
  border-radius: 2px;
}
.rr3d-card-name { font-size: clamp(16px, 2.1vw, 23px); font-weight: 800; line-height: 1; }
.rr3d-card-species { color: #f1dfc3; font-size: 16px; font-weight: 500; line-height: 1.1; }
.rr3d-select-hint {
  display: flex;
  flex-wrap: wrap;
  gap: 0 12px;
  margin: 10px 0 0;
  text-shadow: 0 1px #231d17;
}
.arcade-container:has(.rr3d-title:not([hidden])) .arcade-touch :is(.dpad, button:not([data-action="fire"])),
.arcade-container:has(.rr3d-select:not([hidden])) .arcade-touch button[data-action="jump"] { visibility: hidden; }
@media (max-height: 430px) {
  .rr3d-select h2 { margin-bottom: 7px; }
  .rr3d-cards li { padding: 5px 6px; }
  .rr3d-title-copy { margin-bottom: max(32px, calc(16px + env(safe-area-inset-bottom))); }
  .arcade-container:has(.arcade-touch) .rr3d-select { align-items: start; }
  .arcade-container:has(.arcade-touch) .rr3d-select-copy {
    margin-top: calc(20px + env(safe-area-inset-top));
    width: min(53vw, 570px);
  }
  .arcade-container:has(.arcade-touch) .rr3d-select h2 { font-size: 26px; }
  .arcade-container:has(.arcade-touch) .rr3d-cards li { gap: 1px; padding-block: 3px; }
  .arcade-container:has(.arcade-touch) .rr3d-card-color { height: 5px; margin-bottom: 1px; }
  .arcade-container:has(.arcade-touch) .rr3d-select-hint { margin-top: 6px; }
  .arcade-container:has(.rr3d-select:not([hidden])) .arcade-touch .dpad {
    /* Keep the standard cross in the corner with 44px targets. */
    width: 132px;
    height: 132px;
    bottom: calc(6px + env(safe-area-inset-bottom));
  }
  .arcade-container:has(.rr3d-select:not([hidden])) .arcade-touch button[data-action="dash"] {
    right: 0 !important;
    bottom: 0 !important;
  }
  .arcade-container:has(.rr3d-select:not([hidden])) .arcade-touch .dpad button { width: 44px; height: 44px; }
  .arcade-container:has(.rr3d-select:not([hidden])) .arcade-touch [data-action="forward"] { left: 44px !important; }
  .arcade-container:has(.rr3d-select:not([hidden])) .arcade-touch [data-action="left"] { top: 44px !important; }
  .arcade-container:has(.rr3d-select:not([hidden])) .arcade-touch [data-action="right"] {
    top: 44px !important;
    left: 88px !important;
  }
  .arcade-container:has(.rr3d-select:not([hidden])) .arcade-touch [data-action="back"] {
    top: 88px !important;
    left: 44px !important;
  }
}
@media (max-width: 700px) {
  .rr3d-select-copy, .arcade-container:has(.arcade-touch) .rr3d-select-copy { width: 57vw; }
}
@media (max-height: 345px), (max-width: 700px) and (max-height: 390px) {
  .arcade-container:has(.rr3d-select:not([hidden])) .arcade-touch .dpad {
    width: 188px;
    height: 44px;
  }
  .arcade-container:has(.rr3d-select:not([hidden])) .arcade-touch .dpad button { top: 0 !important; }
  .arcade-container:has(.rr3d-select:not([hidden])) .arcade-touch [data-action="forward"] { left: 48px !important; }
  .arcade-container:has(.rr3d-select:not([hidden])) .arcade-touch [data-action="back"] { left: 96px !important; }
  .arcade-container:has(.rr3d-select:not([hidden])) .arcade-touch [data-action="right"] { left: 144px !important; }
  .arcade-container:has(.rr3d-select:not([hidden])) .arcade-touch [data-action="fire"] { right: 0 !important; }
}
@media (max-width: 600px) {
  .rr3d-select-copy, .arcade-container:has(.arcade-touch) .rr3d-select-copy { width: 59vw; }
  .rr3d-cards li, .arcade-container:has(.arcade-touch) .rr3d-cards li { padding-inline: 3px; }
  .rr3d-card-species { letter-spacing: -0.04em; overflow-wrap: anywhere; }
}
`;

/** Adds the menus' DOM to `container`. */
export function createScreens(container: HTMLElement): Screens {
  const root = document.createElement('div');
  root.className = 'rr3d-menus';
  const style = document.createElement('style');
  style.textContent = CSS;

  const title = document.createElement('section');
  title.className = 'rr3d-title';
  title.hidden = true;
  const titleCopy = document.createElement('div');
  titleCopy.className = 'rr3d-title-copy';
  const heading = document.createElement('h1');
  heading.textContent = 'Rush Racers 3D';
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
