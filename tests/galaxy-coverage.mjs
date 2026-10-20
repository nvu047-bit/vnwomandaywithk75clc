import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { GALAXY_PROFILES } from '../src/data/galaxyProfiles.js';
import { generateGalaxyPoints } from '../src/graphics/GalaxyGeometry.js';

const count = 7000;
const profileEntries = Object.entries(GALAXY_PROFILES);
const legacyTwinBaseline = Object.freeze({
  p95X: 6.939968467019582,
  p95Y: 7.015693422284247,
  axisRatio: 1.0109114264170693,
  r90: 7.7538407563697245,
  denseCells: 167,
  midlineDensity: 1.2782585890375033
});

function rotatePoint(x, y, z, rotation) {
  const [rx, ry, rz] = rotation;
  const cosX = Math.cos(rx);
  const sinX = Math.sin(rx);
  const cosY = Math.cos(ry);
  const sinY = Math.sin(ry);
  const cosZ = Math.cos(rz);
  const sinZ = Math.sin(rz);
  const y1 = cosX * y - sinX * z;
  const z1 = sinX * y + cosX * z;
  const x2 = cosY * x + sinY * z1;
  return [cosZ * x2 - sinZ * y1, sinZ * x2 + cosZ * y1];
}

function percentile(values, fraction) {
  const sorted = values.slice().sort((a, b) => a - b);
  return sorted[Math.floor(fraction * (sorted.length - 1))];
}

function inspect(key, profile) {
  const generated = generateGalaxyPoints(count, profile, `regression:${key}`);
  const repeated = generateGalaxyPoints(count, profile, `regression:${key}`);
  for (const attribute of ['positions', 'groups', 'seeds', 'progress', 'arms']) {
    assert.deepEqual(generated[attribute], repeated[attribute], `${key}: seeded ${attribute} are deterministic`);
  }
  assert.deepEqual(generated.personalization, repeated.personalization, `${key}: seeded profile settings are deterministic`);
  for (const attribute of [
    generated.positions, generated.groups, generated.seeds, generated.progress, generated.arms
  ]) {
    assert.ok(attribute.every(Number.isFinite), `${key}: generated attributes are finite`);
  }
  assert.equal(profile.shape, 'spiral', `${key}: uses the shared spiral geometry`);
  assert.ok(profile.armCount >= 2 && profile.armCount <= 5, `${key}: arm count stays in range`);

  const points = new Array(count);
  const absX = new Array(count);
  const absY = new Array(count);
  const radii = new Array(count);
  for (let i = 0; i < count; i++) {
    const point = rotatePoint(
      generated.positions[i * 3],
      generated.positions[i * 3 + 1],
      generated.positions[i * 3 + 2],
      generated.personalization.rotation
    );
    points[i] = point;
    absX[i] = Math.abs(point[0]);
    absY[i] = Math.abs(point[1]);
    radii[i] = Math.hypot(point[0], point[1]);
  }
  return {
    generated,
    points,
    p95X: percentile(absX, 0.95),
    p95Y: percentile(absY, 0.95),
    r90: percentile(radii, 0.9)
  };
}

const measured = new Map(profileEntries.map(([key, profile]) => [key, inspect(key, profile)]));
const baseline = measured.get('twinSpiral');
const baselineGrid = new Uint16Array(24 * 15);

function addToGrid(grid, point) {
  const [x, y] = point;
  const column = Math.min(23, Math.max(0, Math.floor((x + baseline.p95X) / (2 * baseline.p95X) * 24)));
  const row = Math.min(14, Math.max(0, Math.floor((y + baseline.p95Y) / (2 * baseline.p95Y) * 15)));
  grid[row * 24 + column]++;
}

for (const point of baseline.points) {
  if (Math.abs(point[0]) <= baseline.p95X && Math.abs(point[1]) <= baseline.p95Y) {
    addToGrid(baselineGrid, point);
  }
}
const baselineOccupied = baselineGrid.filter(value => value >= 3).length;
assert.ok(baselineOccupied > 0, 'twinSpiral baseline occupies measurable grid cells');

const signatures = new Set();
const rows = [];
for (const [key, profile] of profileEntries) {
  const result = measured.get(key);
  const grid = new Uint16Array(24 * 15);
  let inFootprint = 0;
  let inMidline = 0;
  for (const point of result.points) {
    if (Math.abs(point[0]) > baseline.p95X || Math.abs(point[1]) > baseline.p95Y) continue;
    inFootprint++;
    if (Math.abs(point[1]) < 0.15 * result.p95Y) inMidline++;
    addToGrid(grid, point);
  }
  const occupied = grid.filter(value => value >= 3).length;
  const axisRatio = result.p95Y / result.p95X;
  const coverage = {
    x: result.p95X / baseline.p95X,
    y: result.p95Y / baseline.p95Y,
    cells: occupied / baselineOccupied,
    r90: result.r90 / baseline.r90,
    midlineDensity: inFootprint ? (inMidline / inFootprint) / 0.3 : Infinity
  };
  assert.ok(coverage.x >= 0.9, `${key}: x p95 covers at least 90% of twinSpiral`);
  assert.ok(coverage.y >= 0.9, `${key}: y p95 covers at least 90% of twinSpiral`);
  assert.ok(coverage.cells >= 0.85, `${key}: dense 24x15 cells reach 85% of twinSpiral`);
  assert.ok(coverage.r90 >= 0.85, `${key}: r90 reaches 85% of twinSpiral`);
  assert.ok(axisRatio >= 0.55 && axisRatio <= 0.9, `${key}: projected disk remains elliptical`);
  assert.ok(coverage.midlineDensity <= 3, `${key}: central strip is not an over-dense bar`);
  signatures.add([
    profile.armCount,
    result.p95X.toFixed(3),
    result.p95Y.toFixed(3),
    result.r90.toFixed(3)
  ].join(':'));
  rows.push({
    profile: key,
    p95X: result.p95X.toFixed(3),
    p95Y: result.p95Y.toFixed(3),
    axisRatio: axisRatio.toFixed(3),
    cells: `${occupied}/${baselineOccupied}`,
    r90: coverage.r90.toFixed(3),
    midlineDensity: coverage.midlineDensity.toFixed(3)
  });
}

assert.equal(signatures.size, profileEntries.length, 'each spiral profile has a unique measured signature');

const twinHash = createHash('sha256');
for (const array of [
  baseline.generated.positions,
  baseline.generated.groups,
  baseline.generated.seeds,
  baseline.generated.progress,
  baseline.generated.arms
]) {
  twinHash.update(Buffer.from(array.buffer, array.byteOffset, array.byteLength));
}
assert.equal(
  twinHash.digest('hex'),
  '2e9b311e52159d37495a188facd1c754de012baa2c38669b79717d78d456a5e1',
  'twinSpiral buffers remain byte-identical to the pristine baseline'
);

console.table(rows);
console.log(`Untouched twinSpiral baseline (7,000 particles): ${JSON.stringify(legacyTwinBaseline)}.`);
console.log(`Galaxy coverage passed: ${profileEntries.length} spiral profiles; twin baseline p95 ${baseline.p95X.toFixed(3)} × ${baseline.p95Y.toFixed(3)}.`);
