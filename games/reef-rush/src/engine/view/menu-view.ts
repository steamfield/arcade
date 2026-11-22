/**
 * Draws a menu as a centred column of labels with the selected one bracketed
 * and highlighted. It only reads the runtime's `Menu`; input moves it.
 */
import type Phaser from 'phaser';
import { createLabel } from '../art/font.ts';
import type { Menu, MenuOption } from '../menu.ts';

export interface MenuView {
  /** Redraws the selection. A null menu (the screen is switching) leaves the labels as they were. */
  sync(menu: Menu | null): void;
}

const ROW_HEIGHT = 16;
const SELECTED_COLOUR = '#ffd23f';
const IDLE_COLOUR = '#cfe9ff';

/** Adds one label per option, the first centred at (x, y) and the rest below it. */
export function createMenuView(scene: Phaser.Scene, x: number, y: number, options: readonly MenuOption[]): MenuView {
  const labels = options.map((option, row) =>
    createLabel(scene, x, y + row * ROW_HEIGHT, option, { size: 'medium', align: 'center', color: IDLE_COLOUR }),
  );
  return {
    sync(menu) {
      if (!menu) return;
      labels.forEach((label, row) => {
        const selected = row === menu.selected;
        const option = options[row] ?? '';
        label.setText(selected ? `> ${option} <` : option).setColor(selected ? SELECTED_COLOUR : IDLE_COLOUR);
      });
    },
  };
}
