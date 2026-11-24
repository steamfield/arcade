import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { type GameInfo, listGames, UsageError } from './games.ts';
import { run } from './run.ts';

/**
 * Files that change how every game builds, serves or is tested without being part of any
 * workspace package turbo can trace: the CI workflow, the arcade CLI, root config, the landing
 * site and Worker that every smoke run serves. A change to one of them tests everything.
 */
const GLOBAL = [
  '.github/',
  'tools/',
  'apps/site/',
  'package.json',
  'pnpm-workspace.yaml',
  'turbo.json',
  'tsconfig.json',
  '.nvmrc',
  'wrangler.jsonc',
];

/** A slow suite a game runs outside `check`, in CI shards: package.json `"arcade": { "ci": { "slow": ... } }`. */
export interface SlowSuite {
  /** package.json script, run as `pnpm --filter <pkg> <script> --shard=i/n`. */
  script: string;
  shards: number;
}

export interface SlowShard {
  game: string;
  pkg: string;
  script: string;
  shard: number;
  shards: number;
}

export interface Plan {
  /** True when everything must be tested: a global file changed, or there is no usable base. */
  all: boolean;
  reason: string;
  /** Workspace packages to typecheck and unit test: changed ones and their dependents. */
  packages: string[];
  /** Games and templates to smoke test. */
  games: GameInfo[];
}

/**
 * What a change since a base commit needs tested. `changedFiles` are repo-relative paths;
 * `affectedPackages` is turbo's list of changed packages and their dependents.
 */
export function planFromChanges(changedFiles: string[], affectedPackages: string[], games: GameInfo[]): Plan {
  const global = changedFiles.find((f) => GLOBAL.some((g) => (g.endsWith('/') ? f.startsWith(g) : f === g)));
  if (global) return everything(games, `${global} changed`);
  const packages = new Set(affectedPackages);
  const hit = games.filter((g) => packages.has(g.pkg));
  return {
    all: false,
    reason: `${changedFiles.length} file(s) changed, ${packages.size} package(s) affected`,
    packages: [...packages].sort(),
    games: hit,
  };
}

function everything(games: GameInfo[], reason: string): Plan {
  return { all: true, reason, packages: [], games };
}

/** Each affected game's slow suite, one entry per shard, for a CI matrix. */
export function slowShards(games: GameInfo[], suiteOf: (game: GameInfo) => SlowSuite | undefined): SlowShard[] {
  return games.flatMap((game) => {
    const suite = suiteOf(game);
    if (!suite) return [];
    return Array.from({ length: suite.shards }, (_, i) => ({
      game: game.slug,
      pkg: game.pkg,
      script: suite.script,
      shard: i + 1,
      shards: suite.shards,
    }));
  });
}

export function readSlowSuite(game: GameInfo): SlowSuite | undefined {
  const pkg = JSON.parse(readFileSync(join(game.dir, 'package.json'), 'utf8')) as {
    arcade?: { ci?: { slow?: SlowSuite } };
  };
  return pkg.arcade?.ci?.slow;
}

/** The plan for everything committed since `base` (a commit, branch or tag). */
export async function affectedSince(base: string | undefined): Promise<Plan> {
  const games = listGames();
  // A new branch's first push has no "before" commit (all zeros), and a force push may name one
  // this clone doesn't have. Neither leaves anything to diff against, so test everything.
  if (!base || /^0+$/.test(base)) return everything(games, 'no base commit to compare against');
  if ((await run('git', ['cat-file', '-e', `${base}^{commit}`])).code !== 0)
    return everything(games, `base ${base} is not in this clone`);

  const diff = await run('git', ['diff', '--name-only', `${base}...HEAD`]);
  if (diff.code !== 0) throw new UsageError(`git diff against ${base} failed:\n${diff.output}`);
  const changed = diff.output.split('\n').filter(Boolean);

  const ls = await run('pnpm', ['exec', 'turbo', 'ls', `--filter=...[${base}...HEAD]`, '--output=json']);
  if (ls.code !== 0) throw new UsageError(`turbo ls failed:\n${ls.output}`);
  const json = ls.output.slice(ls.output.indexOf('{'));
  const items = (JSON.parse(json) as { packages: { items: { name: string }[] } }).packages.items;
  return planFromChanges(
    changed,
    items.map((i) => i.name),
    games,
  );
}

/** `arcade affected`: print the plan, or with --json the shape CI reads for its job matrices. */
export async function affected(base: string | undefined, options: { json: boolean }): Promise<number> {
  const plan = await affectedSince(base);
  const slugs = plan.games.map((g) => g.slug);
  if (options.json) {
    console.log(
      JSON.stringify({
        all: plan.all,
        reason: plan.reason,
        packages: plan.packages,
        games: slugs,
        slow: slowShards(plan.games, readSlowSuite),
      }),
    );
    return 0;
  }
  console.log(`${plan.all ? 'everything' : 'affected only'}: ${plan.reason}`);
  if (!plan.all) console.log(`packages: ${plan.packages.join(', ') || '(none)'}`);
  console.log(`games: ${slugs.join(', ') || '(none)'}`);
  return 0;
}
