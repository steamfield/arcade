/**
 * The section callout: when the local racer first reaches one of the course's named zones
 * (`Course.sections`), its name slides in under the HUD's place panel, holds and slides back out, so
 * a long course reads as a run of distinct places. The zone the race starts in is never called out,
 * since the course intro card names the course there, and each later zone is called out once a race
 * however often the racer crosses back over its boundary. A course without sections shows nothing.
 *
 * The callout learns the racer's column on world ticks (`step`, from the runtime's per-tick
 * listener) and draws from the world tick, so a capture at tick N is the same however frames were
 * split. It is text, sun, outlined, its left edge on the 6 px margin and its top at y 44: under the
 * place change arrow (y 34-43), left of the centred caption line, and above y 52, where the hints
 * beside the player and the guide arrow begin. Racer tags are drawn in the world and can pass under it.
 */
import type Phaser from 'phaser';
import { courseOf } from '../../logic/courses/index.ts';
import type { CourseSection } from '../../logic/courses/types.ts';
import { centreOf } from '../../logic/racers.ts';
import { TILE, type World } from '../../logic/types.ts';
import { createLabel } from '../art/font.ts';
import { localOf } from '../local-racer.ts';
import { Layer } from './layers.ts';
import { slideRemaining } from './race-text.ts';

/** How long a callout is on screen, easing included: about 2 s. */
export const CALLOUT_TICKS = 120;
/** How long the slide in, and the slide out, take. */
const EASE_TICKS = 12;
/** How far left of its resting place the callout starts and ends. */
const SLIDE_PX = 12;
/** The callout's top-left corner at rest, in screen px. */
export const CALLOUT_ANCHOR = { x: 6, y: 44 } as const;

/**
 * The index of the section column `col` lies in, or -1 before the first. `sections` is sorted by
 * `fromCol`, as `Course.sections` is.
 */
export function sectionAt(sections: readonly CourseSection[], col: number): number {
  return sections.findLastIndex((section) => section.fromCol <= col);
}

/** What the callout shows: a section's name and its x offset from rest, or empty text for nothing. */
export interface CalloutFrame {
  text: string;
  dx: number;
}

const NO_CALLOUT: CalloutFrame = Object.freeze({ text: '', dx: 0 });

/** Which sections the local racer has reached this race, and the callout that follows. */
export interface SectionTracker {
  /** Notes the local racer's column after a world tick, starting a callout on its first entry to a later section. */
  step(world: World): void;
  /** The callout to draw at world tick `tick`. */
  frame(tick: number): CalloutFrame;
}

/** Tracks the local racer through `sections`; a callout for a new section replaces one still showing. */
export function trackSections(sections: readonly CourseSection[], reducedMotion: boolean): SectionTracker {
  // The race starts in the first section, which the intro card has already named.
  let furthest = 0;
  let callout: { name: string; startedAt: number } | null = null;
  return {
    step(world) {
      const index = sectionAt(sections, localColumn(world));
      const section = sections[index];
      if (index <= furthest || !section) return;
      furthest = index;
      callout = { name: section.name, startedAt: world.tick };
    },
    frame(tick) {
      if (!callout) return NO_CALLOUT;
      const age = tick - callout.startedAt;
      if (age < 0 || age >= CALLOUT_TICKS) return NO_CALLOUT;
      return { text: callout.name, dx: calloutOffset(age, reducedMotion) };
    },
  };
}

/** The level column the local racer's body centre is in. */
function localColumn(world: World): number {
  return Math.floor(centreOf(localOf(world)).x / TILE);
}

/** How far left of rest the callout sits `age` ticks in: sliding in, holding, then sliding back out. */
function calloutOffset(age: number, reducedMotion: boolean): number {
  if (reducedMotion) return 0;
  const leaving = age - (CALLOUT_TICKS - EASE_TICKS);
  if (leaving > 0) return slideRemaining(leaving, SLIDE_PX, EASE_TICKS, false) - SLIDE_PX;
  // 0 minus, not unary minus, so a finished slide is 0 rather than -0.
  return 0 - slideRemaining(age, SLIDE_PX, EASE_TICKS, false);
}

/** The section callout on the race screen. */
export interface SectionCallout {
  /** Call once per world tick, after the step. */
  step(world: World): void;
  /** Redraws the callout for the world's current tick. */
  sync(world: World): void;
}

/**
 * Adds the callout for `world`'s course to `scene`, pinned to the screen on the HUD layer.
 *
 * @throws {Error} When the world names a course the registry doesn't have (see `courseOf`).
 */
export function createSectionCallout(scene: Phaser.Scene, world: World, reducedMotion: boolean): SectionCallout {
  const tracker = trackSections(courseOf(world).sections ?? [], reducedMotion);
  const label = createLabel(scene, CALLOUT_ANCHOR.x, CALLOUT_ANCHOR.y, '', {
    tone: 'sun',
    outline: true,
    fixed: true,
    depth: Layer.hud,
  }).setVisible(false);
  return {
    step: (current) => tracker.step(current),
    sync(current) {
      const { text, dx } = tracker.frame(current.tick);
      label.setVisible(text !== '');
      if (text !== '') label.setText(text).setOffset(dx, 0);
    },
  };
}
