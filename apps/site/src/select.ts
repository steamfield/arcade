// The select screen. The page works as plain links without this script; this adds the cabinet:
// a selected game with its gameplay loop, arrow keys and gamepad, the deck's stick and buttons,
// sound, "saved on this device", and the tube switching off as a game starts.
import { blip, chime, coin, setSound, soundOn } from './sfx.ts';

interface SiteGame {
  id: string;
  slug: string;
  title: string;
  pitch: string;
  genre: string;
  draft: boolean;
  href: string;
  cover: string | null;
  attract: string | null;
  inputs: { name: string; label: string; icon: string }[];
}

const $ = <T extends Element>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel);
const games = JSON.parse($('#games-data')?.textContent ?? '[]') as SiteGame[];
const screen = $<HTMLElement>('#screen');
const feature = $<HTMLElement>('#feature');
const shelf = $<HTMLElement>('#shelf');
const stick = $<HTMLElement>('#stick');
const deckStart = $<HTMLButtonElement>('#deck-start');
const deckSound = $<HTMLButtonElement>('#deck-sound');
const soundState = $<HTMLElement>('#sound-state');
const padState = $<HTMLElement>('#pad-state');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

let selected = 0;
const saved = new Set<string>();

const carts = () => [...(shelf?.querySelectorAll<HTMLAnchorElement>('.cart') ?? [])];
const field = <T extends HTMLElement>(name: string) => $<T>(`[data-field="${name}"]`, feature ?? document);

/* ---------- Rendering the selected game ---------- */

function renderProgress(game: SiteGame): void {
  const progress = field('progress');
  const label = $<HTMLElement>('.start-label', feature ?? document);
  const has = saved.has(game.id);
  if (progress) {
    progress.textContent = has ? 'Saved on this device' : 'Saves on this device';
    progress.dataset.saved = String(has);
  }
  if (label) label.textContent = has ? 'Continue' : 'Press start';
}

function renderMonitor(game: SiteGame): void {
  const monitor = $<HTMLElement>('.monitor', feature ?? document);
  if (!monitor) return;
  const video = $<HTMLVideoElement>('video.attract', monitor);
  const still = $<HTMLImageElement>('img.still', monitor);
  const signal = $<HTMLElement>('.no-signal', monitor);
  monitor.classList.remove('switching');
  void monitor.offsetWidth;
  monitor.classList.add('switching');
  const label = `${game.title} gameplay`;
  if (video) {
    video.hidden = !game.attract;
    video.setAttribute('aria-label', label);
    if (game.attract) {
      video.poster = game.cover ?? '';
      video.src = game.attract;
    } else {
      video.pause();
      video.removeAttribute('src');
      video.removeAttribute('poster');
      video.load();
    }
  }
  if (still) {
    still.hidden = Boolean(game.attract) || !game.cover;
    still.alt = label;
    if (game.cover && !game.attract) still.src = game.cover;
  }
  if (signal) signal.hidden = Boolean(game.attract || game.cover);
  syncVideo();
}

function select(index: number, opts: { sound?: boolean; focus?: boolean } = {}): void {
  if (games.length === 0) return;
  const next = (index + games.length) % games.length;
  const game = games[next];
  if (!game) return;
  const changed = next !== selected;
  selected = next;
  carts().forEach((c, i) => {
    if (i === next) c.setAttribute('aria-current', 'true');
    else c.removeAttribute('aria-current');
  });
  const cart = carts()[next];
  if (opts.focus) cart?.focus({ preventScroll: true });
  // Scroll the shelf only; scrollIntoView would also scroll the page.
  const row = shelf;
  const item = cart?.parentElement;
  if (row && item) {
    const left = item.offsetLeft - row.offsetLeft;
    const target =
      left < row.scrollLeft
        ? left
        : left + item.offsetWidth > row.scrollLeft + row.clientWidth
          ? left + item.offsetWidth - row.clientWidth
          : row.scrollLeft;
    row.scrollTo({ left: target, behavior: reducedMotion.matches ? 'auto' : 'smooth' });
  }
  if (!changed) return;
  if (opts.sound !== false) blip();

  const title = field('title');
  const pitch = field('pitch');
  const genre = field('genre');
  const inputs = field('inputs');
  const href = field<HTMLAnchorElement>('href');
  if (title) title.textContent = game.title;
  if (pitch) pitch.textContent = game.pitch;
  if (genre) genre.textContent = game.genre + (game.draft ? ' (draft)' : '');
  if (inputs)
    inputs.innerHTML = game.inputs.map((i) => `<li title="${i.label}">${i.icon}<span>${i.label}</span></li>`).join('');
  if (href) href.href = game.href;
  renderProgress(game);
  renderMonitor(game);
}

