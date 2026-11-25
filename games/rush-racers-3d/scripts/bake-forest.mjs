// Render the shipped kit once with its actual foliage shader and forest lighting.
// Usage: node games/rush-racers-3d/scripts/bake-forest.mjs
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';

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
  await page.route('**/bake.html', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<title>Forest atlas</title>' }),
  );
  await page.goto(new URL('bake.html', server.resolvedUrls.local[0]).href);
  const { image, frames } = await page.evaluate(async () =>
    (await import('/scripts/render-forest-atlas.js')).renderForestAtlas(),
  );
  const assets = new URL('../src/engine/assets/', import.meta.url);
  await writeFile(new URL('forest-cards.webp', assets), Buffer.from(image.split(',')[1], 'base64'));
  await writeFile(new URL('forest-cards.json', assets), `${JSON.stringify(frames, null, 2)}\n`);
} finally {
  await browser?.close();
  await server.close();
}
