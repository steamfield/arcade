/**
 * Riptide lanes: strong currents laid by a Riptide burst. Scaffold: a no-op until lane 7/a gives
 * them their ageing and push. `stepWorld` calls `advanceRiptides` after projectiles and asks
 * `riptideCurrentAt` while each racer swims.
 */
import type { Body, Vec, World } from '../types.ts';

/** The riptides slot of `stepWorld`: ages every lane in `world.riptides`. Currently does nothing. */
export function advanceRiptides(_world: World): void {}

/**
 * The unit direction of the riptide lane a body's centre is inside, or null outside every lane.
 * `swim` uses it in place of the tile's own current. Currently always null.
 */
export function riptideCurrentAt(_world: World, _body: Body): Vec | null {
  return null;
}
