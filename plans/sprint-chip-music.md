# Plan: Rush Racers chip music, three race tracks per course

Skill: sprint. Profile: sprint. On resume, re-read shared/lane-dag.md before anything else.
plan_graph: /Users/riley/.claude/plugins/cache/claude-essentials/ce/6.0.4/shared/scripts/plan_graph.py
Started: 1795512032 (epoch s). Timebox: none. Landing branch: sprint/chip-music.
Gate: `pnpm arcade check rush-racers` and `pnpm arcade smoke rush-racers`. Filtered tests: `pnpm arcade test rush-racers <paths or @group>`. Typecheck: `pnpm arcade check rush-racers --skip-tests`.
Runner: plain commands.
Worktree setup: `pnpm install --frozen-lockfile --prefer-offline`.

## Spec

Each listed course of Rush Racers plays one race song today, a 20 to 28 bar loop of 25 to 45 s under a race that lasts 60 to 130 s, on a plain four-voice synth. This sprint gives each of the four worlds three race tracks of 60 to 90 s per loop that rotate from race to race, written to the practices in the research report (kept as `games/rush-racers/MUSIC.md`), and gives the synth the techniques NES and Atari composers leaned on. A sound test screen lets a person audition every track, and a symbolic analysis of each song stands in for ears in tests.

In scope:
- Notation and synth, still exactly two pulses, a triangle and noise: fast arpeggio chords on one note, echo of one pulse on the other, duty changes inside a song, per-voice detune, pitch-dropped triangle kicks and toms, an open hat, crash and noise tom, song titles, a declared key and a chord chart per section.
- Three race tracks per course set (`race`, `thornwood`, `cloudreach`, `farside`), the first being today's song extended to long form with its hook kept. Twelve tracks.
- Rotation: a course plays the next track of its set each race; `?track=<n>` pins one.
- A sound test screen at `?scene=jukebox`, reached only by that parameter.
- Song analysis (form, harmony against the chord chart, melody, mix level) and a conformance test every race track must pass.

Out of scope: title, win, lose and results music (unchanged); a fifth voice; samples; sound effects; save shape changes; menu entries for the sound test; any logic (`src/logic/`) change, so `Course.song` keeps naming a set.

Assumptions (user can override):
- `Course.song` stays as it is and names the course's set; the engine maps a set to its tracks (`RACE_TRACKS`).
- Rotation starts at the save's races-run count modulo the set size and advances once per race started in the session, per set. Online races rotate the same way on each page; pages need not agree.
- Track 1 of each set keeps the existing song name, so scenarios that pin `race` hold on a fresh save.
- Lanes in phase 1 write their own tests from the test cases in their briefs; phase 2's conformance test is written in its scaffold.
- The final-stretch tempo lift stays and applies to whichever track is playing.

Error model: the parser throws `Error` naming channel, bar, line and token for malformed notation, as today; new directives follow the same `failAt` / `failLine` helpers. Songs parse at module load, so a bad song fails tests and boot. The sequencer reports a note it cannot schedule through its `onError` and stops that song. Analysis functions are pure and throw only for a section or channel name the song does not have. A `?track=` value that is not a positive whole number logs one warning and is ignored; one past the end of a set wraps round it.

## Contracts (scaffold commit)

Types in `src/engine/audio/notation/types.ts`: `Drum`, `NoteEvent.duty`, `NoteEvent.arp`, `NoteEvent.drop`, `ChannelVoice.detune`, `ChannelVoice.arpFrames`, `ChordSpan`, `SongKey`, `Song.title`, `Song.key`, `Song.chords`. `Sequencer.play(song, fromBeat?)`. `AudioPort.audition(song, section?)`. `RACE_TRACKS` and `SongSet` in `songs/index.ts`. Stubs at every new module path.

