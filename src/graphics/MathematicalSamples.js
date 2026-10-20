/**
 * Dependency-free deterministic point sampling for STELLAR's generative-form experiments.
 * This utility remains separate from the HNUE → SMCS → K75CLC signature morph.
 * Keep this module free of Three.js/DOM imports so the mathematics can be tested
 * independently of the renderer and browser runtime.
 */
export const MATHEMATICAL_FORM_NAMES = Object.freeze(['rose', 'lemniscate', 'phyllotaxis']);

export function createSeededRandom(seed) {
  if (!Number.isFinite(seed)) throw new TypeError('Seed must be a finite number');
  // Integer seeds are already in the generator's natural 32-bit domain; fractional
  // seeds from recipient art direction are normalized to the same reproducible range.
  let state = Number.isInteger(seed) ? (seed >>> 0) : (Math.floor(seed * 0xFFFFFFFF) >>> 0);
  if (state === 0) state = 0x6D2B79F5;
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Samples a rose curve, a lemniscate, or a golden-angle Vogel spiral into an
 * interleaved xyz Float32Array suitable for a reusable GPU BufferAttribute.
 */
export function makeMathematicalSamples(form, count, seed) {
  if (!MATHEMATICAL_FORM_NAMES.includes(form)) {
    throw new RangeError(`Unknown mathematical form: ${form}`);
  }
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new RangeError('Particle count must be a non-negative safe integer');
  }
  const random = createSeededRandom(seed);
  const out = new Float32Array(count * 3);
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i++) {
    let x = 0, y = 0, z = (random() - 0.5) * 0.72;
    if (form === 'rose') {
      const theta = random() * Math.PI * 2;
      const onCurve = random() > 0.19;
      const roseRadius = 4.55 * Math.cos(5 * theta);
      const fillRadius = Math.sqrt(random()) * Math.abs(roseRadius) * 0.86;
      const radius = onCurve ? roseRadius : Math.sign(roseRadius || 1) * fillRadius;
      x = Math.cos(theta) * radius;
      y = Math.sin(theta) * radius * 0.66;
      x += (random() - 0.5) * (onCurve ? 0.16 : 0.32);
      y += (random() - 0.5) * (onCurve ? 0.13 : 0.26);
    } else if (form === 'lemniscate') {
      const theta = random() * Math.PI * 2;
      const denom = 1 + 0.78 * Math.sin(theta) ** 2;
      const onCurve = random() > 0.21;
      const spread = onCurve ? 1 : Math.sqrt(random()) * 0.84;
      x = (5.95 * Math.cos(theta) / denom) * spread;
      y = (4.0 * Math.sin(theta) * Math.cos(theta) / denom) * spread;
      x += (random() - 0.5) * (onCurve ? 0.14 : 0.28);
      y += (random() - 0.5) * (onCurve ? 0.12 : 0.24);
    } else {
      // Vogel/phyllotaxis disk: golden-angle packing with a faint depth tilt.
      const progress = (i + random() * 0.72) / Math.max(1, count);
      const radius = 6.25 * Math.sqrt(progress);
      const theta = i * goldenAngle + (random() - 0.5) * 0.075;
      x = Math.cos(theta) * radius;
      y = Math.sin(theta) * radius * 0.58;
      const arm = 0.5 + 0.5 * Math.sin(theta * 0.5 + radius * 0.7);
      z += (arm - 0.5) * 0.38;
    }
    out[i * 3] = x;
    out[i * 3 + 1] = y;
    out[i * 3 + 2] = z;
  }
  return out;
}
