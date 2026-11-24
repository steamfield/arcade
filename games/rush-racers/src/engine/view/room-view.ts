/**
 * Draws the room screen, laid out to UI.md "Room": the room code large in the top-left with the
 * race's course and level beside it, the players in join order (label, character, ping, HOST, YOU
 * and AWAY), this peer's rows as buttons with their current values and the cursor fin, a panel of
 * button hints, and `online.notice` wrapped into the strip right of the players (or RACE IN
 * PROGRESS there for a peer without a Start row while a race runs). Before the room has welcomed
 * this peer, and once the connection has closed, it shows only the notice, above the d-pad zone. It only reads `OnlineState`; the online
 * flow moves the cursor and acts.
 */
import type Phaser from 'phaser';
import { courseById, DEFAULT_COURSE } from '../../logic/courses/index.ts';
import type { Course } from '../../logic/courses/types.ts';
import type { LobbyPeer, LobbyView } from '../../net/lobby.ts';
import { createLabel, type Label } from '../art/font.ts';
import { type Button, createButton } from '../art/ui/button.ts';
import { IconFrame, UiTex } from '../art/ui/keys.ts';
import { createPanel } from '../art/ui/panel.ts';
import { type RoomRow, roomRows } from '../online/room-screen.ts';
import type { OnlineState } from '../online/state.ts';
import { racerShortName, TONE_CSS } from './race-text.ts';
import { wrapLines } from './wrap-lines.ts';

/** The code, display at 2x (24 tall, at most 106 wide), top-left on the outer margin. */
const CODE_AT = { x: 6, y: 6 } as const;
/** The race card beside the code: the course's name over the level, ending at x 244 like the players panel. */
const RACE_CARD = { x: 146, y: 6, w: 98, h: 24 } as const;
const RACE_CARD_TEXT = { x: 150, courseY: 10, levelY: 19 } as const;
/** The players panel: four text rows at a 9 px pitch, ending at y 74, above the d-pad zone, and at x 244, left of the status strip. */
const PLAYERS = { x: 6, y: 32, w: 238, h: 42, firstRowY: 36, pitch: 9 } as const;
/** Player row columns: label, name, ping (right-aligned), then the HOST, YOU and AWAY marks. */
const PLAYER_COLUMNS = { label: 10, name: 26, pingRight: 160, host: 168, you: 196, away: 216 } as const;
/** Most players a room holds, so the panel has a row for each. */
const MAX_PLAYER_ROWS = 4;
/**
 * The rows, as buttons touching at a 15 px pitch from y 76 to 166, in the safe column. Left edge
 * 120 keeps the cursor fin at x 109-117, clear of the d-pad zone as on the title; right edge 226
 * keeps them out of the A/B zone. RACE IN PROGRESS (95 px) is the widest text and fits inside.
 */
const ROWS = { centreX: 173, top: 76, width: 106, pitch: 15 } as const;
/** The hints panel right of the rows, under the status strip and above the A/B zone (y 118). */
const HINTS = { x: 232, y: 82, w: 64, h: 36 } as const;
const HINT_LINES = { iconX: 236, wordX: 247, firstY: 86, pitch: 10 } as const;
/**
 * The status strip right of the players panel and under the back link: x 248-313, lines of at most
 * 11 characters at the text face's 9 px line from y 28. A 40-character notice wraps to at most six
 * lines, which end at y 80, above the hints panel.
 */
const STATUS = { x: 248, y: 28, maxChars: 11 } as const;
/** The notice shown alone, centred above the d-pad zone; 40 characters span x 41-279. */
const WAITING_AT = { x: 160, y: 60 } as const;

/** What the Start row says while a race this peer is not in runs. */
const RACING_TEXT = 'RACE IN PROGRESS';
/** What a player row shows for a pick or ping not known yet. */
const UNKNOWN = '-';

/** The course `lobby` names, or the default for an id this build does not have. */
function lobbyCourse(lobby: LobbyView): Course {
  return courseById(lobby.course) ?? DEFAULT_COURSE;
}

/** The text of one player row's columns. */
interface PlayerRowText {
  label: string;
  name: string;
  ping: string;
  host: string;
  you: string;
  away: string;
}

