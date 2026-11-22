import { describe, expect, it } from 'vitest';
import type { NoteEvent, Song } from '../notation.ts';
import { songs } from './index.ts';

const all = Object.entries(songs);
const race = songs.race;

function lead(song: Song): NoteEvent[] {
  return song.notes.filter((note) => note.channel === 'pulse1');
}

function pitchOf(note: NoteEvent): number {
  if (typeof note.pitch !== 'number') throw new Error(`expected a pitched note, got ${note.pitch}`);
  return note.pitch;
}

function sectionBeats(song: Song, name: string): [number, number] {
  const index = song.sections.findIndex((section) => section.name === name);
  const start = song.sections[index]?.bar;
  if (start === undefined) throw new Error(`${song.name} has no section ${name}`);
  const end = song.sections[index + 1]?.bar ?? song.lengthBeats / song.beatsPerBar;
  return [start * song.beatsPerBar, end * song.beatsPerBar];
}

function notesIn(notes: NoteEvent[], [from, to]: [number, number]): NoteEvent[] {
  return notes.filter((note) => note.start >= from && note.start < to);
}

/** The race hook: the lead's first two bars of section A, as pitches and timing relative to its start. */
const hook = (() => {
  const [from] = sectionBeats(race, 'A');
  return notesIn(lead(race), [from, from + 2 * race.beatsPerBar]).map((note) => ({
    pitch: note.pitch,
    offset: note.start - from,
    length: note.length,
  }));
})();

/** How many times the whole hook (pitches and rhythm) is stated in a song's lead. */
function hookStatements(song: Song): number {
  const notes = lead(song);
  return notes.filter((first, i) =>
    hook.every((want, j) => {
      const note = notes[i + j];
      return note?.pitch === want.pitch && note.start - first.start === want.offset && note.length === want.length;
    }),
  ).length;
}

/** Whether the lead quotes the hook's opening cell (its first four pitches' intervals) at any transposition. */
function quotesHookCell(song: Song): boolean {
  const intervals = (pitches: number[]) => pitches.slice(1).map((pitch, i) => pitch - (pitches[i] ?? pitch));
  const cell = intervals(hook.slice(0, 4).map((note) => Number(note.pitch))).join();
  const pitches = lead(song).map(pitchOf);
  return pitches.some((_, i) => intervals(pitches.slice(i, i + 4)).join() === cell);
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

describe('the soundtrack', () => {
  it.each(all)('%s parses into whole bars with every note inside the song', (name, song) => {
    expect(song.name).toBe(name);
    expect(song.lengthBeats % song.beatsPerBar).toBe(0);
    for (const note of song.notes) {
      expect(note.start, `${note.channel} note at beat ${note.start}`).toBeGreaterThanOrEqual(0);
      expect(note.start + note.length, `${note.channel} note at beat ${note.start}`).toBeLessThanOrEqual(
        song.lengthBeats,
      );
    }
    expect(new Set(song.notes.map((note) => note.channel))).toEqual(new Set(['pulse1', 'pulse2', 'triangle', 'noise']));
  });

  it.each(all)('%s keeps its lead within an octave and a half', (_name, song) => {
    const pitches = lead(song).map(pitchOf);
    expect(Math.max(...pitches) - Math.min(...pitches)).toBeLessThanOrEqual(18);
  });

  it('loops the race, title and results songs at a section, and plays the jingles once in 2-3 s', () => {
    for (const song of [songs.race, songs.title, songs.results]) {
      expect(song.loopStart, song.name).not.toBeNull();
      expect(song.sections.map((section) => section.bar * song.beatsPerBar)).toContain(song.loopStart);
    }
    for (const song of [songs.win, songs.lose]) {
      expect(song.loopStart, song.name).toBeNull();
      const seconds = (song.lengthBeats * 60) / song.bpm;
      expect(seconds, song.name).toBeGreaterThanOrEqual(2);
      expect(seconds, song.name).toBeLessThanOrEqual(3);
    }
  });

  it("builds the race theme from intro, A, A', B and turnaround, looping at A on a bar line", () => {
    expect(race.bpm).toBeGreaterThanOrEqual(130);
    expect(race.bpm).toBeLessThanOrEqual(150);
    expect(race.sections).toEqual([
      { name: 'intro', bar: 0 },
      { name: 'A', bar: 2 },
      { name: "A'", bar: 10 },
      { name: 'B', bar: 18 },
      { name: 'turnaround', bar: 26 },
    ]);
    expect(race.lengthBeats).toBe(30 * race.beatsPerBar);
    expect(race.loopStart).toBe(2 * race.beatsPerBar);
    expect(notesIn(race.notes, sectionBeats(race, 'intro')).map((note) => note.channel)).not.toContain('pulse1');
  });

  it('ends the race turnaround on the dominant, so the loop pulls back to the tonic at A', () => {
    const bass = race.notes.filter((note) => note.channel === 'triangle');
    const lastBar = race.lengthBeats - race.beatsPerBar;
    const turnaroundDownbeat = bass.find((note) => note.start === lastBar);
    const loopDownbeat = bass.find((note) => note.start === race.loopStart);
    expect(turnaroundDownbeat && pitchOf(turnaroundDownbeat) % 12).toBe(2); // D, the dominant of G
    expect(loopDownbeat && pitchOf(loopDownbeat) % 12).toBe(7); // G
  });

  it('states the race hook at least three times and brings it back slower in the title theme', () => {
    expect(hook.length).toBeGreaterThanOrEqual(8);
    expect(hookStatements(race)).toBeGreaterThanOrEqual(3);
    expect(hookStatements(songs.title)).toBeGreaterThanOrEqual(2);
    expect(songs.title.bpm).toBeLessThan(race.bpm);
  });

  it.each([['win'], ['lose'], ['results']] as const)('quotes the hook cell in the %s music', (name) => {
    expect(quotesHookCell(songs[name])).toBe(true);
  });

  it('contrasts the race B section with A: a lower lead in longer notes', () => {
    const a = notesIn(lead(race), sectionBeats(race, 'A'));
    const b = notesIn(lead(race), sectionBeats(race, 'B'));
    expect(mean(b.map(pitchOf))).toBeLessThan(mean(a.map(pitchOf)) - 2);
    expect(mean(b.map((note) => note.length))).toBeGreaterThan(1.5 * mean(a.map((note) => note.length)));
  });

  it('fills the drums in the last bar of every race section', () => {
    for (const section of race.sections) {
      const [, end] = sectionBeats(race, section.name);
      const lastBar = notesIn(
        race.notes.filter((note) => note.channel === 'noise'),
        [end - race.beatsPerBar, end],
      );
      const fill = lastBar.filter((note) => note.pitch === 'snare' && note.length <= 0.25);
      expect(fill.length, section.name).toBeGreaterThanOrEqual(2);
    }
  });
});
