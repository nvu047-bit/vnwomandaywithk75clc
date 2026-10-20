import * as THREE from 'three';
import { GALAXY_PROFILES } from '../data/galaxyProfiles.js';
import { createGalaxyPersonalization, generateGalaxyPoints } from './GalaxyGeometry.js';
import { galaxyFragmentShader as fragmentShader, galaxyVertexShader as vertexShader } from './shaders.js';
export { createGalaxyPersonalization, generateGalaxyPoints };

const TAU = Math.PI * 2;
export const GALAXY_PARTICLE_COUNTS = Object.freeze({ desktop: 26000, mobile: 13000 });
const MORPHOLOGIES = Object.freeze({
  spiral: 0, ribbon: 1, bloom: 2, crystal: 3, drift: 4,
  harmonic: 5, botanical: 6, orbital: 7, deepfield: 8
});

export { vertexShader as galaxyVertexShader, fragmentShader as galaxyFragmentShader, MORPHOLOGIES as GALAXY_MORPHOLOGIES };

export const GATEWAY_GALAXY_PROFILES = Object.freeze([
  {
    name: 'Grand Cosmic Spiral Gateway',
    morphology: 'spiral',
    armStyle: 'grandDesign',
    arms: 4,
    pitch: 0.38,
    thickness: 1.45,
    core: 1.35,
    clouds: 1.42,
    clusters: 1.48,
    halo: 1.32,
    depth: 1.38,
    spin: 0.16,
    flow: 0.20,
    pulse: 0.85,
    phase: 0.2,
    asymmetry: 0.08,
    curve: 'logSpiral',
    curveScale: 1.25
  },
  {
    name: 'Celestial Rings & Resonant Orbits',
    morphology: 'spiral',
    armStyle: 'barred',
    arms: 5,
    pitch: 0.44,
    thickness: 1.32,
    core: 1.22,
    clouds: 1.5,
    clusters: 1.58,
    halo: 1.4,
    depth: 1.42,
    spin: 0.14,
    flow: 0.22,
    pulse: 0.9,
    phase: 0.85,
    asymmetry: 0.04,
    curve: 'logSpiral',
    curveScale: 1.2
  },
  {
    name: 'Harmonic Stellar Bloom',
    morphology: 'spiral',
    armStyle: 'flocculent',
    arms: 3,
    pitch: 0.32,
    thickness: 1.4,
    core: 1.38,
    clouds: 1.55,
    clusters: 1.5,
    halo: 1.28,
    depth: 1.3,
    spin: 0.15,
    flow: 0.18,
    pulse: 0.82,
    phase: 1.42,
    asymmetry: 0.06,
    curve: 'logSpiral',
    curveScale: 1.15
  },
  {
    name: 'Bifurcated Spiral Streams',
    morphology: 'spiral',
    armStyle: 'open',
    arms: 4,
    pitch: 0.42,
    thickness: 1.5,
    core: 1.32,
    clouds: 1.48,
    clusters: 1.52,
    halo: 1.38,
    depth: 1.45,
    spin: 0.18,
    flow: 0.24,
    pulse: 0.95,
    phase: 2.15,
    asymmetry: 0.1,
    curve: 'lemniscate',
    curveScale: 1.3
  }
]);

