import { TICK_HZ } from '@arcade/core';
import { CAST } from '../../logic/characters.ts';
import type { GameEvent } from '../../logic/events.ts';
import type { SaveData } from '../../logic/save.ts';
import { placeOf, places } from '../../logic/standings.ts';
import { DASH, RACE } from '../../logic/tuning.ts';
import type { World } from '../../logic/types.ts';
import { playerOf } from '../../logic/world.ts';
import { RACER_COLORS } from '../racers/racer-geometry.ts';
import type { EngineEvent, Scene } from '../runtime.ts';
import { HUD_CSS } from './hud-style.ts';
import { InventoryHud } from './inventory-hud.ts';

const ORDINAL = ['1st', '2nd', '3rd', '4th'];
type Hint = 'countdown' | 'items' | null;

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

/** DOM overlay for race status and results. */
export class Hud {
  private readonly race = document.createElement('div');
  private readonly clock = document.createElement('span');
  private readonly place = document.createElement('span');
  private readonly progress = document.createElement('div');
  private readonly markers: { node: HTMLSpanElement; label: string; offset: number }[] = [];
  private readonly dash = document.createElement('div');
  private readonly pips = Array.from({ length: DASH.charges }, () => document.createElement('i'));
  private readonly inventory = new InventoryHud();
  private readonly count = document.createElement('div');
  private readonly hint = document.createElement('p');
  private readonly keyboardHint = document.createElement('span');
  private readonly touchHint = document.createElement('span');
  private readonly results = document.createElement('section');
  private readonly standings = document.createElement('ol');
  private readonly bestTime = document.createElement('span');
  private readonly badge = document.createElement('strong');
  private eventWorld: World | undefined;
  private goUntil = -1;
  private newBest = false;
  private raceWorld: World | undefined;
  private resultsWorld: World | undefined;
  private raceTick = -1;
  private time = -1;
  private playerPlace = -1;
  private charges = -1;
  private countSecond: number | null = null;
  private bestTicks: number | undefined;
  private hintMode: Hint = null;

  constructor(container: HTMLElement) {
    const root = document.createElement('div');
    root.className = 'rr3d-hud';
    const style = document.createElement('style');
    style.textContent = HUD_CSS;
    const info = document.createElement('div');
    info.className = 'rr3d-race-info';
    this.place.className = 'rr3d-place';
    this.progress.className = 'rr3d-progress';
    this.progress.setAttribute('role', 'img');
    info.append(this.clock, this.place, this.progress);
    this.count.className = 'rr3d-count';
    this.count.setAttribute('aria-live', 'polite');
    this.dash.className = 'rr3d-dash';
    this.dash.setAttribute('role', 'img');
    this.dash.append('Dash', ...this.pips);
    this.hint.className = 'rr3d-race-hint';
    this.keyboardHint.className = 'rr3d-keyboard-keys';
    this.touchHint.className = 'rr3d-touch-keys';
    this.hint.hidden = true;
    this.hint.append(this.keyboardHint, this.touchHint);
    this.race.append(info, this.dash, this.inventory.root, this.count, this.hint);
    this.race.hidden = true;

    this.results.className = 'rr3d-results';
    this.results.hidden = true;
    this.results.setAttribute('aria-live', 'polite');
    const heading = document.createElement('h2');
    heading.textContent = 'Race results';
    const best = document.createElement('p');
    best.className = 'rr3d-best';
    this.bestTime.textContent = '—';
    this.badge.className = 'rr3d-badge';
    this.badge.textContent = 'NEW BEST';
    best.append('Best ', this.bestTime, this.badge);
    const retry = document.createElement('p');
    retry.textContent = 'Press Enter or ★ to race again';
    const choose = document.createElement('p');
    choose.textContent = 'X or B: choose another racer';
    this.results.append(heading, this.standings, best, retry, choose);
    root.append(style, this.race, this.results);
    container.append(root);
  }

  /** Updates banners and pickup flashes from events drained after each tick. */
  onEvent(event: GameEvent | EngineEvent, world: World): void {
    this.useWorld(world);
    if (event.type === 'race.started') this.goUntil = world.tick + 45;
    if (event.type === 'best.new' && event.course === world.course.id) this.newBest = true;
    if (event.type === 'crate.opened' && event.id === 'player') this.inventory.flashPickup(event.slot, world.tick);
  }

  private useWorld(world: World): void {
    if (this.eventWorld === world) return;
    this.eventWorld = world;
    this.goUntil = -1;
    this.newBest = false;
    this.inventory.resetFlashes();
  }

