/**
 * Thornwood's race song. Placeholder: the race theme under Thornwood's name, so a Thornwood course
 * plays something until its own song is written.
 */
import { parseSong, type Song } from '../notation.ts';
import { raceSource } from './race.ts';

/** Thornwood's race song in the game's notation. */
export const thornwood: Song = parseSong(raceSource.replace('name: race', 'name: thornwood'));
