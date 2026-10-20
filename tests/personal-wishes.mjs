import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { recipients, findRecipient, splitPersonalWish } from '../src/data/recipients.js';
import { recipientArtDirections } from '../src/data/artDirections.js';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');
const [ui, css, html, typography] = await Promise.all([
  read('../src/ui/interface.js'),
  read('../src/style.css'),
  read('../index.html'),
  read('../src/graphics/ParticleTypography.js')
]);

assert.equal(recipients.length, 9, 'all nine personal recipients must remain');
assert.equal(new Set(recipients.map(person => person.wish)).size, 9, 'each recipient keeps a distinct authored wish');
assert.equal(new Set(recipients.map(person => person.slug)).size, 9, 'each wish route remains unique');
assert.equal(new Set(recipients.map(person => recipientArtDirections[person.id]?.style)).size, 9,
  'each recipient must resolve to its own visual art direction');

const alignmentValues = new Set(['left', 'center', 'right']);
const ornamentValues = new Set(['rose', 'ribbon', 'bloom', 'crystal', 'drift', 'harmonic', 'botanical', 'orbital', 'deepfield']);
for (const recipient of recipients) {
  assert.equal(findRecipient(recipient.id)?.slug, recipient.slug, `student ID routes to ${recipient.slug}`);
  assert.equal(findRecipient(recipient.slug)?.id, recipient.id, `slug routes to ${recipient.id}`);
  const { lead, body } = splitPersonalWish(recipient.wish);
  assert.ok(lead.length > 0, `${recipient.display} has an editorial lead`);
  assert.ok(body.length > 0, `${recipient.display} has a continuation`);
  assert.equal(`${lead}${body ? ` ${body}` : ''}`, recipient.wish,
    `${recipient.display}'s authored message is preserved byte-for-byte after presentation splitting`);
  const direction = recipientArtDirections[recipient.id];
  assert.ok(direction, `art direction remains attached to ${recipient.id}`);
  assert.ok(Number.isFinite(direction.reveal.panelWidth) && direction.reveal.panelWidth >= 500,
    `${recipient.display} has a readable personal panel width`);
  assert.ok(Number.isFinite(direction.reveal.panelLift), `${recipient.display} has a safe vertical panel anchor`);
  assert.ok(alignmentValues.has(direction.reveal.align), `${recipient.display} has a valid editorial alignment`);
  assert.ok(ornamentValues.has(direction.reveal.ornament), `${recipient.display} has a distinct cosmic motif`);
  assert.match(css, new RegExp(`#recipientWish\\[data-ornament="${direction.reveal.ornament}"\\]`),
    `${recipient.display}'s personal ornament is consumed by the wish stylesheet`);
}

assert.match(ui, /renderWish\(recipient, direction\)/, 'the renderer receives the complete recipient and art direction');
assert.match(ui, /this\.wish\.dataset\.recipientId = recipient\.id/, 'the wish element records its recipient identity');
assert.match(ui, /this\.reveal\.dataset\.recipientId = recipient\.id/, 'the reveal is explicitly bound to the selected recipient');
assert.match(ui, /this\.wish\.dataset\.ornament = direction\.reveal\.ornament/, 'the wish ornament is bound to the same art direction as its recipient');
assert.match(ui, /document\.body\.dataset\.recipientSlug = recipient\.slug/, 'the visual state follows the selected slug');
assert.match(ui, /document\.body\.style\.setProperty\('--recipient-panel-width'/, 'panel geometry is set from the selected recipient profile');
assert.match(ui, /document\.body\.style\.removeProperty\('--recipient-panel-width'/, 'Back/reset clears personalized layout variables');
assert.match(typography, /document\.fonts\.load\('900 370px "Baloo 2"'/, 'the actual recipient title font is awaited before raster sampling');
assert.match(typography, /document\.fonts\.load\('800 275px "Plus Jakarta Sans"'/, 'the actual affiliation morph font is requested before scene initialization');
assert.match(typography, /Promise\.race\(\[fontPromise, timeoutPromise\]\)/, 'font hosting cannot stall startup indefinitely');
assert.match(ui, /this\.particleFontReady = prepareParticleTypography\(\)/, 'recipient reveal shares the same font readiness gate');
assert.match(css, /\.wish-lead\s*\{[^}]*display:\s*block/s, 'the lead sentence participates in profile-specific alignment');
assert.match(html, /id="recipientWish"/, 'the original personal-wish DOM slot remains intact');

console.log(`Personal wish contracts passed: ${recipients.length} unique messages, identity-bound routes, nine art-directed layouts, exact copy preservation.`);
