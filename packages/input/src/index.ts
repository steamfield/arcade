/**
 * Named-action input for keyboard and touch. Games read actions
 * (`isDown('jump')`, `vector('move')`), never raw events, so tests can inject
 * input at the action level and new devices only touch this package.
 *
 * Call `update()` once at the start of every logic tick; `justPressed` is
 * relative to the previous tick.
 */

export interface DirectionalVector<A extends string> {
  left: A;
  right: A;
  up: A;
  down: A;
}

export interface TouchLayout<A extends string> {
  /** Actions on the left-hand d-pad, as left/right/up/down. Omit for no d-pad. */
  dpad?: DirectionalVector<A>;
  /** Action buttons on the right, listed bottom-right first. */
  buttons?: { action: A; label: string }[];
}

export interface InputOptions<A extends string, V extends string> {
  /** Action name → KeyboardEvent.code list, e.g. { jump: ['Space', 'KeyW'] }. */
  actions: Record<A, readonly string[]>;
  /** Analog-style vectors composed from four actions. */
  vectors?: Record<V, DirectionalVector<A>>;
  touch?: TouchLayout<A>;
}

export interface Vec2 {
  x: number;
  y: number;
}

/** One edit typed while text entry is on: some text (a key or a paste), or a Backspace. */
export type TextEdit = { text: string } | { backspace: true };

export interface Input<A extends string = string, V extends string = string> {
  readonly actions: readonly A[];
  isDown(action: A): boolean;
  justPressed(action: A): boolean;
  vector(name: V): Vec2;
  /** Snapshot for edge detection. Call once per logic tick, before reading input. */
  update(): void;
  /** Fires on the physical press (keydown or touch), outside the tick loop. Good for menus. */
  on(action: A, callback: () => void): () => void;
  /** Test injection: hold or release an action as if a player did. */
  inject(action: A, down: boolean): void;
  /**
   * Turns text entry on or off (off to start). While it is on, printable keys (not Space), Backspace
   * and pastes become `TextEdit`s for `takeText()` instead of firing actions, and modifier keys fire
   * no actions, so Shift for a capital is not a press. Space, Enter, Escape, Tab and the arrows still
   * fire their actions, as do keys held with Ctrl, Alt or Meta (browser shortcuts). Turning it off
   * drops any edits not yet taken.
   */
  setTextEntry(on: boolean): void;
  /** The edits typed or pasted since the last call, oldest first. Empty while text entry is off. */
  takeText(): TextEdit[];
  /** Test injection: `text` typed while text entry is on, as one edit. Ignored while it is off. */
  injectText(text: string): void;
  /** Attach keyboard listeners and, on touch devices, the on-screen controls. */
  mount(container: HTMLElement, options?: { forceTouch?: boolean }): void;
  destroy(): void;
}

