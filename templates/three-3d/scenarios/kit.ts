import { scenarioKit } from '@arcade/testing';
import type { Action } from '../src/engine/input.ts';

export const { scenario, hold, tap, wait } = scenarioKit<Action>();
