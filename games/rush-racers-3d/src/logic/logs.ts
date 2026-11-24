/** Swept collision with solid logs in track space. */
import type { EventSink } from '@arcade/core';
import { groundY, type LogFeature } from './course.ts';
import type { GameEvent } from './events.ts';
import { RUN } from './tuning.ts';
import type { Course, Racer } from './types.ts';

type LogHit = { log: LogFeature; front: boolean; side: number; time: number };

/** The height of a log's top in track space. */
export function topOf(course: Course, log: LogFeature): number {
  return groundY(course, log.s) + log.height;
}

/** Resolves log contacts along a move and stops the velocity on each blocked axis. */
export function resolveLogs(
  racer: Racer,
  { course, events }: { course: Course; events: EventSink<GameEvent> },
  s: number,
  d: number,
  y: number,
  followsGround: boolean,
): { s: number; d: number } {
  let from: Pick<Racer, 's' | 'd' | 'y'> = racer;
  // Each contact blocks one axis. Check for a second contact along the face of the first log.
  for (let contacts = 0; contacts < 2; contacts++) {
    const hit = logHit(from, course, s, d, y, followsGround);
    if (!hit) break;
    const contactS = hit.front ? hit.log.s : from.s + (s - from.s) * hit.time;
    const contactD = hit.front ? from.d + (d - from.d) * hit.time : hit.side;
    if (hit.front) {
      s = contactS;
      racer.vs = 0;
    } else {
      d = contactD;
      racer.vd = 0;
    }
    if (hit.time > 0) events.emit({ type: 'racer.bumped', id: racer.id, s: contactS, by: null });
    from = { s: contactS, d: contactD, y: from.y + (y - from.y) * hit.time };
  }
  return { s, d };
}

/** The first log face crossed while the racer's feet are below its top. */
function logHit(
  racer: Pick<Racer, 's' | 'd' | 'y'>,
  course: Course,
  s: number,
  d: number,
  y: number,
  followsGround: boolean,
): LogHit | undefined {
  const ds = s - racer.s;
  const dd = d - racer.d;
  let hit: LogHit | undefined;
  for (const log of course.features) {
    if (log.kind !== 'log' || s < log.s || racer.s >= log.s + RUN.logDepth) continue;
    const frontTime = ds > 0 ? (log.s - racer.s) / ds : -Infinity;
    const side = dd > 0 ? log.d0 : log.d1;
    const sideTime = dd !== 0 ? (side - racer.d) / dd : -Infinity;
    const time = Math.max(frontTime, sideTime);
    if (time < 0 || time > 1 || (hit && hit.time <= time)) continue;
    const contactS = racer.s + ds * time;
    const contactD = racer.d + dd * time;
    const front = frontTime >= sideTime;
    if (front && (contactD < log.d0 || contactD >= log.d1)) continue;
    if (!front && (contactS <= log.s || contactS >= log.s + RUN.logDepth)) continue;
    const height = followsGround ? groundY(course, contactS) : racer.y + (y - racer.y) * time;
    if (height < topOf(course, log)) hit = { log, front, side, time };
  }
  return hit;
}
