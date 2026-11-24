/**
 * Measures a course from the command line, so balance work never needs a throwaway test file.
 * Every race is deterministic: the same arguments print the same numbers.
 *
 *   node scripts/measure.ts par <course> [--seeds 200]
 *   node scripts/measure.ts race <course> [--bot expert] [--difficulty hard] [--char rudy,baron] [--seeds 30]
 *
 * `par` is the number a course records as `parTicks`: the expert bot's mean finish on Hard over every
 * character and seeds 1..N (COURSES.md "parTicks"). `race` prints, per character, the player's places
 * and mean finish against the course's par band, so a bar's margin shows before the bar runs.
 * Run from games/rush-racers. A tuning change is an edit to the course or medium file, then a rerun.
 */
import { parseArgs } from 'node:util';
import { BOT_PROFILES } from '../src/logic/ai/profiles.ts';
import { courseById } from '../src/logic/courses/index.ts';
import { parBand } from '../src/logic/difficulty/hard-bars.ts';
import { meanPlayerFinish, type Run, race, seconds } from '../src/logic/difficulty/race-bots.ts';
import { CHARACTER_IDS, type CharacterId, DIFFICULTIES, type Difficulty } from '../src/logic/types.ts';

const USAGE = 'usage: node scripts/measure.ts <par|race> <course> [--seeds N] [--bot B] [--difficulty D] [--char a,b]';

/** Exits with a usage message: the arguments can't be measured. */
function fail(message: string): never {
  console.error(`measure: ${message}\n${USAGE}`);
  process.exit(2);
}

function oneOf<T extends string>(what: string, value: string, allowed: readonly T[]): T {
  if (!(allowed as readonly string[]).includes(value))
    fail(`unknown ${what} '${value}' (known: ${allowed.join(', ')})`);
  return value as T;
}

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    seeds: { type: 'string' },
    bot: { type: 'string', default: 'expert' },
    difficulty: { type: 'string', default: 'hard' },
    char: { type: 'string' },
  },
});
const [mode, courseId] = positionals;
if (mode !== 'par' && mode !== 'race') fail(`first argument must be par or race, not '${mode ?? ''}'`);
if (!courseId || !courseById(courseId)) fail(`unknown course '${courseId ?? ''}'`);
const seedCount = Number(values.seeds ?? (mode === 'par' ? 200 : 30));
if (!Number.isInteger(seedCount) || seedCount < 1) fail(`--seeds must be a positive integer, not '${values.seeds}'`);
const seeds = Array.from({ length: seedCount }, (_, i) => i + 1);
const characters = values.char
  ? values.char.split(',').map((c) => oneOf('character', c, CHARACTER_IDS))
  : CHARACTER_IDS;

if (mode === 'par') {
  const runs = characters.flatMap((character) =>
    seeds.map((seed) => race(BOT_PROFILES.expert, character, seed, 'hard', courseId)),
  );
  const finished = runs.filter((run) => run.finish.player !== null).length;
  console.log(`par ${Math.round(meanPlayerFinish(runs, courseId))} ticks (${finished} of ${runs.length} finished)`);
} else {
  const botName = oneOf('bot', values.bot, Object.keys(BOT_PROFILES) as (keyof typeof BOT_PROFILES)[]);
  const difficulty: Difficulty = oneOf('difficulty', values.difficulty, DIFFICULTIES);
  const band = parBand(courseId);
  console.log(
    `${courseId}, ${botName} bot on ${difficulty}, seeds 1-${seedCount}; par band ${seconds(band.min)}-${seconds(band.max)} s`,
  );
  for (const character of characters)
    console.log(
      summarize(
        character,
        seeds.map((seed) => race(BOT_PROFILES[botName], character, seed, difficulty, courseId)),
      ),
    );
}

/** One line per character: places 1st to 4th, DNFs and the mean finish. */
function summarize(character: CharacterId, runs: Run[]): string {
  const places = [1, 2, 3, 4].map((place) => runs.filter((run) => run.playerPlace === place).length);
  const dnf = runs.filter((run) => run.finish.player === null).length;
  const finished = runs.length - dnf;
  const mean = finished > 0 ? `${seconds(meanPlayerFinish(runs, courseId as string))} s` : 'none finished';
  return `${character.padEnd(7)} places 1st-4th ${places.join('/')}  DNF ${dnf}  mean finish ${mean}`;
}
