import { describe, expect, it } from 'vitest';
import { formOf } from '../analysis/form.ts';
import { bassRoots, chordFit } from '../analysis/harmony.ts';
import { leadFacts, motifStatements, sectionSimilarity } from '../analysis/melody.ts';
import { peakLevel } from '../analysis/mix.ts';
import { describeSong } from '../analysis/report.ts';
import type { Song } from '../notation.ts';
import { RACE_TRACKS, type SongName, songs } from './index.ts';

/**
 * Holds every race track to "Rules for a race track" in `games/rush-racers/MUSIC.md`. Nobody hears
 * a track before it merges, so these measurements stand in for ears; a failure prints the track's
 * report.
 */
const sets = Object.entries(RACE_TRACKS) as [string, readonly SongName[]][];
const tracks = sets.flatMap(([, names]) => names.map((name) => [name, songs[name] as Song] as const));

/** The assertion message for `rule`, with the track's full report under it. */
function why(song: Song, rule: string): string {
  return `${song.name}: ${rule}\n\n${describeSong(song)}\n`;
}

function share(part: number, whole: number): number {
  return whole === 0 ? 0 : part / whole;
}

/** The names of the sections inside the loop, in order. */
function loopSections(song: Song): string[] {
  return formOf(song)
    .sections.filter((section) => section.inLoop)
    .map((section) => section.name);
}

/** The bar (0-based) the loop starts at, where the hook is stated first. */
function hookBar(song: Song): number {
  return (song.loopStart ?? 0) / song.beatsPerBar;
}

/** How many of the chip techniques a track uses. */
function techniques(song: Song): string[] {
  const has = (test: (note: Song['notes'][number]) => boolean) => song.notes.some(test);
  return [
    has((note) => note.arp !== undefined) ? 'arpeggio' : null,
    has((note) => note.duty !== undefined) ? 'duty change' : null,
    has((note) => note.drop === true) ? 'triangle drop' : null,
    has((note) => note.pitch === 'openHat' || note.pitch === 'crash' || note.pitch === 'tom') ? 'extra drums' : null,
    has((note) => note.echo === true) ? 'echo' : null,
  ].filter((name) => name !== null);
}