Layout (paths under `games/rush-racers/src/engine/`):

    audio/notation/chords.ts     reads chord symbols and a section's chord chart into ChordSpans; pure
    audio/notation/key.ts        reads the `key:` header into a SongKey; pure
    audio/notation/echo.ts       expands an `echo` directive into the echoing channel's notes; pure
    audio/play-note.ts           turns one NoteEvent into synth calls at a time; shared by sequencer and render
    audio/render.ts              renders a song offline to PCM and WAV bytes
    audio/track-rotation.ts      picks the next track of a set for each race; pure
    audio/analysis/form.ts       loop length and section table of a song; pure
    audio/analysis/harmony.ts    how a channel's notes fit the chord chart and key; pure
    audio/analysis/melody.ts     lead range, rests, leaps, crossings and motif statements; pure
    audio/analysis/mix.ts        peak summed level of a song; pure
    audio/analysis/report.ts     a text report of a song for composers and reviewers; pure
    screens/jukebox.ts           sound test state: track list, cursor, what a press does; Phaser-free
    scenes/jukebox.ts            draws the sound test; wiring to the runtime only

## Phases

### Phase 1: richer synth, rotation, sound test, analysis (MVP)

Demo: `pnpm arcade dev rush-racers`, open `/games/rush-racers/?scene=jukebox`, play each song and skip between sections; `pnpm arcade see rush-racers --query scene=jukebox` shows the list.
Test cases: listed per lane below.

| Lane | Size | Owns files | Reads | Tests | Model | Status | Branch | Done when |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| a | M | games/rush-racers/src/engine/audio/notation.ts, games/rush-racers/src/engine/audio/notation.test.ts, games/rush-racers/src/engine/audio/notation/ | contracts | | opus | pending | | notation tests pass |
| b | M | games/rush-racers/src/engine/audio/synth.ts, games/rush-racers/src/engine/audio/sequencer.ts, games/rush-racers/src/engine/audio/sequencer.test.ts, games/rush-racers/src/engine/audio/play-note.ts, games/rush-racers/src/engine/audio/play-note.test.ts, games/rush-racers/src/engine/audio/render.ts, games/rush-racers/src/engine/audio/render.test.ts | contracts | | opus | pending | | play-note, sequencer and render tests pass |
| c | S | games/rush-racers/src/engine/audio/track-rotation.ts, games/rush-racers/src/engine/audio/track-rotation.test.ts, games/rush-racers/src/engine/audio/music-cues.ts, games/rush-racers/src/engine/audio/adapter.ts, games/rush-racers/src/engine/audio/adapter.test.ts, games/rush-racers/src/engine/audio/index.ts | contracts | | opus | pending | | rotation and adapter tests pass |
| d | M | games/rush-racers/src/engine/runtime.ts, games/rush-racers/src/engine/runtime.test.ts, games/rush-racers/src/engine/game.ts, games/rush-racers/src/engine/debug.ts, games/rush-racers/src/engine/scenes/jukebox.ts, games/rush-racers/src/engine/screens/jukebox.ts, games/rush-racers/src/engine/screens/jukebox.test.ts, games/rush-racers/scenarios/jukebox.ts | contracts, games/rush-racers/src/engine/scenes/course.ts, games/rush-racers/src/engine/screens/how-to-play.ts | | opus | pending | | jukebox tests and scenario pass, see capture shows the list |
| e | M | games/rush-racers/src/engine/audio/analysis/ | contracts | | opus | pending | | analysis tests pass |

#### Lane a brief

