import { expect, test } from 'vitest';
import { isQuotaError } from '../src/quota.ts';

test.each([
  ['Exceeded the free tier request limit for Durable Objects.'],
  ['Daily SQLite write allowance exhausted.'],
  ['Durable Objects request quota exceeded.'],
  ["Exceeded the account's spending cap for Durable Objects."],
])('recognizes exhausted quota in %s', (message) => {
  expect(isQuotaError(new Error(message))).toBe(true);
});

test.each([
  'Durable Object is overloaded. Too many requests queued (quota exceeded).',
  'Too many requests for the same object within a 10 second window (limit reached).',
  'Durable Object storage operation exceeded timeout which caused object to be reset.',
  'Failed to read quota settings.',
  'The quota service could not connect over HTTP.',
])('keeps transient and unrelated errors separate (%s)', (message) => {
  expect(isQuotaError(new Error(message))).toBe(false);
});
