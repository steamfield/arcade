import { z } from 'zod';

/** Schema for each game's game.json. The landing page, the Vite preset and the arcade CLI all read it. */
export const gameManifestSchema = z.object({
  /** Stable save namespace. Never change it once players have saves; rename `slug` instead. */
  id: z.string().regex(/^[a-z][a-z0-9-]*$/, 'id must be lowercase kebab-case'),
  /** URL path segment: the game is served at /games/<slug>/. Must match the folder name. */
  slug: z.string().regex(/^[a-z][a-z0-9-]*$/, 'slug must be lowercase kebab-case'),
  title: z.string().min(1),
  pitch: z.string().min(1).max(140),
  genre: z.string().min(1),
  engine: z.enum(['phaser', 'three', 'other']),
  inputs: z.array(z.enum(['keyboard', 'touch', 'gamepad'])).min(1),
  orientation: z.enum(['landscape', 'portrait', 'any']),
  /** template: checked by CI, never deployed. draft: deployed to previews only. published: on the site. */
  status: z.enum(['template', 'draft', 'published']),
  /** Still image in the game's public/ folder (served at /games/<slug>/<cover>): og:image and the landing page poster. */
  cover: z.string().optional(),
  /** Muted gameplay loop in public/, played on the landing page. `pnpm arcade attract <slug>` records it and the cover. */
  attract: z.string().optional(),
});

export type GameManifest = z.infer<typeof gameManifestSchema>;

/** Parse a manifest and turn Zod issues into one readable message naming the file. */
export function parseManifest(raw: unknown, source: string): GameManifest {
  const result = gameManifestSchema.safeParse(raw);
  if (result.success) return result.data;
  const issues = result.error.issues.map((i) => `  ${i.path.join('.') || '(root)'}: ${i.message}`).join('\n');
  throw new Error(`Invalid game manifest ${source}:\n${issues}`);
}
