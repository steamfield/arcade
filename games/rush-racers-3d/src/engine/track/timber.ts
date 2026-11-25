import { createRng } from '@arcade/core';
import * as THREE from 'three';
import type { Theme } from '../themes/types.ts';

/** Fallen bark above, end grain and upright stump bark below, with a white gutter for painted timbers. */
export function timberMaterial(palette: Theme['props']): THREE.MeshLambertMaterial {
  const canvas = document.createElement('canvas');
  canvas.width = 384;
  canvas.height = 192;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.MeshLambertMaterial({ vertexColors: true, color: palette.wood });
  const rng = createRng(0x5eed);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 384, 192);
  ctx.fillStyle = new THREE.Color(palette.pedestal).getStyle();
  ctx.fillRect(0, 0, 384, 122);
  const bark = palette.bark.map((tint) => new THREE.Color(tint).getStyle());
  // Overlapping tapered plates. Each has a dark cleft and a sun-bleached upper bevel.
  for (let i = 0; i < 830; i++) {
    const x = rng.next() * 450 - 66;
    const y = rng.next() * 132 - 7;
    const length = 8 + rng.next() ** 2 * 72;
    const height = 0.9 + rng.next() * 3.3;
    const rise = rng.next() * 4 - 2;
    ctx.fillStyle = rng.pick(bark);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + length * 0.27, y - height * 0.37);
    ctx.lineTo(x + length, y + rise);
    ctx.lineTo(x + length * 0.63, y + height);
    ctx.lineTo(x + length * 0.14, y + height * 0.7);
    ctx.fill();
    ctx.fillStyle = i % 4 === 0 ? '#44372c' : '#aa8867';
    ctx.fillRect(x + length * 0.14, y, length * 0.3, 0.65);
  }
  for (let i = 0; i < 150; i++) {
    const x = rng.next() * 410 - 26;
    const y = rng.next() * 119;
    const length = 6 + 35 * rng.next();
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.bezierCurveTo(x + length * 0.3, y - 1.5, x + length * 0.71, y + 1, x + length, y - 0.7);
    ctx.strokeStyle = i % 3 ? '#493629b0' : '#c49c76a0';
    ctx.lineWidth = 0.65 + rng.next() * 0.8;
    ctx.stroke();
  }
  for (const [x, y, radius] of [
    [61, 24, 10],
    [144, 109, 8],
    [269, 48, 14],
    [327, 78, 9],
  ] as const) {
    for (let ring = 1; ring < 4; ring++) {
      ctx.beginPath();
      ctx.ellipse(x, y, radius * ring * 0.42, ring * 1.05, -0.06, 0, Math.PI * 2);
      ctx.strokeStyle = ring === 1 ? '#45382f' : '#9c7c5d';
      ctx.stroke();
    }
  }
  // Broken moss colonies follow the upward-facing side of the fallen trunk.
  for (let i = 0; i < 950; i++) {
    const x = rng.next() * canvas.width;
    const bank = 0.5 + 0.5 * Math.sin(x * 0.082 + Math.sin(x * 0.051) * 2);
    const y = 88 + (rng.next() - 0.5) * (5 + 42 * bank) + 3 * Math.sin(x * 0.1);
    ctx.fillStyle = rng.pick(['#667043', '#718148', '#8d9451', '#9fa457', '#55613c']);
    ctx.beginPath();
    ctx.ellipse(x, y, 0.9 + rng.next() * 3.3, 0.6 + rng.next() * 1.3, rng.next() * 0.4, 0, 2 * Math.PI);
    ctx.fill();
  }
  const cx = 48;
  const cy = 156;
  ctx.fillStyle = '#574334';
  ctx.fillRect(0, 122, 98, 70);
  ctx.fillStyle = new THREE.Color(palette.cutWood).getStyle();
  ctx.beginPath();
  ctx.arc(cx, cy, 30.5, 0, 2 * Math.PI);
  ctx.fill();
  for (let ring = 3; ring < 29; ring += 3.7) {
    ctx.beginPath();
    for (let i = 0; i <= 80; i++) {
      const a = (i * Math.PI) / 40;
      const r = ring + 0.045 * ring * Math.sin(3 * a + ring * 0.09) + 0.54 * Math.cos(5 * a);
      const x = cx - 2 + Math.cos(a) * r;
      const y = cy + 1 + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.strokeStyle = ring < 6 ? '#986e46' : '#bc8858';
    ctx.lineWidth = 1.25;
    ctx.stroke();
  }
  for (const angle of [0.7, 2.8, 4.6]) {
    ctx.beginPath();
    for (const [index, r] of [30, 23, 16, 10].entries()) {
      const a = angle + 0.08 * Math.sin(index * 3.8);
      const x = cx + r * Math.cos(a);
      const y = cy + r * Math.sin(a);
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = '#725038';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  // Mirror this panel at the sides of each sector. Long clefts and shorter forks run with the trunk.
  ctx.save();
  ctx.beginPath();
  ctx.rect(126, 130, 258, 62);
  ctx.clip();
  ctx.translate(126, 130);
  ctx.fillStyle = '#86654b';
  ctx.fillRect(0, 0, 258, 62);
  for (let x = -9; x < 266; x += 8 + rng.next() * 15) {
    const bend = rng.next() * 20 - 10;
    const foot = x + bend + rng.next() * 7 - 3.5;
    const width = 2.0 + rng.next() * 3.5;
    // A rounded shoulder catching light on one side of the recessed grain.
    const shoulder = ctx.createLinearGradient(x - width * 1.8, 0, x + width, 0);
    shoulder.addColorStop(0, '#86654b00');
    shoulder.addColorStop(0.63, '#aa8562');
    shoulder.addColorStop(1, '#705139');
    ctx.fillStyle = shoulder;
    ctx.beginPath();
    ctx.moveTo(x - width * 2.5, -2);
    ctx.lineTo(x + width * 0.5, -2);
    ctx.bezierCurveTo(x - bend, 19, foot + bend, 39, foot, 65);
    ctx.lineTo(foot - width * 2, 65);
    ctx.bezierCurveTo(foot + bend - width * 2, 39, x - bend - width * 2, 19, x - width * 2.5, -2);
    ctx.fill();
    const y = rng.next() * 35 - 15;
    const end = y + 21 + rng.next() * 55;
    ctx.fillStyle = '#513d30';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.bezierCurveTo(x - bend, y + 12, foot + bend, end - 11, foot, end);
    ctx.bezierCurveTo(foot + bend + width, end - 14, x - bend + width, y + 8, x, y);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + width + 3, y + 4);
    ctx.bezierCurveTo(x + width + 10, y + 12, x + width - bend, y + 16, foot + width * 0.5, y + 24);
    ctx.strokeStyle = '#654c39';
    ctx.lineWidth = 0.85;
    ctx.stroke();
  }
  for (let i = 0; i < 460; i++) {
    const x = rng.next() * 258;
    const y = rng.next() * 64;
    const length = 1 + rng.next() * 8;
    ctx.strokeStyle = i % 3 ? '#49342745' : '#e2bb8459';
    ctx.lineWidth = 0.5 + rng.next() * 0.65;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + 0.6, y + length * 0.45, x + rng.next() * 1.4 - 0.7, y + length);
    ctx.stroke();
  }
  ctx.restore();
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshLambertMaterial({ map, vertexColors: true });
}

/** Assigns the side and both cut faces to the matching portions of the bark atlas. */
export function timberUVs(geometry: THREE.CylinderGeometry, axialCoverage: number | 'stump' = 1): void {
  const uv = geometry.getAttribute('uv');
  const normal = geometry.getAttribute('normal');
  for (let i = 0; i < uv.count; i++) {
    const u = uv.getX(i);
    const v = uv.getY(i);
    if (Math.abs(normal.getY(i)) > 0.8) {
      uv.setXY(i, (48 + (u - 0.5) * 66) / 384, 1 - (156 + (v - 0.5) * 66) / 192);
    } else if (axialCoverage === 'stump') {
      const sector = u * 8;
      const across = 1 - Math.abs((sector % 2) - 1);
      uv.setXY(i, (130 + across * 249) / 384, (2 + v * 57) / 192);
    } else {
      uv.setXY(i, 0.008 + 0.984 * v * axialCoverage, 1 - (3 + 114 * u) / 192);
    }
  }
}
