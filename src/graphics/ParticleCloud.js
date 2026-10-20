import * as THREE from 'three';
import { particleVertexShader, particleFragmentShader } from './shaders.js';
import { COSMIC_COLORS } from '../data/cosmicPalette.js';

import { createSeededRandom } from './MathematicalSamples.js';

// Preserve STELLAR's signature idle morph: HNUE → SMCS → K75CLC.
// The words are GPU particle targets, not a DOM banner or card.
const SHAPES = ['HNUE', 'SMCS', 'K75CLC'];
const AFFILIATION_SEED = 0x51e11a7;

function makeTextSamples(text, desiredCount, { recipient = false, seed } = {}) {
  const random = Number.isFinite(seed) ? createSeededRandom(seed) : Math.random;
  const randomBetween = (min, max) => min + random() * (max - min);
  // Draw glyph-by-glyph so Vietnamese marks stay attached and tracking remains predictable.
  const canvas = document.createElement('canvas');
  canvas.width = 2800;
  canvas.height = 820;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  const upper = text.toLocaleUpperCase('vi-VN');
  const isShortMark = ['HNUE', 'SMCS', 'K75CLC', '20·10'].includes(upper);
  const fontFamily = recipient ? '"Baloo 2", "Nunito Sans", "Plus Jakarta Sans", sans-serif' : (isShortMark ? '"Plus Jakarta Sans", "Nunito Sans", sans-serif' : 'Manrope, sans-serif');
  const baseSize = isShortMark ? 275 : recipient ? 370 : 300;
  const trackingFactor = isShortMark ? 0.035 : recipient ? 0.032 : 0.04;
  let fontSize = baseSize;
  let tracking = fontSize * trackingFactor;
  let glyphWidths = [];

  const measure = () => {
    const weight = recipient ? 900 : isShortMark ? 800 : 600;
    ctx.font = `${weight} ${fontSize}px ${fontFamily}`;
    glyphWidths = Array.from(upper, ch => ctx.measureText(ch).width);
    tracking = fontSize * trackingFactor;
    return glyphWidths.reduce((a, b) => a + b, 0) + Math.max(0, upper.length - 1) * tracking;
  };
  let totalWidth = measure();
  const fit = Math.min(1, 2440 / Math.max(1, totalWidth));
  fontSize = Math.floor(fontSize * fit);
  totalWidth = measure();

  let x = (canvas.width - totalWidth) * 0.5;
  const centerY = canvas.height * 0.51;
  ctx.fillStyle = '#fff';
  for (let i = 0; i < upper.length; i++) {
    ctx.fillText(upper[i], x, centerY);
    x += glyphWidths[i] + tracking;
  }

  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const interior = [];
  const contour = [];
  const step = 4;
  const isInk = (x, y) => x >= 0 && y >= 0 && x < canvas.width && y < canvas.height
    && pixels[(y * canvas.width + x) * 4 + 3] > 90;
  for (let y = 2; y < canvas.height - 2; y += step) {
    for (let x = 2; x < canvas.width - 2; x += step) {
      if (!isInk(x, y)) continue;
      const edge = !isInk(x - step, y) || !isInk(x + step, y)
        || !isInk(x, y - step) || !isInk(x, y + step);
      (edge ? contour : interior).push([x, y]);
    }
  }
  const contourWeight = recipient ? 0.42 : isShortMark ? 0.42 : 0.52;
  const candidates = contour.length && interior.length
    ? Array.from({ length: desiredCount }, (_, i) => i < desiredCount * contourWeight
      ? contour[(random() * contour.length) | 0]
      : interior[(random() * interior.length) | 0])
    : contour.length ? contour : interior;
  if (!candidates.length) {
    for (let i = 0; i < desiredCount; i++) candidates.push([randomBetween(500, 2100), randomBetween(240, 520)]);
  }

  const out = new Float32Array(desiredCount * 3);
  for (let i = 0; i < desiredCount; i++) {
    const [sx, sy] = candidates[i % candidates.length];
    const scatter = recipient ? 0.007 : 0.012;
    out[i * 3] = ((sx / canvas.width) - 0.5) * (recipient ? 14.8 : 16.8) + randomBetween(-scatter, scatter);
    out[i * 3 + 1] = (0.5 - sy / canvas.height) * (recipient ? 3.95 : 4.4) + randomBetween(-scatter, scatter);
    out[i * 3 + 2] = randomBetween(recipient ? -0.11 : -0.34, recipient ? 0.11 : 0.34);
  }
  return out;
}

function makeDirections(count) {
  const out = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    // Fibonacci sphere distribution avoids a clumpy explosion.
    const y = 1 - 2 * ((i + 0.5) / count);
    const radius = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = Math.PI * (3 - Math.sqrt(5)) * i;
    out[i * 3] = Math.cos(theta) * radius;
    out[i * 3 + 1] = y;
    out[i * 3 + 2] = Math.sin(theta) * radius;
  }
  return out;
}

