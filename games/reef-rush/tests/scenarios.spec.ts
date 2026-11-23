import { defineScenarioTests } from '@arcade/testing/playwright';

await defineScenarioTests(new URL('../scenarios/', import.meta.url));