export function createInput<A extends string, V extends string = never>(options: InputOptions<A, V>): Input<A, V> {
  const actions = Object.keys(options.actions) as A[];
  const keyToActions = new Map<string, A[]>();
  for (const action of actions) {
    for (const code of options.actions[action]) keyToActions.set(code, [...(keyToActions.get(code) ?? []), action]);
  }

  const keysDown = new Set<string>();
  const touchDown = new Map<A, Set<number>>();
  const injected = new Set<A>();
  /** Actions pressed since the last update(). A tap shorter than one tick still counts for one tick. */
  const latched = new Set<A>();
  let previous = new Set<A>();
  let current = new Set<A>();
  const listeners = new Map<A, Set<() => void>>();
  const cleanup: (() => void)[] = [];
  let textEntry = false;
  let edits: TextEdit[] = [];

  /** Whether a keydown is text while text entry is on: Backspace, or one printable character other than Space. */
  const textEditOf = (e: KeyboardEvent): TextEdit | null => {
    if (e.ctrlKey || e.metaKey || e.altKey) return null;
    if (e.key === 'Backspace') return { backspace: true };
    return e.key.length === 1 && e.key !== ' ' ? { text: e.key } : null;
  };

  const physicallyDown = (action: A): boolean =>
    injected.has(action) ||
    (touchDown.get(action)?.size ?? 0) > 0 ||
    options.actions[action].some((code) => keysDown.has(code));

  const fire = (action: A) => {
    latched.add(action);
    for (const cb of listeners.get(action) ?? []) cb();
  };

  const input: Input<A, V> = {
    actions,
    isDown: (action) => current.has(action),
    justPressed: (action) => current.has(action) && !previous.has(action),
    vector(name) {
      const v = options.vectors?.[name];
      if (!v) throw new Error(`Unknown input vector "${name}". Declare it in createInput({ vectors }).`);
      let x = (current.has(v.right) ? 1 : 0) - (current.has(v.left) ? 1 : 0);
      let y = (current.has(v.down) ? 1 : 0) - (current.has(v.up) ? 1 : 0);
      if (x !== 0 && y !== 0) {
        x *= Math.SQRT1_2;
        y *= Math.SQRT1_2;
      }
      return { x, y };
    },
    update() {
      previous = current;
      current = new Set(actions.filter((a) => physicallyDown(a) || latched.has(a)));
      latched.clear();
    },
    on(action, callback) {
      const set = listeners.get(action) ?? new Set();
      set.add(callback);
      listeners.set(action, set);
      return () => set.delete(callback);
    },
    inject(action, down) {
      if (!actions.includes(action)) {
        throw new Error(`Unknown action "${action}". Known actions: ${actions.join(', ')}`);
      }
      if (down && !injected.has(action)) fire(action);
      if (down) injected.add(action);
      else injected.delete(action);
    },
    setTextEntry(on) {
      textEntry = on;
      if (!on) edits = [];
    },
    takeText() {
      const taken = edits;
      edits = [];
      return taken;
    },
    injectText(text) {
      if (textEntry) edits.push({ text });
    },
    mount(container, mountOptions = {}) {
      const onKeyDown = (e: KeyboardEvent) => {
        if (textEntry) {
          const edit = textEditOf(e);
          if (edit) {
            e.preventDefault();
            edits.push(edit);
            return;
          }
          if (MODIFIER_KEYS.has(e.key)) return;
        }
        const mapped = keyToActions.get(e.code);
        if (!mapped) return;
        e.preventDefault();
        if (!e.repeat) for (const a of mapped) fire(a);
        keysDown.add(e.code);
      };
      const onKeyUp = (e: KeyboardEvent) => keysDown.delete(e.code);
      const onBlur = () => keysDown.clear();
      const onPaste = (e: ClipboardEvent) => {
        const text = e.clipboardData?.getData('text') ?? '';
        if (!textEntry || text === '') return;
        e.preventDefault();
        edits.push({ text });
      };
      window.addEventListener('keydown', onKeyDown);
      window.addEventListener('keyup', onKeyUp);
      window.addEventListener('blur', onBlur);
      window.addEventListener('paste', onPaste);
      cleanup.push(() => {
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('keyup', onKeyUp);
        window.removeEventListener('blur', onBlur);
        window.removeEventListener('paste', onPaste);
      });

      const isTouch = mountOptions.forceTouch || window.matchMedia('(pointer: coarse)').matches;
      if (isTouch && options.touch) {
        const overlay = renderTouchOverlay(options.touch, (action, pointerId, down) => {
          const set = touchDown.get(action) ?? new Set<number>();
          if (down) {
            if (set.size === 0) fire(action);
            set.add(pointerId);
          } else set.delete(pointerId);
          touchDown.set(action, set);
        });
        container.append(overlay);
        cleanup.push(() => overlay.remove());
      }
    },
    destroy() {
      for (const fn of cleanup.splice(0)) fn();
    },
  };
  return input;
}

/** `KeyboardEvent.key` values of modifier keys, which fire no actions while text entry is on. */
const MODIFIER_KEYS = new Set(['Shift', 'Control', 'Alt', 'Meta', 'CapsLock']);

const OVERLAY_CSS = `
.arcade-touch { position: absolute; inset: 0; pointer-events: none; z-index: 10; }
.arcade-touch button {
  position: absolute; pointer-events: auto; touch-action: none; user-select: none; -webkit-user-select: none;
  width: 64px; height: 64px; border-radius: 50%; border: 2px solid rgba(255,255,255,.5);
  background: rgba(255,255,255,.15); color: #fff; font: 600 14px system-ui, sans-serif;
}
.arcade-touch button[data-pressed] { background: rgba(255,255,255,.4); }
.arcade-touch .dpad { position: absolute; width: 180px; height: 180px;
  pointer-events: auto; touch-action: none; user-select: none; -webkit-user-select: none;
  /* 32px from the left edge keeps thumbs out of Safari's swipe-back zone. */
  left: calc(32px + env(safe-area-inset-left)); bottom: calc(24px + env(safe-area-inset-bottom)); }
.arcade-touch .dpad button { border-radius: 12px; width: 60px; height: 60px; }
.arcade-touch .actions { position: absolute; width: 170px; height: 170px;
  right: calc(24px + env(safe-area-inset-right)); bottom: calc(24px + env(safe-area-inset-bottom)); }
`;

/** Which d-pad arrows are held. */
export interface DpadDirections {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
}

/** The dead zone at the d-pad's centre, as a fraction of the pad's width. */
const DPAD_DEAD_ZONE = 0.1;
/** sin(22.5°): an arrow is held while the thumb is within 67.5° of it, which gives eight equal sectors. */
const DPAD_SECTOR = 0.3827;

