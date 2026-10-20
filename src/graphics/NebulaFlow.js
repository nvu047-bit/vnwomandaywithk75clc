import * as THREE from 'three';
import { nebulaFlowFragmentShader, nebulaFlowVertexShader } from './shaders.js';
import { COSMIC_COLORS } from '../data/cosmicPalette.js';

function randomGenerator(seed) {
  let state = (Math.floor(seed * 0xFFFFFFFF) >>> 0) || 1;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export class NebulaFlow {
  constructor(scene, { mobile, pixelRatio }) {
    this.scene = scene;
    this.mobile = mobile;
    this.count = mobile ? 900 : 2200;
    const seed = randomGenerator(0.391);
    const positions = new Float32Array(this.count * 3);
    const seeds = new Float32Array(this.count);
    const lanes = new Float32Array(this.count);
    for (let i = 0; i < this.count; i++) {
      seeds[i] = seed();
      lanes[i] = Math.floor(seed() * 4) / 4;
    }
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
    this.geometry.setAttribute('aLane', new THREE.BufferAttribute(lanes, 1));
    this.uniforms = {
      uTime: { value: 0 },
      uPixelRatio: { value: pixelRatio },
      uParticleScale: { value: mobile ? 1.25 : 1.4 },
      uDustGlow: { value: mobile ? 1.05 : 1.3 },
      uFlowAngle: { value: 0 },
      uMotion: { value: 0.55 },
      uArtSeed: { value: 0.5 },
      uTitleSize: { value: new THREE.Vector3(0, 0, 0) },
      uInteraction: { value: new THREE.Vector3() },
      uInteractionTime: { value: -100 },
      uCentrifugal: { value: new THREE.Vector3() },
      uCentrifugalTime: { value: -100 },
      uColorA: { value: new THREE.Color(COSMIC_COLORS.dustyLavender) },
      uColorB: { value: new THREE.Color(COSMIC_COLORS.mauve) },
      uColorC: { value: new THREE.Color(COSMIC_COLORS.mutedTeal) }
    };
    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: nebulaFlowVertexShader,
      fragmentShader: nebulaFlowFragmentShader,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: true
    });
    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 2;
    scene.add(this.points);
  }

  setPalette(palette) {
    if (!palette?.length) return;
    ['uColorA', 'uColorB', 'uColorC'].forEach((key, index) => {
      this.uniforms[key].value.set(palette[index % palette.length]);
    });
  }

  setDirection(direction) {
    this.uniforms.uFlowAngle.value = direction?.flow ?? 0;
    this.uniforms.uMotion.value = direction?.motion ?? 0.55;
    this.uniforms.uArtSeed.value = direction?.seed ?? 0.5;
    if (!direction) this.clearInteraction();
  }

  setTitleBounds(bounds, scale) {
    this.uniforms.uTitleSize.value.set(
      bounds && scale ? bounds[0] * scale.x : 0,
      bounds && scale ? bounds[1] * scale.y : 0,
      bounds && scale ? bounds[2] * scale.y : 0
    );
  }

  setViewport(_width, _height, pixelRatio) {
    this.uniforms.uPixelRatio.value = pixelRatio;
  }

  setTime(time) {
    this.uniforms.uTime.value = time;
  }

  reactAt(x, y, time) {
    this.uniforms.uInteraction.value.set(x, y, 0);
    this.uniforms.uInteractionTime.value = time;
  }

  triggerCentrifugal(x, y, time, strength) {
    this.reactAt(x, y, time);
    this.uniforms.uCentrifugal.value.set(x, y, strength);
    this.uniforms.uCentrifugalTime.value = time;
  }

  clearInteraction() {
    this.uniforms.uInteraction.value.set(0, 0, 0);
    this.uniforms.uInteractionTime.value = -100;
  }

  dispose() {
    this.scene.remove(this.points);
    this.geometry.dispose();
    this.material.dispose();
  }
}
