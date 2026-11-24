/**
 * The site Worker's whole script. The site is static assets; the only requests that reach this are
 * `/api/*` (`run_worker_first` in the root wrangler.jsonc), and they go to the API Worker unchanged,
 * WebSocket upgrades included. When the API Worker can't be reached, the page gets a 503 it can
 * show instead of Cloudflare's error page.
 */

/**
 * The site Worker's bindings: `API` is the service binding to `arcade-api`. Typed by the one method
 * used, rather than the runtime's `Fetcher`, so the Node-typed tests can import this file.
 */
export interface SiteEnv {
  API: { fetch(request: Request): Promise<Response> };
}

/** What a page gets when the service binding throws. */
export const UNREACHABLE_ERROR = 'The room service is unreachable. Try again.';

export default {
  async fetch(request: Request, env: SiteEnv): Promise<Response> {
    try {
      return await env.API.fetch(request);
    } catch (error) {
      console.error(`site: forwarding ${request.method} ${new URL(request.url).pathname} to arcade-api failed`, error);
      return Response.json({ error: UNREACHABLE_ERROR }, { status: 503 });
    }
  },
};
