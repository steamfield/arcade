import type { Page } from '@playwright/test';
import { describe, expect, it } from 'vitest';
import { GameDriver } from './driver.ts';

type Handler = (arg: never) => void;

/** The slice of Playwright's Page that GameDriver.problems() touches, recording listeners as they attach. */
function fakePage(options: { closed: boolean; evaluate: () => Promise<unknown> }) {
  const handlers = new Map<string, Handler>();
  let evaluateCalls = 0;
  const page = {
    on: (event: string, handler: Handler) => {
      handlers.set(event, handler);
    },
    isClosed: () => options.closed,
    evaluate: () => {
      evaluateCalls++;
      return options.evaluate();
    },
  };
  return {
    page: page as unknown as Page,
    emit: (event: string, arg: unknown) => handlers.get(event)?.(arg as never),
    evaluateCalls: () => evaluateCalls,
  };
}

describe('GameDriver.problems', () => {
  it('reports a failed read of the game errors instead of an empty list', async () => {
    const fake = fakePage({ closed: false, evaluate: () => Promise.reject(new Error('Execution context destroyed')) });
    const problems = await new GameDriver(fake.page, '/games/x/').problems();
    expect(problems).toEqual([
      {
        kind: 'game-error',
        message: 'could not read window.__arcade.errors: Execution context destroyed',
      },
    ]);
  });

  it('skips the read on a closed page and keeps what was already collected', async () => {
    const fake = fakePage({ closed: true, evaluate: () => Promise.reject(new Error('page closed')) });
    const driver = new GameDriver(fake.page, '/games/x/');
    fake.emit('console', { type: () => 'error', text: () => 'boom' });
    expect(await driver.problems()).toEqual([{ kind: 'console-error', message: 'boom' }]);
    expect(fake.evaluateCalls()).toBe(0);
  });
});
