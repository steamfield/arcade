/**
 * Chord charts: reads chord symbols and a section's `chords:` lines into the `ChordSpan`s that
 * annotate a song for analysis.
 */
import { failLine } from './errors.ts';
import { pitchClassOf, transpose } from './pitch.ts';
import { splitRepeated } from './tokens.ts';
import type { ChordSpan, Line } from './types.ts';

/** The chord chart written so far, and how far the open section's `chords:` lines reach. */
export interface ChordChart {
  spans: ChordSpan[];
  /** The bar the open section starts at. */
  sectionStartBar: number;
  /** Bars the open section's `chords:` lines have covered. */
  barsWritten: number;
  /** The open section's last `chords:` line, for errors; null when it has none. */
  lastLine: number | null;
}

/** Each chord quality's tones as semitones above the root. */
const QUALITIES: ReadonlyMap<string, readonly number[]> = new Map([
  ['', [0, 4, 7]],
  ['m', [0, 3, 7]],
  ['7', [0, 4, 7, 10]],
  ['m7', [0, 3, 7, 10]],
  ['maj7', [0, 4, 7, 11]],
  ['dim', [0, 3, 6]],
  ['sus2', [0, 2, 7]],
  ['sus4', [0, 5, 7]],
  ['5', [0, 7]],
  ['6', [0, 4, 7, 9]],
  ['m6', [0, 3, 7, 9]],
]);
const CHORD_SYMBOL = /^(?<root>[A-G][#b]?)(?<quality>.*)$/;

/** An empty chart at the start of the song. */
export function createChordChart(): ChordChart {
  return { spans: [], sectionStartBar: 0, barsWritten: 0, lastLine: null };
}

/**
 * Reads one chord symbol, e.g. `Dm`, `G7` or `Bbmaj7`, into its root and tones as pitch classes.
 *
 * @throws {Error} Naming the line and the symbol when the symbol is unknown.
 */
export function parseChordSymbol(symbol: string, line: Line): { root: number; tones: readonly number[] } {
  const groups = CHORD_SYMBOL.exec(symbol)?.groups;
  const root = pitchClassOf(groups?.root ?? '');
  const intervals = QUALITIES.get(groups?.quality ?? '');
  if (root === null || intervals === undefined) {
    failLine(line, `unknown chord "${symbol}"; write a root A-G with # or b, then none, ${listQualities()}`);
  }
  return { root, tones: intervals.map((interval) => transpose(root, interval)) };
}

/**
 * Appends a `chords:` line to the open section's chart: `|` and the end of the line close a
 * bar, and the symbols in a bar split it evenly.
 *
 * @throws {Error} Naming the line for an empty line, an empty bar, an unknown symbol or a
 *   malformed repeat.
 */
export function writeChordLine(chart: ChordChart, value: string, line: Line, beatsPerBar: number): void {
  const tokens = splitRepeated(value, (token, _barsBefore, detail) => failLine(line, `token "${token}": ${detail}`));
  if (tokens.length === 0) failLine(line, 'needs chord symbols, e.g. "chords: Dm | C | G7 | Bb"');
  let bar: string[] = [];
  for (const token of tokens) {
    if (token !== '|') bar.push(token);
    else {
      writeChordBar(chart, bar, line, beatsPerBar);
      bar = [];
    }
  }
  if (bar.length > 0) writeChordBar(chart, bar, line, beatsPerBar);
  chart.lastLine = line.number;
}

function writeChordBar(chart: ChordChart, symbols: readonly string[], line: Line, beatsPerBar: number): void {
  if (symbols.length === 0) failLine(line, 'a bar has no chord; write one symbol or more between bar lines');
  const barStart = (chart.sectionStartBar + chart.barsWritten) * beatsPerBar;
  const length = beatsPerBar / symbols.length;
  symbols.forEach((symbol, index) => {
    chart.spans.push({ start: barStart + index * length, length, symbol, ...parseChordSymbol(symbol, line) });
  });
  chart.barsWritten += 1;
}

/**
 * Checks the open section's `chords:` lines cover it exactly, then starts the next section's
 * chart at `sectionEndBar`. A section with no `chords:` line passes.
 *
 * @param where - The section as errors name it, e.g. `section "A"`.
 * @throws {Error} Naming the section and both bar counts when the chart's bars differ from the section's.
 */
export function closeChordChart(chart: ChordChart, where: string, sectionEndBar: number): void {
  const sectionBars = sectionEndBar - chart.sectionStartBar;
  if (chart.lastLine !== null && chart.barsWritten !== sectionBars) {
    throw new Error(
      `line ${chart.lastLine}: ${where} has ${sectionBars} bars but its chords: lines cover ${chart.barsWritten}; ` +
        'give every bar of the section one chord bar',
    );
  }
  chart.sectionStartBar = sectionEndBar;
  chart.barsWritten = 0;
  chart.lastLine = null;
}

function listQualities(): string {
  const named = [...QUALITIES.keys()].filter((quality) => quality !== '');
  return `${named.slice(0, -1).join(', ')} or ${named.at(-1)}`;
}
