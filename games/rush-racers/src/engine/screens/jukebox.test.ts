import { describe, expect, it } from 'vitest';
import { RACE_TRACKS, songs } from '../audio/songs/index.ts';
import {
  createJukebox,
  hearJukebox,
  JUKEBOX_ARM_TICKS,
  type Jukebox,
  type JukeboxOutcome,
  type JukeboxPress,
  pressJukebox,
  selectedTrack,
  soundtrackTracks,
} from './jukebox.ts';

/** A sound test over the real soundtrack, past its arming ticks. */
function armedJukebox(): Jukebox {
  const jukebox = createJukebox(soundtrackTracks());
  for (let tick = 0; tick < JUKEBOX_ARM_TICKS; tick++) pressJukebox(jukebox, null);
  return jukebox;
}

/** Presses each of `presses` on its own tick and returns the outcomes in order. */
function pressAll(jukebox: Jukebox, presses: readonly JukeboxPress[]): JukeboxOutcome[] {
  return presses.map((press) => pressJukebox(jukebox, press));
}

/** The first race track, which has sections from its start to its turnaround. */
const firstTrack = RACE_TRACKS.race[0];
const firstSections = songs[firstTrack].sections.map((section) => section.name);

describe('the sound test list', () => {
  it('lists every race set in order, then the songs no set lists, each once', () => {
    const names = soundtrackTracks().map((track) => track.name);
    const raceNames = Object.values(RACE_TRACKS).flat();

    expect(names.slice(0, raceNames.length)).toEqual(raceNames);
    expect([...names].sort()).toEqual(Object.keys(songs).sort());
  });
});

describe('the sound test cursor', () => {
  it('moves up and down and stops at both ends', () => {
    const jukebox = armedJukebox();
    const last = jukebox.tracks.length - 1;

    pressAll(jukebox, ['up']);
    expect(jukebox.cursor).toBe(0);
    pressAll(
      jukebox,
      Array.from({ length: last + 3 }, () => 'down' as const),
    );
    expect(jukebox.cursor).toBe(last);
    pressAll(jukebox, ['up']);
    expect(jukebox.cursor).toBe(last - 1);
  });
});

describe('playing and stopping', () => {
  it('plays the highlighted song from its start on fire and marks it playing', () => {
    const jukebox = armedJukebox();
    pressAll(jukebox, ['down']);
    const highlighted = selectedTrack(jukebox).name;

    expect(pressJukebox(jukebox, 'fire')).toEqual({ kind: 'play', song: highlighted });
    expect(jukebox.playing).toBe(highlighted);
  });

  it('stops the music on dash and stays on the screen', () => {
    const jukebox = armedJukebox();
    pressAll(jukebox, ['fire']);

    expect(pressJukebox(jukebox, 'dash')).toEqual({ kind: 'stop' });
    expect(jukebox).toMatchObject({ playing: null, section: null });
  });

  it('leaves on dash only when nothing is playing', () => {
    const jukebox = armedJukebox();

    expect(pressAll(jukebox, ['fire', 'dash', 'dash'])).toEqual([
      { kind: 'play', song: firstTrack },
      { kind: 'stop' },
      { kind: 'leave' },
    ]);
  });

  it('ignores fire for its arming ticks, then takes it', () => {
    const jukebox = createJukebox(soundtrackTracks());
    const early = Array.from({ length: JUKEBOX_ARM_TICKS }, () => pressJukebox(jukebox, 'fire'));

    expect(early.every((outcome) => outcome.kind === 'stay')).toBe(true);
    expect(jukebox.playing).toBeNull();
    expect(pressJukebox(jukebox, 'fire')).toEqual({ kind: 'play', song: firstTrack });
  });
});

describe('stepping through sections', () => {
  it('restarts the playing song at the next and previous section, clamped at both ends', () => {
    const jukebox = armedJukebox();
    pressAll(jukebox, ['fire']);
    const last = firstSections.length - 1;

    const back = pressJukebox(jukebox, 'left');
    expect(back).toEqual({ kind: 'play', song: firstTrack, section: firstSections[0] });
    const forward = pressAll(
      jukebox,
      Array.from({ length: last + 2 }, () => 'right' as const),
    );
    expect(forward.map((outcome) => outcome.kind === 'play' && outcome.section)).toEqual([
      ...firstSections.slice(1),
      firstSections[last],
      firstSections[last],
    ]);
    expect(pressJukebox(jukebox, 'left')).toEqual({ kind: 'play', song: firstTrack, section: firstSections[last - 1] });
  });

  it('steps from the section the music last announced', () => {
    const jukebox = armedJukebox();
    pressAll(jukebox, ['fire']);
    hearJukebox(jukebox, `${firstTrack}:${firstSections[2]}`);
    hearJukebox(jukebox, `title:${firstSections[0]}`);

    expect(jukebox.section).toBe(firstSections[2]);
    expect(pressJukebox(jukebox, 'right')).toEqual({ kind: 'play', song: firstTrack, section: firstSections[3] });
  });

  it('shows nothing playing once a one-shot runs out, so the next dash leaves', () => {
    const jukebox = armedJukebox();
    pressAll(jukebox, ['fire']);
    hearJukebox(jukebox, `${firstTrack}:end`);

    expect(jukebox.playing).toBeNull();
    expect(jukebox.section).toBeNull();
    expect(pressJukebox(jukebox, 'dash')).toEqual({ kind: 'leave' });
  });

  it('does nothing on left or right while nothing plays', () => {
    const jukebox = armedJukebox();

    expect(pressAll(jukebox, ['left', 'right'])).toEqual([{ kind: 'stay' }, { kind: 'stay' }]);
  });
});
