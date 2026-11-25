// Render a racer turnaround sheet with the game's own models, poses and forest lighting, so a
// character can be judged from every side without playing to it.
//
// Usage, from the repo root:
//   node games/rush-racers-3d/scripts/model-sheet.mjs cast            every racer: front, side, back, chase
//   node games/rush-racers-3d/scripts/model-sheet.mjs blaze           one racer: six angles by five poses
//   node games/rush-racers-3d/scripts/model-sheet.mjs blaze fang --out /tmp/sheets --cell 360
// Writes <out>/<name>.png (default .arcade/model-sheets/) and prints each path.
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const at = args.indexOf(`--${name}`);
  return at < 0 ? fallback : args.splice(at, 2)[1];
};
const out = resolve(option('out', fileURLToPath(new URL('../../../.arcade/model-sheets/', import.meta.url))));
const cell = Number(option('cell', 300));
const names = args.length > 0 ? args : ['cast'];

const root = fileURLToPath(new URL('../', import.meta.url));
const server = await createServer({
  root,
  configFile: false,
  server: { host: '127.0.0.1', port: 0 },
  logLevel: 'error',
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage();
  await page.route('**/sheet.html', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<title>Model sheet</title>' }),
  );
  await page.goto(new URL('sheet.html', server.resolvedUrls.local[0]).href);
  await mkdir(out, { recursive: true });
  for (const name of names) {
    const image = await page.evaluate(
      async (options) => (await import('/scripts/render-model-sheet.js')).renderModelSheet(options),
      { name, cell },
    );
    const file = resolve(out, `${name}.png`);
    await writeFile(file, Buffer.from(image.split(',')[1], 'base64'));
    console.log(file);
  }
} finally {
  await browser?.close();
  await server.close();
}
