import * as THREE from 'three';
import {
  starVertexShader, starFragmentShader, nebulaVertexShader, nebulaFragmentShader,
  diskVertexShader, diskFragmentShader
} from './shaders.js';
import { COSMIC_COLORS } from '../data/cosmicPalette.js';

const rand = (a, b) => a + Math.random() * (b - a);

function createSeededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

// aSize is the visible radius in CSS pixels; DPR is applied only in the vertex shader.
const starRadiusRanges = [
  [[0.70, 1.02], [1.40, 1.92], [2.50, 3.05], [4.00, 4.75]],
  [[0.82, 1.16], [1.64, 2.12], [2.95, 3.48], [4.72, 5.35]],
  [[0.94, 1.30], [1.90, 2.40], [3.40, 4.00], [5.35, 6.00]]
];

export function createStarField(scene, pixelRatio, mobile, rng = createSeededRandom(0x5354454C)) {
  const randomBetween = (min, max) => min + rng() * (max - min);
  // Three depth tiers (LOD) rather than one flat random scatter.
  const specs = mobile
    ? [
        { layer: 0, count: 1450, zMin: -76, zMax: -34, spreadMin: 22, spreadMax: 43 },
        { layer: 1, count: 550, zMin: -34, zMax: -12, spreadMin: 12, spreadMax: 25 },
        { layer: 2, count: 160, zMin: -22, zMax: 3, spreadMin: 8, spreadMax: 17 }
      ]
    : [
        { layer: 0, count: 4400, zMin: -76, zMax: -34, spreadMin: 22, spreadMax: 45 },
        { layer: 1, count: 1600, zMin: -34, zMax: -12, spreadMin: 12, spreadMax: 27 },
        { layer: 2, count: 400, zMin: -22, zMax: 3, spreadMin: 8, spreadMax: 18 }
      ];

  const layers = specs.map(spec => {
    const positions = new Float32Array(spec.count * 3);
    const sizes = new Float32Array(spec.count);
    const seeds = new Float32Array(spec.count);
    const glowClasses = new Float32Array(spec.count);
    const twinkleClasses = new Float32Array(spec.count);
    for (let i = 0; i < spec.count; i++) {
      const z = randomBetween(spec.zMin, spec.zMax);
      const depthT = (z - spec.zMin) / (spec.zMax - spec.zMin);
      const spread = spec.spreadMin + (spec.spreadMax - spec.spreadMin) * depthT;
      const radius = spread * Math.sqrt(rng());
      const angle = rng() * Math.PI * 2;
      const scatter = 0.45 + depthT * 0.42;
      const x = Math.cos(angle) * radius + (rng() + rng() + rng() - 1.5) * scatter;
      const y = Math.sin(angle) * radius * (0.42 + depthT * 0.48)
        + (rng() + rng() + rng() - 1.5) * scatter * 0.68;
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
      const sizeClass = rng();
      const tier = sizeClass < 0.60 ? 0 : sizeClass < 0.87 ? 1 : sizeClass < 0.98 ? 2 : 3;
      const [radiusMin, radiusMax] = starRadiusRanges[spec.layer][tier];
      sizes[i] = randomBetween(radiusMin, radiusMax);
      seeds[i] = rng();
      glowClasses[i] = rng();
      twinkleClasses[i] = rng();
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
    geometry.setAttribute('aGlowClass', new THREE.BufferAttribute(glowClasses, 1));
    geometry.setAttribute('aTwinkleClass', new THREE.BufferAttribute(twinkleClasses, 1));
    const uniforms = {
      uTime: { value: 0 },
      uPixelRatio: { value: pixelRatio },
      uLayer: { value: spec.layer },
      uStarGlow: { value: 0.82 },
      uCentrifugal: { value: new THREE.Vector3() },
      uCentrifugalTime: { value: -100 }
    };
    const material = new THREE.ShaderMaterial({
      uniforms, vertexShader: starVertexShader, fragmentShader: starFragmentShader,
      transparent: true, depthWrite: false, depthTest: false,
      blending: THREE.AdditiveBlending, toneMapped: true
    });
    const points = new THREE.Points(geometry, material);
    points.frustumCulled = false;
    points.renderOrder = -3 + spec.layer;
    scene.add(points);
    return { layer: spec.layer, points, uniforms, geometry, material };
  });
  return { layers };
}

export function createNebulaVolume(scene, { mobile, palette }) {
  const uniforms = {
    uTime: { value: 0 }, uSteps: { value: mobile ? 4 : 6 },
    uCentrifugal: { value: new THREE.Vector3() }, uCentrifugalTime: { value: -100 },
    uDensity: { value: 0.54 }, uFbmOctaves: { value: mobile ? 3 : 4 },
    uArtStyle: { value: -1 }, uArtSeed: { value: 0.5 }, uArtAspect: { value: new THREE.Vector2(1, 1) },
    uCoreOffset: { value: new THREE.Vector2() }, uFlowAngle: { value: 0 },
    uArtWarp: { value: 0.74 }, uArtDensity: { value: 0.96 }, uMotion: { value: 0.62 },
    uTitleBounds: { value: new THREE.Vector4(0, 0, 0, 0) },
    uColorWeights: { value: new THREE.Vector3(0.34, 0.33, 0.33) },
    uBoxMin: { value: new THREE.Vector3(-11, -7, -24) },
    uBoxMax: { value: new THREE.Vector3(11, 7, -12) },
    uVolumeCenter: { value: new THREE.Vector3(0, 0, -18) },
    uColorA: { value: new THREE.Color(palette[0]) },
    uColorB: { value: new THREE.Color(palette[1]) },
    uColorC: { value: new THREE.Color(palette[2]) }
  };
  const material = new THREE.ShaderMaterial({
    uniforms, vertexShader: nebulaVertexShader, fragmentShader: nebulaFragmentShader,
    transparent: true, depthWrite: false, depthTest: true, side: THREE.BackSide,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
    blendEquationAlpha: THREE.AddEquation, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneFactor, toneMapped: false
  });
  const volume = new THREE.Mesh(new THREE.BoxGeometry(22, 14, 12), material);
  volume.position.set(0, 0, -18);
  volume.renderOrder = 0;
  volume.frustumCulled = false;
  scene.add(volume);
  return { mesh: volume, uniforms, material };
}

export function createAccretionDisk(scene, { pixelRatio, mobile }) {
  const count = mobile ? 4200 : 10500;
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  const radii = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const seed = Math.random();
    const arm = Math.floor(Math.random() * 3);
    const diffuse = seed > 0.90;
    const radius = seed < 0.24
      ? rand(0.12, 2.5)
      : 1.15 + Math.pow(Math.random(), 0.72) * 8.35;
    const angle = arm * Math.PI * 2 / 3 + Math.log(radius + 0.45) * 1.28
      + rand(diffuse ? -0.52 : -0.075, diffuse ? 0.52 : 0.075);
    const radialScatter = rand(diffuse ? -0.46 : -0.13, diffuse ? 0.46 : 0.13);
    const r = Math.max(0.08, radius + radialScatter);
    positions[i * 3] = Math.cos(angle) * r;
    positions[i * 3 + 1] = Math.sin(angle) * r * 0.47;
    positions[i * 3 + 2] = rand(-0.8, 0.55) + Math.sin(angle * 3.0) * 0.14;
    seeds[i] = seed;
    radii[i] = r;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
  geometry.setAttribute('aRadius', new THREE.BufferAttribute(radii, 1));
  const uniforms = {
    uTime: { value: 0 }, uPixelRatio: { value: pixelRatio },
    uColorA: { value: new THREE.Color(COSMIC_COLORS.dustyLavender) },
    uColorB: { value: new THREE.Color(COSMIC_COLORS.periwinkle) },
    uCentrifugal: { value: new THREE.Vector3() },
    uCentrifugalTime: { value: -100 }
  };
  const material = new THREE.ShaderMaterial({
    uniforms, vertexShader: diskVertexShader, fragmentShader: diskFragmentShader,
    transparent: true, depthTest: false, depthWrite: false,
    blending: THREE.AdditiveBlending, toneMapped: true
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  points.renderOrder = 1;
  scene.add(points);
  const disk = {
    points, uniforms, geometry, material,
    setViewport(width, height, cameraZ = 12.6, fov = 43) {
      const halfHeight = Math.tan(THREE.MathUtils.degToRad(fov * 0.5)) * cameraZ;
      const halfWidth = halfHeight * width / Math.max(1, height);
      const fit = Math.max(0.18, Math.min(1, halfWidth / 9.8, halfHeight / 4.7));
      points.scale.setScalar(fit);
    },
    triggerPulse(x, y, time, strength) {
      uniforms.uCentrifugal.value.set(x / points.scale.x, y / points.scale.y, strength);
      uniforms.uCentrifugalTime.value = time;
    }
  };
  return disk;
}

export function setVolumePalette(volume, palette) {
  volume.uniforms.uColorA.value.set(palette[0]);
  volume.uniforms.uColorB.value.set(palette[1]);
  volume.uniforms.uColorC.value.set(palette[2]);
}

export function setVolumeArtDirection(volume, direction) {
  const uniforms = volume.uniforms;
  uniforms.uArtStyle.value = direction?.style ?? -1;
  uniforms.uArtSeed.value = direction?.seed ?? 0.5;
  uniforms.uArtAspect.value.set(...(direction?.aspect ?? [1, 1]));
  uniforms.uCoreOffset.value.set(...(direction?.core ?? [0, 0]));
  uniforms.uFlowAngle.value = direction?.flow ?? 0;
  uniforms.uArtWarp.value = direction?.warp ?? 0.66;
  uniforms.uArtDensity.value = direction?.density ?? 0.86;
  uniforms.uMotion.value = direction?.motion ?? 0.56;
  uniforms.uColorWeights.value.set(...(direction?.colorWeights ?? [0.34, 0.33, 0.33]));
}

export function setVolumeTitleProtection(volume, bounds, scale) {
  volume.uniforms.uTitleBounds.value.set(
    bounds?.[0] ?? 0,
    bounds?.[1] ?? 0,
    bounds?.[2] ?? 0,
    bounds && scale ? 1 : 0
  );
  if (bounds && scale) {
    volume.uniforms.uTitleBounds.value.x *= scale.x;
    volume.uniforms.uTitleBounds.value.y *= scale.y;
    volume.uniforms.uTitleBounds.value.z *= scale.y;
  }
}

export function pulseNebulaVolume(volume, x, y, time, strength) {
  volume.uniforms.uCentrifugal.value.set(x, y, strength);
  volume.uniforms.uCentrifugalTime.value = time;
}