function hilbertIndex(x, y) {
  let index = 0;
  for (let scale = 512; scale > 0; scale >>= 1) {
    const rx = (x & scale) === 0 ? 0 : 1;
    const ry = (y & scale) === 0 ? 0 : 1;
    index += scale * scale * ((3 * rx) ^ ry);
    if (ry === 0) {
      if (rx === 1) {
        x = 1023 - x;
        y = 1023 - y;
      }
      [x, y] = [y, x];
    }
  }
  return index;
}

function sortSamplesBySpatialPosition(samples) {
  const count = samples.length / 3;
  const order = Array.from({ length: count }, (_, index) => index);
  const spatialKeys = new Uint32Array(count);
  for (let i = 0; i < count; i++) {
    const x = Math.max(0, Math.min(1023, Math.round((samples[i * 3] / 16.8 + 0.5) * 1023)));
    const y = Math.max(0, Math.min(1023, Math.round((0.5 - samples[i * 3 + 1] / 4.4) * 1023)));
    spatialKeys[i] = hilbertIndex(x, y);
  }
  order.sort((a, b) => spatialKeys[a] - spatialKeys[b]);

  const sorted = new Float32Array(samples.length);
  for (let i = 0; i < count; i++) {
    const offset = order[i] * 3;
    sorted.set(samples.subarray(offset, offset + 3), i * 3);
  }
  return sorted;
}

