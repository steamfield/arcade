/**
 * The ocean look: Sunlit Shallows' reef, water, bubbles and light. In this scaffold it hands texture
 * building to today's global art builder; lane 8/b moves the ocean art in here.
 */
import { buildTextures } from '../art/index.ts';
import { defineTheme } from './define.ts';

export const OCEAN_THEME = defineTheme({
  id: 'ocean',
  registerTextures: buildTextures,
});
