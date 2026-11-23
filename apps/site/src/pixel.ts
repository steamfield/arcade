// Build-time pixel art: the marquee lettering and input icons, drawn from bitmaps into crisp SVG.
// Runs in Node from vite.config.ts; nothing here ships as JavaScript.

/** 5x7 glyphs. Rendered faux-bold (each pixel also fills its right neighbour), so cells are 6 wide. */
export const GLYPHS: Record<string, string[]> = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.####', '#....', '#....', '#....', '#....', '#....', '.####'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.####', '#....', '#....', '#.###', '#...#', '#...#', '.####'],
  I: ['###', '.#.', '.#.', '.#.', '.#.', '.#.', '###'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  N: ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '##.##', '#...#'],
  '.': ['..', '..', '..', '..', '..', '##', '##'],
  ' ': ['...', '...', '...', '...', '...', '...', '...'],
};

/** Row bands for the lettering, top to bottom: the stepped fill of an 80s cabinet logo. */
const BANDS = ['#fff4c2', '#ffe27a', '#ffc53a', '#ffc53a', '#ff9f2e', '#ff7a3d', '#ff5f5f'];
const OUTLINE = '#0b0a1e';
const DEPTH = ['#7a2d5c', '#4a1d4f'];

type Cell = `${number},${number}`;
const key = (x: number, y: number): Cell => `${x},${y}`;

/** Merge horizontal runs of cells into rects so the SVG stays small. */
function runs(cells: Set<Cell>, fill: (y: number) => string): string {
  const rows = new Map<number, number[]>();
  for (const c of cells) {
    const [x, y] = c.split(',').map(Number) as [number, number];
    rows.set(y, [...(rows.get(y) ?? []), x]);
  }
  let out = '';
  for (const [y, xs] of [...rows].sort((a, b) => a[0] - b[0])) {
    xs.sort((a, b) => a - b);
    let start = xs[0] ?? 0;
    let prev = start;
    for (const x of [...xs.slice(1), Number.NaN]) {
      if (x === prev + 1) {
        prev = x;
        continue;
      }
      out += `<rect x="${start}" y="${y}" width="${prev - start + 1}" height="1" fill="${fill(y)}"/>`;
      start = x;
      prev = x;
    }
  }
  return out;
}

/** Big banded marquee lettering with an ink outline and a two-step extrusion, as an inline SVG. */
/** Decorative: the page puts the words in a visually hidden span beside it. */
export function pixelLogo(text: string): string {
  const fill = new Set<Cell>();
  let cursor = 2;
  for (const ch of text.toUpperCase()) {
    const glyph = GLYPHS[ch];
    if (!glyph) throw new Error(`pixelLogo has no glyph for "${ch}"`);
    glyph.forEach((row, y) => {
      [...row].forEach((p, x) => {
        if (p !== '#') return;
        fill.add(key(cursor + x, y + 2));
        fill.add(key(cursor + x + 1, y + 2));
      });
    });
    cursor += (glyph[0]?.length ?? 0) + 2;
  }
  const solid = (s: Set<Cell>, dx: number, dy: number) =>
    new Set([...s].map((c) => c.split(',').map(Number) as [number, number]).map(([x, y]) => key(x + dx, y + dy)));
  const depth1 = solid(fill, 1, 1);
  const depth2 = solid(fill, 2, 2);
  const body = new Set([...fill, ...depth1, ...depth2]);
  const outline = new Set<Cell>();
  for (const c of body) {
    const [x, y] = c.split(',').map(Number) as [number, number];
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) if (!body.has(key(x + dx, y + dy))) outline.add(key(x + dx, y + dy));
  }
  for (const c of fill) {
    depth1.delete(c);
    depth2.delete(c);
  }
  for (const c of depth1) depth2.delete(c);
  const width = cursor + 3;
  const height = 7 + 2 + 2 + 3;
  return `<svg class="pixel-logo" viewBox="0 0 ${width} ${height}" aria-hidden="true" shape-rendering="crispEdges">${runs(
    outline,
    () => OUTLINE,
  )}${runs(depth2, () => DEPTH[1] ?? OUTLINE)}${runs(depth1, () => DEPTH[0] ?? OUTLINE)}${runs(fill, (y) => BANDS[y - 2] ?? '#ffc53a')}</svg>`;
}

/** 11x11 input icons, one colour (currentColor). */
const ICONS: Record<string, string[]> = {
  keyboard: [
    '...........',
    '...........',
    '###########',
    '#.#.#.#.#.#',
    '#.........#',
    '#.#.#.#.#.#',
    '#.........#',
    '#.#.....#.#',
    '###########',
    '...........',
    '...........',
  ],
  touch: [
    '..#######..',
    '..#.....#..',
    '..#.....#..',
    '..#.....#..',
    '..#.....#..',
    '..#.....#..',
    '..#.....#..',
    '..#.....#..',
    '..#######..',
    '..#..#..#..',
    '..#######..',
  ],
  gamepad: [
    '...........',
    '...........',
    '.#########.',
    '#.........#',
    '#.#.....#.#',
    '###.....#.#',
    '#.#...#...#',
    '#.........#',
    '##..###..##',
    '#...#.#...#',
    '.###...###.',
  ],
};

export function pixelIcon(name: keyof typeof ICONS | string): string {
  const rows = ICONS[name];
  if (!rows) throw new Error(`pixelIcon has no icon "${name}"`);
  const cells = new Set<Cell>();
  rows.forEach((row, y) => {
    [...row].forEach((p, x) => {
      if (p === '#') cells.add(key(x, y));
    });
  });
  return `<svg class="pixel-icon" viewBox="0 0 11 11" aria-hidden="true" shape-rendering="crispEdges">${runs(
    cells,
    () => 'currentColor',
  )}</svg>`;
}