/* ---------- Video: play only when it can be seen, never under reduced motion ---------- */

let onScreen = true;
function syncVideo(): void {
  const video = $<HTMLVideoElement>('video.attract', feature ?? document);
  if (!video || !video.getAttribute('src')) return;
  if (reducedMotion.matches || !onScreen || document.hidden) {
    video.pause();
    video.autoplay = false;
  } else {
    video.autoplay = true;
    void video.play().catch(() => {
      // Autoplay refused (power saving, data saver): the poster stays up, which is fine.
    });
  }
}
if (feature && 'IntersectionObserver' in window) {
  new IntersectionObserver(([entry]) => {
    onScreen = entry?.isIntersecting ?? true;
    syncVideo();
  }).observe(feature);
}
document.addEventListener('visibilitychange', syncVideo);
reducedMotion.addEventListener('change', syncVideo);

/* ---------- Starting a game ---------- */

let launching = false;
function launch(href = games[selected]?.href): void {
  if (!href || launching) return;
  launching = true;
  coin();
  press(deckStart);
  $<HTMLElement>('.start-btn', feature ?? document)?.classList.add('pressed');
  if (reducedMotion.matches || !screen) {
    location.href = href;
    return;
  }
  screen.classList.add('launching');
  // Leave time for the coin sound and the tube switching off.
  setTimeout(() => {
    location.href = href;
  }, 400);
}

// Coming back with the back button restores this page from the bfcache: switch the tube back on.
addEventListener('pageshow', () => {
  launching = false;
  $<HTMLElement>('.start-btn', feature ?? document)?.classList.remove('pressed');
  deckStart?.classList.remove('pressed');
  if (!screen) return;
  screen.classList.remove('launching');
  syncVideo();
});

/** A plain left click with no modifiers is ours to animate; anything else (new tab, etc.) is the browser's. */
const plainClick = (e: MouseEvent) => e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;

feature?.addEventListener('click', (e) => {
  const link = (e.target instanceof Element ? e.target : null)?.closest<HTMLAnchorElement>('.start-btn');
  if (!link || !plainClick(e)) return;
  e.preventDefault();
  launch(link.href);
});

shelf?.addEventListener('click', (e) => {
  const cart = (e.target instanceof Element ? e.target : null)?.closest<HTMLAnchorElement>('.cart');
  if (!cart || !plainClick(e)) return;
  const index = Number(cart.dataset.index);
  e.preventDefault();
  // First tap on a touch screen shows the game; tapping the selected one (or clicking) starts it.
  if (index !== selected && matchMedia('(hover: none)').matches) {
    select(index);
    return;
  }
  select(index, { sound: false });
  launch(cart.href);
});
shelf?.addEventListener('mouseover', (e) => {
  const cart = (e.target instanceof Element ? e.target : null)?.closest<HTMLAnchorElement>('.cart');
  if (cart) select(Number(cart.dataset.index));
});
shelf?.addEventListener('focusin', (e) => {
  const cart = (e.target instanceof Element ? e.target : null)?.closest<HTMLAnchorElement>('.cart');
  if (cart) select(Number(cart.dataset.index));
});

/* ---------- Deck: stick and buttons ---------- */

