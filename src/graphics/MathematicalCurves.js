import * as THREE from 'three';

function buildCurveSamples(count) {
  const positions = new Float32Array(count * 3);
  const tangents = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  const curves = new Float32Array(count);
  const progress = new Float32Array(count);
  const pointAt = (curve, t) => {
    if (curve === 0) {
      const r = 1.18 + Math.cos(5 * t) * 0.66;
      return new THREE.Vector3(-4.05 + Math.cos(t) * r, -1.82 + Math.sin(t) * r * 0.62, -6.8);
    }
    if (curve === 1) {
      const x = -3.9 + t * (7.8 / (Math.PI * 2));
      const y = -1.62 + Math.sin(2.2 * t + 0.3) * 0.48 + Math.sin(4.4 * t) * 0.12;
      return new THREE.Vector3(x, y, -4.4);
    }
    const radius = 0.52 + t * 0.34;
    const angle = t * 1.22 - 0.6;
    return new THREE.Vector3(7.0 + Math.cos(angle) * radius, 3.6 + Math.sin(angle) * radius * 0.74, -9.2);
  };
  const perCurve = Math.floor(count / 3);
  for (let i = 0; i < count; i++) {
    const curve = Math.min(2, Math.floor(i / perCurve));
    const index = i - curve * perCurve;
    const t = (index / Math.max(1, perCurve - 1)) * Math.PI * 2;
    const p = pointAt(curve, t);
    const nextT = curve === 1 ? Math.min(Math.PI * 2, t + 0.012) : t + 0.012;
    const tangent = pointAt(curve, nextT).sub(p).normalize();
    positions.set([p.x, p.y, p.z], i * 3);
    tangents.set([tangent.x, tangent.y, tangent.z], i * 3);
    seeds[i] = Math.abs((Math.sin((i + 17) * 127.1) * 43758.5453123) % 1);
    curves[i] = curve; progress[i] = index / Math.max(1, perCurve - 1);
  }
  return { positions, tangents, seeds, curves, progress };
}

const vertexShader = /* glsl */ `
attribute vec3 aTangent; attribute float aSeed; attribute float aCurve; attribute float aProgress;
uniform float uTime; uniform float uPixelRatio; uniform float uReveal; uniform float uEnergy; uniform float uResonance; uniform float uNova;
uniform vec3 uCentrifugal; uniform float uCentrifugalTime;
uniform vec3 uColorA; uniform vec3 uColorB; uniform vec3 uColorC;
varying vec3 vColor; varying float vAlpha; varying float vSeed; varying float vGlint;
void main() {
  vec3 p = position;
  vec2 normal = normalize(vec2(-aTangent.y, aTangent.x) + vec2(0.001));
  float travel = sin(uTime * (0.78 + aCurve * 0.14) + aProgress * 6.2831 + aSeed * 6.2831);
  float dust = sin(uTime * 0.46 + aSeed * 25.0) * (0.018 + aSeed * 0.09);
  p += aTangent * travel * (0.025 + aSeed * 0.09);
  p.xy += normal * dust;
  float nearTitle = exp(-dot(p.xy - vec2(0.0, 0.72), p.xy - vec2(0.0, 0.72)) * 0.09) * uResonance;
  p.xy += normal * sin(uTime * 1.05 + aProgress * 11.0 + aSeed * 8.0) * nearTitle * 0.035;
  p.z += sin(uTime * 0.32 + aProgress * 13.0) * 0.16;
  float pulseAge = max(0.0, uTime - uCentrifugalTime);
  vec2 pulseDelta = p.xy - uCentrifugal.xy;
  float pulseDistance = length(pulseDelta);
  float pulseWave = exp(-pow((pulseDistance - pulseAge * 3.2) * 1.25, 2.0)) * exp(-pulseAge * 0.85);
  p.xy += pulseDelta / max(pulseDistance, 0.15) * pulseWave * uCentrifugal.z * 0.36;
  p.xy += normal * pulseWave * sin(aProgress * 37.0 + uTime * 3.0) * uCentrifugal.z * 0.055;
  vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
  float perspective = 22.0 / max(1.0, -mv.z);
  float anchor = smoothstep(0.94, 0.995, fract(aSeed * 61.7));
  float pointScale = 1.72 + aSeed * 1.08 + anchor * 1.62;
  gl_PointSize = clamp(pointScale * uPixelRatio * perspective, 1.0, 7.0 * uPixelRatio);
  float reveal = clamp(uReveal * 1.14 - aCurve * 0.12, 0.0, 1.0);
  float drawn = smoothstep(aProgress * 0.76, aProgress * 0.76 + 0.15, reveal);
  float runner = pow(max(0.0, cos(aProgress * 6.2831 - uTime * 1.55 + aCurve * 1.9)), 16.0);
  float shimmer = 0.78 + 0.22 * sin(uTime * (0.65 + aSeed * 0.28) + aSeed * 43.0);
  vAlpha = drawn * (0.78 + anchor * 0.30 + runner * 0.24 + nearTitle * (0.12 + uNova * 0.18))
    * shimmer * (0.76 + uEnergy * 0.24);
  vec3 equationColor = aCurve < 0.5 ? uColorA : (aCurve < 1.5 ? uColorC : uColorB);
  vec3 pathAccent = aCurve < 0.5 ? vec3(0.66, 0.56, 0.86)
    : (aCurve < 1.5 ? vec3(0.82, 0.70, 0.50) : vec3(0.56, 0.64, 0.88));
  vec3 base = mix(equationColor, pathAccent, 0.76);
  vColor = mix(base, vec3(0.76, 0.68, 0.56), anchor * 0.34);
  vColor = mix(vColor, uColorC, nearTitle * (0.14 + uNova * 0.34));
  vColor *= 1.18;
  vGlint = max(anchor, runner * 0.7) * (0.35 + nearTitle * 0.55 + uNova * 0.35);
  vSeed = aSeed;
}`;

