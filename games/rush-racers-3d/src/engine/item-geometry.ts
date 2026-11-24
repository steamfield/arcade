import * as THREE from 'three';

export function crateMaterial(): THREE.MeshLambertMaterial {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const face = canvas.getContext('2d');
  if (!face) return new THREE.MeshLambertMaterial({ color: 0xe9af54 });
  face.fillStyle = '#753e26';
  face.fillRect(0, 0, 128, 128);
  face.fillStyle = '#f3ad52';
  face.fillRect(5, 5, 118, 118);
  face.fillStyle = '#b85e36';
  face.fillRect(13, 14, 102, 100);
  face.fillStyle = '#824226';
  for (let y = 39; y < 116; y += 25) face.fillRect(13, y, 102, 3);
  face.fillStyle = '#4c2b24';
  face.beginPath();
  face.roundRect(25, 21, 78, 86, 12);
  face.fill();
  face.fillStyle = '#fff3bd';
  face.font = '900 89px system-ui, sans-serif';
  face.textAlign = 'center';
  face.textBaseline = 'middle';
  face.fillText('?', 64, 69);
  face.fillStyle = '#fff0af';
  for (const x of [9, 119]) {
    for (const y of [9, 119]) {
      face.beginPath();
      face.arc(x, y, 3, 0, Math.PI * 2);
      face.fill();
    }
  }
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshLambertMaterial({ map, emissiveMap: map, emissive: 0x888888 });
}

export function starGeometry(): THREE.ExtrudeGeometry {
  const star = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const angle = Math.PI / 2 + (i * Math.PI) / 5;
    const radius = i % 2 === 0 ? 1 : 0.43;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (i === 0) star.moveTo(x, y);
    else star.lineTo(x, y);
  }
  star.closePath();
  const geometry = new THREE.ExtrudeGeometry(star, { depth: 0.26, bevelEnabled: false });
  // The extrusion has two material groups by default. They share one material here.
  geometry.clearGroups();
  return geometry.translate(0, 0, -0.13);
}

export function flameGeometry(): THREE.ConeGeometry {
  const geometry = new THREE.ConeGeometry(1, 2, 7, 4);
  const positions = geometry.getAttribute('position');
  const colors = new Float32Array(positions.count * 3);
  const orange = new THREE.Color(0xff4c28);
  const gold = new THREE.Color(0xffe681);
  const color = new THREE.Color();
  for (let i = 0; i < positions.count; i++) {
    const heat = THREE.MathUtils.smoothstep(positions.getY(i), -0.7, 0.52);
    color
      .copy(gold)
      .lerp(orange, heat)
      .toArray(colors, i * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}
