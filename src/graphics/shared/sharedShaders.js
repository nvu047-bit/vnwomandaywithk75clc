import { simplexNoiseGLSL } from '../shaders.js';

export const MAX_BRIDGES = 16;

const fbmGLSL = /* glsl */ `
uniform float uOctaves;
float fbm(vec3 p) {
  float value = 0.0, amplitude = 0.5, norm = 0.0;
  for (int i = 0; i < 4; i++) {
    if (float(i) >= uOctaves) break;
    value += noise3(p) * amplitude;
    norm += amplitude;
    p = p * 2.03 + vec3(17.1, 9.2, 13.7);
    amplitude *= 0.5;
  }
  return value / max(norm, 0.0001);
}`;

/* ------------------------------------------------------------------ nebula */
// A per-galaxy nebula sprite that lies in the galaxy's own tilted plane. It uses
// the same simplex noise as the personal nebula volume, warped by time, and the
// same style motifs as the personal art directions (rose, lemniscate, ...).
export const galaxyNebulaVertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv * 2.0 - 1.0;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

export const galaxyNebulaFragmentShader = /* glsl */ `
precision highp float;
uniform float uTime;
uniform float uSeed;
uniform float uStyle;
uniform float uMotion;
uniform float uOpacity;
uniform float uArms;
uniform float uPitch;
uniform float uAsym;
uniform float uBloom;
uniform float uBloomAmp;
uniform vec2 uBloomCenter;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform vec3 uColorC;
varying vec2 vUv;
${simplexNoiseGLSL}
${fbmGLSL}

float motifFor(vec2 np, float radius, float angle, float seedPhase) {
  if (uStyle < 0.0) return 0.5 + 0.5 * sin(angle * 2.1 + radius * 6.2 + seedPhase);
  if (uStyle < 0.5) return 0.5 + 0.5 * cos(angle * 5.0 + seedPhase + radius * 0.45);
  if (uStyle < 1.5) return exp(-abs(np.x * np.x - np.y * np.y) * 3.2);
  if (uStyle < 2.5) return 0.5 + 0.5 * cos(angle - radius * 8.0 + seedPhase);
  if (uStyle < 3.5) return exp(-abs(radius - (0.52 + 0.08 * sin(angle * 2.0 + seedPhase))) * 9.0);
  if (uStyle < 4.5) return exp(-abs(radius - (0.48 + 0.16 * cos(4.0 * angle + seedPhase))) * 8.0);
  if (uStyle < 5.5) return 0.5 + 0.5 * sin(np.y * 8.0 + sin(np.x * 2.8 + seedPhase));
  if (uStyle < 6.5) return 0.5 + 0.5 * cos(angle + radius * 9.0 - seedPhase);
  if (uStyle < 7.5) return 0.5 + 0.5 * cos(angle * 3.0 - radius * 5.5 + seedPhase);
  float wing = abs(sin(angle) * (exp(cos(angle)) - 2.0 * cos(4.0 * angle)));
  return exp(-abs(radius * 1.8 - wing) * 5.0);
}

void main() {
  vec2 q = vUv * 1.04;
  float r = length(q);
  float edge = 1.0 - smoothstep(0.55, 1.0, r);
  if (edge <= 0.002) discard;
  float t = uTime;
  float seedPhase = uSeed * 6.2831853;

  // Differential rotation: the inner nebula turns faster than the rim.
  float rot = t * uMotion * (0.05 + 0.20 / (0.32 + r * 3.2));
  float ang = atan(q.y, q.x);

  // Two slowly advected noise fields warp the plane, so structures change form
  // instead of only changing brightness.
  vec3 base = vec3(q * 1.7, uSeed * 7.0);
  float w1 = fbm(base + vec3(t * 0.030, -t * 0.021, t * 0.017));
  float w2 = fbm(base * 1.3 + vec3(5.2, 1.3, -t * 0.026));
  vec2 qw = q + (vec2(w1, w2) - 0.5) * 0.34;
  float rw = length(qw);
  float aw = atan(qw.y, qw.x) - rot;

  float phase = uArms * aw - log(rw + 0.12) * uPitch * 7.0 + seedPhase + uAsym * sin(aw * 0.5 + t * 0.05);
  float arm = pow(0.5 + 0.5 * cos(phase), 1.6);
  float motif = motifFor(qw, rw, aw, seedPhase);
  float structure = mix(arm, mix(arm, motif, 0.5), step(-0.5, uStyle));

  float clouds = fbm(vec3(qw * 3.1, uSeed * 3.0) + vec3(t * 0.050, t * 0.031, -t * 0.022));
  float fine = noise3(vec3(qw * 8.0, t * 0.08 + uSeed));
  float body = exp(-rw * rw * 1.8);
  float dens = structure * smoothstep(0.28, 0.76, clouds) * body;
  dens += max(0.0, fine - 0.68) * structure * body * 0.45;

  // Dust lanes: threads of absorption that drift across the arms.
  float lane = smoothstep(0.58, 0.92, noise3(vec3(qw * 5.6 + vec2(t * 0.02, -t * 0.014), uSeed * 11.0)));
  dens *= 1.0 - lane * 0.5;

  float breath = 0.5 + 0.5 * sin(t * 0.35 + seedPhase);
  float core = exp(-r * r * 46.0) * (0.34 + 0.18 * breath);

  // Nebula-bloom event: a shell expands from uBloomCenter and fills with cloud.
  float bd = length(q - uBloomCenter);
  float front = exp(-pow((bd - uBloom * 0.66) * 5.2, 2.0));
  float fill = (1.0 - smoothstep(0.0, max(0.001, uBloom * 0.66), bd)) * smoothstep(0.0, 0.3, uBloom);
  float bloomEnergy = (front * 0.85 + fill * (0.35 + 0.65 * clouds)) * uBloomAmp;

  vec3 color = mix(uColorA, uColorB, smoothstep(0.08, 0.85, rw + (w1 - 0.5) * 0.45));
  color = mix(color, uColorC, smoothstep(0.55, 0.95, clouds) * 0.5);
  vec3 hot = mix(uColorC, vec3(0.96, 0.9, 0.82), 0.55);
  vec3 emission = color * dens * 1.9 + hot * core * 0.85 + color * bloomEnergy * 1.4;
  gl_FragColor = vec4(emission * edge * uOpacity, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

/* -------------------------------------------------------------------- veil */
// Large, slow dust veils placed between depth layers. Premultiplied blending lets
// them genuinely absorb the light of galaxies behind them while their lit rims add
// a faint glow, giving the sky volume instead of a stack of additive sprites.
export const veilFragmentShader = /* glsl */ `
precision highp float;
uniform float uTime;
uniform float uSeed;
uniform float uAlpha;
uniform vec3 uBody;
uniform vec3 uRim;
varying vec2 vUv;
${simplexNoiseGLSL}
${fbmGLSL}
void main() {
  float r = length(vUv);
  float edge = 1.0 - smoothstep(0.35, 1.0, r);
  if (edge <= 0.002) discard;
  float t = uTime;
  vec3 p = vec3(vUv * 0.85, uSeed * 9.0);
  vec2 warp = vec2(fbm(p + vec3(t * 0.014, 0.0, t * 0.01)), fbm(p + vec3(8.3, t * -0.012, 2.1)));
  float n = fbm(vec3(vUv * 0.95 + (warp - 0.5) * 0.6, uSeed * 5.0) + vec3(t * 0.012, -t * 0.009, t * 0.008));
  float mass = smoothstep(0.38, 0.78, n);
  float rim = (smoothstep(0.30, 0.50, n) - smoothstep(0.50, 0.72, n));
  float a = mass * edge * uAlpha;
  vec3 rgb = uBody * a + uRim * rim * edge * 0.07;
  gl_FragColor = vec4(rgb, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

/* ----------------------------------------------------------------- bridges */
export const bridgeVertexShader = /* glsl */ `
attribute float aEdge;
attribute float aT;
attribute float aSeed;
attribute float aLane;
attribute float aKind;
uniform float uTime;
uniform float uPixelRatio;
uniform float uSizeScale;
uniform float uWobble;
uniform vec3 uCurve[${MAX_BRIDGES * 4}];
uniform vec3 uColA[${MAX_BRIDGES}];
uniform vec3 uColB[${MAX_BRIDGES}];
uniform vec2 uPulse[${MAX_BRIDGES}];
varying vec3 vColor;
varying float vAlpha;
varying float vSeed;

vec3 bezier(vec3 a, vec3 b, vec3 c, vec3 d, float t) {
  float u = 1.0 - t;
  return u * u * u * a + 3.0 * u * u * t * b + 3.0 * u * t * t * c + t * t * t * d;
}
vec3 bezierTangent(vec3 a, vec3 b, vec3 c, vec3 d, float t) {
  float u = 1.0 - t;
  return 3.0 * u * u * (b - a) + 6.0 * u * t * (c - b) + 3.0 * t * t * (d - c);
}

void main() {
  int e = int(aEdge + 0.5);
  vec3 p0 = uCurve[e * 4];
  vec3 p1 = uCurve[e * 4 + 1];
  vec3 p2 = uCurve[e * 4 + 2];
  vec3 p3 = uCurve[e * 4 + 3];
  // The bridge itself undulates: its control points breathe, so the whole current
  // bends and relaxes rather than staying a fixed curve.
  float ph = float(e) * 1.7 + uTime * 0.21;
  p1 += vec3(sin(ph), cos(ph * 0.83), sin(ph * 0.57)) * uWobble;
  p2 += vec3(cos(ph * 1.1 + 1.0), sin(ph * 0.7), cos(ph * 0.9)) * uWobble;

  float dir = mod(float(e), 2.0) < 0.5 ? 1.0 : -1.0;
  float speed = (0.050 + 0.040 * fract(float(e) * 0.618)) * (0.78 + aSeed * 0.5);
  float t = fract(aT + uTime * speed * dir);
  vec3 p = bezier(p0, p1, p2, p3, t);
  vec3 tg = normalize(bezierTangent(p0, p1, p2, p3, t) + vec3(1e-4));
  vec3 side = normalize(cross(tg, vec3(0.0, 0.0, 1.0)) + vec3(1e-4, 0.0, 0.0));
  float taper = sin(3.14159265 * t);
  float spread = aLane * (0.26 + 0.62 * aKind) * taper * (0.65 + 0.35 * sin(uTime * 0.4 + aSeed * 20.0));
  float turbulence = sin(t * 14.0 + uTime * 0.8 + aSeed * 40.0) * 0.12 * taper;
  p += side * (spread + turbulence) + vec3(0.0, 0.0, aLane * 0.55 * taper);

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float dist = max(1.0, -mv.z);
  float size = mix(3.4 + aSeed * 2.8, 10.5 + aSeed * 7.0, aKind) * uPixelRatio * (30.0 / dist) * uSizeScale;
  gl_PointSize = clamp(size, 1.8, 16.0 * uPixelRatio);

  vec2 pulse = uPulse[e];
  float packet = pulse.x >= 0.0 ? exp(-pow((t - pulse.x) * 7.5, 2.0)) * pulse.y : 0.0;
  float flicker = 0.68 + 0.32 * sin(uTime * 0.55 + aSeed * 60.0 + float(e));
  float base = mix(0.82, 0.24, aKind) * flicker * (0.5 + 0.5 * taper);
  vAlpha = base + packet * (0.85 + 0.30 * aKind);
  vColor = mix(uColA[e], uColB[e], t) * (0.95 + packet * 1.2) + vec3(packet * 0.30);
  vSeed = aSeed;
}`;

export const bridgeFragmentShader = /* glsl */ `
precision highp float;
varying vec3 vColor;
varying float vAlpha;
varying float vSeed;
void main() {
  vec2 q = gl_PointCoord - 0.5;
  float r = length(q) * 2.0;
  if (r > 1.0) discard;
  float core = exp(-r * r * 9.0);
  float haze = exp(-r * r * 2.6) * 0.35;
  gl_FragColor = vec4(vColor * (0.45 + core * 0.55), (core * 0.8 + haze) * vAlpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

/* -------------------------------------------------------------- comet dust */
export const dustVertexShader = /* glsl */ `
attribute float aLife;
attribute float aSeed;
uniform float uPixelRatio;
uniform vec3 uColor;
varying float vAlpha;
varying vec3 vColor;
varying float vSeed;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  float dist = max(1.0, -mv.z);
  float life = clamp(aLife, 0.0, 1.0);
  gl_PointSize = clamp((1.6 + aSeed * 3.0) * (0.35 + life) * uPixelRatio * (30.0 / dist), 0.0, 9.0 * uPixelRatio);
  vAlpha = life * life * 0.8;
  vColor = mix(uColor, vec3(1.0), 0.25 + 0.35 * aSeed);
  vSeed = aSeed;
}`;

export const dustFragmentShader = /* glsl */ `
precision highp float;
varying float vAlpha;
varying vec3 vColor;
varying float vSeed;
void main() {
  float r = length(gl_PointCoord - 0.5) * 2.0;
  if (r > 1.0 || vAlpha < 0.004) discard;
  float a = exp(-r * r * 7.0);
  gl_FragColor = vec4(vColor * (0.6 + 0.4 * a), a * vAlpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export const haloVertexShader = /* glsl */ `
uniform float uPixelRatio;
uniform float uSize;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp(uSize * uPixelRatio * (30.0 / max(1.0, -mv.z)), 2.0, 70.0 * uPixelRatio);
}`;

export const haloFragmentShader = /* glsl */ `
precision highp float;
uniform vec3 uColor;
uniform float uOpacity;
void main() {
  float r = length(gl_PointCoord - 0.5) * 2.0;
  if (r > 1.0) discard;
  float a = exp(-r * r * 4.2) * 0.55 + exp(-r * r * 22.0) * 0.6;
  gl_FragColor = vec4(uColor, a * uOpacity);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