/**
 * The arrows a thumb holds at `dx`, `dy` pixels from the d-pad's centre (+x right, +y down): none
 * within `deadZone` pixels, otherwise one arrow, or two neighbours on a diagonal.
 */
export function dpadDirections(dx: number, dy: number, deadZone: number): DpadDirections {
  const reach = Math.hypot(dx, dy);
  const edge = reach * DPAD_SECTOR;
  const out = reach > deadZone;
  return { left: out && dx < -edge, right: out && dx > edge, up: out && dy < -edge, down: out && dy > edge };
}

function renderTouchOverlay<A extends string>(
  layout: TouchLayout<A>,
  onChange: (action: A, pointerId: number, down: boolean) => void,
): HTMLElement {
  const root = document.createElement('div');
  root.className = 'arcade-touch';
  root.dataset.testid = 'touch-overlay';
  const style = document.createElement('style');
  style.textContent = OVERLAY_CSS;
  root.append(style);

  const makeButton = (action: A, label: string, css: Partial<CSSStyleDeclaration>) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.dataset.action = action;
    b.setAttribute('aria-label', action);
    Object.assign(b.style, css);
    const release = (e: PointerEvent) => {
      delete b.dataset.pressed;
      onChange(action, e.pointerId, false);
    };
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      b.setPointerCapture(e.pointerId);
      b.dataset.pressed = '';
      onChange(action, e.pointerId, true);
    });
    b.addEventListener('pointerup', release);
    b.addEventListener('pointercancel', release);
    b.addEventListener('contextmenu', (e) => e.preventDefault());
    return b;
  };

  if (layout.dpad) {
    const pad = document.createElement('div');
    pad.className = 'dpad';
    const { left, right, up, down } = layout.dpad;
    const arrow = (action: A, label: string, css: Partial<CSSStyleDeclaration>) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = label;
      b.dataset.action = action;
      b.setAttribute('aria-label', action);
      Object.assign(b.style, css);
      return b;
    };
    const arrows = {
      up: arrow(up, '▲', { left: '60px', top: '0' }),
      left: arrow(left, '◀', { left: '0', top: '60px' }),
      right: arrow(right, '▶', { left: '120px', top: '60px' }),
      down: arrow(down, '▼', { left: '60px', top: '120px' }),
    };
    const directions = Object.keys(arrows) as (keyof typeof arrows)[];
    // One thumb works the whole pad: where it rests decides which arrows are held, so a corner holds
    // two and a slide changes direction without lifting.
    let thumb: number | null = null;
    const hold = (pointerId: number, held: Partial<DpadDirections>) => {
      for (const direction of directions) {
        const button = arrows[direction];
        const isHeld = held[direction] === true;
        if (isHeld === 'pressed' in button.dataset) continue;
        if (isHeld) button.dataset.pressed = '';
        else delete button.dataset.pressed;
        onChange(button.dataset.action as A, pointerId, isHeld);
      }
    };
    const heldAt = (e: PointerEvent): DpadDirections => {
      const box = pad.getBoundingClientRect();
      return dpadDirections(
        e.clientX - (box.left + box.width / 2),
        e.clientY - (box.top + box.height / 2),
        box.width * DPAD_DEAD_ZONE,
      );
    };
    const release = (e: PointerEvent) => {
      if (e.pointerId !== thumb) return;
      thumb = null;
      hold(e.pointerId, {});
    };
    pad.addEventListener('pointerdown', (e) => {
      if (thumb !== null) return;
      e.preventDefault();
      thumb = e.pointerId;
      pad.setPointerCapture(e.pointerId);
      // A press on an arrow holds that arrow; anywhere else on the pad, the position decides.
      const pressed = directions.find((direction) => arrows[direction] === e.target);
      hold(e.pointerId, pressed ? { [pressed]: true } : heldAt(e));
    });
    pad.addEventListener('pointermove', (e) => {
      if (e.pointerId === thumb) hold(e.pointerId, heldAt(e));
    });
    pad.addEventListener('pointerup', release);
    pad.addEventListener('pointercancel', release);
    pad.addEventListener('contextmenu', (e) => e.preventDefault());
    pad.append(...Object.values(arrows));
    root.append(pad);
  }
  if (layout.buttons?.length) {
    const actions = document.createElement('div');
    actions.className = 'actions';
    const spots = [
      { right: '0', bottom: '0' },
      { right: '90px', bottom: '30px' },
      { right: '30px', bottom: '90px' },
      { right: '100px', bottom: '100px' },
    ];
    layout.buttons.slice(0, spots.length).forEach((btn, i) => {
      actions.append(makeButton(btn.action, btn.label, spots[i] ?? {}));
    });
    root.append(actions);
  }
  return root;
}
