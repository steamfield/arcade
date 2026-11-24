import { describe, expect, it } from 'vitest';
import { type ShotEndReason, TILE, type World } from '../../logic/types.ts';
import { setPieceCue } from './setpiece-cues.ts';

/** Just the parts of a world the cues read: the local racer's x and the level's set pieces. */
function worldAt(playerX: number): World {
  return {
    racers: [{ id: 'player', body: { x: playerX } }],
    level: {
      vents: [{ col: 10, row: 20, height: 6, periodTicks: 300, offsetTicks: 0 }],
      shiftingWind: [{ cols: [40, 50], periodTicks: 600, offsetTicks: 0, push: 200 }],
      crumbles: [{ col: 10, row: 12, length: 4 }],
      cannons: [{ col: 10, row: 8, dir: [1, 0], speed: 600, flightTicks: 20 }],
    },
  } as unknown as World;
}

describe('set piece and shot sounds', () => {
  it('rushes when a vent erupts within hearing, and not from far off', () => {
    const event = { type: 'vent.erupted', vent: 0 } as const;
    expect(setPieceCue(event, worldAt(10 * TILE), 'player')).toBe('riptide');
    expect(setPieceCue(event, worldAt(200 * TILE), 'player')).toBeNull();
  });

  it('rumbles when a vent within hearing is about to erupt', () => {
    const event = { type: 'vent.warned', vent: 0 } as const;
    expect(setPieceCue(event, worldAt(10 * TILE), 'player')).toBe('lightning.warn');
    expect(setPieceCue(event, worldAt(400 * TILE), 'player')).toBeNull();
  });

  it('rushes when a wind zone the local racer is inside turns', () => {
    const event = { type: 'wind.shifted', zone: 0, dir: -1 } as const;
    expect(setPieceCue(event, worldAt(45 * TILE), 'player')).toBe('riptide');
    expect(setPieceCue(event, worldAt(400 * TILE), 'player')).toBeNull();
  });

  it('pings only the racer a shot warns', () => {
    const event = { type: 'shot.warned', owner: 'tess', style: 'meteor', target: 'player' } as const;
    expect(setPieceCue(event, worldAt(0), 'player')).toBe('squid.lock');
    expect(setPieceCue({ ...event, target: 'bo' }, worldAt(0), 'player')).toBeNull();
  });

  it("sounds each world's shot where it ends within hearing", () => {
    const ended = (style: 'boulder' | 'meteor' | 'comet', reason: ShotEndReason = 'hit') =>
      ({ type: 'shot.ended', owner: 'tess', style, reason, x: 100, y: 0 }) as const;
    expect(setPieceCue(ended('boulder'), worldAt(150), 'player')).toBe('coral');
    expect(setPieceCue(ended('meteor', 'landed'), worldAt(150), 'player')).toBe('lightning.strike');
    expect(setPieceCue(ended('comet'), worldAt(150), 'player')).toBe('decoy.pop');
    expect(setPieceCue(ended('boulder'), worldAt(5000), 'player')).toBeNull();
  });

  it('is silent for a shot that fizzled, whatever its style', () => {
    for (const style of ['boulder', 'meteor', 'comet'] as const) {
      const event = { type: 'shot.ended', owner: 'tess', style, reason: 'fizzled', x: 100, y: 0 } as const;
      expect(setPieceCue(event, worldAt(150), 'player')).toBeNull();
    }
  });

  it('leaves a landed Boulder to the coral or wall sound, and gives one that ran out a soft bump', () => {
    const boulder = (reason: ShotEndReason) =>
      ({ type: 'shot.ended', owner: 'tess', style: 'boulder', reason, x: 100, y: 0 }) as const;
    expect(setPieceCue(boulder('landed'), worldAt(150), 'player')).toBeNull();
    expect(setPieceCue(boulder('expired'), worldAt(150), 'player')).toBe('bump');
  });

  it('breathes when a wind zone near the local racer is about to turn', () => {
    const event = { type: 'wind.warned', zone: 0, dir: 1 } as const;
    expect(setPieceCue(event, worldAt(45 * TILE), 'player')).toBe('flap');
    expect(setPieceCue(event, worldAt(400 * TILE), 'player')).toBeNull();
  });

  it('splats a Mud Pie where it lands and pops a gravity bomb as it ends, within hearing', () => {
    const landed = { type: 'twist.landed', owner: 'tess', style: 'mudPie', x: 100, y: 0 } as const;
    const ended = { type: 'twist.ended', owner: 'tess', style: 'gravityBomb', x: 100, y: 0 } as const;
    expect(setPieceCue(landed, worldAt(150), 'player')).toBe('squid.latch');
    expect(setPieceCue(ended, worldAt(150), 'player')).toBe('decoy.pop');
    expect(setPieceCue({ ...ended, style: 'headwind' }, worldAt(150), 'player')).toBeNull();
    expect(setPieceCue(landed, worldAt(5000), 'player')).toBeNull();
  });

  it('is silent off the race screen', () => {
    expect(setPieceCue({ type: 'vent.erupted', vent: 0 }, null, 'player')).toBeNull();
  });

  it("pulls when a whirlpool catches the local racer, and not for a rival's catch", () => {
    const event = { type: 'whirlpool.caught', racer: 'player', pool: 0 } as const;
    expect(setPieceCue(event, worldAt(0), 'player')).toBe('undertow');
    expect(setPieceCue({ ...event, racer: 'bo' }, worldAt(0), 'player')).toBeNull();
  });

  it('thuds as a branch within hearing shakes and crunches as it falls, and is silent far off', () => {
    expect(setPieceCue({ type: 'crumble.shook', crumble: 0 }, worldAt(12 * TILE), 'player')).toBe('bump');
    expect(setPieceCue({ type: 'crumble.fell', crumble: 0 }, worldAt(12 * TILE), 'player')).toBe('coral');
    expect(setPieceCue({ type: 'crumble.fell', crumble: 0 }, worldAt(400 * TILE), 'player')).toBeNull();
  });

  it('clanks as a cannon loads the local racer and rushes as any cannon within hearing fires', () => {
    expect(setPieceCue({ type: 'cannon.loaded', racer: 'player', cannon: 0 }, worldAt(0), 'player')).toBe('clank');
    expect(setPieceCue({ type: 'cannon.loaded', racer: 'bo', cannon: 0 }, worldAt(0), 'player')).toBeNull();
    expect(setPieceCue({ type: 'cannon.fired', racer: 'bo', cannon: 0 }, worldAt(10 * TILE), 'player')).toBe('riptide');
    expect(setPieceCue({ type: 'cannon.fired', racer: 'bo', cannon: 0 }, worldAt(400 * TILE), 'player')).toBeNull();
  });

  it('whooshes when a wormhole carries the local racer', () => {
    const event = { type: 'wormhole.warped', racer: 'player', hole: 0, from: 'a' } as const;
    expect(setPieceCue(event, worldAt(0), 'player')).toBe('squid.dodge');
    expect(setPieceCue({ ...event, racer: 'bo' }, worldAt(0), 'player')).toBeNull();
  });
});