export class GalaxyArchitecture {
  constructor(scene, { pixelRatio = 1, mobile = false } = {}) {
    this.scene = scene;
    this.count = mobile ? GALAXY_PARTICLE_COUNTS.mobile : GALAXY_PARTICLE_COUNTS.desktop;
    this.profileKey = null;
    this.identity = '';
    this.profileTimeline = null;
    this.gatewayMorphInterval = null;
    this.gatewayStateIndex = 0;
    this.currentGatewayProfile = GATEWAY_GALAXY_PROFILES[0];
    const positions = new Float32Array(this.count * 3);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('aFrom', new THREE.BufferAttribute(new Float32Array(this.count * 3), 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('aGroup', new THREE.BufferAttribute(new Float32Array(this.count), 1));
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(new Float32Array(this.count), 1));
    geometry.setAttribute('aProgress', new THREE.BufferAttribute(new Float32Array(this.count), 1));
    geometry.setAttribute('aArm', new THREE.BufferAttribute(new Float32Array(this.count), 1));
    this.geometry = geometry;
    this.uniforms = {
      uTime: { value: 0 }, uPixelRatio: { value: pixelRatio },
      uTransition: { value: 1 }, uOpacity: { value: 0.53 },
      uSpin: { value: 0.16 }, uSpinDirection: { value: 1 },
      uSpiralFlow: { value: 0 }, uSpiralAngleStep: { value: 0 }, uSpiralGrowth: { value: 0 },
      uFlow: { value: 0.20 }, uPulse: { value: 0.85 },
      uPhase: { value: 0.2 }, uDepth: { value: 1.38 }, uMorphology: { value: 0 },
      uArmWidth: { value: 0.5 }, uNebulaOpacity: { value: 0 },
      uFlocculence: { value: 0 }, uBulgeSize: { value: 1 }, uHaloLayers: { value: 1 },
      uNova: { value: 0.25 },
      uCentrifugal: { value: new THREE.Vector3() }, uCentrifugalTime: { value: -100 },
      uTitleDim: { value: 1 }, uFlare: { value: new THREE.Vector3() },
      uTitleBounds: { value: new THREE.Vector4() },
      uWishBounds: { value: new THREE.Vector4() },
      uColorA: { value: new THREE.Color('#9b91ae') },
      uColorB: { value: new THREE.Color('#8290ad') },
      uColorC: { value: new THREE.Color('#b9a485') }
    };
    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms, vertexShader, fragmentShader,
      transparent: true, depthTest: false, depthWrite: false,
      blending: THREE.NormalBlending, toneMapped: false
    });
    this.points = new THREE.Points(geometry, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 1.5;
    scene.add(this.points);
    this.setViewport(window.innerWidth, window.innerHeight, 12.6, 43);
    this.setGatewayMorph(0);
  }

  setPixelRatio(value) { this.uniforms.uPixelRatio.value = value; }

  setViewport(width, height, cameraZ = 12.6, fov = 43) {
    const halfHeight = Math.tan(THREE.MathUtils.degToRad(fov * 0.5)) * cameraZ;
    const halfWidth = halfHeight * Math.max(0.1, width / Math.max(1, height));
    const immersiveScale = width < height
      ? Math.min(1.15, Math.max(0.9, halfHeight / 5.2))
      : Math.min(1.65, Math.max(1.22, halfHeight / 4.1, halfWidth / 7.5));
    this.points.scale.setScalar(immersiveScale);
  }

  setTime(time) { this.uniforms.uTime.value = time; }

  setTitleProtection(titleX, titleY, titleRadiusX, titleRadiusY,
    wishX, wishY, wishRadiusX, wishRadiusY, dim) {
    this.uniforms.uTitleBounds.value.set(titleX, titleY, titleRadiusX, titleRadiusY);
    this.uniforms.uWishBounds.value.set(wishX, wishY, wishRadiusX, wishRadiusY);
    this.uniforms.uTitleDim.value = dim;
  }

  setPalette(palette) {
    if (!palette?.length) return;
    this.uniforms.uColorA.value.set(palette[0]);
    this.uniforms.uColorB.value.set(palette[1 % palette.length]);
    this.uniforms.uColorC.value.set(palette[2 % palette.length]);
  }

  setSpiralParameters(profile) {
    this.uniforms.uArmWidth.value = profile.armWidth ?? 0.5;
    this.uniforms.uNebulaOpacity.value = profile.nebulaOpacity ?? 0;
    this.uniforms.uFlocculence.value = profile.flocculence ?? 0;
    this.uniforms.uBulgeSize.value = profile.bulgeSize ?? 1;
    this.uniforms.uHaloLayers.value = profile.haloLayers ?? 1;
  }

  setArtDirection(direction) {
    if (!direction) return;
    const profile = GALAXY_PROFILES[direction.galaxy];
    this.uniforms.uPhase.value = (profile?.phase ?? 0) + (direction.flow ?? 0) * 0.38 + (direction.seed ?? 0.5) * TAU;
  }

