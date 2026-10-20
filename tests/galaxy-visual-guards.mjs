import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { GALAXY_PROFILES } from '../src/data/galaxyProfiles.js';
import { generateGalaxyPoints } from '../src/graphics/GalaxyGeometry.js';

const shader = await readFile(new URL('../src/graphics/shaders.js', import.meta.url), 'utf8');
const architecture = await readFile(new URL('../src/graphics/GalaxyArchitecture.js', import.meta.url), 'utf8');
const cluster = await readFile(new URL('../src/graphics/shared/GalaxyCluster.js', import.meta.url), 'utf8');

for (const [key, profile] of Object.entries(GALAXY_PROFILES)) {
  const generated = generateGalaxyPoints(2048, profile, `visual-guard:${key}`);
  assert.ok(generated.personalization.arms >= 3 && generated.personalization.arms <= 5,
    `${key}: personalized spiral arm count stays in the requested range`);
  assert.ok(generated.positions.every(Number.isFinite), `${key}: generated positions remain finite`);
  assert.ok(generated.personalization.spiralAngleStep > 0 && generated.personalization.spiralGrowth > 0,
    `${key}: spiral advection parameters are positive`);
}

assert.match(shader, /fract\(aProgress \+ uTime \* uSpiralFlow \* uSpinDirection\)/,
  'spiral particles advance along their arm instead of winding indefinitely');
assert.match(shader, /transportEnvelope = smoothstep\(0\.0, 0\.12, movingProgress\)[\s\S]*smoothstep\(0\.88, 1\.0, movingProgress\)/,
  'spiral density uses a soft, repeating particle envelope');
assert.match(shader, /uTitleBounds[\s\S]*uWishBounds[\s\S]*length\(titleDelta\)[\s\S]*length\(wishDelta\)/,
  'name and wish protection are separate soft screen-space ellipses');
assert.match(shader, /mix\(1\.0, 0\.04, titleZone \* uTitleDim\)/,
  'the existing title-dimming contract is retained');
assert.match(shader, /uFlare\.z \* exp\(/, 'the existing flare contract is retained');
assert.match(shader, /restrainedEmission \* emissionGain/,
  'only selected core, hero and knot particles can exceed the bloom threshold');
assert.match(architecture, /uSpiralFlow: \{ value: 0 \}[\s\S]*uSpiralAngleStep: \{ value: 0 \}[\s\S]*uSpiralGrowth: \{ value: 0 \}/,
  'new advection uniforms default to safe neutral values');
assert.match(cluster, /uSpiralFlow: \{ value: 0 \}[\s\S]*uSpiralAngleStep: \{ value: 0 \}[\s\S]*uSpiralGrowth: \{ value: 0 \}/,
  'shared galaxies declare neutral advection uniforms');
assert.match(cluster, /uTitleBounds: \{ value: new THREE\.Vector4\(\) \}[\s\S]*uWishBounds: \{ value: new THREE\.Vector4\(\) \}/,
  'shared galaxies declare neutral screen-space title bounds');

console.log('Galaxy visual guards passed: 3–5 arms, finite geometry, envelope transport, screen ellipses and safe shared defaults.');
