import * as THREE from 'three';

const vertexShader = /* glsl */ `
attribute float aSeed;
uniform float uTime;
uniform float uProgress;
uniform float uIntensity;
uniform float uMode;
uniform float uCurve;
uniform float uArms;
uniform float uPhase;
uniform float uPixelRatio;
uniform vec3 uCenter;
uniform vec2 uViewport;
uniform vec4 uProtectRect;
uniform vec4 uTitleProtectRect;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform vec3 uColorC;
varying vec3 vColor;
varying float vAlpha;
varying float vSeed;

vec2 rose(float t, float k) {
  float r = 2.2 * (0.64 + 0.32 * cos(k * t));
  return r * vec2(cos(t), sin(t));
}

void main() {
  float t = aSeed * 6.2831853;
  float p = clamp(uProgress, 0.0, 1.0);
  float age = max(0.0, uProgress - 0.26);
  vec3 direction = normalize(position + vec3(0.0001));
  float radius = length(position);
  vec3 local = position;
  float alpha = 1.0;
  float pointSize = 2.0;
  vec3 color = uColorA;

  if (uMode < 0.5) {
    float converge = 1.0 - smoothstep(0.0, 0.31, p);
    float eject = smoothstep(0.25, 0.72, p);
    float travel = mix(radius * (1.0 - converge * 0.84), 0.16 + radius * 4.2 * eject, step(0.32, p));
    float ray = 0.82 + 0.18 * sin(t * (5.0 + uArms) + uPhase);
    local = direction * travel * ray;
    local.z += sin(t * 3.0 + uTime) * (0.12 + age * 0.14);
    float shock = abs(length(local) - (0.55 + age * 5.1));
    alpha *= 0.32 + 0.68 * exp(-shock * 5.5);
    pointSize = mix(2.0, 5.8, 1.0 - smoothstep(0.28, 0.55, p));
    color = mix(uColorC, uColorA, smoothstep(0.0, 0.85, aSeed));
  } else if (uMode < 1.5) {
    float lane = floor(aSeed * 7.0);
    float across = fract(aSeed * 71.31) - 0.5;
    float travel = fract(aSeed * 13.17 + uProgress * (0.76 + lane * 0.035));
    float x = mix(-uViewport.x * 1.08, uViewport.x * 1.08, travel);
    float y = (lane - 3.0) * uViewport.y * 0.12 + across * uViewport.y * 0.12
      + sin(travel * 6.283 + lane) * uViewport.y * 0.09;
    local = vec3(x, y, (fract(aSeed * 11.7) - 0.5) * 5.0);
    alpha *= sin(3.1415926 * travel) * (0.22 + 0.78 * smoothstep(0.0, 0.18, p));
    pointSize = 1.6 + 4.5 * fract(aSeed * 37.9);
    color = mix(uColorB, uColorC, fract(lane * 0.37));
  } else if (uMode < 2.5) {
    float draw = smoothstep(aSeed - 0.08, aSeed + 0.035, p * 1.18);
    float theta = t * 2.0 + uPhase;
    vec2 curve;
    if (uCurve < 0.5) curve = rose(theta, max(3.0, uArms));
    else if (uCurve < 1.5) curve = vec2(1.8 * cos(theta) - 0.7 * cos(2.0 * theta), 1.8 * sin(theta) - 0.7 * sin(2.0 * theta));
    else if (uCurve < 2.5) curve = vec2(2.5 * cos(theta), 1.5 * sin(2.0 * theta + uPhase));
    else if (uCurve < 3.5) curve = vec2((0.18 + 2.3 * aSeed) * cos(theta), (0.18 + 2.3 * aSeed) * sin(theta));
    else if (uCurve < 4.5) curve = vec2(2.1 * cos(theta) + 0.6 * cos(3.0 * theta), 1.7 * sin(theta) - 0.45 * sin(3.0 * theta));
    else if (uCurve < 5.5) curve = vec2(2.1 * sin(2.0 * theta), 1.8 * sin(3.0 * theta + uPhase));
    else if (uCurve < 6.5) curve = rose(theta, 3.0);
    else if (uCurve < 7.5) curve = vec2(2.0 * cos(theta) + 0.75 * cos(3.0 * theta + uPhase), 1.6 * sin(theta) + 0.5 * sin(2.0 * theta));
    else curve = vec2(2.1 * cos(theta) * (0.62 + 0.2 * cos(2.0 * theta)), 1.7 * sin(theta) * (0.62 + 0.2 * cos(2.0 * theta)));
    local = vec3(curve, sin(t * 4.0 + uTime) * 0.35);
    local.xy += direction.xy * (1.0 - draw) * 2.3;
    float runner = pow(max(0.0, cos((aSeed - p) * 6.283 * 1.18)), 18.0);
    alpha *= draw * (0.24 + runner * 0.76);
    pointSize = 1.6 + runner * 3.8;
    color = mix(uColorA, uColorB, 0.5 + 0.5 * sin(theta * 0.5));
  } else if (uMode < 3.5) {
    float theta = t + uPhase + uProgress * 5.2 + radius * 2.4;
    float spread = radius * (0.75 + 0.65 * sin(uProgress * 3.1415926));
    local = vec3(cos(theta) * spread, sin(theta) * spread * 0.72, direction.z * radius * 1.8);
    float riftOpen = smoothstep(0.25, 0.72, p);
    local.xy += direction.xy * riftOpen * 1.45;
    local.xy += vec2(cos(uPhase), sin(uPhase)) * riftOpen * 0.34;
    alpha *= 0.5 + 0.5 * sin(t * 4.0 + uProgress * 10.0);
    pointSize = 1.6 + 3.8 * fract(aSeed * 29.0);
    color = mix(uColorB, uColorA, fract(aSeed * 17.0));
  } else if (uMode < 4.5) {
    float branch = floor(aSeed * max(3.0, uArms));
    float branchAngle = branch * 6.2831853 / max(3.0, uArms) + uPhase;
    float theta = t * 1.5 + uProgress * 7.0 + branchAngle;
    float orbit = 0.75 + fract(aSeed * 19.7) * 2.25;
    local = vec3(cos(theta) * orbit, sin(theta) * orbit * 0.76, direction.z * orbit);
    alpha *= 0.35 + 0.65 * smoothstep(0.0, 0.35, p) * (0.55 + 0.45 * sin(t * 5.0 + uTime));
    pointSize = 1.8 + 3.5 * fract(aSeed * 47.0);
    color = mix(uColorC, uColorA, fract(branch * 0.31));
  } else if (uMode < 5.5) {
    float wave = 0.5 + 0.5 * sin(uProgress * 6.283 + radius * 4.2 - t);
    float breathe = 0.9 + 0.28 * sin(uProgress * 6.283);
    local = position * breathe;
    local.xy += direction.xy * wave * 0.46;
    alpha *= wave * (0.25 + 0.75 * smoothstep(0.0, 0.18, p));
    pointSize = 1.7 + wave * 3.6;
    color = mix(uColorB, uColorC, wave);
  } else if (uMode < 6.5) {
    float lens = exp(-radius * radius * 0.34) * (0.28 + 0.72 * p);
    float theta = t + lens * (1.1 + uProgress * 1.8);
    local.xy = direction.xy * radius + vec2(-sin(theta), cos(theta)) * lens * 0.76;
    local.z = direction.z * radius + lens * 0.65;
    float ring = abs(radius - (0.8 + p * 2.15));
    alpha *= 0.2 + 0.8 * exp(-ring * 4.0);
    pointSize = 1.7 + lens * 3.5;
    color = mix(uColorB, uColorA, lens);
  } else {
    float node = floor(aSeed * 18.0);
    float theta = node * 2.399963 + uPhase;
    float orbit = 0.45 + fract(aSeed * 31.3) * 2.5;
    local = vec3(cos(theta) * orbit, sin(theta) * orbit * 0.74, direction.z * 1.2);
    float link = smoothstep(0.12, 0.28, p) * (0.55 + 0.45 * sin(t * 8.0 + uProgress * 8.0));
    alpha *= link * (0.35 + 0.65 * sin(t * 3.0 + uTime));
    pointSize = 1.5 + link * 3.4;
    color = mix(uColorA, uColorC, fract(node * 0.29));
  }

  float recovery = 1.0 - smoothstep(0.82, 1.0, uProgress);
  alpha *= uIntensity * recovery;
  vec4 mv = modelViewMatrix * vec4(local + uCenter, 1.0);
  vec4 clip = projectionMatrix * mv;
  vec2 ndc = clip.xy / max(0.0001, clip.w);
  vec2 outside = max(uProtectRect.xy - ndc, ndc - uProtectRect.zw);
  float protectedArea = 1.0 - smoothstep(0.0, 0.045, length(max(outside, vec2(0.0))));
  vec2 titleOutside = max(uTitleProtectRect.xy - ndc, ndc - uTitleProtectRect.zw);
  float titleProtection = 1.0 - smoothstep(0.0, 0.045, length(max(titleOutside, vec2(0.0))));
  alpha *= 1.0 - max(protectedArea, titleProtection);
  gl_Position = clip;
  gl_PointSize = clamp(pointSize * uPixelRatio * (18.0 / max(1.0, -mv.z)), 1.0, 15.0 * uPixelRatio);
  vColor = color;
  vAlpha = alpha;
  vSeed = aSeed;
}`;

