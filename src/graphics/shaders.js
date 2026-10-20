export const galaxyVertexShader = /* glsl */ `
attribute vec3 aFrom;
attribute float aGroup;
attribute float aSeed;
attribute float aProgress;
attribute float aArm;
uniform float uTime;
uniform float uPixelRatio;
uniform float uTransition;
uniform float uOpacity;
uniform float uSpin;
uniform float uSpinDirection;
uniform float uSpiralFlow;
uniform float uSpiralAngleStep;
uniform float uSpiralGrowth;
uniform float uFlow;
uniform float uPulse;
uniform float uPhase;
uniform float uDepth;
uniform float uMorphology;
uniform float uArmWidth;
uniform float uNebulaOpacity;
uniform float uFlocculence;
uniform float uBulgeSize;
uniform float uHaloLayers;
uniform float uNova;
uniform vec3 uCentrifugal;
uniform float uCentrifugalTime;
uniform float uTitleDim;
uniform vec4 uTitleBounds;
uniform vec4 uWishBounds;
uniform vec3 uFlare;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform vec3 uColorC;
varying vec3 vColor;
varying float vAlpha;
varying float vSeed;
varying float vGroup;
varying float vNebula;
varying float vHalo;
void main() {
  float transition = smoothstep(0.0, 1.0, uTransition);
  vec3 p = mix(aFrom, position, transition);
  float radius = length(p.xy);
  float spinRate = uSpinDirection * uSpin * (0.46 + 1.5 / (0.35 + radius * 0.45));
  spinRate *= 0.82 + 0.36 * fract(aArm * 0.371 + aSeed * 0.19);
  float armParticle = aGroup == 1.0 || aGroup == 2.0 || aGroup == 3.0
    || aGroup == 5.0 || aGroup == 6.0 || aGroup == 7.0 ? 1.0 : 0.0;
  float transportEnvelope = 1.0;
  if (uSpiralFlow > 0.0 && armParticle > 0.5) {
    float movingProgress = fract(aProgress + uTime * uSpiralFlow * uSpinDirection);
    float progressDelta = movingProgress - aProgress;
    float angle = progressDelta * uSpiralAngleStep;
    mat2 alongArm = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
    p.xy = alongArm * (p.xy * exp(angle * uSpiralGrowth));
    transportEnvelope = smoothstep(0.0, 0.12, movingProgress)
      * (1.0 - smoothstep(0.88, 1.0, movingProgress));
  } else if (armParticle > 0.5) {
    float angle = uTime * spinRate;
    mat2 spin = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
    p.xy = spin * p.xy;
  }
  float flowPhase = uTime * (0.24 + uFlow) + aProgress * 6.2831853 + aSeed * 6.2831853 + uPhase;
  float tangentFlow = sin(flowPhase) * (aGroup == 2.0 ? 0.12 : 0.055);
  if (aGroup == 1.0 || aGroup == 2.0 || aGroup == 3.0 || aGroup == 5.0 || aGroup == 6.0 || aGroup == 7.0) {
    vec2 tangent = normalize(vec2(-p.y, p.x) + vec2(0.0001));
    p.xy += tangent * tangentFlow;
  }
  float breathing = sin(uTime * (0.25 + uFlow * 0.2) + aProgress * 9.0 + aSeed * 8.0);
  p.xy *= 1.0 + breathing * 0.012 * sin(aProgress * 6.2831853);
  p.z += sin(uTime * 0.2 + aSeed * 20.0) * 0.08;
  float transitionCurl = sin(transition * 3.1415926) * (1.0 - transition * 0.35);
  vec2 radial = normalize(p.xy + vec2(0.0001));
  p.xy += vec2(-radial.y, radial.x) * sin(transition * 6.2831853 + aSeed * 14.0)
    * transitionCurl * (0.26 + aGroup * 0.035);
  p.z += cos(transition * 6.2831853 + aSeed * 13.0) * transitionCurl * 0.38;

  float pulseAge = max(0.0, uTime - uCentrifugalTime);
  vec2 pulseDelta = p.xy - uCentrifugal.xy;
  float pulseDistance = length(pulseDelta);
  float pulseWave = exp(-pow((pulseDistance - pulseAge * 3.4) * 1.25, 2.0)) * exp(-pulseAge * 0.9);
  vec2 pulseDirection = pulseDelta / max(pulseDistance, 0.15);
  float pulseScale = uCentrifugal.z * uPulse * pulseWave;
  p.xy += pulseDirection * pulseScale * 0.48;
  p.xy += vec2(-pulseDirection.y, pulseDirection.x) * pulseScale * (0.08 + uFlow * 0.04);
  p.z += sin(aSeed * 32.0 + pulseAge * 2.0) * pulseWave * uCentrifugal.z * 0.12;
  p.z += sin(uTime * 0.3 + aSeed * 21.0) * uDepth * 0.08;
  float waveRadius = mod(uTime * (0.48 + uFlow * 0.9) + uPhase, 8.4);
  float energyWave = exp(-pow((length(p.xy) - waveRadius) * 1.4, 2.0)) * (0.18 + uNova * 0.92);

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float perspective = 28.0 / max(1.0, -mv.z);
  float core = 1.0 - smoothstep(0.45, 2.7, length(position.xy));
  float coreBloom = exp(-radius * 0.28) * (0.24 + clamp(uNova, 0.0, 0.65) * 0.38);
  coreBloom *= exp(radius * 0.28 * (1.0 - 1.0 / max(uBulgeSize, 0.25)));
  float cluster = aGroup == 3.0 ? 0.78 + 0.42 * smoothstep(0.75, 0.99, fract(aSeed * 23.7)) : 1.0;
  float grain = 0.9 + 0.1 * sin(uTime * (0.35 + aSeed * 0.6) + aSeed * 71.0);
  float nebulaWarp = sin((p.x + sin(p.y * 0.47 + aSeed) * 0.22) * 0.73
    + p.y * 0.31 + uTime * 0.018);
  float nebulaGrain = 0.72 + 0.28 * (0.5 + 0.5 * nebulaWarp);
  float size = (0.46 + aSeed * 0.52 + core * 0.32 + cluster * 0.1)
    * uPixelRatio * perspective;
  size *= aGroup == 1.0 ? mix(0.92, 1.08, clamp(uArmWidth, 0.0, 1.0))
    : aGroup == 2.0 ? 1.0 + uNebulaOpacity * 0.12 : 1.0;
  float sizeGain = aGroup == 0.0 ? 0.9 : aGroup == 1.0 ? 1.58
    : aGroup == 2.0 ? 1.9 + uNebulaOpacity * 0.8 : aGroup == 3.0 ? 1.0
    : aGroup == 4.0 ? 1.65 : aGroup == 5.0 ? 1.02 : aGroup == 6.0 ? 1.06 : aGroup == 7.0 ? 1.12 : 0.92;
  float heroStar = smoothstep(0.984, 0.998, fract(aSeed * 43.7));
  gl_PointSize = clamp(size * sizeGain * 1.12 * (1.0 + heroStar * 0.85), 0.55,
    mix(7.0, 14.0, heroStar) * uPixelRatio);
  float legacyTitleZone = (1.0 - smoothstep(6.2, 7.35, abs(p.x)))
    * (1.0 - smoothstep(2.05, 2.7, abs(p.y - 1.12)));
  vec2 screenPosition = gl_Position.xy / max(0.0001, gl_Position.w);
  vec2 titleDelta = (screenPosition - uTitleBounds.xy) / max(uTitleBounds.zw, vec2(0.0001));
  vec2 wishDelta = (screenPosition - uWishBounds.xy) / max(uWishBounds.zw, vec2(0.0001));
  float titleEllipse = uTitleBounds.z > 0.0 && uTitleBounds.w > 0.0
    ? 1.0 - smoothstep(0.72, 1.5, length(titleDelta)) : 0.0;
  float wishEllipse = uWishBounds.z > 0.0 && uWishBounds.w > 0.0
    ? 1.0 - smoothstep(0.72, 1.5, length(wishDelta)) : 0.0;
  float screenTitleZone = max(titleEllipse, wishEllipse)
    * mix(0.48, 1.0, step(0.32, fract(aSeed * 71.23)));
  float titleBoundsActive = max(uTitleBounds.z, uWishBounds.z);
  float titleZone = titleBoundsActive > 0.0
    ? screenTitleZone : legacyTitleZone;
  float depthFade = mix(0.72, 1.0, smoothstep(-2.2, 1.4, p.z));
  float groupGain = aGroup == 0.0 ? 0.58 : aGroup == 1.0 ? 1.24
    : aGroup == 2.0 ? 0.28 : aGroup == 3.0 ? 0.34 : aGroup == 4.0 ? 0.18
    : aGroup == 5.0 ? 0.72 : aGroup == 6.0 ? 0.34 : aGroup == 7.0 ? 0.42 : 0.4;
  float nebulaGain = aGroup == 2.0 || aGroup == 3.0
    ? uNebulaOpacity * nebulaGrain : 0.0;
  float haloGain = aGroup == 4.0
    ? (0.9 + 0.04 * max(0.0, uHaloLayers - 1.0)) : 1.0;
  vAlpha = uOpacity * groupGain * grain * depthFade
    * mix(1.0, 0.04, titleZone * uTitleDim) * mix(0.44, 1.0, transportEnvelope);
  vAlpha *= (0.82 + pulseWave * uCentrifugal.z * 0.22) * (1.0 + coreBloom * 0.15)
    * (1.0 + nebulaGain * 0.5) * haloGain;
  vec3 armColor = mix(uColorA, uColorB, smoothstep(1.0, 8.8, length(position.xy)));
  vec3 color = armColor;
  if (aGroup == 0.0) color = mix(vec3(0.74, 0.65, 0.54), vec3(0.92, 0.85, 0.79), 0.34 + 0.32 * aSeed);
  else if (aGroup == 2.0) color = mix(uColorA, uColorC, 0.56);
  else if (aGroup == 3.0) color = mix(uColorC, vec3(0.91, 0.84, 0.78), smoothstep(0.7, 0.98, fract(aSeed * 19.1)));
  else if (aGroup == 4.0) color = mix(uColorB, uColorC, 0.52);
  else if (aGroup == 5.0) color = mix(uColorA, uColorC, 0.44 + 0.16 * sin(flowPhase));
  else if (aGroup == 6.0) color = mix(uColorB, vec3(0.83, 0.86, 0.96), 0.28);
  else if (aGroup == 7.0) color = mix(uColorC, vec3(0.88, 0.84, 0.76), 0.38 + 0.16 * sin(flowPhase));
  float spectralClass = fract(aSeed * 19.19);
  vec3 spectral = mix(vec3(0.72, 0.82, 1.0), vec3(0.45, 0.91, 1.0),
    smoothstep(0.38, 0.58, spectralClass));
  spectral = mix(spectral, vec3(0.79, 0.68, 1.0), smoothstep(0.62, 0.78, spectralClass));
  spectral = mix(spectral, vec3(1.0, 0.79, 0.59), smoothstep(0.85, 0.94, spectralClass));
  spectral = mix(spectral, vec3(1.0, 0.69, 0.79), smoothstep(0.97, 0.995, spectralClass));
  float spectralMix = aGroup == 0.0 ? 0.12 : aGroup == 1.0 ? 0.16
    : aGroup == 2.0 ? 0.22 : aGroup == 3.0 ? 0.18 : aGroup == 5.0 ? 0.24 : aGroup == 7.0 ? 0.24 : 0.14;
  color = mix(color, spectral, spectralMix);
  float dustLane = 1.0 - smoothstep(0.12, 0.48,
    abs(sin(atan(p.y, p.x) - log(max(radius, 0.1)) * (0.42 + uFlocculence * 0.12)
      + sin(p.x * 0.23 + p.y * 0.19) * 0.16)));
  color = mix(color, color * 0.72, dustLane * nebulaGain * 0.24);
  float sparkle = smoothstep(0.94, 0.995, fract(aSeed * 67.3));
  vColor = mix(color, vec3(1.0), heroStar * 0.44)
    * (0.78 + grain * 0.14 + sparkle * (0.18 + pulseWave * 0.08) + energyWave * 0.06 + coreBloom * 0.14);
  vColor = mix(vColor, vec3(1.0, 0.91, 0.78), coreBloom * core * 0.18);
  vColor = mix(vColor, vec3(1.0, 0.88, 0.72), sparkle * (aGroup == 1.0 ? 0.16 : 0.04));
  vColor *= 1.08 + titleZone * uTitleDim * 0.08;
  vAlpha *= 0.98 * (0.9 + sparkle * 0.18 + heroStar * 0.24 + energyWave * 0.14)
    * (aGroup == 4.0 ? 0.68 : 1.0);
  vec2 flareDelta = position.xy - uFlare.xy;
  float flare = uFlare.z * exp(-dot(flareDelta, flareDelta) * 0.9);
  vAlpha *= 1.0 + flare * 0.55;
  vColor *= 1.0 + flare * 0.28;
  gl_PointSize = min(gl_PointSize * (1.0 + flare * 0.22), 15.0 * uPixelRatio);
  vSeed = aSeed;
  vGroup = aGroup;
  vNebula = nebulaGain;
  vHalo = aGroup == 4.0 ? (0.14 + 0.055 * max(0.0, uHaloLayers - 1.0)) * depthFade : 0.0;
}`;