describe.each(tracks)('race track %s', (_name, song) => {
  const form = formOf(song);
  const inLoop = loopSections(song);

  it('loops for 60 to 96 seconds after an intro of at most 8', () => {
    expect(song.loopStart, why(song, 'needs a loop')).not.toBeNull();
    expect(form.loopSeconds, why(song, 'loop seconds')).toBeGreaterThanOrEqual(60);
    expect(form.loopSeconds, why(song, 'loop seconds')).toBeLessThanOrEqual(96);
    expect(form.introSeconds, why(song, 'intro seconds')).toBeGreaterThan(0);
    expect(form.introSeconds, why(song, 'intro seconds')).toBeLessThanOrEqual(8);
  });

  it('has at least five sections in the loop, none a copy of another, one in strong contrast with the hook', () => {
    expect(inLoop.length, why(song, 'sections in the loop')).toBeGreaterThanOrEqual(5);
    const pairs = inLoop.flatMap((a, i) => inLoop.slice(i + 1).map((b) => [a, b] as const));
    const copies = pairs.filter(([a, b]) => sectionSimilarity(song, a, b) >= 0.9).map(([a, b]) => `${a} = ${b}`);
    expect(copies, why(song, 'sections that repeat another without changing anything')).toEqual([]);
    const hookSection = inLoop[0] ?? '';
    const contrast = Math.min(...inLoop.slice(1).map((other) => sectionSimilarity(song, hookSection, other)));
    expect(contrast, why(song, 'similarity of the most different section to the hook section')).toBeLessThanOrEqual(
      0.4,
    );
  });

  it('declares its key and charts every bar', () => {
    expect(song.key, why(song, 'needs a key: header')).not.toBeNull();
    const charted = song.chords.reduce((beats, chord) => beats + chord.length, 0);
    expect(charted, why(song, 'beats covered by chords: lines')).toBe(song.lengthBeats);
  });

  it('states the chord in the bass and lands the lead on chord tones', () => {
    const roots = bassRoots(song);
    expect(
      share(roots.rootOnDownbeat, roots.bars),
      why(song, 'bars whose bass starts on the root'),
    ).toBeGreaterThanOrEqual(0.75);
    const strong = chordFit(song, 'pulse1', { strongBeatsOnly: true });
    expect(
      share(strong.onChord, strong.notes),
      why(song, 'strong-beat lead notes on chord tones'),
    ).toBeGreaterThanOrEqual(0.7);
    const second = chordFit(song, 'pulse2');
    expect(share(second.onChord, second.notes), why(song, 'pulse2 notes on chord tones')).toBeGreaterThanOrEqual(0.6);
  });

  it('keeps notes outside both chord and key rare', () => {
    for (const channel of ['pulse1', 'pulse2', 'triangle'] as const) {
      const fit = chordFit(song, channel);
      expect(share(fit.offenders.length, fit.notes), why(song, `${channel} notes outside chord and key`)).toBeLessThan(
        0.06,
      );
    }
  });

  it('states its hook: the first bar three times at some pitch, its rhythm four times', () => {
    const motif = { fromBar: hookBar(song), bars: 1 };
    expect(motifStatements(song, motif, 'transposed'), why(song, 'statements of the hook bar')).toBeGreaterThanOrEqual(
      3,
    );
    expect(motifStatements(song, motif, 'rhythm'), why(song, 'statements of the hook rhythm')).toBeGreaterThanOrEqual(
      4,
    );
  });

  it('gives the lead a singable range, rests, and the top line', () => {
    const lead = leadFacts(song);
    expect(lead.range, why(song, 'lead range in semitones')).toBeLessThanOrEqual(18);
    expect(lead.restShare, why(song, 'share of the loop where the lead rests')).toBeGreaterThanOrEqual(0.1);
    const secondNotes = song.notes.filter((note) => note.channel === 'pulse2' && !note.echo).length;
    expect(
      share(lead.crossings.length, secondNotes),
      why(song, 'pulse2 notes of its own (echoes aside) above the lead'),
    ).toBeLessThan(0.02);
  });

  it('uses at least three chip techniques and shapes its pulses', () => {
    expect(
      techniques(song).length,
      why(song, `techniques used: ${techniques(song).join(', ') || 'none'}`),
    ).toBeGreaterThanOrEqual(3);
    for (const channel of ['pulse1', 'pulse2'] as const) {
      const { envelope } = song.voices[channel];
      expect(envelope.sustain < 1 && envelope.decay > 0, why(song, `${channel} has a flat volume`)).toBe(true);
    }
    expect(peakLevel(song).level, why(song, 'summed peak level')).toBeLessThanOrEqual(2);
  });
});

describe.each(sets)('the %s set', (_set, names) => {
  const members = names.map((name) => songs[name] as Song);
  const pairs = members.flatMap((a, i) => members.slice(i + 1).map((b) => [a, b] as const));

  it('has three tracks in three keys, each pair in another meter or at least 8 BPM apart', () => {
    expect(members).toHaveLength(3);
    expect(new Set(members.map((song) => song.key?.tonic)).size).toBe(3);
    for (const [a, b] of pairs) {
      const apart = a.meter !== b.meter || Math.abs(a.bpm - b.bpm) >= 8;
      expect(apart, `${a.name} and ${b.name} share a meter and sit within 8 BPM`).toBe(true);
    }
  });

  it('keeps the hook of track 1 out of tracks 2 and 3', () => {
    const [first, ...rest] = members;
    if (!first) throw new Error('the set is empty');
    const from = hookBar(first) * first.beatsPerBar;
    const hook = first.notes.filter(
      (note) => note.channel === 'pulse1' && note.start >= from && note.start < from + 2 * first.beatsPerBar,
    );
    const shape = hook.map((note) => `${note.pitch}@${note.start - from}`).join(' ');
    for (const other of rest) {
      const lead = other.notes.filter((note) => note.channel === 'pulse1' && typeof note.pitch === 'number');
      const quoted = lead.some((start, i) => {
        const window = lead.slice(i, i + hook.length);
        return window.map((note) => `${note.pitch}@${note.start - start.start}`).join(' ') === shape;
      });
      expect(quoted, `${other.name} states the hook of ${first.name} note for note`).toBe(false);
    }
  });
});
