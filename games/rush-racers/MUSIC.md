# Rush Racers music

How the race music is written, what every race track must meet, and the research the rules come from. Songs live in `src/engine/audio/songs/`, one file each, in the text notation documented at the top of `src/engine/audio/notation.ts`. They play on four monophonic voices: two pulses, a triangle and a noise channel.

## The soundtrack

Each course names a set (`Course.song`), and each set has three race tracks (`RACE_TRACKS` in `songs/index.ts`). A course plays the next track of its set each race. Track 1 of a set carries the world's hook; tracks 2 and 3 are their own tunes in the same world.

| Set | Track | Title | Key | Meter, tempo | Character |
| --- | --- | --- | --- | --- | --- |
| `race` (Reef) | `race` | Reef Rush | G major | 4/4, 144 | bright swimming bounce; the game's main hook, quoted by the title, win, lose and results music |
| | `reef-2` | Tidepool Hop | C major with lydian touches | 6/8, 132 | lilting and playful, round 50% lead, rolling arpeggios, light drums |
| | `reef-3` | Riptide | E minor | 4/4, 160 | the fast one: octave bass, bVI-bVII-i, a major-key release in the B section |
| `thornwood` | `thornwood` | Hollow Chase | D dorian | 6/8, 156 | a jig through the trees |
| | `thornwood-2` | Bramble Stomp | G mixolydian | 4/4, 138 | heavy-footed, tom-led kit, I-bVII, call and response between the pulses |
| | `thornwood-3` | Moth Lantern Reel | A dorian | 4/4, 172 | a quick reel, running eighths and sixteenths, drone fifths in the bass |
| `cloudreach` | `cloudreach` | Updraft | F lydian | 4/4, 132 | a lifting chase over a steady pulse |
| | `cloudreach-2` | Thermal | Bb major | 4/4, 152 | soaring long notes over fast arpeggios, bVI-bVII-I lifts |
| | `cloudreach-3` | Stormfront | D minor | 4/4, 164 | the thunderhead: urgent, a harmonic-minor dominant, crashes, a calm eye in the middle |
| `farside` | `farside` | Far Light | E lydian | 4/4, 88 | a slow float |
| | `farside-2` | Slingshot | B dorian | 4/4, 118 | a steady pulsing bass, thin 12.5% lead, long echo tails, slides |
| | `farside-3` | Event Horizon | F# minor | 4/4, 126 | uneasy: pedal bass, suspended fourths, whole-tone touches, tension that never quite resolves |

The key, meter, tempo and character of tracks 2 and 3 are a starting point. A composer may change them when the tune asks for it, as long as the set rules below hold and the file's header comment says what the track is.

## Rules for a race track

`songs/race-tracks.test.ts` measures every race track with the functions in `src/engine/audio/analysis/` and fails one that breaks a rule. Print a track's report while composing (`describeSong`, see "Working on a track"). The numbers are floors, not targets.

Form
- The loop lasts 60 to 96 seconds and the intro, outside the loop, at most 8 seconds. Every track has an intro of at least one bar.
- At least five sections inside the loop. The plan most tracks follow: intro, A (hook), A' (hook varied, fuller), B (new chords, longer notes, another duty), C or bridge (key lift, pedal bass, or the pulses trading phrases), breakdown (lead rests), turnaround (builds to the dominant or bVII and falls into A).
- No two sections in the loop are the same: every repeat changes something (octave, duty, echo on or off, counter-line, drum pattern, ending).
- At least one section contrasts strongly with the hook section.
- The last bar leads into the loop's first bar in key, meter and tempo.

Harmony
- The file declares `key:` and every section has a `chords:` chart covering each bar.
- The bass states the chord: the triangle's first pitched note of a bar is the chord's root in at least 75% of bars.
- The lead lands on chord tones: at least 70% of its strong-beat notes are tones of the chord under them. Notes that are neither a chord tone nor in the key (chromatic passing notes, blue notes) stay under 6% of the lead's notes, and under 6% of pulse 2's.
- Pulse 2 supports the harmony: at least 60% of its notes are chord tones.
- At least one borrowed chord (bVI, bVII, a secondary dominant) or a clear modal colour per track. The chart shows it.

