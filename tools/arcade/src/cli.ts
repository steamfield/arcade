#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { parseArgs } from 'node:util';
import { affected } from './affected.ts';
import { assemble, type Include, includeForBranch } from './assemble.ts';
import { attract } from './attract.ts';
import { check } from './check.ts';
import { findGame, listGames, UsageError } from './games.ts';
import { newGame } from './new-game.ts';
import { see } from './see.ts';
import { smoke } from './smoke.ts';
import { testGame } from './test.ts';

const HELP = `arcade: build, check and see games in this repo

  pnpm arcade check [slug] [--all] [--skip-tests] [--base <ref>]
      Typecheck, lint and unit tests. With a slug: that game plus every package changed since
      HEAD and all their dependents. Prints one line when everything passes. The full run is
      the pre-merge gate; --skip-tests gives typecheck and lint alone while you prove a change
      with arcade test. --base <ref> checks what changed since that commit (CI).

  pnpm arcade affected --base <ref> [--json]
      Which packages and games the commits since <ref> need tested: changed packages and their
      dependents, or everything when CI, the CLI or root config changed. --json adds each
      game's slow-suite shards (package.json "arcade": { "ci": { "slow": ... } }) for CI.

  pnpm arcade test <slug> [paths... | @group...] [-t <name pattern>] [--project <name>]
      Only the game's Vitest tests, narrowed to files, folders, named groups or a test name. This
      is how an agent proves its change; the full check and smoke run once, before a merge.
      Runs the game's fast project (the one its package.json "test" script names) unless you pass
      explicit test files or --project <name> (e.g. a slow project).
      Paths may be repo- or game-relative; groups come from the game's package.json
      ("arcade": { "testGroups": { ... } }), and an unknown group lists the defined ones.

  pnpm arcade see <slug> [options]
      Run the game headlessly to an exact state and capture it. Writes a run folder (its absolute
      path is the summary's first line, "run:"): frame-<tick>.png (frames.png contact sheet for
      several), state.json, events.jsonl, console.log, summary.txt. Prints the summary.
        --scenario <name>   play scenarios/<name>.ts and check its expectations
        --input "<steps>"   right*30 = hold 30 ticks, jump = tap, right+jump*10 = chord, _*20 = wait
        --at 0,30,end       capture at these ticks (default: end); ticks past the input wait idle
        --seed <n>  --scene <name>  --debug  --mobile (phone viewport + touch controls)
        --viewport WxH      desktop window size (default 960x540), e.g. 1280x800 to catch letterboxing
        --query k=v         extra launch parameter, repeatable (e.g. --query stage=guide)
        --ascii             print the tile map as text (games that expose debugState().ascii)
        --field <path>      print one value from debugState(), e.g. --field world.player
        --events <type>     list events with their ticks ("all", or a prefix like "player")
        --crop x,y,w,h      zoom the captured frames into a region
        --out <dir>         write the run to <dir> (kept; .arcade/runs keeps only the last 50)
        --compare <dir>     diff each frame against <dir>/frame-<tick>.png; writes diff-<tick>.png

  pnpm arcade smoke [slug]
      Production build, assemble into dist/, serve with wrangler dev, run each game's Playwright
      suite (desktop, mobile, WebKit) against it. Run before handing work back.

  pnpm arcade dev <slug> [--port n]      Vite dev server for one game (prints the URL)
  pnpm arcade new <slug> --template <phaser-2d|three-3d> [--title "Name"]
  pnpm arcade assemble [--include published|preview|all|branch]
      branch: published on main, preview elsewhere, from WORKERS_CI_BRANCH (Cloudflare Workers Builds)
  pnpm arcade attract <slug>             Record the landing page's gameplay loop and cover into the game's
                                         public/ (settings in its package.json "arcade.attract"; needs ffmpeg)
  pnpm arcade list                       Games and templates with their status

Examples:
  pnpm arcade see phaser-2d --scenario complete-level --at 0,180,end
  pnpm arcade see phaser-2d --scene play --input "right*120 jump right*40" --ascii
  pnpm arcade see three-3d --input "forward*50" --mobile`;

