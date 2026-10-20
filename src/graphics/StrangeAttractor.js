import * as THREE from 'three';

function lorenzPoints(count = 2400) {
  const out = new Float32Array(count * 3);
  let x = 0.1, y = 0, z = 0;
  const sigma = 10, rho = 28, beta = 8 / 3, dt = 0.004;
  for (let i = 0; i < count; i++) {
    const dx = sigma * (y - x);
    const dy = x * (rho - z) - y;
    const dz = x * y - beta * z;
    x += dx * dt; y += dy * dt; z += dz * dt;
    out[i * 3] = x * 0.115;
    out[i * 3 + 1] = (z - 25) * 0.105;
    out[i * 3 + 2] = y * 0.105;
  }
  return out;
}

export class StrangeAttractor {
  constructor(scene) {
    this.group = new THREE.Group();
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(lorenzPoints(), 3));
    const colors = new Float32Array(2400 * 3);
    const a = new THREE.Color('#8d9aff'), b = new THREE.Color('#ff8fca');
    for (let i = 0; i < 2400; i++) {
      const c = a.clone().lerp(b, i / 2399);
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const material = new THREE.LineBasicMaterial({
      vertexColors: true, transparent: true, opacity: 0.0,
      blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, toneMapped: true
    });
    this.line = new THREE.Line(geometry, material);
    this.line.frustumCulled = false;
    this.group.add(this.line);
    this.group.visible = false;
    this.group.rotation.set(0.25, -0.4, 0.1);
    this.group.scale.setScalar(0.001);
    scene.add(this.group);
  }
  reveal(gsap) {
    this.group.visible = true;
    return gsap.timeline()
      .to(this.group.scale, { x: 1, y: 1, z: 1, duration: 1.15, ease: 'expo.out' }, 0)
      .to(this.line.material, { opacity: 0.36, duration: 0.75, ease: 'power2.out' }, 0.1)
      .to(this.line.material, { opacity: 0.13, duration: 2.5, ease: 'sine.inOut' }, 1.2);
  }
  update(time, energy = 0) {
    if (!this.group.visible) return;
    this.group.rotation.y = -0.4 + time * (0.045 + energy * 0.09);
    this.group.rotation.x = 0.25 + Math.sin(time * 0.17) * 0.09;
    this.group.rotation.z = 0.1 + Math.sin(time * 0.13) * 0.08;
  }
  hide(gsap) {
    gsap.to(this.line.material, { opacity: 0, duration: 0.45, ease: 'power2.out', onComplete: () => {
      this.group.visible = false;
      this.group.scale.setScalar(0.001);
    }});
  }
  setPalette(palette) {
    const colors = this.line.geometry.getAttribute('color');
    const c1 = new THREE.Color(palette[0]), c2 = new THREE.Color(palette[1]);
    const c = new THREE.Color();
    for (let i = 0; i < colors.count; i++) {
      c.copy(c1).lerp(c2, i / Math.max(1, colors.count - 1));
      colors.setXYZ(i, c.r, c.g, c.b);
    }
    colors.needsUpdate = true;
  }
}
