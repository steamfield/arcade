import { TICK_HZ } from '@arcade/core';
import type { SaveData } from '../logic/save.ts';
import { DASH, RACE } from '../logic/tuning.ts';
import type { World } from '../logic/types.ts';
import { playerOf } from '../logic/world.ts';
import type { Scene } from './runtime.ts';

const CSS = `
.rr3d-hud {
  position: absolute;
  inset: 0;
  z-index: 5;
  color: #fff7e5;
  pointer-events: none;
  font: 600 16px/1.2 system-ui, sans-serif;
}
.rr3d-hud [hidden] { display: none; }
.rr3d-clock, .rr3d-dash, .rr3d-results {
  background: #231d17f5;
  border: 1px solid #f7dcad5c;
  box-shadow: 0 3px 10px #19130f44;
}
.rr3d-clock {
  position: absolute;
  top: calc(14px + env(safe-area-inset-top));
  left: calc(16px + env(safe-area-inset-left));
  padding: 7px 12px;
  border-radius: 8px;
  font-size: 23px;
  font-weight: 750;
  font-variant-numeric: tabular-nums;
}
.rr3d-dash {
  position: absolute;
  left: calc(16px + env(safe-area-inset-left));
  bottom: calc(18px + env(safe-area-inset-bottom));
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 10px;
  border-radius: 8px;
}
.arcade-container:has(.arcade-touch) .rr3d-dash {
  left: calc(164px + env(safe-area-inset-left));
  bottom: calc(32px + env(safe-area-inset-bottom));
}
.rr3d-dash i {
  width: 15px;
  height: 12px;
  border: 1px solid #d8b478;
  border-radius: 2px;
  transform: skewX(-14deg);
}
.rr3d-dash i[data-charged] { background: #ffce73; }
.rr3d-count {
  position: absolute;
  top: 44%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: #fff1c7;
  font-size: clamp(68px, 18vmin, 116px);
  font-weight: 950;
  line-height: 1;
  paint-order: stroke fill;
  -webkit-text-stroke: 5px #35251a;
  text-shadow: 0 6px 10px #2a201d99;
}
.rr3d-results {
  position: absolute;
  top: 46%;
  left: 50%;
  transform: translate(-50%, -50%);
  box-sizing: border-box;
  width: min(312px, calc(100% - 32px));
  padding: 20px;
  border-radius: 14px;
}
.arcade-container:has(.arcade-touch) .rr3d-results {
  /* Keep the panel between the 212px left and 194px right control areas. */
  left: calc(50% + 9px + (env(safe-area-inset-left) - env(safe-area-inset-right)) / 2);
  max-width: calc(100% - 422px - env(safe-area-inset-left) - env(safe-area-inset-right));
  padding: clamp(12px, 2.5vw, 20px);
}
.rr3d-results h2 { margin: 0 0 14px; font-size: 25px; }
.arcade-container:has(.arcade-touch) .rr3d-results h2 { font-size: clamp(19px, 3.7vw, 25px); }
.rr3d-results p { margin: 0; }
.rr3d-results dl {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: baseline;
  gap: 5px 12px;
  margin: 0 0 15px;
  font-variant-numeric: tabular-nums;
}
.rr3d-results dd { margin: 0; text-align: right; font-size: 22px; }
.rr3d-results .rr3d-best { color: #ffce73; margin-bottom: 10px; }
@media (max-width: 640px) {
  .arcade-container:has(.arcade-touch) .rr3d-results {
    left: calc(16px + env(safe-area-inset-left));
    right: calc(128px + env(safe-area-inset-right));
    width: auto;
    max-width: 312px;
    margin-inline: auto;
    transform: translateY(-50%);
  }
  .arcade-container:has(.arcade-touch .dpad):has(.rr3d-results:not([hidden])) .rr3d-clock,
  .arcade-container:has(.rr3d-results:not([hidden])) .arcade-touch :is(.dpad, button:not([data-action="fire"])) {
    visibility: hidden;
  }
}
`;

function label(node: HTMLElement, value: string): void {
  if (node.textContent !== value) node.textContent = value;
}

function show(node: HTMLElement, visible: boolean): void {
  if (node.hidden === visible) node.hidden = !visible;
}

function tenths(ticks: number): number {
  return Math.floor((ticks * 10) / TICK_HZ);
}

function formatTime(time: number): string {
  const seconds = String(Math.floor(time / 10) % 60).padStart(2, '0');
  return `${Math.floor(time / 600)}:${seconds}.${time % 10}`;
}

export class Hud {
  private readonly clock = document.createElement('div');
  private readonly dash = document.createElement('div');
  private readonly pips = Array.from({ length: DASH.charges }, () => document.createElement('i'));
  private readonly count = document.createElement('div');
  private readonly results = document.createElement('section');
  private readonly heading = document.createElement('h2');
  private readonly finishTime = document.createElement('dd');
  private readonly bestTime = document.createElement('dd');
  private readonly badge = document.createElement('p');
  private time = -1;
  private charges = -1;

  constructor(container: HTMLElement) {
    const root = document.createElement('div');
    root.className = 'rr3d-hud';
    const style = document.createElement('style');
    style.textContent = CSS;
    this.clock.className = 'rr3d-clock';
    this.count.className = 'rr3d-count';
    this.count.setAttribute('aria-live', 'polite');
    this.dash.className = 'rr3d-dash';
    this.dash.setAttribute('role', 'img');
    this.dash.append('Dash', ...this.pips);
    this.results.className = 'rr3d-results';
    this.results.setAttribute('aria-live', 'polite');
    const times = document.createElement('dl');
    const timeLabel = document.createElement('dt');
    timeLabel.textContent = 'Time';
    const bestLabel = document.createElement('dt');
    bestLabel.textContent = 'Best';
    times.append(timeLabel, this.finishTime, bestLabel, this.bestTime);
    this.badge.className = 'rr3d-best';
    this.badge.textContent = 'NEW BEST';
    const hint = document.createElement('p');
    hint.textContent = 'Press Enter or ★ to race again';
    this.results.append(this.heading, times, this.badge, hint);
    root.append(style, this.clock, this.dash, this.count, this.results);
    container.append(root);
  }

  sync(world: World, scene: Scene, bests: SaveData['bests'], go: boolean, newBest: boolean): void {
    const player = playerOf(world);
    const time = tenths(world.raceTicks);
    if (time !== this.time) {
      this.time = time;
      this.clock.textContent = formatTime(time);
    }
    if (player.dashCharges !== this.charges) {
      this.charges = player.dashCharges;
      for (const [index, pip] of this.pips.entries()) pip.toggleAttribute('data-charged', index < this.charges);
      this.dash.setAttribute('aria-label', `Dash charges: ${this.charges} of ${this.pips.length}`);
    }

    const count =
      world.phase === 'countdown'
        ? String(Math.max(1, Math.ceil((RACE.countdownTicks - world.tick) / TICK_HZ)))
        : go
          ? 'GO'
          : '';
    label(this.count, count);
    show(this.count, count !== '');
    const showResults = scene === 'results';
    show(this.dash, !showResults);
    show(this.results, showResults);
    if (showResults) {
      label(this.heading, player.finishTicks === null ? 'Time limit reached' : 'Race complete');
      label(this.finishTime, formatTime(tenths(player.finishTicks ?? world.raceTicks)));
      const best = bests[world.course.id];
      label(this.bestTime, best === undefined ? '—' : formatTime(tenths(best)));
      show(this.badge, newBest);
    }
  }
}