/** What a player row shows for `peer`, with character names from `course`'s world. */
function playerRowText(peer: LobbyPeer, course: Course): PlayerRowText {
  return {
    label: peer.label,
    name: peer.character === null ? UNKNOWN : racerShortName(peer.character, course),
    ping: peer.ping === null ? UNKNOWN : `${peer.ping}MS`,
    host: peer.host ? 'HOST' : '',
    you: peer.you ? 'YOU' : '',
    away: peer.ready ? '' : 'AWAY',
  };
}

/** What `row`'s button says for this peer in `lobby`. On a touch screen Copy link opens the share sheet, so it says so. */
function roomRowText(row: RoomRow, lobby: LobbyView, touch: boolean): string {
  switch (row) {
    case 'Character': {
      const mine = lobby.peers.find((peer) => peer.you)?.character ?? null;
      return mine === null ? UNKNOWN : racerShortName(mine, lobbyCourse(lobby));
    }
    case 'Course':
      return lobbyCourse(lobby).name;
    case 'Level':
      return lobby.difficulty;
    case 'Start':
      return lobby.phase === 'racing' ? RACING_TEXT : 'START';
    case 'Copy link':
      return touch ? 'Share link' : row;
    default:
      return row;
  }
}

/**
 * The status strip's text: the notice, or, while a race runs and this peer has no Start row to say
 * so, RACE IN PROGRESS.
 */
function statusText(notice: string | null, lobby: LobbyView | null, rows: readonly RoomRow[]): string {
  if (notice !== null) return notice;
  return lobby?.phase === 'racing' && !rows.includes('Start') ? RACING_TEXT : '';
}

/** True when the client has been welcomed and still has a connection, so the room is worth drawing. */
function inRoom(online: OnlineState): boolean {
  return online.view !== null && online.view.status !== 'connecting' && online.view.status !== 'closed';
}

/** A drawn room screen that follows the online state. */
export interface RoomView {
  /** Shows `online` for logic tick `tick` (the cursor fin's nudge). */
  sync(online: OnlineState, tick: number, reducedMotion: boolean): void;
}

/** Adds every part of the room screen to `scene`; `sync` fills and shows them. */
export function createRoomView(scene: Phaser.Scene, touch: boolean): RoomView {
  const header = createHeader(scene);
  const players = createPlayers(scene);
  const rows = Array.from({ length: 6 }, (_, index) => createRowButton(scene, index));
  const hints = createHints(scene, touch);
  const status = createLabel(scene, STATUS.x, STATUS.y, '', { outline: true });
  const waiting = createLabel(scene, WAITING_AT.x, WAITING_AT.y, '', { outline: true, align: 'center' });
  return {
    sync(online, tick, reducedMotion) {
      const lobby = inRoom(online) ? (online.view?.lobby ?? null) : null;
      const notice = online.notice ?? '';
      const shown = lobby ? roomRows(lobby) : [];
      waiting.setText(notice).setVisible(lobby === null);
      status.setText(wrapLines(statusText(online.notice, lobby, shown), STATUS.maxChars).join('\n'));
      status.setVisible(lobby !== null);
      header.sync(online.code, lobby);
      players.sync(lobby);
      hints.setVisible(lobby !== null);
      const cursor = Math.min(online.room.row, shown.length - 1);
      rows.forEach((showRow, index) => {
        const row = shown[index];
        showRow(row && lobby ? roomRowText(row, lobby, touch) : null, index === cursor, tick, reducedMotion);
      });
    },
  };
}

interface Header {
  sync(code: string | null, lobby: LobbyView | null): void;
}

function createHeader(scene: Phaser.Scene): Header {
  const code = createLabel(scene, CODE_AT.x, CODE_AT.y, '', { size: 'display', scale: 2, tone: 'sun', outline: true });
  const card = createPanel(scene, RACE_CARD.x, RACE_CARD.y, RACE_CARD.w, RACE_CARD.h, 'raised');
  const course = createLabel(scene, RACE_CARD_TEXT.x, RACE_CARD_TEXT.courseY, '');
  const level = createLabel(scene, RACE_CARD_TEXT.x, RACE_CARD_TEXT.levelY, '', { tone: 'sun' });
  return {
    sync(roomCode, lobby) {
      code.setText(roomCode ?? '').setVisible(lobby !== null);
      card.setVisible(lobby !== null);
      course.setText(lobby ? lobbyCourse(lobby).name : '').setVisible(lobby !== null);
      level.setText(lobby?.difficulty ?? '').setVisible(lobby !== null);
    },
  };
}

interface Players {
  sync(lobby: LobbyView | null): void;
}