Melody
- The hook is the lead's first two bars of the first looped section. Its first bar, at any pitch, is stated at least three times, and that bar's rhythm at least four times; the test measures the first bar so an answer phrase is free to change.
- The lead spans at most 18 semitones and rests for at least 10% of the loop. One section gives the lead a real rest.
- Pulse 2 stays under the lead: fewer than 2% of its own notes start above a sounding lead note. Echoes are not counted: an echo of a falling line always sits above the lead for a moment.

Sound
- Each track uses at least three of: arpeggio chords, a duty change, triangle drops (kick or tom), the open hat, crash or noise tom, echo. Echo and detune are the cheapest depth; use arpeggios in bursts with a short envelope, never as wall-to-wall triads.
- No voice has a flat volume: every voice has a decay or a sustain below 1, except the triangle, which the hardware could not shape.
- Levels: lead the loudest pulse (about 0.5), harmony about two thirds of it, an echo half or less, triangle 0.6 to 0.7, drums 0.3. The summed peak stays at or under 2.0.

A set
- The three tracks of a set have three different tonics, and each pair differs in meter or by at least 8 BPM.
- Tracks 2 and 3 never state track 1's hook exactly. They carry the world's motif instead: three to five notes of track 1's hook (its interval shape and rhythm) placed somewhere new, such as the bass, the counter-line or the turnaround. Say where in the header comment.
- Every track is original. Genre idioms are fine; no melody, bass line or arrangement from an existing game.

## Working on a track

A song file opens with a comment naming the track, its key, meter and tempo, its form with bar counts, its chords per section, its hook in note names, and what each voice does. Keep that comment true to the notes.

Write the chord chart first, then the bass, then the hook and its answers, then pulse 2, then drums: kick and snare skeleton first, hats last, a fill at the end of every section. Sing each phrase in your head against the bass before moving on, and check every lead note on a strong beat against the chord under it.

To read a track's report, run the conformance test for it; a failing rule prints the report:

    pnpm arcade test rush-racers src/engine/audio/songs/race-tracks.test.ts -t <track name>

To hear it: `pnpm arcade dev rush-racers`, then `/games/rush-racers/?scene=jukebox`.

To check its mix without speakers, render it: `node games/rush-racers/scripts/render-songs.ts <track name>` writes a WAV under `games/rush-racers/.arcade/songs/` and prints its peak and RMS. The synth scales the mix at its master gain so the loudest bar of a song sits just under 0.9, and soft-clips only what goes above that, so a peak over 0.9 or an RMS far from the other tracks' (about 0.2) means the voice levels need another look.

## Research notes

Research notes for hand-written, original, looping themes in the NES (2A03) and Atari (POKEY/TIA) idiom. Numbers are tagged: **[S]** comes from a cited source, **[D]** is derived arithmetic from a sourced figure, **[J]** is my judgement where the sources were thin. Source numbers refer to the list at the end. No melodies from existing games are reproduced here; game titles appear only as pointers to where a technique was documented.

How good the evidence is: hardware facts, echo, arpeggio speed and loop/form findings are well sourced. Tempo ranges for racing music, per-mood palettes and exact drum envelope values are not; the sources I could reach describe those only in general terms, so those sections are mostly [J] and should be tuned by ear.

### 1. Channel roles and arranging in four voices

**Default roles.** Pulse 1 lead, pulse 2 harmony/echo/counter-line, triangle bass an octave or more below, noise drums [S1, S2, S9]. Treat each channel as one instrument and avoid full triads: three pitched voices on a chord leaves no melody [S9].

