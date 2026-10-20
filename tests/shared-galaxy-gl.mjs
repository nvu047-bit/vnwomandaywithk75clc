import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { recipients } from '../src/data/recipients.js';
import { GALAXY_PROFILES, RECIPIENT_GALAXY_PROFILES } from '../src/data/galaxyProfiles.js';
import { recipientArtDirections } from '../src/data/artDirections.js';
import * as shaders from '../src/graphics/shaders.js';
import { generateGalaxyPoints, galaxyVertexShader } from '../src/graphics/GalaxyArchitecture.js';
import { computeLayout, buildBridgeGraph, neighboursOf, halfExtentsAt, SHARED_CAMERA } from '../src/graphics/shared/layout.js';
import { CosmicEventScheduler, EVENT_KINDS, mulberry32 } from '../src/graphics/shared/CosmicEventScheduler.js';
import { GalaxyCluster } from '../src/graphics/shared/GalaxyCluster.js';
import { createStarField } from '../src/graphics/SpaceField.js';
import { MatterBridges } from '../src/graphics/shared/MatterBridges.js';
import { SharedComet } from '../src/graphics/shared/SharedComet.js';
import { SharedEventDirector } from '../src/graphics/shared/SharedEventDirector.js';
import { SharedGalaxyGL } from '../src/graphics/shared/SharedGalaxyGL.js';
import { IntergalacticField } from '../src/graphics/shared/IntergalacticField.js';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');
const norm = text => text.replace(/\r\n/g, '\n');
const sha = text => createHash('sha256').update(norm(text)).digest('hex').slice(0, 16);

