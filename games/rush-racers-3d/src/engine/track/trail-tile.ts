import { createRng } from '@arcade/core';

/** Linear tint tile for one half-width of trail. Loose shale and fallen leaves collect toward +u. */
export function trailTile(size: number, seed: number): Uint8Array<ArrayBuffer> {
  const rng = createRng(seed);
  const pixels = new Uint8ClampedArray(size * size * 4);
  const field = (width: number, height: number) => {
    const grid = Float32Array.from({ length: width * height }, () => rng.next());
    return (u: number, v: number) => {
      const x = u * width;
      const y = v * height;
      const col = Math.floor(x);
      const row = Math.floor(y);
      const at = (i: number, j: number) => grid[(j % height) * width + (i % width)] ?? 0;
      const fx = x - col;
      const fy = y - row;
      const a = fx * fx * (3 - 2 * fx);
      const b = fy * fy * (3 - 2 * fy);
      return (
        (at(col, row) * (1 - a) + at(col + 1, row) * a) * (1 - b) +
        (at(col, row + 1) * (1 - a) + at(col + 1, row + 1) * a) * b
      );
    };
  };
  const clay = field(5, 4);
  const wear = field(23, 5);
  const grit = field(48, 51);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const damp = Math.max(0, 0.55 - clay(u, v));
      const tone = 163 + 55 * wear(u, v) + 33 * grit(u, v) + 20 * rng.next() - 106 * damp;
      const i = (y * size + x) * 4;
      pixels[i] = tone - 24 * damp;
      pixels[i + 1] = tone - 6;
      pixels[i + 2] = tone - 13 + 24 * damp;
      pixels[i + 3] = 255;
    }
  }
  // Tilted, faceted stones and two-tone leaf blades. Wrap stamps along the repeating length.
  const scale = size / 128;
  for (let n = 0; n < 515; n++) {
    const cx = (1 - rng.next() ** 2.2) * size;
    const cy = rng.next() * size;
    const leaf = cx > size * 0.76 && rng.next() < 0.15;
    const length = scale * (leaf ? 1.8 + 2.1 * rng.next() : 0.5 + 1.25 * rng.next() ** 2);
    const width = length * (0.35 + rng.next() * 0.43);
    const angle = rng.next() * 2 * Math.PI;
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const tone = 116 + 80 * rng.next();
    for (let y = Math.floor(cy - length); y <= cy + length; y++) {
      for (let x = Math.max(0, Math.floor(cx - length)); x <= Math.min(size - 1, cx + length); x++) {
        const a = ((x - cx) * dx + (y - cy) * dy) / length;
        const b = ((y - cy) * dx - (x - cx) * dy) / width;
        if (Math.abs(a) * (leaf ? 1 : 0.71) + Math.abs(b) > 1 || Math.abs(a) > 1) continue;
        const i = (((y + size) % size) * size + x) * 4;
        const face = (leaf ? b < 0 : x - cx + y - cy < -width * 0.15) ? 1.22 : 0.79;
        pixels[i] = Math.min(255, (tone + (leaf ? 39 : -12)) * face);
        pixels[i + 1] = tone * face * (leaf ? 0.74 : 1);
        pixels[i + 2] = Math.min(255, tone * face * (leaf ? 0.41 : 1.16));
      }
    }
  }
  return new Uint8Array(pixels.buffer);
}
