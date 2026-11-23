/**
 * A fixed-size particle simulation with no Phaser in it, so it can be stepped and tested on
 * its own. Every particle record is allocated once up front; spawning reuses the next slot in
 * a ring, so a burst that outruns the pool overwrites the oldest particle instead of
 * allocating. Units are pixels and ticks: velocity is px per tick, acceleration px per tick².
 */

/** One particle. Callers set the fields they need right after `spawn` returns it. */
export interface Particle {
  live: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Added to vy every tick: negative floats up (bubbles), positive sinks (debris). */
  ay: number;
  /** Velocity is multiplied by this every tick: the drag of the theme's medium. 1 keeps it. */
  drag: number;
  age: number;
  /** Ticks the particle lives; it dies when `age` reaches it. */
  life: number;
  texture: string;
  frame: string;
  tint: number;
  /** Alpha at birth; it fades out over the last part of its life. */
  alpha: number;
  /** Side-to-side sway in whole px, for rising bubbles. 0 for none. */
  wobble: number;
  /** Offsets the sway so neighbouring bubbles don't move in step. */
  phase: number;
  flipX: boolean;
}

/** A pool of particles that only the owner steps. */
export interface ParticleField {
  readonly particles: readonly Particle[];
  /** Takes the next slot (the oldest one when every slot is live), resets it and returns it. */
  spawn(x: number, y: number, life: number, texture: string, frame: string): Particle;
  /** Moves every live particle on by one tick and retires the ones whose life is over. */
  step(): void;
}

/** Fraction of a particle's life, at the end, over which it fades to nothing. */
const FADE_PORTION = 0.4;
/** Ticks per radian of bubble sway. */
const SWAY_RATE = 0.25;

/** Creates a field holding at most `capacity` particles. */
export function createParticleField(capacity: number): ParticleField {
  const particles: Particle[] = Array.from({ length: capacity }, blankParticle);
  let next = 0;

  return {
    particles,
    spawn(x, y, life, texture, frame) {
      const particle = particles[next] as Particle;
      next = (next + 1) % capacity;
      Object.assign(particle, BLANK);
      particle.live = true;
      particle.x = x;
      particle.y = y;
      particle.life = life;
      particle.texture = texture;
      particle.frame = frame;
      return particle;
    },
    step() {
      for (const particle of particles) if (particle.live) stepParticle(particle);
    },
  };
}

/** The alpha `particle` shows at its current age: full, then fading over the end of its life. */
export function particleAlpha(particle: Particle): number {
  const left = particle.life - particle.age;
  const fadeTicks = particle.life * FADE_PORTION;
  return particle.alpha * Math.min(1, left / fadeTicks);
}

/** Where `particle` draws on the x axis, in whole px, including its sway. */
export function particleScreenX(particle: Particle): number {
  const sway = particle.wobble === 0 ? 0 : Math.sin((particle.age + particle.phase) * SWAY_RATE) * particle.wobble;
  return Math.round(particle.x + sway);
}

function stepParticle(particle: Particle): void {
  particle.age++;
  if (particle.age >= particle.life) {
    particle.live = false;
    return;
  }
  particle.vy += particle.ay;
  particle.vx *= particle.drag;
  particle.vy *= particle.drag;
  particle.x += particle.vx;
  particle.y += particle.vy;
}

const BLANK: Particle = {
  live: false,
  x: 0,
  y: 0,
  vx: 0,
  vy: 0,
  ay: 0,
  drag: 1,
  age: 0,
  life: 1,
  texture: '',
  frame: '',
  tint: 0xffffff,
  alpha: 1,
  wobble: 0,
  phase: 0,
  flipX: false,
};

function blankParticle(): Particle {
  return { ...BLANK };
}