type PlayerColumn = keyof PlayerRowText;

function createPlayers(scene: Phaser.Scene): Players {
  const panel = createPanel(scene, PLAYERS.x, PLAYERS.y, PLAYERS.w, PLAYERS.h, 'raised');
  const rows = Array.from({ length: MAX_PLAYER_ROWS }, (_, index) => {
    const y = PLAYERS.firstRowY + index * PLAYERS.pitch;
    const at = (x: number, tone: 'foam' | 'dim' | 'sun' | 'coral', align: 'left' | 'right' = 'left'): Label =>
      createLabel(scene, x, y, '', { tone, align });
    const columns: Record<PlayerColumn, Label> = {
      label: at(PLAYER_COLUMNS.label, 'foam'),
      name: at(PLAYER_COLUMNS.name, 'foam'),
      ping: at(PLAYER_COLUMNS.pingRight, 'dim', 'right'),
      host: at(PLAYER_COLUMNS.host, 'sun'),
      you: at(PLAYER_COLUMNS.you, 'foam'),
      away: at(PLAYER_COLUMNS.away, 'coral'),
    };
    return columns;
  });
  return {
    sync(lobby) {
      panel.setVisible(lobby !== null);
      const course = lobby ? lobbyCourse(lobby) : DEFAULT_COURSE;
      rows.forEach((columns, index) => {
        const peer = lobby?.peers[index];
        const text = peer ? playerRowText(peer, course) : null;
        for (const column of Object.keys(columns) as PlayerColumn[]) {
          columns[column].setText(text?.[column] ?? '').setVisible(text !== null);
        }
        // This peer's own row reads in sun, so it stands out without relying on the YOU mark alone.
        const tone = peer?.you ? 'sun' : 'foam';
        columns.label.setColor(TONE_CSS[tone]);
        columns.name.setColor(TONE_CSS[tone]);
      });
    },
  };
}

/** Shows one row's button with `text` (null hides it), building a button the first time a text is asked for. */
type RowButton = (text: string | null, selected: boolean, tick: number, reducedMotion: boolean) => void;

/** One row of buttons. Kit buttons can't change text, so the row keeps one per text it has shown, as `menu-view.ts` does. */
function createRowButton(scene: Phaser.Scene, index: number): RowButton {
  const byText = new Map<string, Button>();
  let shown: Button | null = null;
  const top = ROWS.top + index * ROWS.pitch;
  const buttonFor = (text: string): Button => {
    const existing = byText.get(text);
    if (existing) return existing;
    const button = createButton(scene, ROWS.centreX, top, text, { width: ROWS.width });
    byText.set(text, button);
    return button;
  };
  return (text, selected, tick, reducedMotion) => {
    const button = text === null ? null : buttonFor(text);
    if (shown !== button) shown?.setVisible(false);
    shown = button;
    button?.setVisible(true).setSelected(selected).animate(tick, reducedMotion);
  };
}

interface Hints {
  setVisible(visible: boolean): void;
}

/** Fire PICK, dash LEAVE and left-right CHANGE, as icons on a keyboard and as A and B on touch. */
function createHints(scene: Phaser.Scene, touch: boolean): Hints {
  const parts: { setVisible(visible: boolean): unknown }[] = [
    createPanel(scene, HINTS.x, HINTS.y, HINTS.w, HINTS.h, 'inset'),
  ];
  const lines = [
    { icon: IconFrame.fire, letter: 'A', word: 'PICK' },
    { icon: IconFrame.dash, letter: 'B', word: 'LEAVE' },
    { icon: null, letter: '<>', word: 'CHANGE' },
  ] as const;
  lines.forEach((line, index) => {
    const y = HINT_LINES.firstY + index * HINT_LINES.pitch;
    // Text sits 1 px lower than an icon, so both centre on the line.
    if (touch || line.icon === null)
      parts.push(createLabel(scene, HINT_LINES.iconX, y + 1, line.letter, { tone: 'sun' }));
    else parts.push(scene.add.image(HINT_LINES.iconX, y, UiTex.icons, line.icon).setOrigin(0, 0));
    const wordX = line.icon === null ? HINT_LINES.wordX + 3 : HINT_LINES.wordX;
    parts.push(createLabel(scene, wordX, y + 1, line.word));
  });
  return {
    setVisible(visible) {
      for (const part of parts) part.setVisible(visible);
    },
  };
}