async function main(argv: string[]): Promise<number> {
  const [command, ...rest] = argv;
  const { values, positionals } = parseArgs({
    args: rest,
    allowPositionals: true,
    options: {
      all: { type: 'boolean', default: false },
      base: { type: 'string' },
      json: { type: 'boolean', default: false },
      'skip-tests': { type: 'boolean', default: false },
      scenario: { type: 'string' },
      input: { type: 'string' },
      at: { type: 'string' },
      seed: { type: 'string' },
      scene: { type: 'string' },
      query: { type: 'string', multiple: true },
      out: { type: 'string' },
      compare: { type: 'string' },
      'test-name': { type: 'string', short: 't' },
      project: { type: 'string' },
      debug: { type: 'boolean', default: false },
      mobile: { type: 'boolean', default: false },
      viewport: { type: 'string' },
      ascii: { type: 'boolean', default: false },
      field: { type: 'string' },
      crop: { type: 'string' },
      events: { type: 'string' },
      template: { type: 'string' },
      title: { type: 'string' },
      include: { type: 'string', default: 'published' },
      port: { type: 'string' },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  const slug = positionals[0];
  if (!command || values.help || command === 'help') {
    console.log(HELP);
    return 0;
  }
  const requireSlug = () => {
    if (!slug) throw new UsageError(`"arcade ${command}" needs a game slug. Run "pnpm arcade list" to see them.`);
    return slug;
  };

  switch (command) {
    case 'check':
      return check(slug, { all: values.all, skipTests: values['skip-tests'], base: values.base });
    case 'affected':
      if (values.base === undefined) throw new UsageError('arcade affected needs --base <ref>');
      return affected(values.base, { json: values.json });
    case 'test':
      return testGame(requireSlug(), [
        ...positionals.slice(1),
        ...(values['test-name'] !== undefined ? ['-t', values['test-name']] : []),
        ...(values.project !== undefined ? ['--project', values.project] : []),
      ]);
    case 'see':
      return see(requireSlug(), {
        debug: values.debug,
        mobile: values.mobile,
        ...(values.viewport !== undefined && { viewport: values.viewport }),
        ascii: values.ascii,
        ...(values.scenario !== undefined && { scenario: values.scenario }),
        ...(values.input !== undefined && { input: values.input }),
        ...(values.at !== undefined && { at: values.at }),
        ...(values.seed !== undefined && { seed: values.seed }),
        ...(values.scene !== undefined && { scene: values.scene }),
        ...(values.query !== undefined && { query: values.query }),
        ...(values.out !== undefined && { out: values.out }),
        ...(values.compare !== undefined && { compare: values.compare }),
        ...(values.field !== undefined && { field: values.field }),
        ...(values.crop !== undefined && { crop: values.crop }),
        ...(values.events !== undefined && { events: values.events }),
      });
    case 'attract':
      return attract(requireSlug());
    case 'smoke':
      return smoke(slug);
    case 'assemble': {
      const include =
        values.include === 'branch' ? includeForBranch(process.env.WORKERS_CI_BRANCH) : (values.include as Include);
      if (!['published', 'preview', 'all'].includes(include))
        throw new UsageError('--include must be published, preview, all or branch');
      const result = await assemble(include);
      console.log(result.report.join('\n'));
      return result.ok ? 0 : 1;
    }
    case 'new':
      if (!values.template) throw new UsageError('arcade new needs --template phaser-2d or --template three-3d');
      return newGame(requireSlug(), {
        template: values.template,
        ...(values.title !== undefined && { title: values.title }),
      });
    case 'dev': {
      const game = findGame(requireSlug());
      const portArgs = values.port ? ['--port', values.port, '--strictPort'] : [];
      console.log(`Serving ${game.slug} at /games/${game.slug}/ (add ?debug=1, ?scene=<name>, ?seed=<n>, ?touch=1)`);
      const child = spawn('pnpm', ['exec', 'vite', ...portArgs], { cwd: game.dir, stdio: 'inherit' });
      return new Promise((resolve) => child.on('close', (code) => resolve(code ?? 0)));
    }
    case 'list':
      for (const g of listGames())
        console.log(
          `${g.slug.padEnd(20)} ${g.manifest.status.padEnd(10)} ${g.manifest.engine.padEnd(7)} ${g.manifest.title}`,
        );
      return 0;
    default:
      throw new UsageError(`Unknown command "${command}". Run "pnpm arcade help".`);
  }
}

main(process.argv.slice(2)).then(
  (code) => {
    process.exitCode = code;
  },
  (err: unknown) => {
    if (err instanceof UsageError) console.error(`arcade: ${err.message}`);
    else console.error(err);
    process.exitCode = 1;
  },
);
