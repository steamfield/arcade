/**
 * A plain-text report of a song for composers and reviewers: form, chords, fit, lead and level.
 */
import type { Channel, Song } from '../notation.ts';
import { formOf } from './form.ts';
import { bassRoots, chordFit, type Offender } from './harmony.ts';
import { leadFacts } from './melody.ts';
import { peakLevel } from './mix.ts';
import { pitchClassOf } from './sounding.ts';
import { type BarBeat, inSpan, sectionSpans } from './timeline.ts';

const CHANNELS: readonly Channel[] = ['pulse1', 'pulse2', 'triangle', 'noise'];
const PITCHED_CHANNELS: readonly Channel[] = ['pulse1', 'pulse2', 'triangle'];
const PITCH_NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const OFFENDERS_SHOWN = 10;
const INDENT = '  ';
const NONE = '-';

/** One kind of offender, as lines already formatted. */
interface OffenderList {
  label: string;
  lines: string[];
}

function noteName(pitch: number): string {
  const octave = Math.floor(pitch / 12) - 1;
  return `${PITCH_NAMES[pitchClassOf(pitch)]}${octave}`;
}

function percent(part: number, whole: number): string {
  return whole === 0 ? NONE : `${Math.round((100 * part) / whole)}%`;
}

function at(position: BarBeat): string {
  return `bar ${position.bar} beat ${position.beat}`;
}

/** Rows padded into left-aligned columns. */
function table(rows: string[][]): string[] {
  const widths = rows[0]?.map((_, column) => Math.max(...rows.map((row) => row[column]?.length ?? 0))) ?? [];
  return rows.map(
    (row) =>
      INDENT +
      row
        .map((cell, column) => cell.padEnd(widths[column] ?? 0))
        .join('  ')
        .trimEnd(),
  );
}

function headerLines(song: Song): string[] {
  const form = formOf(song);
  const key = song.key ? `${PITCH_NAMES[song.key.tonic]} ${song.key.mode}` : 'none';
  return [
    song.title,
    `Key ${key}, ${song.bpm} bpm, ${song.beatsPerBar}/4`,
    `Intro ${form.introSeconds.toFixed(1)} s, loop ${form.loopSeconds.toFixed(1)} s (${form.loopBars} bars)`,
  ];
}

function sectionLines(song: Song): string[] {
  const facts = formOf(song).sections;
  const rows = sectionSpans(song).map((span, index) => {
    const chords = song.chords.filter((chord) => inSpan(chord.start, span)).map((chord) => chord.symbol);
    const playing = CHANNELS.filter((channel) =>
      song.notes.some((note) => note.channel === channel && inSpan(note.start, span)),
    );
    const fact = facts[index];
    return [
      span.name,
      String(fact?.bars ?? 0),
      `${(fact?.seconds ?? 0).toFixed(1)} s`,
      fact?.inLoop ? 'yes' : 'no',
      chords.join(' ') || NONE,
      playing.join(', ') || NONE,
    ];
  });
  if (rows.length === 0) return ['Sections', `${INDENT}none`];
  return ['Sections', ...table([['name', 'bars', 'length', 'loop', 'chords', 'channels'], ...rows])];
}

function fitLines(song: Song): string[] {
  const rows = PITCHED_CHANNELS.map((channel) => {
    const fit = chordFit(song, channel);
    return [
      channel,
      `${fit.notes} notes`,
      `${percent(fit.onChord, fit.notes)} on chord`,
      `${percent(fit.inKey, fit.notes)} in key`,
    ];
  });
  const roots = bassRoots(song);
  return ['Chord fit', ...table(rows), `${INDENT}Bass roots ${roots.rootOnDownbeat} of ${roots.bars} bars`];
}

function leadLines(song: Song): string[] {
  const lead = leadFacts(song);
  return [
    'Lead',
    `${INDENT}Range ${lead.range} semitones, rests ${percent(lead.restShare, 1)}, longest run ${lead.longestUnbrokenBeats} beats, largest leap ${lead.maxLeap} semitones`,
    `${INDENT}Crossings ${lead.crossings.length}`,
  ];
}

function mixLines(song: Song): string[] {
  const peak = peakLevel(song);
  return ['Mix', `${INDENT}Peak level ${peak.level.toFixed(2)} at ${at(peak)}`];
}

function pitchOffenderLines(label: string, offenders: Offender[]): OffenderList {
  return {
    label,
    lines: offenders.map(
      (offender) => `${label} ${at(offender)}: ${noteName(offender.pitch)} over ${offender.chord ?? NONE}`,
    ),
  };
}

/** Every kind of offender the report lists: chord fit per channel, bass roots and crossings. */
function offenderLists(song: Song): OffenderList[] {
  return [
    ...PITCHED_CHANNELS.map((channel) => pitchOffenderLines(channel, chordFit(song, channel).offenders)),
    pitchOffenderLines('bass root', bassRoots(song).offenders),
    { label: 'crossing', lines: leadFacts(song).crossings.map((position) => `crossing ${at(position)}`) },
  ];
}

function offenderLines(song: Song): string[] {
  const lines = offenderLists(song).flatMap(({ label, lines: all }) => {
    const shown = all.slice(0, OFFENDERS_SHOWN).map((text) => INDENT + text);
    const hidden = all.length - shown.length;
    return hidden > 0 ? [...shown, `${INDENT}and ${hidden} more ${label}`] : shown;
  });
  return ['Offenders', ...(lines.length > 0 ? lines : [`${INDENT}none`])];
}

/** The report for `song`: one block per heading, separated by blank lines. */
export function describeSong(song: Song): string {
  const blocks = [
    headerLines(song),
    sectionLines(song),
    fitLines(song),
    leadLines(song),
    mixLines(song),
    offenderLines(song),
  ];
  return blocks.map((block) => block.join('\n')).join('\n\n');
}