**Implying chords with three voices.**
- Drop the fifth. A seventh chord with root, third and seventh across bass and two pulses reads as a full chord (the "famichord") [S1].
- Fast arpeggio on one channel. The engine tick is 60 Hz, so a 3-note arp at 1 frame per step cycles 20 times a second and fuses into a buzzy chord [S6]. Sources agree 1 frame per step is harsh at 60 Hz and 2 to 3 frames per step is gentler and starts to "strum" [S6, S7]; the Atari 2600 guide says one arp note per sequence step (3 to 4 frames) and that one per frame "sounds harsh" [S4].
- Constant one-direction triad arps were called lazy by NES composers. Use them in short bursts, with a decaying volume envelope, or with 4+ notes and varied order [S7]. Arps need a moderate-to-fast tempo and work poorly in slow tracks [S3].
- Historically this is a European/C64 habit; Japanese NES scores mostly used two-voice counterpoint, echo, trills and vibrato instead [S6, S8]. For a Nintendo-like sound, lean on counterpoint and echo; for a Follin/Codemasters-like sound, lean on arps.
- A slow arpeggio (eighths or sixteenths) on pulse 2 that follows the bass chords is the cheap, reliable accompaniment [S9].

**Echo.**
- Two-channel echo: pulse 2 repeats pulse 1 a fixed delay later at lower volume. A documented Sunsoft setting is one eighth note later [S3]. It costs the whole harmony channel [S3].
- Single-channel echo: re-enter the note 3 or 6 rows later in the same channel at 50 to 75% of the volume, filling the gaps in the melody [S10]. Tracker practice for multi-tap echo is roughly 63%, 50%, 38%, 25% of the dry level [S11]. Melodies with short notes and rests echo best; an odd-beat delay keeps echoes clear of the next foreground note [S4].
- A different duty and slight detune on the echo make it read as space rather than a second player [S10]. Echo leads, not bass [S11].

**Detune/chorus.** Two pulses on the same line a few cents apart thicken a lead; tracker figures are about 6 to 10 cents [S10]. Exact unison without detune phases and can cancel [S4].

**Duty.** 12.5% is thin and nasal, 25% is the standard bright lead, 50% is round and hollow; 25% and 75% sound the same, so there are three timbres [S2, S5]. Change duty per section as a free "instrument change" [S3], and per note within an envelope for attack bite (start 12.5% or 25%, settle to 50%) [S7 on duty envelopes for movement; values J].

**Volume envelopes.** One envelope step per frame, 16 levels [S5]. Starting shapes [J], adapted from tracker envelope advice in S12:
- Pluck/arp: 15, 12, 9, 7, 5, 4, 3 then hold 2 or go silent (decay inside about 100 ms).
- Lead: 2-frame attack peak, sustain about 70 to 80%, delayed vibrato on notes longer than a beat.
- Staccato bass on a pulse: full level, hard cut at 50 to 60% of the note length. A sudden volume drop sounds better than a hard cut for ending lead notes [S10].

**Triangle.** No volume control on real hardware, only on/off [S5], so articulation is all note length. Keep it in the bass register [S2]; it is the loudest voice per step in the mixer (section 7).

**Triangle kick/tom.** A triangle note dropped in pitch very fast is the standard kick and tom [S13, S12]. Sources give no exact tables, so start with [J]: kick = start about an octave above the bass note, fall 2+ octaves in 3 to 5 frames, then return to the bass note; tom = same shape over 6 to 10 frames from a higher start. Layer a 1 to 2 frame noise click on top [S14].

**Noise drums.** Kick, snare and hat share the one channel; hats can be implied or dropped where snare and kick need the slot [S1]. Recipes [J], using the 16-step period table in S15: hat = highest pitches, 1 to 2 frames; snare = mid period, sharp attack with a 6 to 10 frame decay; kick = lowest periods, 3 to 4 frames. The 93-step "short" noise mode is a metallic, pitched buzz [S15] useful for a different-sounding kit per track.