const fragmentShader = /* glsl */ `
precision highp float; varying vec3 vColor; varying float vAlpha; varying float vSeed; varying float vGlint;
void main() {
  vec2 p = gl_PointCoord - 0.5; float r = length(p) * 2.0; if (r > 1.0) discard;
  float core = exp(-r * r * 12.0);
  float mist = exp(-r * r * 2.5) * 0.10;
  float glint = smoothstep(0.94, 0.995, fract(vSeed * 91.3)) * vGlint
    * (exp(-abs(p.x) * 42.0) + exp(-abs(p.y) * 42.0)) * 0.18;
  gl_FragColor = vec4(vColor * (0.50 + core * 0.78 + glint * 0.14), (core + mist + glint) * vAlpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export class MathematicalCurves {
  constructor(scene, { mobile, pixelRatio, width, height }) {
    this.scene = scene;
    // Deliberately leave breathing room between samples: the equations should
    // read as stardust constellations, never as an anti-aliased vector line.
    const sample = buildCurveSamples(mobile ? 900 : 2100);
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(sample.positions, 3));
    this.geometry.setAttribute('aTangent', new THREE.BufferAttribute(sample.tangents, 3));
    this.geometry.setAttribute('aSeed', new THREE.BufferAttribute(sample.seeds, 1));
    this.geometry.setAttribute('aCurve', new THREE.BufferAttribute(sample.curves, 1));
    this.geometry.setAttribute('aProgress', new THREE.BufferAttribute(sample.progress, 1));
    this.uniforms = {
      uTime: { value: 0 },
      uPixelRatio: { value: pixelRatio },
      uReveal: { value: 1 },
      uEnergy: { value: 0.25 },
      uResonance: { value: 0 },
      uNova: { value: 0 },
      uCentrifugal: { value: new THREE.Vector3() },
      uCentrifugalTime: { value: -100 },
      uColorA: { value: new THREE.Color('#afa4d8') },
      uColorB: { value: new THREE.Color('#d4adbd') },
      uColorC: { value: new THREE.Color('#ddc895') }
    };
    this.material = new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader, fragmentShader, transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: true });
    this.points = new THREE.Points(this.geometry, this.material); this.points.frustumCulled = false; this.points.renderOrder = 4; scene.add(this.points);
    this.setViewport(width, height);
  }
  setTime(time) { this.uniforms.uTime.value = time; }
  triggerCentrifugal(x, y, time, strength) {
    const sx = Math.max(0.1, this.points.scale.x);
    const sy = Math.max(0.1, this.points.scale.y);
    this.uniforms.uCentrifugal.value.set(x / sx, y / sy, strength);
    this.uniforms.uCentrifugalTime.value = time;
  }
  setPixelRatio(value) { this.uniforms.uPixelRatio.value = value; }
  setViewport(width, height) {
    const aspect = Math.max(0.1, width / Math.max(1, height));
    this.points.scale.set(Math.min(1, aspect * 0.82), 1, 1);
  }
  setPalette(palette) { if (palette?.length) { this.uniforms.uColorA.value.set(palette[0]); this.uniforms.uColorB.value.set(palette[1 % palette.length]); this.uniforms.uColorC.value.set(palette[2 % palette.length]); } }
  reveal(gsap, reducedMotion = false) {
    gsap.killTweensOf(this.uniforms.uReveal);
    gsap.killTweensOf(this.uniforms.uEnergy);
    gsap.killTweensOf(this.uniforms.uResonance);
    this.uniforms.uReveal.value = 0;
    this.uniforms.uEnergy.value = 1;
    this.uniforms.uResonance.value = 0;
    this.uniforms.uNova.value = 0;
    gsap.to(this.uniforms.uReveal, { value: 1, duration: reducedMotion ? 0.35 : 2.5, ease: 'sine.inOut' });
    gsap.to(this.uniforms.uResonance, { value: 1, duration: reducedMotion ? 0.35 : 2.5, ease: 'sine.inOut' });
    gsap.to(this.uniforms.uEnergy, { value: 0.25, duration: reducedMotion ? 0.5 : 2.8, ease: 'sine.out' });
  }
  reset() {
    this.uniforms.uReveal.value = 0;
    this.uniforms.uEnergy.value = 0;
    this.uniforms.uResonance.value = 0;
    this.uniforms.uNova.value = 0;
  }
  dispose() { this.scene.remove(this.points); this.geometry.dispose(); this.material.dispose(); }
}
