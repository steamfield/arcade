/**
 * The game's JSON messages as a peer receives them: what each schema accepts, and what it refuses
 * so that a bad message is dropped before it can reach `createWorld`.
 */
import { describe, expect, it } from 'vitest';
import { EndSchema, LobbySchema, RelayedGameMessageSchema, StartSchema } from './messages.ts';

const LOBBY = { type: 'lobby', character: 'gil', ping: 40, ready: true, course: 'sunlit-shallows', difficulty: 'hard' };

const START = {
  type: 'start',
  seed: 12345,
  course: 'sunlit-shallows',
  difficulty: 'normal',
  slots: { '1': 'player', '3': 'tess' },
  characters: { player: 'rudy', tess: 'gil' },
  delay: 5,
};

const END = { type: 'end', tick: 3600, hash: 0xdeadbeef };

/** The messages of every issue a schema raises for `value`, or an empty list when it parses. */
function issues(schema: { safeParse(value: unknown): { error?: { issues: { message: string }[] } } }, value: unknown) {
  return schema.safeParse(value).error?.issues.map((issue) => issue.message) ?? [];
}

describe('LobbySchema', () => {
  it('accepts a well-formed lobby message', () => {
    expect(LobbySchema.parse(LOBBY)).toEqual(LOBBY);
  });

  it.each([
    ['a wrong type', { ...LOBBY, type: 'start' }],
    ['an unknown character', { ...LOBBY, character: 'mario' }],
    ['a difficulty of easy', { ...LOBBY, difficulty: 'easy' }],
    ['a course this build does not have', { ...LOBBY, course: 'moon-base' }],
  ])('rejects %s', (_case, message) => {
    expect(LobbySchema.safeParse(message).success).toBe(false);
  });
});

describe('StartSchema', () => {
  it('accepts a well-formed start message', () => {
    expect(StartSchema.parse(START)).toEqual(START);
  });

  it.each([
    ['a wrong type', { ...START, type: 'lobby' }],
    ['an unknown character', { ...START, characters: { player: 'rudy', tess: 'mario' } }],
    ['a delay of 13', { ...START, delay: 13 }],
    ['a difficulty of easy', { ...START, difficulty: 'easy' }],
    ['a course this build does not have', { ...START, course: 'moon-base' }],
    ['a slots key of 256', { ...START, slots: { '1': 'player', '256': 'tess' } }],
    ['a slots key of 999', { ...START, slots: { '1': 'player', '999': 'tess' } }],
  ])('rejects %s', (_case, message) => {
    expect(StartSchema.safeParse(message).success).toBe(false);
  });

  it('accepts a slots key of 255, the largest peer id', () => {
    expect(StartSchema.safeParse({ ...START, slots: { '1': 'player', '255': 'tess' } }).success).toBe(true);
  });

  it('rejects a slots entry naming an unknown slot', () => {
    const paths = StartSchema.safeParse({ ...START, slots: { '1': 'player', '3': 'p5' } }).error?.issues.map(
      (issue) => issue.path,
    );
    expect(paths).toContainEqual(['slots', '3']);
  });

  it.each([
    [
      'two peers in one slot',
      { ...START, slots: { '1': 'player', '3': 'player' }, characters: { player: 'rudy' } },
      'two peers share a slot',
    ],
    ['a raced slot without a character', { ...START, characters: { player: 'rudy' } }, 'slot tess has no character'],
    [
      'a character without a peer',
      { ...START, characters: { player: 'rudy', tess: 'gil', bo: 'nib' } },
      'slot bo has a character but no peer',
    ],
    [
      'one character for two slots',
      { ...START, characters: { player: 'gil', tess: 'gil' } },
      'two slots share a character',
    ],
    [
      'fewer than two peers',
      { ...START, slots: { '1': 'player' }, characters: { player: 'rudy' } },
      'a race needs at least two peers',
    ],
  ])('rejects %s', (_case, message, problem) => {
    expect(issues(StartSchema, message)).toEqual([problem]);
  });
});

describe('EndSchema', () => {
  it('accepts a well-formed end message', () => {
    expect(EndSchema.parse(END)).toEqual(END);
  });

  it('rejects a wrong type', () => {
    expect(EndSchema.safeParse({ ...END, type: 'lobby' }).success).toBe(false);
  });
});

describe('RelayedGameMessageSchema', () => {
  it.each([
    ['lobby', LOBBY],
    ['start', START],
    ['end', END],
  ])('accepts a relayed %s with the sender id', (_type, message) => {
    expect(RelayedGameMessageSchema.parse({ ...message, from: 3 })).toEqual({ ...message, from: 3 });
  });

  it('rejects a relayed start whose fields disagree', () => {
    const shared = { ...START, from: 1, characters: { player: 'gil', tess: 'gil' } };
    expect(issues(RelayedGameMessageSchema, shared)).toContain('two slots share a character');
  });
});