- Goal: extend the song notation so a composer can write arpeggio chords, echo, duty changes, triangle and extra noise drums, a title, a key and a chord chart. The parser stays pure and every new construct lands in the `Song` shape the scaffold defines in `notation/types.ts` (do not change that file's exported types; report if one is wrong).
- Interface: `parseSong(source): Song` as today. New parser modules already stubbed: `notation/chords.ts` (`parseChordSymbol(symbol, line): { root: number; tones: readonly number[] }`, `writeChordLine(...)` as you see fit, exported for the parser only), `notation/key.ts` (`parseKey(value, line): SongKey`), `notation/echo.ts` (`expandEcho(source: readonly NoteEvent[], request): NoteEvent[]`). Update the grammar block in `notation.ts`'s module doc: it is the composer's reference.
- Behavior:
  - `title: <text>` header sets `Song.title`; without it `title` equals `name`.
  - `key: <tonic> <mode>` header, for example `key: D dorian`, sets `Song.key` with `tonic` as a pitch class 0..11, `mode` as written and `scale` as the mode's pitch classes ascending from the tonic. Modes: major, minor, dorian, mixolydian, lydian, phrygian, harmonic-minor. Without it `key` is null. An unknown mode or tonic fails naming the line and listing the modes.
  - `chords: Dm | C | G7 | Bb` inside a section gives one chord symbol per bar; a bar may hold several symbols separated by spaces, which split the bar evenly (`Am D` is half a bar each). A section may have several `chords:` lines; together they must cover exactly the section's bar count when the section closes, else the error names the section and both counts. A section without a `chords:` line adds no spans. `[ ... ]xN` repeats work as in channel lines. Symbols are root `[A-G][#b]?` plus a quality: none (major triad), `m`, `7`, `m7`, `maj7`, `dim`, `sus2`, `sus4`, `5`, `6`, `m6`. Each becomes a `ChordSpan` with `start` and `length` in beats from the song start, `symbol` as written, `root` and `tones` as pitch classes (root first). An unknown symbol fails naming the line and the symbol.
  - Arpeggio: `C4:047/4` is a quarter note whose pitch cycles through the written note plus each offset in semitones, in order, repeating for the note's length. Offsets are hex digits `0`-`9`, `a`-`f` (10 to 15); at least two, at most six. It sets `NoteEvent.arp` to the offsets. Pitched pulse and triangle notes only; combining it with a slide is an error.
  - `voice <channel>:` gains `detune=<cents>` (-50..50, may be negative, pulse and triangle) and `arp=<frames>` (1, 2 or 3; frames of 1/60 s per arpeggio step; default left undefined, which the synth treats as 2). The existing rule that values are non-negative stays for every other setting.
  - `duty <pulse channel>: <0.125|0.25|0.5|0.75>` between channel lines sets the duty of every later note on that channel (`NoteEvent.duty`) until the next `duty` line for it; `duty pulse1: voice` returns to the voice's own duty (no `duty` on the notes). It does not carry across the end of the song's source but does carry across sections.
  - Triangle drop: the modifier `!` on a triangle note sets `NoteEvent.drop`, a pitch-dropped thump (kick on a low note, tom on a higher one). Triangle only; not with a tie, vibrato or slide.
  - Noise gains `o` (open hat, `openHat`), `c` (crash) and `t` (noise tom, `tom`) beside `k`, `s`, `h`.
  - Echo: `echo pulse2: pulse1 delay=0.75 level=0.45` inside a section makes pulse2 play pulse1's notes of that section `delay` beats later at `level` times their velocity. It replaces pulse2's channel lines in that section (having both is an error), may name either pulse as the source of the other, and is resolved when the section closes, so it may come before or after the source's lines. The echo is monophonic: each echoed note is cut where the next echoed note starts, and at the section end; a note that would start at or past the section end is dropped. Echoed notes keep pitch, arp, vibrato and slide and take no `duty` (the echoing voice's own duty applies). `delay` must be above 0 and at most 4 beats, `level` in 0..1 exclusive of 0.
  - Every existing song and test keeps parsing and passing unchanged.
