/**
 * Cloudreach's race song. Placeholder: the race theme under Cloudreach's name, so a Cloudreach course
 * plays something until its own song is written.
 */
import { parseSong, type Song } from '../notation.ts';
import { raceSource } from './race.ts';

/** Cloudreach's race song in the game's notation. */
export const cloudreach: Song = parseSong(raceSource.replace('name: race', 'name: cloudreach'));