**Interleaving drums with bass.** On the 2600, percussion goes on the bass voice and the bass drops out for the hit; it is rarely noticed [S4]. One NES approach had the triangle carry both bass and drums [S1]. Rule: the kick steals the first few frames of the bass note, never the other way round.

### 2. Melody and hook writing

- Melody carries everything; the limited voices force it to the front [S3, S16].
- Build from a motif 1 to 2 bars long and repeat it over a changing bass before altering it [S17]. Reuse motifs at the rhythmic level too: keeping the rhythm and changing pitches is the cheapest variation that still sounds related [S3, S18].
- Phrase plan that works [J, following the call/response/extension/variation pattern in S17]: 2-bar call, 2-bar answer, call repeated, 2-bar new ending. 8 bars total, one clear peak note.
- Give the melody a shape (rise to a peak, or a fall) rather than wandering [S17]. Keep the lead inside about a tenth and above the harmony voice [J].
- Syncopate against a straight bass: anticipate the bar line by an eighth, tie over beat 3. Syncopated bass under a square melody also works [S13].
- Leave rests. They are where echoes, drum fills and the counter-line speak [S4, S10].
- Tempo should follow the game's motion, not a genre number; Kondo's first principle is that music matches the rhythm of movement and input [S19].
- Tempos land on whole frames per row. At 60 Hz with 4 rows per beat: 4 frames/row = 225 BPM, 5 = 180, 6 = 150, 7 = 128.6, 8 = 112.5 [D from S20]. Racing packs in the retro style list 113 to 138 BPM [S21, weak evidence]. Use 150 for standard races, 180 for the fastest course, 128.6 for laid-back worlds [J].

### 3. Harmony

- Era staples: modal mixture in major. bVI-bVII-I as the cadence in place of IV-V-I, I-bVII oscillation, and in minor bVI-bVII-i in place of iv-V-i [S22, S23]. bVII acts as a dominant substitute (keeps the 4-to-3 voice motion, no leading tone); bVI substitutes for vi or IV [S22].
- One chord per bar is a normal harmonic rhythm; bass lines that step down by whole tones under borrowed chords give the "adventure" colour; a secondary dominant (V/V) brightens the turnaround home [S23].
- Brief tonicisation of bIII, or a section moved up a minor third, is characteristic of Japanese game and pop writing [S23, S24]. A whole-step lift for a last A is the plainer alternative [J].
- Modes: Dorian (minor with major 6th) for less mournful minor; Lydian (raised 4th) for playful or floating [S25]. Pentatonic melody over diatonic bass is safe and bright [S9].
- Progressions the brief listed (i-bVII-bVI, IV-V-iii-vi) fit the same borrowed-chord vocabulary; I found no source ranking how common each was.
- Bass patterns [J, standard practice]: octave bounce in eighths for drive, root-fifth for bounce, pedal tone under changing chords for tension before a section change, walking fills in the last bar of a phrase.
- Counter-melody [J plus S9]: move when the lead holds and hold when it moves; contrary motion; stay a third or more below the lead and above the bass; switch between arpeggio accompaniment and a scalar counter-line by section [S9].

### 4. Form for 60 to 120 second loops

- Era tracks ranged from a single 4-bar loop to four-section loops; in one large NES score the longest track was 44 bars and about 70 seconds [S2]. Loops as short as 25 seconds raise urgency but become irritating [S3].
- Much of a long track can be recalled material: in the analysed score, one track was about 60% new material and another under a third [S2]. Repetition inside the loop also hides the seam, because the track is already self-similar [S18].
- Accumulative form: start with one or two channels and add the rest [S2].
- A drum-only or effects-only section near the end reduces fatigue [S4].
- Variation tools between repeats: duty change, dynamics, articulation, key, meter, pitch or rhythm tweaks [S3]; dropping or adding layers [S19].
- Seam: the loop end must flow into the loop start in key, meter and tempo [S3]. Keep the intro outside the loop [S26].

