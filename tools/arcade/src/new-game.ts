import { cpSync, existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { listGames, ROOT, UsageError } from './games.ts';
import { run } from './run.ts';

/** Copy a template into games/<slug> as a draft, ready to run and pass checks. */
export async function newGame(slug: string, options: { template: string; title?: string }): Promise<number> {
  if (!/^[a-z][a-z0-9-]*$/.test(slug)) throw new UsageError('slug must be lowercase kebab-case, e.g. "star-hopper"');
  const template = listGames().find((g) => g.kind === 'template' && g.slug === options.template);
  if (!template) {
    const names = listGames()
      .filter((g) => g.kind === 'template')
      .map((g) => g.slug);
    throw new UsageError(`No template "${options.template}". Templates: ${names.join(', ')}`);
  }
  if (listGames().some((g) => g.slug === slug || g.manifest.id === slug)) {
    throw new UsageError(`A game with slug or id "${slug}" already exists`);
  }
  const dir = join(ROOT, 'games', slug);
  if (existsSync(dir)) throw new UsageError(`games/${slug} already exists`);

  cpSync(template.dir, dir, {
    recursive: true,
    filter: (src) => !/[/\\](node_modules|dist|test-results|\.turbo)([/\\]|$)/.test(src),
  });
  const title = options.title ?? slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  const manifestPath = join(dir, 'game.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  Object.assign(manifest, { id: slug, slug, title, pitch: `TODO: one-line pitch for ${title}.`, status: 'draft' });
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  const pkgPath = join(dir, 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  pkg.name = `game-${slug}`;
  writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
  const designPath = join(dir, 'DESIGN.md');
  if (existsSync(designPath)) {
    writeFileSync(designPath, readFileSync(designPath, 'utf8').replace(/^# .*$/m, `# ${title}`));
  }

  registerLaunchConfig(slug);
  await run('pnpm', ['exec', 'biome', 'format', '--write', dir]);
  const install = await run('pnpm', ['install']);
  if (install.code !== 0) {
    console.log(install.output);
    return 1;
  }
  const scenarios = readdirSync(join(dir, 'scenarios'))
    .filter((f) => f.endsWith('.ts') && f !== 'kit.ts')
    .map((f) => f.replace(/\.ts$/, ''));
  console.log(
    [
      `Created games/${slug} from ${options.template} (status: draft).`,
      'Next:',
      `  pnpm arcade dev ${slug}        # play it`,
      `  pnpm arcade check ${slug}      # typecheck, lint, unit tests`,
      `  pnpm arcade see ${slug} --scenario ${scenarios[0] ?? '<name>'}   # scenarios: ${scenarios.join(', ')}`,
      `Then edit games/${slug}/DESIGN.md and game.json (pitch), and replace the template's gameplay.`,
    ].join('\n'),
  );
  return 0;
}

/** Add the game to .claude/launch.json so the desktop app's browser pane can start its dev server. */
function registerLaunchConfig(slug: string): void {
  const path = join(ROOT, '.claude', 'launch.json');
  if (!existsSync(path)) return;
  const launch = JSON.parse(readFileSync(path, 'utf8')) as {
    configurations: { name: string; runtimeExecutable: string; runtimeArgs: string[]; port: number }[];
  };
  if (launch.configurations.some((c) => c.name === slug)) return;
  const port = Math.max(5180, ...launch.configurations.map((c) => c.port)) + 1;
  launch.configurations.push({
    name: slug,
    runtimeExecutable: 'pnpm',
    runtimeArgs: ['arcade', 'dev', slug, '--port', String(port)],
    port,
  });
  writeFileSync(path, `${JSON.stringify(launch, null, 2)}\n`);
}
