/**
 * The site Worker's `/api/*` script: what a page gets when the API Worker behind the service
 * binding answers, and when the binding throws. The binding is Cloudflare's, so it is faked.
 */
import { afterEach, expect, test, vi } from 'vitest';
import forward, { type SiteEnv } from '../src/forward.ts';

/** Calls the script as the Workers runtime would, with a binding whose `fetch` does `respond`. */
function forwardWith(respond: SiteEnv['API']['fetch']): Promise<Response> {
  return forward.fetch(new Request('https://arcade.example/api/rooms', { method: 'POST' }), {
    API: { fetch: respond },
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

test('passes the API Worker’s response through unchanged', async () => {
  const response = await forwardWith(async () => Response.json({ code: 'ABCD' }, { status: 201 }));

  expect([response.status, await response.json()]).toEqual([201, { code: 'ABCD' }]);
});

test('answers 503 with a message the page can show when the binding throws, and logs it once', async () => {
  const logged = vi.spyOn(console, 'error').mockImplementation(() => {});

  const response = await forwardWith(async () => {
    throw new Error('no such service: arcade-api');
  });

  expect([response.status, await response.json()]).toEqual([
    503,
    { error: 'The room service is unreachable. Try again.' },
  ]);
  expect(logged.mock.calls.map(([message]) => message)).toEqual([
    'site: forwarding POST /api/rooms to arcade-api failed',
  ]);
});
