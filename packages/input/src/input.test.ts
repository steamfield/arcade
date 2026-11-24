import { afterEach, describe, expect, it } from 'vitest';
import { createInput } from './index.ts';

const make = () =>
  createInput<'left' | 'right' | 'jump', 'move'>({
    actions: { left: ['ArrowLeft'], right: ['ArrowRight'], jump: ['Space'] },
    vectors: { move: { left: 'left', right: 'right', up: 'jump', down: 'jump' } },
  });

describe('createInput', () => {
  it('reports a held action as down and only the first tick as just pressed', () => {
    const input = make();
    input.inject('jump', true);
    input.update();
    expect([input.isDown('jump'), input.justPressed('jump')]).toEqual([true, true]);
    input.update();
    expect([input.isDown('jump'), input.justPressed('jump')]).toEqual([true, false]);
    input.inject('jump', false);
    input.update();
    expect(input.isDown('jump')).toBe(false);
  });

  it('does not lose a tap that starts and ends between two ticks', () => {
    const input = make();
    input.update();
    input.inject('jump', true);
    input.inject('jump', false);
    input.update();
    expect(input.justPressed('jump')).toBe(true);
    input.update();
    expect(input.isDown('jump')).toBe(false);
  });

  it('cancels opposite directions in a vector', () => {
    const input = make();
    input.inject('left', true);
    input.inject('right', true);
    input.update();
    expect(input.vector('move').x).toBe(0);
  });

  it('names the known actions when an unknown one is injected', () => {
    expect(() => make().inject('dash' as 'jump', true)).toThrow(
      'Unknown action "dash". Known actions: left, right, jump',
    );
  });
});

describe('text entry', () => {
  /** Tests run without a DOM, so the page's window is an EventTarget that never matches a coarse pointer. */
  const page = Object.assign(new EventTarget(), { matchMedia: () => ({ matches: false }) });
  const mounted = () => {
    Object.assign(globalThis, { window: page });
    const input = createInput<'jump' | 'back', never>({
      actions: { jump: ['Space', 'KeyW'], back: ['Escape', 'ShiftLeft', 'KeyX'] },
    });
    input.mount({} as HTMLElement);
    return input;
  };
  const press = (code: string, key: string, modifiers: { metaKey?: boolean } = {}) => {
    const event = Object.assign(new Event('keydown', { cancelable: true }), { code, key, repeat: false, ...modifiers });
    page.dispatchEvent(event);
    page.dispatchEvent(Object.assign(new Event('keyup'), { code, key }));
    return event;
  };
  const paste = (text: string) =>
    page.dispatchEvent(
      Object.assign(new Event('paste', { cancelable: true }), { clipboardData: { getData: () => text } }),
    );
  const pressedThisTick = (input: ReturnType<typeof mounted>) => {
    input.update();
    return input.actions.filter((action) => input.justPressed(action));
  };

  afterEach(() => {
    Reflect.deleteProperty(globalThis, 'window');
  });

  it('is off to start: a letter key fires its action and nothing is typed', () => {
    const input = mounted();
    press('KeyW', 'w');
    expect(pressedThisTick(input)).toEqual(['jump']);
    expect(input.takeText()).toEqual([]);
  });

  it('turns letters, Shift-held capitals, Backspace and pastes into edits, and fires none of their actions', () => {
    const input = mounted();
    input.setTextEntry(true);
    const typed = press('KeyW', 'w');
    press('ShiftLeft', 'Shift');
    press('KeyX', 'X');
    press('Backspace', 'Backspace');
    paste('ABCD');
    expect(typed.defaultPrevented).toBe(true);
    expect(pressedThisTick(input)).toEqual([]);
    expect(input.takeText()).toEqual([{ text: 'w' }, { text: 'X' }, { backspace: true }, { text: 'ABCD' }]);
    expect(input.takeText()).toEqual([]);
  });

  it('still fires Space, Escape and shortcuts held with Meta as actions', () => {
    const input = mounted();
    input.setTextEntry(true);
    press('Space', ' ');
    press('Escape', 'Escape');
    expect(pressedThisTick(input)).toEqual(['jump', 'back']);
    input.update();
    press('KeyW', 'w', { metaKey: true });
    expect(pressedThisTick(input)).toEqual(['jump']);
    expect(input.takeText()).toEqual([]);
  });

  it('drops edits not yet taken when it is turned off, and ignores pastes and injected text while off', () => {
    const input = mounted();
    input.setTextEntry(true);
    input.injectText('AB');
    input.setTextEntry(false);
    paste('CD');
    input.injectText('EF');
    input.setTextEntry(true);
    expect(input.takeText()).toEqual([]);
  });
});