Section plan at 150 BPM, 4/4 (1 bar = 1.6 s) [J]:

| Section | Bars | What changes |
| --- | --- | --- |
| Intro (not looped) | 2 to 4 | drums + bass or a fanfare figure |
| A | 8 | hook, lead + bass + light drums |
| A' | 8 | add echo or counter-line, fuller drums, altered ending |
| B | 8 | new chords (bVI/bVII area or relative key), longer notes, different duty |
| C / bridge | 8 | key lift or pedal bass, call and response between pulses |
| Breakdown | 4 | lead rests; bass + drums or arp only |
| Turnaround | 4 | dominant or bVII build, fill, back to A |

That is 40 looped bars, about 64 s. For 100 to 120 s, replay A and B after the bridge with an octave lift or new drum pattern rather than adding new sections.

### 5. Related but distinct tracks in one world

Sourced techniques: reuse a theme with altered pitch and contour but the same rhythm and form; reuse the same timbral effects in different channels; frame the set with a theme that returns [S2]. Vary duty, tempo, key, meter and dynamics on shared motives [S3]. Judge tracks as a set, 4 or 5 together, for balance [S19].

Practical recipe [J]: one 3 to 5 note world motif (interval shape plus rhythm) appears in every track but in a different place (hook, bass, counter-line, turnaround). Keys a fourth, fifth or third apart. At least one of tempo, meter, lead duty or drum kit differs per track.

### 6. Mood palettes

Mostly [J]; the sources reached only supported the mode associations [S25, S27].

| Mood | Scale | Rhythm | Texture |
| --- | --- | --- | --- |
| Bright ocean / underwater | Major or Lydian, add6/maj7 colour | 3/4 or 6/8 lilt, or swung 4/4, slower end of range | 50% duty lead, slow rolling arps on pulse 2, long echo, deeper vibrato, sparse drums |
| Forest / jig | Dorian or Mixolydian | 6/8 or 12/8 at a quick dotted pulse, grace notes | 25% duty, drone or pedal fifths in bass, tom-led kit, call and response |
| Sky / soaring | Major with bVI-bVII lifts, Lydian touches | straight driving eighths, long held notes on top | octave-lifted lead, wide leaps up, fast arps under, key lift for last A |
| Space / drifting | Dorian, suspended fourths, whole-tone touches for unease [S27] | steady pulse, few fills, long phrases | 12.5% duty lead, slow slides, long echo tails, short-mode noise kit, pedal bass |

### 7. Mixing

- 2A03 linear mix: each pulse step 0.00752, triangle 0.00851, noise 0.00494 [S28]. So the fixed-level triangle (0.128) is louder than one pulse at maximum (0.113), and full noise (0.074) is about 58% of the triangle [D]. If the engine lets triangle velocity vary, keep it at or near full and set everything else against it.
- Starting levels [J]: lead 12 to 15 of 15, harmony/arp 7 to 10, echo 4 to 7, snare near full, hats 4 to 6.
- Keep pulse 2 out of the lead's octave when both sound: a third or sixth below, or a different duty. The same waveform at different pitches at once interferes with itself [S12].
- Bass stays low; there is no EQ, so register and duty are the only separation tools.
- Rest when a sound effect will need the channel: effects steal channels and cut melody or drums [S13]. Put the least important part on the channel effects use.

### 8. Common mistakes

1. Static sound: one duty, flat volume, no envelope. Movement in duty and volume is what stops fatigue [S7].
2. Wall-to-wall 1-frame triad arps [S7].
3. Everything at full volume, no echo level hierarchy [J].
4. No rests in the lead, so no space for echo or drums [S4, S10].
5. Loop too short, or a seam that changes key, meter or tempo [S3].
6. Exact repeats with no change of texture [S3, S19].
7. Full triads eating all three pitched voices [S9].
8. Unison pulses with no detune (phase cancellation) [S4].
9. Echo on bass [S11].
10. Porting a non-chip idea instead of writing for the four voices [S4, S7].

