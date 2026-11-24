/**
 * The origin rule: which pages may talk to the room service. Pure: it reads only the request's
 * headers and URL.
 */

/** Hostnames a developer's own machine serves pages from; tests and smoke runs use them. */
const LOCAL_HOSTNAMES: readonly string[] = ['localhost', '127.0.0.1'];

/**
 * Whether `request` may use the service: it has no `Origin` header (not a browser), its origin's
 * host equals the request's own host, or its origin's hostname is `localhost` or `127.0.0.1`.
 * An `Origin` that is not a URL (such as `null` from a sandboxed page) is not allowed.
 */
export function allowedOrigin(request: Request): boolean {
  const origin = request.headers.get('Origin');
  if (origin === null) return true;
  const page = parseUrl(origin);
  if (page === null) return false;
  if (LOCAL_HOSTNAMES.includes(page.hostname)) return true;
  return page.host === new URL(request.url).host;
}

/** `text` as a URL, or null when it is not one. */
function parseUrl(text: string): URL | null {
  return URL.canParse(text) ? new URL(text) : null;
}