export const galaxyFragmentShader = /* glsl */ `
precision highp float;
varying vec3 vColor;
varying float vAlpha;
varying float vSeed;
varying float vGroup;
varying float vNebula;
varying float vHalo;
void main() {
  vec2 q = gl_PointCoord - 0.5;
  float r = distance(gl_PointCoord, vec2(0.5)) * 2.0;
  if (r > 1.0) discard;
  float core = exp(-r * r * (vGroup < 0.5 ? 17.0 : 12.0));
  float haze = exp(-r * r * 3.8) * (vGroup == 2.0 ? 0.10 : 0.05);
  float innerGlow = exp(-r * r * 1.8) * (vGroup < 0.5 ? 0.13 : 0.05);
  float nebulaGlow = exp(-r * r * 1.35) * vNebula * 0.34;
  float haloGlow = exp(-r * r * 1.1) * vHalo * 0.24;
  float glint = smoothstep(0.975, 0.998, fract(vSeed * 81.7))
    * (exp(-abs(q.x) * 48.0) + exp(-abs(q.y) * 48.0)) * 0.12;
  vec3 emission = vColor * (0.38 + core * 0.7 + haze * 0.20 + innerGlow * 0.16
    + nebulaGlow * 0.22 + haloGlow * 0.14 + glint * 0.04);
  float alpha = clamp((core * 0.78 + haze * 0.58 + innerGlow * 0.34
    + nebulaGlow * 0.42 + haloGlow * 0.3 + glint * 0.24) * vAlpha, 0.0, 0.84);
  vec3 restrainedEmission = clamp(emission, vec3(0.0), vec3(0.88));
  float nucleus = 1.0 - smoothstep(0.0, 0.45, vGroup);
  float hero = smoothstep(0.984, 0.998, fract(vSeed * 43.7));
  float knotHighlight = step(2.5, vGroup) * smoothstep(0.90, 0.995, fract(vSeed * 67.3));
  float selectiveHDR = max(nucleus * 0.74, max(hero * 0.94, knotHighlight * 0.88));
  float emissionGain = mix(1.0, 2.0, selectiveHDR);
  gl_FragColor = vec4(restrainedEmission * emissionGain, alpha);
  #include <colorspace_fragment>
}`;

