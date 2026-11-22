/**
 * The attack power-ups that live in the water, drawn from world state each frame: Homing Squids
 * in flight (turned to their heading, swimming), Riptide lanes (a green wash with streaks that
 * run along the lane, over whatever current is under it) and Mimic decoys (the owner's own sprite,
 * a little see-through and cool-tinted so a second look gives it away). What happens to a racer
 * (the squid wrapped round them, the pull lines) is in `powerup-view.ts`. Sprites come from pools
 * that grow only when more are in play than ever before. Under reduced motion squids hold one
 * frame, lane streaks stand still and decoys hold a steady see-through look.
 */
import type Phaser from 'phaser';
import { type Decoy, type Riptide, type Squid, TILE, type World } from '../../logic/types.ts';
import { Frame, Tex } from '../art/keys.ts';
import { RIPTIDE_TILE } from '../art/sprites/attack.ts';
import { Layer } from './layers.ts';

/** Draws every squid, lane and decoy in `world`. */
export interface AttackView {
  sync(world: World, tick: number): void;
}

const SQUID_FRAME_TICKS = 6;
/** A squid points to the nearest 22.5 degrees, so the pixels stay crisp. */
const SQUID_TURN_STEP = Math.PI / 8;
const LANE_FRAME_TICKS = 8;
const LANE_WASH = 0x2cc47a;
const LANE_EDGE = 0xd8ffe8;
const LANE_WASH_ALPHA = 0.16;
const LANE_EDGE_ALPHA = 0.7;
/** A lane fades out over its last this-many ticks. */
const LANE_FADE_TICKS = 30;
const DECOY_TINT = 0xcfe8ff;
const DECOY_ALPHA = { low: 0.72, high: 0.9, steady: 0.8 } as const;
const DECOY_SHIMMER_TICKS = 48;
/** A decoy blinks for its last this-many ticks, every DECOY_BLINK_TICKS, or sits at this alpha when motion is reduced. */
const DECOY_EXPIRY_TICKS = 45;
const DECOY_BLINK_TICKS = 10;
const DECOY_EXPIRING_ALPHA = 0.4;
const DECOY_STROKE_TICKS = 14;

/** One lane's pieces: the wash, two edge lines and a pool of streak tiles. */
interface LaneSprites {
  wash: Phaser.GameObjects.Rectangle;
  edges: [Phaser.GameObjects.Rectangle, Phaser.GameObjects.Rectangle];
  tiles: Phaser.GameObjects.Image[];
}

/** Adds the views for the world's squids, riptides and decoys to `scene`. */
export function createAttackView(scene: Phaser.Scene, reducedMotion: boolean): AttackView {
  const squids: Phaser.GameObjects.Image[] = [];
  const lanes: LaneSprites[] = [];
  const decoys: Phaser.GameObjects.Image[] = [];

  return {
    sync(world, tick) {
      syncPool(squids, world.squids.length, () =>
        scene.add.image(0, 0, Tex.squid, Frame.a).setDepth(Layer.racers + 0.4),
      );
      world.squids.forEach((squid, index) => {
        showSquid(squids[index], squid, tick, reducedMotion);
      });

      syncLanes(scene, lanes, world.riptides.length);
      world.riptides.forEach((riptide, index) => {
        showLane(scene, lanes[index], riptide, tick, reducedMotion);
      });

      syncPool(decoys, world.decoys.length, () =>
        scene.add.image(0, 0, Tex.rudy, Frame.a).setDepth(Layer.racers - 0.1),
      );
      world.decoys.forEach((decoy, index) => {
        showDecoy(decoys[index], decoy, world, tick, reducedMotion);
      });
    },
  };
}

/** Grows `pool` to `count` with `make`, then hides the sprites beyond it; `count` of them are left for the caller to place. */
function syncPool(pool: Phaser.GameObjects.Image[], count: number, make: () => Phaser.GameObjects.Image): void {
  while (pool.length < count) pool.push(make());
  for (let index = count; index < pool.length; index++) pool[index]?.setVisible(false);
}

function showSquid(
  sprite: Phaser.GameObjects.Image | undefined,
  squid: Squid,
  tick: number,
  reducedMotion: boolean,
): void {
  if (!sprite) return;
  const stroke = reducedMotion || Math.floor(tick / SQUID_FRAME_TICKS) % 2 === 0 ? Frame.a : Frame.b;
  sprite
    .setVisible(true)
    .setFrame(stroke)
    .setPosition(Math.round(squid.x), Math.round(squid.y))
    .setFlipX(squid.vx < 0)
    .setRotation(squidRotation(squid.vx, squid.vy));
}

/**
 * The rotation for a squid heading (vx, vy): the sprite points right, and a left-heading squid is
 * flipped (so it is never upside down) and turned the other way. A squid at rest points right.
 */
export function squidRotation(vx: number, vy: number): number {
  if (vx === 0 && vy === 0) return 0;
  const angle = vx < 0 ? Math.atan2(-vy, -vx) : Math.atan2(vy, vx);
  return Math.round(angle / SQUID_TURN_STEP) * SQUID_TURN_STEP;
}

