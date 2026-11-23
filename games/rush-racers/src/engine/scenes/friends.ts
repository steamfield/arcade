/**
 * The friends screen. It only draws `rt.online`; the online flow reads input for it each tick.
 */
import Phaser from 'phaser';
import type { Runtime } from '../runtime.ts';

/** The friends scene. */
export class FriendsScene extends Phaser.Scene {
  private readonly rt: Runtime;

  constructor(rt: Runtime) {
    super('friends');
    this.rt = rt;
  }

  create(): void {
    this.rt.entered('friends');
  }
}
