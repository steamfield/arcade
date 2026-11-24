/**
 * A vertical list of options with one selected, as used by the title and
 * results screens (offline and online). Plain state and moves; the runtime feeds it input each tick
 * and scenes only draw it.
 */

/** Every option a menu in this game can offer. */
export type MenuOption =
  | 'Race'
  | 'How to play'
  | 'Difficulty'
  | 'Sound'
  | 'Motion'
  | 'Race again'
  | 'Character'
  | 'Title';

/** The options each menu screen offers, top to bottom. */
export const MENU_OPTIONS = {
  title: ['Race', 'How to play', 'Difficulty', 'Sound', 'Motion'],
  results: ['Race again', 'Character', 'Title'],
  /** After an online race: Race again goes back to the room, Title leaves it. The room picks characters. */
  onlineResults: ['Race again', 'Title'],
} as const satisfies Record<string, readonly MenuOption[]>;

/** A menu's options and which one is selected. */
export interface Menu {
  readonly options: readonly MenuOption[];
  /** Index into `options`. */
  selected: number;
}

/** A menu with its first option selected. */
export function createMenu(options: readonly MenuOption[]): Menu {
  return { options, selected: 0 };
}

/** Moves the selection one step up (-1) or down (1), wrapping at either end. */
export function moveSelection(menu: Menu, step: 1 | -1): void {
  const count = menu.options.length;
  if (count === 0) return;
  menu.selected = (menu.selected + step + count) % count;
}

/** The option currently selected. */
export function selectedOption(menu: Menu): MenuOption {
  const option = menu.options[menu.selected];
  if (option === undefined)
    throw new Error(`Menu selection ${menu.selected} is outside ${menu.options.length} options`);
  return option;
}
