/**
 * The room screen. It only draws `rt.online`; the online flow reads input for it each tick.
 */
import Phaser from 'phaser';
import type { Runtime } from '../runtime.ts';

/** The room scene. */
export class RoomScene extends Phaser.Scene {
  private readonly rt: Runtime;

  constructor(rt: Runtime) {
    super('room');
    this.rt = rt;
  }

  create(): void {
    this.rt.entered('room');
  }
}
