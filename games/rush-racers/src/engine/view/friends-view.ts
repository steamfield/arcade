/**
 * Draws the friends screen, laid out to UI.md "Friends": the FRIENDS heading, the online notice
 * and the Create room / Join / Back buttons, and under Join the four code cells (the cursor's cell
 * in a gold frame with the cursor fin turned up above it and down below it, and the hint that up
 * and down change a letter), with a footer showing what fire and dash do (as the A and B buttons
 * on touch screens). It only reads the online state; the online flow moves it.
 */
import { ROOM_CODE_LENGTH } from '@arcade/api/protocol';
import type Phaser from 'phaser';
import { createLabel, type Label } from '../art/font.ts';
import { type Button, createButton } from '../art/ui/button.ts';
import { IconFrame, UiTex } from '../art/ui/keys.ts';
import { createPanel, type Panel } from '../art/ui/panel.ts';
import { FRIENDS_OPTIONS, type FriendsScreen } from '../online/friends-screen.ts';
import type { OnlineState } from '../online/state.ts';
import { COURSE_FOOTER, courseFooterItems } from './course-view.ts';
import { TONE_CSS } from './race-text.ts';

/** Where the heading is centred, as on course select. */
const HEADING = { x: 160, y: 12 } as const;
/** The notice's centre in menu mode, between the heading and the buttons; 40 characters span x 41-279. */
const NOTICE_AT = { x: 160, y: 40 } as const;
/** The menu buttons: as on the title, 80 wide so the fin (x 109-117) clears the d-pad zone. */
const MENU = { centreX: 160, top: 62, width: 80, pitch: 17 } as const;
/** The hint line's centre, above the cells; it is wider than the safe column, so it stays above y 76. */
const HINT = { x: 160, y: 28, text: 'UP AND DOWN CHANGE A LETTER' } as const;
/**
 * Code cells: one display character in a 3 px frame with 1 px padding (20 tall), 18 wide, 2 px
 * apart, centred on x 160 (x 101-219), from y 44. The turned fins sit 1 px clear above and below,
 * so the whole block ends at y 73, above the d-pad zone.
 */
const CODE_CELLS = { y: 44, w: 18, h: 20, gap: 2 } as const;
/** The cursor fin is 9x9 and sits 1 px clear of the cell. */
const FIN_SIZE = 9;
const FIN_GAP = 1;

/** The footer's words for each place the cursor can be. */
const FOOTER_WORDS = {
  menu: { fire: 'PICK', dash: 'BACK' },
  cell: { fire: 'NEXT', dash: 'BACK' },
  lastCell: { fire: 'JOIN', dash: 'BACK' },
} as const;

/** One code cell's frame, left edge first. */
function codeCellRect(index: number): { x: number; y: number; w: number; h: number } {
  const total = ROOM_CODE_LENGTH * CODE_CELLS.w + (ROOM_CODE_LENGTH - 1) * CODE_CELLS.gap;
  const left = HEADING.x - total / 2;
  return { x: left + index * (CODE_CELLS.w + CODE_CELLS.gap), y: CODE_CELLS.y, w: CODE_CELLS.w, h: CODE_CELLS.h };
}

/** A drawn friends screen that follows the screen state. */
export interface FriendsView {
  /** Shows `online.friends` and `online.notice` for logic tick `tick` (the cursor fin's nudge). */
  sync(online: OnlineState, tick: number, reducedMotion: boolean): void;
}

