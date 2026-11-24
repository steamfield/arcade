/**
 * Guardrails that keep games independent and their logic deterministic.
 *
 * Two checks live here. The import-boundary check reads every game and
 * template source file and fails when a relative import climbs out of that
 * game's own folder, which a Biome glob can't express. The lint probes run the
 * real biome.json against small files at game paths and prove each import and
 * nondeterminism ban fires where it claims to, and stays quiet where it should.
 */
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, posix } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ROOT } from './games.ts';

/** A source file by its repo-relative path, with forward slashes. */
interface SourceFile {
  path: string;
  source: string;
}

/** A relative import whose target lies outside the importing file's game or template folder. */
interface CrossFolderImport {
  file: string;
  specifier: string;
  resolved: string;
}

// Matches `... from '<x>'`, `import('<x>')` and side-effect `import '<x>'` in
// group 1, and `import(\`<x>\`)` in group 2. For a template literal only the
// static prefix before any `${` is captured, which is enough to see where the
// path climbs to.
const IMPORT_SPECIFIER = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)['"]([^'"]+)['"]|\bimport\s*\(\s*`([^`$]*)/g;
const SCANNED_EXTENSIONS = /\.(m|c)?[jt]sx?$/;

const SCANNED_TOPS = ['games', 'templates'] as const;
const SCANNED_SUBS = ['src', 'scenarios', 'tests'] as const;

function importSpecifiers(source: string): string[] {
  return [...source.matchAll(IMPORT_SPECIFIER)].map((match) => match[1] ?? match[2] ?? '');
}

/** `games/<slug>` or `templates/<name>`: the folder a file may import within. */
function ownerFolder(path: string): string {
  return path.split('/').slice(0, 2).join('/');
}

function isInside(path: string, folder: string): boolean {
  return path === folder || path.startsWith(`${folder}/`);
}

function findCrossFolderImports(files: SourceFile[]): CrossFolderImport[] {
  const crossings: CrossFolderImport[] = [];
  for (const file of files) {
    const owner = ownerFolder(file.path);
    for (const specifier of importSpecifiers(file.source)) {
      // Bare specifiers go through package resolution, which the workspace controls.
      if (!specifier.startsWith('.')) continue;
      const resolved = posix.join(posix.dirname(file.path), specifier);
      if (isInside(resolved, owner)) continue;
      crossings.push({ file: file.path, specifier, resolved });
    }
  }
  return crossings;
}

function describeCrossings(crossings: CrossFolderImport[]): string[] {
  return crossings.map(({ file, specifier, resolved }) => `${file}: ${specifier} -> ${resolved}`);
}

function isScannedSource(relativePath: string): boolean {
  return SCANNED_EXTENSIONS.test(relativePath) && !relativePath.split('/').includes('node_modules');
}

function collectGameSources(): SourceFile[] {
  const files: SourceFile[] = [];
  for (const top of SCANNED_TOPS) {
    const topDir = join(ROOT, top);
    if (!existsSync(topDir)) continue;
    for (const name of readdirSync(topDir)) {
      for (const sub of SCANNED_SUBS) {
        const dir = join(topDir, name, sub);
        if (!existsSync(dir)) continue;
        for (const entry of readdirSync(dir, { recursive: true, encoding: 'utf8' })) {
          if (!isScannedSource(entry)) continue;
          const path = `${top}/${name}/${sub}/${entry}`;
          files.push({ path, source: readFileSync(join(ROOT, path), 'utf8') });
        }
      }
    }
  }
  return files;
}

describe('import boundaries', () => {
  it('flags a relative import that leaves its game folder and allows local and bare ones', () => {
    const files: SourceFile[] = [
      {
        path: 'games/alpha/src/logic/world.ts',
        source: [
          "import { createRng } from '@arcade/core';",
          "import { tiles } from './tiles';",
          "import type { Car } from '../../../beta/src/logic/car';",
          "import '../../../../templates/phaser-2d/src/styles';",
          "const level = await import('../levels/one');",
          // biome-ignore lint/suspicious/noTemplateCurlyInString: this line is source text holding a template literal
          'const track = await import(`../../../beta/src/tracks/${level.name}.ts`);',
        ].join('\n'),
      },
    ];

    expect(describeCrossings(findCrossFolderImports(files))).toEqual([
      'games/alpha/src/logic/world.ts: ../../../beta/src/logic/car -> games/beta/src/logic/car',
      'games/alpha/src/logic/world.ts: ../../../../templates/phaser-2d/src/styles -> templates/phaser-2d/src/styles',
      'games/alpha/src/logic/world.ts: ../../../beta/src/tracks/ -> games/beta/src/tracks/',
    ]);
  });

  it('no game or template imports a relative path outside its own folder', () => {
    const sources = collectGameSources();
    // Guards against a vacuous pass if ROOT or the scanned folders move.
    expect(sources.map((file) => file.path)).toEqual(
      expect.arrayContaining(['games/rush-racers/src/main.ts', 'templates/phaser-2d/src/main.ts']),
    );
    const crossings = describeCrossings(findCrossFolderImports(sources));
    expect(crossings, 'Games never import other games. Move shared code into a package').toEqual([]);
  });
});