- Test cases (write them in `notation.test.ts`, one test per line): each construct above parses to the stated fields; title default; chord line covering the wrong bar count fails naming section and counts; two symbols split a bar evenly; repeat syntax in chord lines; unknown symbol, mode and duty value fail naming the line; arp with one offset or seven fails; arp on noise fails; `!` on a pulse fails; duty directive carries across sections and `voice` resets it; echo copies with delay and level, truncates overlapping notes, drops notes past the section end, errors when the echoing channel also has lines, works whichever order the lines come in; negative detune parses; a drum `o`, `c`, `t` on a pitched channel fails; detune outside -50..50, detune on noise and `arp=` outside 1..3 fail; arp with a slide fails; `!` with a tie, vibrato or slide fails; an unknown key tonic fails; `duty` on triangle or noise fails; echo `delay` of 0 or above 4 and `level` of 0 or above 1 fail; an echo naming its own channel as source fails; a source with CRLF line endings, tabs between tokens and trailing spaces parses the same as the clean one; a title containing a colon is kept whole and an empty title fails.
- Decisions already made: echo expands at parse time into ordinary `NoteEvent`s so the four voices stay monophonic and the sequencer needs no echo support. Chord charts and keys are annotations for analysis and the sound test; they never change what plays.
- Out of scope: the synth and sequencer, swing, volume-envelope tables, per-note duty sweeps, any change to song files.
- Done when: `pnpm arcade test rush-racers src/engine/audio/notation.test.ts src/engine/audio/songs` passes and `pnpm arcade check rush-racers --skip-tests` passes.

#### Lane b brief

- Goal: make the synth play the new note fields, let the sequencer start from any beat, and render a song offline to a WAV so levels can be checked without speakers.
- Interface: `play-note.ts` exports `playNote(synth: Synth, out: AudioNode, song: Song, note: NoteEvent, time: number, secondsPerBeat: number): void`, moved out of `sequencer.ts`, which calls it. `Sequencer.play(song, fromBeat = 0)` starts at that beat of the first pass (cues before it are skipped; sections at or before it are not announced). `render.ts` exports `renderSong(song: Song, options: { passes: number; sampleRate?: number }): Promise<Float32Array>` (mono PCM of the intro plus `passes` passes of the loop, or the whole one-shot, plus the longest release) using `OfflineAudioContext` and `createSynth`, and `encodeWav(pcm: Float32Array, sampleRate: number): Uint8Array` (16-bit mono PCM WAV, samples clamped to -1..1). `createSynth` must accept a `BaseAudioContext`; keep `Synth.context` typed so the sequencer and `audio/index.ts` still compile (`audio/index.ts` is not yours: if its use of `synth.context.state` needs a change, report it).
- Behavior:
  - `NoteEvent.duty` overrides the voice's duty for that note.
  - `ChannelVoice.detune` (cents) detunes every tone of that voice.
  - `NoteEvent.arp`: one oscillator whose frequency steps through `pitch + offset` for each offset in order, repeating, every `arpFrames / 60` seconds (`ChannelVoice.arpFrames`, default 2), for the note's length. The step time is wall time, so the tempo lift does not change it.
  - `NoteEvent.drop` on the triangle: frequency starts two octaves above the written pitch and falls exponentially to the written pitch within 50 ms, then on to an octave below it by the note's end; the gain is a fast decay (about 120 ms to silence, shorter if the note is shorter) whatever the triangle voice's envelope says, at the voice's level times velocity.
  - Drums: add `openHat` (highpass 7 kHz, about 180 ms decay), `crash` (highpass 4 kHz, about 600 ms decay) and `tom` (lowpass sweeping 600 Hz to 150 Hz, about 150 ms) to the noise kit. Retune kick, snare and hat only if a number is plainly wrong; `sfx-pin.test.ts` pins effect sounds, not songs, and must still pass untouched.
  - `renderSong` schedules notes with `playNote` at the song's own tempo and never touches timers.
