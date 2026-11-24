import { gamePlaywrightConfig } from '@arcade/testing/playwright';

/**
 * The shared game config, plus the room service for the online tests. Against the dev server (the
 * default) it starts the API Worker on a free port in `ARCADE_API_PORT`, where the game's Vite
 * config proxies `/api`. Against a production build (`arcade smoke`) the site already forwards
 * `/api`, so nothing is added.
 */
export default await gamePlaywrightConfig(import.meta.url, {
  extraWebServers: [
    {
      portVar: 'ARCADE_API_PORT',
      command: (port) =>
        `pnpm exec wrangler dev --config ../../apps/api/wrangler.jsonc --port ${port} --ip 127.0.0.1 --log-level error`,
      env: { WRANGLER_SEND_METRICS: 'false' },
    },
  ],
});
