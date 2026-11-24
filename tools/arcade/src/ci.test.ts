import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { ROOT } from './games.ts';

it("runs CI smoke in the Playwright image that matches the catalog's @playwright/test", () => {
  const workspace = readFileSync(join(ROOT, 'pnpm-workspace.yaml'), 'utf8');
  const version = /"@playwright\/test":\s*"?([\d.]+)"?/.exec(workspace)?.[1];
  expect(version, '@playwright/test in the pnpm-workspace.yaml catalog').toBeDefined();
  const ci = readFileSync(join(ROOT, '.github/workflows/ci.yml'), 'utf8');
  const images = [...ci.matchAll(/mcr\.microsoft\.com\/playwright:v([\d.]+)-/g)].map((m) => m[1]);
  // A mismatched image has browser builds the installed Playwright can't launch.
  expect(images).not.toHaveLength(0);
  expect(images.every((v) => v === version) ? version : images).toBe(version);
});

it('never cancels a CI run on main, since the next run only tests what changed after it', () => {
  const ci = readFileSync(join(ROOT, '.github/workflows/ci.yml'), 'utf8');
  const group = /concurrency:\s*\n\s*group:\s*(.+)/.exec(ci)?.[1] ?? '';
  // BASE_SHA is the commit before this push, so a run that replaced an earlier push's run would
  // skip that push's changes. Each push gets its own concurrency group; PRs still replace their own.
  expect(group).toContain("github.event_name == 'push' && github.sha");
});
