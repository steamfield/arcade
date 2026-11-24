/**
 * Renders songs to WAV files and prints each one's loudness, so a mix can be checked without
 * speakers. It serves the game's source with Vite on a free port, opens it in headless Chromium and
 * runs the real synth offline there (`src/engine/audio/render.ts`), since WebAudio needs a browser.
 *
 *   node games/rush-racers/scripts/render-songs.ts [song ...] [--passes 1] [--out <dir>]
 *
 * With no song names it renders every race track. WAVs go to `.arcade/songs/` under the game
 * (gitignored) unless `--out` says otherwise. A peak at or above 1 means the mix clips. Runs from
 * any directory.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { RACE_TRACKS, type SongName, songs } from '../src/engine/audio/songs/index.ts';

/** What the page reports for one rendered song. */
interface Rendered {
  name: string;
  seconds: number;
  peak: number;
  rms: number;
  /** Share of samples within 1% of full scale, 0..1. */
  nearFullScale: number;
  wavBase64: string;
}

const gameRoot = fileURLToPath(new URL('..', import.meta.url));
const SAMPLE_RATE = 44_100;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { passes: { type: 'string', default: '1' }, out: { type: 'string' } },
});
const names = positionals.length > 0 ? positionals : Object.values(RACE_TRACKS).flat();
const unknown = names.filter((name) => !(name in songs));
if (unknown.length > 0) {
  console.error(`render-songs: unknown song ${unknown.join(', ')} (known: ${Object.keys(songs).join(', ')})`);
  process.exit(2);
}
const passes = Number(values.passes);
const outDir = values.out ?? join(gameRoot, '.arcade', 'songs');

/** Runs in the page: renders one song with the game's own modules and measures the samples. */
async function renderInPage(args: {
  name: string;
  passes: number;
  sampleRate: number;
  base: string;
}): Promise<Rendered> {
  const { renderSong, encodeWav } = await import(/* @vite-ignore */ `${args.base}src/engine/audio/render.ts`);
  const { songs: all } = await import(/* @vite-ignore */ `${args.base}src/engine/audio/songs/index.ts`);
  const pcm: Float32Array = await renderSong(all[args.name], { passes: args.passes, sampleRate: args.sampleRate });
  let peak = 0;
  let squares = 0;
  let near = 0;
  for (const sample of pcm) {
    const size = Math.abs(sample);
    if (size > peak) peak = size;
    if (size >= 0.99) near++;
    squares += sample * sample;
  }
  const wav: Uint8Array = encodeWav(pcm, args.sampleRate);
  let binary = '';
  for (let i = 0; i < wav.length; i += 0x8000) binary += String.fromCharCode(...wav.subarray(i, i + 0x8000));
  return {
    name: args.name,
    seconds: pcm.length / args.sampleRate,
    peak,
    rms: Math.sqrt(squares / pcm.length),
    nearFullScale: near / pcm.length,
    wavBase64: btoa(binary),
  };
}

const server = await createServer({ root: gameRoot, server: { port: 0, strictPort: false }, logLevel: 'error' });
await server.listen();
const origin = server.resolvedUrls?.local[0];
if (!origin) throw new Error('render-songs: Vite did not report a local URL');
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  // A page of the same origin with no game running: only the modules imported below load.
  await page.goto(`${origin}@vite/client`);
  mkdirSync(outDir, { recursive: true });
  console.log('song              seconds   peak    rms   near full scale');
  for (const name of names as SongName[]) {
    const result = await page.evaluate(renderInPage, { name, passes, sampleRate: SAMPLE_RATE, base: origin });
    writeFileSync(join(outDir, `${name}.wav`), Buffer.from(result.wavBase64, 'base64'));
    console.log(
      `${name.padEnd(16)} ${result.seconds.toFixed(1).padStart(8)} ${result.peak.toFixed(3).padStart(6)} ${result.rms
        .toFixed(3)
        .padStart(6)} ${(result.nearFullScale * 100).toFixed(2).padStart(8)}%`,
    );
  }
  console.log(`WAVs written to ${outDir}`);
} finally {
  await browser.close();
  await server.close();
}
