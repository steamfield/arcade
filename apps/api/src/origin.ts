/**
 * The origin rule: which pages may talk to the room service.
 */

/**
 * Whether `request` may use the service: it has no `Origin` header (not a browser), its origin's
 * host equals the request's own host, or its origin's hostname is `localhost` or `127.0.0.1`.
 */
export function allowedOrigin(_request: Request): boolean {
  throw new Error('not implemented');
}
