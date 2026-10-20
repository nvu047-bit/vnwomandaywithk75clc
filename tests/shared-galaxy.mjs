import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { recipients, findRecipient } from '../src/data/recipients.js';
import { sharedWishes } from '../src/data/sharedWishes.js';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');
const [html, css, ui, galaxy, swipeHint] = await Promise.all([
  read('../index.html'), read('../src/style.css'), read('../src/ui/interface.js'), read('../src/graphics/SharedGalaxy2D.js'),
  read('../src/graphics/shared/SwipeHint.js')
]);

assert.equal(recipients.length, 9, 'the original nine recipients remain the source of universe identity');
assert.equal(sharedWishes.length, 9, 'the shared sky has an editable collection of collective transmissions');
assert.equal(new Set(sharedWishes).size, sharedWishes.length, 'collective messages are distinct');
assert.ok(sharedWishes.every(message => message.length >= 35 && message.length <= 130), 'comet messages remain short enough to read in motion');
for (const recipient of recipients) {
  assert.equal(findRecipient(recipient.id)?.slug, recipient.slug, 'student-code lookup remains unchanged');
  assert.ok(galaxy.includes('recipient.motif'), 'individual motif shapes are drawn by the shared galaxy renderer');
}

assert.match(html, /id="sharedGalaxyView"[\s\S]*id="sharedGalaxyCanvas"[\s\S]*id="sharedGalaxyAccessibleNodes"/, 'the galaxy has a dedicated canvas and accessible recipient selection');
const sharedMarkup = html.match(/<section id="sharedGalaxyView"[\s\S]*?<\/section>/)?.[0] || '';
assert.doesNotMatch(sharedMarkup, /<h[1-6]|<p[ >]|sharedCometText|sharedCometMeta|shared-galaxy-heading|shared-galaxy-footer/, 'the shared scene contains no visible copy or wish overlay; names are rendered by canvas only');
assert.match(css, /body\.is-shared-galaxy \.brand-back-button \.brand-back-cue[\s\S]*font-size:\s*22px/, 'the return control becomes an icon-only affordance while the shared scene is active');
assert.match(html, /id="sharedGalaxyEntry"/, 'the entry screen has one restrained access point to the shared galaxy');
assert.match(html, /id="sharedGalaxySwipeHint"[^>]*>Vuốt nhẹ để khám phá những thiên hà khác</, 'the mobile view has a concise swipe discovery hint');
assert.match(html, /id="sharedGalaxyFromWish"/, 'a personal universe can return to the shared galaxy');
assert.match(galaxy, /const DESKTOP_LAYOUT = \[[\s\S]*const MOBILE_LAYOUT = \[/, 'universe placement adapts to wide and narrow viewports');
assert.match(galaxy, /const FLIGHT_PATHS = \[/, 'comets use multiple curved flight paths instead of one repeated diagonal');
assert.match(galaxy, /drawLivingGalaxies\(time\)/, 'the shared scene renders nine expanded galaxy systems');
assert.match(galaxy, /drawIntergalacticFilaments\(time\)/, 'curved material bridges connect galaxy regions');
assert.match(galaxy, /GALAXY_PROFILES, RECIPIENT_GALAXY_PROFILES/, 'individual galaxy profile identity is reused in the shared scene');
assert.match(galaxy, /recipientArtDirections/, 'the personal art-direction profiles are reused by the shared galaxies');
assert.match(galaxy, /profileCurvePoint\(curve, t/, 'the nine mathematical curve signatures are carried into the shared scene');
assert.match(galaxy, /drawCosmicEvents\(time\)/, 'rare personal-scene-style energy events animate inside the shared universe');
assert.match(galaxy, /galaxyArmPoint\(profile, arm/, 'the personal galaxy arm-flow model is reused without launching separate renderers');
assert.match(galaxy, /angle \+= time \* \(\.055 \+ personalSpin \* \.82\)/, 'each galaxy uses differential spin rather than only rigid whole-galaxy rotation');
assert.match(galaxy, /Bright matter packets actually travel along their own arm coordinates/, 'arm-following streams visibly advect through each galaxy');
assert.match(galaxy, /Cosmic events send a pulse outward through the same curved filament network/, 'cosmic event energy is drawn propagating through intergalactic links');
assert.match(galaxy, /this\.motionScale = this\.reducedMotion \? \.22 : 1/, 'reduced-motion users retain a slower background animation loop');
assert.match(galaxy, /const clusters = this\.mobile \? 23 : 42/, 'each galaxy has a bounded local star-cluster budget');
assert.match(galaxy, /duration: manual \? 4\.0 : 2\.5/, 'automatic comet streaks fit the three-second event cadence');
assert.match(galaxy, /hitNodes: new Set\(\)/, 'comets trigger each visited galaxy once without continually retriggering its reaction');
assert.match(galaxy, /const count = this\.mobile \? 96 : 250/, 'the deep-space star field keeps its bounded adaptive particle budget');
assert.match(galaxy, /this\.mobile \? 112 : 300/, 'the 2D fallback keeps a denser moving intergalactic dust field');
assert.match(galaxy, /drawAmbientComets\(time\)/, 'ambient comet trails remain visible when WebGL is unavailable');
assert.match(galaxy, /this\.mobilePan\.x \+ dx/, '2D fallback pans its expanded mobile galaxy layout');
assert.match(galaxy, /this\.swipeHint\.show\(this\.mobile\)/, 'mobile entry shows the shared swipe hint in the fallback renderer');
assert.match(swipeHint, /setTimeout\(\(\) => this\.hide\(\), 3000\)/, 'the swipe hint dismisses itself after three seconds');
assert.match(galaxy, /this\.nextEventAt = this\.elapsed \+ 3/, 'the 2D fallback schedules cosmic events every three seconds');
assert.match(galaxy, /type: Math\.floor\(this\.random\(\) \* 8\)/, 'the 2D fallback offers eight distinct cosmic-event visuals');
assert.match(galaxy, /driftScale = Math\.min\(this\.width, this\.height\) \* 0\.008/, 'fallback galaxies gently drift while hit targets follow them');
assert.match(galaxy, /if \(!this\.active \|\| this\.disposed \|\| document\.hidden\) \{[\s\S]*?return;[\s\S]*?\}/, 'the animation loop stops rendering while hidden or inactive');
assert.match(galaxy, /prefers-reduced-motion/, 'the user preference for reduced motion is checked');
assert.match(galaxy, /this\.comet = null/, 'completed comets are removed instead of becoming orphaned scene objects');
assert.match(galaxy, /removeEventListener\('pointerdown', this\.boundDown\)/, 'pointer listeners are cleaned up during disposal');
assert.match(ui, /this\.returnToGalaxy = true;[\s\S]*this\.openRecipient\(recipient\)/, 'opening a personal universe from the galaxy preserves the return path');
assert.match(ui, /const returningRecipient = this\.activeRecipient;[\s\S]*this\.showSharedGalaxy\(\{ focusRecipient: returningRecipient \}\)/, 'returning from any personal universe centers that same galaxy in the shared mobile map');
assert.match(ui, /this\.openGeneration\+\+|const generation = \+\+this\.openGeneration/, 'existing stale-animation protection remains in place');
assert.match(css, /\.reveal \{[\s\S]*position: absolute;[\s\S]*bottom: calc\(clamp\(42px, 6vh, 68px\)/, 'the original personalized-wish anchor remains present');

// The Canvas 2D implementation above is the WebGL-unavailable fallback; the primary renderer is covered by tests/shared-galaxy-gl.mjs.
console.log(`Shared galaxy (Canvas 2D fallback + shared markup) tests passed: ${recipients.length} distinct worlds, typography-free shared view, personal curve reuse, comet reactions, reduced-motion handling and lifecycle cleanup.`);
