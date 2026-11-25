import type { GameManifest } from '@arcade/config';
import { createSaveStore } from '@arcade/save';
import { bootGame } from '@arcade/shell';
import manifest from '../game.json';
import { startThree } from './engine/game.ts';
import { input } from './engine/input.ts';
import { migrations, SAVE_VERSION, SaveSchema } from './logic/save.ts';

const game = manifest as GameManifest;
const saves = await createSaveStore({
  gameId: game.id,
  version: SAVE_VERSION,
  schema: SaveSchema,
  migrate: migrations,
});

await bootGame({
  manifest: game,
  input,
  start: (ctx) => startThree(ctx, saves),
  onFirstGesture: () => saves.requestPersistence(),
});