export const particleVertexShader = /* glsl */ `
attribute vec3 aHNUE;
attribute vec3 aSMCS;
attribute vec3 aK75;
attribute vec3 aRecipient;
attribute vec3 aPreviousRecipient;
attribute vec3 aDirection;
attribute float aSeed;
attribute float aOrbit;
uniform float uTime;
uniform float uMorphFrom;
uniform float uMorphTo;
uniform float uMorph;
uniform float uRecipientMix;
uniform float uRecipientTransition;
uniform float uCharge;
uniform float uBurst;
uniform float uReform;
uniform float uPixelRatio;
uniform float uSizeScale;
uniform float uNova;
uniform vec3 uInteraction;
uniform float uInteractionTime;
uniform vec3 uCentrifugal;
uniform float uCentrifugalTime;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform vec3 uColorC;
varying vec3 vColor;
varying float vAlpha;
varying float vSeed;
varying float vRecipient;
varying float vHero;

vec3 shapeAt(float n) {
  if (n < 0.5) return aHNUE;
  if (n < 1.5) return aSMCS;
  return aK75;
}
vec2 rotatePoint(vec2 point, float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return mat2(c, -s, s, c) * point;
}
// Analytic curl field: curl(A) for a trigonometric vector potential.
// Its divergence is approximately zero, so the cloud swirls without collapsing into noise blobs.
vec3 curlPotential(vec3 p, float t, float seed) {
  p += vec3(seed * 2.1, seed * 4.7, seed * 7.3);
  float cx = -1.73 * sin(p.y * 1.73 - t * 0.21) - 1.28 * cos(p.z * 1.28 - t * 0.31);
  float cy = -1.40 * sin(p.z * 1.40 + t * 0.23) - 1.17 * cos(p.x * 1.17 + t * 0.27);
  float cz = -1.62 * sin(p.x * 1.62 + t * 0.19) - 1.73 * cos(p.y * 1.73 + t * 0.37);
  return vec3(cx, cy, cz);
}
vec3 curlLikeFlow(vec3 p, float t, float seed) {
  vec3 low = curlPotential(p * 0.72, t, seed);
  vec3 high = curlPotential(p * 1.91 + vec3(3.4, -1.7, 2.2), t * 1.37, seed * 1.71);
  return normalize(low + high * 0.27) * (0.76 + 0.24 * sin(seed * 51.0 + t * 0.4));
}
float cellPulse(vec3 p) {
  // A compact Voronoi-inspired cell field adds a quiet, crystalline shimmer.
  vec3 cell = floor(p * 1.7);
  vec3 f = fract(p * 1.7) - 0.5;
  float d = 9.0;
  for (int z = -1; z <= 1; z++) {
    for (int x = -1; x <= 1; x++) {
      vec2 offset = vec2(float(x), float(z));
      vec2 r = vec2(sin(dot(cell.xz + offset, vec2(127.1, 311.7))), cos(dot(cell.xz + offset, vec2(269.5, 183.3)))) * 0.32;
      d = min(d, length(f.xz - offset - r));
    }
  }
  return 1.0 - smoothstep(0.16, 0.48, d);
}
void main() {
  vec3 fromShape = shapeAt(uMorphFrom);
  vec3 toShape = shapeAt(uMorphTo);
  const float signatureTilt = -0.5235988;
  fromShape.xy = rotatePoint(fromShape.xy, signatureTilt);
  toShape.xy = rotatePoint(toShape.xy, signatureTilt);
  float morphProgress = smoothstep(0.0, 1.0, uMorph);
  float morphArc = sin(3.1415926 * morphProgress);
  float infinityAngle = aOrbit * 6.2831853 + uTime * 4.2;
  float infinityCos = cos(infinityAngle);
  float infinityDenominator = 1.0 + infinityCos * infinityCos;
  vec3 infinityShape = vec3(
    3.0 * sin(infinityAngle) / infinityDenominator,
    2.0 * sin(infinityAngle) * infinityCos / infinityDenominator,
    sin(infinityAngle * 2.0) * 0.035
  );
  float nextInfinityAngle = infinityAngle + 0.01;
  float nextInfinityCos = cos(nextInfinityAngle);
  vec2 infinityNext = vec2(
    3.0 * sin(nextInfinityAngle) / (1.0 + nextInfinityCos * nextInfinityCos),
    2.0 * sin(nextInfinityAngle) * nextInfinityCos / (1.0 + nextInfinityCos * nextInfinityCos)
  );
  vec2 infinityTangent = normalize(infinityNext - infinityShape.xy);
  infinityShape.xy += vec2(-infinityTangent.y, infinityTangent.x) * ((aSeed - 0.5) * 0.36);
  infinityShape.xy = rotatePoint(infinityShape.xy, signatureTilt);
  float gatherProgress = smoothstep(0.0, 0.4, uMorph);
  float leaveProgress = smoothstep(0.68, 1.0, uMorph);
  float leaveInfinity = step(0.68, uMorph);
  float gatherArc = sin(3.1415926 * gatherProgress);
  float leaveArc = sin(3.1415926 * leaveProgress);
  vec3 gatheredShape = mix(fromShape, infinityShape, gatherProgress);
  vec3 departingShape = mix(infinityShape, toShape, leaveProgress);
  vec3 p = mix(gatheredShape, departingShape, leaveInfinity);
  vec3 gatherFlow = curlLikeFlow(mix(fromShape, infinityShape, 0.5), gatherProgress * 6.2831853, aSeed);
  vec3 leaveFlow = curlLikeFlow(mix(infinityShape, toShape, 0.5), leaveProgress * 6.2831853, aSeed);
  p += gatherFlow * gatherArc * (0.22 + aSeed * 0.12)
    + leaveFlow * leaveArc * (0.22 + aSeed * 0.12);
  float idleTransition = (1.0 - uRecipientMix) * sin(3.1415926 * uMorph)
    * smoothstep(0.06, 1.1, length(toShape - fromShape));
  p += curlLikeFlow(p, uTime, aSeed) * mix(0.055, 0.030, smoothstep(0.05, 0.9, uRecipientMix));
  p.z += sin(uTime * 0.43 + aSeed * 18.0 + p.x * 1.4) * mix(0.065, 0.045, uRecipientMix);
  p = mix(p, p * 0.075, smoothstep(0.0, 1.0, uCharge));
  float blast = uBurst * (1.0 - smoothstep(0.0, 1.0, uReform));
  p += aDirection * blast * (1.2 + aSeed * 6.6);
  // Spiral return: the debris wraps around the target before settling into the name.
  float recipientT = smoothstep(0.0, 1.0, uRecipientMix);
  float recipientFlow = max(recipientT, blast);
  float spiralAngle = recipientFlow * ((1.0 - recipientT) * 5.2 + aSeed * 0.72
    + sin(uTime * 0.15 + aSeed * 8.0) * 0.18);
  vec3 spiral = p;
  mat2 spin = mat2(cos(spiralAngle), -sin(spiralAngle), sin(spiralAngle), cos(spiralAngle));
  spiral.xy = spin * spiral.xy;
  spiral.z += sin(spiralAngle * 1.7 + aSeed * 12.0) * (1.0 - recipientT) * 0.82;
  vec3 recipientTarget = mix(aPreviousRecipient, aRecipient, smoothstep(0.0, 1.0, uRecipientTransition));
  recipientTarget.y += 0.72;
  recipientTarget.z += sin(recipientTarget.x * 0.34) * cos(recipientTarget.y * 0.72) * 0.025 * recipientT;
  p = mix(spiral, recipientTarget, recipientT);
  p.y *= mix(1.25, 1.0, recipientT);
  p.y += 1.6 * (1.0 - recipientT);
  // Once the name is formed, keep a tiny breathing motion instead of freezing every point.
  float settled = smoothstep(0.72, 1.0, uRecipientMix);
  // The letterform remains locked, while each grain has an independent living
  // drift. A sparse subset temporarily arcs outward, then returns to its exact
  // glyph sample: an actual stardust release rather than a global opacity pulse.
  p += curlLikeFlow(recipientTarget, uTime * 0.42, aSeed) * (0.024 * settled);
  p.z += sin(uTime * 0.62 + aSeed * 36.0) * (0.028 * settled);
  float releaseSeed = smoothstep(0.945, 0.988, fract(aSeed * 57.13));
  float releaseCycle = 0.5 + 0.5 * sin(uTime * (0.58 + aSeed * 0.23) + aSeed * 24.0);
  float release = releaseSeed * settled * pow(releaseCycle, 5.0);
  vec2 releaseDir = normalize(vec2(sin(aSeed * 91.0), cos(aSeed * 73.0)) + vec2(0.001));
  vec2 releaseOrbit = vec2(cos(uTime * 1.35 + aSeed * 18.0), sin(uTime * 1.71 + aSeed * 14.0));
  p.xy += (releaseDir * 0.16 + releaseOrbit * 0.18) * release;
  p.z += sin(uTime * 2.0 + aSeed * 31.0) * release * 0.36;
  float touchAge = max(0.0, uTime - uInteractionTime);
  float touchRing = exp(-pow((length(recipientTarget.xy - uInteraction.xy) - touchAge * 3.2) * 1.65, 2.0))
    * exp(-touchAge * 1.25);
  vec2 touchVector = recipientTarget.xy - uInteraction.xy;
  vec2 touchTangent = vec2(-touchVector.y, touchVector.x) / max(length(touchVector), 0.2);
  p.xy += touchTangent * touchRing * 0.10 * settled;
  float pulseAge = max(0.0, uTime - uCentrifugalTime);
  vec2 pulseDelta = p.xy - uCentrifugal.xy;
  float pulseDistance = length(pulseDelta);
  float pulseWave = exp(-pow((pulseDistance - pulseAge * 3.6) * 1.2, 2.0)) * exp(-pulseAge * 0.9);
  vec2 pulseRadial = pulseDelta / max(pulseDistance, 0.15);
  p.xy += pulseRadial * pulseWave * uCentrifugal.z * 0.42;
  p.xy += vec2(-pulseRadial.y, pulseRadial.x) * pulseWave * uCentrifugal.z * 0.055;
  float waveX = fract(uTime * 0.16) * 17.0 - 8.5;
  // A quiet wave is always present after the name settles; ignition simply
  // amplifies it. This gives the title a readable, recurring current of light.
  float novaWave = exp(-pow((aRecipient.x - waveX) * 1.5, 2.0)) * mix(0.26, 1.0, uNova) * settled;
  float anchor = smoothstep(0.978, 0.998, fract(aSeed * 31.17));
  float heroStar = smoothstep(0.989, 0.999, fract(aSeed * 47.73)) * recipientT;
  float titleDistance = length(recipientTarget.xy - vec2(0.0, 0.72));
  float resonance = exp(-titleDistance * titleDistance * 0.09) * settled;
  vec2 resonanceTangent = normalize(vec2(-recipientTarget.y + 0.72, recipientTarget.x) + vec2(0.001));
  p.xy += resonanceTangent * sin(uTime * 1.15 + aSeed * 18.0) * resonance * 0.018;

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float perspective = 29.0 / max(1.0, -mv.z);
  float cell = cellPulse(p + vec3(uTime * 0.025, 0.0, uTime * 0.018));
  float size = (0.84 + aSeed * 0.82 + cell * 0.28 + anchor * 0.68)
    * mix(1.0, 1.18, recipientT) * uPixelRatio * uSizeScale * perspective;
  size += heroStar * 0.92 * uPixelRatio * uSizeScale * perspective;
  size *= mix(1.30, 1.16, recipientT) * (1.0 - idleTransition * 0.035);
  gl_PointSize = clamp(size, 0.9, (5.8 + heroStar * 2.2) * uPixelRatio * uSizeScale);

  float paletteT = clamp((p.x + 6.3) / 12.6 + 0.13 * sin(aSeed * 9.0 + uTime * 0.12), 0.0, 1.0);
  vec3 baseColor = mix(uColorA, uColorB, smoothstep(0.0, 0.72, paletteT));
  baseColor = mix(baseColor, uColorC, smoothstep(0.55, 1.0, paletteT) * 0.72);
  float sparkle = 0.84 + 0.16 * sin(uTime * (0.28 + aSeed * 0.37) + aSeed * 91.0);
  float livingWave = 0.5 + 0.5 * sin(aRecipient.x * 0.72 - uTime * 0.66 + aSeed * 3.2);
  vec3 pearl = mix(baseColor * 0.84, vec3(0.88, 0.82, 0.76), 0.62);
  vec3 champagne = vec3(0.76, 0.67, 0.54);
  vColor = mix(baseColor * sparkle, pearl, 0.58 * recipientT);
  vColor = mix(vColor, vec3(1.0, 0.91, 0.82), morphArc * (1.0 - recipientT) * 0.16);
  vec3 affiliationPearl = mix(vec3(0.84, 0.78, 0.94), vec3(1.0, 0.88, 0.70), smoothstep(0.25, 0.86, paletteT));
  vColor = mix(vColor, affiliationPearl * sparkle, 0.78 * (1.0 - recipientT));
  vColor = mix(vColor, champagne, anchor * 0.61 * recipientT);
  float spectralClass = fract(aSeed * 29.71);
  vec3 accent = mix(vec3(0.64, 0.86, 1.0), vec3(0.73, 0.62, 1.0),
    smoothstep(0.24, 0.48, spectralClass));
  accent = mix(accent, vec3(1.0, 0.76, 0.58), smoothstep(0.54, 0.72, spectralClass));
  accent = mix(accent, vec3(1.0, 0.65, 0.78), smoothstep(0.83, 0.97, spectralClass));
  vColor = mix(vColor, accent, heroStar * 0.72);
  float depthLight = smoothstep(-0.16, 0.16, p.z);
  vec3 depthTint = mix(vColor * 0.94 + uColorB * 0.025,
    vColor * 1.04 + uColorC * 0.025, depthLight);
  vColor = mix(vColor, depthTint, recipientT * 0.48);
  vColor += vec3(0.10, 0.08, 0.11) * resonance * (0.24 + novaWave * 0.54);
  float grainPulse = 0.76 + 0.24 * sin(aSeed * 37.0 + uTime * (0.31 + aSeed * 0.13));
  float constellationAlpha = 0.70 + 0.30 * cell + anchor * 0.28 + resonance * novaWave * 0.12;
  vAlpha = mix(0.58 + 0.34 * cell, constellationAlpha, recipientT) * grainPulse
    * mix(1.08, 1.10, recipientT);
  vAlpha *= mix(1.0, mix(0.94, 1.04, depthLight), recipientT);
  vAlpha *= 1.0 - idleTransition * 0.14;
  vAlpha *= 1.0 + morphArc * (1.0 - recipientT) * 0.035;
  float starSpacing = 0.72 + 0.28 * smoothstep(0.15, 0.9, fract(aSeed * 41.7));
  vAlpha *= mix(1.0, starSpacing * 0.94, recipientT) * (1.0 + novaWave * 0.12 + touchRing * 0.12);
  vAlpha = clamp(vAlpha * (1.0 + heroStar * 0.24), 0.0, 0.88);
  vSeed = aSeed;
  vRecipient = recipientT;
  vHero = heroStar;
}`;

