import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { recipients, findRecipient } from '../src/data/recipients.js';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');
const [html, css, ui, shader, particles, scene, galaxy, fallback] = await Promise.all([
  read('../index.html'), read('../src/style.css'), read('../src/ui/interface.js'),
  read('../src/graphics/shaders.js'), read('../src/graphics/ParticleCloud.js'),
  read('../src/graphics/StellarScene.js'), read('../src/graphics/GalaxyArchitecture.js'),
  read('../src/graphics/FallbackScene.js')
]);

assert.equal(recipients.length, 9, 'all nine personalized recipients remain in the original dataset');
for (const recipient of recipients) {
  assert.ok(findRecipient(recipient.id), `student code ${recipient.id} still resolves`);
  assert.equal(findRecipient(recipient.slug)?.id, recipient.id, `slug mapping remains stable for ${recipient.id}`);
  assert.ok(recipient.wish.length > 110, `full personalized wish remains for ${recipient.id}`);
}

assert.doesNotMatch(html, /gatewayHeader|gatewayStardustCanvas|gateway-backdrop-shield|HNUE[\s\S]*SMCS[\s\S]*K75CLC/, 'the entry screen has no oversized DOM signature banner; morphic lettering stays in the GPU scene');
assert.doesNotMatch(html, /returnPortal|return-portal/, 'the detached Back button remains absent');
assert.match(html, /<form id="portalForm"[\s\S]*id="studentCode"[\s\S]*type="submit"/, 'the minimal gateway preserves input and submit');
assert.doesNotMatch(css, /gateway-header|gateway-cluster|gateway-backdrop-shield|portal-rule/, 'signature-only CSS is removed');
assert.match(css, /\.portal\s*\{[^}]*background:\s*transparent[^}]*box-shadow:\s*none/s, 'the input surface is not a glass card');
assert.match(css, /\.portal::before\s*\{\s*content:\s*none;?\s*\}/, 'the input surface has no panel overlay');
assert.match(css, /\.input-wrap\s*\{[^}]*border-bottom/, 'a single understated input underline remains');
assert.match(css, /STABLE WISH ANCHOR[\s\S]*?\.reveal \{[^}]*position: absolute;[^}]*top: auto;[^}]*bottom: calc\(clamp\(42px, 6vh, 68px\)/, 'wish panel retains absolute positioning and stays anchored to the original lower composition');
assert.match(css, /STABLE WISH ANCHOR[\s\S]*?left: calc\(50% \+ clamp\(-72px, var\(--recipient-panel-offset, 0px\), 72px\)\)/, 'desktop wish composition preserves the recipient-specific horizontal offset');
assert.match(css, /@media \(max-width: 768px\)[\s\S]*?\.reveal \{[^}]*left: 50%;[^}]*bottom: calc\(52px \+ var\(--safe-bottom\)\)/, 'mobile wish remains centered and anchored above the lower safe area');
assert.match(html, /id="recipientName" class="sr-only"/, 'accessible personalized name remains in the DOM');
assert.match(html, /<button id="brandBackButton" class="corner corner--tl brand-back-button"[^>]*disabled/, 'the STELLAR / HNUE wordmark is the inactive Back control on the entry screen');
assert.match(css, /\.brand-back-button\s*\{[\s\S]*min-height:\s*44px[\s\S]*background:\s*transparent/, 'the logo Back hit-area remains accessible without button chrome');
assert.match(particles, /const SHAPES = \['HNUE', 'SMCS', 'K75CLC'\]/, 'the waiting scene preserves the three-stage HNUE → SMCS → K75CLC signature cycle');
assert.match(particles, /makeTextSamples\('HNUE',[\s\S]*makeTextSamples\('SMCS',[\s\S]*makeTextSamples\('K75CLC'/, 'all three signature marks are sampled into GPU particle targets');
assert.match(particles, /setAttribute\('aHNUE'[\s\S]*setAttribute\('aSMCS'[\s\S]*setAttribute\('aK75'/, 'the morph targets are stored as reusable geometry attributes');
assert.match(shader, /attribute vec3 aHNUE;[\s\S]*attribute vec3 aSMCS;[\s\S]*attribute vec3 aK75;/, 'the vertex shader consumes the three original signature targets');
assert.match(shader, /if \(n < 0\.5\) return aHNUE;[\s\S]*if \(n < 1\.5\) return aSMCS;[\s\S]*return aK75;/, 'the GPU shader interpolates the intended sequence');
assert.match(particles, /this\.points\.renderOrder = 100/, 'foreground GPU identity sits at the top of its isolated post-bloom scene');
assert.match(scene, /new ParticleCloud\(this\.identityScene/, 'morphic identity renders in its own scene above the post-bloom background');
assert.match(galaxy, /this\.points\.renderOrder = 1\.5/, 'the galaxy stays in its background draw-order layer');
assert.match(fallback, /const words = \['HNUE', 'SMCS', 'K75CLC'\]/, 'the low-power fallback keeps the same signature sequence without altering the text');
assert.match(fallback, /this\.galaxyProfile = GALAXY_PROFILES\.twinSpiral;/, 'the Canvas fallback initializes and resets to an existing galaxy profile');
assert.doesNotMatch(fallback, /GALAXY_PROFILES\.spiral\b/, 'the fallback never reads a non-existent spiral profile');
assert.match(ui, /if \(this\.destroyed \|\| generation !== this\.openGeneration \|\| this\.activeRecipient\?\.slug !== recipient\.slug\) return;/, 'a stale entrance completion cannot reopen the old wish after Back');
assert.doesNotMatch(ui, /Wishfall|wishfall|WISHFALL/, 'the retired comet-wish event is no longer wired into the interface');
assert.match(ui, /const generation = \+\+this\.openGeneration;\s*this\.activeRecipient = null;[\s\S]*brandBackButton\) this\.brandBackButton\.disabled = true;/, 'Back invalidates async work and disables the logo hit-area immediately');
assert.match(ui, /this\.cosmicDirector\.stop\(\);\s*this\.idleCosmicDirector\.stop\(\);/, 'Back stops both cosmic event schedules');
assert.match(ui, /gsap\.killTweensOf\('#eventFlash'\);\s*gsap\.set\('#eventFlash', \{ opacity: 0 \}\);/, 'Back clears any in-flight event flash');
assert.match(ui, /this\.input\.value = '';[\s\S]*this\.updateCounter\(\);[\s\S]*this\.setStatus\('ENTER YOUR ORBIT'\)/, 'Back resets code and waiting status');
assert.match(ui, /this\.input\.focus\(\{ preventScroll: true \}\)/, 'the code input is focused after the return transition');
assert.match(ui, /this\.brandBackButton\?\.addEventListener\('click', this\.returnHandler\)/, 'the logo itself performs Back');
assert.match(ui, /history\.replaceState\(null, '', `\$\{location\.pathname\}\$\{location\.search\}`\)/, 'Back clears the recipient hash without a reload');
assert.match(scene, /\.to\(this\.galaxy\.uniforms\.uNova, \{ value: 0\.25, duration: 1\.5/, 'rift nova decay belongs to the cancellable event timeline');
assert.match(scene, /\.to\(this\.galaxy\.uniforms\.uNova, \{ value: 0\.25, duration: 1\.8/, 'genesis nova decay belongs to the cancellable event timeline');
assert.match(scene, /this\.stopCosmicEvent\(\);\s*const center = this\.cosmicEventCenter/, 'a replacement event cancels the prior event and waves first');
assert.match(scene, /duration: Number\(timeline\.duration\(\)\.toFixed\(3\)\)/, 'runtime cosmic-event telemetry exposes the actual GSAP timeline duration');
assert.doesNotMatch(ui, /revealGatewayTypography/, 'removed gateway typography must have no orphaned call site');
assert.match(scene, /const prepare = slow \? 0\.36 : 0\.75;/, 'normal cosmic events use a deliberate anticipation phase');
assert.match(scene, /const peak = slow \? 0\.68 : 1\.25;/, 'normal cosmic events reserve a clear main-action phase');
assert.match(scene, /const recover = slow \? 0\.48 : 1\.0;/, 'normal cosmic events leave sufficient time for trails and dissipation');
assert.equal((scene.match(/onComplete: \(\) => \{\s*const index = this\.waveTimelines\.indexOf\(waveTimeline\);/g) || []).length, 2, 'both wave systems remove their timelines after completion');
assert.match(scene, /gsap\.killTweensOf\(this\.core\?\.material\)[\s\S]*gsap\.killTweensOf\('#eventFlash'\)/, 'returning to idle cancels cosmetic reveal tweens outside the event timeline');

console.log(`STELLAR contract tests passed: ${recipients.length} recipients preserved, minimal gateway, HNUE → SMCS → K75CLC GPU morph, interruption-safe Back navigation and event timelines.`);