/** Adds the heading, the menu, the code cells and the footer to `scene`; `sync` shows the right ones. */
export function createFriendsView(scene: Phaser.Scene, touch: boolean): FriendsView {
  createLabel(scene, HEADING.x, HEADING.y, 'FRIENDS', { size: 'display', tone: 'sun', outline: true, align: 'center' });
  const buttons = FRIENDS_OPTIONS.map((option, row) =>
    createButton(scene, MENU.centreX, MENU.top + row * MENU.pitch, option, { width: MENU.width }),
  );
  const notice = createLabel(scene, NOTICE_AT.x, NOTICE_AT.y, '', { outline: true, align: 'center' });
  const code = createCodeEntry(scene);
  const footer = createFooter(scene, touch);
  return {
    sync(online, tick, reducedMotion) {
      const screen = online.friends;
      const inMenu = screen.mode === 'menu';
      notice.setText(online.notice ?? '').setVisible(inMenu);
      buttons.forEach((button, row) => {
        button
          .setVisible(inMenu)
          .setSelected(row === screen.selected)
          .animate(tick, reducedMotion);
      });
      code.sync(screen, !inMenu);
      const place = inMenu ? 'menu' : screen.cell >= ROOM_CODE_LENGTH - 1 ? 'lastCell' : 'cell';
      footer.setWords(FOOTER_WORDS[place]);
    },
  };
}

interface CodeEntry {
  sync(screen: FriendsScreen, visible: boolean): void;
}

function createCodeEntry(scene: Phaser.Scene): CodeEntry {
  const hint = createLabel(scene, HINT.x, HINT.y, HINT.text, { tone: 'foam', outline: true, align: 'center' });
  const cells = Array.from({ length: ROOM_CODE_LENGTH }, (_, index) => addCell(scene, index));
  // The menu cursor fin points right; turned a quarter either way it marks up and down.
  const up = scene.add.image(0, 0, UiTex.icons, IconFrame.cursorFin).setOrigin(0.5).setAngle(-90);
  const down = scene.add.image(0, 0, UiTex.icons, IconFrame.cursorFin).setOrigin(0.5).setAngle(90);
  return {
    sync(screen, visible) {
      hint.setVisible(visible);
      cells.forEach((cell, index) => {
        const selected = index === screen.cell;
        cell.panel.setVisible(visible).setStyle(selected ? 'accent' : 'raised');
        // A cell the screen has no character for draws empty rather than failing.
        cell.label
          .setVisible(visible)
          .setText(screen.cells[index] ?? '')
          .setColor(TONE_CSS[selected ? 'sun' : 'foam']);
      });
      const cursor = codeCellRect(screen.cell);
      // Centres on half pixels, so the odd-sized fin's edges land on whole ones.
      const centreX = cursor.x + Math.floor((cursor.w - FIN_SIZE) / 2) + FIN_SIZE / 2;
      const onCell = screen.cell >= 0 && screen.cell < ROOM_CODE_LENGTH;
      up.setPosition(centreX, cursor.y - FIN_GAP - FIN_SIZE / 2).setVisible(visible && onCell);
      down.setPosition(centreX, cursor.y + cursor.h + FIN_GAP + FIN_SIZE / 2).setVisible(visible && onCell);
    },
  };
}

function addCell(scene: Phaser.Scene, index: number): { panel: Panel; label: Label } {
  const rect = codeCellRect(index);
  const panel = createPanel(scene, rect.x, rect.y, rect.w, rect.h, 'raised');
  const label = createLabel(scene, rect.x + rect.w / 2, rect.y + rect.h / 2, '', { size: 'display', align: 'center' });
  return { panel, label };
}

interface Footer {
  setWords(words: { fire: string; dash: string }): void;
}

/** The footer as on course select: fire and its word, dash and its word, in an inset readout. */
function createFooter(scene: Phaser.Scene, touch: boolean): Footer {
  createPanel(scene, COURSE_FOOTER.x, COURSE_FOOTER.y, COURSE_FOOTER.w, COURSE_FOOTER.h, 'inset');
  const words = courseFooterItems(touch).map((item, index) => {
    const icon = index === 0 ? IconFrame.fire : IconFrame.dash;
    if (touch) createLabel(scene, item.glyph.x, item.glyph.y, index === 0 ? 'A' : 'B', { tone: 'sun' });
    else scene.add.image(item.glyph.x, item.glyph.y, UiTex.icons, icon).setOrigin(0, 0);
    return createLabel(scene, item.word.x, item.word.y, item.word.text, { tone: 'foam' });
  });
  return {
    setWords({ fire, dash }) {
      words[0]?.setText(fire);
      words[1]?.setText(dash);
    },
  };
}