export const particleFragmentShader = /* glsl */ `
precision highp float;
varying vec3 vColor;
varying float vAlpha;
varying float vSeed;
varying float vRecipient;
varying float vHero;
void main() {
  vec2 q = gl_PointCoord - vec2(0.5);
  float r = length(q) * 2.0;
  if (r > 1.0) discard;
  float core = exp(-r * r * mix(12.0, 25.0, vRecipient));
  float halo = exp(-r * r * 3.0) * mix(0.065, 0.045, vRecipient);
  float rareGlint = smoothstep(0.985, 0.998, fract(vSeed * 73.1)) * vRecipient;
  float starRay = (
    exp(-abs(q.x) * 46.0) * exp(-abs(q.y) * 8.0) +
    exp(-abs(q.y) * 46.0) * exp(-abs(q.x) * 8.0)
  ) * max(rareGlint, vHero) * 0.18;
  float stellarCore = exp(-r * r * 72.0) * vHero;
  float bloomHalo = exp(-r * r * 3.2) * (0.04 + 0.12 * vRecipient);
  float alpha = (core * 1.08 + halo * 0.68 + starRay * 0.42
    + bloomHalo * 0.16 + stellarCore * 0.34) * vAlpha * mix(0.86, 0.90, vRecipient);
  vec3 color = mix(vColor, vec3(1.0), stellarCore * 0.94)
    * (0.34 + core * 0.76 + bloomHalo * 0.14 + starRay * 0.12 + stellarCore * 0.48);
  gl_FragColor = vec4(color, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export const starVertexShader = /* glsl */ `