### Atari notes (POKEY, TIA)

POKEY: four square-wave channels with 8-bit dividers, poly-counter "distortion" used mainly for gritty bass, 16 volume levels, and audible detuning unless two channels are paired for 16-bit pitch [S29]. TIA: two voices, 32 pitches per sound type, many out of tune; composers pick from known in-tune note sets, put drums on the bass voice, and step sequences at 3 to 4 frames [S4]. To get the Atari flavour on this synth: stay near two melodic voices, use buzzy bass (12.5% pulse an octave above the triangle), coarse steps, and no vibrato.

### Composition checklist (per track)

1. Mood, mode, key, meter chosen; tempo is a whole number of frames per row (150 or 180 BPM at 6 or 5 frames).
2. World motif present in a new role.
3. Hook is 1 to 2 bars, singable, with one peak note and at least one rest per 2 bars.
4. 8-bar A phrase: call, answer, call, new ending.
5. Chords: one per bar; at least one borrowed chord (bVI or bVII) or a clear modal colour.
6. Bass pattern chosen per section (bounce, pedal, walk into the turnaround).
7. Pulse 2 role stated per section: echo, arp, counter-line or rest. Never doubles the lead in the same octave and duty.
8. Drums: kick/snare skeleton first, hats last; a fill every 4 or 8 bars; kick pre-empts bass.
9. Every repeat changes one thing: duty, octave, echo on/off, counter-line, drum pattern or key.
10. One section where the lead rests, and one breakdown or drum-led bar group before the turnaround.
11. Envelopes: no instrument has a flat volume; long lead notes get delayed vibrato.
12. Levels: lead loudest pulse, harmony about two thirds, echo about half or less; triangle full.
13. Loop is 60 to 120 s, intro outside it, last bar leads into bar 1 in key, meter and tempo.
14. Listen to three loops in a row at game volume with sound effects on. Anything annoying on loop three gets cut.
15. Originality check: hum the hook against known game themes; change it if it matches.

### Sources