function nudge(dir: 'left' | 'right'): void {
  if (!stick) return;
  stick.dataset.dir = dir;
  clearTimeout(Number(stick.dataset.timer));
  stick.dataset.timer = String(setTimeout(() => delete stick.dataset.dir, 140));
}
function press(btn: HTMLElement | null): void {
  if (!btn) return;
  btn.classList.add('pressed');
  setTimeout(() => btn.classList.remove('pressed'), 140);
}
function move(step: 1 | -1): void {
  nudge(step < 0 ? 'left' : 'right');
  select(selected + step, { focus: shelf?.contains(document.activeElement) ?? false });
}
function toggleSound(): void {
  setSound(!soundOn());
  deckSound?.setAttribute('aria-pressed', String(soundOn()));
  if (soundState) soundState.textContent = soundOn() ? 'Sound on' : 'Sound off';
  press(deckSound);
  chime();
}
deckStart?.addEventListener('click', () => launch());
deckSound?.addEventListener('click', toggleSound);

/* ---------- Keyboard ---------- */

document.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const onButton = e.target instanceof Element && e.target.closest('button') !== null;
  switch (e.key) {
    case 'ArrowLeft':
    case 'ArrowUp':
      move(-1);
      e.preventDefault();
      break;
    case 'ArrowRight':
    case 'ArrowDown':
      move(1);
      e.preventDefault();
      break;
    case 'Enter':
    case ' ':
      if (onButton) return;
      launch();
      e.preventDefault();
      break;
    case 'm':
    case 'M':
      toggleSound();
      break;
  }
});

/* ---------- Gamepad: d-pad or stick to select, A or Start to play ---------- */

let polling = false;
const held = new Map<string, number>();
function pollPads(now: number): void {
  const pads = navigator.getGamepads().filter((p): p is Gamepad => p !== null);
  if (padState) padState.hidden = pads.length === 0;
  if (pads.length === 0) {
    polling = false;
    return;
  }
  const pad = pads[0];
  if (pad) {
    const x = pad.axes[0] ?? 0;
    const left = pad.buttons[14]?.pressed || pad.buttons[12]?.pressed || x < -0.5;
    const right = pad.buttons[15]?.pressed || pad.buttons[13]?.pressed || x > 0.5;
    const start = pad.buttons[0]?.pressed || pad.buttons[9]?.pressed;
    // First press acts at once; holding repeats after 350 ms, every 140 ms, like menu auto-repeat.
    const repeat = (name: string, down: boolean | undefined, act: () => void) => {
      if (!down) return void held.delete(name);
      const since = held.get(name);
      if (since === undefined) {
        held.set(name, now);
        act();
      } else if (now - since > 350) {
        held.set(name, now - 350 + 140);
        act();
      }
    };
    if (left || right || start) idle();
    repeat('left', left, () => move(-1));
    repeat('right', right, () => move(1));
    if (start && !held.has('start')) {
      held.set('start', now);
      launch();
    } else if (!start) held.delete('start');
  }
  requestAnimationFrame(pollPads);
}
addEventListener('gamepadconnected', () => {
  if (polling) return;
  polling = true;
  requestAnimationFrame(pollPads);
});

/* ---------- Saved progress ---------- */

// Each game's saves live in an IndexedDB database named arcade-<gameId> (@arcade/save), on this origin.
// Listing database names reads nothing inside them.
async function detectSaves(): Promise<void> {
  if (!('databases' in indexedDB)) return;
  try {
    const dbs = await indexedDB.databases();
    for (const db of dbs) if (db.name?.startsWith('arcade-')) saved.add(db.name.slice('arcade-'.length));
  } catch {
    return; // Private browsing or storage blocked: show nothing rather than guess.
  }
  const game = games[selected];
  if (game) renderProgress(game);
}

/* ---------- Attract mode: with nobody at the controls, cycle through the games ---------- */

const IDLE_MS = 15_000;
let idleTimer = 0;
function idle(): void {
  clearTimeout(idleTimer);
  if (games.length < 2 || reducedMotion.matches) return;
  idleTimer = window.setTimeout(function cycle() {
    if (!document.hidden && onScreen && !launching) select(selected + 1, { sound: false });
    idleTimer = window.setTimeout(cycle, IDLE_MS);
  }, IDLE_MS);
}
for (const type of ['keydown', 'pointermove', 'pointerdown', 'wheel', 'touchstart', 'gamepadconnected'])
  addEventListener(type, idle, { passive: true });
idle();

void detectSaves();
syncVideo();
