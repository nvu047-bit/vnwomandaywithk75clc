import * as THREE from 'three';

const vertexShader = /* glsl */ `
attribute float aSeed;
attribute float aSize;
attribute float aKind;
attribute float aTail;
attribute float aTrack;
attribute vec3 aColor;
uniform float uTime;
uniform float uPixelRatio;
uniform float uAspect;
uniform float uCameraZ;
uniform float uTanHalfFov;
varying vec3 vColor;
varying float vAlpha;

void main() {
  vec3 p = position;
  float phase = aSeed * 6.2831853;
  float size = aSize;
  float alpha = 1.0;
  if (aKind < 0.5) {
    float distanceToCamera = uCameraZ - p.z;
    float halfHeight = distanceToCamera * uTanHalfFov;
    p.x *= halfHeight * uAspect * 1.12;
    p.y *= halfHeight * 1.12;
    p.x += sin(uTime * (0.07 + aSeed * 0.035) + phase) * 0.34;
    p.y += cos(uTime * (0.05 + aSeed * 0.03) + phase * 1.7) * 0.25;
    float twinkle = 0.65 + 0.35 * sin(uTime * (0.45 + aSeed * 0.5) + phase);
    alpha = (0.25 + aSeed * 0.45) * twinkle;
    size *= 0.72 + 0.42 * twinkle;
  } else {
    float cycle = fract(uTime / 9.5 + aTrack * 0.5);
    float progress = aTrack < 0.5 ? cycle : 1.0 - cycle;
    float pathT = progress - aTail * 0.12;
    float distanceToCamera = uCameraZ + 8.0 + aTrack * 10.0;
    float halfHeight = distanceToCamera * uTanHalfFov;
    float x = (pathT * 2.0 - 1.0) * (halfHeight * uAspect + 7.0);
    float y = sin(pathT * 6.2831853 + aSeed) * halfHeight * 0.20
      + sin(pathT * 12.5663706 + aSeed * 1.4) * halfHeight * 0.055;
    p = vec3(x, y, -8.0 - aTrack * 10.0);
    float fadeIn = smoothstep(0.0, 0.10, cycle);
    float fadeOut = 1.0 - smoothstep(0.90, 1.0, cycle);
    alpha = fadeIn * fadeOut * pow(1.0 - aTail, 0.55);
    size *= aTail < 0.001 ? 2.0 : 0.82 + (1.0 - aTail) * 0.35;
  }
  vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  gl_PointSize = clamp(size * uPixelRatio, 1.0, 10.0);
  vColor = aColor;
  vAlpha = alpha;
}`;

const fragmentShader = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec2 point = gl_PointCoord - 0.5;
  float r = length(point);
  float glow = exp(-r * r * 26.0) * (1.0 - smoothstep(0.22, 0.5, r));
  if (glow < 0.008) discard;
  gl_FragColor = vec4(vColor * glow, glow * vAlpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export class IntergalacticField {
  constructor(scene, { mobile = false, rng = Math.random } = {}) {
    this.mobile = mobile;
    this.count = mobile ? 220 : 680;
    this.cometTracks = 2;
    this.trailPoints = mobile ? 14 : 22;
    const total = this.count + this.cometTracks * this.trailPoints;
    const positions = new Float32Array(total * 3);
    const seeds = new Float32Array(total);
    const sizes = new Float32Array(total);
    const kinds = new Float32Array(total);
    const tails = new Float32Array(total);
    const tracks = new Float32Array(total);
    const colors = new Float32Array(total * 3);
    const dustColors = [
      new THREE.Color('#b9c9ea'),
      new THREE.Color('#d6c2df'),
      new THREE.Color('#c2d9df'),
      new THREE.Color('#e5d0b8')
    ];
    let index = 0;
    for (; index < this.count; index++) {
      positions[index * 3] = rng() * 2 - 1;
      positions[index * 3 + 1] = rng() * 2 - 1;
      positions[index * 3 + 2] = -2 - rng() * 67;
      seeds[index] = rng();
      sizes[index] = 1.2 + rng() * (mobile ? 1.1 : 1.7);
      kinds[index] = 0;
      const color = dustColors[Math.floor(rng() * dustColors.length)];
      colors.set([color.r, color.g, color.b], index * 3);
    }
    const cometColors = [new THREE.Color('#e2d6f6'), new THREE.Color('#b8dce9')];
    for (let track = 0; track < this.cometTracks; track++) {
      const color = cometColors[track];
      for (let trail = 0; trail < this.trailPoints; trail++, index++) {
        seeds[index] = track * 0.37 + rng() * 0.16;
        sizes[index] = trail === 0 ? 2.7 : 1.25;
        kinds[index] = 1;
        tails[index] = trail / (this.trailPoints - 1);
        tracks[index] = track;
        colors.set([color.r, color.g, color.b], index * 3);
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('aKind', new THREE.BufferAttribute(kinds, 1));
    geometry.setAttribute('aTail', new THREE.BufferAttribute(tails, 1));
    geometry.setAttribute('aTrack', new THREE.BufferAttribute(tracks, 1));
    geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
    const uniforms = {
      uTime: { value: 0 },
      uPixelRatio: { value: 1 },
      uAspect: { value: 1 },
      uCameraZ: { value: 54 },
      uTanHalfFov: { value: Math.tan(THREE.MathUtils.degToRad(54 * 0.5)) }
    };
    const material = new THREE.ShaderMaterial({
      uniforms, vertexShader, fragmentShader, transparent: true,
      depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
      toneMapped: true
    });
    this.geometry = geometry;
    this.material = material;
    this.uniforms = uniforms;
    this.points = new THREE.Points(geometry, material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 2;
    scene.add(this.points);
  }

  setTime(time) {
    this.uniforms.uTime.value = time;
  }

  setViewport(camera, pixelRatio) {
    this.uniforms.uAspect.value = camera.aspect;
    this.uniforms.uCameraZ.value = camera.position.z;
    this.uniforms.uTanHalfFov.value = Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5));
    this.uniforms.uPixelRatio.value = pixelRatio;
  }

  dispose() {
    this.points.removeFromParent();
    this.geometry.dispose();
    this.material.dispose();
  }
}
