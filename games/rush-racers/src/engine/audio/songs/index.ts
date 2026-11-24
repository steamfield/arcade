/**
 * The game's soundtrack by name, parsed at module load so a malformed song fails tests and boot.
 */
import type { SongId } from '../../../logic/courses/types.ts';
import type { Song } from '../notation.ts';
import { cloudreach } from './cloudreach.ts';
import { cloudreachTwo } from './cloudreach-2.ts';
import { cloudreachThree } from './cloudreach-3.ts';
import { farside } from './farside.ts';
import { farsideTwo } from './farside-2.ts';
import { farsideThree } from './farside-3.ts';
import { lose } from './lose.ts';
import { race } from './race.ts';
import { reefTwo } from './reef-2.ts';
import { reefThree } from './reef-3.ts';
import { results } from './results.ts';
import { thornwood } from './thornwood.ts';
import { thornwoodTwo } from './thornwood-2.ts';
import { thornwoodThree } from './thornwood-3.ts';
import { title } from './title.ts';
import { win } from './win.ts';

/** Every song the game plays, keyed by the name the audio adapter asks for. */
export const songs = {
  race,
  'reef-2': reefTwo,
  'reef-3': reefThree,
  thornwood,
  'thornwood-2': thornwoodTwo,
  'thornwood-3': thornwoodThree,
  cloudreach,
  'cloudreach-2': cloudreachTwo,
  'cloudreach-3': cloudreachThree,
  farside,
  'farside-2': farsideTwo,
  'farside-3': farsideThree,
  title,
  win,
  lose,
  results,
} as const satisfies Record<string, Song>;

/** The name of a song in the soundtrack. */
export type SongName = keyof typeof songs;

/** A course's set of race tracks, named by `Course.song`. */
export type SongSet = SongId;

/** The race tracks of each set, in the order races rotate through them. */
export const RACE_TRACKS = {
  race: ['race', 'reef-2', 'reef-3'],
  thornwood: ['thornwood', 'thornwood-2', 'thornwood-3'],
  cloudreach: ['cloudreach', 'cloudreach-2', 'cloudreach-3'],
  farside: ['farside', 'farside-2', 'farside-3'],
} as const satisfies Record<SongSet, readonly SongName[]>;
