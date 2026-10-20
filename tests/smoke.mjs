import assert from 'node:assert/strict';
import * as THREE from 'three';
import { readFile, access, readdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { recipients, findRecipient } from '../src/data/recipients.js';
import { getRecipientArtDirection, recipientArtDirections } from '../src/data/artDirections.js';
import { COSMIC_COLORS, RECIPIENT_PALETTES } from '../src/data/cosmicPalette.js';
import { GALAXY_PROFILES, RECIPIENT_GALAXY_PROFILES } from '../src/data/galaxyProfiles.js';
import { GALAXY_PARTICLE_COUNTS, generateGalaxyPoints } from '../src/graphics/GalaxyArchitecture.js';
import { CosmicEventLayer } from '../src/graphics/CosmicEventLayer.js';
import { COSMIC_EVENT_ORDER, CosmicEventDirector } from '../src/graphics/CosmicEventDirector.js';
import { CometField } from '../src/graphics/CometField.js';
import { makeMathematicalSamples } from '../src/graphics/MathematicalSamples.js';
import { createStarField } from '../src/graphics/SpaceField.js';

assert.equal(recipients.length, 9, 'exactly nine recipients are required');
assert.equal(RECIPIENT_PALETTES.length, 9, 'each recipient needs a personal color palette');
assert.equal(new Set(RECIPIENT_PALETTES.map(palette => palette.join('|'))).size, 9, 'recipient palettes should remain distinct');
assert.equal(COSMIC_COLORS.space, '#11121e', 'the cosmic palette should define the shared deep-space background');
const expected = [
  ['755101034', 'TRẦN THỊ KIỀU CHÂM', 'tran-thi-kieu-cham'],
  ['755101050', 'NGUYỄN THÙY DUNG', 'nguyen-thuy-dung'],
  ['755101145', 'TRẦN THỊ NGỌC LAN', 'tran-thi-ngoc-lan'],
  ['755101154', 'NGUYỄN THỊ KHÁNH LINH', 'nguyen-thi-khanh-linh'],
  ['755101222', 'NGUYỄN THỊ PHƯƠNG', 'nguyen-thi-phuong'],
  ['755101245', 'NGUYỄN THỊ THANH TÂM', 'nguyen-thi-thanh-tam'],
  ['755101253', 'NGUYỄN PHƯƠNG THẢO', 'nguyen-phuong-thao'],
  ['755101276', 'HOÀNG THÙY TRANG', 'hoang-thuy-trang'],
  ['755101277', 'LÊ HUYỀN TRANG', 'le-huyen-trang']
];
for (const [id, name, slug] of expected) {
  const byId = findRecipient(id);
  const bySlug = findRecipient(slug);
  assert.ok(byId, `missing id ${id}`);
  assert.ok(bySlug, `missing slug ${slug}`);
  assert.equal(byId.name, name, `wrong name for ${id}`);
  assert.ok(byId.display.normalize('NFD').length > byId.display.length, `particle display name should retain Vietnamese diacritics for ${id}`);
  assert.equal(byId.slug, slug, `wrong slug for ${id}`);
  assert.equal(bySlug.id, id, `slug ${slug} resolves to wrong id`);
  assert.ok(byId.wish.length > 110, `wish too short for ${id}`);
  const direction = getRecipientArtDirection(byId);
  assert.ok(direction.concept.length > 0, `missing visual concept for ${id}`);
  assert.ok(direction.galaxy in GALAXY_PROFILES, `missing structural galaxy profile for ${id}`);
  assert.equal(RECIPIENT_GALAXY_PROFILES[id], direction.galaxy, `wrong galaxy identity for ${id}`);
  assert.ok(direction.aspect.every(value => value > 0), `invalid nebula aspect for ${id}`);
  assert.ok(direction.core.length === 2 && direction.core.every(Number.isFinite), `invalid core placement for ${id}`);
  assert.ok(Number.isFinite(direction.flow), `missing flow direction for ${id}`);
  assert.ok(direction.reveal.textDelay >= 0, `missing reveal timing for ${id}`);
  assert.ok(Number.isFinite(direction.reveal.panelOffset), `missing editorial panel placement for ${id}`);
}
assert.equal(Object.keys(recipientArtDirections).length, 9, 'every recipient needs a personal art direction');
assert.equal(new Set(Object.values(recipientArtDirections).map(direction => direction.style)).size, 9, 'each recipient must have a distinct nebula motif');
assert.equal(new Set(Object.values(RECIPIENT_GALAXY_PROFILES)).size, 9, 'each recipient must have an independent galaxy morphology');
assert.equal(Object.keys(GALAXY_PROFILES).length, 9, 'all nine named galaxy profiles must exist');
assert.equal(new Set(Object.values(GALAXY_PROFILES).map(profile => profile.morphology)).size, 9, 'galaxies must not share a structural model');
assert.equal(new Set(Object.values(GALAXY_PROFILES).map(profile => profile.curve)).size, 9, 'each galaxy must have its own mathematical signature');
assert.equal(findRecipient('bad-id'), null);
assert.equal(findRecipient('%'), null, 'malformed URL encoding must not crash lookup');
assert.equal(findRecipient('TRAN-THI-KIEU-CHAM')?.id, '755101034', 'slug lookup should be case-insensitive');
assert.equal(new Set(recipients.map(person => person.wish)).size, 9, 'each student must receive an original wish');

const generatedProfiles = [];
for (const person of recipients) {
  const profile = GALAXY_PROFILES[RECIPIENT_GALAXY_PROFILES[person.id]];
  const first = generateGalaxyPoints(512, profile, person.id);
  const repeat = generateGalaxyPoints(512, profile, person.id);
  assert.deepEqual(first.positions, repeat.positions, `galaxy geometry should be stable for ${person.id}`);
  assert.ok([...first.positions].every(Number.isFinite), `galaxy positions should be finite for ${person.id}`);
  assert.ok(Math.max(...first.positions.filter((_, index) => index % 3 === 0)) > 2, `galaxy should have broad structure for ${person.id}`);
  generatedProfiles.push(first.positions);
}
assert.ok(generatedProfiles.every((positions, index) => index === 0 || !positions.every((value, i) => value === generatedProfiles[0][i])),
  'profiles must differ structurally, not merely by color');
assert.deepEqual(GALAXY_PARTICLE_COUNTS, { desktop: 26000, mobile: 13000 },
  'the moving galaxy must use the higher-resolution desktop and mobile particle budgets');
const denseGalaxy = generateGalaxyPoints(GALAXY_PARTICLE_COUNTS.desktop,
  GALAXY_PROFILES[RECIPIENT_GALAXY_PROFILES[recipients[0].id]], recipients[0].id);
const denseGroupCounts = Array.from({ length: 8 }, (_, group) =>
  denseGalaxy.groups.reduce((count, value) => count + Number(value === group), 0));
assert.equal(denseGalaxy.positions.length / 3, GALAXY_PARTICLE_COUNTS.desktop,
  'every desktop galaxy particle must have a rendered position');
assert.ok(Math.abs(denseGroupCounts[1] / GALAXY_PARTICLE_COUNTS.desktop - 0.75) < 0.001,
  'main logarithmic arms must dominate the galaxy structure');
assert.ok(Math.abs((denseGroupCounts[2] + denseGroupCounts[3]) / GALAXY_PARTICLE_COUNTS.desktop - 0.08) < 0.001,
  'galaxy clouds and clusters must reinforce the arm structure without obscuring it');
assert.ok(Math.abs(denseGroupCounts[5] / GALAXY_PARTICLE_COUNTS.desktop - 0.02) < 0.001,
  'fine dust lanes must add texture without competing with the spiral arms');
assert.ok(Math.abs(denseGroupCounts[7] / GALAXY_PARTICLE_COUNTS.desktop - 0.08) < 0.001,
  'curled secondary branches must receive a stable GPU particle budget');

let fakeNow = 0;
let nextTimerId = 0;
const pendingTimers = new Map();
const fakeTimers = {
  setTimeout(callback, delay) {
    const id = ++nextTimerId;
    pendingTimers.set(id, { callback, due: fakeNow + delay });
    return id;
  },
  clearTimeout(id) { pendingTimers.delete(id); },
  advance(ms) {
    const target = fakeNow + ms;
    while (true) {
      const dueEntry = [...pendingTimers.entries()].sort((a, b) => a[1].due - b[1].due)[0];
      if (!dueEntry || dueEntry[1].due > target) break;
      fakeNow = dueEntry[1].due;
      pendingTimers.delete(dueEntry[0]);
      dueEntry[1].callback();
    }
    fakeNow = target;
  }
};
const visibilityListeners = new Set();
const fakeDocument = {
  hidden: false,
  addEventListener(_type, listener) { visibilityListeners.add(listener); },
  removeEventListener(_type, listener) { visibilityListeners.delete(listener); },
  changeVisibility(hidden) {
    this.hidden = hidden;
    for (const listener of visibilityListeners) listener();
  }
};
const scheduledEvents = [];
const director = new CosmicEventDirector((event, detail) => scheduledEvents.push([event, detail]), {
  interval: 10000, documentRef: fakeDocument, timers: fakeTimers, now: () => fakeNow
});
director.start();
director.start();
assert.equal(visibilityListeners.size, 1, 'restarting the director must not duplicate visibility listeners');
fakeTimers.advance(9999);
assert.equal(scheduledEvents.length, 0, 'the first cosmic event must wait a full ten seconds');
fakeTimers.advance(1);
assert.deepEqual(scheduledEvents[0], ['stellarSupernova', { sequence: 0, cycle: 0, eventIndex: 0 }],
  'the opening scheduled event must be a Stellar Supernova');
fakeDocument.changeVisibility(true);
fakeTimers.advance(25000);
assert.equal(scheduledEvents.length, 1, 'hidden time must pause the cosmic event schedule');
fakeDocument.changeVisibility(false);
fakeTimers.advance(9999);
assert.equal(scheduledEvents.length, 1, 'the paused ten-second interval must resume without catch-up');
fakeTimers.advance(1);
assert.equal(scheduledEvents[1][0], 'meteorStorm', 'the next scheduled event must differ from the supernova');
assert.equal(COSMIC_EVENT_ORDER.length, 8, 'the event registry should provide a full varied sequence');
assert.deepEqual(COSMIC_EVENT_ORDER.slice(0, 4), [
  'stellarSupernova', 'meteorStorm', 'mathematicalBloom', 'centrifugalRift'
], 'the first event cycle must lead with the supernova and vary its follow-up acts');
director.stop();
assert.equal(visibilityListeners.size, 0, 'stopping the director must remove its visibility listener');
assert.equal(pendingTimers.size, 0, 'stopping the director must clear its pending timer');

const idleEvents = [];
const idleDirector = new CosmicEventDirector((event, detail) => idleEvents.push([event, detail]), {
  interval: 30000, initialDelay: 18000, events: ['stellarSupernova'],
  documentRef: fakeDocument, timers: fakeTimers, now: () => fakeNow
});
idleDirector.start();
fakeTimers.advance(17999);
assert.equal(idleEvents.length, 0, 'the idle-screen supernova must not fire immediately on page load');
fakeTimers.advance(1);
assert.equal(idleEvents[0][0], 'stellarSupernova', 'idle mode should stage its ambient stellar explosion first');
fakeTimers.advance(29999);
assert.equal(idleEvents.length, 1, 'ambient supernovae should leave a calm interval between events');
fakeTimers.advance(1);
assert.equal(idleEvents.length, 2, 'ambient stellar events should recur while the portal remains open');
idleDirector.stop();
assert.equal(visibilityListeners.size, 0, 'the idle director must release its visibility listener on stop');

const eventScene = new THREE.Scene();
const eventLayer = new CosmicEventLayer(eventScene, { mobile: true, pixelRatio: 1 });
assert.equal(eventLayer.count, 420, 'event particle budget should remain bounded on mobile');
eventLayer.setViewport(390, 844, 12.6, 43);
assert.ok(eventLayer.uniforms.uViewport.value.x < eventLayer.uniforms.uViewport.value.y,
  'event trails must fit a portrait viewport instead of retaining desktop-wide paths');
for (const person of recipients) {
  const profile = GALAXY_PROFILES[RECIPIENT_GALAXY_PROFILES[person.id]];
  eventLayer.setEvent(7, profile, person.palette, { x: 0.2, y: -0.4, z: -1 }, 0);
  assert.ok([...eventLayer.lines.geometry.getAttribute('position').array].every(Number.isFinite),
    `constellation links must remain finite for ${person.id}`);
}
eventLayer.uniforms.uMode.value = 7;
eventLayer.uniforms.uProgress.value = 0.6;
eventLayer.uniforms.uIntensity.value = 0.8;
eventLayer.setTime(1);
assert.ok(eventLayer.lines.geometry.drawRange.count > 0, 'constellation edges must reveal progressively');
eventLayer.uniforms.uMode.value = 1;
eventLayer.setTime(2);
assert.equal(eventLayer.lines.geometry.drawRange.count, 24, 'meteor event must reuse preallocated directional trails');
eventLayer.uniforms.uMode.value = 0;
eventLayer.setTime(3);
assert.equal(eventLayer.lines.geometry.drawRange.count, 344, 'supernova must combine three expanding shock rings and radial matter rays');
eventLayer.dispose();
assert.equal(eventScene.children.length, 0, 'event layer disposal must release both reusable GPU objects');

const starsScene = new THREE.Scene();
const stars = createStarField(starsScene, 1, false);
const repeatedStars = createStarField(new THREE.Scene(), 1, false);
const starLayers = stars.layers;
const starValues = starLayers.flatMap(layer => [...layer.geometry.getAttribute('aSize').array]);
const starCount = starValues.length;
const starBins = [
  starValues.filter(radius => radius >= 0.7 && radius <= 1.3).length,
  starValues.filter(radius => radius >= 1.4 && radius <= 2.4).length,
  starValues.filter(radius => radius >= 2.5 && radius <= 4).length,
  starValues.filter(radius => radius >= 4.01 && radius <= 6).length
].map(count => count / starCount);
assert.equal(starCount, 6400, 'desktop background star count stays subordinate to the primary galaxy');
assert.ok(starBins[0] >= 0.55 && starBins[0] <= 0.65, '55–65% of stars should use the small CSS-radius tier');
assert.ok(starBins[1] >= 0.25 && starBins[1] <= 0.30, '25–30% of stars should use the medium CSS-radius tier');
assert.ok(starBins[2] >= 0.08 && starBins[2] <= 0.12, '8–12% of stars should use the large CSS-radius tier');
assert.ok(starBins[3] >= 0.01 && starBins[3] <= 0.03, '1–3% of stars should use the hero CSS-radius tier');
const medianRadius = starValues.slice().sort((a, b) => a - b)[Math.floor(starCount / 2)];
assert.ok(medianRadius >= 0.7 && medianRadius / 0.325 >= 1.4, 'median displayed star radius should exceed the measured baseline by at least 1.4x');
const glowValues = starLayers.flatMap(layer => [...layer.geometry.getAttribute('aGlowClass').array]);
const heroGlowValues = starLayers.flatMap(layer => {
  const sizes = layer.geometry.getAttribute('aSize').array;
  const glow = layer.geometry.getAttribute('aGlowClass').array;
  return Array.from(sizes, (radius, index) => radius >= 4.01 && glow[index] >= 0.30);
});
const lightGlowRatio = glowValues.filter(value => value >= 0.80).length / starCount;
const strongGlowRatio = starLayers.flatMap(layer => {
  const sizes = layer.geometry.getAttribute('aSize').array;
  const glow = layer.geometry.getAttribute('aGlowClass').array;
  return Array.from(sizes, (radius, index) => glow[index] >= 0.97 || radius >= 4.01);
}).filter(Boolean).length / starCount;
const rayRatio = heroGlowValues.filter(Boolean).length / starCount;
assert.ok(lightGlowRatio >= 0.10 && lightGlowRatio <= 0.22, 'roughly 10–20% of stars should carry a light halo');
assert.ok(strongGlowRatio >= 0.03 && strongGlowRatio <= 0.06, '3–6% of stars should carry a strong halo');
assert.ok(rayRatio >= 0.005 && rayRatio <= 0.015, '0.5–1.5% of stars should carry subtle rays');
const clearTwinkleRatio = starLayers.flatMap(layer =>
  [...layer.geometry.getAttribute('aSeed').array].map(seed => (seed * 37.17) % 1)
).filter(value => value >= 0.88).length / starCount;
assert.ok(clearTwinkleRatio >= 0.05 && clearTwinkleRatio <= 0.15, 'only 5–15% of stars should have pronounced asynchronous twinkle');
for (let index = 0; index < starLayers.length; index++) {
  assert.deepEqual(
    starLayers[index].geometry.getAttribute('position').array,
    repeatedStars.layers[index].geometry.getAttribute('position').array,
    'default star placement should be deterministic across visits'
  );
  assert.deepEqual(
    starLayers[index].geometry.getAttribute('aSize').array,
    repeatedStars.layers[index].geometry.getAttribute('aSize').array,
    'default star size classes should be deterministic across visits'
  );
}
assert.deepEqual(starLayers.map(layer => layer.geometry.getAttribute('position').count), [4400, 1600, 400]);
const mobileStars = createStarField(new THREE.Scene(), 1, true);
assert.deepEqual(mobileStars.layers.map(layer => layer.geometry.getAttribute('position').count), [1450, 550, 160]);
for (const field of [stars, repeatedStars, mobileStars]) {
  for (const layer of field.layers) {
    layer.geometry.dispose();
    layer.material.dispose();
  }
}

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const css = await readFile(new URL('../src/style.css', import.meta.url), 'utf8');
const shader = await readFile(new URL('../src/graphics/shaders.js', import.meta.url), 'utf8');
const scene = await readFile(new URL('../src/graphics/StellarScene.js', import.meta.url), 'utf8');
const galaxy = await readFile(new URL('../src/graphics/GalaxyArchitecture.js', import.meta.url), 'utf8');
const space = await readFile(new URL('../src/graphics/SpaceField.js', import.meta.url), 'utf8');
const nebulaFlow = await readFile(new URL('../src/graphics/NebulaFlow.js', import.meta.url), 'utf8');
const particles = await readFile(new URL('../src/graphics/ParticleCloud.js', import.meta.url), 'utf8');
const mathSamples = await readFile(new URL('../src/graphics/MathematicalSamples.js', import.meta.url), 'utf8');
const curves = await readFile(new URL('../src/graphics/MathematicalCurves.js', import.meta.url), 'utf8');
const flow = await readFile(new URL('../src/graphics/NebulaFlow.js', import.meta.url), 'utf8');
const comets = await readFile(new URL('../src/graphics/CometField.js', import.meta.url), 'utf8');
const cosmicEvents = await readFile(new URL('../src/graphics/CosmicEventLayer.js', import.meta.url), 'utf8');
const bodies = await readFile(new URL('../src/graphics/CosmicBodies.js', import.meta.url), 'utf8');
const ui = await readFile(new URL('../src/ui/interface.js', import.meta.url), 'utf8');
const fallback = await readFile(new URL('../src/graphics/FallbackScene.js', import.meta.url), 'utf8');
const rain = await readFile(new URL('../src/graphics/MathRain.js', import.meta.url), 'utf8');
const main = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
const viteConfig = await readFile(new URL('../vite.config.js', import.meta.url), 'utf8');
assert.match(html, /id="universe"/);
assert.match(html, /id="equationRain"/);
assert.match(html, /id="studentCode"/);
assert.match(html, /id="identity"[\s\S]*id="recipientName" class="sr-only"[\s\S]*?<\/section>/, 'recipient identity must remain accessible in its own overlay');
assert.doesNotMatch(html, /recipientAffiliation|affiliation-unit/, 'the personalized wish screen must not render the HNUE signature under recipient names');
assert.doesNotMatch(html, /gatewayHeader|gatewayStardustCanvas|gateway-backdrop-shield|HNUE[\s\S]*SMCS[\s\S]*K75CLC/, 'the waiting screen must not use an oversized DOM banner; the signature remains a GPU particle morph');
assert.match(html, /<form id="portalForm"[\s\S]*id="studentCode"/, 'minimal gateway keeps the student-code form');
assert.doesNotMatch(css, /gateway-header|gateway-cluster|gateway-backdrop-shield|portal-rule/, 'removed signature and reserved layout styles leave no CSS residue');
assert.match(css, /\.portal\s*\{[^}]*background:\s*transparent[^}]*box-shadow:\s*none/s, 'the gateway no longer sits inside a card');
assert.match(html, /<button id="brandBackButton" class="corner corner--tl brand-back-button"[^>]*disabled/, 'the STELLAR / HNUE logo is the inactive Back control on the waiting screen');
assert.doesNotMatch(html, /returnPortal|return-portal/, 'no detached Back button remains inside the wish card');
assert.doesNotMatch(html.match(/<section id="reveal"[\s\S]*?<\/section>/)?.[0] ?? '', /id="recipientName"/, 'the wish panel must not own the identity title');
assert.match(html, /Cormorant\+Garamond/, 'the display serif must load for Vietnamese wish leads');
assert.match(html, /Nunito\+Sans:wght@400;600;700;900/, 'the rounded sans-serif particle font must load in a heavy weight');
assert.doesNotMatch(css, /\.portal[^{]*\{[^}]*backdrop-filter\s*:\s*blur/i, 'the entry surface must remain transparent rather than frosted glass');
assert.match(css, /--space:\s*#11121e/i, 'the scene must use the shared deep-space palette');
assert.match(css, /--nebula-magenta:\s*#a4869b/i, 'the nebula palette must use a muted mauve');
assert.match(css, /--soft-cyan:\s*#8290ad/i, 'the cool accent must use a muted periwinkle');
assert.match(css, /--starlight-gold:\s*#b9a485/i, 'the warm accent must use restrained champagne');
assert.match(css, /#interface\s*\{[^}]*z-index:\s*5[^}]*isolation:\s*isolate/s, 'the DOM identity layer must stack above every canvas context');
assert.match(html, /id="recipientName" class="sr-only"/, 'the accessible DOM name must remain visually hidden');
assert.doesNotMatch(html, /id="recipient(?:Number|Equation|Concept)"/, 'personal metadata must not appear in the greeting');
assert.match(css, /\.identity\s*\{[^}]*top:\s*clamp\(39%,\s*47vh,\s*52%\)/s, 'the accessible recipient identity overlay should retain responsive placement');
assert.match(css, /\.wish-lead[^}]*Cormorant Garamond/, 'the opening wish sentence must use the display serif');
assert.match(scene, /ACESFilmicToneMapping/, 'renderer must use ACES filmic tone mapping');
assert.match(scene, /new EffectComposer\(/, 'scene must use an EffectComposer post-processing pipeline');
assert.match(scene, /new RenderPass\(/, 'scene must render through a RenderPass');
assert.match(scene, /new UnrealBloomPass\(/, 'luminous stars must receive bloom');
assert.match(scene, /new OutputPass\(/, 'final output pass must handle output conversion');
assert.match(scene, /composer\.render\(dt\)/, 'the composer must own the main render loop');
assert.doesNotMatch(scene, /renderer\.render\(this\.scene, this\.camera\)/, 'main scene should not bypass the composer');
assert.match(scene, /pointerParallax/, 'parallax must be smoothed rather than applied directly');
assert.match(scene, /enableDeviceParallax/, 'touch-first devices should support permission-aware motion parallax');
assert.match(scene, /updateBloomSettings/, 'bloom strength should adapt to device quality');
assert.match(scene, /new GalaxyArchitecture/, 'the galaxy renderer must be integrated into the existing Three.js scene');
assert.match(scene, /this\.galaxy\.setProfile\(direction, recipient\.palette, recipient\.id/, 'recipient changes must morph the galaxy from a stable identity seed');
assert.match(galaxy, /generateGalaxyPoints/, 'galaxy structure should be generated from deterministic procedural profiles');
assert.match(galaxy, /uTransition/, 'profile transitions should morph GPU particle positions rather than swap instantly');
assert.match(galaxy, /uCentrifugal/, 'galaxy particles should participate in the centrifugal pulse');
assert.match(galaxy, /GalaxyGeometry\.js/, 'personal galaxies use the reviewed logarithmic spiral generator');
assert.match(galaxy, /aFrom/, 'the previous galaxy geometry should be retained during profile transitions');
assert.match(comets, /setArtDirection\(direction\)/, 'meteor paths and cadence must follow the active galaxy profile');
assert.match(scene, /AdditiveBlending|Additive/i, 'emissive layers must use additive blending');
assert.match(space, /layer: 0[\s\S]*layer: 1[\s\S]*layer: 2/, 'starfield must have 3 depth LOD layers');
assert.match(space, /return \{ layers \}/, 'three starfield layers must be exposed to scene');
assert.match(space, /const radius = spread \* Math\.sqrt\(rng\(\)\)[\s\S]*const angle = rng\(\) \* Math\.PI \* 2/,
  'background stars must use a diffuse radial distribution instead of competing with the foreground spiral');
assert.match(space, /sizeClass < 0\.60[\s\S]*sizeClass < 0\.87[\s\S]*sizeClass < 0\.98/,
  'background star sizes must provide small, medium, large and rare hero tiers');
assert.match(space, /uStarGlow: \{ value: 0\.82 \}/, 'ambient star halos stay restrained while star cores remain crisp');
assert.match(particles, /canvas\.width = 2800[\s\S]*canvas\.height = 820[\s\S]*Nunito Sans/, 'particle names must use a high-resolution Vietnamese-capable sans-serif mask');
assert.match(particles, /recipient \? 370 : 300/, 'nebula recipient names must use large title sizing');
assert.match(particles, /randomBetween\(recipient \? -0\.11 : -0\.34, recipient \? 0\.11 : 0\.34\)/,
  'nebula recipient glyphs retain a narrow depth range for legibility');
assert.match(shader, /float depthLight = smoothstep\(-0\.16, 0\.16, p\.z\)/,
  'nebula recipient title particles use restrained front-to-back depth shading');
assert.match(shader, /smoothstep\(2\.05, 2\.7, abs\(p\.y - 1\.12\)\)/,
  'galaxy particles are dimmed across the raised affiliation title and personal name area');
assert.match(shader, /float coreBloom = exp\(-radius \* 0\.28\)/, 'galaxy core emission reaches into the inner spiral arms');
assert.match(shader, /mix\(7\.0, 14\.0, heroStar\) \* uPixelRatio/, 'galaxy particles retain crisp, perspective-scaled hero stars');
assert.match(shader, /float spinRate = uSpinDirection \* uSpin \* \(0\.46 \+ 1\.5 \/ \(0\.35 \+ radius \* 0\.45\)\)/,
  'seeded rotation direction preserves faster core rotation than outer-arm rotation');
assert.match(shader, /clamp\(emission, vec3\(0\.0\), vec3\(0\.88\)\)/, 'galaxy shader clamps particle RGB to prevent overexposure');
assert.match(galaxy, /blending: THREE\.NormalBlending, toneMapped: false/, 'personal galaxies use bounded alpha compositing instead of additive overexposure');
assert.match(shader, /mix\(0\.84, 1\.0, vHero\)/, 'ambient star particles are dimmed without reducing rare hero-star brightness');
assert.match(particles, /out\[i \* 3\] = .*recipient \? 14\.8 : 16\.8/, 'recipient names must retain their full particle width while affiliation words grow');
assert.match(particles, /contourWeight = recipient \? 0\.42 : isShortMark \? 0\.42 : 0\.52/, 'affiliation and recipient glyphs use denser interior sampling for a bolder silhouette');
assert.match(particles, /uSizeScale/, 'particle sizes must adapt to the active viewport');
assert.match(particles, /aPreviousRecipient/, 'name transitions must preserve the previous glyph target');
assert.match(particles, /uRecipientTransition/, 'name transitions must morph between old and new glyphs');
assert.doesNotMatch(particles, /makeGlowGeometry|glowPoints|uGlowLayer/, 'particle names use one geometry without a secondary additive glow');
assert.match(particles, /blending: THREE\.NormalBlending, toneMapped: false/, 'morphic text avoids additive overexposure and bloom');
assert.match(shader, /vAlpha = clamp\(vAlpha \* \(1\.0 \+ heroStar \* 0\.24\), 0\.0, 0\.88\)/, 'morphic particle alpha remains bounded against white clipping');
assert.match(scene, /this\.composer\.addPass\(this\.bloomPass\);[\s\S]*this\.composer\.addPass\(this\.identityPass\);[\s\S]*this\.composer\.addPass\(this\.outputPass\);/,
  'morphic text is composited after bloom and before output color conversion');
assert.match(scene, /this\.mobile \? 0\.07 : 0\.11/, 'restrained bloom strength keeps spiral particles crisp');
assert.match(scene, /this\.mobile \? 0\.90 : 0\.89/, 'higher bloom threshold avoids broad blur and blown highlights');
assert.match(particles, /createSeededRandom/, 'recipient particle shapes must be stable between visits');
assert.match(particles, /setViewport\(width, height\)/, 'particle titles must fit narrow and landscape viewports');
assert.match(particles, /scaleX = Math\.min\(1, aspect \* 0\.66\)/, 'long particle names must retain horizontal margins on portrait screens');
assert.match(flow, /count = mobile \? 360 : 900/, 'living nebula flow must remain subordinate to the primary galaxy');
assert.match(flow, /setDirection\(direction\)/, 'living nebula flow must use each recipient art direction');
assert.match(flow, /setTitleBounds\(bounds, scale\)/, 'living nebula flow must preserve the particle-title area');
assert.match(particles, /this\.signatureBounds = \[[\s\S]*\+ 1\.6/, 'the idle affiliation morph reserves a clear area behind its raised wordmark');
assert.match(shader, /uniform vec3 uTitleSize[\s\S]*abs\(p\.y - uTitleSize\.z\)/, 'nebula-flow dimming follows the active title center');
assert.match(scene, /direction \? this\.particles\.titleBounds : this\.particles\.signatureBounds/,
  'both the idle signature and personal name receive title-area protection');
assert.match(flow, /clearInteraction\(\)/, 'living nebula flow must reset touch response between recipients');
assert.match(shader, /vAlpha = \(0\.045 \+ streamPulse \* 0\.065\)/, 'flow strands must remain subtle and avoid competing with the primary galaxy');
assert.match(scene, /new NebulaFlow\(this\.scene/, 'the flow layer must join the scene lifecycle');
assert.match(scene, /count: this\.mobile \? 6500 : 15000/, 'the name particle budget must scale down for mobile');
assert.match(scene, /this\.nebulaFlow\.setTime\(this\.elapsed\)/, 'nebula flow must advance on the scene clock');
assert.match(scene, /this\.nebulaFlow\.triggerCentrifugal\(x, y, time, strength\)/, 'the global pulse must reach the nebula flow');
assert.match(scene, /this\.galaxy\.triggerCentrifugal\(x, y, time, strength\)/, 'the global pulse must reach the structured galaxy');
assert.match(scene, /pulseNebulaVolume\(this\.nebula, x, y, time, strength\)/, 'the global pulse must reach volumetric nebula wisps');
assert.match(scene, /this\.comets\.triggerPulse\(x, y, time, strength\)/, 'the global pulse must reach the meteor field');
assert.match(scene, /this\.comets\.setViewport\(width, height/, 'meteor paths must stay fitted after resize');
assert.match(scene, /this\.triggerCentrifugal\(point\.x, point\.y/, 'pointer interaction must emit a global centrifugal pulse');
assert.match(scene, /this\.reducedMotion \? 0\.32 : this\.mobile \? 0\.62 : 0\.88/, 'reduced-motion pointer pulses must use less force');
assert.match(ui, /document\.fonts\.load\('900 80px "Nunito Sans"'/, 'recipient masks must wait for the Vietnamese display font');
assert.match(shader, /uniform float uArtStyle/, 'nebula shader must accept per-recipient styles');
assert.match(shader, /uniform vec2 uCoreOffset/, 'each nebula can place its luminous center independently');
assert.match(shader, /float coreGlow/, 'nebula raymarch must render a restrained focal glow');
assert.match(shader, /float softHalo = exp\(-r \* r \* 3\.5\)/, 'background stars retain an explicit soft emissive halo');
assert.match(shader, /vAlpha \* \(dust \* 0\.80 \+ halo \* 0\.72 \+ glint \* 0\.18 \+ hotCore \* 0\.32\)/,
  'flowing nebula dust receives a restrained soft halo and sparse white cores');
assert.match(shader, /emission \* 1\.68/, 'volumetric nebula emission receives a measured local lift');
assert.match(shader, /gl_PointSize = min\(2\.0 \* aSize \* uPixelRatio, 12\.0 \* uPixelRatio\)/,
  'background star radii should be expressed in CSS pixels and scaled by devicePixelRatio');
assert.match(shader, /1\.72 \+ vHero \* 0\.12/, 'star brightness should rise locally without changing renderer exposure');
assert.match(shader, /uniform float uParticleScale;/, 'desktop nebula dust can be enlarged without changing mobile sizing');
assert.match(shader, /smoothstep\(0\.989, 0\.999, fract\(aSeed \* 47\.73\)\)/, 'recipient glyphs must contain a sparse bright-star population');
assert.match(shader, /float stellarCore = exp\(-r \* r \* 72\.0\) \* vHero/,
  'selected title stars must resolve into sharp white cores instead of uniformly soft dots');
assert.match(space, /starRadiusRanges/, 'background stars should use explicit size tiers for each depth layer');
assert.match(space, /createSeededRandom\(0x5354454C\)/, 'background star placement should use a stable default seed');
assert.match(nebulaFlow, /uParticleScale: \{ value: mobile \? 1 : 1\.1 \}/, 'desktop nebula dust uses a restrained size lift');
assert.match(shader, /haze \* 0\.20 \+ innerGlow \* 0\.16/, 'the rendered galaxy particle shader uses restrained, crisp soft-glow');
assert.match(shader, /distance\(gl_PointCoord, vec2\(0\.5\)\)/, 'galaxy particles use a soft radial distance gradient');
assert.match(shader, /aGroup == 1\.0 \? 1\.58/, 'the primary spiral arms receive a clear size hierarchy over secondary dust');
assert.match(shader, /size \* sizeGain \* 1\.12/, 'moving galaxy particles keep crisp sizing at higher particle density');
assert.match(shader, /mix\(7\.0, 14\.0, heroStar\) \* uPixelRatio/,
  'hero particles stay sharp while retaining restrained DPR-scaled perspective sizing');
assert.match(galaxy, /Math\.min\(1\.65, Math\.max\(1\.22, halfHeight \/ 4\.1, halfWidth \/ 7\.5\)\)/,
  'the personal spiral is scaled beyond viewport bounds instead of collapsing into a central blob');
assert.match(css, /@media \(min-width: 769px\)[\s\S]*font-size: clamp\(16px, 1\.25vw, 18px\)/, 'desktop recipient-wish copy is larger and keeps mobile typography unchanged');
assert.match(shader, /uniform vec4 uTitleBounds/, 'the volumetric nebula must receive the particle title bounds');
assert.match(shader, /float titleZone = titleX \* titleY \* uTitleBounds\.w/, 'the nebula must preserve screen-space negative space around the particle title');
assert.match(space, /setVolumeTitleProtection/, 'the title protection must stay synchronized with viewport scaling');
assert.match(shader, /if \(uArtStyle >= 0\.0\)/, 'the idle nebula must retain its neutral base motif');
assert.match(shader, /butterflyRadius/, 'each defined nebula motif must render a distinct shape');
assert.match(scene, /setVolumeArtDirection/, 'recipient art direction must reach the nebula uniforms');
assert.match(scene, /this\.nebula\.uniforms\.uDensity\.value = direction \? 0\.04 : 0\.12/, 'nebula density keeps the galaxy crisp in personalized and neutral scenes');
assert.match(scene, /this\.mobile \? 3 : 5/, 'lower raymarch step counts offset the higher-resolution nebula target cost');
assert.match(scene, /this\.degraded \? 0\.29 : 0\.40/, 'higher desktop nebula target resolution reduces blur without restoring broad haze');
assert.match(scene, /this\.artDirection \? strength : strength \* 0\.22/, 'idle cosmic pulses do not scatter the affiliation text while preserving galaxy reactions');
assert.match(scene, /new CosmicBodies\(this\.scene\)/, 'the scene must render true 3D celestial bodies');
assert.match(scene, /this\.bodies\.update/, 'celestial bodies must move through the camera depth');
assert.match(scene, /resetToIdle\(\)[\s\S]*?setArtDirection\(null\)/, 'returning home must restore the neutral nebula');
assert.match(shader, /float core = exp\(-r \* r \* mix\(12\.0, 25\.0, vRecipient\)\)/, 'morphic particles must retain crisp, sharply focused cores');
assert.match(shader, /float starRay = \([\s\S]*\) \* max\(rareGlint, vHero\) \* 0\.18/,
  'nebula names must resolve into sparse star points');
assert.match(shader, /float titleDistance = length\(recipientTarget\.xy - vec2\(0\.0, 0\.72\)\)/, 'the glyph particles must react to the nearby equation field');
assert.match(curves, /const r = 1\.18 \+ Math\.cos\(5 \* t\)/, 'the mathematical particle field must include a sampled polar rose');
assert.match(curves, /Math\.sin\(2\.2 \* t \+ 0\.3\)/, 'the mathematical particle field must include a living sine graph');
assert.match(curves, /const radius = 0\.52 \+ t \* 0\.34/, 'the mathematical particle field must include a parameterized spiral');
assert.match(curves, /p \+= aTangent \* travel/, 'equation particles must travel along their path tangents');
assert.match(curves, /uResonance/, 'equation particles must resonate near the name');
assert.match(curves, /this\.points\.scale\.set\(Math\.min\(1, aspect \* 0\.82\), 1, 1\)/, 'equation paths must fit narrow portrait viewports');
assert.match(scene, /this\.galaxy\.uniforms\.uNova/, "the galaxy's equation-bearing dust must share the core nova pulse");
assert.match(shader, /uniform vec3 uCentrifugal/, 'particle systems must react to a shared radial impulse');
assert.match(space, /const arm = Math\.floor\(Math\.random\(\) \* 3\)/, 'the luminous galaxy must have distinct spiral arms');
assert.match(space, /geometry\.setAttribute\('aRadius'/, 'galaxy stars must retain orbital radius for shader motion');
assert.match(space, /export function pulseNebulaVolume/, 'the volumetric nebula must expose its shared impulse');
assert.match(shader, /float armBreath/, 'galaxy arm dust must move around a mathematical spiral');
assert.match(comets, /const count = mobile \? 8 : 20/, 'comet field must provide frequent streaks on mobile and desktop');
assert.ok(comets.includes('new THREE.Mesh(geometry, trailMaterial)') && comets.includes("setAttribute('aEdge'"), 'comet tails must be camera-facing ribbon meshes');
assert.match(comets, /const start = new THREE\.Vector3[\s\S]*const end = new THREE\.Vector3[\s\S]*const travelTime = distance \/ speed/, 'meteors must use bounded, speed-based trajectories');
assert.match(comets, /const back = i \/ \(n - 1\) \* comet\.tail[\s\S]*\/ comet\.distance/, 'meteor tails must trail behind their moving heads at viewport-scaled lengths');
assert.match(comets, /const lane = i % 2/, 'comet paths must stay in reserved side lanes around the identity and wish');
assert.match(comets, /startN: new THREE\.Vector2/, 'comet trajectories must retain normalized endpoints for viewport changes');
assert.match(comets, /setViewport\(width, height, cameraZ/, 'comet trajectory bounds must update on resize');
assert.match(shader, /smoothstep\(0\.34, 1\.0, abs\(vEdge\)\)/, 'comet ribbon shader must feather its edges');
assert.match(shader, /#include <tonemapping_fragment>/, 'emissive shader output must pass through ACES');
assert.match(shader, /fbm\(/, 'volumetric fBM is expected');
assert.match(shader, /float simplex3\(vec3 v\)/, 'nebula should use mobile-friendly 3D Simplex noise');
assert.match(shader, /uniform float uFbmOctaves/, 'fBM quality must be adaptive for mobile');
assert.match(shader, /uniform float uTime/, 'nebula noise must animate via uTime');
assert.match(shader, /curlPotential/, 'morphing typography needs a curl field');
assert.match(shader, /cellPulse/, 'Voronoi-like particle cells are expected');
assert.match(particles, /const SHAPES = \['HNUE', 'SMCS', 'K75CLC'\]/, 'the waiting world retains the three-part signature morph');
assert.match(particles, /makeTextSamples\('HNUE',[\s\S]*makeTextSamples\('SMCS',[\s\S]*makeTextSamples\('K75CLC'/, 'all three affiliation marks are sampled into reusable GPU target buffers');
assert.match(particles, /setAttribute\('aHNUE'[\s\S]*setAttribute\('aSMCS'[\s\S]*setAttribute\('aK75'/, 'signature targets are geometry attributes rather than per-frame allocations');
assert.match(shader, /attribute vec3 aHNUE;[\s\S]*attribute vec3 aSMCS;[\s\S]*attribute vec3 aK75;/, 'shader attributes preserve semantic HNUE, SMCS and K75 targets');
assert.match(shader, /if \(n < 0\.5\) return aHNUE;[\s\S]*if \(n < 1\.5\) return aSMCS;[\s\S]*return aK75;/, 'shader morph order is HNUE → SMCS → K75CLC');
assert.match(particles, /this\.points\.renderOrder = 100/, 'foreground identity points render at the top of their isolated scene');
assert.match(scene, /new ParticleCloud\(this\.identityScene/, 'morphic identity particles render in their own scene');
assert.match(galaxy, /this\.points\.renderOrder = 1\.5/, 'the galaxy remains a lower draw-order layer');
assert.match(fallback, /const words = \['HNUE', 'SMCS', 'K75CLC'\]/, 'the Canvas 2D fallback preserves the exact same three-mark sequence');
assert.match(mathSamples, /MATHEMATICAL_FORM_NAMES = Object\.freeze\(\['rose', 'lemniscate', 'phyllotaxis'\]\)/, 'the separate mathematical-form sampler remains available for procedural art');
assert.match(mathSamples, /export function makeMathematicalSamples/, 'mathematical sampling is independent of the renderer and testable without WebGL');
const sampledForms = ['rose', 'lemniscate', 'phyllotaxis'].map((form, index) => makeMathematicalSamples(form, 768, 0.31 + index * 0.17));
for (const [index, points] of sampledForms.entries()) {
  assert.ok(points instanceof Float32Array && points.length === 768 * 3, `math form ${index} has a bounded sample buffer`);
  assert.ok([...points].every(Number.isFinite), `math form ${index} contains finite coordinates`);
  assert.deepEqual(points, makeMathematicalSamples(['rose', 'lemniscate', 'phyllotaxis'][index], 768, 0.31 + index * 0.17), `math form ${index} is deterministic for a fixed seed`);
}
assert.ok(sampledForms.every((points, index) => index === 0 || !points.every((value, i) => value === sampledForms[0][i])), 'the separate mathematical forms differ geometrically');
assert.match(shader, /float idleTransition = \(1\.0 - uRecipientMix\) \* sin\(3\.1415926 \* uMorph\)/, 'the active morph transition must be identified independently from the recipient name');
assert.match(shader, /size \*= mix\(1\.30, 1\.16, recipientT\) \* \(1\.0 - idleTransition \* 0\.035\)/, 'affiliation particles keep a readable stroke weight during idle morphs');
assert.match(shader, /vAlpha \*= 1\.0 - idleTransition \* 0\.14/, 'idle morph transitions retain enough particle brightness to read the glyph');
assert.match(shader, /mix\(1\.08, 1\.10, recipientT\)/, 'idle alpha remains controlled while recipient particles retain their brightness');
assert.match(shader, /mix\(0\.065, 0\.045, vRecipient\)/, 'the idle forms use a restrained sharp halo');
assert.match(scene, /const \[halfWidth, halfHeight, centerY\] = this\.particles\.signatureBounds;[\s\S]*wishCenterX = toNdcX\(portalRect\.left \+ portalRect\.width \* 0\.5\);[\s\S]*this\.artDirection \? 0\.62 : 0\.88/,
  'the waiting-screen signature is protected from background galaxy particles separately from the portal');
assert.match(shader, /vAlpha = clamp\(/, 'particle alpha is capped to prevent highlight clipping');
assert.doesNotMatch(shader, /uIdleVisibility/, 'idle typography must not crossfade through a blurry opacity animation');
assert.match(particles, /onRepeat: \(\) => \{[\s\S]*this\.fromIndex = this\.toIndex;[\s\S]*this\.toIndex = \(this\.toIndex \+ 1\) % SHAPES\.length;[\s\S]*this\.uniforms\.uMorph\.value = 0;/, 'the three affiliation marks cycle with the existing particle-morph transition');
assert.match(particles, /repeatDelay: 0\.8,[\s\S]*fromTo\(this\.uniforms\.uMorph,[\s\S]*duration: 4, ease: 'power3\.inOut'/, 'the staged infinity morph holds each mark 0.8 seconds less between transitions');
assert.doesNotMatch(particles, /uIdleVisibility/, 'idle typography must not crossfade through a blurry opacity animation');
assert.doesNotMatch(css, /cosmicSepPulse|starlightSheen/, 'waiting-screen signature text must not pulse continuously after its entrance');
assert.match(css, /\.brand-back-button[\s\S]*min-height:\s*44px[\s\S]*background:\s*transparent/, 'logo Back interaction must keep an accessible target without button chrome');
assert.match(shader, /p \+= curlLikeFlow\(p, uTime, aSeed\) \* mix\(0\.055, 0\.030/, 'the signature particles use restrained curl drift');
assert.match(shader, /const float signatureTilt = -0\.5235988;/, 'the signature keeps a leftward 30-degree inclination');
assert.match(shader, /size \*= mix\(1\.30, 1\.16, recipientT\)/, 'the signature field keeps a controlled particle scale while preserving recipient title scale');
assert.match(css, /translate:\s*-50% 0;[\s\S]*transform:translateY/, 'layout centering must be separated from GSAP transform animation');
assert.match(css, /\.reveal \{[\s\S]*justify-content:center/, 'the wish panel must center its contents vertically');
assert.match(scene, /gsap\.timeline/, 'GSAP timeline must direct the Stellar Bomb');
assert.match(ui, /buildKineticName/, 'the particle title must keep an accessible DOM name');
assert.match(ui, /renderWish/, 'the wish must be split into a serif opening and readable sans-serif body');
assert.doesNotMatch(ui, /gatewayHeader|gatewayStardustCanvas|gatewayRevealTimeline/, 'the input flow no longer owns a redundant animated affiliation header');
assert.match(ui, /this\.activeRecipient = null;[\s\S]*this\.revealTimeline = null;/, 'back navigation must clear the active recipient and cancel stale reveal animation');
assert.match(ui, /generation !== this\.openGeneration \|\| this\.activeRecipient\?\.slug !== recipient\.slug\) return;/, 'a stale Stellar Bomb completion must not reopen the old wish after Back');
assert.match(ui, /this\.wish\.replaceChildren\(\);[\s\S]*this\.name\.textContent = ''/, 'returning to the code screen must clear the previous wish and accessible recipient name');
assert.match(ui, /this\.input\.focus\(\{ preventScroll: true \}\)/, 'the code input should be ready for immediate re-entry');
assert.doesNotMatch(ui, /recipient(?:Number|Equation|Concept)/, 'the greeting UI must not render identifying metadata');
assert.match(bodies, /SphereGeometry/, 'celestial bodies should have spherical geometry');
assert.match(bodies, /depth = -14 \+ Math\.sin/, 'celestial body depth should move smoothly without a wrapping jump');
assert.match(bodies, /TorusGeometry/, 'some personalized celestial bodies should have rings');
assert.match(ui, /this\.revealTimeline/, 'the wish reveal must use a dedicated cancellable timeline');
assert.match(ui, /cosmicDirector\.start\(\)/, 'the event schedule must start when the wish reveal completes');
assert.match(ui, /cosmicDirector\.stop\(\)/, 'the event schedule must stop when the wish closes or changes');
assert.match(ui, /idleCosmicDirector = new CosmicEventDirector/, 'the student-code portal must schedule occasional idle-screen supernovae');
assert.match(ui, /initialDelay: 18000/, 'the first idle-screen supernova must wait before appearing');
assert.match(ui, /idle: true/, 'the waiting-screen supernova must use the idle scene treatment');
assert.match(scene, /if \(!idle\) this\.fireShockwaves\(\)/, 'idle supernova shockwaves must not obscure the code-entry panel');
assert.match(ui, /enableDeviceParallax/, 'UI should request motion access from a user gesture');
assert.match(ui, /#recipientWish|this\.wish/, 'the personalized wish must participate in the reveal sequence');
assert.match(scene, /queueResize/, 'resize events must be coalesced');
assert.match(scene, /composer\.setSize\(width, height\)/, 'the camera/render target/composer must resize together');
assert.match(scene, /forceContextLoss/, 'WebGL disposal should release the graphics context');
assert.match(scene, /this\.disposed = true/, 'scene disposal must be idempotent');
assert.match(scene, /playCosmicEvent\(name/, 'WebGL must orchestrate profile-aware cosmic events');
assert.match(scene, /const prepare = slow \? 0\.36 : 0\.75;[\s\S]*const peak = slow \? 0\.68 : 1\.25;[\s\S]*const recover = slow \? 0\.48 : 1\.0;/, 'normal event choreography uses bounded anticipation, peak, and dissipation stages');
assert.ok(0.75 + 1.25 * 1.45 + 1.0 <= 5, 'the longest normal event envelope fits the 3–5 second requirement');
assert.match(scene, /fireShockwaves\(\)/, 'the supernova must trigger the existing multi-ring shockwave system');
assert.match(scene, /triggerCentrifugal\(center\.x/, 'cosmic events must pulse the existing centrifugal systems');
assert.match(scene, /new CosmicEventLayer/, 'cosmic event particles should reuse one GPU layer rather than recreate the scene');
assert.match(scene, /cosmicEventCenter\(sequence/, 'event origins must be positioned relative to the live wish panel and viewport');
assert.match(scene, /titleProtectRect/, 'event placement and shader attenuation must protect the particle name as well as the wish');
assert.match(cosmicEvents, /uTitleProtectRect/, 'GPU event points and trails must attenuate over the particle-name region');
assert.match(cosmicEvents, /local\.xy \+= vec2\(cos\(uPhase\), sin\(uPhase\)\) \* riftOpen \* 0\.34/,
  'centrifugal rifts should have a subtle phase-directed offset');
assert.match(scene, /stellar:cosmic-event/, 'cosmic event starts should be observable for runtime verification');
assert.match(fallback, /playCosmicEvent\(name/, 'Canvas fallback must keep the scheduled event sequence visual');
assert.match(fallback, /drawCosmicEvent\(ctx\)/, 'Canvas fallback must render its event choreography');
assert.match(fallback, /getContext\?\.\('2d'/, 'fallback renderer must use Canvas 2D when available');
assert.match(fallback, /cancelAnimationFrame/, 'fallback RAF must be cancellable on dispose/hidden state');
assert.match(fallback, /frameBudget/, 'fallback renderer must cap its frame rate');
assert.match(fallback, /makeTitlePoints/, 'the fallback renderer must also form names from points');
assert.match(fallback, /RECIPIENT_GALAXY_PROFILES/, 'Canvas fallback must select each recipient galaxy profile');
assert.match(fallback, /hashGalaxySeed/, 'Canvas fallback galaxy geometry must use a stable recipient seed');
assert.match(fallback, /makeGalaxyParticles/, 'Canvas fallback must generate a distinct organized galaxy particle field');
assert.match(fallback, /drawGalaxy\(ctx\)/, 'Canvas fallback must render the active galaxy behind the particle name');
assert.match(fallback, /case 'lissajous'/, 'Canvas fallback must preserve profile-specific mathematical curves');
assert.match(rain, /if \(!this\.ctx\)/, 'decorative Canvas 2D overlay must not block startup when unavailable');
assert.match(rain, /size: rand\(mobile \? 8 : 10, mobile \? 12 : 14\)/, 'equation meteors must use compact, readable formula text');
assert.match(rain, /ctx\.createLinearGradient\(-width - item\.trail/, 'equation meteors must have a fading directional trail');
assert.match(rain, /item\.angle = Math\.atan2\(item\.vy, item\.vx\)/, 'equation meteors must align their text with their flight');
assert.match(rain, /alpha: rand\(\.16, \.26\)/, 'equation meteors must keep a restrained brightness');
assert.match(main, /activateFallback/, 'main entry must safely switch to fallback');
assert.match(main, /import\.meta\.hot\.dispose\(teardown\)/, 'HMR must release app resources');
assert.match(ui, /destroy\(\)/, 'interface event handlers must be removable');
assert.match(css, /@media \(max-width: 768px\)/, 'mobile layout needs a tablet/phone breakpoint');
assert.match(css, /-webkit-overflow-scrolling:\s*touch/, 'glass wish card must scroll smoothly on iOS');
assert.match(viteConfig, /manualChunks/, 'Vite should split vendor chunks');
assert.match(viteConfig, /gzipSync/, 'production text assets should have precompressed gzip siblings');

const cometField = new CometField(new THREE.Scene(), {
  pixelRatio: 1, mobile: true, width: 390, height: 844
});
assert.equal(cometField.comets.length, 8);
cometField.setArtDirection(getRecipientArtDirection(recipients[4]));
assert.ok(cometField.comets.some(comet => comet.curve !== comet.baseCurve || comet.speed !== comet.baseSpeed),
  'profile motion must alter meteor curvature or cadence');
for (const comet of cometField.comets) {
  let previous = cometField.path(comet, 0);
  for (let step = 1; step <= 100; step++) {
    const current = cometField.path(comet, step / 100);
    assert.ok(Number.isFinite(current.x + current.y + current.z), 'comet path must remain finite');
    assert.ok(current.distanceTo(previous) < 1, 'comet path must not teleport between adjacent samples');
    previous = current.clone();
  }
}
cometField.setArtDirection(null);
assert.ok(cometField.comets.every(comet => comet.curve === comet.baseCurve),
  'returning to idle must restore the neutral meteor paths');
cometField.setViewport(909, 480);
cometField.triggerPulse(0, 0, 0, 1);
cometField.update(1.2);
assert.ok(cometField.comets.every(comet => [...comet.geometry.attributes.position.array].every(Number.isFinite)), 'resized comet trails must remain finite');
cometField.dispose();
console.log('STELLAR smoke tests passed: personalized routes, WebGL lifecycle/resize, Canvas 2D fallback, adaptive rendering, mobile responsive styles, HMR cleanup, chunk splitting and gzip asset emission.');

// Every relative ES-module import must resolve to a file in the packaged source tree.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const paths = [];
  for (const entry of entries) {
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) paths.push(...await walk(path));
    else if (entry.isFile() && path.endsWith('.js')) paths.push(path);
  }
  return paths;
}
for (const file of await walk(resolve(root, 'src'))) {
  const code = await readFile(file, 'utf8');
  for (const match of code.matchAll(/(?:from\s*|import\s*)['"](\.[^'"]+)['"]/g)) {
    const target = resolve(dirname(file), match[1]);
    await access(target).catch(() => { throw new Error(`Missing module import: ${file} -> ${match[1]}`); });
  }
}
console.log('STELLAR module graph passed: all relative ES-module imports resolve.');
