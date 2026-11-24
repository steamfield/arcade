import { describe, expect, it } from 'vitest';
import { run } from './run.ts';

describe('running a subprocess', () => {
  it('captures output and exit code', async () => {
    const result = await run('node', ['-e', "console.log('hi')"]);
    expect(result.code).toBe(0);
    expect(result.output).toContain('hi');
  });

  it('resolves code 1 naming the command when the binary does not exist', async () => {
    const result = await run('arcade-no-such-binary', []);
    expect(result.code).toBe(1);
    expect(result.output).toContain('arcade-no-such-binary');
  });
});