  setGatewayMorph(stateIndex = 0, gsap, reducedMotion = false) {
    const profile = GATEWAY_GALAXY_PROFILES[stateIndex % GATEWAY_GALAXY_PROFILES.length];
    const identity = `gateway:${stateIndex % GATEWAY_GALAXY_PROFILES.length}`;
    const from = this.geometry.getAttribute('aFrom');
    const target = this.geometry.getAttribute('position');
    const currentMix = THREE.MathUtils.clamp(this.uniforms.uTransition.value, 0, 1);
    for (let i = 0; i < target.array.length; i++) {
      from.array[i] = THREE.MathUtils.lerp(from.array[i], target.array[i], currentMix);
    }
    from.needsUpdate = true;

    const generated = generateGalaxyPoints(this.count, profile, identity);
    target.array.set(generated.positions);
    target.needsUpdate = true;
    this.geometry.getAttribute('aGroup').array.set(generated.groups);
    this.geometry.getAttribute('aGroup').needsUpdate = true;
    this.geometry.getAttribute('aSeed').array.set(generated.seeds);
    this.geometry.getAttribute('aSeed').needsUpdate = true;
    this.geometry.getAttribute('aProgress').array.set(generated.progress);
    this.geometry.getAttribute('aProgress').needsUpdate = true;
    this.geometry.getAttribute('aArm').array.set(generated.arms);
    this.geometry.getAttribute('aArm').needsUpdate = true;

    this.uniforms.uSpin.value = profile.spin * 1.5;
    this.uniforms.uSpinDirection.value = 1;
    this.uniforms.uSpiralFlow.value = 0.011 + profile.flow * 0.045;
    this.uniforms.uSpiralAngleStep.value = generated.personalization.spiralAngleStep;
    this.uniforms.uSpiralGrowth.value = generated.personalization.spiralGrowth;
    this.setSpiralParameters(profile);
    this.uniforms.uTitleDim.value = 0.18;
    this.uniforms.uFlow.value = profile.flow;
    this.uniforms.uPulse.value = profile.pulse;
    this.uniforms.uDepth.value = profile.depth;
    this.uniforms.uMorphology.value = MORPHOLOGIES[profile.morphology];
    this.uniforms.uPhase.value = profile.phase;
    this.uniforms.uNova.value = 0.25;
    this.uniforms.uCentrifugalTime.value = -100;
    this.uniforms.uTransition.value = 0;
    this.profileKey = 'gateway';
    this.gatewayStateIndex = stateIndex;
    this.currentGatewayProfile = profile;
    this.profileTimeline?.kill();
    this.points.rotation.order = 'XYZ';
    if (gsap) {
      this.profileTimeline = gsap.timeline()
        .to(this.uniforms.uOpacity, { value: 0.53, duration: reducedMotion ? 0.3 : 0.85, ease: 'sine.out' }, 0)
        .to(this.points.rotation, { x: 0, y: 0, z: 0, duration: reducedMotion ? 0.3 : 0.85, ease: 'sine.inOut' }, 0)
        .to(this.uniforms.uTransition, { value: 1, duration: reducedMotion ? 0.6 : 3.6, ease: 'power2.inOut' }, 0);
    } else {
      this.uniforms.uOpacity.value = 0.53;
      this.points.rotation.set(0, 0, 0, 'XYZ');
      this.uniforms.uTransition.value = 1;
    }
  }

  startGatewayMorphing(gsap, reducedMotion = false) {
    this.stopGatewayMorphing();
    this.setGatewayMorph(0, gsap, reducedMotion);
    let state = 0;
    this.gatewayMorphInterval = window.setInterval(() => {
      if (this.profileKey !== 'gateway') return;
      state = (state + 1) % GATEWAY_GALAXY_PROFILES.length;
      this.setGatewayMorph(state, gsap, reducedMotion);
    }, 28000);
  }

  stopGatewayMorphing() {
    if (this.gatewayMorphInterval) {
      window.clearInterval(this.gatewayMorphInterval);
      this.gatewayMorphInterval = null;
    }
  }