/** Makes sure there is one set of lane sprites per riptide in play. */
function syncLanes(scene: Phaser.Scene, lanes: LaneSprites[], count: number): void {
  while (lanes.length < count) {
    const rect = (alpha: number, colour: number) =>
      scene.add
        .rectangle(0, 0, 1, 1, colour, alpha)
        .setOrigin(0, 0)
        .setDepth(Layer.objects + 0.1);
    lanes.push({
      wash: rect(LANE_WASH_ALPHA, LANE_WASH),
      edges: [rect(LANE_EDGE_ALPHA, LANE_EDGE), rect(LANE_EDGE_ALPHA, LANE_EDGE)],
      tiles: [],
    });
  }
  for (let index = count; index < lanes.length; index++) hideLane(lanes[index]);
}

function hideLane(lane: LaneSprites | undefined): void {
  if (!lane) return;
  lane.wash.setVisible(false);
  for (const edge of lane.edges) edge.setVisible(false);
  for (const tile of lane.tiles) tile.setVisible(false);
}

/**
 * A lane's wash, edge lines (along the flow, on both long sides) and streak tiles. A lane is a
 * box with a flow along one axis; the streak tiles point right and are turned to that axis.
 */
function showLane(
  scene: Phaser.Scene,
  lane: LaneSprites | undefined,
  riptide: Riptide,
  tick: number,
  reducedMotion: boolean,
): void {
  if (!lane) return;
  const alpha = Math.min(1, riptide.ttl / LANE_FADE_TICKS);
  const alongX = Math.abs(riptide.dir.x) >= Math.abs(riptide.dir.y);
  const { x, y, w, h } = riptide;
  lane.wash
    .setVisible(true)
    .setPosition(x, y)
    .setSize(w, h)
    .setAlpha(LANE_WASH_ALPHA * alpha);
  const [first, second] = lane.edges;
  const edge = alongX ? { w, h: 1 } : { w: 1, h };
  first
    .setVisible(true)
    .setPosition(x, y)
    .setSize(edge.w, edge.h)
    .setAlpha(LANE_EDGE_ALPHA * alpha);
  second
    .setVisible(true)
    .setPosition(alongX ? x : x + w - 1, alongX ? y + h - 1 : y)
    .setSize(edge.w, edge.h)
    .setAlpha(LANE_EDGE_ALPHA * alpha);

  const columns = Math.ceil(w / RIPTIDE_TILE);
  const rows = Math.ceil(h / RIPTIDE_TILE);
  const needed = columns * rows;
  while (lane.tiles.length < needed) {
    lane.tiles.push(scene.add.image(0, 0, Tex.riptideStreak, Frame.a).setDepth(Layer.objects + 0.2));
  }
  const frame = reducedMotion || Math.floor(tick / LANE_FRAME_TICKS) % 2 === 0 ? Frame.a : Frame.b;
  const rotation = laneRotation(riptide);
  lane.tiles.forEach((tile, index) => {
    tile.setVisible(index < needed);
    if (index >= needed) return;
    tile
      .setFrame(frame)
      .setRotation(rotation)
      .setAlpha(alpha)
      .setPosition(
        x + (index % columns) * RIPTIDE_TILE + TILE / 2,
        y + Math.floor(index / columns) * RIPTIDE_TILE + TILE / 2,
      );
  });
}

/** The tile rotation that points its streaks along the lane's flow: right, down, left or up. */
export function laneRotation(riptide: Pick<Riptide, 'dir'>): number {
  const { x, y } = riptide.dir;
  if (Math.abs(x) >= Math.abs(y)) return x >= 0 ? 0 : Math.PI;
  return y >= 0 ? Math.PI / 2 : -Math.PI / 2;
}

/** The owner's sprite, see-through and cool-tinted, shimmering; it blinks as it is about to expire. */
function showDecoy(
  sprite: Phaser.GameObjects.Image | undefined,
  decoy: Decoy,
  world: World,
  tick: number,
  reducedMotion: boolean,
): void {
  if (!sprite) return;
  const owner = world.racers.find((racer) => racer.id === decoy.owner);
  if (!owner) return;
  sprite
    .setVisible(true)
    .setTexture(Tex[owner.character], Math.floor(tick / DECOY_STROKE_TICKS) % 2 === 0 ? Frame.a : Frame.b)
    .setPosition(Math.round(decoy.x), Math.round(decoy.y))
    .setFlipX(decoy.vx === 0 ? sprite.flipX : decoy.vx < 0)
    .setTint(DECOY_TINT)
    .setAlpha(decoyAlpha(decoy.ttl, tick, reducedMotion));
}

/** A decoy's opacity: a slow shimmer, blinking over its last ticks; steady under reduced motion. */
export function decoyAlpha(ttl: number, tick: number, reducedMotion: boolean): number {
  const expiring = ttl <= DECOY_EXPIRY_TICKS;
  if (reducedMotion) return expiring ? DECOY_EXPIRING_ALPHA : DECOY_ALPHA.steady;
  if (expiring && Math.floor(tick / DECOY_BLINK_TICKS) % 2 === 1) return DECOY_EXPIRING_ALPHA;
  const wave = (Math.sin((tick / DECOY_SHIMMER_TICKS) * Math.PI * 2) + 1) / 2;
  return DECOY_ALPHA.low + (DECOY_ALPHA.high - DECOY_ALPHA.low) * wave;
}