export class ParticleCloud {
  constructor(scene, { pixelRatio = 1, count = 22000 } = {}) {
    this.scene = scene;
    this.count = count;
    this.titleBounds = [0, 0, 0];
    // Pair particles by a space-filling curve so neighboring samples travel as a coherent patch.
    const aHNUE = sortSamplesBySpatialPosition(makeTextSamples('HNUE', count, { seed: AFFILIATION_SEED }));
    const aSMCS = sortSamplesBySpatialPosition(makeTextSamples('SMCS', count, { seed: AFFILIATION_SEED }));
    const aK75 = sortSamplesBySpatialPosition(makeTextSamples('K75CLC', count, { seed: AFFILIATION_SEED }));
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const target of [aHNUE, aSMCS, aK75]) {
      for (let i = 0; i < target.length; i += 3) {
        minX = Math.min(minX, target[i]); maxX = Math.max(maxX, target[i]);
        minY = Math.min(minY, target[i + 1]); maxY = Math.max(maxY, target[i + 1]);
      }
    }
    const signatureHalfWidth = (maxX - minX) * 0.5;
    const signatureHalfHeight = (maxY - minY) * 0.5;
    const signatureCenterY = (maxY + minY) * 0.5;
    const signatureTilt = -Math.PI / 6;
    const tiltCos = Math.cos(signatureTilt);
    const tiltSin = Math.sin(signatureTilt);
    this.signatureBounds = [
      signatureHalfWidth * tiltCos + signatureHalfHeight * tiltSin,
      signatureHalfWidth * tiltSin + signatureHalfHeight * tiltCos,
      signatureCenterY * tiltCos + 1.6
    ];
    const recipientShape = makeTextSamples('20·10', count);
    const previousRecipient = recipientShape.slice();
    const seed = new Float32Array(count);
    const orbit = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      seed[i] = Math.random();
      orbit[i] = (i + 0.5) / count;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(aHNUE.slice(), 3));
    geometry.setAttribute('aHNUE', new THREE.BufferAttribute(aHNUE, 3));
    geometry.setAttribute('aSMCS', new THREE.BufferAttribute(aSMCS, 3));
    geometry.setAttribute('aK75', new THREE.BufferAttribute(aK75, 3));
    geometry.setAttribute('aRecipient', new THREE.BufferAttribute(recipientShape, 3));
    geometry.setAttribute('aPreviousRecipient', new THREE.BufferAttribute(previousRecipient, 3));
    geometry.setAttribute('aDirection', new THREE.BufferAttribute(makeDirections(count), 3));
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    geometry.setAttribute('aOrbit', new THREE.BufferAttribute(orbit, 1));

    const uniforms = {
      uTime: { value: 0 }, uMorphFrom: { value: 0 }, uMorphTo: { value: 1 }, uMorph: { value: 0 },
      uRecipientMix: { value: 0 }, uCharge: { value: 0 }, uBurst: { value: 0 }, uReform: { value: 0 },
      uRecipientTransition: { value: 1 },
      uPixelRatio: { value: pixelRatio },
      uSizeScale: { value: 1 },
      uNova: { value: 0 },
      uInteraction: { value: new THREE.Vector3() },
      uInteractionTime: { value: -100 },
      uCentrifugal: { value: new THREE.Vector3() },
      uCentrifugalTime: { value: -100 },
      uColorA: { value: new THREE.Color(COSMIC_COLORS.dustyLavender) },
      uColorB: { value: new THREE.Color(COSMIC_COLORS.mauve) },
      uColorC: { value: new THREE.Color(COSMIC_COLORS.mutedTeal) }
    };
    this.uniforms = uniforms;
    const material = new THREE.ShaderMaterial({
      uniforms, vertexShader: particleVertexShader, fragmentShader: particleFragmentShader,
      transparent: true, depthTest: false, depthWrite: false,
      blending: THREE.NormalBlending, toneMapped: false
    });
    this.points = new THREE.Points(geometry, material);
    this.points.frustumCulled = false;
    // This is the foreground identity layer: keep the morphic signature above
    // galaxy/nebula/cosmic-event point fields instead of letting them occlude it.
    this.points.renderOrder = 100;
    this.scene.add(this.points);
    this.setViewport(window.innerWidth, window.innerHeight);
    this.geometry = geometry;
    this.morphTimeline = null;
    this.fromIndex = 0;
    this.toIndex = 1;
    this.hasRecipient = false;
    this.recipientTransitionPending = false;
  }

  setPixelRatio(value) { this.uniforms.uPixelRatio.value = value; }
  setViewport(width, height) {
    const aspect = Math.max(0.1, width / Math.max(1, height));
    const scaleX = Math.min(1, aspect * 0.66);
    const scaleY = Math.min(scaleX, Math.max(0.32, height / 850));
    this.viewportScale = { x: scaleX, y: scaleY };
    // Wide viewports spread the same title particles over a larger screen area.
    const titleCoverage = Math.min(scaleX, scaleY);
    const densityCompensation = 1 + 0.24 * THREE.MathUtils.clamp((titleCoverage - 0.55) / 0.45, 0, 1);
    this.uniforms.uSizeScale.value = THREE.MathUtils.clamp(height / 850, 0.68, 1) * densityCompensation;
    this.points.scale.set(scaleX, scaleY, 1);
  }
  setTime(value) { this.uniforms.uTime.value = value; }
  reactAt(x, y, time) {
    this.uniforms.uInteraction.value.set(x, y, 0);
    this.uniforms.uInteractionTime.value = time;
  }
  triggerCentrifugal(x, y, time, strength) {
    this.reactAt(x, y, time);
    this.uniforms.uCentrifugal.value.set(x, y, strength);
    this.uniforms.uCentrifugalTime.value = time;
  }
  setPalette(palette = [COSMIC_COLORS.dustyLavender, COSMIC_COLORS.mauve, COSMIC_COLORS.mutedTeal]) {
    ['uColorA', 'uColorB', 'uColorC'].forEach((key, i) => this.uniforms[key].value.set(palette[i]));
  }

  setRecipient(name, direction) {
    const target = makeTextSamples(name.toLocaleUpperCase('vi-VN'), this.count, {
      recipient: true,
      seed: direction?.seed
    });
    const transitioning = this.hasRecipient;
    const previous = this.geometry.getAttribute('aPreviousRecipient');
    if (transitioning) {
      previous.array.set(this.geometry.getAttribute('aRecipient').array);
      this.uniforms.uRecipientTransition.value = 0;
    } else {
      previous.array.set(target);
      this.uniforms.uRecipientTransition.value = 1;
    }
    previous.needsUpdate = true;
    this.hasRecipient = true;
    this.recipientTransitionPending = transitioning;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (let i = 0; i < target.length; i += 3) {
      minX = Math.min(minX, target[i]); maxX = Math.max(maxX, target[i]);
      minY = Math.min(minY, target[i + 1]); maxY = Math.max(maxY, target[i + 1]);
    }
    this.titleBounds = [(maxX - minX) * 0.5, (maxY - minY) * 0.5, (maxY + minY) * 0.5 + 0.72];
    const attribute = this.geometry.getAttribute('aRecipient');
    attribute.array.set(target);
    attribute.needsUpdate = true;
  }

  resetRecipientTransition() {
    const current = this.geometry.getAttribute('aRecipient');
    const previous = this.geometry.getAttribute('aPreviousRecipient');
    previous.array.set(current.array);
    previous.needsUpdate = true;
    this.uniforms.uRecipientTransition.value = 1;
    this.hasRecipient = false;
    this.recipientTransitionPending = false;
  }

  startIdleMorph(gsap) {
    this.stopIdleMorph();
    this.fromIndex = 0;
    this.toIndex = 1;
    this.uniforms.uMorphFrom.value = this.fromIndex;
    this.uniforms.uMorphTo.value = this.toIndex;
    this.uniforms.uMorph.value = 0;
    this.morphTimeline = gsap.timeline({
      repeat: -1,
      repeatDelay: 0.8,
      onRepeat: () => {
        this.fromIndex = this.toIndex;
        this.toIndex = (this.toIndex + 1) % SHAPES.length;
        this.uniforms.uMorphFrom.value = this.fromIndex;
        this.uniforms.uMorphTo.value = this.toIndex;
        this.uniforms.uMorph.value = 0;
      }
    }).fromTo(this.uniforms.uMorph, { value: 0 }, { value: 1, duration: 4, ease: 'power3.inOut' });
  }

  stopIdleMorph() {
    this.morphTimeline?.kill();
    this.morphTimeline = null;
  }
  resetEvent() {
    const u = this.uniforms;
    u.uCharge.value = 0; u.uBurst.value = 0; u.uReform.value = 0; u.uRecipientMix.value = 0;
    u.uNova.value = 0; u.uInteractionTime.value = -100;
  }
  dispose() {
    this.stopIdleMorph();
    this.scene.remove(this.points);
    this.geometry.dispose();
    this.points.material.dispose();
  }
}

export { SHAPES };