  setProfile(direction, palette, identity, gsap, reducedMotion = false) {
    const key = direction?.galaxy;
    const profile = GALAXY_PROFILES[key];
    if (!profile) {
      this.startGatewayMorphing(gsap, reducedMotion);
      return;
    }

    this.stopGatewayMorphing();
    this.setPalette(palette);
    this.setArtDirection(direction);
    if (this.profileKey === key && this.identity === identity) return;
    const from = this.geometry.getAttribute('aFrom');
    const target = this.geometry.getAttribute('position');
    const currentMix = THREE.MathUtils.clamp(this.uniforms.uTransition.value, 0, 1);
    for (let i = 0; i < target.array.length; i++) {
      from.array[i] = THREE.MathUtils.lerp(from.array[i], target.array[i], currentMix);
    }
    from.needsUpdate = true;

    const generated = generateGalaxyPoints(this.count, profile, identity);
    target.array.set(generated.positions);
    target.needsUpdate = true;
    this.geometry.getAttribute('aGroup').array.set(generated.groups);
    this.geometry.getAttribute('aGroup').needsUpdate = true;
    this.geometry.getAttribute('aSeed').array.set(generated.seeds);
    this.geometry.getAttribute('aSeed').needsUpdate = true;
    this.geometry.getAttribute('aProgress').array.set(generated.progress);
    this.geometry.getAttribute('aProgress').needsUpdate = true;
    this.geometry.getAttribute('aArm').array.set(generated.arms);
    this.geometry.getAttribute('aArm').needsUpdate = true;

    this.uniforms.uSpin.value = profile.spin * 2.25 * generated.personalization.spinRate;
    this.uniforms.uSpinDirection.value = generated.personalization.spinDirection;
    this.uniforms.uSpiralFlow.value = 0.011 + profile.flow * 0.045;
    this.uniforms.uSpiralAngleStep.value = generated.personalization.spiralAngleStep;
    this.uniforms.uSpiralGrowth.value = generated.personalization.spiralGrowth;
    this.setSpiralParameters(profile);
    this.uniforms.uTitleDim.value = 0.62;
    this.uniforms.uFlow.value = profile.flow;
    this.uniforms.uPulse.value = profile.pulse;
    this.uniforms.uDepth.value = profile.depth;
    this.uniforms.uMorphology.value = MORPHOLOGIES[profile.morphology];
    this.uniforms.uNova.value = 0.22;
    this.uniforms.uCentrifugalTime.value = -100;
    this.uniforms.uTransition.value = 0;
    this.profileKey = key;
    this.identity = identity;
    this.profileTimeline?.kill();
    this.points.rotation.order = 'XYZ';
    if (gsap) {
      this.profileTimeline = gsap.timeline()
        .to(this.uniforms.uOpacity, { value: 0.88, duration: reducedMotion ? 0.25 : 0.75, ease: 'sine.out' }, 0)
        .to(this.points.rotation, {
          x: generated.personalization.rotation[0],
          y: generated.personalization.rotation[1],
          z: generated.personalization.rotation[2],
          duration: reducedMotion ? 0.45 : 1.4,
          ease: 'power2.inOut'
        }, 0)
        .to(this.uniforms.uTransition, { value: 1, duration: reducedMotion ? 0.55 : 2.05, ease: 'power2.inOut' }, 0);
    } else {
      this.uniforms.uOpacity.value = 0.88;
      this.points.rotation.set(...generated.personalization.rotation, 'XYZ');
      this.uniforms.uTransition.value = 1;
    }
  }

  triggerCentrifugal(x, y, time, strength) {
    this.uniforms.uCentrifugal.value.set(x / Math.max(0.1, this.points.scale.x), y / Math.max(0.1, this.points.scale.y), strength);
    this.uniforms.uCentrifugalTime.value = time;
  }

  dispose() {
    this.stopGatewayMorphing();
    this.profileTimeline?.kill();
    this.scene.remove(this.points);
    this.geometry.dispose();
    this.material.dispose();
  }
}
