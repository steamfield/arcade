// PostToolUse hook: format the file Claude just edited, silently.
// Format only, never `biome check --write`: safe fixes can delete an import the
// agent added for its next edit, and formatting surprises break the next old_string.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const input = JSON.parse(readFileSync(0, 'utf8')) as { tool_input?: { file_path?: string } };
const file = input.tool_input?.file_path;
if (file && /\.(ts|tsx|js|mjs|json|jsonc|css)$/.test(file) && !file.includes('node_modules')) {
  spawnSync('pnpm', ['exec', 'biome', 'format', '--write', file], { stdio: 'ignore' });
}