attribute float aSize;
attribute float aSeed;
attribute float aGlowClass;
attribute float aTwinkleClass;
uniform float uTime;
uniform float uPixelRatio;
uniform float uLayer;
uniform vec3 uCentrifugal;
uniform float uCentrifugalTime;
varying float vAlpha;
varying float vSeed;
varying vec3 vColor;
varying float vHero;
varying float vGlow;
varying float vStrongGlow;
varying float vRay;
void main() {
  vec3 p = position;
  float period = mix(2.0, 6.0, aTwinkleClass);
  float phase = uTime * 6.2831853 / period + aSeed * 74.0;
  float clearTwinkle = step(0.88, fract(aSeed * 37.17));
  float twinkle = 1.0 + sin(phase) * mix(0.02, 0.28, clearTwinkle);
  float layerGain = 1.0;
  if (uLayer < 0.5) {
    // LOD 0 — ancient, tiny stars: almost motionless and very faint.
    p.xy += vec2(sin(aSeed * 31.0), cos(aSeed * 23.0)) * 0.012;
    layerGain = 0.50;
  } else if (uLayer < 1.5) {
    // LOD 1 — middle distance: slow noise-like drift and visible scintillation.
    p.x += sin(uTime * 0.035 + aSeed * 37.0) * 0.22;
    p.y += cos(uTime * 0.029 + aSeed * 13.0) * 0.16;
    p.z += sin(uTime * 0.045 + aSeed * 19.0) * 0.24;
    layerGain = 0.76;
  } else {
    // LOD 2 — close dust-stars glide toward camera, then recycle behind the field.
    p.z = -22.0 + mod((position.z + 22.0) + uTime * (1.0 + aSeed * 1.6), 26.0);
    p.x += sin(uTime * 0.13 + aSeed * 19.0) * (0.25 + aSeed * 0.8);
    p.y += cos(uTime * 0.10 + aSeed * 29.0) * (0.18 + aSeed * 0.45);
    layerGain = 1.0;
  }
  float pulseAge = max(0.0, uTime - uCentrifugalTime);
  vec2 pulseDelta = p.xy - uCentrifugal.xy;
  float pulseDistance = length(pulseDelta);
  float pulseWave = exp(-pow((pulseDistance - pulseAge * 4.1) * 1.35, 2.0)) * exp(-pulseAge * 0.92);
  p.xy += pulseDelta / max(pulseDistance, 0.15) * pulseWave * uCentrifugal.z * 0.34;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  vHero = step(4.01, aSize);
  gl_PointSize = min(2.0 * aSize * uPixelRatio, 12.0 * uPixelRatio);
  vAlpha = layerGain * (0.12 + 0.035 * aSize) * twinkle
    * (1.0 + vHero * 0.45) * (1.72 + vHero * 0.12) * mix(0.84, 1.0, vHero);
  vGlow = step(0.80, aGlowClass);
  vStrongGlow = max(step(0.97, aGlowClass), vHero);
  vRay = vHero * step(0.30, aGlowClass);
  float spectralClass = fract(aSeed * 17.37);
  vec3 stellar = mix(vec3(0.91, 0.94, 1.0), vec3(0.58, 0.78, 1.0),
    smoothstep(0.28, 0.45, spectralClass));
  stellar = mix(stellar, vec3(0.38, 0.84, 1.0), smoothstep(0.56, 0.66, spectralClass) * 0.82);
  stellar = mix(stellar, vec3(0.78, 0.68, 1.0), smoothstep(0.72, 0.81, spectralClass) * 0.82);
  stellar = mix(stellar, vec3(1.0, 0.79, 0.60), smoothstep(0.87, 0.93, spectralClass) * 0.78);
  stellar = mix(stellar, vec3(1.0, 0.69, 0.78), smoothstep(0.97, 0.995, spectralClass) * 0.72);
  vColor = mix(stellar, vec3(1.0), vHero * 0.68);
  vSeed = aSeed;
}`;
export const starFragmentShader = /* glsl */ `
precision highp float;
varying float vAlpha;
varying float vSeed;
varying vec3 vColor;
varying float vHero;
varying float vGlow;
varying float vStrongGlow;
varying float vRay;
uniform float uStarGlow;
void main() {
  vec2 p = gl_PointCoord - 0.5;
  float r = length(p) * 2.0;
  if (r > 1.0) discard;
  float point = exp(-r * r * mix(18.0, 34.0, vHero));
  float halo = 0.0;
  if (vGlow > 0.5 || vHero > 0.5) {
    float softHalo = exp(-r * r * 3.5);
    halo = softHalo * (0.055 * vGlow + 0.12 * vStrongGlow) * uStarGlow;
  }
  float crossGlow = 0.0;
  if (vRay > 0.5) {
    crossGlow = (exp(-abs(p.x) * 48.0) * exp(-abs(p.y) * 5.5)
      + exp(-abs(p.y) * 48.0) * exp(-abs(p.x) * 5.5)) * 0.10;
  }
  float hotCore = 0.0;
  if (vHero > 0.5) hotCore = exp(-r * r * 80.0);
  float a = vAlpha * (point * 0.78 + halo + crossGlow + hotCore * 0.62);
  vec3 color = mix(vColor, vec3(1.0), hotCore * 0.96);
  gl_FragColor = vec4(color * (0.82 + point * 0.44 + halo * 0.42 + hotCore * 0.40), a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

// Simplex-noise GLSL shared by the personal nebula volume and the shared-galaxy
// nebula sprites. Extracted verbatim; the composed nebula shader is byte-identical.
export const simplexNoiseGLSL = /* glsl */ `// Ashima-style 3D Simplex noise. Unlike a sine-based lattice hash, this uses
// compact polynomial permutations and gradient dot-products, which are cheaper
// on mobile GPUs and avoid obvious grid-shaped cloud artifacts.
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float simplex3(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g, l.zxy);
  vec3 i2 = max(g, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(
      i.z + vec4(0.0, i1.z, i2.z, 1.0))
    + i.y + vec4(0.0, i1.y, i2.y, 1.0))
    + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 1.0 / 7.0;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.y;
  vec4 y = y_ * ns.x + ns.y;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

// FBM expects a normalized 0..1 signal; remapping simplex's signed output
// gives predictable cloud thresholds independent of the number of octaves.
float noise3(vec3 p) {
  return clamp(0.5 + 0.5 * simplex3(p), 0.0, 1.0);
}
`;

export const nebulaVertexShader = /* glsl */ `
varying vec3 vWorldPosition;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorldPosition = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}`;

export const nebulaFragmentShader = /* glsl */ `
precision highp float;
uniform float uTime;
uniform float uSteps;
uniform vec3 uCentrifugal;
uniform float uCentrifugalTime;
uniform float uDensity;
uniform float uFbmOctaves;
uniform float uArtStyle;
uniform float uArtSeed;
uniform vec2 uArtAspect;
uniform vec2 uCoreOffset;
uniform float uFlowAngle;
uniform float uArtWarp;
uniform float uArtDensity;
uniform float uMotion;
uniform vec3 uBoxMin;
uniform vec3 uBoxMax;
uniform vec3 uVolumeCenter;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform vec3 uColorC;
uniform vec3 uColorWeights;
uniform vec4 uTitleBounds;
varying vec3 vWorldPosition;

${simplexNoiseGLSL}
float fbm(vec3 p) {
  // Octaves add progressively finer structure. Mobile quality uses fewer
  // octaves through uFbmOctaves, so the most expensive loop can exit early.
  float value = 0.0;
  float amplitude = 0.5;
  float normalization = 0.0;
  for (int octave = 0; octave < 5; octave++) {
    if (float(octave) >= uFbmOctaves) break;
    value += noise3(p) * amplitude;
    normalization += amplitude;
    p = p * 2.02 + vec3(17.17, 9.23, 13.71);
    amplitude *= 0.49;
  }
  return value / max(normalization, 0.0001);
}

void main() {
  vec3 rayOrigin = cameraPosition;
  vec3 rayDirection = normalize(vWorldPosition - rayOrigin);
  // Keep division stable for rays almost parallel to the volume box faces.
  vec3 safeDirection = rayDirection + sign(rayDirection + vec3(0.000001)) * 0.0001;
  vec3 t0 = (uBoxMin - rayOrigin) / safeDirection;
  vec3 t1 = (uBoxMax - rayOrigin) / safeDirection;
  vec3 nearBox = min(t0, t1);
  vec3 farBox = max(t0, t1);
  float tNear = max(max(nearBox.x, nearBox.y), nearBox.z);
  float tFar = min(min(farBox.x, farBox.y), farBox.z);
  float startT = max(tNear, 0.0);
  if (tFar <= startT) discard;

  float titlePlaneT = (0.0 - rayOrigin.z) / rayDirection.z;
  vec2 titlePoint = (rayOrigin + rayDirection * titlePlaneT).xy;
  float titleX = 1.0 - smoothstep(uTitleBounds.x + 0.04, uTitleBounds.x + 0.38, abs(titlePoint.x));
  float titleY = 1.0 - smoothstep(uTitleBounds.y + 0.04, uTitleBounds.y + 0.30, abs(titlePoint.y - uTitleBounds.z));
  float titleZone = titleX * titleY * uTitleBounds.w;
  // Preserve the galaxy behind a title. Only a gentle local contrast lift is
  // needed now that the glyph has a crisp bright core and a separate soft halo.
  float titleProtection = mix(1.0, 0.32, titleZone);

  float span = tFar - startT;
  float transmittance = 1.0;
  vec3 emission = vec3(0.0);
  vec3 timeDrift = vec3(uTime * 0.016, -uTime * 0.011, uTime * 0.008) * mix(0.55, 1.25, uMotion)
    + vec3(sin(uArtSeed * 6.2831853), cos(uArtSeed * 6.2831853), 0.0) * 0.12;
  float seedPhase = uArtSeed * 6.2831853;

  // A low-frequency warp bends the clouds; a cheaper offset noise adds a
  // second direction without paying for a third full FBM stack per sample.
  for (int stepIndex = 0; stepIndex < 10; stepIndex++) {
    if (float(stepIndex) >= uSteps) break;
    float marchT = (float(stepIndex) + 0.5) / uSteps;
    vec3 worldP = rayOrigin + rayDirection * (startT + span * marchT);
    vec3 p = (worldP - uVolumeCenter) * vec3(0.105, 0.135, 0.17);
    float pulseAge = max(0.0, uTime - uCentrifugalTime);
    vec2 pulseVector = worldP.xy - uCentrifugal.xy;
    float pulseDistance = length(pulseVector);
    float pulseWave = exp(-pow((pulseDistance - pulseAge * 3.2) * 1.05, 2.0)) * exp(-pulseAge * 0.82);
    p.xy += pulseVector / max(pulseDistance, 0.15) * pulseWave * uCentrifugal.z * 0.065;

    float broadNoise = fbm(p * 1.38 + timeDrift);
    float crossNoise = noise3(p * 1.72 + vec3(11.7, 3.1, 7.2) - timeDrift * 0.7);
    vec3 warped = p + vec3(broadNoise - 0.48, crossNoise - 0.5,
                           (broadNoise + crossNoise) * 0.24 - 0.22) * uArtWarp;
    float cloudNoise = fbm(warped * 2.42 + timeDrift * 1.55);
    float detailNoise = noise3(warped * 6.7 + timeDrift * 2.0);

    float artAngle = uFlowAngle + (uArtSeed - 0.5) * 0.22;
    mat2 artRotation = mat2(cos(artAngle), -sin(artAngle), sin(artAngle), cos(artAngle));
    vec2 nebulaPlane = artRotation * (warped.xy - uCoreOffset) * uArtAspect;
    float radius = length(nebulaPlane);
    float angle = atan(nebulaPlane.y, nebulaPlane.x);

    // Three separated wisps preserve dark negative space instead of filling
    // the whole screen with a uniformly bright purple fog.
    float mergePhase = uTime * 0.11 * uMotion + seedPhase;
    float mergePulse = 0.5 + 0.5 * sin(mergePhase);
    vec2 centerA = vec2(-0.67 + 0.24 * sin(mergePhase), 0.15 + 0.15 * cos(mergePhase * 0.72));
    vec2 centerB = vec2(0.08 + 0.26 * sin(mergePhase + 2.1), -0.15 + 0.17 * cos(mergePhase * 0.83 + 1.2));
    vec2 centerC = vec2(0.68 - 0.20 * cos(mergePhase * 0.68), 0.24 + 0.13 * sin(mergePhase + 2.8));
    float d0 = length((vec3(nebulaPlane - centerA, warped.z) - vec3(0.0, 0.0, 0.04)) * vec3(1.0, 1.35, 0.72));
    float d1 = length((vec3(nebulaPlane - centerB, warped.z) - vec3(0.0, 0.0, -0.02)) * vec3(1.0, 1.18, 0.70));
    float d2 = length((vec3(nebulaPlane - centerC, warped.z) - vec3(0.0, 0.0, 0.08)) * vec3(1.0, 1.42, 0.76));
    float lobe0 = 1.0 - smoothstep(0.18, 0.72, d0);
    float lobe1 = 1.0 - smoothstep(0.16, 0.61, d1);
    float lobe2 = 1.0 - smoothstep(0.16, 0.68, d2);
    float d3 = length((vec3(nebulaPlane - mix(centerA, centerC, 0.5), warped.z) - vec3(0.0, 0.0, -0.38)) * vec3(1.0, 1.65, 0.62));
    float lobe3 = (1.0 - smoothstep(0.10, 0.44, d3)) * mergePulse;
    float lobes = max(max(lobe0, lobe1), max(lobe2, lobe3));
    float edge = 1.0 - smoothstep(0.42, 1.30, radius);

    float spiral = 0.5 + 0.5 * sin(angle * 2.1 + radius * 6.2 - uTime * 0.085 * uMotion + warped.z * 2.4 + seedPhase);
    float motif = spiral;
    if (uArtStyle >= 0.0) {
      if (uArtStyle < 0.5) {
        motif = 0.5 + 0.5 * cos(angle * 5.0 + seedPhase + radius * 0.45);
      } else if (uArtStyle < 1.5) {
        motif = exp(-abs(nebulaPlane.x * nebulaPlane.x - nebulaPlane.y * nebulaPlane.y) * 3.2);
      } else if (uArtStyle < 2.5) {
        motif = 0.5 + 0.5 * cos(angle - radius * 8.0 + seedPhase);
      } else if (uArtStyle < 3.5) {
        motif = exp(-abs(radius - (0.52 + 0.08 * sin(angle * 2.0 + seedPhase))) * 9.0);
      } else if (uArtStyle < 4.5) {
        motif = exp(-abs(radius - (0.48 + 0.16 * cos(4.0 * angle + seedPhase))) * 8.0);
      } else if (uArtStyle < 5.5) {
        motif = 0.5 + 0.5 * sin(nebulaPlane.y * 8.0 + sin(nebulaPlane.x * 2.8 + seedPhase));
      } else if (uArtStyle < 6.5) {
        motif = 0.5 + 0.5 * cos(angle + radius * 9.0 - seedPhase);
      } else if (uArtStyle < 7.5) {
        motif = 0.5 + 0.5 * cos(angle * 3.0 - radius * 5.5 + seedPhase);
      } else if (uArtStyle < 8.5) {
        float butterflyRadius = abs(sin(angle) * (exp(cos(angle)) - 2.0 * cos(4.0 * angle)));
        motif = exp(-abs(radius * 1.8 - butterflyRadius) * 5.0);
      }
    }
    float cloud = smoothstep(0.35, 0.68, cloudNoise) * edge * lobes * mix(0.78, 1.0, motif);
    float bridgeCurve = 0.14 * sin(nebulaPlane.x * 2.3 + uTime * 0.13 * uMotion + seedPhase);
    float bridge = exp(-abs(nebulaPlane.y - bridgeCurve) * 9.0) * (1.0 - smoothstep(0.75, 1.08, abs(nebulaPlane.x)));
    float filaments = max(max(smoothstep(0.86, 0.98, spiral), smoothstep(0.72, 0.94, motif)), bridge * (0.25 + 0.16 * mergePulse)) * lobes * 0.23;
    float fineDust = max(0.0, detailNoise - 0.68) * lobes * 0.28;
    cloud = clamp(max(cloud, filaments) + fineDust, 0.0, 1.0);

    float localStep = span / max(uSteps, 1.0);
    float density = cloud * uDensity * uArtDensity * 0.165 * localStep * (1.0 + pulseWave * uCentrifugal.z * 0.16);
    float exchange = smoothstep(-0.45, 0.45, nebulaPlane.x + 0.24 * sin(mergePhase + nebulaPlane.y * 2.4));
    vec3 color = mix(uColorA, uColorB, mix(smoothstep(0.12, 0.88, cloudNoise), exchange, 0.42));
    color = mix(color, uColorC, smoothstep(0.64, 0.98, spiral) * 0.42);
    float weightSum = max(dot(uColorWeights, vec3(1.0)), 0.001);
    vec3 weightedPalette = (uColorA * uColorWeights.x + uColorB * uColorWeights.y + uColorC * uColorWeights.z) / weightSum;
    color = mix(color, weightedPalette, 0.24);
    // Rare warm filaments supply a restrained gold accent rather than turning
    // every wisp yellow; the bloom pass will lift only the brightest regions.
    float goldFilament = smoothstep(0.976, 0.999, spiral) * smoothstep(0.52, 0.88, cloudNoise);
    color = mix(color, vec3(0.72, 0.66, 0.55), goldFilament * 0.24);

    float coreGlow = exp(-length(vec3(nebulaPlane * vec2(1.0, 1.18), warped.z * 0.72)) * 4.8);
    density *= titleProtection;
    emission += color * density * transmittance;
    float collisionGlow = (lobe0 * lobe1 + lobe1 * lobe2 + lobe0 * lobe2) * 0.11 * (0.45 + mergePulse * 0.55);
    emission += weightedPalette * coreGlow * mix(1.0, 0.20, titleZone) * uDensity * (0.024 + collisionGlow) * localStep * transmittance;
    transmittance *= exp(-density * 0.72);
  }

  float opacity = clamp(1.0 - transmittance, 0.0, 0.48);
  gl_FragColor = vec4(emission * 1.68, opacity * 0.62);
  #include <colorspace_fragment>
}`;

export const cometTrailVertexShader = /* glsl */ `
attribute float aFade;
attribute float aEdge;
varying float vFade;
varying float vEdge;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  vFade = smoothstep(0.0, 1.0, aFade);
  vEdge = aEdge;
}`;
export const cometTrailFragmentShader = /* glsl */ `
precision highp float;
uniform vec3 uColor;
uniform float uOpacity;
varying float vFade;
varying float vEdge;
void main() {
  float feather = 1.0 - smoothstep(0.34, 1.0, abs(vEdge));
  float tailFade = vFade * vFade;
  float a = tailFade * feather * uOpacity;
  if (a < 0.002) discard;
  gl_FragColor = vec4(uColor * (0.48 + 0.52 * vFade), a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
export const cometHeadVertexShader = /* glsl */ `
uniform float uPixelRatio;
uniform float uSize;
uniform float uOpacity;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp(uSize * uPixelRatio * (22.0 / max(1.0, -mv.z)), 1.0, 8.0 * uPixelRatio);
}`;
export const cometHeadFragmentShader = /* glsl */ `
precision highp float;
uniform vec3 uColor;
uniform float uOpacity;
void main() {
  float r = length(gl_PointCoord - 0.5) * 2.0;
  if (r > 1.0) discard;
  float a = exp(-r*r*9.0) + exp(-r*r*2.0)*0.18;
  gl_FragColor = vec4(uColor, a * uOpacity);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export const nebulaFlowVertexShader = /* glsl */ `
attribute float aSeed;
attribute float aLane;
uniform float uTime;
uniform float uPixelRatio;
uniform float uParticleScale;
uniform float uFlowAngle;
uniform float uMotion;
uniform float uArtSeed;
uniform vec3 uTitleSize;
uniform vec3 uInteraction;
uniform float uInteractionTime;
uniform vec3 uCentrifugal;
uniform float uCentrifugalTime;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform vec3 uColorC;
varying float vAlpha;
varying float vSeed;
varying vec3 vColor;
varying float vSparkle;
void main() {
  float lane = floor(aLane * 4.0);
  float direction = mod(lane, 2.0) < 0.5 ? 1.0 : -1.0;
  float phase = aSeed * 6.2831853 + uTime * (0.08 + uMotion * 0.035) * direction + lane * 1.57 + uArtSeed * 6.2831853;
  float merge = 0.5 + 0.5 * sin(uTime * 0.12 * uMotion + aSeed * 9.0 + uArtSeed * 4.0);
  float radius = mix(5.8, 3.5, merge) + sin(phase * 1.7) * 0.58;
  vec3 p;
  if (lane < 0.5) {
    p = vec3(cos(phase) * radius, sin(phase) * radius * 0.56 + 0.25, -10.0 + sin(phase * 1.35) * 3.1);
  } else if (lane < 1.5) {
    p = vec3(cos(phase * 0.78 + 1.4) * (radius + 1.0), sin(phase * 0.78 + 1.4) * 3.8 - 0.18, -15.0 + cos(phase) * 2.8);
  } else {
    float t = fract(aSeed * 2.3 + uTime * (0.035 + uMotion * 0.016) * direction);
    float across = lane < 2.5 ? mix(-10.0, 10.0, t) : mix(10.0, -10.0, t);
    float bend = sin(t * 6.2831853 * 1.25 + uTime * 0.15 + lane) * (2.4 + merge * 0.8);
    p = vec3(across, bend + (lane < 2.5 ? 1.2 : -1.2), -8.0 - lane * 2.1 + cos(t * 6.2831853 + phase) * 2.4);
  }
  mat2 rotateFlow = mat2(cos(uFlowAngle), -sin(uFlowAngle), sin(uFlowAngle), cos(uFlowAngle));
  p.xy = rotateFlow * p.xy;

  float touchAge = max(0.0, uTime - uInteractionTime);
  vec2 fromTouch = p.xy - uInteraction.xy;
  float attraction = exp(-dot(fromTouch, fromTouch) * 0.22) * exp(-touchAge * 0.9);
  p.xy += vec2(-fromTouch.y, fromTouch.x) * attraction * 0.28;
  p.xy -= fromTouch * attraction * 0.12;
  float pulseAge = max(0.0, uTime - uCentrifugalTime);
  float pulseDistance = length(fromTouch);
  float pulseWave = exp(-pow((pulseDistance - pulseAge * 3.4) * 1.25, 2.0)) * exp(-pulseAge * 0.82);
  p.xy += fromTouch / max(pulseDistance, 0.15) * pulseWave * uCentrifugal.z * 0.42;

  float titleMask = (1.0 - smoothstep(uTitleSize.x, uTitleSize.x + 0.7, abs(p.x)))
    * (1.0 - smoothstep(uTitleSize.y, uTitleSize.y + 0.55, abs(p.y - uTitleSize.z)));
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float sizeClass = fract(aSeed * 23.31);
  vSparkle = smoothstep(0.974, 0.997, sizeClass);
  float sizeTier = sizeClass < 0.72 ? 0.56 + sizeClass * 0.35
    : sizeClass < 0.96 ? 0.92 + (sizeClass - 0.72) * 1.5
      : 1.28 + vSparkle * 0.72;
  gl_PointSize = clamp((0.7 + aSeed * 1.05) * sizeTier * uPixelRatio
    * (21.0 / max(1.0, -mv.z)) * uParticleScale,
    0.55 * uParticleScale, (2.8 + vSparkle * 1.4) * uPixelRatio * uParticleScale);
  float streamPulse = 0.5 + 0.5 * sin(phase * 1.3 + uTime * 0.22);
  vAlpha = (0.045 + streamPulse * 0.065) * (1.0 - titleMask * 0.94);
  vAlpha *= (0.66 + 0.34 * sin(aSeed * 52.0 + uTime * 0.36)) * (1.0 + vSparkle * 0.55);
  float colorMix = fract(aSeed * 4.4 + streamPulse * 0.14);
  vColor = mix(mix(uColorA, uColorB, smoothstep(0.1, 0.75, colorMix)), uColorC, smoothstep(0.78, 1.0, colorMix) * 0.5);
  vSeed = aSeed;
}`;

export const nebulaFlowFragmentShader = /* glsl */ `
precision highp float;
varying float vAlpha;
varying float vSeed;
varying vec3 vColor;
varying float vSparkle;
uniform float uDustGlow;
void main() {
  vec2 p = gl_PointCoord - 0.5;
  float r = length(p) * 2.0;
  if (r > 1.0) discard;
  float dust = exp(-r * r * 11.0);
  float softHalo = exp(-r * r * 3.4);
  float glint = smoothstep(0.94, 0.995, fract(vSeed * 71.3)) * exp(-r * r * 4.0);
  float halo = softHalo * 0.18 * uDustGlow;
  float hotCore = exp(-r * r * 42.0) * vSparkle;
  vec3 color = mix(vColor, vec3(1.0), hotCore * 0.82);
  gl_FragColor = vec4(color * (0.48 + dust * 0.48 + halo * 0.72 + hotCore * 0.4),
    vAlpha * (dust * 0.80 + halo * 0.72 + glint * 0.18 + hotCore * 0.32));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export const diskVertexShader = /* glsl */ `
attribute float aSeed;
attribute float aRadius;
uniform float uTime;
uniform float uPixelRatio;
uniform vec3 uCentrifugal;
uniform float uCentrifugalTime;
varying float vAlpha;
varying float vSeed;
varying float vCore;
void main() {
  vec3 p = position;
  float r = max(aRadius, 0.08);
  float a = atan(p.y / 0.47, p.x) + uTime * (0.006 + 0.052 / (r + 0.55));
  float armBreath = sin(a * 3.0 - log(r + 0.45) * 3.84 + uTime * 0.16 + aSeed * 7.0) * 0.045;
  r += armBreath;
  p.x = cos(a) * r;
  p.y = sin(a) * r * 0.47 + sin(a * 2.0 + uTime * 0.12) * 0.045;
  p.z += sin(a * 3.0 + uTime * 0.13 + aSeed * 12.0) * 0.11;
  float pulseAge = max(0.0, uTime - uCentrifugalTime);
  vec2 pulseDelta = p.xy - uCentrifugal.xy;
  float pulseDistance = length(pulseDelta);
  float pulseWave = exp(-pow((pulseDistance - pulseAge * 3.0) * 1.1, 2.0)) * exp(-pulseAge * 0.75);
  p.xy += pulseDelta / max(pulseDistance, 0.15) * pulseWave * uCentrifugal.z * 0.34;
  a += pulseWave * uCentrifugal.z * 0.075;
  float core = 1.0 - smoothstep(0.45, 2.7, r);
  float diffuse = smoothstep(0.90, 0.995, aSeed);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp((0.95 + aSeed * 1.6 + core * 0.85) * uPixelRatio * (24.0 / max(1.0, -mv.z)), 0.7, 4.0 * uPixelRatio);
  vAlpha = (0.17 + 0.27 * aSeed + core * 0.29) * (0.72 + 0.28 * sin(aSeed * 47.0 + uTime * 0.72))
    * mix(1.0, 0.62, diffuse);
  vSeed = aSeed;
  vCore = core;
}`;
export const diskFragmentShader = /* glsl */ `
precision highp float;
varying float vAlpha;
varying float vSeed;
varying float vCore;
uniform vec3 uColorA;
uniform vec3 uColorB;
void main() {
  float r = length(gl_PointCoord - 0.5) * 2.0;
  if (r > 1.0) discard;
  float a = exp(-r*r*6.0) * vAlpha;
  vec3 c = mix(uColorA, uColorB, fract(vSeed * 13.1));
  c = mix(c, vec3(0.82, 0.75, 0.66), vCore * 0.52);
  gl_FragColor = vec4(c, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
