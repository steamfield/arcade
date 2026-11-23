/**
 * The site Worker's whole script. The site is static assets; the only requests that reach this are
 * `/api/*` (`run_worker_first` in the root wrangler.jsonc), and they go to the API Worker unchanged,
 * WebSocket upgrades included.
 */
interface SiteEnv {
  API: Fetcher;
}

export default {
  fetch(request: Request, env: SiteEnv): Promise<Response> {
    return env.API.fetch(request);
  },
} satisfies ExportedHandler<SiteEnv>;
