/**
 * The sound test, reached only by `?scene=jukebox`: a SOUND TEST heading, the soundtrack in one
 * framed list (a heading per race set, the highlighted song in sun, the playing one marked with
 * the section sounding), a detail line for the highlighted song and a footer naming the controls.
 * The list scrolls to keep the cursor in view. The runtime owns the state and acts on presses
 * (`screens/jukebox.ts`); this scene only draws `rt.jukebox`.
 */
import Phaser from 'phaser';
import { levelOf } from '../../logic/courses/index.ts';
import { createLabel, type Label } from '../art/font.ts';
import { createPanel } from '../art/ui/panel.ts';
import { centreOnStage } from '../centre-on-stage.ts';
import type { Runtime } from '../runtime.ts';
import { firstShownLine, type Jukebox, type JukeboxLine, jukeboxLines, trackDetail } from '../screens/jukebox.ts';
import { themeFor } from '../themes/index.ts';
import { type Backdrop, createBackdrop } from '../view/backdrop.ts';
import { TONE_CSS } from '../view/race-text.ts';

/** Where the heading is centred, as on course select. */
const HEADING = { x: 160, y: 8 } as const;
/** The list's frame, and its lines: 11 of them 9 px apart, inside the 3 px frame with room to spare. */
const LIST = { x: 50, y: 26, w: 220, h: 108 } as const;
const LINES = { top: 30, pitch: 9, shown: 11, headingX: 56, cursorX: 56, titleX: 63, markRight: 264 } as const;
/** The detail line's inset readout under the list. */
const DETAIL = { x: 50, y: 137, w: 220, h: 15, textY: 141 } as const;
/** The footer words, centred under the detail line. */
const FOOTER = { x: 160, y: 160 } as const;
const FOOTER_TEXT = 'FIRE PLAY  DASH STOP  < > SECTION';
/** What the playing row shows before any section of it has been announced. */
const PLAYING_MARK = 'PLAYING';

/** The labels of one drawn line of the list. */
interface LineLabels {
  heading: Label;
  cursor: Label;
  title: Label;
  mark: Label;
}

/** Sound test scene. The runtime reads input for it each tick. */
export class JukeboxScene extends Phaser.Scene {
  private readonly rt: Runtime;
  private backdrop: Backdrop | null = null;
  private lines: readonly JukeboxLine[] = [];
  private drawn: LineLabels[] = [];
  private detail: Label | null = null;

  constructor(rt: Runtime) {
    super('jukebox');
    this.rt = rt;
  }

  create(): void {
    centreOnStage(this);
    const rt = this.rt;
    this.backdrop = createBackdrop(this, levelOf(rt.menuCourse), themeFor(rt.menuCourse), {
      get reducedMotion() {
        return rt.settings.reducedMotion;
      },
    });
    createLabel(this, HEADING.x, HEADING.y, 'SOUND TEST', {
      size: 'display',
      tone: 'sun',
      outline: true,
      align: 'center',
    });
    createPanel(this, LIST.x, LIST.y, LIST.w, LIST.h, 'raised');
    createPanel(this, DETAIL.x, DETAIL.y, DETAIL.w, DETAIL.h, 'inset');
    this.detail = createLabel(this, LIST.x + LIST.w / 2, DETAIL.textY, '', { align: 'center' });
    createLabel(this, FOOTER.x, FOOTER.y, FOOTER_TEXT, { tone: 'foam', outline: true, align: 'center' });
    this.drawn = Array.from({ length: LINES.shown }, (_, row) => this.addLine(LINES.top + row * LINES.pitch));
    rt.entered('jukebox');
    this.lines = rt.jukebox ? jukeboxLines(rt.jukebox.tracks) : [];
    this.update();
  }

  override update(): void {
    this.backdrop?.update(this.rt.step.tick);
    const jukebox = this.rt.jukebox;
    if (!jukebox) return;
    const first = firstShownLine(this.lines, jukebox.cursor, LINES.shown);
    this.drawn.forEach((labels, row) => {
      syncLine(labels, this.lines[first + row], jukebox);
    });
    const highlighted = jukebox.tracks[jukebox.cursor];
    this.detail?.setText(highlighted ? trackDetail(highlighted.song) : '');
  }

  private addLine(y: number): LineLabels {
    return {
      heading: createLabel(this, LINES.headingX, y, '', { tone: 'dim' }),
      cursor: createLabel(this, LINES.cursorX, y, '>', { tone: 'sun' }),
      title: createLabel(this, LINES.titleX, y, ''),
      mark: createLabel(this, LINES.markRight, y, '', { tone: 'coral', align: 'right' }),
    };
  }
}

/** Shows `line` (a set heading or a track) on one row of labels, or blanks the row past the list's end. */
function syncLine(labels: LineLabels, line: JukeboxLine | undefined, jukebox: Jukebox): void {
  const track = line?.kind === 'track' ? jukebox.tracks[line.index] : undefined;
  const selected = line?.kind === 'track' && line.index === jukebox.cursor;
  const playing = track !== undefined && track.name === jukebox.playing;
  labels.heading.setText(line?.kind === 'heading' ? line.text : '');
  labels.cursor.setVisible(selected);
  labels.title.setText(track?.song.title ?? '').setColor(TONE_CSS[selected ? 'sun' : 'foam']);
  labels.mark.setText(playing ? (jukebox.section ?? PLAYING_MARK) : '');
}