- S1. Compositional strategies for PSGs with limited polyphony (famichord, channel sharing, noise kit, triangle bass+drums): https://www.ludomusicology.org/2015/07/16/compositional-strategies-for-programmable-sound-generators-with-limited-polyphony/
- S2. Cook, "8-Bit Affordances" (channel roles, duty, echo, loops, form, track relations): https://www.mtosmt.org/issues/mto.23.29.3/mto.23.29.3.cook.php
- S3. Compositional techniques of chiptune music (echo an eighth later, loop rules, variation, arps): https://www.slideshare.net/slideshow/compositional-techniques-of-chiptune-music/43688017
- S4. Slocum, Atari 2600 Music and Sound Programming Guide: https://www.qotile.net/files/2600_music_guide.txt
- S5. FamiTracker workshop handout (channel settings, duty values, effects): https://happysoul.github.io/nes/nesasm/scraper/files/famitracker-workshop-handout.pdf
- S6. NESdev wiki, Arpeggio (search summary; 60 Hz cycle rate, who used it): https://www.nesdev.org/wiki/Arpeggio
- S7. NESdev forum, "Arpeggio: 1 frame or 2?": https://nesdev.nes.science/f6/t16517.xhtml
- S8. TASVideos forum, "Why does NES music not use arpeggios?": https://tasvideos.org/Forum/Topics/12037
- S9. LANDR, How to make chiptune music: https://blog.landr.com/how-to-make-chiptune-music
- S10. Renoise forum, 90s composer tricks (single-channel echo, detune): https://forum.renoise.com/t/90s-composer-tricks-echos-etc/46181
- S11. OpenMPT resources, echoes.txt (tap volumes, delays): https://resources.openmpt.org/resources/echoes.txt
- S12. Hugi 26, "Techniques of Chipping" (envelopes, swing, mistakes): https://hugi.scene.org/online/hugi26/hugi%2026%20-%20music%20corner%20vhiiula%20techniques%20of%20chipping.htm
- S13. "Magical 8-bit" (triangle kick, noise drums, effects stealing channels): https://cooldudezone.substack.com/p/magical-8-bit
- S14. chipmusic.org kick thread (triangle + noise click layering): https://chipmusic.org/forums/post/183172
- S15. NESdev wiki, APU Noise (period table, modes): https://www.nesdev.org/wiki/APU_Noise
- S16. Game Developer, The importance of melody: https://www.gamedeveloper.com/audio/the-musical-box-20-the-importance-of-melody
- S17. Search results on motif writing (Kotaku town-theme guide, GameChops call/response example): https://kotaku.com/how-to-compose-a-great-town-theme-in-animal-crossing-n-563100960 and https://gamechops.com/vgdj/?p=6358
- S18. Ostinato and repetition in game music: https://pillowmath.github.io/musings/ostinato-repetition.html
- S19. Game Developer, Koji Kondo GDC talk (rhythm, balance, interactivity): https://www.gamedeveloper.com/game-platforms/gdc-koji-kondo-s-interactive-musical-landscapes
- S20. Battle of the Bits, FamiTracker ticks and tempo formula: https://battleofthebits.com/academy/GroupThread/43075/poop
- S21. Retro racing music pack listings (BPM figures only): https://ikonyksound.itch.io/retro-racing-old-school-racing-game-music and https://audiojungle.net/item/arcade-racing/50497152
- S22. Game Music Theory blog, April 2011 (bVI-bVII-I, substitutes): https://gamemusictheory.blogspot.com/2011/04
- S23. Splice, harmonic analysis of an NES overworld theme (borrowed chords, bass motion): https://splice.com/blog/?p=6881
- S24. Minor-third key relations in Japanese game and anime music: https://aquila.usm.edu/masters_theses/1121 and https://www.mtosmt.org/issues/mto.26.32.1/mto.26.32.1.li.pdf
- S25. ThinkSpace, modes lesson (Dorian, Lydian character): https://thinkspace.ac.uk/?p=6529
- S26. Mega Cat Studios, FamiTracker primer (loop without intro, engine limits): https://megacatstudios.com/blogs/press/creating-music-and-sound-for-nes-games
- S27. Whole-tone and octatonic scales in game music (GDC write-up): https://gamasutra.com/audio/whole-tone-and-octatonic-scales-the-game-music-of-jurassic-world-primal-ops-gdc-2023-
- S28. NESdev wiki, APU Mixer: https://www.nesdev.org/wiki/APU_Mixer
- S29. Wikipedia, POKEY: https://en.wikipedia.org/wiki/POKEY
- S30. FamiStudio docs, instruments (relative pitch envelope for bass drum): https://famistudio.org/doc/instruments/
- S31. MusicRadar, 8-bit sounds tutorial (stepped pitch modulation): https://www.musicradar.com/tutorials/music-production-tutorials/how-to-make-8-bit-video-game-sounds-in-your-daw-with-a-free-synth
- Also consulted: NES sound channel guide (ranges, duty table): https://www.oocities.org/happy_dude_2600/tech/Soundguide.html ; Battle of the Bits FamiTracker pages: https://battleofthebits.com/lyceum/View/FamiTracker+Effects+Commands and https://battleofthebits.com/lyceum/View/I+Am+New+To+NSF

Not reachable (403/404/410), so not used: vg-resource chiptune thread, GameChops Sunsoft bass tutorial, Furnace TIA doc mirror, Brame "Thematic Unity" article, djkokumo FamiTracker tutorial. S6 and S17 rest partly on search-result summaries rather than a full page read.
