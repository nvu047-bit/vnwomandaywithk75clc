import assert from 'node:assert/strict';
import { makeMathematicalSamples, MATHEMATICAL_FORM_NAMES } from '../src/graphics/MathematicalSamples.js';

assert.deepEqual(MATHEMATICAL_FORM_NAMES, ['rose', 'lemniscate', 'phyllotaxis']);
const count = 4096;
const seed = 0x51e11a7;
const forms = MATHEMATICAL_FORM_NAMES.map(form => makeMathematicalSamples(form, count, seed));
for (const [index, points] of forms.entries()) {
  assert.ok(points instanceof Float32Array, `${MATHEMATICAL_FORM_NAMES[index]} is a GPU-ready Float32Array`);
  assert.equal(points.length, count * 3);
  assert.ok([...points].every(Number.isFinite), `${MATHEMATICAL_FORM_NAMES[index]} has only finite coordinates`);
  assert.deepEqual(points, makeMathematicalSamples(MATHEMATICAL_FORM_NAMES[index], count, seed), 'sampling is deterministic for a fixed integer seed');
  const xs = points.filter((_, axis) => axis % 3 === 0);
  const ys = points.filter((_, axis) => axis % 3 === 1);
  assert.ok(Math.max(...xs) > 3.2 && Math.min(...xs) < -3.2, `${MATHEMATICAL_FORM_NAMES[index]} spans both sides of the viewport`);
  assert.ok(Math.max(...ys) > 1.5 && Math.min(...ys) < -1.5, `${MATHEMATICAL_FORM_NAMES[index]} has a meaningful vertical silhouette`);
}
for (let left = 0; left < forms.length; left++) {
  for (let right = left + 1; right < forms.length; right++) {
    assert.notDeepEqual(forms[left], forms[right], 'each mathematical form must differ in geometry');
  }
}
assert.equal(makeMathematicalSamples('rose', 0, seed).length, 0, 'zero particles produce an empty buffer safely');
assert.throws(() => makeMathematicalSamples('unknown', 5, seed), RangeError, 'unknown forms are rejected rather than silently becoming phyllotaxis');
assert.throws(() => makeMathematicalSamples('rose', -1, seed), RangeError, 'negative particle counts are rejected');
assert.throws(() => makeMathematicalSamples('rose', 1.5, seed), RangeError, 'fractional particle counts are rejected');
assert.throws(() => makeMathematicalSamples('rose', 1, Number.NaN), TypeError, 'non-finite seeds are rejected');

console.log(`Mathematical form tests passed: ${forms.length} procedural forms × ${count} particles, finite/stable buffers, distinct silhouettes and invalid-input guards.`);
