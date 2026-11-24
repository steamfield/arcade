/**
 * Traffic in the air, as local steering: the way itself never changes. A flight rival closing on a
 * racer just ahead at its own height passes it over or under where the sky is open (`pass.ts`). With
 * no room to pass it follows a little behind at the leader's speed instead of bumping into it; it
 * also stops behind a racer that is hardly moving when it means to stop there too (waiting at a storm
 * zone) or its target lies at or past that racer. A leader hardly moving otherwise is stuck, and it
 * flies on as if the way were clear; one flying back at it is `oncoming`, which the pilot reads as the
 * way past it being shut.
 */
import { centreOf } from '../../racers.ts';
import type { Racer, Vec, World } from '../../types.ts';
import { alongTo, GAP_PX, LOOK_AHEAD_PX, type PassLine, passingNow, passLine, racing } from './pass.ts';
import type { FlightPilotNumbers } from './stick.ts';
import type { FlightPilot } from './way-data.ts';

/** Px/s the flyer must be closing at before a racer ahead is in its way. */
const CLOSING_SPEED = 15;
/** Extra px, past touching, a follower keeps between its centre and the leader's. */
const FOLLOW_SLACK_PX = 8;
/** Px/s of speed a follower adds per px it is further back than it means to be. */
const FOLLOW_GAIN = 4;
/** Px/s a leader must be flying on at for the flyer to follow it; one slower is stuck, and following it would stall. */
const FOLLOW_MIN_SPEED = 30;

/** What a racer ahead means for the flyer this tick. */
export type Traffic =
  | { kind: 'clear' }
  /** Fly this line (`PassLine`) to go over or under the racer ahead. */
  | ({ kind: 'pass' } & PassLine)
  /**
   * No room to pass: hold `speed` (px/s, signed) to stay just behind, and close no more than `room`
   * px along `travel` (negative when already too close).
   */
  | { kind: 'follow'; speed: number; room: number; travel: -1 | 1 }
  /** No room to pass, and the racer ahead is flying back at the flyer: the way past it is likely shut. */
  | { kind: 'oncoming' };

/**
 * What the racer ahead means for `racer` flying `travel` (-1 left, 1 right) toward `target`: the
 * racer it is trying to pass, or else the nearest in its way, passed on an open side (`pass.ts`,
 * which records the attempt in `memory.pass`) or followed, or nothing in the way.
 */
export function readTraffic(
  world: World,
  racer: Racer,
  memory: FlightPilot,
  numbers: FlightPilotNumbers,
  travel: -1 | 1,
  target: Vec,
): Traffic {
  const leader = passingNow(world, racer, memory, travel) ?? leaderAhead(world, racer, travel);
  if (!leader) return { kind: 'clear' };
  const line = passLine(world, racer, memory, numbers, leader, travel, target.y);
  if (line) return { kind: 'pass', ...line };
  return unpassable(racer, memory, leader, travel, target);
}

/**
 * The nearest racer ahead of `racer` along `travel`, within LOOK_AHEAD_PX, overlapping its height
 * (boxes closer than GAP_PX), still racing, that `racer` is closing on or is already as close to as
 * a follower keeps. Null when there is none.
 */
function leaderAhead(world: World, racer: Racer, travel: -1 | 1): Racer | null {
  const centre = centreOf(racer);
  let nearest: Racer | null = null;
  let nearestAlong = LOOK_AHEAD_PX;
  for (const other of world.racers) {
    if (other === racer || !racing(other)) continue;
    const along = alongTo(racer, other, travel);
    const sameHeight = Math.abs(centreOf(other).y - centre.y) < (racer.body.h + other.body.h) / 2 + GAP_PX;
    const closing = (racer.body.vx - other.body.vx) * travel > CLOSING_SPEED;
    const close = along <= followGap(racer, other);
    if (along <= 0 || along > nearestAlong || !sameHeight || !(closing || close)) continue;
    nearest = other;
    nearestAlong = along;
  }
  return nearest;
}

/**
 * What a racer ahead with no room to pass means: follow it when it is flying on, `oncoming` when it
 * flies back at FOLLOW_MIN_SPEED or more, follow (to a stop behind it) when the flyer `holdsBehind`
 * it, and nothing (fly on past a stuck racer) otherwise.
 */
function unpassable(racer: Racer, memory: FlightPilot, leader: Racer, travel: -1 | 1, target: Vec): Traffic {
  const leaderSpeed = leader.body.vx * travel;
  if (leaderSpeed >= FOLLOW_MIN_SPEED) return follow(racer, leader, travel);
  if (leaderSpeed <= -FOLLOW_MIN_SPEED) return { kind: 'oncoming' };
  return holdsBehind(racer, memory, leader, travel, target) ? follow(racer, leader, travel) : { kind: 'clear' };
}

/**
 * Whether the flyer should stop behind a slow `leader` rather than fly on into it: it is waiting at a
 * storm zone itself (the leader is waiting at the same spot), or it is already as close as a follower
 * keeps and its target lies at or past the leader.
 */
function holdsBehind(racer: Racer, memory: FlightPilot, leader: Racer, travel: -1 | 1, target: Vec): boolean {
  if (memory.stormHold) return true;
  const along = alongTo(racer, leader, travel);
  return along <= followGap(racer, leader) && (target.x - centreOf(racer).x) * travel >= along;
}

/**
 * Following `leader`: its speed, plus FOLLOW_GAIN per px the flyer is further back than the follow
 * gap, never backwards; and the px it may still close before reaching that gap.
 */
function follow(racer: Racer, leader: Racer, travel: -1 | 1): Traffic {
  const room = alongTo(racer, leader, travel) - followGap(racer, leader);
  const speed = travel * Math.max(0, leader.body.vx * travel + room * FOLLOW_GAIN);
  return { kind: 'follow', speed, room, travel };
}

/** Centre-to-centre px a follower keeps behind `leader`: touching plus FOLLOW_SLACK_PX. */
function followGap(racer: Racer, leader: Racer): number {
  return (racer.body.w + leader.body.w) / 2 + FOLLOW_SLACK_PX;
}