  /** Syncs the current screen. Race-only values may change while the clock is ticking. */
  sync(world: World, scene: Scene, bests: SaveData['bests']): void {
    this.useWorld(world);
    show(this.race, scene === 'race');
    show(this.results, scene === 'results');
    if (scene === 'race') {
      this.syncRace(world);
      this.syncCountdown(world);
    } else if (scene === 'results') {
      this.syncResults(world, bests[world.course.id]);
    }
  }

  private syncRace(world: World): void {
    const newWorld = this.raceWorld !== world;
    if (!newWorld && world.tick === this.raceTick) return;
    this.raceWorld = world;
    this.raceTick = world.tick;
    const player = playerOf(world);
    const hasItems = this.inventory.sync(world.tick, player);
    this.syncHint(world.phase === 'countdown' ? 'countdown' : hasItems ? 'items' : null);
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
    const place = placeOf(world, player.id);
    if (place !== this.playerPlace) {
      this.playerPlace = place;
      this.place.textContent = ORDINAL[place - 1] ?? String(place);
    }
    this.syncProgress(world, newWorld);
  }

  private syncHint(hint: Hint): void {
    if (hint === this.hintMode) return;
    this.hintMode = hint;
    if (hint === 'countdown') {
      this.keyboardHint.textContent = '↑ Run · ← → Steer · Space Jump · X Dash';
      this.touchHint.textContent = '↑\u00a0Run · ←\u00a0→\u00a0Steer · A\u00a0Jump · B\u00a0Dash';
    } else if (hint === 'items') {
      this.keyboardHint.textContent = 'Q/E Select · Z Use';
      this.touchHint.textContent = '⇄ Select · ★ Use';
    }
    show(this.hint, hint !== null);
  }

  private syncProgress(world: World, newWorld: boolean): void {
    if (newWorld) {
      this.markers.length = 0;
      this.progress.replaceChildren();
      for (const racer of world.racers) {
        const lane = document.createElement('div');
        lane.className = 'rr3d-lane';
        const node = document.createElement('span');
        node.className = 'rr3d-marker';
        const player = racer.id === 'player';
        if (player) node.dataset.player = '';
        else node.style.backgroundColor = `#${RACER_COLORS[racer.character].toString(16).padStart(6, '0')}`;
        lane.append(node);
        this.progress.append(lane);
        this.markers.push({ node, label: CAST[racer.character].name + (player ? ' (you)' : ''), offset: -1 });
      }
    }
    const { startS, finishS } = world.course;
    let labelChanged = newWorld;
    for (let slot = 0; slot < world.racers.length; slot++) {
      const racer = world.racers[slot];
      const marker = this.markers[slot];
      if (!racer || !marker) continue;
      const progress = Math.min(1, Math.max(0, (racer.s - startS) / (finishS - startS)));
      const offset = Math.round(progress * 1000);
      if (offset === marker.offset) continue;
      labelChanged ||= Math.round(offset / 10) !== Math.round(marker.offset / 10);
      marker.offset = offset;
      marker.node.style.left = `${offset / 10}%`;
    }
    if (labelChanged) {
      const racers = this.markers.map((marker) => `${marker.label} ${Math.round(marker.offset / 10)}%`);
      const label = `Race progress. ${racers.join(', ')}.`;
      if (label !== this.progress.getAttribute('aria-label')) this.progress.setAttribute('aria-label', label);
    }
  }

  private syncCountdown(world: World): void {
    const second =
      world.phase === 'countdown'
        ? Math.max(1, Math.ceil((RACE.countdownTicks - world.tick) / TICK_HZ))
        : world.tick < this.goUntil
          ? 0
          : null;
    if (second !== this.countSecond) {
      this.countSecond = second;
      this.count.textContent = second === null ? '' : second === 0 ? 'GO' : String(second);
    }
    show(this.count, second !== null);
  }

  private syncResults(world: World, best: number | undefined): void {
    if (world !== this.resultsWorld) {
      this.resultsWorld = world;
      this.standings.replaceChildren();
      for (const [index, id] of places(world).entries()) {
        const racer = world.racers.find((entry) => entry.id === id);
        if (!racer) continue;
        const row = document.createElement('li');
        if (id === 'player') row.dataset.player = '';
        const place = document.createElement('span');
        place.textContent = ORDINAL[index] ?? String(index + 1);
        const name = document.createElement('span');
        name.textContent = CAST[racer.character].name + (id === 'player' ? ' (You)' : '');
        const time = document.createElement('span');
        time.textContent = racer.finishTicks === null ? 'DNF' : formatTime(tenths(racer.finishTicks));
        row.append(place, name, time);
        this.standings.append(row);
      }
    }
    if (best !== this.bestTicks) {
      this.bestTicks = best;
      this.bestTime.textContent = best === undefined ? '—' : formatTime(tenths(best));
    }
    show(this.badge, this.newBest);
  }
}