- Test cases: with a fake `Synth` that records calls, `playNote` passes duty override, detune, arp steps (count and frequencies for a 0.5 s note at 2 frames), the drop's start and end frequencies, each drum to the right kit entry, a slide and vibrato as before; a sequencer started at `fromBeat` schedules nothing earlier and still loops to the loop point (fake synth with a hand-advanced `currentTime`, fake timers); `encodeWav` writes a valid 44-byte header, the right data length and clamps out-of-range samples. `renderSong` needs a browser and has no Vitest test beyond `encodeWav`; say so in the module doc.
- Decisions already made: four voices stay monophonic per channel; no limiter or compressor on the master.
- Out of scope: the notation parser, echo (expanded by the parser), the adapter, any song file, sound effects.
- Done when: `pnpm arcade test rush-racers src/engine/audio/play-note.test.ts src/engine/audio/sequencer.test.ts src/engine/audio/render.test.ts @behavior` passes and `pnpm arcade check rush-racers --skip-tests` passes.

#### Lane c brief

- Goal: rotate a course's race tracks from race to race, and let the sound test play any song from any section.
- Interface: `track-rotation.ts` exports `createTrackRotation(options: { startAt: number; pinned: number | null }): TrackRotation` with `next(set: SongSet): SongName`, reading `RACE_TRACKS` from `songs/index.ts`. `AudioPort.audition(song: SongName | null, section?: string): void` in `audio/index.ts`, implemented through `music-cues.ts` (`MusicCues.audition`) and the adapter. `AdapterOptions.raceSong(): SongName` keeps its meaning (the track this race plays), and `music-cues.ts` must call it once per race, at `race.started`, and remember the answer for the tempo lift, since lane d makes each call's answer stable but the cue code should not depend on that.
- Behavior:
  - `next(set)` returns `RACE_TRACKS[set][(startAt + n) % length]` where `n` counts earlier `next` calls for that set (each set counts on its own). With `pinned` (0-based) it always returns `RACE_TRACKS[set][pinned % length]`.
  - `audition(name)` plays that song from its start at once, replacing whatever music plays, and announces it as `audio.played` like any song start, when sound can play. `audition(name, section)` starts at that section's first beat (`Sequencer.play(song, fromBeat)`); an unknown section name throws `Error` naming the song and its sections. `audition(null)` stops the music. An audition holds until the next audition or the next `scene.started` event, after which the usual per-screen music applies again. Section announcements keep flowing while an audition plays. A one-shot jingle auditioned ends in silence, not the results loop.
  - Nothing else about which music each screen wants changes.
- Test cases: rotation order and wrap for a three-track set; two sets count separately; `startAt` offsets the first pick; a pin always wins and wraps; adapter test that a race announces the track `raceSong()` returned at `race.started` and lifts that same track on the final stretch even if `raceSong()` would now answer differently; audition plays and announces a song, starts from a named section, stops on null, rejects an unknown section, yields to the next scene's music, and does not chain a jingle into `results`.
- Decisions already made: the rotation is session state plus the start offset; nothing is saved.
- Out of scope: `runtime.ts` (lane d builds the rotation and passes the track in), the sequencer and synth, song files.
- Done when: `pnpm arcade test rush-racers src/engine/audio/track-rotation.test.ts src/engine/audio/adapter.test.ts src/engine/audio/item-fire.test.ts src/engine/audio/move-sounds.test.ts @behavior` passes and `pnpm arcade check rush-racers --skip-tests` passes.

#### Lane d brief

