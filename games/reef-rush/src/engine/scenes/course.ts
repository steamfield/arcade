/**
 * Course select: every listed course with the player's best there on the level in force, drawn by
 * `view/course-view.ts` over the same backdrop as the title. The runtime moves the cursor, picks
 * the course and leaves; this scene only draws `rt.courseCursor`. While one course is listed the
 * runtime never comes here.
 */
import Phaser from 'phaser';
import { LISTED_COURSES, levelOf } from '../../logic/courses/index.ts';
import type { Course } from '../../logic/courses/types.ts';
import { bestFor } from '../../logic/records.ts';
import { NEW_GAME, type SaveData } from '../../logic/save.ts';
import type { Difficulty } from '../../logic/types.ts';
import type { Runtime } from '../runtime.ts';
import { themeFor } from '../themes/index.ts';
import { isTouchScreen } from '../touch.ts';
import { type Backdrop, createBackdrop } from '../view/backdrop.ts';
import { type CourseRowText, type CourseView, createCourseView } from '../view/course-view.ts';
import { formatRaceTime } from '../view/race-text.ts';

/** What a row shows in place of a time on a course the player has no best on yet. */
const NO_BEST = '-:--.--';

/** Course select scene. The runtime reads input for it each tick. */
export class CourseScene extends Phaser.Scene {
  private readonly rt: Runtime;
  private backdrop: Backdrop | null = null;
  private view: CourseView | null = null;

  constructor(rt: Runtime) {
    super('course');
    this.rt = rt;
  }

  create(): void {
    const rt = this.rt;
    const backdropCourse = rt.menuCourse;
    this.backdrop = createBackdrop(this, levelOf(backdropCourse), themeFor(backdropCourse), {
      get reducedMotion() {
        return rt.settings.reducedMotion;
      },
    });
    const save = rt.save ?? NEW_GAME;
    const rows = LISTED_COURSES.map((course) => rowText(course, save, rt.settings.difficulty));
    this.view = createCourseView(this, rows, isTouchScreen());
    rt.entered('course');
    this.update();
  }

  override update(): void {
    this.backdrop?.update(this.rt.step.tick);
    this.view?.sync(this.rt.courseCursor);
  }
}

/** A course's row: its name, and its best time at `difficulty` or a dash. */
function rowText(course: Course, save: SaveData, difficulty: Difficulty): CourseRowText {
  const best = bestFor(save, course.id, difficulty);
  return { name: course.name, best: best ? formatRaceTime(best.ticks) : NO_BEST };
}
