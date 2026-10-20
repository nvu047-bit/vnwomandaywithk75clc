import * as THREE from 'three';
import {
  cometTrailVertexShader, cometTrailFragmentShader,
  cometHeadVertexShader, cometHeadFragmentShader
} from '../shaders.js';
import {
  dustVertexShader, dustFragmentShader, haloVertexShader, haloFragmentShader
} from './sharedShaders.js';

const easeInOutQuad = u => (u < 0.5 ? 2 * u * u : 1 - ((-2 * u + 2) ** 2) / 2);
// A stream of star-dust accelerates the whole way through (no slow-down).
const easeAccelerate = u => u * u * (1.55 - 0.55 * u);
const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function makeRibbon(samples, scene, opacity) {
  const positions = new Float32Array(samples * 2 * 3);
  const fades = new Float32Array(samples * 2);
  const edges = new Float32Array(samples * 2);
  const indices = [];
  for (let j = 0; j < samples; j++) {
    const fade = Math.pow(1 - j / (samples - 1), 1.65);
    fades[j * 2] = fades[j * 2 + 1] = fade;
    edges[j * 2] = -1; edges[j * 2 + 1] = 1;
    if (j < samples - 1) {
      const a = j * 2, b = a + 1, c = a + 2, d = a + 3;
      indices.push(a, c, b, b, c, d);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('aFade', new THREE.BufferAttribute(fades, 1));
  geometry.setAttribute('aEdge', new THREE.BufferAttribute(edges, 1));
  geometry.setIndex(indices);
  const uniforms = { uColor: { value: new THREE.Color('#ffffff') }, uOpacity: { value: 0 } };
  const material = new THREE.ShaderMaterial({
    uniforms, vertexShader: cometTrailVertexShader, fragmentShader: cometTrailFragmentShader,
    transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending, toneMapped: true
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.visible = false;
  scene.add(mesh);
  return { geometry, material, uniforms, mesh, peak: opacity };
}

/**
 * Wish comet / star-dust stream. The ribbon trail, head sprite and the way the
 * tail is sampled backwards along the same flight path come from CometField
 * (personal scenes); here the path is a Catmull-Rom curve through real 3D space,
 * the speed profile accelerates, and a pooled dust cloud is shed from the head.
 */
export class SharedComet {
  constructor(scene, { pixelRatio, mobile, seed = 1 }) {
    this.scene = scene;
    this.randomState = seed >>> 0 || 1;
    this.samples = mobile ? 24 : 38;
    this.active = false;
    this.kind = 'comet';
    this.age = 0;
    this.duration = 4.4;
    this.progress = 0;
    this.color = new THREE.Color('#ffffff');
    this.white = new THREE.Color(1, 1, 1);
    this.dustActive = false;
    this.tint = new THREE.Color('#ffffff');
    this.head = new THREE.Vector3();
    this.prevHead = new THREE.Vector3();
    this.tangent = new THREE.Vector3();
    this.side = new THREE.Vector3();
    this.view = new THREE.Vector3(0, 0, 1);
    this.scratch = new THREE.Vector3();
    this.centers = new Float32Array(this.samples * 3);
    this.points = Array.from({ length: 6 }, () => new THREE.Vector3());
    this.curve = new THREE.CatmullRomCurve3(this.points.slice(0, 4), false, 'centripetal');
    this.hit = new Uint8Array(16);
    this.reactions = [];

    this.wide = makeRibbon(this.samples, scene, 0.20);
    this.narrow = makeRibbon(this.samples, scene, 0.55);
    this.wide.mesh.renderOrder = 61;
    this.narrow.mesh.renderOrder = 62;

    const headGeometry = new THREE.BufferGeometry();
    headGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3), 3).setUsage(THREE.DynamicDrawUsage));
    this.headUniforms = {
      uColor: { value: new THREE.Color('#ffffff') }, uSize: { value: 15 },
      uPixelRatio: { value: pixelRatio }, uOpacity: { value: 0 }
    };
    this.headCore = new THREE.Points(headGeometry, new THREE.ShaderMaterial({
      uniforms: this.headUniforms, vertexShader: cometHeadVertexShader, fragmentShader: cometHeadFragmentShader,
      transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: true
    }));
    this.headCore.frustumCulled = false; this.headCore.renderOrder = 64; this.headCore.visible = false;
    scene.add(this.headCore);

    this.haloUniforms = {
      uColor: { value: new THREE.Color('#ffffff') }, uSize: { value: 62 },
      uPixelRatio: { value: pixelRatio }, uOpacity: { value: 0 }
    };
    this.halo = new THREE.Points(headGeometry, new THREE.ShaderMaterial({
      uniforms: this.haloUniforms, vertexShader: haloVertexShader, fragmentShader: haloFragmentShader,
      transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: true
    }));
    this.halo.frustumCulled = false; this.halo.renderOrder = 63; this.halo.visible = false;
    scene.add(this.halo);

    // Dust pool: positions and velocities are integrated each frame on the CPU
    // (a few hundred particles), written into a reused buffer — no allocation.
    this.dustCount = mobile ? 90 : 190;
    const dustPositions = new Float32Array(this.dustCount * 3);
    this.dustVelocity = new Float32Array(this.dustCount * 3);
    this.dustLife = new Float32Array(this.dustCount);
    this.dustDecay = new Float32Array(this.dustCount);
    this.dustSeed = new Float32Array(this.dustCount);
    for (let i = 0; i < this.dustCount; i++) { this.dustSeed[i] = this.random(); dustPositions[i * 3 + 2] = -999; }
    const dustGeometry = new THREE.BufferGeometry();
    dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3).setUsage(THREE.DynamicDrawUsage));
    dustGeometry.setAttribute('aLife', new THREE.BufferAttribute(this.dustLife, 1).setUsage(THREE.DynamicDrawUsage));
    dustGeometry.setAttribute('aSeed', new THREE.BufferAttribute(this.dustSeed, 1));
    this.dustGeometry = dustGeometry;
    this.dustUniforms = { uPixelRatio: { value: pixelRatio }, uColor: { value: new THREE.Color('#ffffff') } };
    this.dust = new THREE.Points(dustGeometry, new THREE.ShaderMaterial({
      uniforms: this.dustUniforms, vertexShader: dustVertexShader, fragmentShader: dustFragmentShader,
      transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: true
    }));
    this.dust.frustumCulled = false; this.dust.renderOrder = 60;
    scene.add(this.dust);
    this.dustCursor = 0;
    this.emitCarry = 0;
    this.speedNorm = 1;
  }

  random() {
    this.randomState = (Math.imul(this.randomState, 1664525) + 1013904223) >>> 0;
    return this.randomState / 4294967296;
  }

  /**
   * @param {THREE.Vector3[]} waypoints 4–6 world points (start ... end)
   * @param {{kind?:string,duration?:number,color?:THREE.Color|string}} options
   */
  launch(waypoints, { kind = 'comet', duration = 4.4, color = '#e9e2f2' } = {}) {
    this.kind = kind;
    this.duration = duration;
    this.age = 0;
    this.progress = 0;
    this.active = true;
    this.hit.fill(0);
    const n = Math.min(this.points.length, waypoints.length);
    this.curve.points = this.points.slice(0, n);
    for (let i = 0; i < n; i++) this.curve.points[i].copy(waypoints[i]);
    this.curve.updateArcLengths();
    this.color.set(color);
    this.tint.copy(this.color);
    this.emitCarry = 0;
    this.curve.getPoint(0, this.head);
    this.prevHead.copy(this.head);
    const stream = kind === 'stream';
    this.wide.mesh.visible = this.narrow.mesh.visible = true;
    this.headCore.visible = this.halo.visible = true;
    this.widthWide = stream ? 0.55 : 0.34;
    this.widthNarrow = stream ? 0.20 : 0.105;
    this.tailBase = stream ? 0.30 : 0.19;
    this.headUniforms.uSize.value = stream ? 10 : 15;
    this.haloUniforms.uSize.value = stream ? 44 : 62;
    this.emitRate = stream ? 120 : 70;
  }

  stop() {
    this.active = false;
    this.wide.mesh.visible = this.narrow.mesh.visible = false;
    this.headCore.visible = this.halo.visible = false;
    this.wide.uniforms.uOpacity.value = this.narrow.uniforms.uOpacity.value = 0;
  }

  emit(count, spread, speed) {
    this.dustActive = true;
    for (let k = 0; k < count; k++) {
      const i = this.dustCursor;
      this.dustCursor = (this.dustCursor + 1) % this.dustCount;
      const p = this.dustGeometry.attributes.position.array;
      const o = i * 3;
      p[o] = this.head.x + (this.random() - 0.5) * spread;
      p[o + 1] = this.head.y + (this.random() - 0.5) * spread;
      p[o + 2] = this.head.z + (this.random() - 0.5) * spread * 0.6;
      // Shed backwards along the flight direction with a sideways spray.
      const back = -(0.10 + this.random() * 0.22) * speed;
      this.dustVelocity[o] = this.tangent.x * back + (this.random() - 0.5) * 1.1;
      this.dustVelocity[o + 1] = this.tangent.y * back + (this.random() - 0.5) * 1.1;
      this.dustVelocity[o + 2] = this.tangent.z * back + (this.random() - 0.5) * 0.5;
      this.dustLife[i] = 1;
      this.dustDecay[i] = 0.42 + this.random() * 0.55;
    }
  }

  integrateDust(dt) {
    const p = this.dustGeometry.attributes.position.array;
    const drag = Math.exp(-1.15 * dt);
    let alive = 0;
    for (let i = 0; i < this.dustCount; i++) {
      if (this.dustLife[i] <= 0) continue;
      alive++;
      this.dustLife[i] -= this.dustDecay[i] * dt;
      const o = i * 3;
      if (this.dustLife[i] <= 0) { this.dustLife[i] = 0; p[o + 2] = -999; continue; }
      // Gentle swirl so shed dust curls instead of travelling in straight lines.
      const vx = this.dustVelocity[o], vy = this.dustVelocity[o + 1];
      this.dustVelocity[o] = (vx - vy * 0.45 * dt) * drag;
      this.dustVelocity[o + 1] = (vy + vx * 0.45 * dt) * drag;
      this.dustVelocity[o + 2] *= drag;
      p[o] += this.dustVelocity[o] * dt;
      p[o + 1] += this.dustVelocity[o + 1] * dt;
      p[o + 2] += this.dustVelocity[o + 2] * dt;
    }
    this.dustActive = alive > 0;
    this.dustGeometry.attributes.position.needsUpdate = true;
    this.dustGeometry.attributes.aLife.needsUpdate = true;
  }

  /**
   * @param {number} dt seconds
   * @param {Array} galaxies GalaxyCluster[] (for local reactions)
   * @returns {boolean} true while the comet is still alive
   */
  update(dt, galaxies) {
    if (this.dustActive) this.integrateDust(dt);
    if (!this.active) return false;
    this.age += dt;
    const u = Math.min(1, this.age / this.duration);
    const stream = this.kind === 'stream';
    const s = stream ? easeAccelerate(u) : easeInOutQuad(u);
    const ds = (stream ? easeAccelerate(Math.min(1, u + 0.02)) : easeInOutQuad(Math.min(1, u + 0.02))) - s;
    this.speedNorm = Math.min(2.2, ds / 0.02 * (stream ? 0.7 : 1));
    this.progress = s;

    this.prevHead.copy(this.head);
    this.curve.getPoint(s, this.head);
    this.tangent.subVectors(this.head, this.prevHead);
    if (this.tangent.lengthSq() > 1e-8) this.tangent.normalize();
    else this.curve.getTangent(s, this.tangent);

    const visibility = smoothstep(0, 0.09, u) * (1 - smoothstep(0.86, 1, u));
    this.wide.uniforms.uOpacity.value = this.wide.peak * visibility;
    this.narrow.uniforms.uOpacity.value = this.narrow.peak * visibility;
    this.headUniforms.uOpacity.value = visibility;
    this.haloUniforms.uOpacity.value = visibility * 0.42;
    this.tint.lerp(this.color, 1 - Math.exp(-dt * 1.4));
    for (const ribbon of [this.wide, this.narrow]) ribbon.uniforms.uColor.value.copy(this.tint);
    this.headUniforms.uColor.value.copy(this.tint).lerp(this.white, 0.5);
    this.haloUniforms.uColor.value.copy(this.tint);
    this.dustUniforms.uColor.value.copy(this.tint);

    // Trail: sample the same path backwards from the head. Longer when faster.
    const n = this.samples;
    const tail = this.tailBase * (0.55 + 0.45 * Math.min(1.6, this.speedNorm));
    for (let i = 0; i < n; i++) {
      const sp = Math.max(0, s - (i / (n - 1)) * tail);
      this.curve.getPoint(sp, this.scratch);
      this.centers[i * 3] = this.scratch.x;
      this.centers[i * 3 + 1] = this.scratch.y;
      this.centers[i * 3 + 2] = this.scratch.z;
    }
    this.writeRibbon(this.wide, this.widthWide);
    this.writeRibbon(this.narrow, this.widthNarrow);
    const hp = this.headCore.geometry.getAttribute('position');
    hp.setXYZ(0, this.head.x, this.head.y, this.head.z);
    hp.needsUpdate = true;

    this.emitCarry += this.emitRate * dt * visibility * (0.5 + 0.5 * Math.min(1.6, this.speedNorm));
    const whole = Math.floor(this.emitCarry);
    if (whole > 0) { this.emit(whole, 0.28, 10 * this.speedNorm); this.emitCarry -= whole; }

    // Local reactions: each galaxy the head passes through reacts exactly once.
    this.reactions.length = 0;
    for (let g = 0; g < galaxies.length; g++) {
      if (this.hit[g]) continue;
      const galaxy = galaxies[g];
      const d = this.head.distanceTo(galaxy.center);
      if (d < galaxy.worldRadius * 1.15) {
        this.hit[g] = 1;
        this.reactions.push(g);
        this.color.copy(galaxy.paletteA).lerp(this.white, 0.45);
        this.emit(Math.min(36, this.dustCount >> 2), 0.5, 14);
      }
    }
    if (u >= 1) { this.stop(); return false; }
    return true;
  }

  writeRibbon(ribbon, baseWidth) {
    const n = this.samples;
    const positions = ribbon.geometry.getAttribute('position');
    const centers = this.centers;
    for (let i = 0; i < n; i++) {
      const prev = Math.max(0, i - 1), next = Math.min(n - 1, i + 1);
      this.tangent.set(
        centers[next * 3] - centers[prev * 3],
        centers[next * 3 + 1] - centers[prev * 3 + 1],
        centers[next * 3 + 2] - centers[prev * 3 + 2]
      );
      if (this.tangent.lengthSq() < 1e-10) this.tangent.set(1, 0, 0);
      this.tangent.normalize();
      this.side.crossVectors(this.tangent, this.view);
      if (this.side.lengthSq() < 1e-5) this.side.set(1, 0, 0);
      this.side.normalize();
      const fade = Math.pow(1 - i / (n - 1), 1.65);
      const width = baseWidth * (0.10 + 0.90 * fade);
      const x = centers[i * 3], y = centers[i * 3 + 1], z = centers[i * 3 + 2];
      positions.setXYZ(i * 2, x - this.side.x * width, y - this.side.y * width, z - this.side.z * width);
      positions.setXYZ(i * 2 + 1, x + this.side.x * width, y + this.side.y * width, z + this.side.z * width);
    }
    positions.needsUpdate = true;
  }

  setPixelRatio(value) {
    this.headUniforms.uPixelRatio.value = value;
    this.haloUniforms.uPixelRatio.value = value;
    this.dustUniforms.uPixelRatio.value = value;
  }

  dispose() {
    for (const ribbon of [this.wide, this.narrow]) {
      this.scene.remove(ribbon.mesh);
      ribbon.geometry.dispose();
      ribbon.material.dispose();
    }
    this.scene.remove(this.headCore, this.halo, this.dust);
    this.headCore.geometry.dispose();
    this.headCore.material.dispose();
    this.halo.material.dispose();
    this.dustGeometry.dispose();
    this.dust.material.dispose();
  }
}
