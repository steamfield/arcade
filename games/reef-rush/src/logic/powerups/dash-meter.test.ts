import type { EventLog } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import { PLAYER_PROFILE } from '../ai/profiles.ts';
import type { GameEvent } from '../events.ts';
import { SWIM_TUNING } from '../media/swim/tuning.ts';
import { eventsIn, hold, IDLE, raceOn, racerOf, step } from '../test-world.ts';
import type { RacerId, World } from '../types.ts';
import { DASH_METER, dashCharges } from './dash-meter.ts';

/** Four walled lanes, 200 tiles long so nobody finishes within ten seconds of dashing. */
const LANES = (() => {
  const wall = '#'.repeat(200);
  const lane = (start: number) => `#${start}${'.'.repeat(196)}F#`;
  return [wall, lane(1), wall, lane(2), wall, lane(3), wall, lane(4), wall].join('\n');
})();

const DASH = hold({ x: 1, y: 0 }, { kick: true });
const SWIM = hold({ x: 1, y: 0 });
const COOLDOWN = SWIM_TUNING.base.kickCooldownTicks;

/** A racing world in walled lanes whose rivals are stunned for good, so only the player acts. */
function playerAlone() {
  const { world, log } = raceOn(LANES);
  for (const id of ['tess', 'squib', 'bo'] as const) racerOf(world, id).status.stunned = 100_000;
  return { world, log, player: racerOf(world, 'player') };
}

/** World ticks on which `id` kicked. */
function kicksOf(log: EventLog<GameEvent>, id: RacerId): number[] {
  return log
    .all()
    .filter((event) => event.type === 'racer.kicked' && event.id === id)
    .map((event) => event.tick);
}

describe('the dash meter', () => {
  it('starts every racer with two charges, and a dash spends one', () => {
    const { world, log, player } = playerAlone();
    expect(world.racers.map(dashCharges)).toEqual([2, 2, 2, 2]);

    step(world, log, 1, DASH);

    expect(eventsIn(log, 'racer.kicked')).toEqual([{ type: 'racer.kicked', id: 'player' }]);
    expect(dashCharges(player)).toBe(1);
  });

  it('does nothing for a dash press with the meter empty: no kick and no impulse', () => {
    const dashed = playerAlone();
    const swam = playerAlone();
    for (const { world, log } of [dashed, swam]) step(world, log, 30, SWIM);
    dashed.player.kickCharges = 0;
    swam.player.kickCharges = 0;

    step(dashed.world, dashed.log, 1, DASH);
    step(swam.world, swam.log, 1, SWIM);

    expect(eventsIn(dashed.log, 'racer.kicked')).toEqual([]);
    expect(dashed.player.body).toEqual(swam.player.body);
    expect(dashed.player.kickCharges).toBe(0);
  });

  it('keeps the gap between dashes, then runs dry and dashes again only as charges return', () => {
    const { world, log, player } = playerAlone();
    const start = world.tick + 1;

    step(world, log, 200, DASH);

    // Two dashes a cooldown apart empty the meter; each later one waits for a charge.
    expect(kicksOf(log, 'player').map((tick) => tick - start)).toEqual([
      0,
      COOLDOWN + 1,
      DASH_METER.rechargeTicks,
      2 * DASH_METER.rechargeTicks,
    ]);
    expect(player.kickCharges).toBe(0);
  });

  it('brings one charge back every rechargeTicks below the cap, announcing each, and stops at the cap', () => {
    const { world, log, player } = playerAlone();
    const start = world.tick + 1;
    step(world, log, 1, DASH);
    step(world, log, COOLDOWN, SWIM);
    step(world, log, 1, DASH);
    expect(player.kickCharges).toBe(0);

    step(world, log, 400, SWIM);

    const recharges = log.all().filter((event) => event.type === 'racer.dashRecharged' && event.id === 'player');
    expect(recharges.map(({ tick, seq: _seq, ...event }) => ({ at: tick - start, ...event }))).toEqual([
      { at: DASH_METER.rechargeTicks - 1, type: 'racer.dashRecharged', id: 'player', charges: 1 },
      { at: 2 * DASH_METER.rechargeTicks - 1, type: 'racer.dashRecharged', id: 'player', charges: 2 },
    ]);
    expect(player.kickCharges).toBe(DASH_METER.charges);
  });

  it('spends a charge on a dash that shakes off part of a squid latch', () => {
    const { world, log, player } = playerAlone();
    player.status.latched = 90;

    step(world, log, 1, DASH);

    expect(eventsIn(log, 'racer.kicked')).toEqual([{ type: 'racer.kicked', id: 'player' }]);
    expect(player.status.latched).toBeLessThan(89);
    expect(player.kickCharges).toBe(1);
  });
});

describe('rivals on the dash meter', () => {
  /** What a racer was like at the start of a tick on which it kicked with its last charge. */
  interface LastChargeKick {
    id: RacerId;
    latched: boolean;
    place: number;
  }

  /** Steps `ticks` times, listing every kick made with the racer's last charge. */
  function lastChargeKicks(world: World, log: EventLog<GameEvent>, ticks: number): LastChargeKick[] {
    const found: LastChargeKick[] = [];
    for (let i = 0; i < ticks; i++) {
      const before = world.racers.map((racer) => ({
        id: racer.id,
        charges: racer.kickCharges,
        latched: racer.status.latched > 0,
        place: racer.place,
      }));
      step(world, log, 1, IDLE);
      const kicked = new Set(
        log.all().flatMap((event) => (event.type === 'racer.kicked' && event.tick === world.tick ? [event.id] : [])),
      );
      for (const { charges, ...was } of before) if (kicked.has(was.id) && charges <= 1) found.push(was);
    }
    return found;
  }

  it('keep their last charge unless they trail the leader by more than 2 places or are latched, and dash with the rest', () => {
    // Every racer is a bot that always wants to kick, so only the meter and the reserve hold it back.
    const { world, log } = raceOn(LANES, { playerBot: PLAYER_PROFILE });
    for (const racer of world.racers) racer.profile = { ...racer.profile, kickSkill: 1 };
    const farBehind = (kick: LastChargeKick) => kick.place - 1 > 2;

    const kicks = lastChargeKicks(world, log, 600);

    expect(kicks.filter((kick) => !kick.latched && !farBehind(kick))).toEqual([]);
    expect(kicks.filter(farBehind)).not.toEqual([]);
    for (const id of ['tess', 'squib', 'bo'] as const) expect(kicksOf(log, id).length).toBeGreaterThan(3);
  });

  it('spend their last charge to shake off a latch', () => {
    const { world, log } = raceOn(LANES);
    const tess = racerOf(world, 'tess');
    tess.profile = { ...tess.profile, kickSkill: 1 };
    step(world, log, 60, IDLE);
    tess.kickCharges = 1;
    tess.kickRecharge = 0;
    tess.status.latched = 90;

    step(world, log, 30, IDLE);

    expect(kicksOf(log, 'tess').filter((tick) => tick > world.tick - 30)).not.toEqual([]);
    expect(tess.kickCharges).toBe(0);
  });
});
