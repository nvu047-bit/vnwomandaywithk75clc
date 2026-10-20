import assert from 'node:assert/strict';
import { GALAXY_PROFILES } from '../src/data/galaxyProfiles.js';
import { generateGalaxyPoints } from '../src/graphics/GalaxyGeometry.js';

const morphologies = new Set();
const armStyles = new Set();
const signatures = new Map();
const geometrySignatures = new Map();
const shapeSignatures = new Map();
const seededArmCounts = new Set();
const seededOrientations = new Set();
const seededSpinDirections = new Set();
const count = 7000;
for (const [key, profile] of Object.entries(GALAXY_PROFILES)) {
  morphologies.add(profile.morphology);
  armStyles.add(profile.armStyle);
  const generated = generateGalaxyPoints(count, profile, `regression:${key}`);
  assert.ok(generated.personalization.arms >= 2 && generated.personalization.arms <= 5,
    `${key}: seeded spiral arm count stays between two and five`);
  seededArmCounts.add(generated.personalization.arms);
  seededOrientations.add(generated.personalization.rotation.map(value => value.toFixed(3)).join(':'));
  seededSpinDirections.add(generated.personalization.spinDirection);
  assert.equal(generated.positions.length, count * 3, `${key}: every particle has xyz coordinates`);
  assert.equal(generated.groups.length, count, `${key}: each particle has a structural group`);
  const counts = new Array(8).fill(0);
  for (const group of generated.groups) counts[group]++;
  assert.equal(counts.reduce((sum, value) => sum + value, 0), count, `${key}: group weights cover the full buffer`);
  assert.ok(counts[1] / count >= 0.56, `${key}: the main logarithmic arms dominate the galaxy`);
  assert.ok(counts[7] / count >= 0.05, `${key}: curled secondary branches remain visible`);
  const extent = [0, 0, 0];
  const secondMoment = [0, 0, 0];
  const armCenters = [];
  for (let i = 0; i < generated.positions.length; i += 3) {
    const x = generated.positions[i];
    const y = generated.positions[i + 1];
    const z = generated.positions[i + 2];
    extent[0] = Math.max(extent[0], Math.abs(x));
    extent[1] = Math.max(extent[1], Math.abs(y));
    extent[2] = Math.max(extent[2], Math.abs(z));
    secondMoment[0] += x * x;
    secondMoment[1] += y * y;
    secondMoment[2] += z * z;
    if (generated.groups[i / 3] === 1 && armCenters.length < 800) armCenters.push([x, y]);
  }
  assert.ok(extent[0] > 4.0 && extent[1] > 2.0, `${key}: galaxy keeps a full-scale silhouette`);
  signatures.set(key, counts.map(value => Math.round(value / count * 100)).join(':'));
  // A coarse 3-axis spread signature catches regressions where every profile
  // falls back to one near-identical spiral, while avoiding unstable pointwise checks.
  geometrySignatures.set(key, secondMoment.map(value => (Math.sqrt(value / count)).toFixed(1)).join(':'));
  const radialMoments = [0, 0, 0, 0];
  for (const [x, y] of armCenters) {
    const radius = Math.hypot(x, y);
    const angle = Math.atan2(y, x);
    radialMoments[0] += radius;
    radialMoments[1] += radius * radius;
    radialMoments[2] += Math.sin(angle * 3) * radius;
    radialMoments[3] += Math.cos(angle * 5) * radius;
  }
  shapeSignatures.set(key, radialMoments.map(value => (value / armCenters.length).toFixed(2)).join(':'));
}
{
  const profile = GALAXY_PROFILES.twinSpiral;
  const generated = generateGalaxyPoints(7000, profile, 'regression:twinSpiral');
  const { arms, pitch } = generated.personalization;
  const goldenRate = Math.log((1 + Math.sqrt(5)) / 2) / (Math.PI / 2);
  const turnCount = 0.62 + pitch * 0.5;
  let totalDeviation = 0;
  let armDepthSquared = 0;
  let innerScatterTotal = 0;
  let outerScatterTotal = 0;
  let innerScatterCount = 0;
  let outerScatterCount = 0;
  let armSamples = 0;
  for (let i = 0; i < generated.groups.length; i += 1) {
    if (generated.groups[i] !== 1) continue;
    const progress = generated.progress[i];
    const arm = generated.arms[i];
    const phase = profile.phase + arm * Math.PI * 2 / arms;
    const angle = phase + progress * Math.PI * 2 * (turnCount + 0.02)
      + Math.sin(progress * Math.PI * 2 * 1.4 + phase * 0.7) * 0.018;
    const radius = 0.9 * 1.08 * Math.exp(
      goldenRate * (1.1 + pitch * 0.72) * progress * Math.PI * 2 * (turnCount + 0.02)
    );
    const expectedX = Math.cos(angle) * radius + profile.asymmetry * progress * 0.28;
    const expectedY = Math.sin(angle) * radius * 0.64 * 1.12
      + Math.sin(progress * Math.PI * 2 + phase) * 0.018 * progress;
    const deviation = Math.hypot(
      generated.positions[i * 3] - expectedX,
      generated.positions[i * 3 + 1] - expectedY
    );
    totalDeviation += deviation;
    if (progress < 0.3) {
      innerScatterTotal += deviation;
      innerScatterCount += 1;
    } else if (progress > 0.75) {
      outerScatterTotal += deviation;
      outerScatterCount += 1;
    }
    armDepthSquared += generated.positions[i * 3 + 2] ** 2;
    armSamples += 1;
  }
  assert.ok(armSamples > 2500, 'the reference spiral has a substantial sample of main-arm particles');
  assert.ok(totalDeviation / armSamples < 0.5, 'main-arm particles preserve a readable logarithmic spiral beneath the controlled scatter');
  assert.ok(
    outerScatterTotal / outerScatterCount > innerScatterTotal / innerScatterCount * 1.3,
    'spiral-arm scatter grows with distance from the core'
  );
  assert.ok(Math.sqrt(armDepthSquared / armSamples) > 0.25, 'main spiral arms retain a substantial volumetric depth spread');
}
{
  const profile = GALAXY_PROFILES.twinSpiral;
  const first = generateGalaxyPoints(2048, profile, 'personalized:first', 'student-1001');
  const repeated = generateGalaxyPoints(2048, profile, 'personalized:first', 'student-1001');
  const other = generateGalaxyPoints(2048, profile, 'personalized:second', 'student-1002');
  assert.deepEqual(first.personalization, repeated.personalization, 'a student seed reproduces its spiral, orientation and spin');
  assert.deepEqual(first.positions, repeated.positions, 'a stable identity reproduces its complete particle geometry');
  assert.ok(first.personalization.arms >= 2 && first.personalization.arms <= 5, 'seeded arm count stays in the 2–5 range');
  assert.ok(first.personalization.pitch >= 0.12 && first.personalization.pitch <= 0.72, 'seeded pitch remains within the designed range');
  assert.ok(first.personalization.spinDirection === -1 || first.personalization.spinDirection === 1, 'seed chooses a valid spin direction');
  assert.notDeepEqual(first.personalization, other.personalization, 'different student seeds produce distinct galaxy settings');
}
assert.equal(morphologies.size, 9, 'nine distinct morphology families remain represented');
assert.equal(armStyles.size, 9, 'each recipient has a distinct, recognizable spiral-galaxy structure');
assert.ok(seededArmCounts.size >= 3, 'recipient seeds produce multiple spiral arm counts');
assert.equal(seededOrientations.size, Object.keys(GALAXY_PROFILES).length, 'each recipient seed produces a unique viewing angle');
assert.equal(seededSpinDirections.size, 2, 'recipient seeds exercise both directions of rotation');
assert.ok(new Set(signatures.values()).size >= 7, 'per-morphology structure budgets produce distinct compositions');
assert.ok(new Set(geometrySignatures.values()).size >= 8, 'morphology-specific paths retain different 3-axis spread signatures');
assert.ok(new Set(shapeSignatures.values()).size >= 8, 'each morphology has a visibly distinct arm silhouette');
console.log(`Galaxy regression test passed: ${Object.keys(GALAXY_PROFILES).length} logarithmic spiral profiles, distinct group budgets and 3-axis geometry signatures.`);
