import { describe, expect, it } from 'vitest';
import { TILE, type World } from '../../logic/types.ts';
import { setPieceCue } from './setpiece-cues.ts';

/** Just the parts of a world the cues read: the local racer's x and the level's set pieces. */
function worldAt(playerX: number): World {
  return {
    racers: [{ id: 'player', body: { x: playerX } }],
    level: {
      vents: [{ col: 10, row: 20, height: 6, periodTicks: 300, offsetTicks: 0 }],
      shiftingWind: [{ cols: [40, 50], periodTicks: 600, offsetTicks: 0, push: 200 }],
    },
  } as unknown as World;
}

describe('set piece and shot sounds', () => {
  it('rushes when a vent erupts within hearing, and not from far off', () => {
    const event = { type: 'vent.erupted', vent: 0 } as const;
    expect(setPieceCue(event, worldAt(10 * TILE), 'player')).toBe('riptide');
    expect(setPieceCue(event, worldAt(200 * TILE), 'player')).toBeNull();
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
    const ended = (style: 'boulder' | 'meteor' | 'comet') =>
      ({ type: 'shot.ended', owner: 'tess', style, x: 100, y: 0 }) as const;
    expect(setPieceCue(ended('boulder'), worldAt(150), 'player')).toBe('coral');
    expect(setPieceCue(ended('meteor'), worldAt(150), 'player')).toBe('lightning.strike');
    expect(setPieceCue(ended('comet'), worldAt(150), 'player')).toBe('decoy.pop');
    expect(setPieceCue(ended('boulder'), worldAt(5000), 'player')).toBeNull();
  });

  it('breathes when a wind zone near the local racer is about to turn', () => {
    const event = { type: 'wind.warned', zone: 0, dir: 1 } as const;
    expect(setPieceCue(event, worldAt(45 * TILE), 'player')).toBe('flap');
    expect(setPieceCue(event, worldAt(400 * TILE), 'player')).toBeNull();
  });

  it('is silent off the race screen', () => {
    expect(setPieceCue({ type: 'vent.erupted', vent: 0 }, null, 'player')).toBeNull();
  });
});