- Goal: a sound test screen at `?scene=jukebox` listing every song, and the runtime wiring that makes each race play the next track of its course's set.
- Interface: `screens/jukebox.ts` holds the Phaser-free state (`createJukebox(tracks): Jukebox`, `pressJukebox(jukebox, press): JukeboxOutcome`, shapes yours to define and document); `scenes/jukebox.ts` is the Phaser scene, registered in `game.ts`; `SceneKey` gains `'jukebox'`. The runtime calls `this.audio.audition(...)` (contract in `audio/index.ts`; its body is lane c's, a stub until it merges, so drive it through a fake `AudioPort` in tests) and `createTrackRotation` from `audio/track-rotation.ts` (same). `debugSummary()` gains `jukebox` while that scene shows.
- Behavior:
  - `?scene=jukebox` leaves boot for the sound test; nothing in the menus leads there. Dash with nothing playing goes to the title.
  - The list is every song in `songs` (`audio/songs/index.ts`): the race sets in `RACE_TRACKS` order, each set's tracks in order under its set name, then the remaining songs. Each row shows the song's `title`; a detail line for the highlighted song shows its key (when it has one), tempo, meter and loop length in seconds (whole song for a one-shot). The list scrolls when it is taller than the screen; use the course select screen's layout and label helpers as the pattern, and the UI kit's existing colours.
  - Up and down move the cursor (stopping at the ends), fire plays the highlighted song from its start, left and right restart the playing song at its previous or next section (clamped), dash stops the music, and like menus the screen ignores fire for its first 20 ticks. The playing song's row is marked, and the section now sounding is shown, taken from the `audio.played` events with a `name:section` key that the runtime drains each tick.
  - `debugSummary().jukebox` is `{ selected, playing, section, tracks }`: the highlighted song's name, the playing one's or null, the last announced section or null, and the listed names in order.
  - Rotation: build one `createTrackRotation({ startAt: <the save's races-run count at boot>, pinned })` per runtime. `pinned` comes from `?track=<n>` in the page's query string (1-based in the URL, 0-based in the option); a value that is not a positive whole number logs one warning naming it and is ignored. When a race starts (every path that starts one, online included) ask `rotation.next(course.song)` once and keep the answer as the race's track; the `raceSong` closure handed to `createAudio` returns that stored track.
  - `debugSummary()` reports `track`, the race's track name, during race and results.
- Test cases: `screens/jukebox.test.ts` for cursor limits, play, stop, leave only when stopped, section stepping clamped at both ends, arm delay; `runtime.test.ts` additions for the rotation (three races on one course ask for three different tracks once the set has three, `?track=2` pins, `?track=` of `0`, `-1`, `2.5`, `abc` and empty each warn once and pin nothing, `?track=4` on a three-track set plays its first track) using whatever fakes that file already has; a scenario `scenarios/jukebox.ts` that starts at the jukebox scene, moves down, presses fire and expects `audio.played` for the highlighted song and `debugSummary().jukebox.playing` to name it.
- Decisions already made: the sound test ships in production builds but only behind the URL parameter. Rotation state lives in the runtime, never in the save.
- Out of scope: anything under `src/engine/audio/`, a menu entry, WAV export from the screen, DESIGN.md and UI.md (the orchestrator updates them).
- Done when: `pnpm arcade test rush-racers src/engine/screens/jukebox.test.ts src/engine/runtime.test.ts` passes, `pnpm arcade check rush-racers --skip-tests` passes, and you have looked at `pnpm arcade see rush-racers --query scene=jukebox` (read the frame from the `run:` folder it prints). Run the scenario with `pnpm arcade see rush-racers --scenario jukebox`; it may fail on `audition` until lane c merges, which is expected: report what it did.

#### Lane e brief

- Goal: pure functions that measure a parsed `Song` the way a reviewer with a score would, so tests can hold every race track to the composition rules and a composer can read a report of their own track.
- Interface (stubs exist; keep these names, add fields if needed and document them):
  - `analysis/form.ts`: `formOf(song): FormFacts` with `introSeconds`, `loopSeconds` (whole length for a one-shot), `loopBars`, and `sections: { name; bars; seconds; inLoop }[]`.
  - `analysis/harmony.ts`: `chordFit(song, channel, options?: { strongBeatsOnly?: boolean }): ChordFit` with `notes`, `onChord`, `inKey`, and `offenders: { bar; beat; pitch; chord }[]` (notes that are neither a chord tone nor in the key); `bassRoots(song): { bars; rootOnDownbeat; offenders }` (whether the triangle's first pitched, non-drop note of each charted bar is the chord's root).
  - `analysis/melody.ts`: `leadFacts(song): LeadFacts` with `range` (semitones), `restShare` (fraction of the loop's beats where pulse1 is silent), `longestUnbrokenBeats`, `maxLeap`, `crossings` (every pulse2 note that starts above a pulse1 note sounding at that instant, as `{ bar; beat }[]`; echoed notes get no special treatment); `motifStatements(song, motif: { fromBar; bars }, match: 'exact' | 'rhythm' | 'transposed'): number` counting statements in pulse1 across the song, the original included; `sectionSimilarity(song, a, b): number` in 0..1 comparing two sections across all four channels by onset rhythm and pitch (1 for identical, 0 for nothing shared).
  - `analysis/mix.ts`: `peakLevel(song): { level; bar; beat }`, the largest sum over channels of `voice.level * velocity` of notes sounding at the same instant, sampled at every note onset.
  - `analysis/report.ts`: `describeSong(song): string`, a plain-text report: title, key, tempo, meter, intro and loop seconds; a table of sections with bars, chords, and which channels play; per-channel chord fit and in-key percentages; lead range, rest share and largest leap; peak level; and the first ten offenders of each kind with bar and beat.
- Behavior:
  - Everything works in beats and bars of the song; bars and beats in results are 1-based for people. Arpeggio notes count each `pitch + offset` as a sounding pitch for chord fit; drop notes and drums are never pitches. A note is "on chord" when its pitch class is in the `ChordSpan` covering its start. Strong beats are the first beat of a bar and, in bars of four beats, the third.
  - A song with no chord chart has `notes` counted and `onChord` 0 with no offenders from chords; `inKey` uses `song.key` and is 0 with no key. Functions never throw for missing annotations; they throw `Error` only for a channel or section name the song lacks.
- Test cases: build small `Song` values by hand in the tests (a helper in the test file; do not depend on new parser features, which another lane is writing): loop and intro seconds for a looping song and a one-shot; chord fit counts on-chord, in-key and offenders, strong beats only, arp offsets; bass root hit and miss; range, rest share, longest unbroken run, max leap, a crossing; motif statements for exact, rhythm-only and transposed; similarity 1 for a section against itself, lower for a changed one, 0 for disjoint; peak level picks the densest instant; the report contains each heading and the offenders.
- Decisions already made: analysis reads only the `Song` type; it never imports the synth or WebAudio.
- Out of scope: thresholds (the conformance test that uses these functions is written in phase 2), any song file, the parser.
- Done when: `pnpm arcade test rush-racers src/engine/audio/analysis` passes and `pnpm arcade check rush-racers --skip-tests` passes.

### Phase 2: twelve race tracks

Demo: the sound test lists three tracks under each of the four sets; three races in a row on one course play three different tracks.
Depends on: phase 1

| Lane | Size | Owns files | Reads | Tests | Model | Status | Branch | Done when |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| a | M | games/rush-racers/src/engine/audio/songs/race.ts, games/rush-racers/src/engine/audio/songs/reef-2.ts, games/rush-racers/src/engine/audio/songs/reef-3.ts | games/rush-racers/MUSIC.md, games/rush-racers/src/engine/audio/notation.ts | games/rush-racers/src/engine/audio/songs/race-tracks.test.ts, games/rush-racers/src/engine/audio/songs/songs.test.ts | opus | pending | | Reef's three tracks pass conformance |
| b | M | games/rush-racers/src/engine/audio/songs/thornwood.ts, games/rush-racers/src/engine/audio/songs/thornwood-2.ts, games/rush-racers/src/engine/audio/songs/thornwood-3.ts | games/rush-racers/MUSIC.md, games/rush-racers/src/engine/audio/notation.ts | games/rush-racers/src/engine/audio/songs/race-tracks.test.ts, games/rush-racers/src/engine/audio/songs/songs.test.ts | opus | pending | | Thornwood's three tracks pass conformance |
| c | M | games/rush-racers/src/engine/audio/songs/cloudreach.ts, games/rush-racers/src/engine/audio/songs/cloudreach-2.ts, games/rush-racers/src/engine/audio/songs/cloudreach-3.ts | games/rush-racers/MUSIC.md, games/rush-racers/src/engine/audio/notation.ts | games/rush-racers/src/engine/audio/songs/race-tracks.test.ts, games/rush-racers/src/engine/audio/songs/songs.test.ts | opus | pending | | Cloudreach's three tracks pass conformance |
| d | M | games/rush-racers/src/engine/audio/songs/farside.ts, games/rush-racers/src/engine/audio/songs/farside-2.ts, games/rush-racers/src/engine/audio/songs/farside-3.ts | games/rush-racers/MUSIC.md, games/rush-racers/src/engine/audio/notation.ts | games/rush-racers/src/engine/audio/songs/race-tracks.test.ts, games/rush-racers/src/engine/audio/songs/songs.test.ts | opus | pending | | Farside's three tracks pass conformance |

(Test cases and briefs written during phase 1.)

### Phase 3: critique, revise and mix

Demo: `games/rush-racers/.arcade/songs/*.wav` rendered from the final tracks; every track passes conformance and the level check.
Depends on: phase 2

| Lane | Size | Owns files | Reads | Tests | Model | Status | Branch | Done when |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| a | M | games/rush-racers/src/engine/audio/songs/race.ts, games/rush-racers/src/engine/audio/songs/reef-2.ts, games/rush-racers/src/engine/audio/songs/reef-3.ts | games/rush-racers/MUSIC.md | games/rush-racers/src/engine/audio/songs/race-tracks.test.ts, games/rush-racers/src/engine/audio/songs/songs.test.ts | opus | pending | | critique findings applied, conformance passes |
| b | M | games/rush-racers/src/engine/audio/songs/thornwood.ts, games/rush-racers/src/engine/audio/songs/thornwood-2.ts, games/rush-racers/src/engine/audio/songs/thornwood-3.ts | games/rush-racers/MUSIC.md | games/rush-racers/src/engine/audio/songs/race-tracks.test.ts, games/rush-racers/src/engine/audio/songs/songs.test.ts | opus | pending | | critique findings applied, conformance passes |
| c | M | games/rush-racers/src/engine/audio/songs/cloudreach.ts, games/rush-racers/src/engine/audio/songs/cloudreach-2.ts, games/rush-racers/src/engine/audio/songs/cloudreach-3.ts | games/rush-racers/MUSIC.md | games/rush-racers/src/engine/audio/songs/race-tracks.test.ts, games/rush-racers/src/engine/audio/songs/songs.test.ts | opus | pending | | critique findings applied, conformance passes |
| d | M | games/rush-racers/src/engine/audio/songs/farside.ts, games/rush-racers/src/engine/audio/songs/farside-2.ts, games/rush-racers/src/engine/audio/songs/farside-3.ts | games/rush-racers/MUSIC.md | games/rush-racers/src/engine/audio/songs/race-tracks.test.ts, games/rush-racers/src/engine/audio/songs/songs.test.ts | opus | pending | | critique findings applied, conformance passes |

(Briefs written during phase 2. Inline work: render WAVs through the dev server and check peaks, DESIGN.md, MAP.md.)

## Log

- Grill (one round): 3 tracks per course; strict four voices plus chip techniques; sound test screen in the game; new branch, race tracks only.
- Plan critique: added the missing parser error cases, `?track=` edge cases and a clearer `crossings` rule to the briefs. Out-of-range `?track=` wraps by decision. Accepted as is: lanes b and d each carry a second small capability (offline render; rotation wiring) because both need the files those lanes own. The orchestrator adds a parse-play-analyse integration test at the phase 1 landing, since no lane spans all three.
- Research report by a background agent, kept as `games/rush-racers/MUSIC.md` from phase 2's scaffold.
