/**
 * The game's soundtrack by name, parsed at module load so a malformed song fails tests and boot.
 */
import type { Song } from '../notation.ts';
import { cloudreach } from './cloudreach.ts';
import { lose } from './lose.ts';
import { race } from './race.ts';
import { results } from './results.ts';
import { thornwood } from './thornwood.ts';
import { title } from './title.ts';
import { win } from './win.ts';

/** Every song the game plays, keyed by the name the audio adapter asks for. */
export const songs = { race, thornwood, cloudreach, title, win, lose, results } as const satisfies Record<string, Song>;

/** The name of a song in the soundtrack. */
export type SongName = keyof typeof songs;
