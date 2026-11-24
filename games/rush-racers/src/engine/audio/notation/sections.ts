/**
 * The open section: collects its `echo` directives and, when it closes, lines the channels up,
 * checks its chord chart covers it, and writes its echoes into the echoing channels.
 */
import { closeSection, describeSection, type Track } from './bars.ts';
import { type ChordChart, closeChordChart } from './chords.ts';
import { type EchoDirective, expandEcho } from './echo.ts';
import { failLine } from './errors.ts';
import type { Channel } from './types.ts';

/** Everything a section close reads and writes. */
export interface OpenSection {
  tracks: Record<Channel, Track>;
  chart: ChordChart;
  /** The open section's `echo` directives, resolved when it closes. */
  echoes: EchoDirective[];
  beatsPerBar: number;
}

/**
 * Adds an `echo` directive to the open section.
 *
 * @throws {Error} Naming the line when the channel already echoes in this section, or when the
 *   two pulses would echo each other.
 */
export function addEcho(section: OpenSection, echo: EchoDirective): void {
  if (section.echoes.some((other) => other.channel === echo.channel)) {
    failLine(echo.line, `${echo.channel} already echoes in this section; keep one echo line per channel`);
  }
  if (section.echoes.some((other) => other.channel === echo.source)) {
    failLine(echo.line, `${echo.source} is itself an echo in this section, so it has no notes of its own to echo`);
  }
  section.echoes.push(echo);
}

/**
 * Closes the open section and returns the bar the next one starts at.
 *
 * @throws {Error} When an echoing channel also has its own lines, when the chord chart doesn't
 *   cover the section, or for any error `closeSection` raises.
 */
export function closeOpenSection(section: OpenSection, sectionName: string | undefined): number {
  const where = describeSection(sectionName);
  for (const echo of section.echoes) {
    if (section.tracks[echo.channel].playedInSection) {
      failLine(echo.line, `${echo.channel} has its own lines in ${where}; an echo replaces them, so keep one`);
    }
  }
  const tracks = Object.values(section.tracks);
  const startBeat = section.chart.sectionStartBar * section.beatsPerBar;
  const endBar = closeSection(tracks, sectionName);
  closeChordChart(section.chart, where, endBar);
  writeEchoes(section, startBeat, endBar * section.beatsPerBar);
  return endBar;
}

function writeEchoes(section: OpenSection, startBeat: number, endBeat: number): void {
  for (const { channel, source, delay, level } of section.echoes) {
    const sourceNotes = section.tracks[source].events.filter((note) => note.start >= startBeat);
    section.tracks[channel].events.push(...expandEcho(sourceNotes, { channel, delay, level, sectionEnd: endBeat }));
  }
  section.echoes = [];
}
