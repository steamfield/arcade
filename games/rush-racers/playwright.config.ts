import { createServer } from 'node:net';
import { gamePlaywrightConfig } from '@arcade/testing/playwright';

/**
 * The shared game config, plus the room service for the online tests. Against the dev server (the
 * default) it starts the API Worker on a free port and tells Vite to proxy `/api` there. Against a
 * production build (`arcade smoke`) the site already forwards `/api`, so nothing is added.
 */
const config = await gamePlaywrightConfig(import.meta.url);

// Workers re-evaluate this file, so the port is chosen once and passed down through the environment.
process.env.ARCADE_API_PORT ??= String(await freePort());

const apiServer = {
  command: `pnpm exec wrangler dev --config ../../apps/api/wrangler.jsonc --port ${process.env.ARCADE_API_PORT} --ip 127.0.0.1 --log-level error`,
  env: { WRANGLER_SEND_METRICS: 'false' },
  port: Number(process.env.ARCADE_API_PORT),
  reuseExistingServer: false,
  stdout: 'ignore' as const,
  stderr: 'pipe' as const,
};

export default {
  ...config,
  webServer: config.webServer && !Array.isArray(config.webServer) ? [apiServer, config.webServer] : config.webServer,
};

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() =>
        typeof address === 'object' && address ? resolve(address.port) : reject(new Error('no port')),
      );
    });
  });
}