/** What a Biome lint run printed and how it exited. */
interface LintOutcome {
  exitCode: number | null;
  output: string;
}

const INTERNALS_MESSAGE = 'Import from the package entry (@arcade/<pkg>), not its internals.';
const ENGINE_IN_LOGIC_MESSAGE = 'Logic must be engine-free so it can be unit tested.';
const RANDOM_IN_LOGIC_MESSAGE = 'Math.random() makes logic non-deterministic.';
const ONE_ERROR = 'Found 1 error.';
const ANY_FINDING = /Found \d+ (error|warning|info)/;

const IMPORTS_CORE_INTERNALS =
  "import { createRng } from '@arcade/core/src/rng';\n\nexport const rng = createRng(1);\n";
const IMPORTS_CORE_ENTRY = "import { createRng } from '@arcade/core';\n\nexport const rng = createRng(1);\n";
const IMPORTS_PHASER = "import Phaser from 'phaser';\n\nexport const engineVersion = Phaser.VERSION;\n";
const CALLS_MATH_RANDOM = 'export const roll = Math.random();\n';

// Biome doesn't report rule diagnostics for --stdin-file-path input (it only
// prints "The contents aren't fixed"), so probes are real files linted against
// a copy of the config in an ignored folder.
let probeRoot = '';

beforeAll(() => {
  mkdirSync(join(ROOT, '.arcade'), { recursive: true });
  probeRoot = mkdtempSync(join(ROOT, '.arcade', 'guardrail-probe-'));
  cpSync(join(ROOT, 'biome.json'), join(probeRoot, 'biome.json'));
  cpSync(join(ROOT, 'tools', 'biome'), join(probeRoot, 'tools', 'biome'), { recursive: true });
});

afterAll(() => {
  if (probeRoot) rmSync(probeRoot, { recursive: true, force: true });
});

/**
 * Writes `source` at `path` inside the probe folder and lints that one file.
 *
 * @throws Error when the biome process can't be started.
 */
function lintProbe(path: string, source: string): LintOutcome {
  const file = join(probeRoot, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, source);
  // The copied config reads git's ignore file, which the probe folder lacks.
  // Turning VCS off on the command line keeps the copy identical to biome.json.
  const run = spawnSync('pnpm', ['exec', 'biome', 'lint', '--vcs-enabled=false', path], {
    cwd: probeRoot,
    encoding: 'utf8',
  });
  if (run.error) throw new Error(`Could not run biome in ${probeRoot}: ${run.error.message}`, { cause: run.error });
  return { exitCode: run.status, output: `${run.stdout}${run.stderr}` };
}

describe('biome import and nondeterminism bans', () => {
  it('flags an engine file importing @arcade/core internals', () => {
    const outcome = lintProbe('games/rush-racers/src/engine/internals-probe.ts', IMPORTS_CORE_INTERNALS);
    expect(outcome.exitCode, outcome.output).toBe(1);
    expect(outcome.output).toContain(INTERNALS_MESSAGE);
    expect(outcome.output).toContain(ONE_ERROR);
  });

  it('flags a logic file importing @arcade/core internals', () => {
    const outcome = lintProbe('games/rush-racers/src/logic/internals-probe.ts', IMPORTS_CORE_INTERNALS);
    expect(outcome.exitCode, outcome.output).toBe(1);
    expect(outcome.output).toContain(INTERNALS_MESSAGE);
    expect(outcome.output).toContain(ONE_ERROR);
  });

  it('flags a logic file importing phaser', () => {
    const outcome = lintProbe('games/rush-racers/src/logic/phaser-probe.ts', IMPORTS_PHASER);
    expect(outcome.exitCode, outcome.output).toBe(1);
    expect(outcome.output).toContain(ENGINE_IN_LOGIC_MESSAGE);
    expect(outcome.output).toContain(ONE_ERROR);
  });

  it('flags a logic file calling Math.random()', () => {
    const outcome = lintProbe('games/rush-racers/src/logic/random-probe.ts', CALLS_MATH_RANDOM);
    expect(outcome.exitCode, outcome.output).toBe(1);
    expect(outcome.output).toContain(RANDOM_IN_LOGIC_MESSAGE);
    expect(outcome.output).toContain(ONE_ERROR);
  });

  it('allows a logic file importing the @arcade/core entry', () => {
    const outcome = lintProbe('games/rush-racers/src/logic/core-entry-probe.ts', IMPORTS_CORE_ENTRY);
    expect(outcome.exitCode, outcome.output).toBe(0);
    expect(outcome.output).not.toMatch(ANY_FINDING);
  });

  it('allows an engine file importing phaser', () => {
    const outcome = lintProbe('games/rush-racers/src/engine/phaser-probe.ts', IMPORTS_PHASER);
    expect(outcome.exitCode, outcome.output).toBe(0);
    expect(outcome.output).not.toMatch(ANY_FINDING);
  });
});
