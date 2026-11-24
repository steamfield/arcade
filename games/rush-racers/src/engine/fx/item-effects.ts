/**
 * Plays the item recipes (`item-recipes.ts`) from one tick's events: each power-up's fire at the
 * racer that used it, a hit's burst by its cause, a Bubble Shield's shards, speed lines strung
 * along a new Riptide lane and trailing each racer an Undertow catches, and where a Meteor lands or
 * a Comet ends (a Boulder draws its own dust, and a shot that fizzled had nothing in the air). Positions come from the
 * world as it stands after the tick. Shake for the same events is `event-effects.ts`'s.
 */
import type { Stamped } from '@arcade/core';
import type { ThemeId } from '../../logic/courses/types.ts';
import {
  type CannonballShotStyle,
  POWER_UP_KINDS,
  type PowerUpKind,
  type Racer,
  type RacerId,
  type ShotEndReason,
  type World,
} from '../../logic/types.ts';
import type { RuntimeEvent } from '../runtime.ts';
import { fireRecipe, impactRecipe, laneRecipe, pulledRecipe, shieldPopRecipe } from './item-recipes.ts';
import { MATERIALS } from './materials.ts';
import type { RecipePlayer } from './recipe-player.ts';
import type { Recipe } from './recipe-types.ts';

/** Reacts to each tick's item events. */
export interface ItemEffects {
  onTick(events: readonly Stamped<RuntimeEvent>[]): void;
}

/** A new Riptide lane gets a speed line every this many px of its length. */
const LANE_LINE_SPACING = 12;
/** Below this speed (px/s) a racer's heading is the way it faces rather than the way it moves. */
const HEADING_MIN_SPEED = 20;

/** Builds the item effects for `world`, drawn in theme `theme`, played through `player`. */
export function createItemEffects(world: World, theme: ThemeId, player: RecipePlayer): ItemEffects {
  const fires = Object.fromEntries(POWER_UP_KINDS.map((kind) => [kind, fireRecipe(kind, theme)])) as Record<
    PowerUpKind,
    Recipe
  >;
  const shards = shieldPopRecipe(theme);
  const lane = laneRecipe(theme);
  const pulled = pulledRecipe(theme);

  const meteorLanding = shotEndRecipe('meteor', theme);
  const cometEnd = shotEndRecipe('comet', theme);

  const playOn = (id: RacerId, recipe: Recipe, heading: (racer: Racer) => [number, number] = headingOf) => {
    const racer = world.racers.find((candidate) => candidate.id === id);
    if (!racer) return;
    player.play(recipe, racer.body.x + racer.body.w / 2, racer.body.y + racer.body.h / 2, ...heading(racer));
  };

  const playEvent = (event: Stamped<RuntimeEvent>) => {
    switch (event.type) {
      case 'item.used':
        return playOn(event.id, fires[event.kind]);
      case 'racer.hit':
        return playOn(event.id, impactRecipe(event.cause, theme));
      case 'shield.popped':
        return playOn(event.id, shards);
      case 'riptide.spawned':
        return stringLane(world, event.owner, (x, y, dirX, dirY) => player.play(lane, x, y, dirX, dirY));
      case 'shot.ended': {
        const recipe = shotEndRecipeFor(event.style, event.reason, meteorLanding, cometEnd);
        if (recipe) player.play(recipe, event.x, event.y, 0, -1);
        return;
      }
      case 'undertow.fired':
        // Dragged back the way they came, so the lines trail out ahead of them.
        for (const id of event.pulled) playOn(id, pulled, (racer) => [-racer.facing, 0]);
        return;
    }
  };

  return {
    onTick(events) {
      for (const event of events) playEvent(event);
    },
  };
}

/** The unit direction `racer` is heading: its dash, else its velocity, else the way it faces. */
function headingOf(racer: Racer): [number, number] {
  if (racer.status.dashing > 0) return [racer.dashDir.x, racer.dashDir.y];
  const { vx, vy } = racer.body;
  const speed = Math.hypot(vx, vy);
  if (speed < HEADING_MIN_SPEED) return [racer.facing, 0];
  return [vx / speed, vy / speed];
}

/** Calls `line` at every spacing along the newest lane `owner` laid, with the lane's flow direction. */
function stringLane(
  world: World,
  owner: RacerId,
  line: (x: number, y: number, dirX: number, dirY: number) => void,
): void {
  const riptide = world.riptides.findLast((candidate) => candidate.owner === owner);
  if (!riptide) return;
  const alongX = Math.abs(riptide.dir.x) >= Math.abs(riptide.dir.y);
  const length = alongX ? riptide.w : riptide.h;
  for (let along = 0; along < length; along += LANE_LINE_SPACING) {
    const x = alongX ? riptide.x + along : riptide.x + riptide.w / 2;
    const y = alongX ? riptide.y + riptide.h / 2 : riptide.y + along;
    line(x, y, riptide.dir.x, riptide.dir.y);
  }
}

/** Which of the two prebuilt recipes a shot's end plays: none for a Boulder or a fizzle, dust only for a Meteor that landed. */
function shotEndRecipeFor(
  style: CannonballShotStyle,
  reason: ShotEndReason,
  meteorLanding: Recipe,
  cometEnd: Recipe,
): Recipe | null {
  if (reason === 'fizzled') return null;
  if (style === 'meteor') return reason === 'landed' ? meteorLanding : null;
  if (style === 'comet') return cometEnd;
  return null;
}

/** The look of a Meteor landing (a ring of dust thrown out along the ground) or a Comet ending (a short scatter of sparks) in `theme`. */
function shotEndRecipe(style: 'meteor' | 'comet', theme: ThemeId): Recipe {
  const materials = MATERIALS[theme];
  if (style === 'meteor') {
    return [
      {
        pattern: 'ring',
        look: materials.dust,
        motion: 'fall',
        count: 14,
        radius: 8,
        speed: 2,
        life: 22,
        layer: 'front',
      },
    ];
  }
  return [
    {
      pattern: 'scatter',
      look: materials.spark,
      motion: 'coast',
      count: 8,
      radius: 6,
      speed: 2,
      life: 12,
      layer: 'front',
    },
  ];
}
