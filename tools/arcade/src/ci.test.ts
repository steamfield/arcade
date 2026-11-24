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
