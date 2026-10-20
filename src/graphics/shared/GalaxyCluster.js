import * as THREE from 'three';
import {
  generateGalaxyPoints, galaxyVertexShader, galaxyFragmentShader, GALAXY_MORPHOLOGIES
} from '../GalaxyArchitecture.js';
import { hashGalaxySeed } from '../../data/galaxyProfiles.js';
import {
  galaxyNebulaVertexShader, galaxyNebulaFragmentShader
} from './sharedShaders.js';
import { LOCAL_RADIUS } from './layout.js';

const TAU = Math.PI * 2;
// Per-galaxy resting orientation (radians about x). Different inclinations make
// the nine disks read as separate objects in one volume rather than nine decals.
const TILT_X = [0.30, 0.46, 0.20, 0.62, 0.28, 0.38, 0.22, 0.56, 0.34];
const TILT_Y = [0.12, -0.20, 0.06, 0.30, -0.10, 0.18, -0.26, -0.14, 0.22];
const clamp01 = x => Math.min(1, Math.max(0, x));

const stellarVertexShader = /* glsl */ `
attribute float aSeed;
attribute float aLayer;
uniform float uTime;
uniform float uPixelRatio;
uniform float uOpacity;
uniform float uNova;
uniform vec3 uCentrifugal;
uniform float uCentrifugalTime;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform vec3 uColorC;
varying vec3 vColor;
varying float vAlpha;
varying float vSeed;
void main() {
  vec3 p = position;
  float radius = length(p.xy);
  float spin = aLayer < 0.5 ? 0.045 : aLayer < 1.5
    ? 0.055 + 0.21 / (0.55 + radius * 0.34) : 0.025;
  float angle = uTime * spin + sin(uTime * 0.12 + aSeed * 31.0) * 0.025;
  mat2 turn = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
  p.xy = turn * p.xy;
  vec2 tangent = normalize(vec2(-p.y, p.x) + vec2(0.0001));
  p.xy += tangent * sin(uTime * (0.24 + aSeed * 0.21) + aSeed * 50.0) * 0.11;
  p.z += sin(uTime * 0.31 + aSeed * 37.0) * (0.12 + aLayer * 0.08);

  float pulseAge = max(0.0, uTime - uCentrifugalTime);
  vec2 radial = p.xy - uCentrifugal.xy;
  float distanceToPulse = length(radial);
  float wave = exp(-pow((distanceToPulse - pulseAge * 3.4) * 1.25, 2.0)) * exp(-pulseAge * 0.9);
  p.xy += radial / max(distanceToPulse, 0.15) * wave * uCentrifugal.z * 0.32;
  p.z += wave * uCentrifugal.z * sin(aSeed * 39.0) * 0.18;

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float distance = max(1.0, -mv.z);
  float twinkle = 0.58 + 0.42 * sin(uTime * (0.7 + aSeed * 1.8) + aSeed * 87.0);
  float size = aLayer < 0.5 ? 4.0 + aSeed * 3.6
    : aLayer < 1.5 ? 2.1 + aSeed * 3.2 : 1.35 + aSeed * 2.2;
  size *= (1.0 + min(1.5, max(0.0, uNova - 0.28)) * 0.28);
  gl_PointSize = clamp(size * uPixelRatio * (27.0 / distance), 1.0, 11.0 * uPixelRatio);

  vec3 palette = mix(uColorA, uColorB, smoothstep(0.0, 9.0, radius + aSeed * 1.4));
  palette = mix(palette, uColorC, smoothstep(0.22, 0.96, fract(aSeed * 8.71)) * 0.38);
  vColor = aLayer < 0.5 ? mix(palette, vec3(1.0, 0.94, 0.84), 0.62)
    : aLayer > 1.5 ? mix(palette, uColorC, 0.32) : palette;
  float layerAlpha = aLayer < 0.5 ? 0.72 : aLayer < 1.5 ? 0.48 : 0.24;
  vAlpha = uOpacity * layerAlpha * twinkle * (1.0 + wave * 0.8);
  vSeed = aSeed;
}`;