const fragmentShader = /* glsl */ `
precision highp float;
varying vec3 vColor;
varying float vAlpha;
varying float vSeed;
void main() {
  vec2 q = gl_PointCoord - 0.5;
  float r = length(q) * 2.0;
  if (r > 1.0) discard;
  float core = exp(-r * r * 12.0);
  float sparkle = smoothstep(0.965, 0.997, fract(vSeed * 71.3));
  float glint = sparkle * (exp(-abs(q.x) * 44.0) + exp(-abs(q.y) * 44.0)) * 0.18;
  gl_FragColor = vec4(vColor * (0.54 + core * 0.78 + glint), (core + glint) * vAlpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const lineVertexShader = /* glsl */ `
attribute float aLineSeed;
attribute float aSide;
attribute float aType;
uniform float uProgress;
uniform float uIntensity;
uniform float uMode;
uniform float uTime;
uniform float uArms;
uniform float uPhase;
uniform vec2 uViewport;
uniform vec3 uCenter;
uniform vec4 uProtectRect;
uniform vec4 uTitleProtectRect;
uniform vec3 uColorA;
uniform vec3 uColorB;
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec3 p = position;
  float alpha = 0.0;
  if (uMode > 6.5) {
    float reveal = smoothstep(aLineSeed - 0.025, aLineSeed + 0.12, uProgress * 1.22);
    alpha = reveal * uIntensity * 0.44;
  } else if (uMode > 0.5 && uMode < 1.5) {
    float lane = floor(aLineSeed * 12.0);
    float travel = fract(aLineSeed * 37.13 + uProgress * 0.76);
    float x = mix(-uViewport.x * 1.08, uViewport.x * 1.08, travel)
      - aSide * (0.18 + fract(aLineSeed * 29.1) * 0.2);
    float y = (lane - 5.5) * uViewport.y * 0.08
      + sin(travel * 6.283 + lane) * uViewport.y * 0.055 + aSide * 0.04;
    p = vec3(x, y, (fract(aLineSeed * 13.7) - 0.5) * 4.2);
    alpha = sin(3.1415926 * travel) * uIntensity * 0.74;
  } else if (uMode < 0.5 && aType > 1.5 && aType < 2.5) {
    float ring = floor(aLineSeed * 3.0);
    float radius = 0.42 + ring * 0.2 + uProgress * (2.6 + ring * 0.58);
    p.xy = normalize(position.xy + vec2(0.0001)) * radius;
    p.z = position.z * 0.25;
    alpha = uIntensity * (0.76 - ring * 0.13) * (1.0 - smoothstep(0.82, 1.0, uProgress));
  } else if (uMode < 0.5 && aType > 2.5) {
    float ray = floor(aLineSeed * 28.0);
    float angle = ray * 0.224399 + uPhase;
    float reach = 0.3 + uProgress * (3.0 + fract(ray * 0.37) * 2.1);
    float rayDistance = mix(0.12, reach, aSide);
    p = vec3(cos(angle) * rayDistance, sin(angle) * rayDistance, sin(angle * uArms) * 0.42);
    alpha = uIntensity * (0.58 + 0.42 * sin(ray * 9.7))
      * (1.0 - smoothstep(0.82, 1.0, uProgress)) * smoothstep(-0.2, 0.05, sin(angle));
  }
  vec4 mv = modelViewMatrix * vec4(p + uCenter, 1.0);
  vec4 clip = projectionMatrix * mv;
  vec2 ndc = clip.xy / max(0.0001, clip.w);
  vec2 outside = max(uProtectRect.xy - ndc, ndc - uProtectRect.zw);
  float protectedArea = 1.0 - smoothstep(0.0, 0.045, length(max(outside, vec2(0.0))));
  vec2 titleOutside = max(uTitleProtectRect.xy - ndc, ndc - uTitleProtectRect.zw);
  float titleProtection = 1.0 - smoothstep(0.0, 0.045, length(max(titleOutside, vec2(0.0))));
  alpha *= 1.0 - max(protectedArea, titleProtection);
  gl_Position = clip;
  vColor = mix(uColorA, uColorB, fract(aLineSeed * 3.7 + uTime * 0.025));
  vAlpha = alpha;
}`;

const lineFragmentShader = /* glsl */ `
precision highp float;
varying vec3 vColor;
varying float vAlpha;
void main() {
  gl_FragColor = vec4(vColor * 1.15, vAlpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const CONSTELLATION_LINKS = Object.freeze([
  [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6],
  [6, 7], [7, 8], [8, 9], [9, 10], [10, 11], [11, 0],
  [0, 6], [2, 8], [4, 10], [1, 7]
]);
const METEOR_TRAILS = 12;
const RING_SEGMENTS = 48;
const SUPERNOVA_RAYS = 28;
const RING_START = CONSTELLATION_LINKS.length + METEOR_TRAILS;
const RAY_START = RING_START + RING_SEGMENTS * 3;
const EVENT_LINE_SEGMENTS = RAY_START + SUPERNOVA_RAYS;

function seededRandom(seed) {
  let state = seed >>> 0 || 1;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export class CosmicEventLayer {
  constructor(scene, { mobile = false, pixelRatio = 1 } = {}) {
    this.scene = scene;
    this.count = mobile ? 420 : 780;
    const random = seededRandom(0x51e11a7);
    const positions = new Float32Array(this.count * 3);
    const seeds = new Float32Array(this.count);
    for (let i = 0; i < this.count; i++) {
      const z = random() * 2 - 1;
      const angle = random() * Math.PI * 2;
      const radius = 0.24 + random() * 1.25;
      const planar = Math.sqrt(1 - z * z);
      positions[i * 3] = Math.cos(angle) * planar * radius;
      positions[i * 3 + 1] = Math.sin(angle) * planar * radius;
      positions[i * 3 + 2] = z * radius;
      seeds[i] = random();
    }
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
    this.uniforms = {
      uTime: { value: 0 }, uProgress: { value: 0 }, uIntensity: { value: 0 },
      uMode: { value: 0 }, uCurve: { value: 0 }, uArms: { value: 4 }, uPhase: { value: 0 },
      uPixelRatio: { value: pixelRatio }, uCenter: { value: new THREE.Vector3() },
      uViewport: { value: new THREE.Vector2(8, 5) },
      uProtectRect: { value: new THREE.Vector4(2, 2, 3, 3) },
      uTitleProtectRect: { value: new THREE.Vector4(2, 2, 3, 3) },
      uColorA: { value: new THREE.Color('#a4869b') },
      uColorB: { value: new THREE.Color('#8290ad') },
      uColorC: { value: new THREE.Color('#b9a485') }
    };
    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms, vertexShader, fragmentShader,
      transparent: true, depthTest: false, depthWrite: false,
      blending: THREE.AdditiveBlending, toneMapped: true
    });
    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 3;
    scene.add(this.points);

    const lineCount = EVENT_LINE_SEGMENTS * 2;
    const lineGeometry = new THREE.BufferGeometry();
    const linePositions = new Float32Array(lineCount * 3);
    const lineSeeds = new Float32Array(lineCount);
    const lineSides = new Float32Array(lineCount);
    const lineTypes = new Float32Array(lineCount);
    for (let i = 0; i < EVENT_LINE_SEGMENTS; i++) {
      let seed;
      let type;
      if (i < CONSTELLATION_LINKS.length) {
        seed = i / CONSTELLATION_LINKS.length;
        type = 0;
      } else if (i < RING_START) {
        seed = (i - CONSTELLATION_LINKS.length) / METEOR_TRAILS;
        type = 1;
      } else if (i < RAY_START) {
        seed = Math.floor((i - RING_START) / RING_SEGMENTS) / 3;
        type = 2;
      } else {
        seed = (i - RAY_START) / SUPERNOVA_RAYS;
        type = 3;
      }
      lineSeeds[i * 2] = lineSeeds[i * 2 + 1] = seed;
      lineTypes[i * 2] = lineTypes[i * 2 + 1] = type;
      lineSides[i * 2] = 0;
      lineSides[i * 2 + 1] = 1;
    }
    lineGeometry.setAttribute('position', new THREE.BufferAttribute(linePositions, 3).setUsage(THREE.DynamicDrawUsage));
    lineGeometry.setAttribute('aLineSeed', new THREE.BufferAttribute(lineSeeds, 1));
    lineGeometry.setAttribute('aSide', new THREE.BufferAttribute(lineSides, 1));
    lineGeometry.setAttribute('aType', new THREE.BufferAttribute(lineTypes, 1));
    lineGeometry.setDrawRange(0, 0);
    const lineUniforms = {
      uProgress: this.uniforms.uProgress,
      uIntensity: this.uniforms.uIntensity,
      uMode: this.uniforms.uMode,
      uTime: this.uniforms.uTime,
      uArms: this.uniforms.uArms,
      uPhase: this.uniforms.uPhase,
      uViewport: this.uniforms.uViewport,
      uCenter: this.uniforms.uCenter,
      uProtectRect: this.uniforms.uProtectRect,
      uTitleProtectRect: this.uniforms.uTitleProtectRect,
      uColorA: this.uniforms.uColorA,
      uColorB: this.uniforms.uColorB
    };
    this.lineMaterial = new THREE.ShaderMaterial({
      uniforms: lineUniforms,
      vertexShader: lineVertexShader,
      fragmentShader: lineFragmentShader,
      transparent: true, depthTest: false, depthWrite: false,
      blending: THREE.AdditiveBlending, toneMapped: true
    });
    this.lines = new THREE.LineSegments(lineGeometry, this.lineMaterial);
    this.lines.frustumCulled = false;
    this.lines.renderOrder = 3.1;
    scene.add(this.lines);
  }

  setEvent(mode, profile, palette, center, curve) {
    const uniforms = this.uniforms;
    uniforms.uMode.value = mode;
    uniforms.uCurve.value = curve;
    uniforms.uArms.value = profile.arms;
    uniforms.uPhase.value = profile.phase;
    uniforms.uCenter.value.set(center.x, center.y, center.z);
    uniforms.uProtectRect.value.set(...(center.protectRect || [2, 2, 3, 3]));
    uniforms.uTitleProtectRect.value.set(...(center.titleProtectRect || [2, 2, 3, 3]));
    uniforms.uProgress.value = 0;
    uniforms.uIntensity.value = 0;
    uniforms.uColorA.value.set(palette[0]);
    uniforms.uColorB.value.set(palette[1 % palette.length]);
    uniforms.uColorC.value.set(palette[2 % palette.length]);
    const lineGeometry = this.lines.geometry;
    const linePositions = lineGeometry.getAttribute('position');
    const pointAt = index => {
      const t = index / 12 * Math.PI * 2 + profile.phase;
      let x;
      let y;
      if (curve === 2) {
        const r = 2.2 * (0.64 + 0.32 * Math.cos(Math.max(3, profile.arms) * t));
        x = r * Math.cos(t); y = r * Math.sin(t);
      } else if (curve === 5) {
        x = 2.2 * Math.sin(2 * t); y = 1.8 * Math.sin(3 * t + profile.phase);
      } else if (curve === 7) {
        x = 1.7 * Math.cos(t) + 0.55 * Math.cos(3 * t + profile.phase);
        y = 1.4 * Math.sin(t) + 0.42 * Math.sin(2 * t);
      } else {
        const r = 1.4 + 0.55 * Math.sin(Math.max(2, profile.arms) * t + profile.phase);
        x = r * Math.cos(t); y = r * Math.sin(t) * 0.74;
      }
      return [x, y, Math.sin(t * 2 + profile.phase) * 0.22];
    };
    for (let edge = 0; edge < CONSTELLATION_LINKS.length; edge++) {
      const [from, to] = CONSTELLATION_LINKS[edge];
      linePositions.setXYZ(edge * 2, ...pointAt(from));
      linePositions.setXYZ(edge * 2 + 1, ...pointAt(to));
    }
    for (let ring = 0; ring < 3; ring++) {
      for (let segment = 0; segment < RING_SEGMENTS; segment++) {
        const a = segment / RING_SEGMENTS * Math.PI * 2;
        const b = (segment + 1) / RING_SEGMENTS * Math.PI * 2;
        const vertex = (RING_START + ring * RING_SEGMENTS + segment) * 2;
        linePositions.setXYZ(vertex, Math.cos(a), Math.sin(a), 0);
        linePositions.setXYZ(vertex + 1, Math.cos(b), Math.sin(b), 0);
      }
    }
    for (let ray = 0; ray < SUPERNOVA_RAYS; ray++) {
      const angle = ray * Math.PI * 2 / SUPERNOVA_RAYS;
      const vertex = (RAY_START + ray) * 2;
      linePositions.setXYZ(vertex, Math.cos(angle), Math.sin(angle), 0);
      linePositions.setXYZ(vertex + 1, Math.cos(angle), Math.sin(angle), 0);
    }
    linePositions.needsUpdate = true;
    this.lines.visible = mode === 0 || mode === 1 || mode === 7;
    this.updateLines();
  }

  setTime(time) {
    this.uniforms.uTime.value = time;
    this.updateLines();
  }

  setViewport(width, height, cameraZ, fov) {
    const halfHeight = Math.tan(THREE.MathUtils.degToRad(fov * 0.5)) * cameraZ;
    this.uniforms.uViewport.value.set(
      halfHeight * Math.max(0.1, width / Math.max(1, height)),
      halfHeight
    );
  }

  updateLines() {
    if (!this.lines) return;
    const mode = this.uniforms.uMode.value;
    const intensity = this.uniforms.uIntensity.value;
    const progress = this.uniforms.uProgress.value;
    let start = 0;
    let segmentCount = 0;
    if (mode === 0) {
      start = RING_START * 2;
      segmentCount = RING_SEGMENTS * 3 + SUPERNOVA_RAYS;
    } else if (mode === 1) {
      start = CONSTELLATION_LINKS.length * 2;
      segmentCount = METEOR_TRAILS;
    } else if (mode === 7) {
      segmentCount = Math.ceil(CONSTELLATION_LINKS.length * Math.min(1, progress * 1.22));
    }
    this.lines.geometry.setDrawRange(start, segmentCount * 2);
    this.lines.visible = segmentCount > 0 && intensity > 0.015;
  }

  setPixelRatio(value) { this.uniforms.uPixelRatio.value = value; }

  dispose() {
    this.scene.remove(this.points);
    this.scene.remove(this.lines);
    this.geometry.dispose();
    this.material.dispose();
    this.lines.geometry.dispose();
    this.lineMaterial.dispose();
  }
}
