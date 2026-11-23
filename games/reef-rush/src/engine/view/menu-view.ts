/**
 * Draws a menu as a column of framed kit buttons, the selected one in gold
 * with the cursor fin beside it. It only reads the runtime's `Menu`; input
 * moves it. An option's button text can change while the menu is up (SOUND
 * ON becomes SOUND OFF), so the view keeps a button per text it has shown and
 * swaps between them: kit buttons don't change text.
 */
import type Phaser from 'phaser';
import { type Button, createButton } from '../art/ui/button.ts';
import type { Menu, MenuOption } from '../menu.ts';

/** A drawn menu that follows the runtime's selection. */
export interface MenuView {
  /**
   * Redraws the selection, each option's current text, and the cursor fin for logic tick `tick`.
   * A null menu (the screen is switching) leaves the buttons as they were.
   */
  sync(menu: Menu | null, tick: number, reducedMotion: boolean): void;
}

/** Where the column sits: buttons centred on `centreX`, the first top edge at `top`, one every `pitch` px. */
export interface MenuLayout {
  centreX: number;
  top: number;
  /** Every button is this wide, so the column lines up and the fins share one x. */
  width: number;
  pitch: number;
}

/** The text an option's button shows now. Defaults to `OPTION_LABELS`. */
export type OptionText = (option: MenuOption) => string;

/** Each option's button text when it has no live state to show: the option in capitals, built once. */
export const OPTION_LABELS: Readonly<Record<MenuOption, string>> = {
  Race: 'RACE',
  'How to play': 'HOW TO PLAY',
  Difficulty: 'LEVEL',
  Sound: 'SOUND',
  Motion: 'MOTION',
  'Race again': 'RACE AGAIN',
  Title: 'TITLE',
};

/** Adds one button per option, top to bottom, the first selected once `sync` runs. */
export function createMenuView(
  scene: Phaser.Scene,
  layout: MenuLayout,
  options: readonly MenuOption[],
  textOf: OptionText = (option) => OPTION_LABELS[option],
): MenuView {
  const rows = options.map((_, row) => createOptionRow(scene, layout, row));
  return {
    sync(menu, tick, reducedMotion) {
      if (!menu) return;
      for (let row = 0; row < rows.length; row++) {
        const option = options[row];
        const showRow = rows[row];
        if (option !== undefined && showRow) showRow(textOf(option), row === menu.selected, tick, reducedMotion);
      }
    },
  };
}

/** Shows one row's button for `text`, building it the first time that text is asked for. */
type OptionRow = (text: string, selected: boolean, tick: number, reducedMotion: boolean) => void;

function createOptionRow(scene: Phaser.Scene, layout: MenuLayout, row: number): OptionRow {
  const byText = new Map<string, Button>();
  let shown: Button | null = null;
  const top = layout.top + row * layout.pitch;
  const buttonFor = (text: string) => {
    const existing = byText.get(text);
    if (existing) return existing;
    const button = createButton(scene, layout.centreX, top, text, { width: layout.width });
    byText.set(text, button);
    return button;
  };
  return (text, selected, tick, reducedMotion) => {
    const button = buttonFor(text);
    if (shown !== button) shown?.setVisible(false);
    shown = button;
    button.setVisible(true).setSelected(selected).animate(tick, reducedMotion);
  };
}
