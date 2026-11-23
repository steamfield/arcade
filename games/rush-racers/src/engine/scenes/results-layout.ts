/**
 * Where the results screen puts its heading and the course's name, with no Phaser in them, so a
 * test can hold every listed course's name clear of the heading.
 */

/** The heading, in display sun, centred here. */
export const RESULTS_HEADING = { text: 'RESULTS', x: 160, y: 12 } as const;

/** Top left: a course's name starts here and must end before the heading (x 130), above the podium portraits (y 27). */
export const RESULTS_COURSE_NAME_AT = { x: 6, y: 9 } as const;