const stellarFragmentShader = /* glsl */ `
precision highp float;
varying vec3 vColor;
varying float vAlpha;
varying float vSeed;
void main() {
  vec2 q = gl_PointCoord - 0.5;
  float r = length(q) * 2.0;
  if (r > 1.0) discard;
  float core = exp(-r * r * 18.0);
  float glow = exp(-r * r * 4.2) * 0.42;
  float glint = step(0.82, fract(vSeed * 71.3))
    * (exp(-abs(q.x) * 54.0) + exp(-abs(q.y) * 54.0)) * 0.15;
  gl_FragColor = vec4(vColor * (core + glow + glint), vAlpha * (core * 0.72 + glow + glint));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

let sharedNebulaGeometry = null;
let sharedNebulaGeometryUsers = 0;
function nebulaGeometry() {
  sharedNebulaGeometry ||= new THREE.PlaneGeometry(2, 2);
  sharedNebulaGeometryUsers++;
  return sharedNebulaGeometry;
}

function releaseNebulaGeometry() {
  sharedNebulaGeometryUsers--;
  if (sharedNebulaGeometryUsers === 0) {
    sharedNebulaGeometry.dispose();
    sharedNebulaGeometry = null;
  }
}

function makeStellarGeometry(generated, identity, mobile) {
  const groups = [[], [], []];
  for (let i = 0; i < generated.groups.length; i++) {
    const group = generated.groups[i];
    if (group === 0) groups[0].push(i);
    else if (group === 1 || group === 2 || group === 3 || group === 5 || group === 7) groups[1].push(i);
    else groups[2].push(i);
  }

  let state = hashGalaxySeed(`shared-stars:${identity}`) || 1;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const count = mobile ? 72 : 128;
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  const layers = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const layer = i < count * 0.18 ? 0 : i < count * 0.82 ? 1 : 2;
    const candidates = groups[layer];
    const source = candidates[Math.floor(random() * candidates.length)];
    const spread = layer === 0 ? 0.24 : layer === 1 ? 0.22 : 0.36;
    const offset = i * 3;
    positions[offset] = generated.positions[source * 3] + (random() - 0.5) * spread;
    positions[offset + 1] = generated.positions[source * 3 + 1] + (random() - 0.5) * spread;
    positions[offset + 2] = generated.positions[source * 3 + 2] + (random() - 0.5) * spread * 1.8;
    seeds[i] = random();
    layers[i] = layer;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
  geometry.setAttribute('aLayer', new THREE.BufferAttribute(layers, 1));
  return geometry;
}

/**
 * A single shared-sky galaxy. The matter is the *same* GPU particle system the
 * personal universes use: `generateGalaxyPoints()` for the arms/clouds/clusters
 * and the same vertex shader (differential spin, tangent flow, morphology
 * breathing, radial pulse, travelling energy ring). Nothing here is a screenshot
 * or a frozen copy — it is simulated every frame from time uniforms.
 */
export class GalaxyCluster {
  constructor({ index, recipient, profile, direction, count, pixelRatio, mobile }) {
    this.index = index;
    this.recipient = recipient;
    this.profile = profile;
    this.direction = direction;
    const rng = hashGalaxySeed(`shared:${recipient.id}`);
    const unit = ((rng % 1000) / 1000);
    this.timeScale = 0.82 + unit * 0.42;            // each galaxy keeps its own clock
    this.timeOffset = ((rng >>> 10) % 4000) / 100;   // ...and its own starting phase
    this.phase = ((rng >>> 4) % 628) / 100;
    this.tiltX = TILT_X[index % TILT_X.length];
    this.tiltY = TILT_Y[index % TILT_Y.length];
    this.baseRoll = (index * 2.399963229728653) % TAU;
    this.rollDrift = (index % 2 ? 1 : -1) * (0.006 + unit * 0.010);
    this.driftX = 0.10 + unit * 0.08;
    this.driftY = 0.07 + ((rng >>> 18) % 1000) / 1000 * 0.07;
    this.driftZ = 0.035 + unit * 0.035;

    const generated = generateGalaxyPoints(count, profile, recipient.id);
    for (let i = 2; i < generated.positions.length; i += 3) generated.positions[i] *= 2.5;
    this.generated = generated;
    // Star-cluster anchors (group 3) for localised flare events.
    this.anchors = [];
    for (let i = 0; i < count && this.anchors.length < 24; i += 7) {
      if (generated.groups[i] === 3 || generated.groups[i] === 2) {
        this.anchors.push([generated.positions[i * 3], generated.positions[i * 3 + 1]]);
      }
    }
    if (!this.anchors.length) this.anchors.push([2.5, 1.0]);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(generated.positions, 3));
    geometry.setAttribute('aFrom', new THREE.BufferAttribute(generated.positions, 3));
    geometry.setAttribute('aGroup', new THREE.BufferAttribute(generated.groups, 1));
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(generated.seeds, 1));
    geometry.setAttribute('aProgress', new THREE.BufferAttribute(generated.progress, 1));
    geometry.setAttribute('aArm', new THREE.BufferAttribute(generated.arms, 1));
    this.geometry = geometry;

    const palette = recipient.palette;
    this.paletteA = new THREE.Color(palette[0]);
    this.uniforms = {
      uTime: { value: 0 }, uPixelRatio: { value: pixelRatio * 0.64 },
      uTransition: { value: 1 }, uOpacity: { value: 1.0 },
      uSpin: { value: profile.spin * 1.55 * generated.personalization.spinRate },
      uSpinDirection: { value: generated.personalization.spinDirection },
      uSpiralFlow: { value: 0 }, uSpiralAngleStep: { value: 0 }, uSpiralGrowth: { value: 0 },
      uArmWidth: { value: profile.armWidth ?? 0.5 },
      uNebulaOpacity: { value: profile.nebulaOpacity ?? 0 },
      uFlocculence: { value: profile.flocculence ?? 0 },
      uBulgeSize: { value: profile.bulgeSize ?? 1 },
      uHaloLayers: { value: profile.haloLayers ?? 1 },
      uFlow: { value: profile.flow * 1.25 },
      uPulse: { value: profile.pulse }, uPhase: { value: this.phase },
      uDepth: { value: profile.depth }, uMorphology: { value: GALAXY_MORPHOLOGIES[profile.morphology] },
      uNova: { value: 0.28 },
      uCentrifugal: { value: new THREE.Vector3() }, uCentrifugalTime: { value: -100 },
      uTitleDim: { value: 0 }, uTitleBounds: { value: new THREE.Vector4() },
      uWishBounds: { value: new THREE.Vector4() },
      uFlare: { value: new THREE.Vector3() },
      uColorA: { value: new THREE.Color(palette[0]) },
      uColorB: { value: new THREE.Color(palette[1 % palette.length]) },
      uColorC: { value: new THREE.Color(palette[2 % palette.length]) }
    };
    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms, vertexShader: galaxyVertexShader, fragmentShader: galaxyFragmentShader,
      transparent: true, depthTest: false, depthWrite: false,
      blending: THREE.NormalBlending, toneMapped: false
    });
    this.points = new THREE.Points(geometry, this.material);
    this.points.frustumCulled = false;

    this.stellarGeometry = makeStellarGeometry(generated, recipient.id, mobile);
    this.stellarUniforms = {
      uTime: this.uniforms.uTime, uPixelRatio: this.uniforms.uPixelRatio,
      uOpacity: this.uniforms.uOpacity, uNova: this.uniforms.uNova,
      uCentrifugal: this.uniforms.uCentrifugal,
      uCentrifugalTime: this.uniforms.uCentrifugalTime,
      uColorA: this.uniforms.uColorA, uColorB: this.uniforms.uColorB, uColorC: this.uniforms.uColorC
    };
    this.stellarMaterial = new THREE.ShaderMaterial({
      uniforms: this.stellarUniforms, vertexShader: stellarVertexShader, fragmentShader: stellarFragmentShader,
      transparent: true, depthTest: false, depthWrite: false,
      blending: THREE.AdditiveBlending, toneMapped: true
    });
    this.stellarPoints = new THREE.Points(this.stellarGeometry, this.stellarMaterial);
    this.stellarPoints.frustumCulled = false;

    this.nebulaUniforms = {
      uTime: { value: 0 }, uSeed: { value: direction?.seed ?? 0.5 },
      uStyle: { value: direction?.style ?? -1 }, uMotion: { value: 0.9 + (direction?.motion ?? 0.5) },
      uOpacity: { value: mobile ? 0.82 : 0.92 }, uOctaves: { value: mobile ? 3 : 4 },
      uArms: { value: generated.personalization.arms }, uPitch: { value: generated.personalization.pitch },
      uAsym: { value: profile.asymmetry },
      uBloom: { value: 0 }, uBloomAmp: { value: 0 }, uBloomCenter: { value: new THREE.Vector2() },
      uColorA: this.uniforms.uColorA, uColorB: this.uniforms.uColorB, uColorC: this.uniforms.uColorC
    };
    this.nebulaMaterial = new THREE.ShaderMaterial({
      uniforms: this.nebulaUniforms, vertexShader: galaxyNebulaVertexShader, fragmentShader: galaxyNebulaFragmentShader,
      transparent: true, depthTest: false, depthWrite: false,
      blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
      blendEquationAlpha: THREE.AddEquation, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneFactor,
      toneMapped: true
    });
    this.nebulaGeometry = nebulaGeometry();
    this.nebula = new THREE.Mesh(this.nebulaGeometry, this.nebulaMaterial);
    this.nebula.scale.setScalar(LOCAL_RADIUS * 1.12);
    this.nebula.frustumCulled = false;

    this.root = new THREE.Group();
    this.root.add(this.nebula, this.points, this.stellarPoints);

    this.center = new THREE.Vector3();
    this.layoutCenter = new THREE.Vector3();
    this.worldRadius = 1;
    this.baseOpacity = 1;
    this.hover = 0;
    this.reaction = 0;          // decays after a pulse; brightens the core briefly
    this.novaBase = 0.28;
    this.novaBoost = 0;
    this.flareStrength = 0;
    this.flareAnchor = [0, 0];
    this.clock = 0;
    this._inverse = new THREE.Matrix4();
    this._local = new THREE.Vector3();
    this.screen = { x: 0, y: 0, radius: 40, visible: true, distance: 30 };
  }

  setLayout(slot, renderOrder) {
    this.layoutCenter.set(slot.x, slot.y, slot.z);
    this.center.copy(this.layoutCenter);
    this.worldRadius = slot.radius;
    this.root.position.copy(this.layoutCenter);
    this.root.scale.setScalar(slot.scale);
    this.nebula.renderOrder = renderOrder;
    this.points.renderOrder = renderOrder + 1;
    this.stellarPoints.renderOrder = renderOrder + 2;
    this.renderOrder = renderOrder;
  }

  setPixelRatio(value) { this.uniforms.uPixelRatio.value = value * 0.64; }
  setNebulaOctaves(value) { this.nebulaUniforms.uOctaves.value = value; }

  /** Radial impulse in world space (reuses the personal scene's centrifugal pulse). */
  pulse(worldPoint, strength = 1) {
    this.root.updateMatrixWorld(true);
    this._inverse.copy(this.root.matrixWorld).invert();
    this._local.copy(worldPoint).applyMatrix4(this._inverse);
    this.uniforms.uCentrifugal.value.set(this._local.x, this._local.y, strength);
    this.uniforms.uCentrifugalTime.value = this.clock;
    this.reaction = Math.min(1.4, this.reaction + 0.6 * strength);
  }

  pulseCore(strength = 1) {
    this.uniforms.uCentrifugal.value.set(0, 0, strength);
    this.uniforms.uCentrifugalTime.value = this.clock;
    this.reaction = Math.min(1.4, this.reaction + 0.55 * strength);
  }

  setFlare(x, y, strength) {
    this.flareAnchor[0] = x; this.flareAnchor[1] = y; this.flareStrength = strength;
    this.uniforms.uFlare.value.set(x, y, strength);
  }

  setBloom(progress, amplitude, cx = 0, cy = 0) {
    this.nebulaUniforms.uBloom.value = progress;
    this.nebulaUniforms.uBloomAmp.value = amplitude;
    this.nebulaUniforms.uBloomCenter.value.set(cx, cy);
  }

  /** Called once per rendered frame with the global (already motion-scaled) clock. */
  update(elapsed, dt, hoverTarget, camera, viewHeightPx) {
    this.clock = elapsed * this.timeScale + this.timeOffset;
    this.uniforms.uTime.value = this.clock;
    this.nebulaUniforms.uTime.value = this.clock;
    const follow = 1 - Math.exp(-dt * 7);
    this.hover += (hoverTarget - this.hover) * follow;
    this.reaction *= Math.exp(-dt * 1.35);
    this.novaBoost *= Math.exp(-dt * 1.1);
    const breath = 1 + 0.045 * Math.sin(this.clock * 0.31 + this.phase);
    this.uniforms.uOpacity.value = this.baseOpacity * breath * (1 + 0.16 * this.hover + 0.10 * this.reaction);
    this.uniforms.uNova.value = this.novaBase + this.novaBoost + 0.22 * this.hover;

    // Orientation precesses slowly, so the disk's inclination (and the parallax
    // between its near and far matter) is itself in motion.
    const t = this.clock;
    this.center.set(
      this.layoutCenter.x + this.driftX * (Math.sin(elapsed * 0.17 + this.phase) - Math.sin(this.phase)),
      this.layoutCenter.y + this.driftY * (Math.sin(elapsed * 0.13 + this.phase * 1.7) - Math.sin(this.phase * 1.7)),
      this.layoutCenter.z + this.driftZ * (Math.sin(elapsed * 0.11 + this.phase * 0.7) - Math.sin(this.phase * 0.7))
    );
    this.root.position.copy(this.center);
    this.root.rotation.set(
      -(this.tiltX + 0.075 * Math.sin(t * 0.060 + this.phase)),
      this.tiltY + 0.10 * Math.sin(t * 0.045 + this.phase * 1.7),
      this.baseRoll + t * this.rollDrift,
      'XYZ'
    );
    // Project the centre for picking and label placement.
    this._local.copy(this.center).project(camera);
    const dx = this.center.x - camera.position.x;
    const dy = this.center.y - camera.position.y;
    const dz = this.center.z - camera.position.z;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const worldPerPixel = (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * distance) / viewHeightPx;
    this.screen.x = (this._local.x * 0.5 + 0.5);
    this.screen.y = (-this._local.y * 0.5 + 0.5);
    this.screen.radius = (this.worldRadius * 0.92) / worldPerPixel;
    this.screen.distance = distance;
    this.screen.worldPerPixel = worldPerPixel;
    this.screen.visible = this._local.z < 1;
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
    this.stellarGeometry.dispose();
    this.stellarMaterial.dispose();
    this.nebulaMaterial.dispose();
    this.nebulaGeometry = null;
    releaseNebulaGeometry();
  }
}

export { clamp01 };
