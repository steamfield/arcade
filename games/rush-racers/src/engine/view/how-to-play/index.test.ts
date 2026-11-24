import { configureLogging, type LogEntry } from '@arcade/core';
import { afterEach, describe, expect, it } from 'vitest';
import { HOW_TO_PLAY_PAGES } from '../../how-to-play.ts';
import { SKINS } from '../../worlds/index.ts';
import { MEDIUM_PAGES, mediumPagesFor, pageSpecsFor } from './index.ts';
import type { PageKit } from './kit.ts';

/** The headings a medium's pages show, in order, for a world's skin on a keyboard. */
function headingsFor(medium: string, world: keyof typeof SKINS): string[] {
  return pageSpecsFor(medium).map((page) => page.heading(false, SKINS[world]));
}

/** A label that remembers its text and whether it is showing, as the player would read it. */
interface RecordedLabel {
  text: string;
  visible: boolean;
}

/**
 * A page kit without Phaser that records the words a page adds. Sprites, glyphs and bars are
 * inert stand-ins: every setter returns the object, so a page can chain calls on them.
 */
function recordingKit(): { kit: PageKit; labels: RecordedLabel[] } {
  const labels: RecordedLabel[] = [];
  const inert: object = new Proxy(
    {},
    { get: (_target, key) => (key === 'width' || key === 'height' ? 0 : () => inert) },
  );
  const kit = {
    touch: false,
    skin: SKINS.cloudreach,
    racer: SKINS.cloudreach.cast.racers.rudy,
    sprite: () => inert,
    icon: () => inert,
    action: () => inert,
    move: () => inert,
    tiles: () => inert,
    bar: () => inert,
    well: () => {},
    setVisible: () => {},
    words(_x: number, _top: number, text: string) {
      const recorded: RecordedLabel = { text, visible: true };
      labels.push(recorded);
      const label = {
        setText(next: string) {
          recorded.text = next;
          return label;
        },
        setVisible(visible: boolean) {
          recorded.visible = visible;
          return label;
        },
        setColor: () => label,
        setOffset: () => label,
        destroy: () => {},
      };
      return label;
    },
  };
  return { kit: kit as unknown as PageKit, labels };
}

/** The words a medium's move page shows at `tick`, joined into one string. */
function moveWordsShown(medium: 'flight' | 'drift', tick: number, reducedMotion: boolean): string {
  const { kit, labels } = recordingKit();
  MEDIUM_PAGES[medium].move.build(kit)(tick, reducedMotion);
  return labels
    .filter((label) => label.visible)
    .map((label) => label.text)
    .join('\n');
}

afterEach(() => configureLogging(() => {}));

describe("How to Play's pages per medium", () => {
  it('explains swimming and dashing on a swim course', () => {
    expect(mediumPagesFor('swim')).toBe(MEDIUM_PAGES.swim);
    const headings = headingsFor('swim', 'reef');
    expect(headings[0]).toBe('SWIM AND DASH');
    expect(headings[1]).toBe('OPEN CLAMS');
    expect(headings[3]).toBe('GRAB PEARLS');
    expect(headings[4]).toBe('DASH TO BONK');
    expect(headings[6]).toBe('DASH TO DODGE');
  });

  it('teaches running, bumping crates from below and stomping on a run course, in Thornwood words', () => {
    const headings = headingsFor('run', 'thornwood');
    expect(headings[0]).toBe('RUN AND JUMP');
    expect(headings[1]).toBe('HIT CRATES');
    expect(headings[3]).toBe('GRAB ACORNS');
    expect(headings[4]).toBe('JUMP TO STOMP');
  });

  it('shows a shield stopping the bee on a run course, since a dash there dodges nothing, on the same page count', () => {
    const headings = headingsFor('run', 'thornwood');
    expect(headings[6]).toBe('SHIELD STOPS THE BEE');
    expect(headings).toHaveLength(HOW_TO_PLAY_PAGES);
    expect(headings).not.toContain('DASH TO DODGE');
  });

  it('teaches flapping, gliding and diving on a flight course with its own move page, in Cloudreach words, on the same page count', () => {
    const headings = headingsFor('flight', 'cloudreach');
    expect(mediumPagesFor('flight')).toBe(MEDIUM_PAGES.flight);
    expect(MEDIUM_PAGES.flight.move.build).not.toBe(MEDIUM_PAGES.swim.move.build);
    expect(headings[0]).toMatch(/FLAP/);
    expect(headings[1]).toBe('BALLOON POP');
    expect(headings[3]).toBe('FEATHERS');
    expect(headings).toHaveLength(HOW_TO_PLAY_PAGES);
  });

  it('names one flight move at a time while animating, and all three on the still page under reduced motion', () => {
    expect(moveWordsShown('flight', 0, false)).toBe('TAP UP TO FLAP');
    expect(moveWordsShown('flight', 0, true).split('\n')).toEqual([
      'TAP UP TO FLAP',
      'HOLD UP TO GLIDE',
      'HOLD DOWN TO DIVE',
    ]);
  });

  it('teaches thrust, drifting and braking on a drift course with its own move page, in Farside words, on the same page count', () => {
    const headings = headingsFor('drift', 'farside');
    expect(mediumPagesFor('drift')).toBe(MEDIUM_PAGES.drift);
    expect(headings[0]).toBe('THRUST AND DRIFT');
    expect(headings[1]).toBe('SUPPLY PODS');
    expect(headings[3]).toBe('STARDUST');
    expect(headings).toHaveLength(HOW_TO_PLAY_PAGES);
  });

  it('names one drift move at a time while animating, and all five on the still page under reduced motion', () => {
    const moves = [
      'HOLD TO BURN',
      'LET GO TO DRIFT',
      'BURN BACK TO BRAKE',
      'PLANETS PULL YOU IN',
      'BLACK HOLES SWALLOW YOU',
    ];
    const shownOverALoop = new Set(Array.from({ length: 900 }, (_, tick) => moveWordsShown('drift', tick, false)));

    expect(moveWordsShown('drift', 0, false)).toBe('HOLD TO BURN');
    expect([...shownOverALoop].sort()).toEqual([...moves].sort());
    expect(moveWordsShown('drift', 0, true).split('\n')).toEqual(moves);
  });

  it("falls back to swim's pages for a medium that hasn't shipped, warning once per medium", () => {
    const warnings: string[] = [];
    configureLogging((entry: LogEntry) => {
      if (entry.level === 'warn') warnings.push(entry.message);
    });
    expect(mediumPagesFor('glide')).toBe(MEDIUM_PAGES.swim);
    expect(mediumPagesFor('glide')).toBe(MEDIUM_PAGES.swim);
    expect(mediumPagesFor('toString')).toBe(MEDIUM_PAGES.swim);
    expect(warnings).toEqual([
      "How to Play has no pages for medium 'glide': showing swim's",
      "How to Play has no pages for medium 'toString': showing swim's",
    ]);
  });
});