/* ---- 1. personal rendering contracts remain stable -------------------------------- */
const frozen = {
  nebulaFragmentShader: '32f4f1bf1dc68c0f', nebulaVertexShader: 'c433fa68b03af40f',
  starVertexShader: '4957e0372dea0ad1', cometTrailVertexShader: 'e5596f66bb090fa1',
  nebulaFlowVertexShader: '80a17ab37ffe369a'
};
for (const [name, hash] of Object.entries(frozen)) {
  assert.equal(sha(shaders[name]), hash, `${name} must remain at its reviewed shader baseline`);
}
{
  const root = new THREE.Group();
  root.rotation.z = 0.35;
  root.updateMatrixWorld(true);
  const galaxy = {
    root, center: new THREE.Vector3(), phase: 0.6, novaBoost: 0,
    pulse(point, strength) {
      this.hoverPulse = { point: root.worldToLocal(point.clone()), strength };
    }
  };
  const hover = {
    galaxies: [galaxy], pointer: { nx: 0, ny: 0 },
    hoverNdc: new THREE.Vector2(), hoverRaycaster: new THREE.Raycaster(),
    hoverPlane: new THREE.Plane(), hoverPlaneNormal: new THREE.Vector3(),
    hoverPoint: new THREE.Vector3(), hoverLocalPoint: new THREE.Vector3(),
    camera: new THREE.PerspectiveCamera(45, 1, 0.1, 100)
  };
  hover.camera.position.z = 20;
  hover.camera.lookAt(0, 0, 0);
  hover.camera.updateMatrixWorld(true);
  SharedGalaxyGL.prototype.triggerHoverPulse.call(hover, 0);
  assert.ok(Math.abs(Math.hypot(galaxy.hoverPulse.point.x, galaxy.hoverPulse.point.y) - 1.15) < 1e-5,
    'a center hover still launches its pulse from an obviously off-center origin');
  assert.equal(galaxy.hoverPulse.strength, 2.2, 'the hover pulse uses a visibly strong radial impulse');
  assert.equal(galaxy.novaBoost, 0.85, 'the hover pulse briefly brightens the selected galaxy');
}
const arch = norm(await read('../src/graphics/GalaxyArchitecture.js'));
assert.match(arch, /uTitleDim: \{ value: 1 \}, uFlare: \{ value: new THREE\.Vector3\(\) \}/, 'personal galaxy keeps neutral defaults for the shared hooks');
assert.match(galaxyVertexShader, /mix\(1\.0, 0\.04, titleZone \* uTitleDim\)/, 'foreground title protection keeps galaxy detail subdued beneath the name');
assert.match(galaxyVertexShader, /uFlare\.z \* exp\(/, 'flare is multiplicative and neutral at zero strength');

/* ---- 2. layout and bridge graph ------------------------------------------------------ */
for (const [label, aspect, w, h] of [['desktop', 1.6, 1280, 800], ['ultrawide', 2.1, 1680, 800], ['tablet', 1.33, 1024, 768], ['phone', 0.46, 390, 844]]) {
  const layout = computeLayout({ aspect, mobile: aspect < 1.1 });
  assert.equal(layout.length, 9, `${label}: nine galaxies are placed`);
  const px = layout.map(slot => {
    const dist = SHARED_CAMERA.z - slot.z;
    const world = 2 * Math.tan(SHARED_CAMERA.fov * Math.PI / 360) * dist;
    const e = halfExtentsAt(slot.z, aspect);
    return { x: (slot.x / e.halfW * 0.5 + 0.5) * w, y: (-slot.y / e.halfH * 0.5 + 0.5) * h, r: slot.radius / world * h, z: slot.z };
  });
  if (label !== 'phone') for (const p of px) {
    assert.ok(p.x - p.r > -8 && p.x + p.r < w + 8, `${label}: galaxy stays inside the width`);
    assert.ok(p.y - p.r > -8 && p.y + p.r < h - 18, `${label}: galaxy and its name stay inside the height`);
  }
  else {
    assert.ok(Math.abs(px[0].x - w / 2) < 1 && Math.abs(px[0].y - h / 2) < 1, 'phone: first galaxy opens centered in a fixed viewport');
    assert.ok(px[2].x > w * 1.5 && px[8].y > h * 1.5, 'phone: remaining galaxies extend beyond the initially visible field');
  }
  for (let i = 0; i < 9; i++) for (let j = i + 1; j < 9; j++) {
    const d = Math.hypot(px[i].x - px[j].x, px[i].y - px[j].y);
    assert.ok(d > 0.78 * (px[i].r + px[j].r), `${label}: galaxies ${i} and ${j} are not stacked on top of each other (${d.toFixed(0)}px)`);
  }
  assert.ok(new Set(layout.map(s => s.z)).size >= 6, `${label}: galaxies occupy several distinct depths`);
  assert.ok(Math.max(...px.map(p => p.r)) / Math.min(...px.map(p => p.r)) > 1.3, `${label}: galaxies have clearly different apparent scale`);
  const edges = buildBridgeGraph(layout, aspect);
  const reach = new Set([0]);
  for (let pass = 0; pass < 9; pass++) for (const [a, b] of edges) { if (reach.has(a)) reach.add(b); if (reach.has(b)) reach.add(a); }
  assert.equal(reach.size, 9, `${label}: every galaxy is linked into one matter network`);
  assert.ok(edges.length >= 9 && edges.length <= 16, `${label}: sensible bridge count (${edges.length})`);
}

/* ---- 3. scheduler: asynchronous, rested, non-repeating ----------------------------------- */
{
  const scheduler = new CosmicEventScheduler({ rng: mulberry32(20102026), galaxyCount: 9 });
  const dt = 0.05;
  let activeSeconds = 0, overlap = 0, startedCount = 0;
  const ends = [];
  for (let t = 0; t < 900; t += dt) {
    const r = scheduler.update(t);
    if (r.started) startedCount++;
    if (r.finished) ends.push(t);
    if (scheduler.current) activeSeconds += dt;
    if (r.started && scheduler.current && r.started !== scheduler.current) overlap++;
  }
  const h = scheduler.history;
  assert.ok(h.length > 60, 'events keep occurring for the whole session');
  assert.ok(startedCount > 280, `events start every three seconds (${startedCount} starts in 15 minutes)`);
  assert.equal(overlap, 0, 'only one high-salience event at a time');
  for (const e of h) assert.ok(e.duration >= 2.2 && e.duration <= 2.8, `event fits within the three-second cadence (${e.duration.toFixed(2)} s)`);
  for (let i = 1; i < h.length; i++) {
    const interval = h[i].start - h[i - 1].start;
    assert.ok(interval >= 2.99 && interval <= 3.06, `events start three seconds apart (${interval.toFixed(2)} s)`);
    assert.notEqual(h[i].kind, h[i - 1].kind, 'same kind never fires twice in a row');
    assert.notEqual(h[i].galaxy, h[i - 1].galaxy, 'same galaxy is never the focus twice in a row');
  }
  assert.deepEqual(new Set(h.map(e => e.kind)), new Set(Object.keys(EVENT_KINDS)), 'every event kind is used');
  assert.ok(activeSeconds / 900 < 0.95 && activeSeconds / 900 > 0.7, `events leave a short transition between starts (${(activeSeconds / 9).toFixed(0)}% active)`);
  assert.ok(h.filter(e => e.kind === 'comet').length / h.length > 0.2, 'the intergalactic streak is weighted to appear frequently');
  const kinds = h.map(e => e.kind);
  for (let period = 1; period <= 12; period++) {
    let same = 0;
    for (let i = 0; i + period < kinds.length; i++) if (kinds[i] === kinds[i + period]) same++;
    assert.ok(same / (kinds.length - period) < 0.7, `no fixed repeating cycle of length ${period}`);
  }

  {
    const scene = new THREE.Scene();
    const field = new IntergalacticField(scene, { mobile: false, rng: mulberry32(42) });
    const position = field.geometry.getAttribute('position');
    const kind = field.geometry.getAttribute('aKind');
    const cometCount = Array.from(kind.array).filter(value => value === 1).length;
    assert.equal(field.count, 680, 'the shared sky has a dedicated moving particle budget outside galaxy clusters');
    assert.equal(cometCount, field.cometTracks * field.trailPoints, 'ambient comets have persistent, independently animated trail points');
    field.setTime(12);
    assert.equal(field.uniforms.uTime.value, 12, 'intergalactic particles advance with scene time');
    const fieldCamera = new THREE.PerspectiveCamera(54, 1.6, 0.5, 320);
    fieldCamera.position.set(0, 0, SHARED_CAMERA.z);
    field.setViewport(fieldCamera, 1.5);
    assert.equal(field.uniforms.uPixelRatio.value, 1.5, 'ambient particle sizing follows the active pixel ratio');
    assert.ok(position.getZ(0) < -2, 'ambient particles occupy open-space depth layers');
    field.dispose();
  }
  const off = new CosmicEventScheduler({ rng: mulberry32(1) });
  for (let t = 0; t < 60; t += 0.1) off.update(t, { enabled: false });
  assert.equal(off.history.length, 0, 'disabled (reduced motion) scheduler never starts events');
}

/* ---- 4. galaxies are simulated from the personal generator, not frozen ------------------- */
const profileFor = r => GALAXY_PROFILES[RECIPIENT_GALAXY_PROFILES[r.id]];
function starPositions(seed) {
  const scene = new THREE.Scene();
  const field = createStarField(scene, 1, false, mulberry32(seed));
  const positions = field.layers.map(layer => Array.from(layer.geometry.getAttribute('position').array));
  for (const layer of field.layers) { layer.geometry.dispose(); layer.material.dispose(); }
  return positions;
}
assert.deepEqual(starPositions(20261019), starPositions(20261019), 'debug seed reproduces starfield geometry');
assert.notDeepEqual(starPositions(20261019), starPositions(20261020), 'different debug seeds produce distinct starfields');
const galaxies = recipients.map((recipient, index) => new GalaxyCluster({
  index, recipient, profile: profileFor(recipient), direction: recipientArtDirections[recipient.id], count: 600, pixelRatio: 1, mobile: false
}));
const rawPositions = generateGalaxyPoints(600, profileFor(recipients[0]), recipients[0].id).positions;
for (let i = 2; i < rawPositions.length; i += 3) {
  assert.ok(Math.abs(galaxies[0].generated.positions[i] - rawPositions[i] * 2.5) < 1e-6, 'shared galaxy particles have 2.5 times the original depth thickness');
}
const layout = computeLayout({ aspect: 1.6, mobile: false });
galaxies.forEach((g, i) => g.setLayout(layout[i], 10 + i * 4));
assert.equal(new Set(galaxies.map(g => g.timeScale.toFixed(3))).size, 9, 'every galaxy has its own clock rate');
assert.equal(new Set(galaxies.map(g => g.timeOffset.toFixed(2))).size, 9, 'every galaxy has its own starting phase');
assert.equal(new Set(galaxies.map(g => g.uniforms.uMorphology.value)).size, 9, 'nine different morphologies are kept');
assert.ok(galaxies.every(g => g.uniforms.uTitleDim.value === 0), 'shared galaxies do not darken a non-existent title band');
assert.ok(galaxies.every(g => g.stellarPoints.parent === g.root), 'each galaxy has a separate animated stellar accent layer');
assert.ok(galaxies.every(g => g.stellarGeometry.getAttribute('position').count === 128), 'desktop galaxies retain a dense, profile-derived bright-star layer');
const camera = new THREE.PerspectiveCamera(SHARED_CAMERA.fov, 1.6, 0.5, 320);
camera.position.set(0, 0, SHARED_CAMERA.z); camera.updateMatrixWorld();
const t0 = galaxies.map(g => g.uniforms.uTime.value);
const center0 = galaxies.map(g => g.center.clone());
galaxies.forEach(g => g.update(5, 0.016, 0, camera, 800));
const t1 = galaxies.map(g => g.uniforms.uTime.value);
assert.ok(galaxies.some((g, i) => g.center.distanceTo(center0[i]) > 0.01), 'galaxy centers gently oscillate instead of staying fixed');
assert.ok(galaxies.every(g => g.center.distanceTo(g.layoutCenter) < 0.4), 'galaxy drift stays subtle and within its layout slot');
galaxies.forEach(g => g.update(11, 0.016, 0, camera, 800));
const t2 = galaxies.map(g => g.uniforms.uTime.value);
assert.ok(t1.every((v, i) => v > t0[i]) && t2.every((v, i) => v > t1[i]), 'uTime uniforms advance every frame');
assert.ok(new Set(t2.map(v => v.toFixed(2))).size === 9, 'galaxy clocks are not synchronous');
const rot0 = galaxies[0].root.rotation.z; galaxies[0].update(60, 0.016, 0, camera, 800);
assert.notEqual(galaxies[0].root.rotation.z, rot0, 'disk orientation precesses');

/* ---- 5. events act on real systems ---------------------------------------------------------- */
const scene = new THREE.Scene();
const edges = buildBridgeGraph(layout, 1.6);
const bridges = new MatterBridges(scene, { pixelRatio: 1, mobile: false });
bridges.configure(edges, galaxies);
const comet = new SharedComet(scene, { pixelRatio: 1, mobile: false });
const director = new SharedEventDirector({ galaxies, bridges, comet, getEdges: () => edges, getFrustum: z => halfExtentsAt(z, 1.6) });
const dt = 1 / 30;
function runEvent(kind, galaxy, { collect }) {
  const duration = (EVENT_KINDS[kind].min + EVENT_KINDS[kind].max) / 2;
  const event = { id: 1, kind, start: 100, duration, galaxy, seed: 77 };
  director.begin(event, 100);
  const stats = { maxFlare: 0, maxNova: 0, maxNeighbourNova: 0, maxBloom: 0, maxPulses: 0, reactions: 0, travelled: 0, aliveFrames: 0, phases: new Set() };
  let last = null;
  for (let t = 100 + dt; t <= 100 + duration + 0.5; t += dt) {
    director.tick(t, dt);
    if (event.phase) stats.phases.add(event.phase);
    bridges.update(t, t);
    comet.update(dt, galaxies);
    for (let i = 0; i < galaxies.length; i++) {
      const g = galaxies[i];
      g.novaBoost *= 0.98;
      g.update(t, dt, 0, camera, 800);
      if (i !== galaxy) stats.maxNeighbourNova = Math.max(stats.maxNeighbourNova, g.uniforms.uNova.value);
    }
    for (const i of comet.reactions) { galaxies[i].pulse(comet.head, 1); stats.reactions++; }
    stats.maxFlare = Math.max(stats.maxFlare, ...galaxies.map(g => g.uniforms.uFlare.value.z));
    stats.maxNova = Math.max(stats.maxNova, ...galaxies.map(g => g.uniforms.uNova.value));
    stats.maxBloom = Math.max(stats.maxBloom, galaxies[galaxy].nebulaUniforms.uBloomAmp.value);
    stats.maxPulses = Math.max(stats.maxPulses, bridges.activePulseCount);
    if (comet.active) { stats.aliveFrames++; if (last) stats.travelled += last.distanceTo(comet.head); last = (last || new THREE.Vector3()).copy(comet.head); }
  }
  director.end(100 + duration);
  return { ...stats, duration };
}
let r = runEvent('armWave', 2, {});
assert.ok(r.maxFlare > 1.5 && r.maxNova > 1.0 && r.maxPulses >= 1, 'armWave: travelling flare, energy ring and bridge pulses');
r = runEvent('cascade', 8, {});
assert.ok(r.maxPulses >= 1 && r.maxFlare > 1, 'cascade: pulse crosses bridges and lights the next galaxy');
r = runEvent('starburst', 4, {});
assert.ok(r.maxFlare > 2.5 && r.maxPulses >= 1, 'starburst: local cluster flare radiates along matter bridges');
assert.ok(r.maxNeighbourNova > 0.3, 'starburst: bridge arrivals excite neighbouring galaxy particles');
r = runEvent('nebulaBloom', 0, {});
assert.ok(r.maxBloom > 0.6, 'nebulaBloom: nebula forms and expands');
assert.ok(['anticipation', 'impact', 'afterglow'].every(phase => r.phases.has(phase)), 'events expose anticipation, impact and afterglow phases');
r = runEvent('convergence', 5, {});
assert.ok(r.maxPulses >= 2, 'convergence: multiple energy streams travel over real matter bridges');
assert.ok(r.maxNova > 0.8, 'convergence: bridge arrivals excite the destination galaxy');
r = runEvent('aurora', 3, {});
assert.ok(r.maxBloom > 0.35 && r.maxPulses >= 1, 'aurora: a moving nebula ribbon sweeps across connected galaxies');
r = runEvent('pulsar', 6, {});
assert.ok(r.maxFlare > 1.2 && r.maxPulses >= 2, 'pulsar: repeated beams and rhythmic bridge pulses');
r = runEvent('supernova', 1, {});
assert.ok(r.maxBloom > 0.5 && r.maxNeighbourNova > 0.3, 'supernova: a bright core bloom radiates energy to its neighbours');
r = runEvent('tidalWave', 7, {});
assert.ok(r.maxFlare > 1.5 && r.maxPulses >= 2, 'tidal wave: a spiral flare sends twin waves through matter bridges');
r = runEvent('binaryResonance', 4, {});
assert.ok(r.maxBloom > 0.2 && r.maxPulses >= 1, 'binary resonance: two linked galaxies pulse in opposing phases');
for (const kind of ['comet', 'dustStream']) {
  r = runEvent(kind, 1, {});
  assert.ok(r.travelled > 25, `${kind}: head travels through space (${r.travelled.toFixed(1)} units)`);
  assert.ok(r.reactions >= 1, `${kind}: passing galaxies react`);
  assert.equal(comet.active, false, `${kind}: finishes its life`);
  assert.ok(r.aliveFrames / 30 >= 1.9 && r.aliveFrames / 30 <= 2.5, `${kind}: crosses the scene within the three-second cadence (${(r.aliveFrames / 30).toFixed(2)} s)`);
}
assert.ok(galaxies.every(g => g.uniforms.uFlare.value.z === 0 && g.nebulaUniforms.uBloomAmp.value === 0), 'event end resets all hooks');

// A comet accelerates: speed mid-flight must exceed speed at the start.
comet.launch([new THREE.Vector3(-30, 0, 0), new THREE.Vector3(-10, 3, 0), new THREE.Vector3(10, -3, 0), new THREE.Vector3(30, 0, 0)], { duration: 4.4 });
const speeds = []; let prev = comet.head.clone();
for (let i = 0; i < 132; i++) { comet.update(1 / 30, []); speeds.push(prev.distanceTo(comet.head) * 30); prev.copy(comet.head); }
assert.ok(Math.max(...speeds) > speeds[3] * 3, 'comet gains speed after launch');
comet.stop();

/* ---- 6. static contract: one renderer, one loop, no words, clean lifecycle ------------------- */
const [html, gl, wrapper, labels, main] = await Promise.all([
  read('../index.html'), read('../src/graphics/shared/SharedGalaxyGL.js'), read('../src/graphics/SharedGalaxy.js'),
  read('../src/graphics/shared/NameLabels.js'), read('../src/main.js')
]);
const cluster = await read('../src/graphics/shared/GalaxyCluster.js');
const cometSource = await read('../src/graphics/shared/SharedComet.js');
const ambientSource = await read('../src/graphics/shared/IntergalacticField.js');
const sky = await read('../src/graphics/shared/sharedShaders.js');
assert.equal((gl.match(/new THREE\.WebGLRenderer\(/g) || []).length, 1, 'one unified renderer for the whole shared sky');
assert.equal((gl.match(/requestAnimationFrame\(/g) || []).length, 1, 'exactly one animation-loop scheduling site (no duplicate loops on remount)');
assert.match(gl, /if \(this\.disposed \|\| this\.active\) return;/, 'start() is idempotent');
assert.match(cluster, /generateGalaxyPoints/, 'reuses the personal galaxy generator');
assert.match(cluster, /galaxyVertexShader, galaxyFragmentShader/, 'reuses the personal galaxy GPU shader');
assert.match(gl, /createStarField/, 'reuses the personal star LOD field (including the camera-gliding layer)');
assert.match(gl, /this\.mobilePan\.x - dx \* worldPerPixel/, 'mobile drags pan the WebGL camera through the larger galaxy field');
assert.match(gl, /start\(\{ focusIndex = 0 \} = \{\}\)/, 'mobile entry can focus the galaxy opened before returning from a personal world');
assert.match(gl, /onPointerUp\(event\)/, 'mobile taps select only after movement is distinguished from a swipe');
assert.match(gl, /this\.triggerHoverPulse\(this\.hoverIndex\)/, 'hovering a galaxy triggers an actual centrifugal pulse');
assert.match(gl, /if \(radius < 1\.15\)/, 'the hover pulse origin stays visibly offset from the galaxy core');
assert.match(gl, /galaxy\.pulse\(offset, 2\.2\)/, 'the off-center hover pulse has enough strength to read clearly');
assert.match(gl, /t - this\.lastHoverPulseAt >= 1\.4/, 'holding the pointer over a galaxy renews its centrifugal pulse at a restrained cadence');
assert.match(gl, /new IntergalacticField/, 'adds a distinct, continuously moving intergalactic particle layer');
assert.match(ambientSource, /uTime \/ 9\.5/, 'two ambient comet trails loop continuously through the open sky');
assert.match(gl, /createStarField\(this\.scene, 1, this\.mobile, mulberry32\(this\.seed \^/, 'the shared star field is reproducible from its debug seed');
assert.match(cometSource, /cometTrailVertexShader[\s\S]*cometHeadVertexShader/, 'reuses the personal comet ribbon and head shaders');
assert.match(sky, /simplexNoiseGLSL/, 'nebula reuses the personal simplex-noise source');
assert.match(cluster, /generated\.positions\[i\] \*= 2/, 'shared galaxy depth is expanded without changing the personal galaxy profile');
assert.match(wrapper, /SharedGalaxy2D/, 'Canvas 2D fallback remains when WebGL is unavailable');
assert.match(wrapper, /WebGL initialization failed/, 'fallback reports the actual WebGL initialization error');
assert.match(wrapper, /cloneNode\(false\)/, 'fallback gets a fresh canvas when WebGL has claimed the original context');
assert.doesNotMatch(labels, /nebulaSprites|nebulaTexture|createRadialGradient/, 'names have no decorative haze');
assert.match(labels, /Nunito Sans/, 'shared-galaxy names use a soft sans-serif font');
assert.match(labels, /this\.fontSize = mobile \? 11 : 12/, 'shared-galaxy names stay small on desktop and mobile');
assert.doesNotMatch(labels, /ctx\.(?:fillRect|strokeRect|strokeText)\(/, 'shared-galaxy names have no box or text outline');
assert.match(labels, /ctx\.shadowBlur = 1\.2 \* scale/, 'name glyphs use only a subtle colored edge lift');
assert.match(labels, /ctx\.fillStyle = '#f4edf1'/, 'name glyphs use a soft, readable color');
assert.match(gl, /document\.hidden/, 'rendering pauses while the tab is hidden');
assert.match(gl, /prefers-reduced-motion/, 'reduced-motion preference is honoured');
assert.match(gl, /this\.motionScale = this\.reducedMotion \? 0\.22 : 1/, 'reduced motion keeps a slow living background');
assert.match(gl, /renderer\.info\.autoReset = false/, 'diagnostic draw-call totals include the complete composer frame');
assert.match(gl, /frameTimeMs:/, 'live diagnostics expose measured frame time');
assert.match(gl, /enabled: !this\.reducedMotion/, 'reduced motion disables high-salience events');
assert.match(gl, /removeEventListener\('pointerdown', this\.boundDown\)/, 'listeners are removed on dispose');
assert.match(gl, /composer\?\.dispose/, 'GPU resources are disposed');
assert.match(gl, /degrade\(\)/, 'adaptive quality exists for weaker devices');
assert.match(gl, /passive: false/, 'pointerdown may call preventDefault');
assert.doesNotMatch(gl + cluster + cometSource + labels, /fillText\([^)]*(wish|caption|title|hint)/i, 'no wish/caption text is drawn');
const sharedMarkup = html.match(/<section id="sharedGalaxyView"[\s\S]*?<\/section>/)?.[0] || '';
assert.doesNotMatch(sharedMarkup, /<h[1-6]|<p[ >]|<span|<button/, 'shared markup carries no visible words or controls');
assert.match(main, /get sharedGalaxy\(\)/, 'verification hook exists');
for (const recipient of recipients) assert.ok(recipient.id && recipient.display && recipient.wish, 'recipient data (id, name, wish) is intact');

console.log('Shared galaxy WebGL tests passed: personal shaders byte-identical, 4 viewports laid out, connected bridge graph, scheduler (one at a time, three-second cadence, comet priority, no cycle), gentle galaxy drift, 12 distinct cosmic events, bridge convergence, accelerating comet lifecycle, single renderer/loop, lifecycle cleanup.');
