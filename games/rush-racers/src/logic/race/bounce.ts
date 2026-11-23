/**
 * Bounce clouds (`B`): a racer coming down onto one leaves upward at the medium's
 * `effects.bounceSpeed`. To the tiles a bounce cloud is rock (`isRockLike`), so meeting one from the
 * side or below just blocks; only a floor contact springs.
 *
 * Scaffold stub: cloudreach phase 2 lane a fills it in. Until then nobody bounces.
 */
import type { MoveContacts, Racer, World } from '../types.ts';

/**
 * Springs `racer` up off a bounce cloud it came down onto this tick: with a floor contact and a
 * bounce tile under either bottom corner after the move, it leaves with `vy = -bounceSpeed` and
 * `racer.bounced {id}` is emitted. Does nothing when the world's medium has no bounce clouds
 * (`effects.bounceSpeed` null) or the racer is fallen. `stepRace` calls it for each unfinished racer
 * right after the medium's `afterMove`, with the contacts of that racer's move.
 */
export function bounceOffClouds(_world: World, _racer: Racer, _contacts: MoveContacts): void {}
